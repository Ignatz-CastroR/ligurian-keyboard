/*
 * grammar-fields.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/21, 12:34:15, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The grammar fields of a form on the page. For a lemma: a
 *           menu for each of gender, number, person, verb form,
 *           conjugation class and auxiliary, a box for invariable and
 *           pronominal, in a group of their own under the part of
 *           speech, shown as the part of speech chosen asks
 *           [grammar.ts]. For one of its forms: a list of readings, each
 *           with its own menus, a reading added or removed with a
 *           button; the base form's first reading is its lemma's, shown
 *           and not edited here.
 * Contract: value[] returns what a save sends: the fields shown with
 *           their values, the others emptied [lemmaPatch[],
 *           readingsPatch[]]. A value the menus do not list [a list not
 *           loaded, or a code added since] is offered as it is, so that
 *           a save keeps it.
 * Decision: docs/decisions/0039-grammar-in-structured-fields.md
 */

import type { Context } from "./context.ts";
import type { Messages } from "./messages.ts";
import {
  afterPosChange, choices, grammarSummary, lemmaFields, lemmaPatch, readingFields, readingsPatch,
  type ChoiceField, type FlagField, type FormField, type GrammarRow, type LemmaField, type LemmaGrammar,
  type Reading,
} from "./grammar.ts";
import { h, select } from "./ui.ts";

// Ids for the readings' titles, unique in the page.
let readingIds: number = 0;

const CHOICE_FIELDS: readonly ChoiceField[] = ["verb_form", "person", "gender", "number", "conjugation", "auxiliary"];
const FORM_FIELD_ORDER: readonly FormField[] = ["verb_form", "person", "gender", "number"];

function fieldLabel(t: Messages, f: LemmaField): string {
  return {
    gender: t.fieldGender, number: t.fieldNumber, person: t.fieldPerson, verb_form: t.fieldVerbForm,
    conjugation: t.fieldConjugation, auxiliary: t.fieldAuxiliary,
    invariable: t.fieldInvariable, pronominal: t.fieldPronominal,
  }[f];
}

// A menu of one list: "not given" first, then the list in its order,
// and the held value as it is if the list does not have it.
function menu(ctx: Context, f: ChoiceField, held: string | null): HTMLSelectElement {
  const items: { value: string; label: string }[] = [{ value: "", label: ctx.t.grammarNone }, ...choices(ctx.lang, f, ctx.refs.grammar)];
  if (held !== null && !items.some((item) => item.value === held)) {
    items.push({ value: held, label: held });
  }
  return select(items, held ?? "");
}

function menuValue(control: HTMLSelectElement | undefined): string | null {
  const value: string = control?.value ?? "";
  return value === "" ? null : value;
}

/* ====================================================================
   A lemma
   ==================================================================== */

export interface LemmaGrammarEditor {
  // The group of fields, to place in a form.
  readonly element: HTMLElement;
  // Show the fields of the part of speech now chosen.
  setPos(pos: string | null): void;
  // What a save sends.
  value(): LemmaGrammar;
}

// held is the lemma as stored, or nothing for a new one; pos its part of
// speech as the form shows it now.
export function lemmaGrammarEditor(ctx: Context, held: GrammarRow, pos: string | null): LemmaGrammarEditor {
  const { t } = ctx;
  const menus: Map<ChoiceField, HTMLSelectElement> = new Map();
  const boxes: Map<FlagField, HTMLInputElement> = new Map();
  const wrappers: Map<LemmaField, HTMLElement> = new Map();
  const element: HTMLElement = h("fieldset", { class: "grammar" },
    h("legend", {}, t.grammarTitle), h("p", { class: "muted" }, t.grammarHint));
  for (const f of ["verb_form", "person", "gender", "number", "invariable", "conjugation", "auxiliary", "pronominal"] as const) {
    if ((CHOICE_FIELDS as readonly string[]).includes(f)) {
      const control: HTMLSelectElement = menu(ctx, f as ChoiceField, (held[f] as string | null | undefined) ?? null);
      menus.set(f as ChoiceField, control);
      wrappers.set(f, h("label", { class: "field" }, h("span", {}, fieldLabel(t, f)), control));
    } else {
      const box: HTMLInputElement = h("input", { type: "checkbox", checked: held[f] === true });
      boxes.set(f as FlagField, box);
      wrappers.set(f, h("label", { class: "check" }, box, fieldLabel(t, f)));
    }
    element.append(wrappers.get(f) as HTMLElement);
  }

  let current: string | null = pos;
  const values = (): LemmaGrammar => ({
    gender: menuValue(menus.get("gender")),
    number: menuValue(menus.get("number")),
    person: menuValue(menus.get("person")),
    verb_form: menuValue(menus.get("verb_form")),
    invariable: boxes.get("invariable")?.checked ?? false,
    conjugation: menuValue(menus.get("conjugation")),
    auxiliary: menuValue(menus.get("auxiliary")),
    pronominal: boxes.get("pronominal")?.checked ?? false,
  });
  const show = (): void => {
    const shown: readonly LemmaField[] = lemmaFields(current, held);
    for (const [f, wrapper] of wrappers) {
      wrapper.hidden = !shown.includes(f);
    }
    element.hidden = shown.length === 0;
  };
  show();
  return {
    element,
    setPos: (next: string | null): void => {
      const changed: LemmaGrammar = afterPosChange(current, next, values(), ctx.refs.grammar);
      const verbForm: HTMLSelectElement | undefined = menus.get("verb_form");
      if (verbForm !== undefined) {
        verbForm.value = changed.verb_form ?? "";
      }
      current = next;
      show();
    },
    value: (): LemmaGrammar => lemmaPatch(current, values(), held),
  };
}

/* ====================================================================
   A form: its readings
   ==================================================================== */

export interface ReadingsEditor {
  readonly element: HTMLElement;
  value(): Reading[];
}

/* held: the form's readings as stored, its lemma's excepted for a base
   form; head: the base form's first reading, its lemma's, or null; pos:
   the lemma's part of speech. A form with no reading yet, not a base
   form, starts with one empty reading, ready to fill. */
export function readingsEditor(ctx: Context, held: readonly Reading[], pos: string | null,
  head: Reading | null = null, isBase: boolean = false): ReadingsEditor {
  const { t } = ctx;
  const shown: readonly FormField[] = readingFields(pos, head === null ? held : [head, ...held]);
  const list: HTMLElement = h("div", { class: "readings" });
  const rows: { element: HTMLElement; menus: Map<FormField, HTMLSelectElement>; title: HTMLElement; remove: HTMLButtonElement }[] = [];
  const first: number = head === null ? 1 : 2;

  // Each block is a group named by its title, and its button says which
  // reading it removes, so that a screen reader tells them apart.
  const renumber = (): void => {
    rows.forEach((row, i) => {
      row.title.textContent = t.grammarReading(first + i);
      row.remove.setAttribute("aria-label", `${t.grammarRemoveReading}: ${t.grammarReading(first + i)}`);
    });
  };

  const addRow = (reading: Reading | null): void => {
    const menus: Map<FormField, HTMLSelectElement> = new Map();
    const id: string = `reading-${++readingIds}`;
    const title: HTMLElement = h("strong", { id });
    const remove: HTMLButtonElement = h("button", { type: "button", class: "small" }, t.grammarRemoveReading);
    const element: HTMLElement = h("div", { class: "reading", role: "group", "aria-labelledby": id },
      h("div", { class: "reading-head" }, title, remove));
    for (const f of FORM_FIELD_ORDER) {
      const control: HTMLSelectElement = menu(ctx, f, reading?.[f] ?? null);
      menus.set(f, control);
      element.append(h("label", { class: "field", hidden: !shown.includes(f) }, h("span", {}, fieldLabel(t, f)), control));
    }
    const row = { element, menus, title, remove };
    remove.addEventListener("click", () => {
      rows.splice(rows.indexOf(row), 1);
      element.remove();
      renumber();
    });
    rows.push(row);
    list.append(element);
    renumber();
  };

  for (const reading of held) {
    addRow(reading);
  }
  if (held.length === 0 && head === null && !isBase) {
    addRow(null);
  }
  const add: HTMLButtonElement = h("button", { type: "button", class: "small" }, t.grammarAddReading);
  add.addEventListener("click", () => addRow(null));

  const element: HTMLElement = h("fieldset", { class: "grammar" },
    h("legend", {}, t.grammarReadings), h("p", { class: "muted" }, t.grammarReadingsHint),
    head !== null && h("p", { class: "reading-lemma" },
      t.grammarLemmaReading(grammarSummary(ctx.lang, t, ctx.refs.grammar, head))),
    list, h("div", { class: "buttons" }, add));

  return {
    element,
    value: (): Reading[] => readingsPatch(pos, rows.map((row) => ({
      gender: menuValue(row.menus.get("gender")),
      number: menuValue(row.menus.get("number")),
      person: menuValue(row.menus.get("person")),
      verb_form: menuValue(row.menus.get("verb_form")),
    })), head === null ? held : [head, ...held], head),
  };
}
