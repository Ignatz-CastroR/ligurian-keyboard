/*
 * snapshot.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 02:12:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The dictionary snapshot the web editor reads: a copy of
 *           export_lexicon_tsv[] taken when the site is built, with one
 *           extra comment line on top recording when it was taken.
 *           Decision: docs/decisions/0019-editor-dictionary-snapshot.md
 * Contract: Pure functions only, shared by the editor in the browser
 *           and by tools/fetch-lexicon.ts in Node. A snapshot that fails
 *           checkSnapshot[] must never be published.
 */

import { Lexicon, type LexiconEntry } from "../../engine/src/lexicon.ts";

export interface Snapshot {
  lexicon: Lexicon;
  takenAt: string | null;     // "YYYY/MM/DD HH:MM:SS UTC", null if unstamped
  varieties: string[];        // sorted, as present in the snapshot
  orthographies: string[];    // sorted, as present in the snapshot
}

const STAMP_PREFIX: string = "# Snapshot taken: ";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// "2026/10/17 08:13:02 UTC": the project's date and time format, in UTC
// because the site is built on GitHub's servers, not in Costa Rica.
export function formatUtc(date: Date): string {
  return `${date.getUTCFullYear()}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())} `
    + `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}

// The loader skips # comment lines, so the stamp never disturbs it.
export function stampSnapshot(tsv: string, takenAt: Date): string {
  return `${STAMP_PREFIX}${formatUtc(takenAt)}\n${tsv}`;
}

export function readSnapshot(text: string): Snapshot {
  const lexicon: Lexicon = Lexicon.fromTsv(text);
  let takenAt: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (takenAt === null && line.startsWith(STAMP_PREFIX)) {
      takenAt = line.slice(STAMP_PREFIX.length).trim();
    }
  }
  const entries: LexiconEntry[] = lexicon.entries();
  return {
    lexicon,
    takenAt,
    varieties: [...new Set(entries.map((e) => e.variety))].sort(),
    orthographies: [...new Set(entries.map((e) => e.orthography))].sort(),
  };
}

// Every reason not to publish this snapshot; empty when it is sound.
export function checkSnapshot(text: string): string[] {
  const problems: string[] = [];
  const snapshot: Snapshot = readSnapshot(text);
  for (const error of snapshot.lexicon.errors) {
    problems.push(`line ${error.line}: ${error.message}`);
  }
  if (snapshot.lexicon.size === 0) {
    problems.push("no approved wordforms: refusing to publish an empty dictionary");
  }
  return problems;
}
