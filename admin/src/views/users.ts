/*
 * users.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 20:18:50, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Everyone edits their own display name. Reviewers see the
 *           list of people; admins also rename them and change roles.
 * Contract: The database refuses self promotion and the demotion of
 *           the last admin [0002]; this page only reports its answer.
 * Updated:  2026/10/18, 09:23:48: for admins, a backup download and a
 *           restore into an empty dictionary [decision 0031]; the
 *           database checks the role and the emptiness again.
 * Updated:  2026/10/18, 14:12:05: the backup file is named by the time
 *           of the click, as the TSV and CSV downloads are.
 * Updated:  2026/10/18, 16:53:31: the backup is assembled from small
 *           reads, with its progress shown, instead of one statement
 *           that the database's time limit could stop; started again
 *           when the dictionary changes meanwhile, so the file always
 *           restores.
 * Updated:  2026/10/19, 23:33:20: a restore past the time limit points
 *           to the procedure for large backups.
 */

import type { Context } from "../context.ts";
import type { Profile, Role } from "../types.ts";
import { ROLES } from "../types.ts";
import { backupSource, profiles, restoreBackup, updateProfile } from "../db.ts";
import { AppError } from "../errors.ts";
import { canBackup, canManageRoles, isStaff } from "../permissions.ts";
import { formatDateTime } from "../forms.ts";
import {
  BackupBusyError, assembleBackup, backupFileName, checkBackupText, countsSummary,
  type BackupCheck, type CountLabels, type RestoreReport, type Row,
} from "../backup.ts";
import { describeError, downloadText, field, h, roleLabel, runAction, select, showError, showInfo } from "../ui.ts";

const MAX_NAME: number = 80;

export async function renderUsers(ctx: Context, root: HTMLElement): Promise<void> {
  const { t } = ctx;
  if (ctx.userId === null || ctx.profile === null) {
    root.append(h("p", { class: "error-text" }, t.errPermission));
  } else {
    root.append(accountCard(ctx, ctx.profile));
    if (isStaff(ctx.role)) {
      const list: HTMLElement = h("div", {}, h("p", { class: "muted" }, t.loading));
      root.append(h("section", { class: "card" },
        h("h2", {}, t.usersTitle), h("p", { class: "muted" }, t.usersIntro), list));
      try {
        drawPeople(ctx, list, await profiles());
      } catch (error: unknown) {
        list.replaceChildren(h("p", { class: "error-text" }, describeError(t, error)));
      }
    }
    if (canBackup(ctx.role)) {
      root.append(backupCard(ctx), restoreCard(ctx));
    }
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
        ctx.navigate("#/users", notes.join(" "));
      }
    }
  }));

  return h("section", { class: "card" },
    h("h2", {}, t.restoreTitle), h("p", { class: "muted" }, t.restoreIntro),
    field(t.restoreFile, file),
    h("div", { class: "buttons" }, button));
}

function accountCard(ctx: Context, me: Profile): HTMLElement {
  const { t } = ctx;
  const name: HTMLInputElement = h("input", { type: "text", value: me.display_name, maxlength: MAX_NAME });
  const saveButton: HTMLButtonElement = h("button", { type: "submit", class: "primary" }, t.save);
  const form: HTMLFormElement = h("form", { class: "card edit-form" },
    h("h2", {}, t.accountTitle),
    h("p", {}, t.accountRole(roleLabel(t, me.role))),
    field(t.fieldDisplayName, name),
    h("div", { class: "buttons" }, saveButton),
  );
  form.addEventListener("submit", (event: Event) => {
    event.preventDefault();
    const value: string = name.value.trim();
    if ([...value].length > MAX_NAME) {
      showError(t.errTextTooLong(MAX_NAME));
    } else {
      void runAction(t, saveButton, async () => {
        await updateProfile(me.user_id, { display_name: value });
        await ctx.reloadProfile();
        showInfo(t.accountSaved);
      });
    }
  });
  return form;
}

function drawPeople(ctx: Context, target: HTMLElement, people: Profile[]): void {
  const { t } = ctx;
  const admin: boolean = canManageRoles(ctx.role);
  const rows: HTMLElement = h("tbody", {});

  for (const person of people) {
    const isMe: boolean = person.user_id === ctx.userId;
    const name: HTMLInputElement = h("input", { type: "text", value: person.display_name, maxlength: MAX_NAME, disabled: !admin });
    const role: HTMLSelectElement = select(ROLES.map((r) => ({ value: r, label: roleLabel(t, r) })), person.role);
    role.disabled = !admin || isMe;
    const saveButton: HTMLButtonElement = h("button", { type: "button", class: "small" }, t.save);
    saveButton.addEventListener("click", () => void runAction(t, saveButton, async () => {
      await updateProfile(person.user_id, { display_name: name.value.trim(), role: role.value as Role });
      if (isMe) {
        await ctx.reloadProfile();
      }
      showInfo(t.saved);
    }));

    rows.append(h("tr", {},
      h("td", {}, name, isMe && h("span", { class: "muted" }, ` ${t.usersYou}`)),
      h("td", {}, role),
      h("td", { class: "muted mono" }, person.user_id),
      h("td", { class: "muted nowrap" }, formatDateTime(person.created_at)),
      h("td", {}, admin && saveButton),
    ));
  }

  target.replaceChildren(h("table", { class: "queue" },
    h("thead", {}, h("tr", {},
      h("th", {}, t.fieldDisplayName), h("th", {}, t.fieldRole), h("th", {}, t.fieldUserId),
      h("th", {}, t.fieldDate), h("th", {}),
    )),
    rows,
  ));
}
