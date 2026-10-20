/*
 * main.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 02:16:09, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/17, 08:23:03: the language menu, with Spanish.
 * Updated:  2026/10/18, 18:41:15: the header links the dictionary for
 *           readers and, apart, the lexicon manager [decision 0034].
 * Purpose:  The web editor in the browser: load the dictionary snapshot,
 *           watch the text area, apply the decisions of ime.ts, draw the
 *           candidate menu, and offer copy, download and clear.
 * Contract: Every decision is taken in ime.ts; this file only reads the
 *           page and applies Edits. Words are finished by the `input`
 *           event, never by `keydown`, because phone keyboards report
 *           almost every key as code 229. Nothing runs while the phone's
 *           own keyboard is composing a word. Pasted and dropped text is
 *           never converted. Browser storage is optional: every read and
 *           write survives its absence.
 *           Decision: docs/decisions/0020-web-editor-design.md
 */

import "./style.css";
import type { LookupFilter } from "../../engine/src/lexicon.ts";
import { h } from "./dom.ts";
import {
  choose, isKeepEntry, menuLength, moveHighlight, planConversion, planRevert,
  type Applied, type Edit, type Pending, type Plan,
} from "./ime.ts";
import { isLang, LANGUAGES, messagesFor, type Lang, type Messages } from "./messages.ts";
import { readSnapshot, type Snapshot } from "./snapshot.ts";

// Same key as the lexicon manager: one language choice for the site.
const LANG_KEY: string = "ligurian-keyboard.lang";
const DRAFT_KEY: string = "ligurian-keyboard.editor.draft";
const FILTER_KEY: string = "ligurian-keyboard.editor.filter";
const DEFAULT_VARIETY: string = "zeneize";
const DEFAULT_ORTHOGRAPHY: string = "ofiçiâ";
const ALL: string = "";

interface State {
  lang: Lang;
  t: Messages;
  snapshot: Snapshot | null;
  failed: boolean;
  variety: string;
  orthography: string;
  pending: Pending | null;
  applied: Applied | null;
  applying: boolean;
}

/* ---------- storage, optional ---------- */

function readStored(key: string): string | null {
  let value: string | null = null;
  try {
    value = window.localStorage.getItem(key);
  } catch {
    value = null;
  }
  return value;
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked or full: the editor still works, it only forgets.
  }
}

// The stored language when it is one the editor knows; Italian otherwise.
function storedLang(): Lang {
  const stored: string | null = readStored(LANG_KEY);
  return isLang(stored) ? stored : "it";
}

/* ---------- page skeleton ---------- */

const state: State = {
  lang: storedLang(),
  t: messagesFor("it"),
  snapshot: null,
  failed: false,
  variety: DEFAULT_VARIETY,
  orthography: DEFAULT_ORTHOGRAPHY,
  pending: null,
  applied: null,
  applying: false,
};
state.t = messagesFor(state.lang);

const header: HTMLElement = document.querySelector("#header") ?? document.body;
const main: HTMLElement = document.querySelector("#main") ?? document.body;

const textArea: HTMLTextAreaElement = h("textarea", {
  id: "text",
  class: "text",
  rows: 12,
  // Italian spell checkers and autocorrect would "fix" plain ASCII
  // Ligurian into Italian words before it can be converted.
  spellcheck: "false",
  autocorrect: "off",
  autocomplete: "off",
});
const textLabel: HTMLLabelElement = h("label", { for: "text", class: "visually-hidden" });
const menu: HTMLElement = h("div", { id: "candidates", class: "candidates", role: "listbox", hidden: true });
const varietySelect: HTMLSelectElement = h("select", { id: "variety" });
const orthographySelect: HTMLSelectElement = h("select", { id: "orthography" });
const status: HTMLElement = h("p", { class: "status", "aria-live": "polite" });
const notice: HTMLElement = h("p", { class: "notice", "aria-live": "polite" });
const helpText: HTMLElement = h("p", { class: "help" });

/* ---------- applying edits ---------- */

// execCommand keeps the browser's own undo [Ctrl+Z] working; where it
// is unavailable, setRangeText does the same edit without undo history.
function applyToTextArea(edit: Edit): void {
  state.applying = true;
  textArea.setSelectionRange(edit.start, edit.end);
  let done: boolean = false;
  try {
    done = document.execCommand("insertText", false, edit.text);
  } catch {
    done = false;
  }
  if (!done) {
    textArea.setRangeText(edit.text, edit.start, edit.end, "end");
  }
  textArea.setSelectionRange(edit.caret, edit.caret);
  state.applying = false;
  saveDraft();
}

function currentFilter(): LookupFilter {
  const filter: LookupFilter = {};
  if (state.variety !== ALL) {
    filter.variety = state.variety;
  }
  if (state.orthography !== ALL) {
    filter.orthography = state.orthography;
  }
  return filter;
}

/* ---------- the candidate menu ---------- */

function closeMenu(): void {
  state.pending = null;
  menu.hidden = true;
  menu.replaceChildren();
}

// Index of a menu entry: a candidate, or the final "keep as typed".
function pickEntry(index: number): void {
  const pending: Pending | null = state.pending;
  closeMenu();
  if (pending !== null && !isKeepEntry(pending, index)) {
    const result: { edit: Edit; applied: Applied } | null =
      choose(pending, index, textArea.value, textArea.selectionStart);
    if (result !== null) {
      applyToTextArea(result.edit);
      state.applied = result.applied;
    }
  }
}

function drawMenu(): void {
  const pending: Pending | null = state.pending;
  if (pending === null) {
    closeMenu();
  } else {
    const entries: HTMLElement[] = [];
    for (let i: number = 0; i < menuLength(pending); i += 1) {
      const keep: boolean = isKeepEntry(pending, i);
      const label: string = keep ? pending.typed : pending.conversion.candidates[i] ?? "";
      const button: HTMLButtonElement = h("button", {
        type: "button",
        role: "option",
        class: keep ? "candidate keep" : "candidate",
        "aria-selected": i === pending.highlighted ? "true" : "false",
      },
        h("span", { class: "number" }, keep ? "Esc" : String(i + 1)),
        h("span", { class: "word" }, label),
        keep && h("span", { class: "hint" }, state.t.keepTyped),
      );
      // Keep the focus, and the phone keyboard, in the text area.
      button.addEventListener("pointerdown", (event: PointerEvent) => event.preventDefault());
      button.addEventListener("click", () => pickEntry(i));
      entries.push(button);
    }
    menu.setAttribute("aria-label", state.t.menuLabel);
    menu.replaceChildren(...entries);
    menu.hidden = false;
    placeMenu(pending.start);
  }
}

// On a touch screen the menu is a bar above the on-screen keyboard; with
// a mouse and a real keyboard it opens right under the word.
function placeMenu(position: number): void {
  const touch: boolean = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 600;
  menu.classList.toggle("bar", touch);
  menu.style.left = "";
  menu.style.top = "";
  menu.style.bottom = "";
  if (touch) {
    const viewport: VisualViewport | null = window.visualViewport;
    const covered: number = viewport === null ? 0 : Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    menu.style.bottom = `${covered}px`;
  } else {
    const caret: { top: number; left: number; height: number } = caretCoordinates(textArea, position);
    menu.style.left = `${textArea.offsetLeft + caret.left}px`;
    menu.style.top = `${textArea.offsetTop + caret.top + caret.height}px`;
  }
}

// Where a character of the text area is drawn, measured on an invisible
// copy of the text area with the same font, size and wrapping.
function caretCoordinates(area: HTMLTextAreaElement, position: number): { top: number; left: number; height: number } {
  const style: CSSStyleDeclaration = window.getComputedStyle(area);
  const mirror: HTMLDivElement = h("div");
  const copied: readonly string[] = [
    "boxSizing", "width", "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing",
    "lineHeight", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "textTransform", "wordSpacing", "tabSize",
  ];
  for (const property of copied) {
    mirror.style.setProperty(toKebab(property), style.getPropertyValue(toKebab(property)));
  }
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.textContent = area.value.slice(0, position);
  const marker: HTMLSpanElement = h("span", {}, area.value.slice(position) || ".");
  mirror.append(marker);
  document.body.append(mirror);
  const result: { top: number; left: number; height: number } = {
    top: marker.offsetTop - area.scrollTop,
    left: marker.offsetLeft - area.scrollLeft,
    height: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5,
  };
  mirror.remove();
  return result;
}

function toKebab(property: string): string {
  return property.replace(/[A-Z]/g, (letter: string) => `-${letter.toLowerCase()}`);
}

/* ---------- reacting to the text ---------- */

function onInput(event: Event): void {
  if (!state.applying && !(event instanceof InputEvent && event.isComposing)) {
    seenSinceComposition = true;
    react(event instanceof InputEvent ? event.inputType : "");
  }
}

// Some phone keyboards commit "word plus space" while still composing,
// and no ordinary input event follows. When composition ends with no
// such event, react as if the committed text had just been typed.
let seenSinceComposition: boolean = true;

function onCompositionStart(): void {
  seenSinceComposition = false;
}

function onCompositionEnd(): void {
  window.setTimeout(() => {
    if (!seenSinceComposition && !state.applying) {
      seenSinceComposition = true;
      react("insertCompositionText");
    }
  }, 0);
}

function react(inputType: string): void {
  const caret: number = textArea.selectionStart;

  // A menu was open and the user went on: typing accepts the
  // highlighted spelling, as in Japanese input methods; deleting
  // keeps the word as typed.
  const pending: Pending | null = state.pending;
  if (pending !== null) {
    if (inputType.startsWith("delete")) {
      closeMenu();
    } else {
      pickEntry(pending.highlighted);
    }
  }

  const applied: Applied | null = state.applied;
  state.applied = null;
  if (inputType === "deleteContentBackward" && applied !== null) {
    const revert: Edit | null = planRevert(applied, textArea.value, textArea.selectionStart);
    if (revert !== null) {
      applyToTextArea(revert);
    }
  } else if (isTyping(inputType) && state.snapshot !== null && pending === null) {
    const plan: Plan = planConversion(state.snapshot.lexicon, textArea.value, caret, currentFilter());
    if (plan.kind === "replace") {
      applyToTextArea(plan.edit);
      state.applied = plan.applied;
    } else if (plan.kind === "choose") {
      state.pending = plan.pending;
      drawMenu();
    }
  }
  saveDraft();
}

// Typing, including words committed by a phone keyboard; not pasting.
function isTyping(inputType: string): boolean {
  return inputType === "insertText"
    || inputType === "insertLineBreak"
    || inputType === "insertParagraph"
    || inputType === "insertCompositionText"
    || inputType === "insertReplacementText";
}

const NAVIGATION_KEYS: ReadonlySet<string> = new Set<string>([
  "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown",
]);

function onKeyDown(event: KeyboardEvent): void {
  const pending: Pending | null = state.pending;
  if (pending !== null && !event.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const digit: number = /^[1-9]$/.test(event.key) ? Number(event.key) - 1 : -1;
    if (digit >= 0 && digit < pending.conversion.candidates.length) {
      event.preventDefault();
      pickEntry(digit);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      state.pending = moveHighlight(pending, event.key === "ArrowDown" ? 1 : -1);
      drawMenu();
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      pickEntry(state.pending?.highlighted ?? 0);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    } else if (NAVIGATION_KEYS.has(event.key)) {
      closeMenu();
    }
  } else if (NAVIGATION_KEYS.has(event.key) || event.key === "ArrowUp" || event.key === "ArrowDown") {
    // Moving the caret ends the chance to undo the last conversion.
    state.applied = null;
  }
}

function onPointerDown(): void {
  closeMenu();
  state.applied = null;
}

/* ---------- draft, filters, tools ---------- */

let draftTimer: number | undefined;

function saveDraft(): void {
  window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(saveDraftNow, 400);
}

// Also called when the page is hidden or left, so the last keystrokes
// before following a link or closing the tab are never lost.
function saveDraftNow(): void {
  window.clearTimeout(draftTimer);
  writeStored(DRAFT_KEY, textArea.value);
}

function fillSelect(select: HTMLSelectElement, values: string[], chosen: string): string {
  const options: HTMLOptionElement[] = [h("option", { value: ALL }, state.t.allOptions)];
  for (const value of values) {
    options.push(h("option", { value }, value));
  }
  select.replaceChildren(...options);
  const kept: string = chosen === ALL || values.includes(chosen) ? chosen : ALL;
  select.value = kept;
  return kept;
}

// Until the dictionary arrives the lists are empty and disabled, and the
// chosen filter is left untouched, so a slow network cannot reset it.
function drawFilters(): void {
  const snapshot: Snapshot | null = state.snapshot;
  varietySelect.disabled = snapshot === null;
  orthographySelect.disabled = snapshot === null;
  if (snapshot === null) {
    fillSelect(varietySelect, [], ALL);
    fillSelect(orthographySelect, [], ALL);
  } else {
    state.variety = fillSelect(varietySelect, snapshot.varieties, state.variety);
    state.orthography = fillSelect(orthographySelect, snapshot.orthographies, state.orthography);
  }
}

function onFilterChange(): void {
  state.variety = varietySelect.value;
  state.orthography = orthographySelect.value;
  writeStored(FILTER_KEY, JSON.stringify({ variety: state.variety, orthography: state.orthography }));
  closeMenu();
  textArea.focus();
}

function loadFilter(): void {
  const stored: string | null = readStored(FILTER_KEY);
  if (stored !== null) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed === "object" && parsed !== null && "variety" in parsed && "orthography" in parsed) {
        const variety: unknown = parsed.variety;
        const orthography: unknown = parsed.orthography;
        if (typeof variety === "string" && typeof orthography === "string") {
          state.variety = variety;
          state.orthography = orthography;
        }
      }
    } catch {
      // A damaged setting is simply ignored.
    }
  }
}

function showNotice(text: string): void {
  notice.textContent = text;
  window.setTimeout(() => {
    if (notice.textContent === text) {
      notice.textContent = "";
    }
  }, 4000);
}

async function copyText(): Promise<void> {
  let copied: boolean = false;
  try {
    await navigator.clipboard.writeText(textArea.value);
    copied = true;
  } catch {
    textArea.select();
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
  }
  showNotice(copied ? state.t.copied : state.t.copyFailed);
}

function downloadText(): void {
  const url: string = URL.createObjectURL(new Blob([textArea.value], { type: "text/plain;charset=utf-8" }));
  const anchor: HTMLAnchorElement = h("a", { href: url, download: state.t.downloadName });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function clearText(): void {
  if (textArea.value === "" || window.confirm(state.t.confirmClear)) {
    closeMenu();
    state.applied = null;
    textArea.value = "";
    writeStored(DRAFT_KEY, "");
    textArea.focus();
  }
}

/* ---------- drawing the page ---------- */

function drawStatus(): void {
  const snapshot: Snapshot | null = state.snapshot;
  if (snapshot !== null) {
    status.textContent = state.t.ready(snapshot.lexicon.size, snapshot.takenAt);
  } else if (state.failed) {
    status.textContent = state.t.unavailable;
  } else {
    status.textContent = state.t.loading;
  }
}

function drawPage(): void {
  const { t } = state;
  document.documentElement.lang = state.lang;
  document.title = t.appTitle;

  const langMenu: HTMLSelectElement = h("select", { class: "small", "aria-label": t.langLabel, title: t.langLabel });
  for (const language of LANGUAGES) {
    langMenu.append(h("option", { value: language.code, lang: language.code, selected: language.code === state.lang },
      language.name));
  }
  langMenu.addEventListener("change", () => {
    if (isLang(langMenu.value)) {
      state.lang = langMenu.value;
      state.t = messagesFor(state.lang);
      writeStored(LANG_KEY, state.lang);
      closeMenu();
      drawPage();
    }
  });

  header.replaceChildren(
    h("div", { class: "brand" },
      h("span", { class: "brand-title" }, t.appTitle),
      h("span", { class: "muted" }, t.appSubtitle)),
    h("nav", {},
      h("a", { href: "./tastiera/", class: "nav-link" }, t.navKeyboard),
      h("a", { href: "./dizionario/", class: "nav-link" }, t.navDictionary),
      h("a", { href: "./admin/", class: "nav-link" }, t.navManager)),
    h("div", { class: "tools" }, langMenu),
  );

  const copyButton: HTMLButtonElement = h("button", { type: "button" }, t.copy);
  copyButton.addEventListener("click", () => void copyText());
  const downloadButton: HTMLButtonElement = h("button", { type: "button" }, t.download);
  downloadButton.addEventListener("click", downloadText);
  const clearButton: HTMLButtonElement = h("button", { type: "button", class: "danger" }, t.clear);
  clearButton.addEventListener("click", clearText);

  textLabel.textContent = t.textLabel;
  textArea.placeholder = t.placeholder;
  helpText.textContent = t.help;
  drawFilters();
  drawStatus();

  main.replaceChildren(
    h("div", { class: "toolbar" },
      h("label", { class: "field" }, t.varietyLabel, varietySelect),
      h("label", { class: "field" }, t.orthographyLabel, orthographySelect),
      h("span", { class: "spacer" }),
      copyButton, downloadButton, clearButton),
    h("div", { class: "editor" }, textLabel, textArea, menu),
    notice,
    status,
    helpText,
  );
}

async function loadDictionary(): Promise<void> {
  try {
    const response: Response = await fetch("./lexicon.tsv", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    state.snapshot = readSnapshot(await response.text());
  } catch {
    state.failed = true;
  }
  drawFilters();
  drawStatus();
}

/* ---------- start ---------- */

loadFilter();
textArea.value = readStored(DRAFT_KEY) ?? "";
textArea.addEventListener("input", onInput);
textArea.addEventListener("compositionstart", onCompositionStart);
textArea.addEventListener("compositionend", onCompositionEnd);
textArea.addEventListener("keydown", onKeyDown);
textArea.addEventListener("pointerdown", onPointerDown);
textArea.addEventListener("blur", closeMenu);
varietySelect.addEventListener("change", onFilterChange);
orthographySelect.addEventListener("change", onFilterChange);
window.addEventListener("pagehide", saveDraftNow);
document.addEventListener("visibilitychange", saveDraftNow);
window.visualViewport?.addEventListener("resize", () => {
  if (state.pending !== null) {
    placeMenu(state.pending.start);
  }
});

drawPage();
void loadDictionary();

// Offline use after the first visit, only in the published build.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => undefined);
}
