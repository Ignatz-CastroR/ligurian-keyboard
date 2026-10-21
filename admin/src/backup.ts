/*
 * backup.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 08:58:40, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The lexicon manager's side of backups: the name of a backup
 *           file, and a check of a file chosen for a restore before it
 *           is sent, so that a wrong file is refused at once and with a
 *           clear reason. Pure functions, no DOM, tested in Node.
 * Contract: The format is written by public.export_backup[] and read by
 *           public.restore_backup[], both in
 *           db/migrations/0006_public_ids_and_backups.sql; the database
 *           checks every file again and refuses any restore into a
 *           dictionary that is not empty.
 * Updated:  2026/10/18, 12:33:40: backupFileName[] builds its name with
 *           stampedFileName[], shared with the TSV and CSV downloads.
 * Updated:  2026/10/18, 16:48:20: assembleBackup[] builds the same file
 *           from many small reads, so that no single statement can meet
 *           the database's time limit, however large the dictionary.
 * Updated:  2026/10/21, 12:16:57: chosenFileText[], the file name
 *           the restore card shows beside its own file button.
 * Updated:  2026/10/21, 12:22:52: the grammar's six lists in every
 *           backup [migration 0013]; a file made before them is still
 *           accepted.
 * Decision: docs/decisions/0031-backups.md
 */

import { BACKUP_FILE_STEM, stampedFileName } from "./file-names.ts";

export const BACKUP_FORMAT: string = "ligurian-keyboard-backup";
export const BACKUP_FORMAT_VERSION: number = 1;

// The tables a backup must hold, in the order a restore loads them.
export const BACKUP_TABLES: readonly string[] = [
  "varieties", "orthographies", "gloss_languages", "profiles",
  "lemmas", "wordforms", "senses", "glosses", "audit_log",
];

/* The grammar's lists [migration 0013], written in every backup since
   0.16.0; a file made before has none, and still restores. */
export const GRAMMAR_TABLES: readonly string[] = [
  "grammar_genders", "grammar_numbers", "grammar_persons", "verb_forms", "conjugation_classes", "auxiliaries",
];

// Every table a backup writes, in the order of its file.
export const WRITTEN_TABLES: readonly string[] = [
  "varieties", "orthographies", "gloss_languages", ...GRAMMAR_TABLES, "profiles",
  "lemmas", "wordforms", "senses", "glosses", "audit_log",
];

export interface BackupSummary {
  createdAt: string;
  counts: Record<string, number>;
}

export type BackupCheck =
  | { ok: true; backup: Record<string, unknown>; summary: BackupSummary }
  | { ok: false; reason: "json" | "format" | "version" | "tables" };

// How a count is written in the interface's language, singular or plural.
export type CountText = (n: number) => string;

export interface CountLabels {
  lemmas: CountText;
  wordforms: CountText;
  senses: CountText;
  glosses: CountText;
  history: CountText;
}

export interface RestoreReport {
  restored: Record<string, number>;
  profiles_skipped: number;
  authors_unknown: number;
}

// The text beside the restore card's own file button: the name of the
// file chosen, or that none is.
export function chosenFileText(t: { restoreNoneChosen: string }, name: string | null): string {
  return name === null || name === "" ? t.restoreNoneChosen : name;
}

/* "12 lemmi · 1 forma · 4 significati · 8 traduzioni · 120 righe di
   cronologia": what a backup holds or a restore loaded. A count the
   record lacks is 0. */
export function countsSummary(counts: Record<string, number>, labels: CountLabels): string {
  const parts: [string, CountText][] = [
    ["lemmas", labels.lemmas], ["wordforms", labels.wordforms], ["senses", labels.senses],
    ["glosses", labels.glosses], ["audit_log", labels.history],
  ];
  return parts.map(([key, text]) => text(counts[key] ?? 0)).join(" · ");
}

/* ligurian-backup-20261018-085840.json: local date and time, digits
   only, so that the files sort by name in the order they were made. */
export function backupFileName(when: Date): string {
  return stampedFileName(BACKUP_FILE_STEM, "json", when);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/* Is this text a backup this version can restore? The first failing
   reason wins: not JSON, not a backup, another format version, or a
   table missing. */
export function checkBackupText(text: string): BackupCheck {
  let parsed: unknown = null;
  let result: BackupCheck;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }

  if (parsed === undefined) {
    result = { ok: false, reason: "json" };
  } else if (!isRecord(parsed) || parsed["format"] !== BACKUP_FORMAT) {
    result = { ok: false, reason: "format" };
  } else if (parsed["format_version"] !== BACKUP_FORMAT_VERSION) {
    result = { ok: false, reason: "version" };
  } else {
    const tables: unknown = parsed["tables"];
    const complete: boolean = isRecord(tables)
      && BACKUP_TABLES.every((name) => Array.isArray(tables[name]))
      && GRAMMAR_TABLES.every((name) => tables[name] === undefined || Array.isArray(tables[name]));
    if (complete && isRecord(tables)) {
      const counts: Record<string, number> = {};
      for (const name of WRITTEN_TABLES) {
        if (Array.isArray(tables[name])) {
          counts[name] = (tables[name] as unknown[]).length;
        }
      }
      result = {
        ok: true,
        backup: parsed,
        summary: { createdAt: String(parsed["created_at"] ?? ""), counts },
      };
    } else {
      result = { ok: false, reason: "tables" };
    }
  }
  return result;
}

/* ====================================================================
   A backup assembled from small reads [version 0.11.2]

   export_backup[] writes the whole file in one statement, and Supabase
   stops a signed-in user's statement after a time limit; with the
   corpus from Genoa it no longer fits. The manager therefore reads
   each table itself, in pages of at most PAGE_SIZE rows, and builds a
   file identical in format to export_backup[]'s, which restore_backup[]
   and checkBackupText[] accept unchanged.

   Many reads are not one snapshot, and a file read while someone edits
   may not restore: two lemmas renamed into each other's spelling
   between two pages appear twice under one spelling, and a lemma
   committed between two bounds may arrive without its base form. So
   the highest id of every table with an id is read first, history
   first, then translations, senses, forms and lemmas, no row above its
   table's bound is taken, and at the end the history's highest id is
   read again. Every change to the lexicon writes a line of history, so
   an unchanged history proves that nothing changed while the file was
   read, and the file is exact. If it did change, the backup starts
   again, up to ATTEMPTS times, and then gives up with BackupBusyError
   rather than offer a file that might not restore. A read that fails
   is tried again, up to READ_TRIES times.
   ==================================================================== */

export const PAGE_SIZE: number = 1000;

export type Row = Record<string, unknown>;

// Where the rows come from: Supabase in the page, the test database in
// the tests.
export interface BackupSource {
  // A small table whole, ordered by these columns.
  all(table: string, order: readonly string[]): Promise<Row[]>;
  // The highest id of a table; 0 when it is empty.
  maxId(table: string): Promise<number>;
  // Up to `limit` rows with after < id <= through, by id.
  page(table: string, after: number, through: number, limit: number): Promise<Row[]>;
}

const SMALL_TABLES: readonly [string, readonly string[]][] = [
  ["varieties", ["code"]],
  ["orthographies", ["code"]],
  ["gloss_languages", ["code"]],
  ...GRAMMAR_TABLES.map((name): [string, readonly string[]] => [name, ["code"]]),
  ["profiles", ["created_at", "user_id"]],
];

// The order the bounds are read in: history, then children before
// their parents.
export const BOUND_ORDER: readonly string[] = ["audit_log", "glosses", "senses", "wordforms", "lemmas"];

// The backup started again this many times when the dictionary changed
// while it was read; a failed read tried this many times.
export const ATTEMPTS: number = 3;
export const READ_TRIES: number = 3;

// The dictionary kept changing while the backup was read.
export class BackupBusyError extends Error {
  public constructor() {
    super("the dictionary changed during every attempt to back it up");
  }
}

async function retried<T>(read: () => Promise<T>): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= READ_TRIES; attempt += 1) {
    try {
      return await read();
    } catch (error: unknown) {
      lastError = error;
    }
  }
  throw lastError;
}

async function assembleOnce(source: BackupSource, now: Date, onProgress: (rows: number) => void):
  Promise<{ backup: Row; historyBound: number }> {
  const bounds: Map<string, number> = new Map();
  for (const table of BOUND_ORDER) {
    bounds.set(table, await retried(() => source.maxId(table)));
  }

  const tables: Record<string, Row[]> = {};
  let read: number = 0;
  for (const [table, order] of SMALL_TABLES) {
    tables[table] = await retried(() => source.all(table, order));
    read += tables[table].length;
    onProgress(read);
  }
  for (const table of ["lemmas", "wordforms", "senses", "glosses", "audit_log"]) {
    const through: number = bounds.get(table) ?? 0;
    const rows: Row[] = [];
    let after: number = 0;
    let done: boolean = through === 0;
    while (!done) {
      const from: number = after;
      const page: Row[] = await retried(() => source.page(table, from, through, PAGE_SIZE));
      rows.push(...page);
      read += page.length;
      onProgress(read);
      // A short page does not mean the end: the server may cap pages
      // below PAGE_SIZE. Only an empty page, or the bound, ends a table.
      const last: unknown = page.at(-1)?.["id"];
      if (page.length === 0 || typeof last !== "number" || last >= through) {
        done = true;
      } else {
        after = last;
      }
    }
    tables[table] = rows;
  }

  const counts: Record<string, number> = {};
  for (const name of WRITTEN_TABLES) {
    counts[name] = (tables[name] ?? []).length;
  }
  return {
    historyBound: bounds.get("audit_log") ?? 0,
    backup: {
      format: BACKUP_FORMAT,
      format_version: BACKUP_FORMAT_VERSION,
      created_at: now.toISOString(),
      license: "Lexicon data: CC BY-SA 4.0. Profiles and history: private to the project.",
      counts,
      tables,
    },
  };
}

/* The whole backup, exact: read again whenever the history shows that
   the dictionary changed meanwhile. onProgress counts the rows read in
   the current attempt; onRetry reports a new attempt. */
export async function assembleBackup(source: BackupSource, now: Date,
  onProgress: (rows: number) => void = () => undefined,
  onRetry: (attempt: number) => void = () => undefined): Promise<Row> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      onRetry(attempt);
    }
    const { backup, historyBound } = await assembleOnce(source, now, onProgress);
    if (await retried(() => source.maxId("audit_log")) === historyBound) {
      return backup;
    }
  }
  throw new BackupBusyError();
}
