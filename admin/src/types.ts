/*
 * types.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 20:14:02, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/18, 09:03:30: public_id on lemmas and wordforms
 *           [decision 0030].
 * Updated:  2026/10/18, 13:10:41: the columns review_queue gains in
 *           migration 0007, to group and label the queue by entry
 *           [decision 0033].
 * Updated:  2026/10/20, 23:49:12: senses_reviewed_at on lemmas
 *           [migration 0012, decision 0038].
 * Updated:  2026/10/21, 09:30:23: senses_review_needed, the list of
 *           lemmas whose senses wait to be reviewed [migration 0012].
 * Updated:  2026/10/21, 12:26:04: the grammar of lemmas and forms,
 *           the grammar's lists, the part of speech "determiner"
 *           [migration 0013].
 * Updated:  2026/10/21, 14:29:33: a form's list of readings, instead of its
 *           four fields; a lemma's queue row with its base form's.
 * Purpose:  The shapes of the rows the lexicon manager reads from the
 *           database. They mirror db/migrations/0001, 0004 and 0006
 *           column by column; a column added there must be added here.
 */

import type { GrammarLists, LemmaGrammar, Reading } from "./grammar.ts";

export type Role = "member" | "contributor" | "reviewer" | "admin";
export type Status = "pending" | "approved" | "rejected";
export type LexiconTable = "lemmas" | "wordforms" | "senses" | "glosses";

export const ROLES: readonly Role[] = ["member", "contributor", "reviewer", "admin"];

export const PARTS_OF_SPEECH: readonly string[] = [
  "noun", "verb", "adjective", "adverb", "pronoun", "determiner", "article", "preposition",
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

export interface Lemma extends Tracked, LemmaGrammar {
  public_id: string;
  headword: string;
  headword_key: string;
  variety: string;
  orthography: string;
  part_of_speech: string | null;
  note: string | null;
  // From migration 0012: on the list of lemmas whose senses wait to be
  // reviewed, and when a reviewer last confirmed how its translations
  // are grouped into senses [null: never].
  senses_review_needed: boolean;
  senses_reviewed_at: string | null;
}

export interface Wordform extends Tracked {
  public_id: string;
  lemma_id: number;
  form: string;
  form_key: string;
  is_base: boolean;
  grammatical_tag: string | null;
  freq: number;
  // From migration 0013: the gender, number, person and verb form the
  // spelling stands for, as many readings as it has; a base form's
  // first is its lemma's.
  readings: Reading[];
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
  // From migration 0013: a lemma's grammar [eight fields], a form's
  // readings; null otherwise.
  gender?: string | null;
  number?: string | null;
  person?: string | null;
  verb_form?: string | null;
  invariable?: boolean | null;
  conjugation?: string | null;
  auxiliary?: string | null;
  pronominal?: boolean | null;
  readings?: Reading[] | null;
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
  // From migration 0013: the grammar's lists.
  grammar: GrammarLists;
}
