/*
 * backups.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 01:52:40, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The lexicon manager's Backups tab, for admins: the whole
 *           dictionary downloaded as one JSON file, and a restore into
 *           an empty dictionary [decision 0031]. Moved here from the
 *           users page, which became the site's own Users section
 *           [decision 0035]; the two cards are unchanged.
 * Contract: The database checks the role and the emptiness again. The
 *           backup is assembled from small reads, with its progress
 *           shown, and started again when the dictionary changes
 *           meanwhile, so the file always restores; a restore past the
 *           time limit points to the procedure for large backups.
 * Decision: docs/decisions/0031-backups.md
 *           docs/decisions/0035-site-in-five-sections.md
 */

import type { Context } from "../context.ts";
import { backupSource, restoreBackup } from "../db.ts";
import { AppError } from "../errors.ts";
import { canBackup } from "../permissions.ts";
import {
  BackupBusyError, assembleBackup, backupFileName, checkBackupText, countsSummary,
  type BackupCheck, type CountLabels, type RestoreReport, type Row,
} from "../backup.ts";
import { downloadText, field, h, runAction, showError, showInfo } from "../ui.ts";

export async function renderBackups(ctx: Context, root: HTMLElement): Promise<void> {
  if (canBackup(ctx.role)) {
    root.append(backupCard(ctx), restoreCard(ctx));
  } else {
    root.append(h("p", { class: "error-text" }, ctx.t.errPermission));
  }
}

function countLabels(ctx: Context): CountLabels {
  const { t } = ctx;
  return {
    lemmas: t.countLemmas, wordforms: t.countWordforms, senses: t.countSenses,
    glosses: t.countGlosses, history: t.countHistory,
  };
}

// The whole dictionary as one JSON file, saved by the browser.
function backupCard(ctx: Context): HTMLElement {
  const { t } = ctx;
  const button: HTMLButtonElement = h("button", { type: "button", class: "primary" }, t.backupDownload);
  button.addEventListener("click", () => void runAction(t, button, async () => {
    // Named at the click, like the TSV and CSV downloads.
    const started: Date = new Date();
    const name: string = backupFileName(started);
    try {
      const backup: Row = await assembleBackup(backupSource(), started,
        (rows: number) => showInfo(t.backupProgress(rows)),
        (attempt: number) => showInfo(t.backupRetry(attempt)));
      downloadText(name, JSON.stringify(backup, null, 1), "application/json;charset=utf-8");
      showInfo(t.backupSaved(name));
    } catch (error: unknown) {
      if (!(error instanceof BackupBusyError)) {
        throw error;
      }
      showError(t.backupBusy);
    }
  }));
  return h("section", { class: "card" },
    h("h2", {}, t.backupTitle), h("p", { class: "muted" }, t.backupIntro),
    h("div", { class: "buttons" }, button));
}

// Rebuild an empty dictionary from a backup file.
function restoreCard(ctx: Context): HTMLElement {
  const { t } = ctx;
  const file: HTMLInputElement = h("input", { type: "file", accept: ".json,application/json" });
  const button: HTMLButtonElement = h("button", { type: "button", class: "danger" }, t.restoreButton);
  const reasons: Record<Exclude<BackupCheck, { ok: true }>["reason"], string> = {
    json: t.restoreBadJson, format: t.restoreBadFormat, version: t.restoreBadVersion, tables: t.restoreBadTables,
  };

  button.addEventListener("click", () => void runAction(t, button, async () => {
    const chosen: File | undefined = file.files?.[0];
    if (chosen === undefined) {
      showError(t.restoreNoFile);
    } else {
      const check: BackupCheck = checkBackupText(await chosen.text());
      if (!check.ok) {
        showError(reasons[check.reason]);
      } else if (window.confirm(t.restoreConfirm(countsSummary(check.summary.counts, countLabels(ctx))))) {
        let report: RestoreReport;
        try {
          report = await restoreBackup(check.backup);
        } catch (error: unknown) {
          // A restore is one statement: past the time limit, the way
          // is the procedure for large backups.
          throw error instanceof AppError && error.kind === "timeout" ? new AppError("generic", t.restoreTimeout) : error;
        }
        const notes: string[] = [t.restoreDone(countsSummary(report.restored, countLabels(ctx)))];
        if (report.profiles_skipped > 0) {
          notes.push(t.restoreProfilesSkipped(report.profiles_skipped));
        }
        if (report.authors_unknown > 0) {
          notes.push(t.restoreAuthorsUnknown(report.authors_unknown));
        }
        // Redraw the page: the dictionary is no longer empty.
        ctx.navigate("#/backups", notes.join(" "));
      }
    }
  }));

  return h("section", { class: "card" },
    h("h2", {}, t.restoreTitle), h("p", { class: "muted" }, t.restoreIntro),
    field(t.restoreFile, file),
    h("div", { class: "buttons" }, button));
}
