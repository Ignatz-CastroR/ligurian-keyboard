/*
 * errors.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 13:13:26, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The kinds of failure the lexicon manager tells apart, and how
 *           a PostgreSQL error code [SQLSTATE] becomes one of them. Moved
 *           out of db.ts so that the review queue's pure logic can read
 *           a batch failure's SQLSTATE without loading Supabase.
 * Updated:  2026/10/18, 16:24:30: "timeout", for a statement Supabase
 *           stopped at its time limit [SQLSTATE 57014].
 * Contract: Every code raised by our migrations has a kind here; any
 *           other code is "generic".
 */

export type AppErrorKind =
  "conflict" | "permission" | "duplicate" | "parent" | "invalid" | "notfound" | "notempty" | "timeout" | "generic";

export class AppError extends Error {
  public readonly kind: AppErrorKind;

  public constructor(kind: AppErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

// PostgreSQL error codes [SQLSTATE] raised by our migrations.
export function sqlStateKind(code: string): AppErrorKind {
  let kind: AppErrorKind = "generic";
  if (code === "42501") {
    kind = "permission";
  } else if (code === "23505") {
    kind = "duplicate";
  } else if (code === "23503") {
    kind = "parent";
  } else if (code === "23514" || code === "22P02" || code === "23502" || code === "22001" || code === "22023") {
    kind = "invalid";
  } else if (code === "55000") {
    kind = "notempty";
  } else if (code === "57014") {
    kind = "timeout";
  }
  return kind;
}
