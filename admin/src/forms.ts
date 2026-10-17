/*
 * forms.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/11, 20:14:29, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Check and clean what people type before it is sent, and
 *           format what the database returns. Pure functions, no DOM,
 *           so they are tested in Node [admin/test/].
 * Contract: LIGURIAN_LETTERS must equal the character class of the
 *           ligurian_form domain in db/migrations/0001; a test compares
 *           the two. The database still checks everything again.
 */

export const LIGURIAN_LETTERS: string = "a-zA-ZàáâäèéêëìíîïòóôöùúûüæçÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÆÇ'-";
export const MAX_FORM_LENGTH: number = 64;

const VALID_FORM: RegExp = new RegExp(`^[${LIGURIAN_LETTERS}]+$`, "u");
const ONE_LETTER: RegExp = new RegExp(`^[${LIGURIAN_LETTERS}]$`, "u");

// The letters of the grafîa ofiçiâ that Italian, Spanish and English
// keyboards lack or hide; the manager offers them as buttons.
export const SPECIAL_LETTERS: readonly string[] = [
  "à", "â", "ä", "è", "é", "ê", "ë", "ì", "î", "ï",
  "ò", "ó", "ô", "ö", "ù", "û", "ü", "æ", "ç",
];

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
