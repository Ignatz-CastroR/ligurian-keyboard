/*
 * permissions.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 20:14:11, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/18, 09:20:37: canBackup[] [decision 0031].
 * Purpose:  Decide which buttons the interface shows to whom.
 * Contract: Cosmetic only. The database enforces every rule itself
 *           [row level security in 0003, triggers in 0002]; these
 *           functions mirror those rules so that nobody is offered a
 *           button the database would refuse. If they ever disagree,
 *           the database wins and the user sees its error.
 */

import type { Role, Tracked, LexiconTable } from "./types.ts";

export function canPropose(role: Role | null): boolean {
  return role === "contributor" || role === "reviewer" || role === "admin";
}

export function isStaff(role: Role | null): boolean {
  return role === "reviewer" || role === "admin";
}

export function canDeleteOrRestore(role: Role | null): boolean {
  return role === "admin";
}

export function canManageRoles(role: Role | null): boolean {
  return role === "admin";
}

// Backups hold every row and every profile: admins only.
export function canBackup(role: Role | null): boolean {
  return role === "admin";
}

// May this person edit the content of this row at all?
export function canEdit(role: Role | null, row: Tracked, userId: string | null): boolean {
  let allowed: boolean = false;
  if (role === "admin") {
    allowed = true;
  } else if (role === "reviewer") {
    allowed = row.deleted_at === null;
  } else if (role === "contributor") {
    allowed = row.created_by !== null && row.created_by === userId
      && row.status === "pending" && row.deleted_at === null;
  }
  return allowed;
}

// May this person approve or reject this row? A base wordform follows
// its lemma, so its status is never changed directly.
export function canChangeStatus(role: Role | null, table: LexiconTable, row: Tracked, isBase: boolean): boolean {
  return isStaff(role) && row.deleted_at === null && !(table === "wordforms" && isBase);
}

// May this person soft delete or restore this row? A base wordform is
// deleted together with its lemma, never on its own.
export function canDeleteRow(role: Role | null, table: LexiconTable, isBase: boolean): boolean {
  return canDeleteOrRestore(role) && !(table === "wordforms" && isBase);
}

// May this person add children [forms, senses, glosses] under a parent?
export function canAddChild(role: Role | null, parent: Tracked): boolean {
  return canPropose(role) && parent.deleted_at === null;
}
