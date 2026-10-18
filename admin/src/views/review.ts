/*
 * review.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 20:18:34, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/18, 13:26:39: the queue grouped by entry; batch
 *           selection with a box on every row, a box per entry, "select
 *           all" and Shift+click ranges; Approve selected and Reject
 *           selected in one database call; rows that fail are listed
 *           with their reasons; senses and translations labelled from
 *           the queue's own columns [decision 0033]. After a batch no
 *           row of it stays selected, and the rows that failed are
 *           marked in the queue; while a batch runs, every button of
 *           the page waits.
 * Purpose:  The review queue: everything pending, oldest first, grouped
 *           by entry. Reviewers and admins approve or reject from here;
 *           contributors see their own proposals still waiting.
 * Contract: Every change goes through reviewBatch[], with the version
 *           of each row as the page read it: a row someone changed in
 *           the meantime is reported, never overwritten. The selection
 *           logic lives in queue.ts and is tested there.
 */

import type { Context } from "../context.ts";
import type { Profile, QueueItem, QueueKind } from "../types.ts";
import { profiles, reviewBatch, reviewQueue } from "../db.ts";
import { AppError } from "../errors.ts";
import { isStaff } from "../permissions.ts";
import { formatDateTime, shortId } from "../forms.ts";
import {
  afterBatch, batchItems, clickGroup, clickRow, coverage, displayOrder, failureKind, groupItems, groupKey, groupQueue,
  itemContext, itemKey, itemLabel, keepVisible, selectAll, selectedItems,
  type BatchOutcome, type BatchResult, type QueueGroup, type ReviewStatus, type Selection,
} from "../queue.ts";
import { appendAll, clear, describeError, h, hideMessage, runAction, showError, showInfo, statusLabel } from "../ui.ts";

interface Page {
  busy: boolean;
  // Rows the last batch could not change, marked until the next one.
  flagged: Set<string>;
  groups: QueueGroup[];
  names: Map<string, string>;
  selection: Selection;
  rowBoxes: Map<string, HTMLInputElement>;
  groupBoxes: Map<string, HTMLInputElement>;
}

export async function renderReview(ctx: Context, root: HTMLElement): Promise<void> {
  const { t } = ctx;
  const staff: boolean = isStaff(ctx.role);
  const page: Page = { busy: false, flagged: new Set(), groups: [], names: new Map(), selection: { selected: new Set(), anchor: null }, rowBoxes: new Map(), groupBoxes: new Map() };
  const kindLabels: Record<QueueKind, string> = {
    lemma: t.kindLemma, wordform: t.kindWordform, sense: t.kindSense, gloss: t.kindGloss,
  };
  const label = (item: QueueItem): string => itemLabel(t, item);

  const failures: HTMLElement = h("div", { class: "batch-failures", hidden: true, role: "alert" });
  const body: HTMLElement = h("div", {}, h("p", { class: "muted" }, t.loading));

  const allBox: HTMLInputElement = h("input", { type: "checkbox" });
  const count: HTMLElement = h("span", { class: "muted", "aria-live": "polite" });
  const approveSelected: HTMLButtonElement = h("button", { type: "button", class: "small ok" }, t.reviewApproveSelected);
  const rejectSelected: HTMLButtonElement = h("button", { type: "button", class: "small warn" }, t.reviewRejectSelected);
  const toolbar: HTMLElement = h("div", { class: "batch-bar", hidden: true },
    h("label", { class: "pick-all" }, allBox, ` ${t.reviewSelectAll}`), count, approveSelected, rejectSelected);

  appendAll(root,
    h("h2", {}, t.reviewTitle),
    h("p", { class: "muted" }, staff ? t.reviewIntro : t.reviewOwnIntro),
    failures,
    staff && toolbar,
    body,
  );

  // Every box on the page shows the current selection.
  const sync = (): void => {
    const { selected } = page.selection;
    for (const [key, box] of page.rowBoxes) {
      box.checked = selected.has(key);
    }
    for (const group of page.groups) {
      const box: HTMLInputElement | undefined = page.groupBoxes.get(groupKey(group));
      if (box !== undefined) {
        const state = coverage(selected, groupItems(group).map(itemKey));
        box.checked = state === "all";
        box.indeterminate = state === "some";
      }
    }
    const everything = coverage(selected, displayOrder(page.groups));
    allBox.checked = everything === "all";
    allBox.indeterminate = everything === "some";
    const n: number = selectedItems(page.groups, selected).length;
    count.textContent = t.reviewSelected(n);
    approveSelected.disabled = n === 0 || page.busy;
    rejectSelected.disabled = n === 0 || page.busy;
    allBox.disabled = page.busy;
    toolbar.hidden = page.groups.length === 0;
  };

  const showFailures = (result: BatchResult, labels: Map<string, string>): void => {
    failures.hidden = result.failed.length === 0;
    failures.replaceChildren();
    if (result.failed.length > 0) {
      failures.append(
        h("p", { class: "error-text" }, t.reviewFailed(result.failed.length)),
        h("ul", {}, ...result.failed.map((f) => h("li", {},
          h("span", { class: `tag kind-${f.kind}` }, kindLabels[f.kind]), " ",
          h("strong", {}, labels.get(itemKey(f)) ?? `#${f.id}`), ": ",
          describeError(t, new AppError(failureKind(f), f.message)),
        ))),
      );
    }
  };

  // A failed reload empties the page's rows and selection, so that no
  // button can act on rows no longer shown.
  const reload = async (): Promise<void> => {
    try {
      const [queue, people] = await Promise.all([reviewQueue(), staff ? profiles() : Promise.resolve([] as Profile[])]);
      page.groups = groupQueue(queue);
      page.names = new Map(people.map((p) => [p.user_id, p.display_name]));
      page.selection = keepVisible(page.selection, page.groups);
      draw();
    } catch (error: unknown) {
      page.groups = [];
      page.selection = { selected: new Set(), anchor: null };
      body.replaceChildren(h("p", { class: "error-text" }, describeError(t, error)));
      sync();
    }
  };

  // While a batch runs, every button on the page waits for it.
  const setBusy = (busy: boolean): void => {
    page.busy = busy;
    for (const button of root.querySelectorAll<HTMLButtonElement>("table.queue button")) {
      button.disabled = busy;
    }
    sync();
  };

  // Approve or reject these rows, then reload and show what happened.
  const act = async (items: QueueItem[], status: ReviewStatus): Promise<void> => {
    const asked: boolean = status === "rejected" && items.length > 1;
    if (!page.busy && items.length > 0 && (!asked || window.confirm(t.reviewConfirmReject(items.length)))) {
      failures.hidden = true;
      const labels: Map<string, string> = new Map(items.map((item) => [itemKey(item), label(item)]));
      setBusy(true);
      let outcome: BatchOutcome = { result: { updated: 0, failed: [] }, error: null };
      try {
        outcome = await reviewBatch(batchItems(items), status);
      } finally {
        page.selection = afterBatch(page.selection, items);
        page.flagged = new Set(outcome.result.failed.map(itemKey));
        page.busy = false;
        await reload();
      }
      const { result, error } = outcome;
      showFailures(result, labels);
      const done: string = result.updated === 0 ? ""
        : status === "approved" ? t.reviewApproved(result.updated) : t.reviewRejected(result.updated);
      if (error !== null) {
        showError(`${done} ${describeError(t, error)}`.trim());
      } else if (done !== "") {
        showInfo(done);
      } else {
        hideMessage();
      }
    }
  };

  const actionButtons = (items: () => QueueItem[], approveText: string, rejectText: string): HTMLElement => {
    const box: HTMLElement = h("span", { class: "actions" });
    for (const [text, status, cls] of [[approveText, "approved", "small ok"], [rejectText, "rejected", "small warn"]] as const) {
      const button: HTMLButtonElement = h("button", { type: "button", class: cls }, text);
      button.addEventListener("click", () => void runAction(t, button, () => act(items(), status)));
      box.append(button);
    }
    return box;
  };

  // A row's box: a plain click toggles it; Shift+click a whole range.
  const rowBox = (item: QueueItem): HTMLElement => {
    const key: string = itemKey(item);
    const box: HTMLInputElement = h("input", { type: "checkbox", "aria-label": t.reviewSelectRow(label(item)) });
    // Shift+click would also select the text between the two rows.
    box.addEventListener("mousedown", (event: MouseEvent) => {
      if (event.shiftKey) {
        event.preventDefault();
      }
    });
    box.addEventListener("click", (event: MouseEvent) => {
      page.selection = clickRow(page.selection, displayOrder(page.groups), key, box.checked, event.shiftKey);
      sync();
    });
    page.rowBoxes.set(key, box);
    return h("td", { class: "pick" }, box);
  };

  const groupBox = (group: QueueGroup): HTMLElement => {
    const box: HTMLInputElement = h("input", { type: "checkbox", "aria-label": t.reviewSelectEntry(group.headword) });
    box.addEventListener("change", () => {
      page.selection = clickGroup(page.selection, group, box.checked);
      sync();
    });
    page.groupBoxes.set(groupKey(group), box);
    return h("td", { class: "pick" }, box);
  };

  function draw(): void {
    clear(body);
    page.rowBoxes.clear();
    page.groupBoxes.clear();

    if (page.groups.length === 0) {
      body.append(h("p", { class: "muted" }, t.nothing));
    } else {
      const table: HTMLElement = h("table", { class: "queue grouped" },
        h("thead", {}, h("tr", {},
          staff && h("th", { class: "pick" }),
          h("th", {}, t.fieldKind), h("th", {}, t.fieldText), h("th", {}, staff ? t.fieldAuthor : ""),
          h("th", {}, t.fieldDate), h("th", {}),
        )));

      for (const group of page.groups) {
        const items: QueueItem[] = groupItems(group);
        const lemmaNote: string = group.lemma === null && group.lemmaStatus !== null
          ? t.reviewLemmaStatus(statusLabel(t, group.lemmaStatus))
          : "";
        const section: HTMLElement = h("tbody", { class: "entry-group" },
          h("tr", { class: "group-head" },
            staff && groupBox(group),
            h("td", { colspan: 4 },
              h("a", { href: `#/entry/${group.lemmaId}`, class: "headword" }, group.headword), " ",
              group.publicId !== null && h("span", { class: "muted mono", title: t.publicIdNote }, group.publicId), " ",
              lemmaNote !== "" && h("span", { class: "muted" }, `[${lemmaNote}]`)),
            h("td", { class: "nowrap" },
              staff && items.length > 1 && actionButtons(() => groupItems(group), t.reviewApproveEntry, t.reviewRejectEntry)),
          ));

        for (const item of items) {
          const author: string = item.created_by === null ? "SQL" : (page.names.get(item.created_by) || shortId(item.created_by));
          const context: string = itemContext(t, item);
          const flagged: boolean = page.flagged.has(itemKey(item));
          section.append(h("tr", { class: `kind-row-${item.kind}${flagged ? " flagged" : ""}` },
            staff && rowBox(item),
            h("td", {}, h("span", { class: `tag kind-${item.kind}` }, kindLabels[item.kind])),
            h("td", {},
              h("a", { href: `#/entry/${item.lemma_id}`, class: item.kind === "lemma" ? "headword" : "" }, label(item)),
              context !== "" && h("span", { class: "muted" }, ` ${context}`)),
            h("td", { class: "muted" }, staff ? author : ""),
            h("td", { class: "muted nowrap" }, formatDateTime(item.created_at)),
            h("td", { class: "nowrap" }, staff && actionButtons(() => [item], t.approve, t.reject)),
          ));
        }
        table.append(section);
      }
      body.append(table);
    }
    sync();
  }

  allBox.addEventListener("change", () => {
    page.selection = selectAll(page.groups, allBox.checked);
    sync();
  });
  // runAction[] enables its button again when done; sync[] then
  // disables it if nothing is left selected.
  approveSelected.addEventListener("click", () => void runAction(t, approveSelected,
    () => act(selectedItems(page.groups, page.selection.selected), "approved")).then(sync));
  rejectSelected.addEventListener("click", () => void runAction(t, rejectSelected,
    () => act(selectedItems(page.groups, page.selection.selected), "rejected")).then(sync));

  await reload();
}
