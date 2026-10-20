/*
 * main.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 18:20:31, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The dictionary for readers, published under /dizionario/:
 *           the index by initial letter, the search by translation and
 *           one entry by its public code. Read only and open to all.
 * Routes:   #/indice/<letter>          the index [the first letter when
 *                                      none is given]
 *           #/cerca/<language>/<words> the search; language it, es, en
 *                                      or tutte
 *           #/voce/<code>              one entry
 * Contract: Text is always inserted with textContent [h[] from the
 *           editor], never innerHTML, so nothing typed by a contributor
 *           can become markup on a reader's page.
 * Decision: docs/decisions/0034-dictionary-for-readers.md
 */

import "./style.css";
import { h } from "../../editor/src/dom.ts";
import { PAGE, SEARCH_LIMIT, connect, entry, indexPage, letters, search } from "./db.ts";
import { LANGUAGES, isLang, messagesFor, partOfSpeech, type Lang, type Messages } from "./messages.ts";
import {
  OTHER_INITIAL, TRANSLATION_LANGUAGES, groupResults, orderLetters, parseRoute, readQuery, routeHash, senses,
  translationLine, type Entry, type GlossRow, type IndexEntry, type Route,
} from "./model.ts";

// Same key as the editor and the lexicon manager: one language choice
// for the whole site.
const LANG_KEY: string = "ligurian-keyboard.lang";

const header: HTMLElement = document.querySelector("#header") ?? document.body;
const main: HTMLElement = document.querySelector("#main") ?? document.body;
const footer: HTMLElement = document.querySelector("#footer") ?? document.body;

let lang: Lang = storedLang();
let t: Messages = messagesFor(lang);
let letterCounts: Map<string, number> | null = null;
let ticket: number = 0;

function storedLang(): Lang {
  let value: string | null = null;
  try {
    value = window.localStorage.getItem(LANG_KEY);
  } catch {
    value = null;
  }
  return isLang(value) ? value : "it";
}

function storeLang(value: Lang): void {
  try {
    window.localStorage.setItem(LANG_KEY, value);
  } catch {
    // The choice is then kept for this visit only.
  }
}

function letterName(letter: string): string {
  return letter === OTHER_INITIAL ? t.indexOther : letter;
}

function errorText(error: unknown): HTMLElement {
  return h("p", { class: "error-text", role: "alert" }, t.errLoad(error instanceof Error ? error.message : String(error)));
}

function drawHeader(route: Route): void {
  const menu: HTMLSelectElement = h("select", { class: "small", "aria-label": t.langLabel, title: t.langLabel });
  for (const language of LANGUAGES) {
    menu.append(h("option", { value: language.code, lang: language.code, selected: language.code === lang }, language.name));
  }
  menu.addEventListener("change", () => {
    if (isLang(menu.value)) {
      lang = menu.value;
      t = messagesFor(lang);
      storeLang(lang);
      void render();
    }
  });
  const tab = (href: string, label: string, current: boolean): HTMLElement =>
    h("a", { href, class: current ? "tab current" : "tab", "aria-current": current ? "page" : undefined }, label);
  header.replaceChildren(
    h("div", { class: "brand" },
      h("a", { href: "#/indice", class: "brand-title" }, t.appTitle),
      h("span", { class: "muted" }, t.appSubtitle)),
    h("nav", { class: "tabs" },
      tab("#/indice", t.navIndex, route.view === "index" || route.view === "entry"),
      tab("#/cerca/tutte/", t.navSearch, route.view === "search")),
    h("div", { class: "tools" }, menu),
  );
  footer.replaceChildren(
    h("a", { href: "../" }, t.navEditor), " · ",
    h("a", { href: "../tastiera/" }, t.navKeyboard), " · ",
    h("a", { href: "../admin/" }, t.navManager), " · ",
    h("a", { href: "https://github.com/Ignatz-CastroR/ligurian-keyboard" }, "ligurian-keyboard"), " · ",
    t.footer);
}

// The translations of one sense, language by language.
function senseBlock(glosses: readonly GlossRow[]): HTMLElement {
  const list: HTMLElement = h("ol", { class: "senses" });
  for (const sense of senses(glosses)) {
    const item: HTMLElement = h("li", { value: sense.number },
      sense.definition !== null && h("p", { class: "definition", lang: "it" }, sense.definition));
    if (sense.translations.length === 0) {
      item.append(h("p", { class: "muted" }, t.entryNoGlosses));
    } else {
      const dl: HTMLElement = h("dl", { class: "translations" });
      for (const group of sense.translations) {
        dl.append(h("dt", {}, group.language), h("dd", { lang: group.language }, group.glosses.join(", ")));
      }
      item.append(dl);
    }
    list.append(item);
  }
  return list;
}

async function drawIndex(route: Extract<Route, { view: "index" }>, mine: number): Promise<void> {
  if (letterCounts === null) {
    const rows = await letters();
    letterCounts = new Map(rows.map((r) => [r.initial, r.entries]));
  }
  if (mine !== ticket) {
    return;
  }
  const ordered: string[] = orderLetters([...letterCounts.keys()]);
  const letter: string | null = route.letter !== null && letterCounts.has(route.letter) ? route.letter : ordered[0] ?? null;
  const bar: HTMLElement = h("nav", { class: "letters", "aria-label": t.indexTitle });
  for (const initial of ordered) {
    const count: number = letterCounts.get(initial) ?? 0;
    bar.append(h("a", {
      href: routeHash({ view: "index", letter: initial }),
      class: initial === letter ? "letter current" : "letter",
      title: t.indexCount(count),
      "aria-current": initial === letter ? "true" : undefined,
    }, letterName(initial)));
  }
  main.replaceChildren(h("h1", {}, t.indexTitle), h("p", { class: "muted" }, t.indexIntro), bar);

  if (letter === null) {
    main.append(h("p", { class: "muted" }, t.indexEmpty));
  } else {
    const list: HTMLElement = h("ul", { class: "entries" });
    const more: HTMLButtonElement = h("button", { type: "button" }, t.indexMore);
    let last: IndexEntry | null = null;
    const load = async (): Promise<void> => {
      more.disabled = true;
      const page: IndexEntry[] = await indexPage(letter, last);
      for (const item of page) {
        const line: string = translationLine(item.glosses);
        list.append(h("li", {},
          h("a", { href: routeHash({ view: "entry", code: item.public_id }), class: "headword", lang: "lij" }, item.headword),
          item.part_of_speech !== null && h("span", { class: "pos" }, ` ${partOfSpeech(lang, item.part_of_speech)}`),
          line !== "" && h("span", { class: "line" }, line)));
      }
      last = page.at(-1) ?? last;
      // A short page is the last one; the counts may be older than the
      // page.
      more.hidden = page.length < PAGE;
      more.disabled = false;
    };
    more.addEventListener("click", () => void load().catch((error: unknown) => {
      more.disabled = false;
      if (mine === ticket) {
        main.append(errorText(error));
      }
    }));
    main.append(
      h("h2", {}, t.indexLetterTitle(letterName(letter)), h("span", { class: "muted count" }, ` ${t.indexCount(letterCounts.get(letter) ?? 0)}`)),
      list, h("div", { class: "more" }, more));
    await load();
  }
}

async function drawSearch(route: Extract<Route, { view: "search" }>, mine: number): Promise<void> {
  const input: HTMLInputElement = h("input", { type: "search", value: route.query, "aria-label": t.searchLabel,
    placeholder: t.searchLabel, autocomplete: "off", spellcheck: false, maxlength: 100 });
  const select: HTMLSelectElement = h("select", { "aria-label": t.searchLanguage, title: t.searchLanguage });
  select.append(h("option", { value: "", selected: route.language === null }, t.searchAll));
  for (const code of TRANSLATION_LANGUAGES) {
    select.append(h("option", { value: code, selected: route.language === code }, code));
  }
  const results: HTMLElement = h("div", { class: "results", "aria-live": "polite", "aria-busy": "false" });
  main.replaceChildren(h("h1", {}, t.searchTitle), h("p", { class: "muted" }, t.searchIntro),
    h("form", { class: "search", role: "search" }, input, select), results);
  input.focus();

  let timer: number | undefined;
  const update = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      // The reader may have left the search meanwhile.
      if (mine === ticket) {
        const next: Route = { view: "search", language: select.value === "" ? null : select.value, query: input.value };
        history.replaceState(null, "", routeHash(next));
        void show(next as Extract<Route, { view: "search" }>);
      }
    }, 250);
  };
  window.addEventListener("hashchange", () => window.clearTimeout(timer), { once: true });
  input.addEventListener("input", update);
  select.addEventListener("change", update);
  main.querySelector("form")?.addEventListener("submit", (event: Event) => event.preventDefault());

  let asked: number = 0;
  const show = async (current: Extract<Route, { view: "search" }>): Promise<void> => {
    const question: number = ++asked;
    const read = readQuery(current.query);
    const stillAsked = (): boolean => question === asked && mine === ticket;
    if (!stillAsked()) {
      return;
    }
    if (read.kind === "code") {
      window.location.hash = routeHash({ view: "entry", code: read.code });
    } else if (read.kind === "typo") {
      results.replaceChildren(h("p", { class: "muted" }, t.searchTypo));
    } else if (read.query === "") {
      results.replaceChildren();
    } else {
      results.setAttribute("aria-busy", "true");
      results.replaceChildren(h("p", { class: "muted" }, t.loading));
      try {
        const rows = await search(read.query, current.language);
        const found = groupResults(rows);
        if (stillAsked()) {
          const list: HTMLElement = h("ul", { class: "entries" });
          for (const item of found) {
            const matches: HTMLElement = h("ul", { class: "matches" });
            for (const m of item.matches) {
              matches.append(h("li", {},
                h("span", { class: "lang-tag" }, m.language), " ",
                h("strong", { lang: m.language }, m.gloss),
                h("span", { class: "muted" }, ` ${t.senseNumber(m.sense_number)}`),
                m.definition_it !== null && h("span", { class: "muted", lang: "it" }, ` ${m.definition_it}`)));
            }
            list.append(h("li", {},
              h("a", { href: routeHash({ view: "entry", code: item.public_id }), class: "headword", lang: "lij" }, item.headword),
              item.part_of_speech !== null && h("span", { class: "pos" }, ` ${partOfSpeech(lang, item.part_of_speech)}`),
              matches));
          }
          const summary: HTMLElement = found.length === 0
            ? h("p", { class: "muted" }, t.searchNone(read.query))
            : h("p", { class: "muted" }, t.searchResults(found.length));
          const capped: HTMLElement[] = rows.length >= SEARCH_LIMIT ? [h("p", { class: "muted" }, t.searchCapped(SEARCH_LIMIT))] : [];
          results.replaceChildren(summary, ...capped, list);
          results.setAttribute("aria-busy", "false");
        }
      } catch (error: unknown) {
        if (stillAsked()) {
          results.replaceChildren(errorText(error));
          results.setAttribute("aria-busy", "false");
        }
      }
    }
  };
  await show(route);
}

async function drawEntry(route: Extract<Route, { view: "entry" }>, mine: number): Promise<void> {
  const read = readQuery(route.code);
  const found: Entry | null = read.kind === "code" ? await entry(read.code) : null;
  if (mine !== ticket) {
    return;
  }
  const back: HTMLElement = h("p", {}, h("a", { href: "#/indice" }, t.entryBack));
  if (found === null) {
    main.replaceChildren(back, h("p", { class: "muted" }, t.entryNotFound));
  } else {
    const facts: HTMLElement = h("dl", { class: "facts" },
      h("dt", {}, t.entryCode), h("dd", { class: "mono" }, found.public_id),
      h("dt", {}, t.entryVariety), h("dd", {}, found.variety),
      h("dt", {}, t.entryOrthography), h("dd", {}, found.orthography));
    const forms: HTMLElement = h("ul", { class: "forms" });
    for (const form of found.forms) {
      forms.append(h("li", {}, h("span", { lang: "lij" }, form.form),
        form.grammatical_tag !== null && h("span", { class: "muted" }, ` ${form.grammatical_tag}`),
        form.is_base && h("span", { class: "tag" }, t.entryBase)));
    }
    main.replaceChildren(back,
      h("h1", { class: "entry-title", lang: "lij" }, found.headword,
        found.part_of_speech !== null && h("span", { class: "pos" }, ` ${partOfSpeech(lang, found.part_of_speech)}`)),
      facts,
      h("h2", {}, t.entrySenses),
      found.glosses.length === 0 ? h("p", { class: "muted" }, t.entryNoSenses) : senseBlock(found.glosses),
      h("h2", {}, t.entryForms), forms,
      h("p", { class: "muted small" }, h("a", { href: `../admin/#/entry/${found.id}` }, t.entryEdit)));
    document.title = `${found.headword} · ${t.appTitle}`;
  }
}

async function render(): Promise<void> {
  const mine: number = ++ticket;
  const route: Route = parseRoute(window.location.hash);
  document.documentElement.lang = lang;
  document.title = t.appTitle;
  drawHeader(route);
  main.replaceChildren(h("p", { class: "muted" }, t.loading));
  try {
    if (route.view === "index") {
      await drawIndex(route, mine);
    } else if (route.view === "search") {
      await drawSearch(route, mine);
    } else {
      await drawEntry(route, mine);
    }
  } catch (error: unknown) {
    if (mine === ticket) {
      main.replaceChildren(errorText(error));
    }
  }
}

function start(): void {
  const url: string | undefined = import.meta.env.VITE_SUPABASE_URL;
  const key: string | undefined = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (url === undefined || url === "" || key === undefined || key === "") {
    main.replaceChildren(h("p", { class: "error-text" }, t.errNotConfigured));
  } else {
    connect(url, key);
    window.addEventListener("hashchange", () => void render());
    void render();
  }
}

start();
