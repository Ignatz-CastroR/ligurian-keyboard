/*
 * review.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/11, 20:18:34, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The review queue: everything pending, oldest first.
 *           Reviewers and admins approve or reject from here;
 *           contributors see their own proposals still waiting.
 */

import type { Context } from "../context.ts";
import type { Profile, QueueItem } from "../types.ts";
import { QUEUE_KIND_TABLE } from "../types.ts";
import { profiles, reviewQueue, setStatusById } from "../db.ts";
import { isStaff } from "../permissions.ts";
import { formatDateTime, shortId } from "../forms.ts";
import { clear, describeError, h, runAction, showInfo } from "../ui.ts";

export async function renderReview(ctx: Context, root: HTMLElement): Promise<void> {
  const { t } = ctx;
  const staff: boolean = isStaff(ctx.role);
  const body: HTMLElement = h("div", {}, h("p", { class: "muted" }, t.loading));
  root.append(
    h("h2", {}, t.reviewTitle),
    h("p", { class: "muted" }, staff ? t.reviewIntro : t.reviewOwnIntro),
    body,
  );

  const reload = async (): Promise<void> => {
    try {
      const [queue, people] = await Promise.all([reviewQueue(), staff ? profiles() : Promise.resolve([])]);
      drawQueue(ctx, body, queue, people, reload);
    } catch (error: unknown) {
      body.replaceChildren(h("p", { class: "error-text" }, describeError(t, error)));
    }
  };
  await reload();
}

function drawQueue(ctx: Context, body: HTMLElement, queue: QueueItem[], people: Profile[], reload: () => Promise<void>): void {
  const { t } = ctx;
  const names: Map<string, string> = new Map(people.map((p) => [p.user_id, p.display_name]));
  const kindLabels: Record<QueueItem["kind"], string> = {
    lemma: t.kindLemma, wordform: t.kindWordform, sense: t.kindSense, gloss: t.kindGloss,
  };
  clear(body);

  if (queue.length === 0) {
    body.append(h("p", { class: "muted" }, t.nothing));
  } else {
    const rows: HTMLElement = h("tbody", {});
    for (const item of queue) {
      const actions: HTMLElement = h("td", { class: "actions" });
      if (isStaff(ctx.role)) {
        for (const [label, status, cls] of [[t.approve, "approved", "small ok"], [t.reject, "rejected", "small warn"]] as const) {
          const button: HTMLButtonElement = h("button", { type: "button", class: cls }, label);
          button.addEventListener("click", () => void runAction(t, button, async () => {
            await setStatusById(QUEUE_KIND_TABLE[item.kind], item.id, status);
            await reload();
            showInfo(t.saved);
          }));
          actions.append(button);
        }
      }
      const author: string = item.created_by === null ? "SQL" : (names.get(item.created_by) || shortId(item.created_by));
      rows.append(h("tr", {},
        h("td", {}, h("span", { class: `tag kind-${item.kind}` }, kindLabels[item.kind])),
        h("td", {}, h("a", { href: `#/entry/${item.lemma_id}`, class: "headword" }, item.text)),
        h("td", { class: "muted" }, isStaff(ctx.role) ? author : ""),
        h("td", { class: "muted nowrap" }, formatDateTime(item.created_at)),
        actions,
      ));
    }
    body.append(h("table", { class: "queue" },
      h("thead", {}, h("tr", {},
        h("th", {}, t.fieldKind), h("th", {}, t.fieldText), h("th", {}, t.fieldAuthor),
        h("th", {}, t.fieldDate), h("th", {}),
      )),
      rows,
    ));
  }
}
