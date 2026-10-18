/*
 * public-id.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 09:29:02, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of admin/src/public-id.ts: Crockford's base 32 both
 *           ways, the check symbol, and how a code typed by a person is
 *           read. The database side is proven to agree in
 *           db/test/public-ids-backup.test.ts.
 * Decision: docs/decisions/0030-public-identifiers.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHECK_SYMBOLS, CROCKFORD_SYMBOLS, checkSymbol, crockfordSymbols, crockfordValue, isValidPublicId, readTypedCode,
} from "../src/public-id.ts";

const code = (body: string): string => `LIJ-${body}${checkSymbol(body) ?? ""}`;

test("the alphabets are Crockford's: 32 symbols without I, L, O, U; 37 check symbols", () => {
  assert.equal(CROCKFORD_SYMBOLS.length, 32);
  assert.equal(new Set(CROCKFORD_SYMBOLS).size, 32);
  for (const missing of ["I", "L", "O", "U"]) {
    assert.ok(!CROCKFORD_SYMBOLS.includes(missing), missing);
  }
  assert.equal(CHECK_SYMBOLS, `${CROCKFORD_SYMBOLS}*~$=U`);
});

test("symbols and values convert both ways, over the whole 40-bit range", () => {
  for (const value of [0, 1, 31, 32, 1023, 2 ** 32 + 7, 2 ** 40 - 1]) {
    const symbols: string = crockfordSymbols(value, 8);
    assert.equal(symbols.length, 8);
    assert.equal(crockfordValue(symbols), value, symbols);
  }
  assert.equal(crockfordSymbols(0, 8), "00000000");
  assert.equal(crockfordSymbols(2 ** 40 - 1, 8), "ZZZZZZZZ");
  assert.equal(crockfordValue("0O"), null);
  assert.equal(crockfordValue("I"), null);
});

test("the check symbol is the value modulo 37", () => {
  assert.equal(checkSymbol("00000000"), "0");
  assert.equal(checkSymbol("0000000Z"), "Z"); // 31
  assert.equal(checkSymbol("00000010"), "*"); // 32
  assert.equal(checkSymbol("00000014"), "U"); // 36
  assert.equal(checkSymbol("00000015"), "0"); // 37
  assert.equal(checkSymbol("0000001"), null);
  assert.equal(checkSymbol("0000000U"), null);
});

test("a valid code has the prefix, eight symbols and the right check symbol", () => {
  const good: string = code("7K3Q9MDX");
  assert.equal(good, "LIJ-7K3Q9MDXK");
  assert.ok(isValidPublicId(good));
  for (const bad of [
    "LIJ-7K3Q9MDX0", "lij-7k3q9mdxk", "LIJ7K3Q9MDXK", "LIJ-7K3Q9MDXKK", "LIJ-7K3Q9MDIK", "XYZ-7K3Q9MDXK", "",
  ]) {
    assert.equal(isValidPublicId(bad), false, bad);
  }
});

test("every single wrong symbol, and every swap of two neighbours, is caught", () => {
  const body: string = "7K3Q9MDX";
  const right: string = code(body);
  for (let i: number = 0; i < 8; i += 1) {
    for (const symbol of CROCKFORD_SYMBOLS) {
      if (symbol !== body[i]) {
        const wrong: string = `LIJ-${body.slice(0, i)}${symbol}${body.slice(i + 1)}${right.slice(12)}`;
        assert.equal(isValidPublicId(wrong), false, wrong);
      }
    }
  }
  for (let i: number = 0; i < 7; i += 1) {
    const swapped: string = body.slice(0, i) + body[i + 1] + body[i] + body.slice(i + 2);
    if (swapped !== body) {
      assert.equal(isValidPublicId(`LIJ-${swapped}${right.slice(12)}`), false, swapped);
    }
  }
});

test("a typed code is forgiven its case, spaces and hyphens anywhere, O for 0 and I or L for 1", () => {
  const right: string = code("10QZ0A1B");
  for (const typed of [right, right.toLowerCase(), `  ${right}  `, right.replace("-", ""), right.replace("-", " "),
    "LIJ 10QZ 0A1B " + right.slice(12), "LIJ - " + right.slice(4), "lij-10qz-0a1b-" + right.slice(12).toLowerCase(),
    right.replace(/0/gu, "O"), right.replace(/1/gu, "I"), right.replace(/1/gu, "l")]) {
    assert.deepEqual(readTypedCode(typed), { kind: "code", code: right }, typed);
  }
});

test("a code with a wrong check symbol is a typo; a word is not a code at all", () => {
  const right: string = code("7K3Q9MDX");
  const typo: string = right.slice(0, 12) + (right.endsWith("0") ? "1" : "0");
  assert.deepEqual(readTypedCode(typo), { kind: "typo", typed: typo });
  assert.deepEqual(readTypedCode("LIJ-7K3Q9MDUK"), { kind: "typo", typed: "LIJ-7K3Q9MDUK" });
  for (const word of ["zena", "pénna", "LIJ", "LIJ-7K3", "ligure", "LIJ-7K3Q9MDXK2", ""]) {
    assert.deepEqual(readTypedCode(word), { kind: "none" }, word);
  }
});
