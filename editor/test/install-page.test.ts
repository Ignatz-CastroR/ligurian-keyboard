/*
 * install-page.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 14:04:31, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of the Android install page [editor/public/tastiera/]:
 *           its two links at the top, the editor and the dictionary,
 *           follow the language being read. The page's own script runs
 *           here against a minimal stand-in for the browser.
 * Updated:  2026/10/18, 16:04:10: the links stay in view while the
 *           page scrolls.
 * Updated:  2026/10/20, 02:23:40: the bar of five sections: the same
 *           names, addresses and order as site/sections.ts, in every
 *           language, with this page marked [decision 0035].
 * Method:   The inline script is taken from the page as it is published
 *           and run with node:vm; only the parts of document and window
 *           it touches are imitated.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { LANGUAGES } from "../../admin/src/messages.ts";
import { BAR_LABEL, SECTIONS, sectionHref, type SectionId, type SiteLang } from "../../site/sections.ts";

const PAGE: string = readFileSync(new URL("../public/tastiera/index.html", import.meta.url), "utf8");
const SCRIPT: string = PAGE.match(/<script>([\s\S]*?)<\/script>/u)?.[1] ?? "";

interface FakeLink { textContent: string }
interface Run {
  nav: Record<string, string>;
  links: Record<SectionId, FakeLink>;
  names: () => string[];
  stored: Map<string, string>;
  setHash: (hash: string) => void;
  clickLink: () => void;
}

// Run the page's script with the address ending in `hash` and the
// site's stored language `stored`.
function run(hash: string, stored: string | null): Run {
  const links = Object.fromEntries(SECTIONS.map((s) => [s.id, { textContent: "" }])) as Record<SectionId, FakeLink>;
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
      links[(selector.match(/data-link="(\w+)"/u)?.[1] ?? "") as SectionId] ?? null,
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
    nav, links, stored: storage,
    names: (): string[] => SECTIONS.map((s) => links[s.id].textContent),
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

// The section names of site/sections.ts in one language.
const namesIn = (lang: SiteLang): string[] => SECTIONS.map((s) => s.name[lang]);

test("the page carries the five sections of the site, as site/sections.ts names them, and reads in Italian without its script", () => {
  const bar: string = PAGE.match(/<nav id="site-links"[^>]*>([\s\S]*?)<\/nav>/u)?.[1] ?? "";
  const links = [...bar.matchAll(/<a href="([^"]*)" class="([^"]*)" data-link="(\w+)"( aria-current="page")?>([^<]*)<\/a>/gu)];
  assert.deepEqual(links.map((m) => m[3]), SECTIONS.map((s) => s.id));
  assert.deepEqual(links.map((m) => m[1]), SECTIONS.map((s) => sectionHref("keyboard", s.id)));
  assert.deepEqual(links.map((m) => m[5]), namesIn("it"));
  assert.deepEqual(links.filter((m) => m[2]?.includes("current") === true && m[4] !== undefined).map((m) => m[3]), ["keyboard"]);
  assert.match(PAGE, new RegExp(`<nav id="site-links" aria-label="${BAR_LABEL.it}">`, "u"));
  assert.match(PAGE, /<link rel="stylesheet" href="\.\.\/site-bar\.css">/u);
  assert.match(PAGE, /<h1 id="it">/u);
  assert.match(PAGE, /<section id="en" lang="en">/u);
  assert.match(PAGE, /<section id="es" lang="es">/u);
  for (const code of ["it", "en", "es"]) {
    assert.match(PAGE, new RegExp(`<a href="#${code}" lang="${code}">`, "u"), code);
  }
  assert.notEqual(SCRIPT, "");
});

test("the language links stay at the top of the screen in every section", () => {
  const topbar: string = PAGE.match(/<div class="topbar">([\s\S]*?)<\/div>/u)?.[1] ?? "";
  assert.match(topbar, /<a href="#es" lang="es">/u);
  const rule: string = PAGE.match(/\.topbar \{([^}]*)\}/u)?.[1] ?? "";
  assert.match(rule, /position: sticky;/u);
  assert.match(rule, /top: 0;/u);
  assert.match(PAGE, /h1\[id\], section\[id\] \{ scroll-margin-top: [\d.]+rem; \}/u);
});

test("the sections follow the part the address names, then the site's language, then Italian, with site/sections.ts's names", () => {
  const cases: [string, string | null, SiteLang][] = [
    ["", null, "it"],
    ["#en", null, "en"],
    ["#es", "it", "es"],
    ["", "es", "es"],
    ["", "en", "en"],
    ["#it", "es", "it"],
    ["#fr", "xx", "it"],
  ];
  for (const [hash, stored, lang] of cases) {
    const page: Run = run(hash, stored);
    assert.deepEqual(page.names(), namesIn(lang), `${hash} ${stored}`);
    assert.deepEqual([page.nav["lang"], page.nav["aria-label"]], [lang, BAR_LABEL[lang]]);
  }
});

test("moving to another part of the page translates the sections at once", () => {
  const page: Run = run("", null);
  page.setHash("#es");
  assert.deepEqual(page.names(), namesIn("es"));
  page.setHash("#en");
  assert.deepEqual(page.names(), namesIn("en"));
  page.setHash("#it");
  assert.deepEqual(page.names(), namesIn("it"));
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
