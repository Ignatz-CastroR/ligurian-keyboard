/*
 * index.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/10, 21:08:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Public API of the conversion engine.
 */

export { skeleton, isPlainAscii } from "./skeleton.ts";
export { Lexicon, type LexiconEntry, type LoadError, type LookupFilter } from "./lexicon.ts";
export { convertToken, renderChoice, type Conversion, type ConversionKind } from "./convert.ts";
