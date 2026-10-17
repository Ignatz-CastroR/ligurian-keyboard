/*
 * wikitext.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 09:52:40, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Turn a MediaWiki XML dump into the plain prose of its
 *           articles: split the dump into pages, keep the articles
 *           [namespace 0, not redirects], and strip the wiki markup
 *           from their text.
 *           Decision: docs/decisions/0027-real-frequencies.md
 * Contract: Pure functions, no I/O; the caller feeds the dump in pieces
 *           of any size to a PageSplitter. The markup stripper is a
 *           deliberate approximation, built for word counting, not for
 *           display: it drops what is not running prose [templates,
 *           tables, references, file and category links, interwiki
 *           links, HTML elements that hold code or formulas] and keeps
 *           the visible text of links, headings and lists. A few words
 *           of markup that slip through cost nothing, because only
 *           valid Ligurian words are counted and a word is ranked only
 *           against spellings sharing its ASCII key.
 */

export interface DumpPage {
  title: string;
  namespace: number;
  redirect: boolean;
  text: string;          // the wikitext, XML entities already decoded
}

// Splits a dump into pages as its text arrives, so a dump of any size
// is read with memory for one page at a time.
export class PageSplitter {
  private buffer: string = "";

  // Feed the next piece of the dump; returns the pages it completed.
  public push(chunk: string): DumpPage[] {
    this.buffer += chunk;
    const pages: DumpPage[] = [];
    let end: number = this.buffer.indexOf("</page>");
    while (end !== -1) {
      const start: number = this.buffer.lastIndexOf("<page>", end);
      if (start !== -1) {
        pages.push(parsePage(this.buffer.slice(start, end)));
      }
      this.buffer = this.buffer.slice(end + "</page>".length);
      end = this.buffer.indexOf("</page>");
    }
    // Keep only the unfinished page; drop the dump header before it.
    const open: number = this.buffer.lastIndexOf("<page>");
    this.buffer = open === -1 ? this.buffer.slice(-16) : this.buffer.slice(open);
    return pages;
  }
}

export function parsePage(xml: string): DumpPage {
  const title: string = decodeXml(firstMatch(xml, /<title>([\s\S]*?)<\/title>/u));
  const namespace: number = Number(firstMatch(xml, /<ns>(-?\d+)<\/ns>/u) || "NaN");
  const redirect: boolean = /<redirect[\s/>]/u.test(xml);
  const text: string = decodeXml(firstMatch(xml, /<text\b[^>]*>([\s\S]*?)<\/text>/u));
  return { title, namespace, redirect, text };
}

// Only real articles feed the counts.
export function isArticle(page: DumpPage): boolean {
  return page.namespace === 0 && !page.redirect && page.text !== "";
}

function firstMatch(text: string, pattern: RegExp): string {
  return pattern.exec(text)?.[1] ?? "";
}

// The five entities XML escapes in a dump, plus numeric ones.
export function decodeXml(text: string): string {
  return text.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-fA-F]+);/gu, (whole: string, name: string): string => {
    return entityValue(name) ?? whole;
  });
}

// HTML entities as editors type them inside wikitext.
const NAMED_ENTITIES: ReadonlyMap<string, string> = new Map<string, string>([
  ["lt", "<"], ["gt", ">"], ["quot", "\""], ["apos", "'"], ["amp", "&"],
  ["nbsp", " "], ["ensp", " "], ["emsp", " "], ["thinsp", " "],
  ["ndash", " "], ["mdash", " "], ["hellip", " "],
  ["laquo", " "], ["raquo", " "], ["lsquo", "'"], ["rsquo", "'"],
  ["ldquo", " "], ["rdquo", " "], ["shy", ""],
]);

function entityValue(name: string): string | undefined {
  let value: string | undefined = NAMED_ENTITIES.get(name);
  if (value === undefined && name.startsWith("#")) {
    const code: number = name.startsWith("#x") || name.startsWith("#X")
      ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
    if (Number.isInteger(code) && code > 0 && code <= 0x10FFFF) {
      value = String.fromCodePoint(code);
    }
  }
  return value;
}

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&([a-zA-Z]+|#\d+|#[xX][0-9a-fA-F]+);/gu, (whole: string, name: string): string => {
    return entityValue(name) ?? whole;
  });
}

// HTML-like elements whose content is never prose.
const DROPPED_ELEMENTS: readonly string[] = [
  "ref", "math", "chem", "ce", "code", "pre", "syntaxhighlight", "source",
  "score", "timeline", "gallery", "hiero", "graph", "mapframe", "maplink",
  "templatestyles", "imagemap", "inputbox", "categorytree", "poem-source",
];

// Strip wiki markup, leaving prose. Applied to one article at a time.
export function stripWikitext(wikitext: string): string {
  let text: string = wikitext.replace(/\r\n?/gu, "\n");

  // Comments, then elements whose content goes, then self-closing tags.
  text = text.replace(/<!--[\s\S]*?(?:-->|$)/gu, " ");
  for (const name of DROPPED_ELEMENTS) {
    text = text.replace(new RegExp(`<${name}\\b[^>]*/>`, "giu"), " ");
    text = text.replace(new RegExp(`<${name}\\b[^>]*>[\\s\\S]*?</${name}\\s*>`, "giu"), " ");
  }

  // Templates, template parameters and tables, innermost first, until
  // none is left, since each may hold the others.
  let outer: string;
  do {
    outer = text;
    text = removeNested(text, /\{\{\{[^{}]*\}\}\}/gu);
    text = removeNested(text, /\{\{[^{}]*\}\}/gu);
    text = removeNested(text, /\{\|(?:(?!\{\|)[\s\S])*?\|\}/gu);
  } while (text !== outer);

  // Internal links, innermost first, so a caption's own links are
  // resolved before the file link around them is dropped.
  let before: string;
  do {
    before = text;
    text = text.replace(/\[\[([^[\]]*)\]\]/gu, (_whole: string, inner: string): string => linkText(inner));
  } while (text !== before);

  // External links keep their label; bare addresses go.
  text = text.replace(/\[(?:https?:|ftp:|mailto:|\/\/)[^\s\]]*(?:\s+([^\]]*))?\]/giu,
    (_whole: string, label: string | undefined): string => ` ${label ?? ""} `);
  text = text.replace(/(?:https?|ftp):\/\/\S+/giu, " ");

  // Remaining tags, behavior switches, bold and italic quotes.
  text = text.replace(/<\/?[a-zA-Z][^>]*>/gu, " ");
  text = text.replace(/__[A-Z]+__/gu, " ");
  text = text.replace(/'{2,}/gu, "");

  // Heading marks and the markup at the start of list and table lines.
  text = text.replace(/^=+\s*(.*?)\s*=+\s*$/gmu, "$1");
  text = text.replace(/^[*#:;]+/gmu, " ");
  text = text.replace(/^-{4,}/gmu, " ");

  return decodeHtmlEntities(text);
}

function removeNested(text: string, innermost: RegExp): string {
  let result: string = text;
  let before: string;
  do {
    before = result;
    result = result.replace(innermost, " ");
  } while (result !== before);
  return result;
}

// [[target]] → target; [[target|label]] → label; a target with a
// namespace or language prefix [File:, Categorîa:, en:] goes entirely,
// since its text is a file name, a category or a foreign title. A
// leading colon, [[:Categorîa:X]], links to the page instead of
// categorizing; it is treated the same, as navigation, not prose.
function linkText(inner: string): string {
  const bar: number = inner.indexOf("|");
  const target: string = (bar === -1 ? inner : inner.slice(0, bar)).trim();
  const label: string = bar === -1 ? target : inner.slice(inner.lastIndexOf("|") + 1);
  let result: string = ` ${label} `;
  if (/^:?[^:\s][^:]*:/u.test(target) && !/^:?[^:]*\s[^:]*:/u.test(target)) {
    result = " ";
  }
  return result;
}
