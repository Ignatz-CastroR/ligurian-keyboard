/*
 * corpus.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 10:24:47, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of the corpus counter: words [count.ts], the dump
 *           reader and markup stripper [wikitext.ts], and the frequency
 *           list with its effect on a snapshot [frequency-list.ts].
 * Updated:  2026/10/17, 11:29:40: a word needs a letter; the rows in
 *           the list's orthography are reported.
 * Method:   Every wikitext and dump below is written for these tests,
 *           with spellings from the test fixture [the Académia's
 *           alphabet page]; no Wikipedia text is copied.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Lexicon } from "../../engine/src/lexicon.ts";
import { convertToken } from "../../engine/src/convert.ts";
import { addCounts, frequencyKey, splitAtApostrophes, words } from "../src/count.ts";
import { isArticle, PageSplitter, parsePage, stripWikitext, type DumpPage } from "../src/wikitext.ts";
import {
  applyFrequencies, formatFrequencyList, readFrequencyList, type FrequencyList,
} from "../src/frequency-list.ts";

const FIXTURE: string = readFileSync(new URL("../../data/fixtures/test-lexicon.tsv", import.meta.url), "utf8");

function countsOf(text: string): Map<string, number> {
  const counts: Map<string, number> = new Map();
  addCounts(text, counts);
  return counts;
}

function list(counts: Record<string, number>, orthography: string = "ofiçiâ"): FrequencyList {
  return {
    source: "test corpus",
    orthography,
    counted: "2026/10/17 16:24:47 UTC",
    counts: new Map(Object.entries(counts)),
  };
}

/* ---------------------------------------------------------------- words */

test("a frequency key ignores capitals and the kind of apostrophe, never a letter or a mark", () => {
  assert.equal(frequencyKey("Zêna"), "zêna");
  assert.equal(frequencyKey("L’ægua"), "l'ægua");
  assert.equal(frequencyKey("ZÊNA"), "zêna", "decomposed input is composed first");
  assert.notEqual(frequencyKey("pénna"), frequencyKey("penna"));
  assert.notEqual(frequencyKey("pénna"), frequencyKey("pénn-a"));
});

test("words keep Ligurian letters, inner hyphens and edge apostrophes; digits and foreign letters split or drop", () => {
  assert.deepEqual(words("A Zêna, a canpànn-a da çitæ!"), ["a", "zêna", "a", "canpànn-a", "da", "çitæ"]);
  assert.deepEqual(words("'na pénna - e pe' scrive"), ["'na", "pénna", "e", "pe'", "scrive"]);
  assert.deepEqual(words("1915 anni2026 x"), ["anni", "x"]);
  assert.deepEqual(words("Łódź e Zêna"), ["e", "zêna"], "a word with a letter Ligurian never writes is not counted");
  assert.deepEqual(words("—tagiæn—"), ["tagiæn"]);
  assert.deepEqual(words("' '' - -- 'n zêna '"), ["'n", "zêna"], "a stray apostrophe or hyphen is never a word");
});

test("an elided word counts whole and in its parts", () => {
  assert.deepEqual(splitAtApostrophes("l'ægua"), ["l'", "ægua"]);
  assert.deepEqual(splitAtApostrophes("'na"), ["'na"]);
  const counts: Map<string, number> = countsOf("L'ægua e l’ægua; ægua.");
  assert.equal(counts.get("l'ægua"), 2);
  assert.equal(counts.get("l'"), 2);
  assert.equal(counts.get("ægua"), 3);
});

/* ------------------------------------------------------------- wikitext */

test("markup is stripped and the prose kept", () => {
  const wikitext: string = [
    "{{Infobox çitæ|nomme=Zêna|{{lang|lij|Zêna}}}}",
    "'''Zêna''' a l'é a [[Liguria|çitæ]] ciù grande, cfr. [[pénna]].<ref name=\"a\">{{cita|pénna}}</ref>",
    "== Stöia ==",
    "* [https://example.org/ a pénn-a] e [https://example.org/bare]",
    "{| class=\"wikitable\"",
    "| pénna || pénna",
    "|}",
    "<!-- pénna pénna -->[[File:Zena.jpg|thumb|A [[canpànn-a]] da çitæ]]",
    "[[Categorîa:Çitæ da Liguria]] [[en:Genoa]] __NOTOC__ &nbsp;fin&amp;",
    "<math>x^2</math> <code>pénna</code> <ref name=\"b\" />",
  ].join("\n");
  const prose: string = stripWikitext(wikitext);
  assert.deepEqual(words(prose), [
    "zêna", "a", "l'é", "a", "çitæ", "ciù", "grande", "cfr", "pénna",
    "stöia", "a", "pénn-a", "e",
    "fin",
  ]);
});

test("unclosed markup never hangs the stripper and keeps the rest of the article", () => {
  const prose: string = stripWikitext("pénna {{rotto|{| tabella [[senza fin <!-- commento");
  assert.ok(words(prose).includes("pénna"));
});

test("the dump reader keeps articles only and survives pieces cut anywhere", () => {
  const page = (title: string, ns: number, text: string, redirect: boolean = false): string =>
    `  <page>\n    <title>${title}</title>\n    <ns>${ns}</ns>\n    <id>1</id>\n`
    + (redirect ? `    <redirect title="Zêna" />\n` : "")
    + `    <revision>\n      <text bytes="9" xml:space="preserve">${text}</text>\n    </revision>\n  </page>\n`;
  const dump: string = `<mediawiki xmlns="http://www.mediawiki.org/xml/export-0.11/">\n  <siteinfo></siteinfo>\n`
    + page("Zêna", 0, "&lt;ref&gt;nòtta&lt;/ref&gt;A çitæ &amp;amp; a pénna")
    + page("Zena", 0, "#REDIRECT [[Zêna]]", true)
    + page("Discuscion:Zêna", 1, "pénna pénna")
    + page("Pénna", 0, "A pénna")
    + "</mediawiki>\n";

  for (const size of [1, 7, 64, dump.length]) {
    const splitter: PageSplitter = new PageSplitter();
    const pages: DumpPage[] = [];
    for (let at: number = 0; at < dump.length; at += size) {
      pages.push(...splitter.push(dump.slice(at, at + size)));
    }
    assert.deepEqual(pages.map((p) => p.title), ["Zêna", "Zena", "Discuscion:Zêna", "Pénna"], `pieces of ${size}`);
    const articles: DumpPage[] = pages.filter(isArticle);
    assert.deepEqual(articles.map((p) => p.title), ["Zêna", "Pénna"], `pieces of ${size}`);
    assert.equal(articles[0]?.text, "<ref>nòtta</ref>A çitæ &amp; a pénna", "XML entities decoded once");
    assert.deepEqual(words(stripWikitext(articles[0]?.text ?? "")), ["a", "çitæ", "a", "pénna"]);
  }
  assert.equal(parsePage("<page><title>X</title><ns>0</ns><revision><text/></revision>").text, "");
});

/* ------------------------------------------------------ frequency list */

test("the frequency list is written sorted, without rare words, and reads back identically", () => {
  const counts: Map<string, number> = new Map([["zêna", 9], ["a", 40], ["pénna", 2], ["rara", 1]]);
  const text: string = formatFrequencyList({ ...list({}), counts });
  const rows: string[] = text.split("\n").filter((l) => l !== "" && !l.startsWith("#"));
  assert.deepEqual(rows, ["form\tcount", "a\t40", "pénna\t2", "zêna\t9"]);
  const back = readFrequencyList(text);
  assert.deepEqual(back.problems, []);
  assert.equal(back.list.source, "test corpus");
  assert.equal(back.list.orthography, "ofiçiâ");
  assert.equal(back.list.counted, "2026/10/17 16:24:47 UTC");
  assert.deepEqual([...back.list.counts], [["a", 40], ["pénna", 2], ["zêna", 9]]);
});

test("a damaged frequency list reports every bad line by number", () => {
  const text: string = [
    "# Source: test", "# Counted: now", "form\tcount",
    "zêna\t3", "Zêna\t3", "pénna\t0", "pénna\tmolte", "zêna\t4", "uno\tdue\ttre", "x1\t5", "'\t633", "-\t2",
  ].join("\n");
  const { problems } = readFrequencyList(text);
  assert.deepEqual(problems.map((p) => p.line), [5, 6, 7, 8, 9, 10, 11, 12, 0]);
  assert.match(problems.at(-1)?.message ?? "", /Orthography/u);
});

test("corpus counts are added to the snapshot's freq, in the list's orthography only", () => {
  const snapshot: string = [
    "# License: CC BY-SA 4.0",
    "form\tfreq\tvariety\torthography\tstatus",
    "pénna\t1\tzeneize\tofiçiâ\tapproved",
    "pénn-a\t1\tzeneize\tofiçiâ\tapproved",
    "Zêna\t5\tzeneize\tofiçiâ\tapproved",
    "pénna\t1\tzeneize\tunitäia\tapproved",
    "nonvista\t1\tzeneize\tofiçiâ\tapproved",
    "",
  ].join("\n");
  const { tsv, eligible, matched } = applyFrequencies(snapshot, list({ "pénna": 3, "pénn-a": 40, "zêna": 100 }));
  assert.equal(eligible, 4, "four rows in ofiçiâ, the unitäia row is not one of them");
  assert.equal(matched, 3, "three of them found in the corpus");
  assert.deepEqual(tsv.split("\n"), [
    "# License: CC BY-SA 4.0",
    "form\tfreq\tvariety\torthography\tstatus",
    "pénna\t4\tzeneize\tofiçiâ\tapproved",
    "pénn-a\t41\tzeneize\tofiçiâ\tapproved",
    "Zêna\t105\tzeneize\tofiçiâ\tapproved",
    "pénna\t1\tzeneize\tunitäia\tapproved",
    "nonvista\t1\tzeneize\tofiçiâ\tapproved",
    "",
  ]);
});

test("end to end: the corpus decides which spelling of 'penna' the editor offers first", () => {
  // With every freq at 1, the fixture's two spellings come alphabetically.
  assert.deepEqual(convertToken(Lexicon.fromTsv(FIXTURE), "penna").candidates, ["pénn-a", "pénna"]);

  const counts: Map<string, number> = countsOf("Unna pénna, doe pénne; a pénna e o calamâ. A pénn-a da galinn-a. A pénna.");
  const ranked: Lexicon = Lexicon.fromTsv(applyFrequencies(FIXTURE, { ...list({}), counts }).tsv);
  assert.deepEqual(ranked.errors, []);
  assert.deepEqual(convertToken(ranked, "penna").candidates, ["pénna", "pénn-a"], "seen three times against once");
  assert.equal(ranked.size, Lexicon.fromTsv(FIXTURE).size, "no form gained or lost");
});
