/*
 * repair.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 23:49:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/21, 09:30:23: definitions follow the translations
 *           they describe, not a position: a sense kept keeps its own
 *           unless a new one is typed, and a typed definition the chosen
 *           action would not use stops it; the fields are labelled with
 *           the numbers the senses will have; what was seen names the
 *           lemma's own version; a lemma waits when it is on the list of
 *           migration 0012 and not yet reviewed.
 * Updated:  2026/10/21, 10:57:43: every definition sent is the text its
 *           field shows, typed or the sense's own: "one" no longer drops
 *           the definition field 1 shows, and a definition shown in a
 *           field the action would not use stops it, typed or not.
 * Purpose:  The logic of the repair page, apart from the page: the live
 *           senses and translations of an entry, what the reviewer saw,
 *           the definition fields, the groups each of the three actions
 *           sends to regroup_senses[], and the queue's key of an entry.
 *           Pure functions, no DOM, tested in Node, against the real
 *           database too.
 * Contract: Mirrors migration 0012. isWaiting[] is the queue's own rule
 *           [private.sense_review_candidates[]]. A definition field
 *           belongs to a group number on the page; it shows what was
 *           typed for that number, or else the definition of the sense
 *           holding exactly its translations, and what it shows is what
 *           is sent. Text typed for a number stays with it while the
 *           number is in use; the page forgets it when the number falls
 *           out of use, as its field disappears.
 * Decision: docs/decisions/0038-senses-reviewed-one-by-one.md
 */

import type { Entry, Status } from "./types.ts";

export const MAX_DEFINITION_LENGTH: number = 1000;

// One live translation, with the live sense it hangs from.
export interface RepairRow {
  glossId: number;
  glossVersion: number;
  language: string;
  gloss: string;
  status: Status;
  senseId: number;
  senseVersion: number;
  senseNumber: number;
  // The sense's place among the live senses, from 1.
  position: number;
}

export interface IdVersion {
  id: number;
  version: number;
}

export interface Seen {
  lemma: IdVersion;
  senses: IdVersion[];
  glosses: IdVersion[];
}

export interface Group {
  glosses: number[];
  definition_it?: string | null;
}

export type RepairAction = "one" | "keep" | "group";

// The queue's key of an entry: its live senses, search key and id.
export interface QueueKey {
  senses: number;
  key: string;
  id: number;
}

// A definition field of the page: the group number it belongs to, the
// number its sense will have, and the text it shows.
export interface DefinitionField {
  group: number;
  rank: number;
  value: string;
}

export interface Plan {
  groups: Group[];
  // Group numbers whose typed definition this action would not use.
  unused: number[];
}

function liveSenses(entry: Entry): Entry["senses"] {
  return entry.senses
    .filter((s) => s.sense.deleted_at === null)
    .sort((a, b) => a.sense.sense_number - b.sense.sense_number);
}

/* Every live translation of the entry, sense by sense in number order,
   and within a sense by id, the order in which they were written. */
export function repairRows(entry: Entry): RepairRow[] {
  const rows: RepairRow[] = [];
  liveSenses(entry).forEach(({ sense, glosses }, index) => {
    for (const g of glosses.filter((x) => x.deleted_at === null).sort((a, b) => a.id - b.id)) {
      rows.push({
        glossId: g.id, glossVersion: g.version, language: g.language, gloss: g.gloss, status: g.status,
        senseId: sense.id, senseVersion: sense.version, senseNumber: sense.sense_number, position: index + 1,
      });
    }
  });
  return rows;
}

// The numbers of the live senses with no live translation.
export function bareSenses(entry: Entry): number[] {
  return liveSenses(entry)
    .filter(({ glosses }) => !glosses.some((g) => g.deleted_at === null))
    .map(({ sense }) => sense.sense_number);
}

// Everything regroup_senses[] checks against what is stored now.
export function seenOf(entry: Entry): Seen {
  return {
    lemma: { id: entry.lemma.id, version: entry.lemma.version },
    senses: liveSenses(entry).map(({ sense }) => ({ id: sense.id, version: sense.version })),
    glosses: repairRows(entry).map((r) => ({ id: r.glossId, version: r.glossVersion })),
  };
}

// The queue's own rule: on the list, not yet reviewed, live.
export function isWaiting(entry: Entry): boolean {
  return entry.lemma.senses_review_needed && entry.lemma.senses_reviewed_at === null && entry.lemma.deleted_at === null;
}

export function queueKey(entry: Entry): QueueKey {
  return { senses: liveSenses(entry).length, key: entry.lemma.headword_key, id: entry.lemma.id };
}

// Each translation starts in the sense it is in now, by its place.
export function initialAssignment(rows: readonly RepairRow[]): Map<number, number> {
  return new Map(rows.map((r) => [r.glossId, r.position]));
}

// The group numbers in use, in order.
export function groupNumbers(assignment: ReadonlyMap<number, number>): number[] {
  return [...new Set(assignment.values())].sort((a, b) => a - b);
}

// The translations of each group number in use, in page order.
export function groupMembers(rows: readonly RepairRow[], assignment: ReadonlyMap<number, number>): Map<number, number[]> {
  const members: Map<number, number[]> = new Map(groupNumbers(assignment).map((n) => [n, []]));
  for (const row of rows) {
    members.get(assignment.get(row.glossId) ?? row.position)?.push(row.glossId);
  }
  return members;
}

const setKey = (ids: readonly number[]): string => [...ids].sort((a, b) => a - b).join(",");

/* The definition of the existing sense holding exactly these
   translations, or "" when no sense does: the text a field shows until
   one is typed. */
export function existingDefinition(entry: Entry, ids: readonly number[]): string {
  const wanted: string = setKey(ids);
  const found = liveSenses(entry).find(({ glosses }) =>
    setKey(glosses.filter((g) => g.deleted_at === null).map((g) => g.id)) === wanted);
  return found?.sense.definition_it ?? "";
}

// The fields the page shows: one per group number in use, labelled
// with the number its sense will have.
export function definitionFields(
  entry: Entry,
  rows: readonly RepairRow[],
  assignment: ReadonlyMap<number, number>,
  typed: ReadonlyMap<number, string>,
): DefinitionField[] {
  const members: Map<number, number[]> = groupMembers(rows, assignment);
  return [...members.keys()].map((group, i) => ({
    group,
    rank: i + 1,
    value: typed.get(group) ?? existingDefinition(entry, members.get(group) ?? []),
  }));
}

export function cleanDefinition(text: string | undefined): string | null {
  const trimmed: string = (text ?? "").trim().normalize("NFC");
  return trimmed === "" ? null : trimmed;
}

// The first typed definition of the groups in use longer than the
// database accepts, counted in characters as the database counts them;
// null if none is.
export function tooLongDefinition(typed: ReadonlyMap<number, string>, groups: readonly number[]): number | null {
  return groups.find((n) => [...(cleanDefinition(typed.get(n)) ?? "")].length > MAX_DEFINITION_LENGTH) ?? null;
}

/* What each action sends. Every definition sent is the text its field
   shows: what was typed there, or else the definition of the sense that
   holds exactly its translations.
     one    every translation in one sense, with the first field's text;
     keep   the senses as they are, ignoring the menus; a field whose
            group holds exactly a sense's translations gives that sense
            its text, and a sense with no such field keeps its own;
     group  one sense per group number in use, in increasing order, each
            with its translations in page order and its field's text.
   A field in use whose text is not empty and that the action would not
   use is returned in "unused", so that the page can stop rather than
   lose it. */
export function planFor(
  action: RepairAction,
  entry: Entry,
  rows: readonly RepairRow[],
  assignment: ReadonlyMap<number, number>,
  typed: ReadonlyMap<number, string>,
): Plan {
  const members: Map<number, number[]> = groupMembers(rows, assignment);
  const inUse: number[] = [...members.keys()];
  const shown = (n: number): string => typed.get(n) ?? existingDefinition(entry, members.get(n) ?? []);

  let groups: Group[];
  let used: number[];
  if (action === "one") {
    const first: number | undefined = inUse[0];
    groups = rows.length === 0 || first === undefined
      ? []
      : [{ glosses: rows.map((r) => r.glossId), definition_it: cleanDefinition(shown(first)) }];
    used = first === undefined ? [] : [first];
  } else if (action === "keep") {
    const positions: number[] = [...new Set(rows.map((r) => r.position))].sort((a, b) => a - b);
    used = [];
    groups = positions.map((p) => {
      const glosses: number[] = rows.filter((r) => r.position === p).map((r) => r.glossId);
      const field: number | undefined = inUse.find((n) => setKey(members.get(n) ?? []) === setKey(glosses));
      let group: Group = { glosses };
      if (field !== undefined) {
        used.push(field);
        group = { glosses, definition_it: cleanDefinition(shown(field)) };
      }
      return group;
    });
  } else {
    groups = inUse.map((n) => ({ glosses: members.get(n) ?? [], definition_it: cleanDefinition(shown(n)) }));
    used = inUse;
  }
  return { groups, unused: inUse.filter((n) => !used.includes(n) && shown(n).trim() !== "") };
}

// The keyboard's shortcut for each action, ignored while typing.
export function actionForKey(key: string, typing: boolean, modified: boolean): RepairAction | null {
  const actions: Readonly<Record<string, RepairAction>> = { "1": "one", "2": "keep", "3": "group" };
  return typing || modified ? null : actions[key] ?? null;
}
