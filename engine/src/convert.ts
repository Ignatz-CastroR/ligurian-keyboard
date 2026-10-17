/*
 * convert.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/10, 21:08:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Decide what happens to one typed token when the user presses
 *           space: replace silently, show the candidate menu, or keep it.
 * Updated:  2026/10/17, 12:03:47: elided words. When the whole word is
 *           not in the dictionary, it is split after its inner
 *           apostrophes and each part is converted on its own, so
 *           "d'aegua" becomes "d'ægua" from the entries "d'" and "ægua"
 *           [decision 0029].
 * Contract: Surrounding punctuation is preserved untouched; the casing
 *           pattern of the typed word, or of each typed part, is
 *           reapplied to every candidate. A whole word found in the
 *           dictionary always wins over its parts.
 */

import { Lexicon, type LookupFilter } from "./lexicon.ts";
import { splitElision } from "./elision.ts";

// The most spellings the menu offers for an elided word.
export const MAX_COMBINATIONS: number = 9;

export type ConversionKind =
  | "replace"   // exactly one candidate, apply without asking
  | "choose"    // several candidates, show the menu
  | "unknown";  // not in the lexicon, keep what was typed

export interface Conversion {
  kind: ConversionKind;
  typed: string;          // the full token as typed
  prefix: string;         // leading punctuation, e.g. an opening quote
  suffix: string;         // trailing punctuation, e.g. ",", "?", "..."
  candidates: string[];   // cased forms, best first; empty when unknown
}

type CasePattern = "lower" | "capitalized" | "upper";

// Leading and trailing characters that are not part of the word.
const EDGE_PUNCT: RegExp = /^([^\p{L}']*)(.*?)([^\p{L}']*)$/u;

export function convertToken(lexicon: Lexicon, token: string, filter: LookupFilter = {}): Conversion {
  const match: RegExpMatchArray | null = token.match(EDGE_PUNCT);
  const prefix: string = match?.[1] ?? "";
  const core: string = match?.[2] ?? token;
  const suffix: string = match?.[3] ?? "";

  let candidates: string[] = [];
  if (core !== "") {
    candidates = candidatesFor(lexicon, core, filter);
    if (candidates.length === 0) {
      candidates = elidedCandidates(lexicon, splitElision(core), filter);
    }
  }

  let kind: ConversionKind = "unknown";
  if (candidates.length === 1) {
    kind = "replace";
  } else if (candidates.length > 1) {
    kind = "choose";
    candidates = promoteExact(candidates, core);
  }

  return { kind, typed: token, prefix, suffix, candidates };
}

// Every spelling of one typed word, cased like it, best first.
function candidatesFor(lexicon: Lexicon, typed: string, filter: LookupFilter): string[] {
  const pattern: CasePattern = casePatternOf(typed);
  return dedupe(lexicon.lookup(typed, filter).map((e) => applyCase(e.form, pattern)));
}

// The spellings of an elided word, part by part: a part the dictionary
// does not know stays as typed. Nothing when no part is known, or when
// the word has no inner apostrophe. Combinations are ranked by the sum
// of their parts' ranks, so the best spelling of every part comes first.
function elidedCandidates(lexicon: Lexicon, parts: string[], filter: LookupFilter): string[] {
  let result: string[] = [];
  if (parts.length > 1) {
    const options: string[][] = parts.map((part) => candidatesFor(lexicon, part, filter));
    if (options.some((list) => list.length > 0)) {
      let combos: { text: string; rank: number }[] = [{ text: "", rank: 0 }];
      options.forEach((list, index) => {
        const choices: string[] = list.length > 0 ? list.slice(0, MAX_COMBINATIONS) : [parts[index] ?? ""];
        const next: { text: string; rank: number }[] = [];
        for (const combo of combos) {
          choices.forEach((choice, rank) => next.push({ text: combo.text + choice, rank: combo.rank + rank }));
        }
        combos = next.sort((a, b) => a.rank - b.rank).slice(0, MAX_COMBINATIONS);
      });
      result = dedupe(combos.map((combo) => combo.text));
    }
  }
  return result;
}

// Rebuild the token with the chosen candidate.
export function renderChoice(conversion: Conversion, choiceIndex: number): string {
  let word: string = conversion.typed;
  const chosen: string | undefined = conversion.candidates[choiceIndex];
  if (chosen !== undefined) {
    word = conversion.prefix + chosen + conversion.suffix;
  }
  return word;
}

function casePatternOf(word: string): CasePattern {
  let pattern: CasePattern = "lower";
  const letters: string = word.replace(/[^\p{L}]/gu, "");
  if (letters.length > 1 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) {
    pattern = "upper";
  } else if (letters.length > 0 && letters[0] !== letters[0]!.toLowerCase()) {
    pattern = "capitalized";
  }
  return pattern;
}

// Proper nouns stored capitalized, e.g. "Zêna", keep their capital.
function applyCase(form: string, pattern: CasePattern): string {
  let result: string = form;
  if (pattern === "upper") {
    result = form.toUpperCase();
  } else if (pattern === "capitalized") {
    const first: string = [...form][0] ?? "";
    result = first.toUpperCase() + form.slice(first.length);
  }
  return result;
}

// If the user already typed one candidate letter for letter, show it first.
function promoteExact(candidates: string[], typed: string): string[] {
  const normalized: string = typed.normalize("NFC");
  const exact: string[] = candidates.filter((c) => c === normalized);
  const rest: string[] = candidates.filter((c) => c !== normalized);
  return [...exact, ...rest];
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}
