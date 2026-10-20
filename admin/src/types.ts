/*
 * types.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 20:14:02, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/18, 09:03:30: public_id on lemmas and wordforms
 *           [decision 0030].
 * Updated:  2026/10/18, 13:10:41: the columns review_queue gains in
 *           migration 0007, to group and label the queue by entry
 *           [decision 0033].
 * Purpose:  The shapes of the rows the lexicon manager reads from the
 *           database. They mirror db/migrations/0001, 0004 and 0006
 *           column by column; a column added there must be added here.
 */

export type Role = "member" | "contributor" | "reviewer" | "admin";
export type Status = "pending" | "approved" | "rejected";
export type LexiconTable = "lemmas" | "wordforms" | "senses" | "glosses";

export const ROLES: readonly Role[] = ["member", "contributor", "reviewer", "admin"];

export const PARTS_OF_SPEECH: readonly string[] = [
  "noun", "verb", "adjective", "adverb", "pronoun", "article", "preposition",
  "conjunction", "interjection", "numeral", "proper_noun", "other",
];

// Columns every lexicon table shares.
export interface Tracked {
  id: number;
  status: Status;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Lemma extends Tracked {
  public_id: string;
  headword: string;
  headword_key: string;
  variety: string;
  orthography: string;
  part_of_speech: string | null;
  note: string | null;
}

export interface Wordform extends Tracked {
  public_id: string;
  lemma_id: number;
  form: string;
  form_key: string;
  is_base: boolean;
  grammatical_tag: string | null;
  freq: number;
}

export interface Sense extends Tracked {
  lemma_id: number;
  sense_number: number;
  definition_it: string | null;
}

export interface Gloss extends Tracked {
  sense_id: number;
  language: string;
  gloss: string;
}

export interface SenseWithGlosses {
  sense: Sense;
  glosses: Gloss[];
}

// Everything the entry page shows about one lemma.
export interface Entry {
  lemma: Lemma;
  wordforms: Wordform[];
  senses: SenseWithGlosses[];
}

export interface Profile {
  user_id: string;
  display_name: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export type QueueKind = "lemma" | "wordform" | "sense" | "gloss";

export interface QueueItem {
  kind: QueueKind;
  id: number;
  lemma_id: number;
  text: string;
  created_by: string | null;
  created_at: string;
  // From migration 0007 on.
  version: number;
  lemma_headword: string | null;
  lemma_status: Status | null;
  lemma_public_id: string | null;
  // Senses and translations only: the sense, its number and definition.
  sense_id: number | null;
  sense_number: number | null;
  definition_it: string | null;
  // Translations only.
  language: string | null;
  gloss: string | null;
  // From migration 0010, in the pages of the queue: the time of the
  // entry's oldest pending row, which orders the entries.
  group_created?: string;
}

export interface AuditEntry {
  id: number;
  table_name: string;
  row_id: number;
  action: "insert" | "update" | "soft_delete" | "restore";
  actor: string | null;
  at: string;
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
}

// A row of varieties, orthographies or gloss_languages.
export interface RefItem {
  code: string;
  name: string;
}

export interface ReferenceData {
  varieties: RefItem[];
  orthographies: RefItem[];
  languages: RefItem[];
}
