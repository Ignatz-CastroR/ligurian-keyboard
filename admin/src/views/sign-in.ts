/*
 * sign-in.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 20:18:59, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Sign in with email and password. There is no sign up:
 *           accounts are created by an admin [admin/README.md].
 * Updated:  2026/10/20, 01:56:10: after signing in, the first page of
 *           the section the form is in: the lexicon manager and the
 *           Users section both use this view [decision 0035].
 */

import type { Context } from "../context.ts";
import { signIn } from "../db.ts";
import { field, h, hideMessage, showError } from "../ui.ts";

export async function renderSignIn(ctx: Context, root: HTMLElement): Promise<void> {
  const { t } = ctx;
  const email: HTMLInputElement = h("input", { type: "email", autocomplete: "username", required: true });
  const password: HTMLInputElement = h("input", { type: "password", autocomplete: "current-password", required: true });
  const submit: HTMLButtonElement = h("button", { type: "submit", class: "primary" }, t.signIn);

  const form: HTMLFormElement = h("form", { class: "card edit-form narrow" },
    h("h2", {}, t.signInTitle),
    h("p", { class: "muted" }, t.signInIntro),
    field(t.fieldEmail, email),
    field(t.fieldPassword, password),
    h("div", { class: "buttons" }, submit),
  );

  form.addEventListener("submit", (event: Event) => {
    event.preventDefault();
    submit.disabled = true;
    hideMessage();
    // On success the session listener in main.ts redraws the page.
    signIn(email.value.trim(), password.value)
      .then(() => ctx.navigate("#/"))
      .catch(() => showError(t.signInFailed))
      .finally(() => {
        submit.disabled = false;
      });
  });

  root.append(form);
  email.focus();
}
