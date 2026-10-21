/*
 * model.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 01:58:20, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/20, 23:49:12: an update that changed only
 *           senses_reviewed_at reads as the senses reviewed [migration
 *           0012, decision 0038].
 * Updated:  2026/10/21, 09:30:23: one that changed only
 *           senses_review_needed reads as the lemma put on the list of
 *           senses to review; a change of the review date reads as a
 *           review even when it clears it, since the history's summary
 *           names the fields, not their values.
 * Purpose:  The Users section's logic, apart from the page: the
 *           addresses of its views, what each change in a person's
 *           history was [an approval reads better as "approved" than as
 *           "edited: status"], and where its entry is. Pure functions,
 *           no DOM, tested in Node.
 * Contract: The changes are the rows of user_history[] of migration
 *           0011: "changed" lists the fields an update changed, without
 *           version and updated_at.
 * Decision: docs/decisions/0035-site-in-five-sections.md
 *           docs/decisions/0038-senses-reviewed-one-by-one.md
 */

import type { AuditEntry, Status } from "../../admin/src/types.ts";

// The SQL Editor's changes, written with no user, have this address.
export const SQL_EDITOR: string = "sql";

export type Route =
  | { view: "people" }
  | { view: "person"; userId: string | null }
  | { view: "signin" };

const UUID: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/* #/persona/<user id>, #/persona/sql, #/accedi; anything else is the
   first page, the profile and the list of people. */
export function parseRoute(hash: string): Route {
  const [view, first] = hash.replace(/^#\/?/u, "").split("/");
  const who: string = (first ?? "").toLowerCase();
  let route: Route = { view: "people" };
  if (view === "persona" && who === SQL_EDITOR) {
    route = { view: "person", userId: null };
  } else if (view === "persona" && UUID.test(who)) {
    route = { view: "person", userId: who };
  } else if (view === "accedi") {
    route = { view: "signin" };
  }
  return route;
}

export function routeHash(route: Route): string {
  let hash: string = "#/";
  if (route.view === "person") {
    hash = `#/persona/${route.userId ?? SQL_EDITOR}`;
  } else if (route.view === "signin") {
    hash = "#/accedi";
  }
  return hash;
}

export type Verb =
  "insert" | "update" | "approve" | "reject" | "unreview" | "review_senses" | "list_senses" | "soft_delete" | "restore";

export interface Described {
  verb: Verb;
  // The fields an edit changed; empty for anything else.
  fields: string[];
}

/* What a change was. An update that changed the review status and
   nothing else is a review: approved, rejected, or sent back to wait.
   One that changed only senses_reviewed_at, a lemma's column, is a
   review of its senses [migration 0012]. */
export function describeChange(change: { action: AuditEntry["action"]; status: Status | null; changed: string[] | null }): Described {
  const fields: string[] = change.changed ?? [];
  let described: Described = { verb: change.action, fields: [] };
  if (change.action === "update") {
    if (fields.length === 1 && fields[0] === "senses_reviewed_at") {
      described = { verb: "review_senses", fields: [] };
    } else if (fields.length === 1 && fields[0] === "senses_review_needed") {
      described = { verb: "list_senses", fields: [] };
    } else if (fields.length === 1 && fields[0] === "status") {
      const verbs: Record<Status, Verb> = { approved: "approve", rejected: "reject", pending: "unreview" };
      described = { verb: change.status === null ? "update" : verbs[change.status], fields: change.status === null ? fields : [] };
    } else {
      described = { verb: "update", fields };
    }
  }
  return described;
}

// The entry a change belongs to, in the lexicon manager, which shows
// every row, pending and deleted ones included, to those who may see
// them.
export function entryHref(lemmaId: number | null): string | null {
  return lemmaId === null ? null : `../admin/#/entry/${lemmaId}`;
}
