/*
 * people.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 02:03:30, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The first page of the Users section. Everyone signed in
 *           edits their own display name and opens their own complete
 *           history. Reviewers and admins also see every person, with
 *           their role, how many changes they made and when the last
 *           one was, and open anyone's history, the changes written
 *           from the SQL Editor included; admins also rename people and
 *           change roles. Formerly the users page of the lexicon
 *           manager [admin/src/views/users.ts until 0.12.1].
 * Contract: The database refuses self promotion and the demotion of
 *           the last admin [0002], and shows each person only what
 *           migration 0011 allows; this page only reports its answers.
 * Decision: docs/decisions/0035-site-in-five-sections.md
 */

import type { Context } from "../../../admin/src/context.ts";
import type { Profile, Role } from "../../../admin/src/types.ts";
import { ROLES } from "../../../admin/src/types.ts";
import { peopleActivity, profiles, updateProfile, type Activity } from "../../../admin/src/db.ts";
import { canManageRoles, isStaff } from "../../../admin/src/permissions.ts";
import { formatDateTime, shortId } from "../../../admin/src/forms.ts";
import { formatCount } from "../../../site/sections.ts";
import { describeError, field, h, roleLabel, runAction, select, showError, showInfo } from "../../../admin/src/ui.ts";
import type { UserMessages } from "../messages.ts";
import { routeHash } from "../model.ts";

const MAX_NAME: number = 80;

export async function renderPeople(ctx: Context, u: UserMessages, root: HTMLElement): Promise<void> {
  const { t } = ctx;
  if (ctx.userId === null || ctx.profile === null) {
    root.append(h("section", { class: "card" },
      h("p", {}, u.signInPrompt),
      h("p", {}, h("a", { href: routeHash({ view: "signin" }), class: "button-link" }, t.signIn))));
  } else {
    root.append(accountCard(ctx, ctx.profile),
      h("p", {}, h("a", { href: routeHash({ view: "person", userId: ctx.userId }), class: "button-link" }, `${u.myHistory} →`)));
    if (isStaff(ctx.role)) {
      const list: HTMLElement = h("div", {}, h("p", { class: "muted" }, t.loading));
      root.append(h("section", { class: "card" },
        h("h2", {}, u.peopleTitle), h("p", { class: "muted" }, u.peopleIntro), list));
      try {
        const [people, activity] = await Promise.all([profiles(), peopleActivity()]);
        drawPeople(ctx, u, list, people, activity);
      } catch (error: unknown) {
        list.replaceChildren(h("p", { class: "error-text" }, describeError(t, error)));
      }
    }
  }
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

/* Everyone with a profile, then anyone in the history without one [an
   account deleted since], then the SQL Editor's changes, each with
   their count and a link to their history. */
function drawPeople(ctx: Context, u: UserMessages, target: HTMLElement, people: Profile[], activity: Activity[]): void {
  const { t } = ctx;
  const admin: boolean = canManageRoles(ctx.role);
  const rows: HTMLElement = h("tbody", {});
  const byUser: Map<string | null, Activity> = new Map(activity.map((a) => [a.user_id, a]));
  const counts = (who: string | null): HTMLElement[] => {
    const found: Activity | undefined = byUser.get(who);
    return [
      h("td", { class: "number", "data-label": u.colChanges }, formatCount(ctx.lang, found?.changes ?? 0)),
      h("td", { class: "muted nowrap", "data-label": u.colLastChange }, found === undefined ? "" : formatDateTime(found.last_change)),
      h("td", {}, h("a", { href: routeHash({ view: "person", userId: who }) }, u.openHistory)),
    ];
  };

  for (const person of people) {
    const isMe: boolean = person.user_id === ctx.userId;
    const name: HTMLInputElement = h("input", { type: "text", value: person.display_name, maxlength: MAX_NAME, disabled: !admin,
      "aria-label": t.fieldDisplayName });
    const role: HTMLSelectElement = select(ROLES.map((r) => ({ value: r, label: roleLabel(t, r) })), person.role);
    role.setAttribute("aria-label", `${t.fieldRole}: ${person.display_name}`);
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
      ...counts(person.user_id),
      h("td", { class: "muted mono", title: person.user_id, "data-label": t.fieldUserId }, shortId(person.user_id)),
      h("td", {}, admin && saveButton),
    ));
  }

  const known: Set<string> = new Set(people.map((p) => p.user_id));
  for (const other of activity) {
    if (other.user_id === null || !known.has(other.user_id)) {
      rows.append(h("tr", {},
        h("td", {}, other.user_id === null
          ? h("span", { title: u.sqlEditorNote }, u.sqlEditor)
          : h("span", { class: "muted" }, other.display_name ?? u.noProfile)),
        h("td", {}),
        ...counts(other.user_id),
        h("td", { class: "muted mono", title: other.user_id ?? "" }, other.user_id === null ? "" : shortId(other.user_id)),
        h("td", {}),
      ));
    }
  }

  target.replaceChildren(h("div", { class: "table-scroll" }, h("table", { class: "queue" },
    h("thead", {}, h("tr", {},
      h("th", {}, t.fieldDisplayName), h("th", {}, t.fieldRole), h("th", {}, u.colChanges),
      h("th", {}, u.colLastChange), h("th", {}), h("th", {}, t.fieldUserId), h("th", {}),
    )),
    rows,
  )));
}
