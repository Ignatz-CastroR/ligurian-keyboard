/*
 * ui.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/11, 20:21:41, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Small helpers to build the page without a framework.
 * Contract: Text is always inserted with textContent, never innerHTML,
 *           so a word or a note typed by anyone can never inject markup
 *           or script into another person's page.
 */

import type { Messages } from "./messages.ts";
import type { Role, Status, Tracked, RefItem } from "./types.ts";
import { AppError } from "./db.ts";
import { SPECIAL_LETTERS } from "./forms.ts";

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
    };
    text = known[error.kind] ?? t.errGeneric(error.message);
  } else if (error instanceof Error) {
    text = t.errGeneric(error.message);
  } else {
    text = t.errGeneric(String(error));
  }
  return text;
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
