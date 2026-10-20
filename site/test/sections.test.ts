/*
 * sections.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 02:38:50, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of the site's five sections apart from the browser:
 *           their order and names in the three languages, the address
 *           of each section from every other, which must reach the
 *           folder the site build gives it, and the words of the
 *           dictionary's size.
 * Decision: docs/decisions/0035-site-in-five-sections.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LANGUAGES } from "../../admin/src/messages.ts";
import { BAR_LABEL, SECTIONS, formatCount, isSiteLang, sectionHref, statsText, type SectionId } from "../sections.ts";

const IDS: SectionId[] = SECTIONS.map((s) => s.id);

test("five sections, always in the same order, named in each language of the site", () => {
  assert.deepEqual(IDS, ["editor", "dictionary", "manager", "keyboard", "users"]);
  assert.deepEqual(SECTIONS.map((s) => s.name.it), ["Scrivi", "Dizionario", "Gestore del lessico", "Tastiera", "Utenti"]);
  assert.deepEqual(SECTIONS.map((s) => s.name.en), ["Write", "Dictionary", "Lexicon manager", "Keyboard", "Users"]);
  assert.deepEqual(SECTIONS.map((s) => s.name.es), ["Escribir", "Diccionario", "Gestor del léxico", "Teclado", "Usuarios"]);
  for (const { code } of LANGUAGES) {
    assert.ok(isSiteLang(code), code);
    assert.ok(BAR_LABEL[code].length > 0);
  }
  assert.equal(isSiteLang("fr"), false);
  assert.equal(isSiteLang(null), false);
});

test("every section reaches every other by a relative address, the editor at the root and the rest one folder below", () => {
  const site = (from: SectionId): string => {
    const folder: string = SECTIONS.find((s) => s.id === from)?.folder ?? "";
    return folder === "" ? "/" : `/${folder}/`;
  };
  for (const from of IDS) {
    for (const to of IDS) {
      const resolved: string = new URL(sectionHref(from, to), `https://example.org${site(from)}`).pathname;
      assert.equal(resolved, site(to), `${from} → ${to}`);
    }
  }
  assert.equal(sectionHref("editor", "users"), "./utenti/");
  assert.equal(sectionHref("dictionary", "editor"), "../");
});

test("each folder is the one the site build publishes", () => {
  const assemble: string = readFileSync(new URL("../../tools/assemble-site.ts", import.meta.url), "utf8");
  for (const section of SECTIONS.filter((s) => s.folder !== "" && s.id !== "keyboard")) {
    assert.match(assemble, new RegExp(`"_site/${section.folder}"`, "u"), section.id);
  }
  assert.match(assemble, /_site\/tastiera\//u);
});

test("counts and the dictionary's size are written as each language writes numbers, singular when one", () => {
  const stats = { lemmas: 28175, forms: 1, translations: 37773 };
  assert.equal(statsText("it", stats), "Nel dizionario: 28.175 lemmi · 1 forma · 37.773 traduzioni");
  assert.equal(statsText("en", stats), "In the dictionary: 28,175 lemmas · 1 form · 37,773 translations");
  assert.equal(statsText("es", { lemmas: 1, forms: 2, translations: 0 }), "En el diccionario: 1 lema · 2 formas · 0 traducciones");
  assert.deepEqual([formatCount("it", 65883), formatCount("en", 65883), formatCount("es", 65883)], ["65.883", "65,883", "65.883"]);
});
