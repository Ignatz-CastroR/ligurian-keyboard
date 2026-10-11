/*
 * skeleton.ts
 * Author:   Iosef Tesla R. [Ignatz-CastroR] and contributors
 * Date:     2026/10/10
 * Purpose:  Fold a Ligurian word written in grafîa ofiçiâ into its plain
 *           ASCII "skeleton", the key a user types on any keyboard.
 * Contract: skeleton[] is deterministic, total and idempotent:
 *           skeleton[skeleton[w]] === skeleton[w] for every string w.
 * Source:   Académia Ligùstica do Brénno, "Arfabêto",
 *           https://www.zeneize.net/grafia/arfabeto.htm
 *           The full rule table lives in docs/skeleton-spec.md; any change
 *           here must be mirrored there.
 */

// Single characters that fold to a different ASCII string.
// Vowels with grave, acute, circumflex or diaeresis lose the mark;
// æ folds to "ae", the digraph the Académia itself allows when æ is
// unavailable; ç folds to "c".
const FOLD_TABLE: ReadonlyMap<string, string> = new Map<string, string>([
  ["à", "a"], ["á", "a"], ["â", "a"], ["ä", "a"],
  ["è", "e"], ["é", "e"], ["ê", "e"], ["ë", "e"],
  ["ì", "i"], ["í", "i"], ["î", "i"], ["ï", "i"],
  ["ò", "o"], ["ó", "o"], ["ô", "o"], ["ö", "o"],
  ["ù", "u"], ["ú", "u"], ["û", "u"], ["ü", "u"],
  ["æ", "ae"],
  ["ç", "c"],
  // Typographic apostrophes become the ASCII apostrophe.
  ["’", "'"], ["‘", "'"], ["ʼ", "'"],
]);

// Hyphens are dropped entirely, so "canpànn-a" and "canpanna" share a key.
// Italian speakers do not know the nn- convention; the menu disambiguates.
const DROPPED_CHARS: ReadonlySet<string> = new Set<string>(["-", "‐", "‑"]);

export function skeleton(word: string): string {
  const lowered: string = word.normalize("NFC").toLowerCase();
  let result: string = "";

  for (const ch of lowered) {
    if (DROPPED_CHARS.has(ch)) {
      continue;
    }
    const folded: string | undefined = FOLD_TABLE.get(ch);
    if (folded !== undefined) {
      result += folded;
    } else {
      result += ch;
    }
  }

  return result;
}

// True when every character of the string is printable ASCII.
export function isPlainAscii(text: string): boolean {
  return /^[\x20-\x7E]*$/.test(text);
}
