/*
 * wordlist.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 03:58:41, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Turn the dictionary snapshot [the TSV the web editor reads]
 *           into the word list of the Keyman lexical model, and derive
 *           the model package's version from the snapshot's date.
 * Format:   Keyman word list: UTF-8, "#" comment lines, then one word per
 *           line with its count, separated by a tab.
 * Contract: Pure functions, no files. Only approved forms of the model's
 *           variety and spelling system enter the list [zeneize, ofiçiâ:
 *           the defaults of decision 0004]. A snapshot that fails the
 *           editor's own checks, or holds no such form, gives problems
 *           and no word list, so a bad dictionary is never packaged.
 * Updated:  2026/10/20, 20:06:15: when two forms differ only by a
 *           capital, such as damàsco and Damàsco, the lowercase one
 *           weighs one more, so that Keyman offers and auto-corrects to
 *           it first when the word is typed in lowercase; typed with a
 *           capital, Keyman capitalizes both, and they are one. Every
 *           count is doubled first, so that this extra one changes no
 *           other order [decision 0037].
 * Decision: docs/decisions/0022-keyman-keyboard-design.md
 *           docs/decisions/0037-lowercase-first-and-ligurian-names.md
 */

import type { LexiconEntry } from "../../engine/src/lexicon.ts";
import { checkSnapshot, readSnapshot, type Snapshot } from "../../editor/src/snapshot.ts";

export const MODEL_VARIETY: string = "zeneize";
export const MODEL_ORTHOGRAPHY: string = "ofiçiâ";

export interface Wordlist {
  tsv: string;              // the word list file's exact text
  words: number;            // number of words in it
  version: string;          // the model package version, "YYYY.M.D"
  takenAt: string | null;   // the snapshot's stamp, null if unstamped
}

export type WordlistResult =
  | { ok: true; wordlist: Wordlist }
  | { ok: false; problems: string[] };

// Keyman weighs suggestions by count and never offers a word whose count
// is 0. An approved word must always be reachable, so counts are whole
// numbers of at least 1 [then doubled, below].
export function keymanCount(freq: number): number {
  return Math.max(1, Math.round(freq));
}

// The model package version: the snapshot's UTC date as YYYY.M.D, so a
// newer dictionary always has a higher version, and anyone can read the
// dictionary's date from it. Keyman accepts at most three numbers with
// no leading zeros, hence 2026.10.7 and never 2026.10.07.
export function modelVersion(takenAt: string | null, fallback: Date): string {
  const stamp: RegExpMatchArray | null = (takenAt ?? "").match(/^(\d{4})\/(\d{2})\/(\d{2}) /);
  let version: string;
  if (stamp !== null) {
    version = `${Number(stamp[1])}.${Number(stamp[2])}.${Number(stamp[3])}`;
  } else {
    version = `${fallback.getUTCFullYear()}.${fallback.getUTCMonth() + 1}.${fallback.getUTCDate()}`;
  }
  return version;
}

// True when a form begins with a lowercase letter: damàsco, not Damàsco.
function startsLowercase(form: string): boolean {
  const first: string = [...form][0] ?? "";
  return first !== first.toUpperCase() && first === first.toLowerCase();
}

/* The weight of every form in the word list: its count doubled, plus
   one for a form that begins with a lowercase letter when another form
   is spelled the same but for capitals [damàsco beside Damàsco]. Keyman
   breaks ties between suggestions in its own way, and on 2026/10/20 it
   auto-corrected "damasco" to Damàsco; with the extra one, a word typed
   in lowercase is corrected to the lowercase form. Doubling first keeps
   every other order exactly as the counts give it: 2a + 1 never passes
   2b when a < b. */
export function keymanWeights(entries: readonly LexiconEntry[]): Map<string, number> {
  const capitalized: Set<string> = new Set(
    entries.filter((e) => !startsLowercase(e.form)).map((e) => e.form.toLowerCase()));
  const weights: Map<string, number> = new Map();
  for (const entry of entries) {
    const partner: boolean = startsLowercase(entry.form) && capitalized.has(entry.form.toLowerCase());
    weights.set(entry.form, 2 * keymanCount(entry.freq) + (partner ? 1 : 0));
  }
  return weights;
}

export function buildWordlist(snapshotText: string, now: Date): WordlistResult {
  const problems: string[] = checkSnapshot(snapshotText);
  let result: WordlistResult;

  if (problems.length > 0) {
    result = { ok: false, problems };
  } else {
    const snapshot: Snapshot = readSnapshot(snapshotText);
    const chosen: LexiconEntry[] = snapshot.lexicon
      .entries()
      .filter((e) => e.variety === MODEL_VARIETY && e.orthography === MODEL_ORTHOGRAPHY);
    const weights: Map<string, number> = keymanWeights(chosen);
    const weight = (e: LexiconEntry): number => weights.get(e.form) ?? 0;
    // Heaviest first; ties alphabetical, so the file only changes when
    // the dictionary does.
    const entries: LexiconEntry[] = chosen.sort((a, b) => weight(b) - weight(a) || a.form.localeCompare(b.form, "it"));

    if (entries.length === 0) {
      result = {
        ok: false,
        problems: [`no approved ${MODEL_VARIETY} ${MODEL_ORTHOGRAPHY} forms: refusing to package an empty dictionary`],
      };
    } else {
      const version: string = modelVersion(snapshot.takenAt, now);
      const header: string[] = [
        "# Ligurian lexical model word list: generated by tools/build-keyman.ts; never edit it by hand.",
        `# Dictionary snapshot: ${snapshot.takenAt ?? "unstamped"}; model version ${version}.`,
        `# Variety ${MODEL_VARIETY}, spelling system ${MODEL_ORTHOGRAPHY}; approved forms only.`,
        "# License: CC BY-SA 4.0, ligurian-keyboard contributors.",
        "# Columns: word, count.",
      ];
      const lines: string[] = entries.map((e) => `${e.form}\t${weight(e)}`);
      result = {
        ok: true,
        wordlist: {
          tsv: `${[...header, ...lines].join("\n")}\n`,
          words: entries.length,
          version,
          takenAt: snapshot.takenAt,
        },
      };
    }
  }

  return result;
}
