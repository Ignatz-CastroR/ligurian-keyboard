/*
 * db.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 20:15:56, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/17, 07:28:44: latestLemmas[], the latest additions.
 * Updated:  2026/10/18, 09:02:15: lemmasWithPublicId[], to find an
 *           entry by its code; exportBackup[] and restoreBackup[]
 *           [decisions 0030 and 0031].
 * Purpose:  Every conversation between the lexicon manager and the
 *           database. Views never call Supabase directly; they call
 *           these functions, so the queries live in one place.
 * Contract: Updates use optimistic locking [db/README.md]: they match
 *           on id AND version, and zero updated rows raise a "conflict"
 *           AppError. Nothing here deletes a row; deletion is setting
 *           deleted_at. Every failure becomes an AppError.
 */

import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import { skeleton } from "../../engine/src/skeleton.ts";
import { searchKeyFilter } from "./forms.ts";
import type { RestoreReport } from "./backup.ts";
import type {
  AuditEntry, Entry, Gloss, Lemma, LexiconTable, Profile, QueueItem,
  ReferenceData, RefItem, Role, Sense, Status, Wordform,
} from "./types.ts";

export type AppErrorKind =
  "conflict" | "permission" | "duplicate" | "parent" | "invalid" | "notfound" | "notempty" | "generic";

export class AppError extends Error {
  public readonly kind: AppErrorKind;

  public constructor(kind: AppErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

interface PgError {
  code?: string;
  message: string;
}

// PostgreSQL error codes [SQLSTATE] raised by our migrations.
function toAppError(error: PgError): AppError {
  const code: string = error.code ?? "";
  let kind: AppErrorKind = "generic";
  if (code === "42501") {
    kind = "permission";
  } else if (code === "23505") {
    kind = "duplicate";
  } else if (code === "23503") {
    kind = "parent";
  } else if (code === "23514" || code === "22P02" || code === "23502" || code === "22001" || code === "22023") {
    kind = "invalid";
  } else if (code === "55000") {
    kind = "notempty";
  }
  return new AppError(kind, error.message);
}

let client: SupabaseClient | null = null;

export function connect(url: string, publishableKey: string): void {
  client = createClient(url, publishableKey);
}

function db(): SupabaseClient {
  if (client === null) {
    throw new AppError("generic", "database not connected");
  }
  return client;
}

/* ====================================================================
   Session
   ==================================================================== */

export async function currentSession(): Promise<Session | null> {
  const { data } = await db().auth.getSession();
  return data.session;
}

export function onSessionChange(listener: (session: Session | null) => void): void {
  db().auth.onAuthStateChange((_event, session) => listener(session));
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await db().auth.signInWithPassword({ email, password });
  if (error !== null) {
    throw new AppError("permission", error.message);
  }
}

export async function signOut(): Promise<void> {
  await db().auth.signOut();
}

export async function myProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await db().from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error !== null) {
    throw toAppError(error);
  }
  return data as Profile | null;
}

/* ====================================================================
   Reference data
   ==================================================================== */

export async function referenceData(): Promise<ReferenceData> {
  const [varieties, orthographies, languages] = await Promise.all([
    db().from("varieties").select("code, name").order("code"),
    db().from("orthographies").select("code, name").order("code"),
    db().from("gloss_languages").select("code, name").order("code"),
  ]);
  for (const result of [varieties, orthographies, languages]) {
    if (result.error !== null) {
      throw toAppError(result.error);
    }
  }
  return {
    varieties: (varieties.data ?? []) as RefItem[],
    orthographies: (orthographies.data ?? []) as RefItem[],
    languages: (languages.data ?? []) as RefItem[],
  };
}

/* ====================================================================
   Search: by ASCII key, on headwords and on every wordform
   ==================================================================== */

const SEARCH_LIMIT: number = 50;

// The key the database stores for a typed query; "" when nothing usable
// was typed.
export function searchKeyFor(query: string): string {
  return searchKeyFilter(skeleton(query));
}

export async function searchLemmas(query: string): Promise<Lemma[]> {
  const key: string = searchKeyFor(query);
  let lemmas: Lemma[] = [];

  if (key !== "") {
    const byHeadword = await db().from("lemmas").select("*")
      .like("headword_key", `${key}%`).order("headword_key").limit(SEARCH_LIMIT);
    if (byHeadword.error !== null) {
      throw toAppError(byHeadword.error);
    }
    lemmas = (byHeadword.data ?? []) as Lemma[];

    // Inflected forms point to their lemma: pénne finds pénna.
    const byForm = await db().from("wordforms").select("lemma_id")
      .like("form_key", `${key}%`).eq("is_base", false).limit(SEARCH_LIMIT);
    if (byForm.error !== null) {
      throw toAppError(byForm.error);
    }
    const known: Set<number> = new Set(lemmas.map((l) => l.id));
    const extraIds: number[] = [...new Set(((byForm.data ?? []) as { lemma_id: number }[])
      .map((r) => r.lemma_id))].filter((id) => !known.has(id));

    if (extraIds.length > 0) {
      const extra = await db().from("lemmas").select("*").in("id", extraIds);
      if (extra.error !== null) {
        throw toAppError(extra.error);
      }
      lemmas = lemmas.concat((extra.data ?? []) as Lemma[]);
    }
  }
  return lemmas;
}

/* The lemma a public identifier names: the lemma itself, or the lemma
   of the wordform. code must already be valid [public-id.ts]; at most
   one row can match, since codes are unique across both tables. */
export async function lemmasWithPublicId(code: string): Promise<Lemma[]> {
  const byLemma = await db().from("lemmas").select("*").eq("public_id", code);
  if (byLemma.error !== null) {
    throw toAppError(byLemma.error);
  }
  let lemmas: Lemma[] = (byLemma.data ?? []) as Lemma[];
  if (lemmas.length === 0) {
    const byForm = await db().from("wordforms").select("lemma_id").eq("public_id", code);
    if (byForm.error !== null) {
      throw toAppError(byForm.error);
    }
    const ids: number[] = ((byForm.data ?? []) as { lemma_id: number }[]).map((r) => r.lemma_id);
    if (ids.length > 0) {
      const parent = await db().from("lemmas").select("*").in("id", ids);
      if (parent.error !== null) {
        throw toAppError(parent.error);
      }
      lemmas = (parent.data ?? []) as Lemma[];
    }
  }
  return lemmas;
}

/* ====================================================================
   Latest additions: the approved lemmas created most recently
   ==================================================================== */

export const LATEST_COUNT: number = 20;

/* Approved and not deleted, newest first by creation time, for every
   viewer alike: staff do not see pending lemmas here, so the list means
   the same thing to everyone. A lemma proposed long ago and approved
   today is placed by its creation date; the database records no
   approval time. */
export async function latestLemmas(): Promise<Lemma[]> {
  const { data, error } = await db().from("lemmas").select("*")
    .eq("status", "approved").is("deleted_at", null)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .limit(LATEST_COUNT);
  if (error !== null) {
    throw toAppError(error);
  }
  return (data ?? []) as Lemma[];
}

/* ====================================================================
   One entry with all its children
   ==================================================================== */

export async function loadEntry(lemmaId: number): Promise<Entry> {
  const lemmaResult = await db().from("lemmas").select("*").eq("id", lemmaId).maybeSingle();
  if (lemmaResult.error !== null) {
    throw toAppError(lemmaResult.error);
  }
  if (lemmaResult.data === null) {
    throw new AppError("notfound", `lemma ${lemmaId}`);
  }

  const [formsResult, sensesResult] = await Promise.all([
    db().from("wordforms").select("*").eq("lemma_id", lemmaId)
      .order("is_base", { ascending: false }).order("form"),
    db().from("senses").select("*").eq("lemma_id", lemmaId)
      .order("deleted_at", { ascending: true, nullsFirst: true }).order("sense_number"),
  ]);
  if (formsResult.error !== null) {
    throw toAppError(formsResult.error);
  }
  if (sensesResult.error !== null) {
    throw toAppError(sensesResult.error);
  }

  const senses: Sense[] = (sensesResult.data ?? []) as Sense[];
  let glosses: Gloss[] = [];
  if (senses.length > 0) {
    const glossResult = await db().from("glosses").select("*")
      .in("sense_id", senses.map((s) => s.id)).order("language").order("gloss");
    if (glossResult.error !== null) {
      throw toAppError(glossResult.error);
    }
    glosses = (glossResult.data ?? []) as Gloss[];
  }

  return {
    lemma: lemmaResult.data as Lemma,
    wordforms: (formsResult.data ?? []) as Wordform[],
    senses: senses.map((sense) => ({ sense, glosses: glosses.filter((g) => g.sense_id === sense.id) })),
  };
}

// Lemmas sharing a headword key: possible duplicates of a new proposal.
export async function lemmasWithKey(headword: string): Promise<Lemma[]> {
  const key: string = searchKeyFor(headword);
  let lemmas: Lemma[] = [];
  if (key !== "") {
    const { data, error } = await db().from("lemmas").select("*").eq("headword_key", key).limit(SEARCH_LIMIT);
    if (error !== null) {
      throw toAppError(error);
    }
    lemmas = (data ?? []) as Lemma[];
  }
  return lemmas;
}

/* ====================================================================
   Creating entries. The database stamps author, version and dates,
   and forces contributors' rows to pending.
   ==================================================================== */

export interface NewLemma {
  headword: string;
  variety: string;
  orthography: string;
  part_of_speech: string | null;
  note: string | null;
  status: Status;
}

async function insertReturningId(table: LexiconTable, row: Record<string, unknown>): Promise<number> {
  const { data, error } = await db().from(table).insert(row).select("id").single();
  if (error !== null) {
    throw toAppError(error);
  }
  return (data as { id: number }).id;
}

export function createLemma(lemma: NewLemma): Promise<number> {
  return insertReturningId("lemmas", { ...lemma });
}

export function createWordform(lemmaId: number, form: string, tag: string | null, freq: number, status: Status): Promise<number> {
  return insertReturningId("wordforms", { lemma_id: lemmaId, form, grammatical_tag: tag, freq, status });
}

export function createSense(lemmaId: number, definitionIt: string | null, status: Status): Promise<number> {
  return insertReturningId("senses", { lemma_id: lemmaId, definition_it: definitionIt, status });
}

export function createGloss(senseId: number, language: string, gloss: string, status: Status): Promise<number> {
  return insertReturningId("glosses", { sense_id: senseId, language, gloss, status });
}

/* ====================================================================
   Updating entries, with optimistic locking
   ==================================================================== */

export async function updateRow(table: LexiconTable, id: number, version: number, patch: Record<string, unknown>): Promise<void> {
  const { data, error } = await db().from(table).update(patch)
    .eq("id", id).eq("version", version).select("id");
  if (error !== null) {
    throw toAppError(error);
  }
  if ((data ?? []).length === 0) {
    throw new AppError("conflict", `${table} ${id} version ${version}`);
  }
}

export function setStatus(table: LexiconTable, id: number, version: number, status: Status): Promise<void> {
  return updateRow(table, id, version, { status });
}

export function softDelete(table: LexiconTable, id: number, version: number): Promise<void> {
  return updateRow(table, id, version, { deleted_at: new Date().toISOString() });
}

export function restore(table: LexiconTable, id: number, version: number): Promise<void> {
  return updateRow(table, id, version, { deleted_at: null });
}

// For the review queue, which lists rows without their version.
export async function setStatusById(table: LexiconTable, id: number, status: Status): Promise<void> {
  const { data, error } = await db().from(table).select("version").eq("id", id).maybeSingle();
  if (error !== null) {
    throw toAppError(error);
  }
  if (data === null) {
    throw new AppError("notfound", `${table} ${id}`);
  }
  await setStatus(table, id, (data as { version: number }).version, status);
}

/* ====================================================================
   Review queue, people and history
   ==================================================================== */

export async function reviewQueue(): Promise<QueueItem[]> {
  const { data, error } = await db().from("review_queue").select("*");
  if (error !== null) {
    throw toAppError(error);
  }
  return (data ?? []) as QueueItem[];
}

// Staff see every profile; everyone else sees only their own.
export async function profiles(): Promise<Profile[]> {
  const { data, error } = await db().from("profiles").select("*").order("created_at");
  if (error !== null) {
    throw toAppError(error);
  }
  return (data ?? []) as Profile[];
}

export async function updateProfile(userId: string, patch: { display_name?: string; role?: Role }): Promise<void> {
  const { data, error } = await db().from("profiles").update(patch).eq("user_id", userId).select("user_id");
  if (error !== null) {
    throw toAppError(error);
  }
  if ((data ?? []).length === 0) {
    throw new AppError("permission", `profile ${userId}`);
  }
}

// The history of a lemma and of every row hanging from it.
export async function entryHistory(entry: Entry): Promise<AuditEntry[]> {
  const ids: Record<LexiconTable, number[]> = {
    lemmas: [entry.lemma.id],
    wordforms: entry.wordforms.map((w) => w.id),
    senses: entry.senses.map((s) => s.sense.id),
    glosses: entry.senses.flatMap((s) => s.glosses.map((g) => g.id)),
  };
  let history: AuditEntry[] = [];
  for (const table of Object.keys(ids) as LexiconTable[]) {
    if (ids[table].length > 0) {
      const { data, error } = await db().from("audit_log").select("*")
        .eq("table_name", table).in("row_id", ids[table]);
      if (error !== null) {
        throw toAppError(error);
      }
      history = history.concat((data ?? []) as AuditEntry[]);
    }
  }
  history.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.id - a.id));
  return history;
}

/* ====================================================================
   Export: the published lexicon in the engine's TSV format
   ==================================================================== */

export async function exportTsv(): Promise<string> {
  const { data, error } = await db().rpc("export_lexicon_tsv");
  if (error !== null) {
    throw toAppError(error);
  }
  return data as string;
}

/* ====================================================================
   Backups, for admins: the database refuses everyone else
   ==================================================================== */

export async function exportBackup(): Promise<unknown> {
  const { data, error } = await db().rpc("export_backup");
  if (error !== null) {
    throw toAppError(error);
  }
  return data as unknown;
}

// Only into a dictionary with no entries and no history at all.
export async function restoreBackup(backup: Record<string, unknown>): Promise<RestoreReport> {
  const { data, error } = await db().rpc("restore_backup", { p_backup: backup });
  if (error !== null) {
    throw toAppError(error);
  }
  return data as RestoreReport;
}
