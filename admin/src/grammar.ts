/*
 * grammar.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/21, 12:26:04, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The grammar of lemmas and forms, apart from the page: which
 *           fields each part of speech shows, the values a save sends
 *           [the fields not shown emptied], a form's list of readings,
 *           the name of each value in the interface's language, and the
 *           one line that sums a row's grammar up. Pure functions, no
 *           DOM, tested in Node.
 * Contract: Mirrors migration 0013. A lemma has one reading, its
 *           headword's, and the verb's own properties; a form has a list
 *           of readings, since one spelling may stand for several; the
 *           base form's first reading is its lemma's. The values come
 *           from the database's lists [GrammarLists]: a value added there
 *           by an insert appears here with its Italian name, once the
 *           manager is loaded again, until it is given names in
 *           GRAMMAR_NAMES. Conjugation classes and auxiliaries are
 *           Ligurian words, shown as they are written. Which field a part
 *           of speech shows is a choice of the interface; the database
 *           accepts any value on any row, but conjugation class,
 *           auxiliary and pronominal only on a verb. A field that already
 *           holds a value is shown whatever the part of speech [the
 *           verb's own three excepted], so that no save empties a value
 *           nobody saw.
 * Decision: docs/decisions/0039-grammar-in-structured-fields.md
 */

import type { Lang } from "./messages.ts";

// One value of a list: its code, its Italian name, its place in menus.
export interface GrammarValue {
  code: string;
  name: string;
  position: number;
}

export interface GrammarLists {
  genders: GrammarValue[];
  numbers: GrammarValue[];
  persons: GrammarValue[];
  verbForms: GrammarValue[];
  conjugations: GrammarValue[];
  auxiliaries: GrammarValue[];
}

export const EMPTY_LISTS: GrammarLists = {
  genders: [], numbers: [], persons: [], verbForms: [], conjugations: [], auxiliaries: [],
};

// One reading: the gender, number, person and verb form a spelling
// stands for. A lemma's headword has one; a form, a list of them.
export interface FormGrammar {
  gender: string | null;
  number: string | null;
  person: string | null;
  verb_form: string | null;
}

export type Reading = FormGrammar;

// A lemma's: its headword's reading, and what belongs to the lemma as a whole.
export interface LemmaGrammar extends FormGrammar {
  invariable: boolean;
  conjugation: string | null;
  auxiliary: string | null;
  pronominal: boolean;
}

// Any row that carries some grammar, as the database returns it: a field
// may be missing, or null where the row has none [the review queue's].
export type GrammarRow = { [K in keyof LemmaGrammar]?: LemmaGrammar[K] | null };

export type FormField = keyof FormGrammar;
export type LemmaField = keyof LemmaGrammar;
export type ChoiceField = "gender" | "number" | "person" | "verb_form" | "conjugation" | "auxiliary";
export type FlagField = "invariable" | "pronominal";

export const NO_FORM_GRAMMAR: FormGrammar = { gender: null, number: null, person: null, verb_form: null };
export const NO_LEMMA_GRAMMAR: LemmaGrammar = {
  ...NO_FORM_GRAMMAR, invariable: false, conjugation: null, auxiliary: null, pronominal: false,
};

const ALL_FORM_FIELDS: readonly FormField[] = ["gender", "number", "person", "verb_form"];

/* The fields of a lemma, by its part of speech. A noun's gender and
   number are its headword's; an adjective's lemma is usually masculine
   singular, but may be any; a verb's lemma is its infinitive, with its
   conjugation class, auxiliary and whether it is pronominal. With no
   part of speech, or "other", every field of a form is offered; words
   that do not inflect offer none. */
const LEMMA_FIELDS: Readonly<Record<string, readonly LemmaField[]>> = {
  noun: ["gender", "number", "invariable"],
  proper_noun: ["gender", "number", "invariable"],
  adjective: ["gender", "number", "invariable"],
  numeral: ["gender", "number", "invariable"],
  article: ["gender", "number"],
  pronoun: ["person", "gender", "number"],
  determiner: ["person", "gender", "number"],
  verb: ["verb_form", "conjugation", "auxiliary", "pronominal"],
  adverb: [],
  preposition: [],
  conjunction: [],
  interjection: [],
  other: ALL_FORM_FIELDS,
};

/* The fields of each reading of a lemma's forms, by the lemma's part of
   speech. A word that does not inflect may still have forms of its own
   [a contracted preposition, say]: every field is offered for them. */
const FORM_FIELDS: Readonly<Record<string, readonly FormField[]>> = {
  noun: ["gender", "number"],
  proper_noun: ["gender", "number"],
  adjective: ["gender", "number"],
  numeral: ["gender", "number"],
  article: ["gender", "number"],
  pronoun: ["person", "gender", "number"],
  determiner: ["person", "gender", "number"],
  verb: ["verb_form", "person", "gender", "number"],
  adverb: ALL_FORM_FIELDS,
  preposition: ALL_FORM_FIELDS,
  conjunction: ALL_FORM_FIELDS,
  interjection: ALL_FORM_FIELDS,
  other: ALL_FORM_FIELDS,
};

// Whether a part of speech has its fields decided here, rather than
// falling back to every field; every part the manager offers must.
export function fieldsDecided(pos: string): boolean {
  return Object.hasOwn(LEMMA_FIELDS, pos) && Object.hasOwn(FORM_FIELDS, pos);
}

// A table's own entry for a part of speech, never an inherited property.
function ownFields<F>(table: Readonly<Record<string, readonly F[]>>, pos: string | null): readonly F[] | undefined {
  const key: string = pos ?? "other";
  return Object.hasOwn(table, key) ? table[key] : undefined;
}

// The order fields are shown in, the same as the summary's.
const LEMMA_ORDER: readonly LemmaField[] = [
  "verb_form", "person", "gender", "number", "invariable", "conjugation", "auxiliary", "pronominal",
];
const FORM_ORDER: readonly FormField[] = ["verb_form", "person", "gender", "number"];

// A verb's own: the database refuses them on any other word.
const VERB_ONLY: readonly LemmaField[] = ["conjugation", "auxiliary", "pronominal"];

function given(held: GrammarRow, f: LemmaField): boolean {
  const value: unknown = held[f];
  return value !== undefined && value !== null && value !== false;
}

/* The fields a lemma shows: those of its part of speech, and any other
   that already holds a value [written by a template, or kept from
   another part of speech], so that a save never empties a value nobody
   saw. Not a verb's own fields, which only a verb may hold. */
export function lemmaFields(pos: string | null, held: GrammarRow = {}): readonly LemmaField[] {
  const own: readonly LemmaField[] = ownFields(LEMMA_FIELDS, pos) ?? ALL_FORM_FIELDS;
  return LEMMA_ORDER.filter((f) => own.includes(f) || (given(held, f) && !VERB_ONLY.includes(f)));
}

/* The fields every reading of a form shows: those of the lemma's part of
   speech, and any that one of the form's readings already holds. */
export function readingFields(pos: string | null, held: readonly Reading[] = []): readonly FormField[] {
  const own: readonly FormField[] = ownFields(FORM_FIELDS, pos) ?? ALL_FORM_FIELDS;
  return FORM_ORDER.filter((f) => own.includes(f) || held.some((r) => given(r, f)));
}

/* What a save of a lemma sends: the values of the fields it shows,
   every other field emptied, so that a lemma whose part of speech
   changed keeps nothing it no longer shows, and the database's rule on
   verbs always holds. "held" is what the row held before the edit. */
export function lemmaPatch(pos: string | null, values: LemmaGrammar, held: GrammarRow = {}): LemmaGrammar {
  const shown: readonly LemmaField[] = lemmaFields(pos, held);
  return {
    gender: shown.includes("gender") ? values.gender : null,
    number: shown.includes("number") ? values.number : null,
    person: shown.includes("person") ? values.person : null,
    verb_form: shown.includes("verb_form") ? values.verb_form : null,
    invariable: shown.includes("invariable") ? values.invariable : false,
    conjugation: shown.includes("conjugation") ? values.conjugation : null,
    auxiliary: shown.includes("auxiliary") ? values.auxiliary : null,
    pronominal: shown.includes("pronominal") ? values.pronominal : false,
  };
}

function isEmpty(r: Reading): boolean {
  return r.gender === null && r.number === null && r.person === null && r.verb_form === null;
}

function sameReading(a: Reading, b: Reading): boolean {
  return a.gender === b.gender && a.number === b.number && a.person === b.person && a.verb_form === b.verb_form;
}

/* What a save of a form sends: its readings as edited, each with the
   fields shown and the others emptied, a reading left with no value
   dropped, a repeated one kept once, in their order. A base form's
   first reading, its lemma's ["head"], is sent first and unchanged. */
export function readingsPatch(pos: string | null, edited: readonly Reading[], held: readonly Reading[] = [],
  head: Reading | null = null): Reading[] {
  const shown: readonly FormField[] = readingFields(pos, held);
  const out: Reading[] = head === null ? [] : [head];
  for (const r of edited) {
    const kept: Reading = {
      gender: shown.includes("gender") ? r.gender : null,
      number: shown.includes("number") ? r.number : null,
      person: shown.includes("person") ? r.person : null,
      verb_form: shown.includes("verb_form") ? r.verb_form : null,
    };
    if (!isEmpty(kept) && !out.some((o) => sameReading(o, kept))) {
      out.push(kept);
    }
  }
  return out;
}

/* A part of speech chosen in a lemma's form. A lemma that becomes a
   verb with no verb form is given the infinitive, its lemma's form, if
   the list holds it; one that stops being a verb loses the infinitive,
   which only a verb's lemma is. Nothing else changes. */
export function afterPosChange(previous: string | null, next: string | null, values: LemmaGrammar,
  lists: GrammarLists): LemmaGrammar {
  const hasInfinitive: boolean = lists.verbForms.some((v) => v.code === "inf");
  if (next === "verb" && previous !== "verb" && values.verb_form === null && hasInfinitive) {
    return { ...values, verb_form: "inf" };
  }
  if (previous === "verb" && next !== "verb" && values.verb_form === "inf") {
    return { ...values, verb_form: null };
  }
  return values;
}

export function lemmaGrammarOf(row: GrammarRow): LemmaGrammar {
  return {
    gender: row.gender ?? null,
    number: row.number ?? null,
    person: row.person ?? null,
    verb_form: row.verb_form ?? null,
    invariable: row.invariable ?? false,
    conjugation: row.conjugation ?? null,
    auxiliary: row.auxiliary ?? null,
    pronominal: row.pronominal ?? false,
  };
}

export function formGrammarOf(row: GrammarRow): FormGrammar {
  return { gender: row.gender ?? null, number: row.number ?? null, person: row.person ?? null, verb_form: row.verb_form ?? null };
}

// A lemma's own reading, as its base form holds it first; null if none.
export function lemmaReading(lemma: GrammarRow): Reading | null {
  const r: Reading = formGrammarOf(lemma);
  return isEmpty(r) ? null : r;
}

// A form's readings as the database returns them; anything else is none.
export function readingsOf(value: unknown): Reading[] {
  return Array.isArray(value)
    ? value.filter((r): r is GrammarRow => typeof r === "object" && r !== null).map(formGrammarOf).filter((r) => !isEmpty(r))
    : [];
}

/* A base form's readings, split into its lemma's [first, when the lemma
   has a reading] and the others, which are its own to edit. */
export function splitBaseReadings(readings: readonly Reading[], head: Reading | null): Reading[] {
  return head !== null && readings.length > 0 && sameReading(readings[0] as Reading, head) ? readings.slice(1) : [...readings];
}

/* ====================================================================
   Names
   ==================================================================== */

type NamedFeature = "gender" | "number" | "person" | "verb_form";

/* The general categories, named in the interface's three languages.
   Conjugation classes and auxiliaries are Ligurian words, shown as the
   database writes them. A code missing here is shown with the Italian
   name its list gives it. */
export const GRAMMAR_NAMES: Readonly<Record<Lang, Readonly<Record<NamedFeature, Readonly<Record<string, string>>>>>> = {
  it: {
    gender: { m: "maschile", f: "femminile", mf: "maschile e femminile" },
    number: { sg: "singolare", pl: "plurale" },
    person: { "1": "prima persona", "2": "seconda persona", "3": "terza persona" },
    verb_form: {
      inf: "infinito", ptcp_pres: "participio presente", ptcp_past: "participio passato", ger: "gerundio",
      ind_pres: "indicativo presente", ind_impf: "indicativo imperfetto", ind_past: "passato remoto",
      ind_fut: "indicativo futuro", cond: "condizionale", subj_pres: "congiuntivo presente",
      subj_impf: "congiuntivo imperfetto", imp: "imperativo",
    },
  },
  en: {
    gender: { m: "masculine", f: "feminine", mf: "masculine and feminine" },
    number: { sg: "singular", pl: "plural" },
    person: { "1": "first person", "2": "second person", "3": "third person" },
    verb_form: {
      inf: "infinitive", ptcp_pres: "present participle", ptcp_past: "past participle", ger: "gerund",
      ind_pres: "present indicative", ind_impf: "imperfect indicative", ind_past: "past historic",
      ind_fut: "future indicative", cond: "conditional", subj_pres: "present subjunctive",
      subj_impf: "imperfect subjunctive", imp: "imperative",
    },
  },
  es: {
    gender: { m: "masculino", f: "femenino", mf: "masculino y femenino" },
    number: { sg: "singular", pl: "plural" },
    person: { "1": "primera persona", "2": "segunda persona", "3": "tercera persona" },
    verb_form: {
      inf: "infinitivo", ptcp_pres: "participio presente", ptcp_past: "participio pasado", ger: "gerundio",
      ind_pres: "presente de indicativo", ind_impf: "pretérito imperfecto de indicativo",
      ind_past: "pretérito perfecto simple", ind_fut: "futuro de indicativo", cond: "condicional",
      subj_pres: "presente de subjuntivo", subj_impf: "pretérito imperfecto de subjuntivo", imp: "imperativo",
    },
  },
};

const LIST_OF: Readonly<Record<ChoiceField, keyof GrammarLists>> = {
  gender: "genders", number: "numbers", person: "persons", verb_form: "verbForms",
  conjugation: "conjugations", auxiliary: "auxiliaries",
};

export function listFor(field: ChoiceField, lists: GrammarLists): GrammarValue[] {
  return lists[LIST_OF[field]];
}

// A value's name in the interface's language.
export function valueName(lang: Lang, field: ChoiceField, code: string, lists: GrammarLists): string {
  const names: Readonly<Record<string, string>> | undefined = field === "conjugation" || field === "auxiliary"
    ? undefined
    : GRAMMAR_NAMES[lang][field];
  // Own names only: a code such as "constructor" is no name of ours.
  const named: string | undefined = names !== undefined && Object.hasOwn(names, code) ? names[code] : undefined;
  return named ?? listFor(field, lists).find((v) => v.code === code)?.name ?? code;
}

// The menu's choices of a field, in the list's order.
export function choices(lang: Lang, field: ChoiceField, lists: GrammarLists): { value: string; label: string }[] {
  return [...listFor(field, lists)]
    .sort((a, b) => a.position - b.position)
    .map((v) => ({ value: v.code, label: valueName(lang, field, v.code, lists) }));
}

export interface SummaryTexts {
  grammarInvariable: string;
  grammarPronominal: string;
  grammarConjugation: (name: string) => string;
  grammarAuxiliary: (name: string) => string;
  grammarAlso: (readings: string) => string;
}

/* One line for a row's grammar, in a fixed order, the values given
   only: "femminile, singolare, invariabile"; "infinito, coniugazione
   -â, ausiliare avéi, pronominale". Empty when nothing is given. */
export function grammarSummary(lang: Lang, t: SummaryTexts, lists: GrammarLists, g: GrammarRow): string {
  const parts: string[] = [];
  if (g.verb_form) {
    parts.push(valueName(lang, "verb_form", g.verb_form, lists));
  }
  if (g.person) {
    parts.push(valueName(lang, "person", g.person, lists));
  }
  if (g.gender) {
    parts.push(valueName(lang, "gender", g.gender, lists));
  }
  if (g.number) {
    parts.push(valueName(lang, "number", g.number, lists));
  }
  if (g.invariable) {
    parts.push(t.grammarInvariable);
  }
  if (g.conjugation) {
    parts.push(t.grammarConjugation(valueName(lang, "conjugation", g.conjugation, lists)));
  }
  if (g.auxiliary) {
    parts.push(t.grammarAuxiliary(valueName(lang, "auxiliary", g.auxiliary, lists)));
  }
  if (g.pronominal) {
    parts.push(t.grammarPronominal);
  }
  return parts.join(", ");
}

// A form's readings in one line, each summed up, separated by "; ".
export function readingsSummary(lang: Lang, t: SummaryTexts, lists: GrammarLists, readings: readonly Reading[]): string {
  return readings.map((r) => grammarSummary(lang, t, lists, r)).filter((line) => line !== "").join("; ");
}

/* A lemma's line in the review queue: its grammar, then the readings its
   base form holds beyond the lemma's own, which are approved with it:
   "femminile, singolare; anche: femminile, plurale". */
export function lemmaQueueSummary(lang: Lang, t: SummaryTexts, lists: GrammarLists,
  row: GrammarRow & { readings?: unknown }): string {
  const own: string = grammarSummary(lang, t, lists, row);
  const more: string = readingsSummary(lang, t, lists, splitBaseReadings(readingsOf(row.readings), lemmaReading(row)));
  return [own, more === "" ? "" : t.grammarAlso(more)].filter((part) => part !== "").join("; ");
}
