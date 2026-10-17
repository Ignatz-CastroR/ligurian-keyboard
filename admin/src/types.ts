/*
 * types.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/11, 20:14:02, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The shapes of the rows the lexicon manager reads from the
 *           database. They mirror db/migrations/0001 and 0004 column by
 *           column; a column added there must be added here.
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
  headword: string;
  headword_key: string;
  variety: string;
  orthography: string;
  part_of_speech: string | null;
  note: string | null;
}

export interface Wordform extends Tracked {
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

export interface QueueItem {
  kind: "lemma" | "wordform" | "sense" | "gloss";
  id: number;
  lemma_id: number;
  text: string;
  created_by: string | null;
  created_at: string;
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

export const QUEUE_KIND_TABLE: Readonly<Record<QueueItem["kind"], LexiconTable>> = {
  lemma: "lemmas",
  wordform: "wordforms",
  sense: "senses",
  gloss: "glosses",
};
