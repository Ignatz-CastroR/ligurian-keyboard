/*
 * users.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 20:18:50, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Everyone edits their own display name. Reviewers see the
 *           list of people; admins also rename them and change roles.
 * Contract: The database refuses self promotion and the demotion of
 *           the last admin [0002]; this page only reports its answer.
 */

import type { Context } from "../context.ts";
import type { Profile, Role } from "../types.ts";
import { ROLES } from "../types.ts";
import { profiles, updateProfile } from "../db.ts";
import { canManageRoles, isStaff } from "../permissions.ts";
import { formatDateTime } from "../forms.ts";
import { describeError, field, h, roleLabel, runAction, select, showError, showInfo } from "../ui.ts";

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
