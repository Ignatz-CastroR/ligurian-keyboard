/*
 * lexicon.ts
 * Author:   Iosef Tesla R. [Ignatz-CastroR] and contributors
 * Date:     2026/10/10
 * Purpose:  Load the published wordform list and index it by skeleton.
 * Format:   TSV with header: form, freq, variety, orthography, status
 *           See docs/lexicon-format.md.
 * Contract: Only rows with status "approved" are indexed. Rows that fail
 *           validation are collected in `errors`, never silently dropped.
 */

import { skeleton } from "./skeleton.ts";

export interface LexiconEntry {
  form: string;          // wordform in its orthography, NFC normalized
  freq: number;          // relative frequency, higher ranks first
  variety: string;       // e.g. "zeneize", "savoneize", "tabarchin"
  orthography: string;   // e.g. "ofiçiâ", "unitäia"
  status: string;        // "approved", "pending" or "rejected"
}

export interface LoadError {
  line: number;
  message: string;
}

export interface LookupFilter {
  variety?: string;
  orthography?: string;
}

const REQUIRED_COLUMNS: readonly string[] = ["form", "freq", "variety", "orthography", "status"];

// Letters a Ligurian wordform may contain, plus apostrophe and hyphen.
const VALID_FORM: RegExp = /^[a-zàáâäèéêëìíîïòóôöùúûüæç'-]+$/iu;

export class Lexicon {
  private readonly index: Map<string, LexiconEntry[]> = new Map();
  public readonly errors: LoadError[] = [];
  public size: number = 0;

  public static fromTsv(text: string): Lexicon {
    const lexicon: Lexicon = new Lexicon();
    lexicon.loadTsv(text);
    return lexicon;
  }

  public add(entry: LexiconEntry): void {
    const key: string = skeleton(entry.form);
    const bucket: LexiconEntry[] = this.index.get(key) ?? [];
    const duplicate: boolean = bucket.some(
      (e) => e.form === entry.form && e.variety === entry.variety && e.orthography === entry.orthography,
    );
    if (!duplicate) {
      bucket.push(entry);
      bucket.sort(compareEntries);
      this.index.set(key, bucket);
      this.size += 1;
    }
  }

  // Every indexed entry. The web editor uses it to list the varieties
  // and spelling systems present in a dictionary snapshot.
  public entries(): LexiconEntry[] {
    const all: LexiconEntry[] = [];
    for (const bucket of this.index.values()) {
      all.push(...bucket);
    }
    return all;
  }

  // Candidates for a typed key, best first. Empty array when unknown.
  public lookup(typed: string, filter: LookupFilter = {}): LexiconEntry[] {
    const bucket: LexiconEntry[] = this.index.get(skeleton(typed)) ?? [];
    return bucket.filter(
      (e) =>
        (filter.variety === undefined || e.variety === filter.variety) &&
        (filter.orthography === undefined || e.orthography === filter.orthography),
    );
  }

  private loadTsv(text: string): void {
    const lines: string[] = text.replace(/^﻿/, "").split(/\r?\n/);
    // The header is the first line that is neither blank nor a # comment.
    let headerAt: number = 0;
    while (headerAt < lines.length && isSkippable(lines[headerAt] ?? "")) {
      headerAt += 1;
    }
    const header: string[] = (lines[headerAt] ?? "").split("\t").map((h) => h.trim());
    const missing: string[] = REQUIRED_COLUMNS.filter((c) => !header.includes(c));

    if (missing.length > 0) {
      this.errors.push({ line: headerAt + 1, message: `missing columns: ${missing.join(", ")}` });
    } else {
      const col = (name: string): number => header.indexOf(name);
      for (let i: number = headerAt + 1; i < lines.length; i += 1) {
        const raw: string = lines[i] ?? "";
        if (!isSkippable(raw)) {
          this.parseRow(raw.split("\t"), i + 1, col);
        }
      }
    }
  }

  private parseRow(cells: string[], lineNo: number, col: (name: string) => number): void {
    const form: string = (cells[col("form")] ?? "").trim().normalize("NFC");
    const freqText: string = (cells[col("freq")] ?? "").trim();
    const freq: number = Number(freqText);
    const status: string = (cells[col("status")] ?? "").trim();

    if (!VALID_FORM.test(form)) {
      this.errors.push({ line: lineNo, message: `invalid form "${form}"` });
    } else if (freqText === "" || !Number.isFinite(freq) || freq < 0) {
      this.errors.push({ line: lineNo, message: `invalid freq "${freqText}"` });
    } else if (status === "approved") {
      this.add({
        form,
        freq,
        variety: (cells[col("variety")] ?? "").trim(),
        orthography: (cells[col("orthography")] ?? "").trim(),
        status,
      });
    }
  }
}

function isSkippable(line: string): boolean {
  return line.trim() === "" || line.trimStart().startsWith("#");
}

// Higher frequency first; ties broken alphabetically for stable output.
function compareEntries(a: LexiconEntry, b: LexiconEntry): number {
  let order: number = b.freq - a.freq;
  if (order === 0) {
    order = a.form.localeCompare(b.form, "it");
  }
  return order;
}
