/*
 * public-id.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 08:41:07, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The public identifiers of lemmas and wordforms, such as
 *           LIJ-7K3Q9MDXK, as seen by people: recognize one typed into
 *           the search field, forgive the slips Crockford's base 32 was
 *           designed to forgive, and catch a mistyped code by its check
 *           symbol. Pure functions, no DOM, tested in Node.
 * Contract: Mirrors db/migrations/0006_public_ids_and_backups.sql,
 *           which assigns the codes; db/test/public-ids-backup.test.ts
 *           proves that both compute the same check symbols. The
 *           database never accepts a code it did not issue itself.
 * Decision: docs/decisions/0030-public-identifiers.md
 */

export const PUBLIC_ID_PREFIX: string = "LIJ-";
export const PUBLIC_ID_BODY_LENGTH: number = 8;

// Crockford's 32 symbols: digits and letters without I, L, O and U.
export const CROCKFORD_SYMBOLS: string = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
// The check symbol's 37 values: the 32 symbols, then * ~ $ = U.
export const CHECK_SYMBOLS: string = `${CROCKFORD_SYMBOLS}*~$=U`;

const VALID_CODE: RegExp = /^LIJ-[0-9A-HJKMNP-TV-Z]{8}[0-9A-HJKMNP-TV-Z*~$=U]$/u;
// "LIJ" then nine symbols, once spaces and hyphens are removed.
const TYPED_CODE: RegExp = /^LIJ([0-9A-Z*~$=]{9})$/u;

// The value of a string of Crockford symbols; null if one is not a symbol.
export function crockfordValue(symbols: string): number | null {
  let value: number | null = 0;
  for (const symbol of symbols) {
    const digit: number = CROCKFORD_SYMBOLS.indexOf(symbol);
    value = digit < 0 || value === null ? null : value * 32 + digit;
  }
  return value;
}

// The symbols of a value, padded with zeros to a width.
export function crockfordSymbols(value: number, width: number): string {
  let rest: number = value;
  let result: string = "";
  for (let i: number = 0; i < width; i += 1) {
    result = (CROCKFORD_SYMBOLS[rest % 32] ?? "") + result;
    rest = Math.floor(rest / 32);
  }
  return result;
}

// The check symbol of a code's eight-symbol body; null for a bad body.
export function checkSymbol(body: string): string | null {
  const value: number | null = body.length === PUBLIC_ID_BODY_LENGTH ? crockfordValue(body) : null;
  return value === null ? null : CHECK_SYMBOLS[value % 37] ?? null;
}

// True for a code exactly as the database writes it, check symbol included.
export function isValidPublicId(code: string): boolean {
  return VALID_CODE.test(code) && code.slice(12) === checkSymbol(code.slice(4, 12));
}

export type TypedCode =
  | { kind: "code"; code: string }
  | { kind: "typo"; typed: string }
  | { kind: "none" };

/* What a person typed into the search field. Case, spaces and hyphens
   anywhere, and O for 0 or I and L for 1 are forgiven, as Crockford
   intends; a code whose check symbol does not match is a typo, never
   a different entry. Anything else is not a code at all. */
export function readTypedCode(input: string): TypedCode {
  const typed: string = input.toUpperCase().replace(/[\s-]+/gu, "");
  const match: RegExpMatchArray | null = TYPED_CODE.exec(typed);
  let result: TypedCode = { kind: "none" };
  if (match !== null) {
    const symbols: string = (match[1] ?? "").replace(/O/gu, "0").replace(/[IL]/gu, "1");
    const code: string = PUBLIC_ID_PREFIX + symbols;
    result = isValidPublicId(code) ? { kind: "code", code } : { kind: "typo", typed: input.trim() };
  }
  return result;
}
