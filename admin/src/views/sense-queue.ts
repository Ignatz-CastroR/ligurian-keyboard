/*
 * sense-queue.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 23:49:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/21, 09:30:23: "Comincia dal primo" opens the first lemma
 *           of the whole queue, not of the page shown.
 * Purpose:  The queue of the senses to review: the lemmas a load by SQL
 *           split one sense per translation, fewest senses first, 50 a
 *           page, each with its translations and a link to its repair
 *           page. Reviewers and admins only.
 * Contract: The list comes from sense_review_queue[] [migration 0012],
 *           page after page by key: a lemma reviewed by someone else
 *           meanwhile simply leaves the next page.
 * Decision: docs/decisions/0038-senses-reviewed-one-by-one.md
 */

import type { Context } from "../context.ts";
import { senseReviewQueue, type SenseQueuePage, type SenseQueueRow } from "../db.ts";
import { AppError } from "../errors.ts";
import { isStaff } from "../permissions.ts";
import type { QueueKey } from "../repair.ts";
import { appendAll, describeError, h, runAction } from "../ui.ts";

export const SENSE_QUEUE_PAGE: number = 50;

function keyOf(row: SenseQueueRow): QueueKey {
  return { senses: row.senses, key: row.headword_key, id: row.lemma_id };
}

// "1. it: stecco · 2. it: stecchino"
export function translationsPreview(row: SenseQueueRow): string {
  return row.translations.map((t) => `${t.sense_number}. ${t.language}: ${t.gloss}`).join(" · ");
}

export async function renderSenseQueue(ctx: Context, root: HTMLElement): Promise<void> {
  const { t } = ctx;
  appendAll(root, h("h2", {}, t.repairTitle));
  if (!isStaff(ctx.role)) {
    root.append(h("p", { class: "error-text" }, describeError(t, new AppError("permission", "senses"))));
    return;
  }

  const totals: HTMLElement = h("p", { class: "muted", "aria-live": "polite" });
  const start: HTMLButtonElement = h("button", { type: "button", class: "primary", hidden: true }, t.repairStart);
  const body: HTMLElement = h("div", {}, h("p", { class: "muted" }, t.loading));
  const previous: HTMLButtonElement = h("button", { type: "button", class: "small" }, t.reviewPrevious);
  const next: HTMLButtonElement = h("button", { type: "button", class: "small" }, t.reviewNext);
  const range: HTMLElement = h("span", { class: "muted" });
  const pager: HTMLElement = h("div", { class: "pager", hidden: true }, previous, range, next);
  appendAll(root, h("p", { class: "muted" }, t.repairIntro), totals, h("div", { class: "buttons" }, start), body, pager);

  // The key of the last lemma of every page before this one.
  const before: QueueKey[] = [];
  let page: SenseQueuePage = { rows: [], first: 0, total: 0 };
  // The last load failed: its message stays until the next one.
  let failed: boolean = false;

  const draw = (): void => {
    totals.textContent = page.total === 0 ? "" : t.repairTotals(page.total);
    start.hidden = page.rows.length === 0;
    const last: number = page.first + page.rows.length - 1;
    range.textContent = page.rows.length === 0 ? "" : t.repairRange(page.first, last, page.total);
    previous.disabled = before.length === 0;
    next.disabled = page.rows.length === 0 || last >= page.total;
    pager.hidden = page.total <= SENSE_QUEUE_PAGE && before.length === 0;
    if (failed) {
      return;
    }
    if (page.rows.length === 0) {
      body.replaceChildren(h("p", { class: "muted" }, t.repairNone));
    } else {
      const table: HTMLElement = h("table", { class: "queue" },
        h("thead", {}, h("tr", {},
          h("th", {}, "#"), h("th", {}, t.fieldHeadword), h("th", {}, t.repairColSenses), h("th", {}, t.repairColTranslations))));
      const rows: HTMLElement = h("tbody", {});
      page.rows.forEach((row, i) => {
        rows.append(h("tr", {},
          h("td", { class: "muted" }, String(page.first + i)),
          h("td", { class: "nowrap" },
            h("a", { href: `#/repair/${row.lemma_id}`, class: "headword" }, row.headword), " ",
            h("span", { class: "muted mono" }, row.public_id)),
          h("td", {}, String(row.senses)),
          h("td", { class: "small-text" }, translationsPreview(row)),
        ));
      });
      table.append(rows);
      body.replaceChildren(table);
    }
  };

  // A page left empty, its lemmas reviewed meanwhile, gives way to the
  // one before it.
  const load = async (): Promise<void> => {
    try {
      page = await senseReviewQueue(before.at(-1) ?? null, SENSE_QUEUE_PAGE);
      while (page.rows.length === 0 && before.length > 0) {
        before.pop();
        page = await senseReviewQueue(before.at(-1) ?? null, SENSE_QUEUE_PAGE);
      }
      failed = false;
    } catch (error: unknown) {
      page = { rows: [], first: 0, total: 0 };
      failed = true;
      body.replaceChildren(h("p", { class: "error-text" }, describeError(t, error)));
    }
    draw();
  };

  // The first lemma of the whole queue, whichever page is shown.
  start.addEventListener("click", () => void runAction(t, start, async () => {
    const first: SenseQueueRow | undefined = (await senseReviewQueue(null, 1)).rows[0];
    if (first !== undefined) {
      ctx.navigate(`#/repair/${first.lemma_id}`);
    }
  }));
  previous.addEventListener("click", () => void runAction(t, previous, async () => {
    before.pop();
    await load();
    root.scrollIntoView({ block: "start" });
  }).then(draw));
  next.addEventListener("click", () => void runAction(t, next, async () => {
    const last: SenseQueueRow | undefined = page.rows.at(-1);
    if (last !== undefined) {
      before.push(keyOf(last));
      await load();
      root.scrollIntoView({ block: "start" });
    }
  }).then(draw));

  await load();
}
