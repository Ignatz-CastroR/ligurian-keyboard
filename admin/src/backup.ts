/*
 * backup.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 08:58:40, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The lexicon manager's side of backups: the name of a backup
 *           file, and a check of a file chosen for a restore before it
 *           is sent, so that a wrong file is refused at once and with a
 *           clear reason. Pure functions, no DOM, tested in Node.
 * Contract: The format is written by public.export_backup[] and read by
 *           public.restore_backup[], both in
 *           db/migrations/0006_public_ids_and_backups.sql; the database
 *           checks every file again and refuses any restore into a
 *           dictionary that is not empty.
 * Decision: docs/decisions/0031-backups.md
 */

export const BACKUP_FORMAT: string = "ligurian-keyboard-backup";
export const BACKUP_FORMAT_VERSION: number = 1;

// The tables a backup must hold, in the order a restore loads them.
export const BACKUP_TABLES: readonly string[] = [
  "varieties", "orthographies", "gloss_languages", "profiles",
  "lemmas", "wordforms", "senses", "glosses", "audit_log",
];

export interface BackupSummary {
  createdAt: string;
  counts: Record<string, number>;
}

export type BackupCheck =
  | { ok: true; backup: Record<string, unknown>; summary: BackupSummary }
  | { ok: false; reason: "json" | "format" | "version" | "tables" };

// How a count is written in the interface's language, singular or plural.
export type CountText = (n: number) => string;

export interface CountLabels {
  lemmas: CountText;
  wordforms: CountText;
  senses: CountText;
  glosses: CountText;
  history: CountText;
}

export interface RestoreReport {
  restored: Record<string, number>;
  profiles_skipped: number;
  authors_unknown: number;
}

const two = (n: number): string => String(n).padStart(2, "0");

/* "12 lemmi · 1 forma · 4 significati · 8 traduzioni · 120 righe di
   cronologia": what a backup holds or a restore loaded. A count the
   record lacks is 0. */
export function countsSummary(counts: Record<string, number>, labels: CountLabels): string {
  const parts: [string, CountText][] = [
    ["lemmas", labels.lemmas], ["wordforms", labels.wordforms], ["senses", labels.senses],
    ["glosses", labels.glosses], ["audit_log", labels.history],
  ];
  return parts.map(([key, text]) => text(counts[key] ?? 0)).join(" · ");
}

/* ligurian-backup-20261018-085840.json: local date and time, digits
   only, so that the files sort by name in the order they were made. */
export function backupFileName(when: Date): string {
  const date: string = `${when.getFullYear()}${two(when.getMonth() + 1)}${two(when.getDate())}`;
  const time: string = `${two(when.getHours())}${two(when.getMinutes())}${two(when.getSeconds())}`;
  return `ligurian-backup-${date}-${time}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/* Is this text a backup this version can restore? The first failing
   reason wins: not JSON, not a backup, another format version, or a
   table missing. */
export function checkBackupText(text: string): BackupCheck {
  let parsed: unknown = null;
  let result: BackupCheck;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }

  if (parsed === undefined) {
    result = { ok: false, reason: "json" };
  } else if (!isRecord(parsed) || parsed["format"] !== BACKUP_FORMAT) {
    result = { ok: false, reason: "format" };
  } else if (parsed["format_version"] !== BACKUP_FORMAT_VERSION) {
    result = { ok: false, reason: "version" };
  } else {
    const tables: unknown = parsed["tables"];
    const complete: boolean = isRecord(tables)
      && BACKUP_TABLES.every((name) => Array.isArray(tables[name]));
    if (complete && isRecord(tables)) {
      const counts: Record<string, number> = {};
      for (const name of BACKUP_TABLES) {
        counts[name] = (tables[name] as unknown[]).length;
      }
      result = {
        ok: true,
        backup: parsed,
        summary: { createdAt: String(parsed["created_at"] ?? ""), counts },
      };
    } else {
      result = { ok: false, reason: "tables" };
    }
  }
  return result;
}
