/*
 * queue.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 13:08:52, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The review queue's logic, apart from the page: grouping the
 *           pending rows by entry, labelling every row, the selection
 *           [one row, a Shift+click range, a whole entry, everything]
 *           and the items a batch sends. Pure functions, no DOM, tested
 *           in Node.
 * Contract: A group is one lemma with its pending rows: the lemma
 *           itself when it is pending, then its forms, then each sense
 *           followed by the translations of that sense. A group exists
 *           whenever any of its rows is pending, also when the lemma is
 *           already approved. Selection keys are "kind:id".
 * Decision: docs/decisions/0033-batch-review.md
 */

import { sqlStateKind, type AppError, type AppErrorKind } from "./errors.ts";
import type { QueueItem, QueueKind, Status } from "./types.ts";

export type ReviewStatus = Exclude<Status, "pending">;

// What review_batch[] receives for one row [migration 0007].
export interface BatchItem {
  kind: QueueKind;
  id: number;
  version: number;
}

// One row review_batch[] did not change, and why.
export interface BatchFailure {
  kind: QueueKind;
  id: number;
  reason: "conflict" | "notfound" | "error";
  sqlstate: string | null;
  message: string;
}

export interface BatchResult {
  updated: number;
  failed: BatchFailure[];
}

// What a whole batch did: the rows changed and failed in the calls that
// ran, and the error that stopped a call refused whole, if any.
export interface BatchOutcome {
  result: BatchResult;
  error: AppError | null;
}

export interface QueueGroup {
  lemmaId: number;
  headword: string;
  publicId: string | null;
  lemmaStatus: Status | null;
  // The lemma's own row, when the lemma is pending.
  lemma: QueueItem | null;
  // Forms, then senses each followed by its translations.
  parts: QueueItem[];
}

// The texts a label needs, in the interface's language.
export interface LabelTexts {
  senseNumbered: (n: number) => string;
  senseWithoutDefinition: (n: number) => string;
  glossOfSense: (n: number) => string;
}

// At most this many rows per call; migration 0007 accepts 500, and a
// smaller call stays far below the API's statement time limit.
export const BATCH_SIZE: number = 200;

export function itemKey(item: { kind: QueueKind; id: number }): string {
  return `${item.kind}:${item.id}`;
}

export function groupKey(group: QueueGroup): string {
  return `entry:${group.lemmaId}`;
}

// Every row of a group, in the order the page shows them.
export function groupItems(group: QueueGroup): QueueItem[] {
  return group.lemma === null ? group.parts : [group.lemma, ...group.parts];
}

/* The order of the rows inside a group: forms alphabetically, then the
   senses by number, each with its translations right after it. A
   translation whose sense is not pending still sorts by that sense's
   number. */
function partOrder(a: QueueItem, b: QueueItem): number {
  const rank = (item: QueueItem): [number, number, number, string, number] => {
    let result: [number, number, number, string, number];
    if (item.kind === "wordform") {
      result = [0, 0, 0, item.text, item.id];
    } else if (item.kind === "sense") {
      result = [1, item.sense_number ?? 0, 0, "", item.id];
    } else {
      result = [1, item.sense_number ?? Number.MAX_SAFE_INTEGER, 1, `${item.language ?? ""}\t${item.gloss ?? item.text}`, item.id];
    }
    return result;
  };
  const ra = rank(a);
  const rb = rank(b);
  let order: number = 0;
  for (let i = 0; i < ra.length && order === 0; i += 1) {
    const x = ra[i] ?? 0;
    const y = rb[i] ?? 0;
    order = typeof x === "string" && typeof y === "string" ? x.localeCompare(y) : Number(x) - Number(y);
  }
  return order;
}

/* The queue grouped by entry. Groups keep the queue's own order, oldest
   first: a group sits where its oldest pending row would. */
export function groupQueue(items: readonly QueueItem[]): QueueGroup[] {
  const groups: Map<number, QueueGroup> = new Map();
  for (const item of items) {
    let group: QueueGroup | undefined = groups.get(item.lemma_id);
    if (group === undefined) {
      group = {
        lemmaId: item.lemma_id,
        headword: item.lemma_headword ?? "",
        publicId: item.lemma_public_id ?? null,
        lemmaStatus: item.lemma_status ?? null,
        lemma: null,
        parts: [],
      };
      groups.set(item.lemma_id, group);
    }
    if (item.kind === "lemma") {
      group.lemma = item;
      if (group.headword === "") {
        group.headword = item.text;
      }
    } else {
      group.parts.push(item);
    }
  }
  const result: QueueGroup[] = [...groups.values()];
  for (const group of result) {
    group.parts.sort(partOrder);
    if (group.headword === "") {
      group.headword = `#${group.lemmaId}`;
    }
  }
  return result;
}

/* The text of a row: a form as written; a sense by its number and its
   Italian definition, or as having none, never as a bare "1"; a
   translation by its language and text. Without the columns of 0007,
   the queue's own text. */
export function itemLabel(t: LabelTexts, item: QueueItem): string {
  let label: string = item.text;
  if (item.kind === "sense" && item.sense_number !== null && item.sense_number !== undefined) {
    label = item.definition_it === null || item.definition_it === undefined || item.definition_it === ""
      ? t.senseWithoutDefinition(item.sense_number)
      : `${t.senseNumbered(item.sense_number)}: ${item.definition_it}`;
  } else if (item.kind === "gloss" && item.language !== null && item.language !== undefined && item.gloss !== null && item.gloss !== undefined) {
    label = `${item.language}: ${item.gloss}`;
  }
  return label;
}

// "of sense 1" for a translation; "" for every other row.
export function itemContext(t: LabelTexts, item: QueueItem): string {
  return item.kind === "gloss" && item.sense_number !== null && item.sense_number !== undefined
    ? t.glossOfSense(item.sense_number)
    : "";
}

// Every row's key, in the order the page shows them: what a Shift+click
// range runs over.
export function displayOrder(groups: readonly QueueGroup[]): string[] {
  return groups.flatMap((group) => groupItems(group).map(itemKey));
}

/* The keys from the anchor to the clicked row, both included, in either
   direction. Without an anchor, or with one no longer on the page, only
   the clicked row. */
export function rangeKeys(order: readonly string[], anchor: string | null, clicked: string): string[] {
  const to: number = order.indexOf(clicked);
  const from: number = anchor === null ? -1 : order.indexOf(anchor);
  let keys: string[];
  if (to < 0) {
    keys = [];
  } else if (from < 0) {
    keys = [clicked];
  } else {
    keys = order.slice(Math.min(from, to), Math.max(from, to) + 1);
  }
  return keys;
}

export interface Selection {
  selected: ReadonlySet<string>;
  anchor: string | null;
}

/* A click on a row's box. With Shift and an anchor, every row of the
   range takes the clicked box's new state; otherwise only that row.
   The clicked row becomes the anchor either way. */
export function clickRow(selection: Selection, order: readonly string[], key: string, checked: boolean, shift: boolean): Selection {
  const keys: string[] = shift ? rangeKeys(order, selection.anchor, key) : rangeKeys(order, null, key);
  const selected: Set<string> = new Set(selection.selected);
  for (const k of keys) {
    if (checked) {
      selected.add(k);
    } else {
      selected.delete(k);
    }
  }
  return { selected, anchor: key };
}

// A click on an entry's box: all its rows, or none of them.
export function clickGroup(selection: Selection, group: QueueGroup, checked: boolean): Selection {
  const selected: Set<string> = new Set(selection.selected);
  for (const item of groupItems(group)) {
    if (checked) {
      selected.add(itemKey(item));
    } else {
      selected.delete(itemKey(item));
    }
  }
  return { selected, anchor: selection.anchor };
}

// "Select all": every row on the page, or none.
export function selectAll(groups: readonly QueueGroup[], checked: boolean): Selection {
  return { selected: new Set(checked ? displayOrder(groups) : []), anchor: null };
}

// A box's state: "all" checked, "some" [indeterminate], or "none".
export function coverage(selected: ReadonlySet<string>, keys: readonly string[]): "all" | "some" | "none" {
  const count: number = keys.filter((k) => selected.has(k)).length;
  return count === 0 ? "none" : count === keys.length ? "all" : "some";
}

/* After a reload, keep selected only the rows still on the page: a row
   approved, rejected or deleted meanwhile drops out of the selection. */
export function keepVisible(selection: Selection, groups: readonly QueueGroup[]): Selection {
  const visible: Set<string> = new Set(displayOrder(groups));
  const selected: Set<string> = new Set([...selection.selected].filter((k) => visible.has(k)));
  const anchor: string | null = selection.anchor !== null && visible.has(selection.anchor) ? selection.anchor : null;
  return { selected, anchor };
}

// The rows of the page that are selected, in display order.
export function selectedItems(groups: readonly QueueGroup[], selected: ReadonlySet<string>): QueueItem[] {
  return groups.flatMap(groupItems).filter((item) => selected.has(itemKey(item)));
}

// What a batch sends for these rows: kind, id and the version the
// reviewer saw, so that a row changed since is reported, not overwritten.
export function batchItems(items: readonly QueueItem[]): BatchItem[] {
  return items.map((item) => ({ kind: item.kind, id: item.id, version: item.version }));
}

export function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

// Two batch results added together, failures in order.
export function mergeResults(a: BatchResult, b: BatchResult): BatchResult {
  return { updated: a.updated + b.updated, failed: [...a.failed, ...b.failed] };
}

// The kind of failure a person reads for a row a batch did not change.
export function failureKind(failure: BatchFailure): AppErrorKind {
  let kind: AppErrorKind;
  if (failure.reason === "conflict") {
    kind = "conflict";
  } else if (failure.reason === "notfound") {
    kind = "notfound";
  } else {
    kind = sqlStateKind(failure.sqlstate ?? "");
  }
  return kind;
}

/* After a batch, no row of it stays selected: a row that failed because
   someone changed it must be looked at again, not approved by a second
   click in its new form. Rows outside the batch keep their state. */
export function afterBatch(selection: Selection, sent: readonly { kind: QueueKind; id: number }[]): Selection {
  const done: Set<string> = new Set(sent.map(itemKey));
  return {
    selected: new Set([...selection.selected].filter((k) => !done.has(k))),
    anchor: selection.anchor !== null && done.has(selection.anchor) ? null : selection.anchor,
  };
}
