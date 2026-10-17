/*
 * forms.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 20:14:29, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Check and clean what people type before it is sent, and
 *           format what the database returns. Pure functions, no DOM,
 *           so they are tested in Node [admin/test/].
 * Updated:  2026/10/17, 07:50:33: the letter ñ [decision 0024].
 * Updated:  2026/10/17, 10:48:19: enyeUnderOficia, the warning before
 *           ñ is saved under the grafîa ofiçiâ [decision 0028].
 * Updated:  2026/10/17, 12:35:12: joinedElisions, the warning before an
 *           elided particle and a word are saved as one form [decision
 *           0029].
 * Contract: LIGURIAN_LETTERS must equal the character class of the
 *           ligurian_form domain, as the migrations leave it [last
 *           changed in db/migrations/0005]; a test compares the two on
 *           a real database. The database still checks everything again.
 */

import { splitElision } from "../../engine/src/elision.ts";

export const LIGURIAN_LETTERS: string = "a-zA-ZàáâäèéêëìíîïòóôöùúûüæçñÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÆÇÑ'-";
export const MAX_FORM_LENGTH: number = 64;

const VALID_FORM: RegExp = new RegExp(`^[${LIGURIAN_LETTERS}]+$`, "u");
const ONE_LETTER: RegExp = new RegExp(`^[${LIGURIAN_LETTERS}]$`, "u");

// The letters of the grafîa ofiçiâ that Italian, Spanish and English
// keyboards lack or hide, then ñ, which other Ligurian spelling systems
// write and Italian and English keyboards lack; the manager offers them
// as buttons, in this order.
export const SPECIAL_LETTERS: readonly string[] = [
  "à", "â", "ä", "è", "é", "ê", "ë", "ì", "î", "ï",
  "ò", "ó", "ô", "ö", "ù", "û", "ü", "æ", "ç", "ñ",
];

// The grafîa ofiçiâ, the project's default spelling system, which does
// not write ñ [decisions 0004 and 0024].
export const OFICIA: string = "ofiçiâ";

// The forms that would be saved with ñ under the grafîa ofiçiâ: the
// manager warns and asks before saving them, and saves them if the
// person confirms, because the database cannot know whether the letter
// or the spelling system is the mistake [decision 0028]. Empty when
// there is nothing to warn about.
export function enyeUnderOficia(forms: readonly string[], orthography: string): string[] {
  let result: string[] = [];
  if (orthography.normalize("NFC") === OFICIA) {
    result = forms.map((form) => cleanForm(form)).filter((form) => /[ñÑ]/u.test(form));
  }
  return [...new Set(result)];
}

// The forms that join an elided particle and a word, such as "d'ægua",
// each shown with its parts: "d'ægua [d' + ægua]". The input method
// splits such words by itself, so the dictionary needs "d'" and "ægua"
// once each; the manager warns and asks before saving the joined form,
// and saves it if the person confirms, for the rare word that really is
// one word with an apostrophe inside [decision 0029].
export function joinedElisions(forms: readonly string[]): string[] {
  const found: string[] = [];
  for (const form of forms.map((f) => cleanForm(f))) {
    const parts: string[] = splitElision(form);
    if (parts.length > 1) {
      found.push(`${form} [${parts.join(" + ")}]`);
    }
  }
  return [...new Set(found)];
}

export type FormCheck =
  | { ok: true; value: string }
  | { ok: false; reason: "empty" | "too_long" | "invalid_chars"; bad: string[] };

// Trim, normalize to NFC and turn typographic apostrophes into the
// ASCII one, which is the only apostrophe the database accepts.
export function cleanForm(input: string): string {
  return input.trim().normalize("NFC").replace(/[’‘ʼ]/gu, "'");
}

export function checkForm(input: string): FormCheck {
  const value: string = cleanForm(input);
  const chars: string[] = [...value];
  let result: FormCheck;

  if (value === "") {
    result = { ok: false, reason: "empty", bad: [] };
  } else if (chars.length > MAX_FORM_LENGTH) {
    result = { ok: false, reason: "too_long", bad: [] };
  } else if (!VALID_FORM.test(value)) {
    const bad: string[] = [...new Set(chars.filter((c) => !ONE_LETTER.test(c)))];
    result = { ok: false, reason: "invalid_chars", bad };
  } else {
    result = { ok: true, value };
  }
  return result;
}

// Optional free text: blank becomes null; longer than max is refused.
export function cleanOptionalText(input: string, max: number): { ok: true; value: string | null } | { ok: false } {
  const value: string = input.trim().normalize("NFC");
  let result: { ok: true; value: string | null } | { ok: false };
  if (value === "") {
    result = { ok: true, value: null };
  } else if ([...value].length > max) {
    result = { ok: false };
  } else {
    result = { ok: true, value };
  }
  return result;
}

// A frequency is a whole number from 0 up.
export function checkFreq(input: string): number | null {
  const text: string = input.trim();
  let result: number | null = null;
  if (/^\d{1,9}$/.test(text)) {
    result = Number(text);
  }
  return result;
}

// Only the characters a search key can contain survive, so a typed
// "%" or "*" can never act as a wildcard in the query.
export function searchKeyFilter(key: string): string {
  return key.replace(/[^a-z']/g, "");
}

// Timestamps as YYYY/MM/DD HH:MM:SS in the viewer's time zone.
export function formatDateTime(iso: string): string {
  const d: Date = new Date(iso);
  let result: string = iso;
  if (!Number.isNaN(d.getTime())) {
    const date: string = `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
    const time: string = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    result = `${date} ${time}`;
  }
  return result;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// The first eight characters of a user id, for people without a name.
export function shortId(uuid: string | null): string {
  return uuid === null ? "?" : uuid.slice(0, 8);
}

// Which fields an audit entry changed, ignoring bookkeeping columns.
const BOOKKEEPING: ReadonlySet<string> = new Set(["version", "updated_at", "headword_key", "form_key"]);

export function changedFields(oldRow: Record<string, unknown> | null, newRow: Record<string, unknown> | null): string[] {
  const changed: string[] = [];
  if (oldRow !== null && newRow !== null) {
    for (const key of Object.keys(newRow)) {
      if (!BOOKKEEPING.has(key) && JSON.stringify(oldRow[key]) !== JSON.stringify(newRow[key])) {
        changed.push(key);
      }
    }
  }
  return changed;
}
