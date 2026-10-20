/*
 * model.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 18:06:40, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The dictionary page's logic, apart from the page: the order
 *           of the index's letters, the addresses of its views, and the
 *           grouping of translations by sense and of search results by
 *           entry. Pure functions, no DOM, tested in Node.
 * Contract: The rows are those of migration 0009's functions:
 *           dictionary_letters[], dictionary_index[],
 *           dictionary_search[] and dictionary_entry[].
 * Decision: docs/decisions/0034-dictionary-for-readers.md
 */

import { readTypedCode } from "../../admin/src/public-id.ts";

// One translation of a sense, as private.published_glosses[] gives it.
export interface GlossRow {
  sense_number: number;
  definition_it: string | null;
  language: string | null;
  gloss: string | null;
}

export interface IndexEntry {
  id: number;
  public_id: string;
  headword: string;
  headword_key: string;
  part_of_speech: string | null;
  variety: string;
  orthography: string;
  glosses: GlossRow[];
}

export interface SearchRow {
  id: number;
  public_id: string;
  headword: string;
  headword_key: string;
  part_of_speech: string | null;
  sense_number: number;
  definition_it: string | null;
  language: string;
  gloss: string;
  rank: number;
}

export interface EntryForm {
  form: string;
  public_id: string;
  grammatical_tag: string | null;
  is_base: boolean;
}

export interface Entry {
  id: number;
  public_id: string;
  headword: string;
  part_of_speech: string | null;
  variety: string;
  orthography: string;
  note: string | null;
  forms: EntryForm[];
  glosses: GlossRow[];
}

export interface Sense {
  number: number;
  definition: string | null;
  // Translations by language, in TRANSLATION_LANGUAGES order.
  translations: { language: string; glosses: string[] }[];
}

export interface FoundEntry {
  id: number;
  public_id: string;
  headword: string;
  part_of_speech: string | null;
  matches: { sense_number: number; definition_it: string | null; language: string; gloss: string }[];
}

export type Route =
  | { view: "index"; letter: string | null }
  | { view: "search"; language: string | null; query: string }
  | { view: "entry"; code: string };

// The languages of the translations, in the order they are shown.
export const TRANSLATION_LANGUAGES: readonly string[] = ["it", "es", "en"];

// The order of the index: æ after a, ç after c, then anything else
// that is a letter, and "#" last.
const LETTER_ORDER: readonly string[] = [
  "a", "æ", "b", "c", "ç", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
];

export const OTHER_INITIAL: string = "#";

/* The initials that have entries, in the index's order. An initial the
   order does not know is placed after z, before "#". */
export function orderLetters(initials: readonly string[]): string[] {
  const rank = (letter: string): number => {
    const known: number = LETTER_ORDER.indexOf(letter);
    return letter === OTHER_INITIAL ? LETTER_ORDER.length + 1 : known < 0 ? LETTER_ORDER.length : known;
  };
  return [...new Set(initials)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

const decode = (part: string | undefined): string => {
  let text: string = "";
  try {
    text = decodeURIComponent(part ?? "");
  } catch {
    text = part ?? "";
  }
  return text;
};

/* #/indice/a, #/cerca/es/pluma [or #/cerca/tutte/pluma], #/voce/LIJ-...;
   anything else is the index at its first letter. */
export function parseRoute(hash: string): Route {
  const [view, first, ...rest] = hash.replace(/^#\/?/u, "").split("/");
  let route: Route = { view: "index", letter: null };
  if (view === "indice" && first !== undefined && first !== "") {
    route = { view: "index", letter: decode(first) };
  } else if (view === "cerca") {
    const language: string = decode(first);
    route = {
      view: "search",
      language: TRANSLATION_LANGUAGES.includes(language) ? language : null,
      query: decode(rest.join("/")),
    };
  } else if (view === "voce" && first !== undefined && first !== "") {
    route = { view: "entry", code: decode(first) };
  }
  return route;
}

export function routeHash(route: Route): string {
  let hash: string;
  if (route.view === "index") {
    hash = route.letter === null ? "#/indice" : `#/indice/${encodeURIComponent(route.letter)}`;
  } else if (route.view === "search") {
    hash = `#/cerca/${route.language ?? "tutte"}/${encodeURIComponent(route.query)}`;
  } else {
    hash = `#/voce/${encodeURIComponent(route.code)}`;
  }
  return hash;
}

/* A sense's translations grouped by language, senses in order; a sense
   without translations is kept, with none. */
export function senses(glosses: readonly GlossRow[]): Sense[] {
  const bySense: Map<number, Sense> = new Map();
  for (const row of glosses) {
    let sense: Sense | undefined = bySense.get(row.sense_number);
    if (sense === undefined) {
      sense = { number: row.sense_number, definition: row.definition_it, translations: [] };
      bySense.set(row.sense_number, sense);
    }
    if (row.language !== null && row.gloss !== null) {
      let group = sense.translations.find((t) => t.language === row.language);
      if (group === undefined) {
        group = { language: row.language, glosses: [] };
        sense.translations.push(group);
      }
      if (!group.glosses.includes(row.gloss)) {
        group.glosses.push(row.gloss);
      }
    }
  }
  const order = (language: string): number => {
    const i: number = TRANSLATION_LANGUAGES.indexOf(language);
    return i < 0 ? TRANSLATION_LANGUAGES.length : i;
  };
  const result: Sense[] = [...bySense.values()].sort((a, b) => a.number - b.number);
  for (const sense of result) {
    sense.translations.sort((a, b) => order(a.language) - order(b.language) || a.language.localeCompare(b.language));
  }
  return result;
}

/* One line for the index: every translation of the entry by language,
   each word once: "it: penna, piuma · es: pluma · en: pen". */
export function translationLine(glosses: readonly GlossRow[]): string {
  const byLanguage: Map<string, string[]> = new Map();
  for (const sense of senses(glosses)) {
    for (const group of sense.translations) {
      const words: string[] = byLanguage.get(group.language) ?? [];
      for (const gloss of group.glosses) {
        if (!words.includes(gloss)) {
          words.push(gloss);
        }
      }
      byLanguage.set(group.language, words);
    }
  }
  return [...byLanguage.entries()].map(([language, words]) => `${language}: ${words.join(", ")}`).join(" · ");
}

// Search results grouped by entry, in the order of each entry's best
// match.
export function groupResults(rows: readonly SearchRow[]): FoundEntry[] {
  const entries: Map<number, FoundEntry> = new Map();
  for (const row of rows) {
    let entry: FoundEntry | undefined = entries.get(row.id);
    if (entry === undefined) {
      entry = { id: row.id, public_id: row.public_id, headword: row.headword, part_of_speech: row.part_of_speech, matches: [] };
      entries.set(row.id, entry);
    }
    entry.matches.push({ sense_number: row.sense_number, definition_it: row.definition_it, language: row.language, gloss: row.gloss });
  }
  return [...entries.values()];
}

/* What the search field holds: a public code to open, a code with a
   wrong check symbol, or words to search for. */
export function readQuery(input: string): { kind: "code"; code: string } | { kind: "typo" } | { kind: "words"; query: string } {
  const typed = readTypedCode(input);
  let result: { kind: "code"; code: string } | { kind: "typo" } | { kind: "words"; query: string };
  if (typed.kind === "code") {
    result = { kind: "code", code: typed.code };
  } else if (typed.kind === "typo") {
    result = { kind: "typo" };
  } else {
    result = { kind: "words", query: input.trim().replace(/\s+/gu, " ") };
  }
  return result;
}
