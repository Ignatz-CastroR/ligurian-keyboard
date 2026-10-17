/*
 * elision.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 11:58:20, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Split an elided word into its parts: "d'ægua" is the elided
 *           particle "d'" followed by the word "ægua", "quell'òmmo" is
 *           "quell'" followed by "òmmo". The dictionary then holds each
 *           particle and each word once, never every combination.
 *           Decision: docs/decisions/0029-elision.md
 * Contract: A word is split after every apostrophe that has a letter
 *           right before it and a letter right after it; an apostrophe
 *           at the start or the end, as in "'na" or "pe'", never splits.
 *           Each part keeps its apostrophe, so joining the parts gives
 *           back the word unchanged. The Keyman model holds a copy of
 *           this rule in its word breaker; keyman/test/build.test.ts
 *           proves that the two agree.
 */

// Every apostrophe the engine accepts: ASCII and the typographic ones.
const APOSTROPHES: ReadonlySet<string> = new Set<string>(["'", "’", "‘", "ʼ"]);

// A letter, but not U+02BC, the modifier letter apostrophe, which
// Unicode files as a letter and Ligurian uses as an apostrophe.
function isLetter(ch: string): boolean {
  return /\p{L}/u.test(ch) && !APOSTROPHES.has(ch);
}

export function splitElision(word: string): string[] {
  const chars: string[] = [...word];
  const parts: string[] = [];
  let current: string = "";
  for (let i: number = 0; i < chars.length; i += 1) {
    const ch: string = chars[i] ?? "";
    current += ch;
    if (APOSTROPHES.has(ch) && isLetter(chars[i - 1] ?? "") && isLetter(chars[i + 1] ?? "")) {
      parts.push(current);
      current = "";
    }
  }
  if (current !== "" || parts.length === 0) {
    parts.push(current);
  }
  return parts;
}
