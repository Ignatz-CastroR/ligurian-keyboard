/*
 * count.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 09:46:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Count the words of plain running text, the way the web
 *           editor sees words, so that the counts can rank spellings
 *           that share one ASCII key.
 *           Decision: docs/decisions/0027-real-frequencies.md
 * Updated:  2026/10/17, 11:24:51: a word needs at least one letter; a
 *           lone apostrophe was counted as a word in the first list.
 * Contract: Pure functions, no I/O. A word is counted under its
 *           frequency key [frequencyKey]: NFC, lower case, typographic
 *           apostrophes and hyphens made ASCII. Only words that pass
 *           the engine's own isValidForm are counted, so a counted word
 *           can always be matched against the dictionary.
 */

import { isValidForm } from "../../engine/src/lexicon.ts";

// Letters, apostrophes and hyphens: the characters a word is made of.
// Everything else, digits included, separates words.
const WORD: RegExp = /[\p{L}\p{M}'’‘ʼ‐‑-]+/gu;

// An apostrophe inside a word: "l'ægua", "pe'r".
const INNER_APOSTROPHE: RegExp = /(?<=\p{L})'(?=\p{L})/u;

// A word worth counting: a valid Ligurian form with at least one
// letter, so that a stray apostrophe or hyphen is never a word.
export function isCountableWord(word: string): boolean {
  return isValidForm(word) && /\p{L}/u.test(word);
}

// The key a word is counted and looked up under. Two spellings that
// differ only in capitals or in the kind of apostrophe are one word for
// counting; two spellings that differ in a letter or a mark never are.
export function frequencyKey(word: string): string {
  return word
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’‘ʼ]/gu, "'")
    .replace(/[‐‑]/gu, "-");
}

// The words of a text, as frequency keys, in order. Hyphens at the
// edges of a word are dashes or line breaks, not part of it, and are
// dropped; apostrophes at the edges stay, because Ligurian elides at
// both ends: "'na", "pe'".
export function words(text: string): string[] {
  const result: string[] = [];
  for (const match of text.normalize("NFC").matchAll(WORD)) {
    const word: string = frequencyKey(match[0]).replace(/^-+|-+$/gu, "");
    if (isCountableWord(word)) {
      result.push(word);
    }
  }
  return result;
}

// Add the words of a text to running counts. A word with an apostrophe
// inside is counted whole, as the editor looks it up, and each of its
// parts is counted too, with the apostrophe kept on the part before it:
// "l'ægua" counts "l'ægua", "l'" and "ægua". The parts never compete
// with the whole for one ASCII key, because their keys differ, so the
// extra counts cannot distort a ranking; they only let a dictionary
// entry such as "ægua" be found in elided text.
export function addCounts(text: string, counts: Map<string, number>): void {
  for (const word of words(text)) {
    bump(counts, word);
    if (INNER_APOSTROPHE.test(word)) {
      for (const part of splitAtApostrophes(word)) {
        bump(counts, part);
      }
    }
  }
}

// "l'ægua" gives ["l'", "ægua"].
export function splitAtApostrophes(word: string): string[] {
  const parts: string[] = [];
  let current: string = "";
  const chars: string[] = [...word];
  for (let i: number = 0; i < chars.length; i += 1) {
    const ch: string = chars[i] ?? "";
    current += ch;
    const next: string = chars[i + 1] ?? "";
    if (ch === "'" && current.length > 1 && /\p{L}/u.test(next)) {
      parts.push(current);
      current = "";
    }
  }
  if (current !== "") {
    parts.push(current);
  }
  return parts.filter((part) => isCountableWord(part));
}

function bump(counts: Map<string, number>, word: string): void {
  counts.set(word, (counts.get(word) ?? 0) + 1);
}
