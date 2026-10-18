/*
 * ui.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 20:21:41, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/18, 09:08:41: the message for a restore refused
 *           because the dictionary is not empty [decision 0031];
 *           downloadText[], moved here from main.ts.
 * Updated:  2026/10/18, 16:24:30: the message for a statement stopped
 *           at the database's time limit.
 * Purpose:  Small helpers to build the page without a framework.
 * Contract: Text is always inserted with textContent, never innerHTML,
 *           so a word or a note typed by anyone can never inject markup
 *           or script into another person's page.
 */

import type { Messages } from "./messages.ts";
import type { Role, Status, Tracked, RefItem } from "./types.ts";
import { AppError } from "./db.ts";
import { enyeUnderOficia, joinedElisions, SPECIAL_LETTERS } from "./forms.ts";

type Child = Node | string | null | undefined | false;
type AttrValue = string | number | boolean | ((event: Event) => void) | undefined;

// h["button", { class: "primary", onclick: save }, "Salva"]
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, AttrValue> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element: HTMLElementTagNameMap[K] = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (typeof value === "function") {
      element.addEventListener(name.replace(/^on/, ""), value);
    } else if (typeof value === "boolean") {
      element.toggleAttribute(name, value);
    } else if (value !== undefined) {
      element.setAttribute(name, String(value));
    }
  }
  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) {
      element.append(child);
    }
  }
  return element;
}

export function clear(element: Element): void {
  element.replaceChildren();
}

// append[] and replaceChildren[] that skip null, undefined and false,
// so that "condition && element" can be passed directly.
export function appendAll(element: Element, ...children: Child[]): void {
  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) {
      element.append(child);
    }
  }
}

export function replaceAll(element: Element, ...children: Child[]): void {
  element.replaceChildren();
  appendAll(element, ...children);
}

/* ====================================================================
   Messages at the top of the page
   ==================================================================== */

let messageBar: HTMLElement | null = null;

export function attachMessageBar(element: HTMLElement): void {
  messageBar = element;
}

export function showInfo(text: string): void {
  showMessage(text, "info");
}

export function showError(text: string): void {
  showMessage(text, "error");
}

export function hideMessage(): void {
  if (messageBar !== null) {
    clear(messageBar);
    messageBar.className = "message";
  }
}

function showMessage(text: string, kind: "info" | "error"): void {
  if (messageBar !== null) {
    messageBar.className = `message ${kind}`;
    messageBar.replaceChildren(text);
    messageBar.setAttribute("role", kind === "error" ? "alert" : "status");
  }
}

// The text a person should read for any failure.
export function describeError(t: Messages, error: unknown): string {
  let text: string;
  if (error instanceof AppError) {
    const known: Record<string, string> = {
      conflict: t.errConflict,
      permission: t.errPermission,
      duplicate: t.errDuplicate,
      parent: t.errParentMissing,
      invalid: t.errInvalidValue,
      notfound: t.errNotFound,
      notempty: t.errNotEmpty,
      timeout: t.errTimeout,
    };
    text = known[error.kind] ?? t.errGeneric(error.message);
  } else if (error instanceof Error) {
    text = t.errGeneric(error.message);
  } else {
    text = t.errGeneric(String(error));
  }
  return text;
}

// Offer a text to the browser as a file to save.
export function downloadText(fileName: string, text: string, mimeType: string): void {
  const url: string = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const anchor: HTMLAnchorElement = h("a", { href: url, download: fileName });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/* ====================================================================
   Labels
   ==================================================================== */

export function statusLabel(t: Messages, status: Status): string {
  const labels: Record<Status, string> = {
    pending: t.statusPending,
    approved: t.statusApproved,
    rejected: t.statusRejected,
  };
  return labels[status];
}

export function roleLabel(t: Messages, role: Role): string {
  const labels: Record<Role, string> = {
    member: t.roleMember,
    contributor: t.roleContributor,
    reviewer: t.roleReviewer,
    admin: t.roleAdmin,
  };
  return labels[role];
}

export function posLabel(t: Messages, pos: string | null): string {
  const labels: Record<string, string> = {
    noun: t.posNoun, verb: t.posVerb, adjective: t.posAdjective, adverb: t.posAdverb,
    pronoun: t.posPronoun, article: t.posArticle, preposition: t.posPreposition,
    conjunction: t.posConjunction, interjection: t.posInterjection, numeral: t.posNumeral,
    proper_noun: t.posProperNoun, other: t.posOther,
  };
  return pos === null ? t.posNone : labels[pos] ?? pos;
}

// A coloured label: approved, pending, rejected or deleted.
export function statusBadge(t: Messages, row: Tracked): HTMLElement {
  let badge: HTMLElement;
  if (row.deleted_at !== null) {
    badge = h("span", { class: "badge deleted" }, t.statusDeleted);
  } else {
    badge = h("span", { class: `badge ${row.status}` }, statusLabel(t, row.status));
  }
  return badge;
}

/* ====================================================================
   Form controls
   ==================================================================== */

export function field(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", {}, label), control);
}

export function select(items: { value: string; label: string }[], selected: string): HTMLSelectElement {
  const element: HTMLSelectElement = h("select", {});
  for (const item of items) {
    element.append(h("option", { value: item.value, selected: item.value === selected }, item.label));
  }
  return element;
}

export function refItems(items: RefItem[]): { value: string; label: string }[] {
  return items.map((i) => ({ value: i.code, label: i.name }));
}

// Buttons that insert the special Ligurian letters at the cursor of the
// given input; with Shift held, the upper case letter.
export function letterPalette(t: Messages, input: HTMLInputElement): HTMLElement {
  const palette: HTMLElement = h("div", { class: "palette", "aria-label": t.palette });
  for (const letter of SPECIAL_LETTERS) {
    palette.append(h("button", {
      type: "button",
      class: "letter",
      tabindex: -1,
      onclick: (event: Event): void => {
        const shifted: boolean = event instanceof MouseEvent && event.shiftKey;
        insertAtCursor(input, shifted ? letter.toUpperCase() : letter);
      },
    }, letter));
  }
  return palette;
}

function insertAtCursor(input: HTMLInputElement, text: string): void {
  const start: number = input.selectionStart ?? input.value.length;
  const end: number = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  input.focus();
  input.setSelectionRange(start + text.length, start + text.length);
  input.dispatchEvent(new Event("input"));
}

// What the manager warns about before saving forms: ñ under the grafîa
// ofiçiâ [decision 0028], and an elided particle joined to a word
// [decision 0029]. The elision check looks only at the forms being
// typed, `fresh`, not at a lemma's forms already saved.
function formProblems(t: Messages, forms: readonly string[], orthography: string, fresh: readonly string[]):
  { warnings: string[]; questions: string[] } {
  const enye: string[] = enyeUnderOficia(forms, orthography);
  const joined: string[] = joinedElisions(fresh);
  return {
    warnings: [
      ...(enye.length > 0 ? [t.warnEnyeOficia(enye.join(", "))] : []),
      ...(joined.length > 0 ? [t.warnElision(joined.join(", "))] : []),
    ],
    questions: [
      ...(enye.length > 0 ? [t.confirmEnyeOficia(enye.join(", "))] : []),
      ...(joined.length > 0 ? [t.confirmElision(joined.join(", "))] : []),
    ],
  };
}

// The warning lines shown under a form; update[] is called whenever a
// form or the spelling system changes.
export function formWarning(t: Messages):
  { element: HTMLElement; update: (forms: readonly string[], orthography: string, fresh?: readonly string[]) => void } {
  const element: HTMLElement = h("div", { class: "form-warnings", hidden: true, role: "status" });
  const update = (forms: readonly string[], orthography: string, fresh: readonly string[] = forms): void => {
    const { warnings } = formProblems(t, forms, orthography, fresh);
    element.hidden = warnings.length === 0;
    element.replaceChildren(...warnings.map((text) => h("p", { class: "warn-text" }, text)));
  };
  return { element, update };
}

// Asked before saving, one question per problem: true when there is
// nothing to warn about or the person confirms every question.
export function confirmForms(t: Messages, forms: readonly string[], orthography: string, fresh: readonly string[] = forms): boolean {
  return formProblems(t, forms, orthography, fresh).questions.every((question) => window.confirm(question));
}

// Run an action from a button: disable it while waiting, report errors.
export async function runAction(t: Messages, button: HTMLButtonElement | null, action: () => Promise<void>): Promise<void> {
  if (button !== null) {
    button.disabled = true;
  }
  try {
    hideMessage();
    await action();
  } catch (error: unknown) {
    showError(describeError(t, error));
  } finally {
    if (button !== null) {
      button.disabled = false;
    }
  }
}
