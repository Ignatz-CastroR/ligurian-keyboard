/*
 * install-page.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 14:04:31, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of the Android install page [editor/public/tastiera/]:
 *           its two links at the top, the editor and the dictionary,
 *           follow the language being read. The page's own script runs
 *           here against a minimal stand-in for the browser.
 * Method:   The inline script is taken from the page as it is published
 *           and run with node:vm; only the parts of document and window
 *           it touches are imitated.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { LANGUAGES } from "../../admin/src/messages.ts";

const PAGE: string = readFileSync(new URL("../public/tastiera/index.html", import.meta.url), "utf8");
const SCRIPT: string = PAGE.match(/<script>([\s\S]*?)<\/script>/u)?.[1] ?? "";

interface FakeLink { textContent: string }
interface Run {
  nav: Record<string, string>;
  editor: FakeLink;
  dictionary: FakeLink;
  stored: Map<string, string>;
  setHash: (hash: string) => void;
  clickLink: () => void;
}

// Run the page's script with the address ending in `hash` and the
// site's stored language `stored`.
function run(hash: string, stored: string | null): Run {
  const editor: FakeLink = { textContent: "" };
  const dictionary: FakeLink = { textContent: "" };
  const nav: Record<string, string> = {};
  const storage: Map<string, string> = new Map(stored === null ? [] : [["ligurian-keyboard.lang", stored]]);
  const listeners: Map<string, (event: unknown) => void> = new Map();
  const navListeners: ((event: unknown) => void)[] = [];
  const location = { hash };
  class Element {
    public closest(): unknown {
      return {};
    }
  }
  const navElement = {
    setAttribute: (name: string, value: string): void => {
      nav[name] = value;
    },
    querySelector: (selector: string): FakeLink | null =>
      selector.includes("editor") ? editor : selector.includes("dictionary") ? dictionary : null,
    addEventListener: (_type: string, listener: (event: unknown) => void): void => {
      navListeners.push(listener);
    },
  };
  const window = {
    location,
    localStorage: {
      getItem: (key: string): string | null => storage.get(key) ?? null,
      setItem: (key: string, value: string): void => {
        storage.set(key, value);
      },
    },
    addEventListener: (type: string, listener: (event: unknown) => void): void => {
      listeners.set(type, listener);
    },
  };
  const document = {
    getElementById: (id: string): unknown => (id === "site-links" ? navElement : null),
    querySelector: (): null => null,
  };
  const fetch = (): Promise<never> => Promise.reject(new Error("offline"));
  runInNewContext(SCRIPT, { window, document, fetch, Element });
  return {
    nav, editor, dictionary, stored: storage,
    setHash: (next: string): void => {
      location.hash = next;
      listeners.get("hashchange")?.({});
    },
    clickLink: (): void => {
      for (const listener of navListeners) {
        listener({ target: new Element() });
      }
    },
  };
}

test("the page links both the editor and the dictionary, and reads in Italian without its script", () => {
  assert.match(PAGE, /<a href="\.\.\/" data-link="editor">← Scrivi in ligure<\/a>/u);
  assert.match(PAGE, /<a href="\.\.\/admin\/" data-link="dictionary">Dizionario<\/a>/u);
  assert.match(PAGE, /<h1 id="it">/u);
  assert.match(PAGE, /<section id="en" lang="en">/u);
  assert.match(PAGE, /<section id="es" lang="es">/u);
  for (const code of ["it", "en", "es"]) {
    assert.match(PAGE, new RegExp(`<a href="#${code}" lang="${code}">`, "u"), code);
  }
  assert.notEqual(SCRIPT, "");
});

test("the links follow the section the address names, then the site's language, then Italian", () => {
  const cases: [string, string | null, string, string][] = [
    ["", null, "← Scrivi in ligure", "Dizionario"],
    ["#en", null, "← Write in Ligurian", "Dictionary"],
    ["#es", "it", "← Escribe en ligur", "Diccionario"],
    ["", "es", "← Escribe en ligur", "Diccionario"],
    ["", "en", "← Write in Ligurian", "Dictionary"],
    ["#it", "es", "← Scrivi in ligure", "Dizionario"],
    ["#fr", "xx", "← Scrivi in ligure", "Dizionario"],
  ];
  for (const [hash, stored, editor, dictionary] of cases) {
    const page: Run = run(hash, stored);
    assert.deepEqual([page.editor.textContent, page.dictionary.textContent], [editor, dictionary], `${hash} ${stored}`);
  }
  const english: Run = run("#en", null);
  assert.deepEqual([english.nav["lang"], english.nav["aria-label"]], ["en", "Ligurian lexicon"]);
});

test("moving to another section translates the links at once", () => {
  const page: Run = run("", null);
  page.setHash("#es");
  assert.equal(page.dictionary.textContent, "Diccionario");
  page.setHash("#en");
  assert.equal(page.editor.textContent, "← Write in Ligurian");
  page.setHash("#it");
  assert.equal(page.dictionary.textContent, "Dizionario");
});

test("following a link from a named section makes it the site's language; otherwise nothing is stored", () => {
  const spanish: Run = run("#es", "it");
  spanish.clickLink();
  assert.equal(spanish.stored.get("ligurian-keyboard.lang"), "es");
  const plain: Run = run("", null);
  plain.clickLink();
  assert.equal(plain.stored.has("ligurian-keyboard.lang"), false);
});

test("the page offers exactly the languages of the editor and the lexicon manager", () => {
  const codes: string[] = [...SCRIPT.matchAll(/^\s{4}(\w{2}): \{ nav:/gmu)].map((m) => m[1] ?? "");
  assert.deepEqual(codes, LANGUAGES.map((l) => l.code));
});
