/*
 * convert.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/10
 * Purpose:  Decide what happens to one typed token when the user presses
 *           space: replace silently, show the candidate menu, or keep it.
 * Contract: Surrounding punctuation is preserved untouched; the casing
 *           pattern of the typed word is reapplied to every candidate.
 */

import { Lexicon, type LookupFilter } from "./lexicon.ts";

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
    const pattern: CasePattern = casePatternOf(core);
    candidates = dedupe(lexicon.lookup(core, filter).map((e) => applyCase(e.form, pattern)));
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
