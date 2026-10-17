/*
 * frequency-list.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 10:01:18, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The frequency list file [data/frequencies/lijwiki.tsv]:
 *           write it, read it back, and add its counts to the freq
 *           column of a dictionary snapshot.
 *           Decision: docs/decisions/0027-real-frequencies.md
 * Format:   UTF-8, LF. Comment lines start with "#"; three of them are
 *           required and read back: "# Source: ", "# Orthography: " and
 *           "# Counted: ". Then the header "form<TAB>count", then one
 *           row per word: its frequency key and a whole count of at
 *           least 1, sorted by form in code point order, so that two
 *           versions of the file differ only where the counts did.
 * Contract: Pure functions, no I/O. readFrequencyList reports every bad
 *           line by number and never drops one silently, as the lexicon
 *           loader does. applyFrequencies only ever raises a freq: the
 *           snapshot's freq becomes the database's freq plus the corpus
 *           count, for rows written in the list's orthography.
 */

import { frequencyKey } from "./count.ts";
import { isValidForm } from "../../engine/src/lexicon.ts";

export interface FrequencyList {
  source: string;          // what was counted, e.g. the dump's name and date
  orthography: string;     // the spelling system of the counted text
  counted: string;         // when, "YYYY/MM/DD HH:MM:SS UTC"
  counts: Map<string, number>;
}

export interface FrequencyListProblem {
  line: number;          // 0 for a problem of the whole file
  message: string;
}

const SOURCE: string = "# Source: ";
const ORTHOGRAPHY: string = "# Orthography: ";
const COUNTED: string = "# Counted: ";
const HEADER: string = "form\tcount";

// Words seen fewer times than this are left out of the file: a single
// occurrence is as often a typo or a foreign name as a real word, and
// leaving them out keeps the file small.
export const DEFAULT_MIN_COUNT: number = 2;

export function formatFrequencyList(list: FrequencyList, minCount: number = DEFAULT_MIN_COUNT): string {
  const rows: string[] = [...list.counts]
    .filter(([form, count]) => count >= minCount && isValidForm(form))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([form, count]) => `${form}\t${count}`);
  return [
    `${SOURCE}${list.source}`,
    `${ORTHOGRAPHY}${list.orthography}`,
    `${COUNTED}${list.counted}`,
    "# License: CC BY-SA 4.0, as the counted text; see data/frequencies/README.md.",
    `# Words: ${rows.length}, each seen at least ${minCount} times.`,
    HEADER,
    ...rows,
    "",
  ].join("\n");
}

export function readFrequencyList(text: string): { list: FrequencyList; problems: FrequencyListProblem[] } {
  const problems: FrequencyListProblem[] = [];
  const counts: Map<string, number> = new Map();
  let source: string = "";
  let orthography: string = "";
  let counted: string = "";
  let headerSeen: boolean = false;

  const lines: string[] = text.replace(/^﻿/u, "").split(/\r?\n/u);
  lines.forEach((raw: string, index: number) => {
    const line: string = raw.trim();
    const lineNo: number = index + 1;
    if (line.startsWith(SOURCE)) {
      source = line.slice(SOURCE.length).trim();
    } else if (line.startsWith(ORTHOGRAPHY)) {
      orthography = line.slice(ORTHOGRAPHY.length).trim().normalize("NFC");
    } else if (line.startsWith(COUNTED)) {
      counted = line.slice(COUNTED.length).trim();
    } else if (line === "" || line.startsWith("#")) {
      // blank or another comment
    } else if (!headerSeen) {
      if (line === HEADER) {
        headerSeen = true;
      } else {
        problems.push({ line: lineNo, message: `expected the header "form<TAB>count"` });
      }
    } else {
      readRow(line, lineNo, counts, problems);
    }
  });

  if (source === "") {
    problems.push({ line: 0, message: "missing the \"# Source:\" line" });
  }
  if (orthography === "") {
    problems.push({ line: 0, message: "missing the \"# Orthography:\" line" });
  }
  if (counted === "") {
    problems.push({ line: 0, message: "missing the \"# Counted:\" line" });
  }
  if (!headerSeen) {
    problems.push({ line: 0, message: "missing the header \"form<TAB>count\"" });
  }
  return { list: { source, orthography, counted, counts }, problems };
}

function readRow(line: string, lineNo: number, counts: Map<string, number>, problems: FrequencyListProblem[]): void {
  const cells: string[] = line.split("\t");
  const form: string = cells[0] ?? "";
  const countText: string = cells[1] ?? "";
  if (cells.length !== 2) {
    problems.push({ line: lineNo, message: "expected two columns, form and count" });
  } else if (!isValidForm(form) || frequencyKey(form) !== form) {
    problems.push({ line: lineNo, message: `invalid form "${form}"` });
  } else if (!/^[1-9]\d{0,9}$/u.test(countText)) {
    problems.push({ line: lineNo, message: `invalid count "${countText}"` });
  } else if (counts.has(form)) {
    problems.push({ line: lineNo, message: `"${form}" listed twice` });
  } else {
    counts.set(form, Number(countText));
  }
}

// Add the corpus counts to a snapshot of export_lexicon_tsv[]: for each
// row in the list's orthography, freq becomes freq + count[form]. Other
// rows, comments and the header pass through unchanged, and a row the
// lexicon loader would reject is left exactly as it was, for the
// snapshot check to report. Returns the new text and how many rows
// received a count.
export function applyFrequencies(tsv: string, list: FrequencyList): { tsv: string; matched: number } {
  const lines: string[] = tsv.split("\n");
  let header: string[] | null = null;
  let matched: number = 0;
  const out: string[] = lines.map((raw: string): string => {
    const line: string = raw.replace(/\r$/u, "");
    let result: string = raw;
    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      // passes through
    } else if (header === null) {
      header = line.replace(/^﻿/u, "").split("\t").map((cell) => cell.trim());
    } else {
      const cells: string[] = line.split("\t");
      const at = (name: string): number => (header ?? []).indexOf(name);
      const form: string = (cells[at("form")] ?? "").trim().normalize("NFC");
      const freqText: string = (cells[at("freq")] ?? "").trim();
      const orthography: string = (cells[at("orthography")] ?? "").trim().normalize("NFC");
      const count: number = list.counts.get(frequencyKey(form)) ?? 0;
      if (at("freq") !== -1 && /^\d+$/u.test(freqText) && orthography === list.orthography && count > 0) {
        cells[at("freq")] = String(Number(freqText) + count);
        result = cells.join("\t") + (raw.endsWith("\r") ? "\r" : "");
        matched += 1;
      }
    }
    return result;
  });
  return { tsv: out.join("\n"), matched };
}
