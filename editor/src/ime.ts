/*
 * ime.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/17, 02:11:51, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The decisions of the web editor's input method, as pure
 *           functions on [text, caret]: which word was just finished,
 *           whether to replace it or open the menu, how to apply a
 *           choice and how to undo a conversion with Backspace.
 * Contract: Nothing here touches the page. Every function returns an
 *           Edit [replace text[start..end] with `text`, then put the
 *           caret at `caret`] or null, so the browser code only applies
 *           edits and the logic is tested in Node. Positions count
 *           UTF-16 code units, exactly as a textarea's selection does.
 */

import { convertToken, renderChoice, type Conversion } from "../../engine/src/convert.ts";
import type { Lexicon, LookupFilter } from "../../engine/src/lexicon.ts";

// One change to the text.
export interface Edit {
  start: number;
  end: number;
  text: string;
  caret: number;   // caret position in the text AFTER the edit
}

// A finished word whose menu is open; the text still holds `typed`.
export interface Pending {
  start: number;
  end: number;           // the separator that finished the word is at `end`
  typed: string;
  conversion: Conversion;
  highlighted: number;
}

// The last conversion applied, kept so Backspace can undo it.
export interface Applied {
  start: number;
  typed: string;         // what the user typed
  inserted: string;      // what replaced it
  separator: string;     // the space or newline that followed
}

export type Plan =
  | { kind: "none" }
  | { kind: "replace"; edit: Edit; applied: Applied }
  | { kind: "choose"; pending: Pending };

// Characters that finish a word and trigger the conversion.
const SEPARATORS: ReadonlySet<string> = new Set<string>([" ", "\n"]);

export function isSeparator(ch: string): boolean {
  return SEPARATORS.has(ch);
}

// The word that ends right before a separator sitting just before the
// caret: "a zena |" gives "zena". Null when the character before the
// caret is not a separator, or when there is no word before it.
export function wordBeforeSeparator(text: string, caret: number): { start: number; end: number } | null {
  let found: { start: number; end: number } | null = null;
  if (caret >= 1 && caret <= text.length && isSeparator(text.charAt(caret - 1))) {
    const end: number = caret - 1;
    let start: number = end;
    while (start > 0 && !/\s/u.test(text.charAt(start - 1))) {
      start -= 1;
    }
    if (start < end) {
      found = { start, end };
    }
  }
  return found;
}

// What to do after the user typed a separator at caret - 1.
export function planConversion(lexicon: Lexicon, text: string, caret: number, filter: LookupFilter = {}): Plan {
  let plan: Plan = { kind: "none" };
  const word: { start: number; end: number } | null = wordBeforeSeparator(text, caret);

  if (word !== null) {
    const typed: string = text.slice(word.start, word.end);
    const conversion: Conversion = convertToken(lexicon, typed, filter);

    if (conversion.kind === "replace") {
      const inserted: string = renderChoice(conversion, 0);
      if (inserted !== typed) {
        plan = {
          kind: "replace",
          edit: { start: word.start, end: word.end, text: inserted, caret: caret + inserted.length - typed.length },
          applied: { start: word.start, typed, inserted, separator: text.charAt(word.end) },
        };
      }
    } else if (conversion.kind === "choose") {
      plan = { kind: "choose", pending: { start: word.start, end: word.end, typed, conversion, highlighted: 0 } };
    }
  }

  return plan;
}

// Number of entries in the open menu: every candidate, plus the last
// entry, "keep it as typed", which phones need because they have no
// Escape key.
export function menuLength(pending: Pending): number {
  return pending.conversion.candidates.length + 1;
}

export function isKeepEntry(pending: Pending, index: number): boolean {
  return index === pending.conversion.candidates.length;
}

// Move the highlight down [+1] or up [-1], wrapping around.
export function moveHighlight(pending: Pending, step: number): Pending {
  const size: number = menuLength(pending);
  const next: number = (((pending.highlighted + step) % size) + size) % size;
  return { ...pending, highlighted: next };
}

// Apply menu entry `index` to the current text. Null when the word was
// changed meanwhile, when the index is out of range, or when the entry
// is "keep it as typed" or equal to what was typed: nothing to do then.
export function choose(pending: Pending, index: number, text: string, caret: number): { edit: Edit; applied: Applied } | null {
  let result: { edit: Edit; applied: Applied } | null = null;
  const unchanged: boolean = text.slice(pending.start, pending.end) === pending.typed;
  const inRange: boolean = index >= 0 && index < pending.conversion.candidates.length;

  if (unchanged && inRange) {
    const inserted: string = renderChoice(pending.conversion, index);
    if (inserted !== pending.typed) {
      const shift: number = inserted.length - pending.typed.length;
      result = {
        edit: {
          start: pending.start,
          end: pending.end,
          text: inserted,
          caret: caret >= pending.end ? caret + shift : caret,
        },
        applied: { start: pending.start, typed: pending.typed, inserted, separator: text.charAt(pending.end) },
      };
    }
  }

  return result;
}

// Backspace right after a conversion: the browser has already deleted
// the separator. Put back what the user typed, and the separator, so
// typing simply continues. Null when the deletion was anything else.
export function planRevert(applied: Applied, text: string, caret: number): Edit | null {
  let edit: Edit | null = null;
  const insertedEnd: number = applied.start + applied.inserted.length;

  if (caret === insertedEnd && text.slice(applied.start, insertedEnd) === applied.inserted) {
    edit = {
      start: applied.start,
      end: insertedEnd,
      text: applied.typed + applied.separator,
      caret: applied.start + applied.typed.length + applied.separator.length,
    };
  }

  return edit;
}

// Apply an edit to a string; the browser does the same to the textarea.
export function applyEdit(text: string, edit: Edit): string {
  return text.slice(0, edit.start) + edit.text + text.slice(edit.end);
}
