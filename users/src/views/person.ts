/*
 * person.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 02:06:50, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  One person's complete history: how many changes of each
 *           kind, then every change, the latest first, with its date
 *           and time to the second, what it was, the entry it belongs
 *           to [a link to the lexicon manager], the status it left and,
 *           for an edit, the fields it changed. A hundred changes a
 *           page, and "Show more" until the first one.
 * Contract: The database decides who may read whose history [migration
 *           0011]: reviewers and admins anyone's, everyone else their
 *           own; a refusal is shown as the manager shows it.
 * Decision: docs/decisions/0035-site-in-five-sections.md
 */

import type { Context } from "../../../admin/src/context.ts";
import type { LexiconTable, Profile } from "../../../admin/src/types.ts";
import { HISTORY_PAGE, profiles, userHistory, userSummary, type Change, type ChangeCount } from "../../../admin/src/db.ts";
import { isStaff } from "../../../admin/src/permissions.ts";
import { formatDateTime, shortId } from "../../../admin/src/forms.ts";
import { describeError, h, runAction, statusLabel } from "../../../admin/src/ui.ts";
import type { UserMessages } from "../messages.ts";
import { describeChange, entryHref, routeHash } from "../model.ts";
import { formatCount } from "../../../site/sections.ts";

export async function renderPerson(ctx: Context, u: UserMessages, root: HTMLElement, userId: string | null): Promise<void> {
  const { t } = ctx;
  const name: string = await personName(ctx, u, userId);
  document.title = `${u.personTitle(name)} · ${u.appTitle}`;
  root.append(
    h("nav", { class: "breadcrumb", "aria-label": u.personPath },
      h("a", { href: routeHash({ view: "people" }) }, u.appTitle),
      h("span", { class: "muted", "aria-hidden": "true" }, " › "),
      h("span", { "aria-current": "page" }, name)),
    h("h1", {}, u.personTitle(name)));

  const summary: HTMLElement = h("section", { class: "card" }, h("h2", {}, u.summaryTitle), h("p", { class: "muted" }, t.loading));
  const history: HTMLElement = h("section", { class: "card" }, h("h2", {}, u.historyTitle));
  root.append(summary, history);

  const body: HTMLElement = h("tbody", {});
  const shown: HTMLElement = h("p", { class: "muted" });
  const more: HTMLButtonElement = h("button", { type: "button" }, u.historyMore);
  const end: HTMLElement = h("p", { class: "muted" }, u.historyEnd);
  end.hidden = true;
  let count: number = 0;
  let last: number | null = null;

  const load = async (): Promise<void> => {
    const page: Change[] = await userHistory(userId, last);
    for (const change of page) {
      body.append(changeRow(ctx, u, change));
    }
    count += page.length;
    last = page.at(-1)?.id ?? last;
    shown.textContent = u.historyShown(formatCount(ctx.lang, count));
    // A short page is the last one.
    more.hidden = page.length < HISTORY_PAGE;
    end.hidden = !more.hidden || count === 0;
  };
  more.addEventListener("click", () => void runAction(t, more, load));

  try {
    const [counts] = await Promise.all([userSummary(userId), load()]);
    summary.replaceChildren(h("h2", {}, u.summaryTitle), summaryTable(ctx, u, counts));
    history.append(shown,
      h("div", { class: "table-scroll" }, h("table", { class: "queue history-table" },
        h("thead", {}, h("tr", {},
          h("th", {}, u.colWhen), h("th", {}, u.colWhat), h("th", {}, u.colKind), h("th", {}, u.colItem),
          h("th", {}, u.colStatus), h("th", {}, u.colFields))),
        body)),
      h("div", { class: "more" }, more), end);
  } catch (error: unknown) {
    summary.replaceChildren(h("h2", {}, u.summaryTitle), h("p", { class: "error-text" }, describeError(t, error)));
    history.hidden = true;
  }
}

// The person's display name: their own from the session, anyone's for
// staff, the SQL Editor by its name.
async function personName(ctx: Context, u: UserMessages, userId: string | null): Promise<string> {
  let name: string = userId === null ? u.sqlEditor : shortId(userId);
  if (userId !== null && userId === ctx.userId && ctx.profile !== null) {
    name = ctx.profile.display_name || name;
  } else if (userId !== null && isStaff(ctx.role)) {
    try {
      const found: Profile | undefined = (await profiles()).find((p) => p.user_id === userId);
      name = found?.display_name || (found === undefined ? `${name} [${u.noProfile}]` : name);
    } catch {
      // The short id is enough to tell people apart.
    }
  }
  return name;
}

function summaryTable(ctx: Context, u: UserMessages, counts: readonly ChangeCount[]): HTMLElement {
  const total: number = counts.reduce((sum, c) => sum + c.changes, 0);
  let result: HTMLElement;
  if (total === 0) {
    result = h("p", { class: "muted" }, u.summaryNone);
  } else {
    const first: string = counts.map((c) => c.first_change).sort()[0] ?? "";
    const last: string = counts.map((c) => c.last_change).sort().at(-1) ?? "";
    const rows: HTMLElement = h("tbody", {});
    for (const c of counts) {
      rows.append(h("tr", {},
        h("td", { "data-label": u.colKind }, u.kinds[c.table_name] ?? c.table_name),
        h("td", { "data-label": u.colWhat }, u.verbs[c.action] ?? c.action),
        h("td", { class: "number", "data-label": u.colChanges }, formatCount(ctx.lang, c.changes))));
    }
    result = h("div", {},
      h("p", {}, h("strong", {}, u.summaryTotal(formatCount(ctx.lang, total))), " ",
        h("span", { class: "muted" }, u.summaryRange(formatDateTime(first), formatDateTime(last)))),
      h("table", { class: "queue compact" },
        h("thead", {}, h("tr", {}, h("th", {}, u.colKind), h("th", {}, u.colWhat), h("th", {}, u.colChanges))),
        rows));
  }
  return result;
}

function changeRow(ctx: Context, u: UserMessages, change: Change): HTMLElement {
  const described = describeChange(change);
  const href: string | null = entryHref(change.lemma_id);
  const label: string = change.label ?? `#${change.row_id}`;
  const kind: string = u.kinds[change.table_name as LexiconTable] ?? change.table_name;
  return h("tr", {},
    h("td", { class: "nowrap mono", "data-label": u.colWhen }, formatDateTime(change.at)),
    h("td", { "data-label": u.colWhat }, h("strong", {}, u.verbs[described.verb])),
    h("td", { "data-label": u.colKind }, kind),
    h("td", { "data-label": u.colItem, lang: change.table_name === "glosses" || change.table_name === "senses" ? undefined : "lij" },
      href === null ? label : h("a", { href, title: u.openEntry }, label)),
    h("td", { "data-label": u.colStatus }, change.status === null ? "" : statusLabel(ctx.t, change.status)),
    h("td", { class: "muted", "data-label": u.colFields }, described.fields.join(", ")));
}
