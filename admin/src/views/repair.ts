/*
 * repair.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 23:49:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/21, 09:30:23: definitions follow their translations
 *           and are labelled with the numbers the senses will have; a
 *           typed definition the action would not use stops it; the keys
 *           act even from a menu, which no longer moves; the count of
 *           lemmas waiting and the next lemma come from the whole queue;
 *           a saved regrouping is never reported as an error; a lemma
 *           with no sense left is closed with "Lascia così".
 * Updated:  2026/10/21, 10:57:43: while a menu has the focus the keys
 *           choose in it, as a keyboard user expects, and the focus leaves
 *           a menu only after a choice made with the mouse; a group that
 *           falls out of use takes its typed text with its field; only the
 *           fields shown are checked for length.
 * Purpose:  The repair page of one lemma, #/repair/<id>: its live
 *           translations, each with its current sense and a choice of new
 *           sense, an Italian definition field per new sense, and three
 *           actions, each also on a key: 1 one sense, 2 leave as it is,
 *           3 group as chosen. Each action is saved at once and opens the
 *           next lemma of the queue. Reviewers and admins only.
 * Contract: Every action goes through regroup_senses[] [migration 0012]
 *           with what this page read, the lemma's version included; a
 *           change made by anyone meanwhile refuses it whole, and the
 *           page reloads and says so. The logic lives in ../repair.ts and
 *           is tested there.
 * Decision: docs/decisions/0038-senses-reviewed-one-by-one.md
 */

import type { Context } from "../context.ts";
import type { Entry } from "../types.ts";
import {
  AppError, loadEntry, regroupSenses, senseReviewQueue, type RegroupReport, type SenseQueuePage,
} from "../db.ts";
import { isStaff } from "../permissions.ts";
import { formatDateTime } from "../forms.ts";
import {
  actionForKey, bareSenses, definitionFields, groupNumbers, initialAssignment, isWaiting, planFor, queueKey, repairRows,
  seenOf, tooLongDefinition, type Plan, type RepairAction, type RepairRow,
} from "../repair.ts";
import { appendAll, describeError, field, h, posLabel, showError, statusLabel } from "../ui.ts";

const EMPTY_PAGE: SenseQueuePage = { rows: [], first: 0, total: 0 };

/* The lemma that follows this one in the queue, or, when none follows,
   the first of the queue, since skipped lemmas wait before it; with the
   number waiting in all. */
async function following(entry: Entry): Promise<SenseQueuePage> {
  let page: SenseQueuePage = await senseReviewQueue(queueKey(entry), 1);
  if (page.rows.length === 0) {
    page = await senseReviewQueue(null, 1);
  }
  return page;
}

export async function renderRepair(ctx: Context, root: HTMLElement, param: string): Promise<void> {
  const { t } = ctx;
  if (!isStaff(ctx.role)) {
    appendAll(root, h("h2", {}, t.repairTitle),
      h("p", { class: "error-text" }, describeError(t, new AppError("permission", "senses"))));
    return;
  }

  let entry: Entry;
  try {
    entry = await loadEntry(Number(param));
  } catch (error: unknown) {
    appendAll(root, h("h2", {}, t.repairTitle), h("p", { class: "error-text" }, describeError(t, error)));
    return;
  }

  const lemma = entry.lemma;
  const rows: RepairRow[] = repairRows(entry);
  const bare: number[] = bareSenses(entry);
  const waiting: boolean = isWaiting(entry);
  const assignment: Map<number, number> = initialAssignment(rows);
  // The definitions typed, by group number.
  const typed: Map<number, string> = new Map();
  let busy: boolean = false;
  document.title = `${t.repairPageTitle(lemma.headword)} · ${t.appTitle}`;

  // How many wait, and which lemma follows, from the queue itself.
  let ahead: SenseQueuePage = EMPTY_PAGE;
  try {
    ahead = await following(entry);
  } catch {
    // Not essential: the page works without the count.
  }
  const nextId: number | null = ahead.rows.find((r) => r.lemma_id !== lemma.id)?.lemma_id ?? null;

  const status: HTMLElement[] = [];
  if (lemma.deleted_at !== null) {
    status.push(h("p", { class: "error-text" }, t.statusDeleted));
  }
  if (!waiting) {
    status.push(h("p", { class: "muted" }, t.repairNotWaiting));
  } else if (ahead.total > 0) {
    status.push(h("p", { class: "muted" }, t.repairRemaining(ahead.total)));
  }
  if (lemma.senses_reviewed_at !== null) {
    status.push(h("p", { class: "muted" }, t.repairReviewedAt(formatDateTime(lemma.senses_reviewed_at))));
  }
  if (bare.length > 0) {
    status.push(h("p", { class: "warn-text" }, t.repairBare(bare.join(", "))));
  } else if (rows.length === 0) {
    status.push(h("p", { class: "muted" }, t.repairNoSenseLeft));
  }

  // One definition field per new sense; what is typed stays with its
  // group while the menus change.
  const definitionBox: HTMLElement = h("div", { class: "edit-form" });
  const drawDefinitions = (): void => {
    definitionBox.replaceChildren(...definitionFields(entry, rows, assignment, typed).map((f) => {
      const area: HTMLTextAreaElement = h("textarea", { rows: 2 });
      area.value = f.value;
      area.addEventListener("input", () => typed.set(f.group, area.value));
      return field(t.repairDefinition(f.rank), area);
    }));
  };

  // The translations, each with its current sense and its new one.
  const choices: number[] = rows.map((_, i) => i + 1);
  const table: HTMLElement = h("table", { class: "queue repair" },
    h("thead", {}, h("tr", {},
      h("th", {}, t.repairColCurrent), h("th", {}, t.repairColText), h("th", {}, t.repairColNew))));
  const tbody: HTMLElement = h("tbody", {});
  for (const row of rows) {
    const label: string = `${row.language}: ${row.gloss}`;
    const chooser: HTMLSelectElement = h("select", { "aria-label": t.repairSelectFor(label) });
    for (const n of choices) {
      chooser.append(h("option", { value: n, selected: n === row.position }, String(n)));
    }
    // A choice made with the mouse leaves the menu, so that the next key
    // press acts on the page; one made with the keyboard keeps the focus.
    let byPointer: boolean = false;
    chooser.addEventListener("pointerdown", () => { byPointer = true; });
    chooser.addEventListener("keydown", () => { byPointer = false; });
    chooser.addEventListener("change", () => {
      assignment.set(row.glossId, Number(chooser.value));
      // A group no longer in use takes its typed text with its field.
      const inUse: number[] = groupNumbers(assignment);
      for (const n of [...typed.keys()]) {
        if (!inUse.includes(n)) {
          typed.delete(n);
        }
      }
      drawDefinitions();
      if (byPointer) {
        chooser.blur();
      }
      byPointer = false;
    });
    tbody.append(h("tr", {},
      h("td", {}, String(row.senseNumber)),
      h("td", {}, h("span", { class: "lang" }, row.language), ` ${row.gloss} `,
        h("span", { class: `badge ${row.status}` }, statusLabel(t, row.status))),
      h("td", {}, chooser),
    ));
  }
  table.append(tbody);
  drawDefinitions();

  const button = (text: string, key: string | null, cls: string): HTMLButtonElement =>
    h("button", { type: "button", class: cls, title: key === null ? undefined : key },
      key === null ? text : `[${key}] ${text}`);
  const one: HTMLButtonElement = button(t.repairOne, "1", "primary");
  const keep: HTMLButtonElement = button(t.repairKeep, "2", "");
  const group: HTMLButtonElement = button(t.repairGroup, "3", "");
  const skip: HTMLButtonElement = button(t.repairSkip, null, "small");
  const actions: Record<RepairAction, HTMLButtonElement> = { one, keep, group };
  const blocked = (action: RepairAction): boolean =>
    busy || bare.length > 0 || lemma.deleted_at !== null || (rows.length === 0 && action !== "keep");
  const setBusy = (value: boolean): void => {
    busy = value;
    for (const action of Object.keys(actions) as RepairAction[]) {
      actions[action].disabled = blocked(action);
    }
    skip.disabled = busy || nextId === null;
  };
  setBusy(false);

  // After a save: the next lemma, or the queue when none is left.
  const goOn = async (notice: string): Promise<void> => {
    let next: SenseQueuePage = EMPTY_PAGE;
    try {
      next = await following(entry);
    } catch {
      ctx.navigate("#/senses", notice);
      return;
    }
    const target = next.rows.find((r) => r.lemma_id !== lemma.id);
    if (target !== undefined) {
      ctx.navigate(`#/repair/${target.lemma_id}`, notice);
    } else {
      ctx.navigate("#/senses", next.total === 0 ? `${notice} ${t.repairQueueDone}` : notice);
    }
  };

  const act = async (action: RepairAction): Promise<void> => {
    if (blocked(action)) {
      return;
    }
    const plan: Plan = planFor(action, entry, rows, assignment, typed);
    if (plan.unused.length > 0) {
      const ranks: string = definitionFields(entry, rows, assignment, typed)
        .filter((f) => plan.unused.includes(f.group)).map((f) => String(f.rank)).join(", ");
      showError(t.repairUnusedDefinitions(ranks));
      return;
    }
    const long: number | null = tooLongDefinition(typed, groupNumbers(assignment));
    if (long !== null) {
      const rank: number = definitionFields(entry, rows, assignment, typed).find((f) => f.group === long)?.rank ?? long;
      showError(t.repairDefinitionTooLong(rank));
      return;
    }
    setBusy(true);
    let report: RegroupReport;
    try {
      report = await regroupSenses(lemma.id, seenOf(entry), plan.groups);
    } catch (error: unknown) {
      setBusy(false);
      if (error instanceof AppError && error.kind === "conflict") {
        // Show what is stored now, then why nothing was saved. The page
        // drawn again listens to the keys itself.
        window.removeEventListener("keydown", onKey);
        root.replaceChildren();
        await renderRepair(ctx, root, param);
      }
      showError(describeError(t, error));
      return;
    }
    // Saved: nothing after this point may report it as a failure.
    window.removeEventListener("keydown", onKey);
    await goOn(t.repairSaved(lemma.headword, report.kept, report.created, report.deleted));
  };

  one.addEventListener("click", () => void act("one"));
  keep.addEventListener("click", () => void act("keep"));
  group.addEventListener("click", () => void act("group"));
  skip.addEventListener("click", () => {
    if (nextId !== null) {
      ctx.navigate(`#/repair/${nextId}`);
    }
  });

  /* The keys 1, 2 and 3, except while a text field or a menu has the
     focus: there they type, or choose. The listener removes itself once
     this page is gone. */
  const onKey = (event: KeyboardEvent): void => {
    if (!root.isConnected) {
      window.removeEventListener("keydown", onKey);
      return;
    }
    const target: EventTarget | null = event.target;
    const typing: boolean = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
    const action: RepairAction | null = actionForKey(event.key, typing, event.ctrlKey || event.metaKey || event.altKey);
    if (action !== null && !event.repeat) {
      event.preventDefault();
      void act(action);
    }
  };
  window.addEventListener("keydown", onKey);

  appendAll(root,
    h("div", { class: "entry-head" },
      h("h2", { class: "headword big" }, lemma.headword),
      h("span", { class: "muted mono" }, lemma.public_id),
      h("span", { class: "muted" }, posLabel(t, lemma.part_of_speech))),
    h("p", { class: "muted" }, t.repairPageTitle(lemma.headword)),
    ...status,
    h("section", { class: "card" },
      h("p", { class: "muted small-text" }, t.repairHelp),
      rows.length > 0 && table,
      h("p", {}, h("a", { href: `#/entry/${lemma.id}` }, t.repairEditInEntry)),
      definitionBox,
      h("div", { class: "buttons" }, one, keep, group)),
    h("div", { class: "buttons" }, skip, h("a", { href: "#/senses", class: "nav-link" }, t.repairBack)),
  );
}
