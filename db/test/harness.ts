/*
 * harness.ts
 * Author:    Eng. José Ignacio Castro de R. and contributors
 * Date:      2026/10/10
 * Purpose:   Build a fresh in-memory PostgreSQL [PGlite] with the Supabase
 *            shim and every migration, and switch between identities
 *            the way Supabase does for each API request.
 * Contract:  Each call to createDatabase[] returns an isolated database.
 *            Migrations run in file name order, as Supabase runs them.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const DB_DIR: string = join(import.meta.dirname, "..");
const MIGRATIONS_DIR: string = join(DB_DIR, "migrations");

/* "trusted" is a session with no user id: the service role or SQL editor. */
export type Identity = "trusted" | "anon" | { user: string };

export interface TestUsers {
  admin: string;
  reviewer: string;
  contributor: string;
  contributor2: string;
  member: string;
}

export const USERS: TestUsers = {
  admin: "00000000-0000-4000-8000-000000000001",
  reviewer: "00000000-0000-4000-8000-000000000002",
  contributor: "00000000-0000-4000-8000-000000000003",
  contributor2: "00000000-0000-4000-8000-000000000004",
  member: "00000000-0000-4000-8000-000000000005",
};

export async function createDatabase(): Promise<PGlite> {
  const db: PGlite = new PGlite();
  await db.exec(readFileSync(join(DB_DIR, "test", "supabase-shim.sql"), "utf8"));
  const files: string[] = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, name), "utf8"));
  }
  return db;
}

/* A database with the five test users, each already holding the role
   their name says. Roles are granted from a trusted session. */
export async function createSeededDatabase(): Promise<PGlite> {
  const db: PGlite = await createDatabase();
  const roles: [string, string][] = [
    [USERS.admin, "admin"],
    [USERS.reviewer, "reviewer"],
    [USERS.contributor, "contributor"],
    [USERS.contributor2, "contributor"],
    [USERS.member, "member"],
  ];
  for (const [id, role] of roles) {
    await db.query("insert into auth.users (id) values ($1)", [id]);
    await db.query("update public.profiles set role = $2::public.app_role where user_id = $1", [id, role]);
  }
  return db;
}

export async function actAs(db: PGlite, who: Identity): Promise<void> {
  await db.exec("reset role; reset request.jwt.claims;");
  if (who === "anon") {
    await db.exec("set role anon;");
  } else if (who !== "trusted") {
    const claims: string = JSON.stringify({ sub: who.user, role: "authenticated" });
    await db.query("select set_config('request.jwt.claims', $1, false)", [claims]);
    await db.exec("set role authenticated;");
  }
}

/* Run one query as a given identity and return its rows. */
export async function rowsAs<T>(db: PGlite, who: Identity, sql: string, params: unknown[] = []): Promise<T[]> {
  await actAs(db, who);
  try {
    const result = await db.query<T>(sql, params);
    return result.rows;
  } finally {
    await actAs(db, "trusted");
  }
}

/* Run one statement as a given identity and return the affected row count. */
export async function affectedAs(db: PGlite, who: Identity, sql: string, params: unknown[] = []): Promise<number> {
  await actAs(db, who);
  try {
    const result = await db.query(sql, params);
    return result.affectedRows ?? 0;
  } finally {
    await actAs(db, "trusted");
  }
}

export function asUser(id: string): Identity {
  return { user: id };
}
