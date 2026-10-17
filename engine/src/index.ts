/*
 * index.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/10, 21:08:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/17, 12:06:10: splitElision and MAX_COMBINATIONS.
 * Purpose:  Public API of the conversion engine.
 */

export { skeleton, isPlainAscii } from "./skeleton.ts";
export { Lexicon, type LexiconEntry, type LoadError, type LookupFilter } from "./lexicon.ts";
export { convertToken, renderChoice, MAX_COMBINATIONS, type Conversion, type ConversionKind } from "./convert.ts";
export { splitElision } from "./elision.ts";
