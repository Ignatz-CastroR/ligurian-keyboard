/*
 * search.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/11, 20:21:50, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Search the dictionary by typing plain ASCII. Open to
 *           everyone: signed out visitors see the published entries.
 */

import type { Context } from "../context.ts";
import type { Lemma } from "../types.ts";
import { searchKeyFor, searchLemmas } from "../db.ts";
import { appendAll, clear, describeError, h, posLabel, statusBadge } from "../ui.ts";

const DEBOUNCE_MS: number = 250;

export async function renderSearch(ctx: Context, root: HTMLElement, initialQuery: string): Promise<void> {
  const { t } = ctx;
  const input: HTMLInputElement = h("input", {
    type: "search", class: "search-box", value: initialQuery,
    placeholder: t.searchPlaceholder, autocomplete: "off", spellcheck: "false",
    "aria-label": t.navSearch,
  });
  const keyLine: HTMLElement = h("p", { class: "muted key-line" });
  const results: HTMLElement = h("div", { class: "results" });

  appendAll(root,
    h("h2", {}, t.navSearch),
    input,
    h("p", { class: "muted" }, t.searchHint),
    ctx.userId === null && h("p", { class: "muted" }, t.searchPublicNote),
    keyLine,
    results,
  );

  // Only the answer to the latest query may be drawn: a slow early
  // answer must not overwrite a fast later one.
  let latest: number = 0;
  let timer: number | undefined;

  const runSearch = async (): Promise<void> => {
    const query: string = input.value;
    const ticket: number = ++latest;
    const key: string = searchKeyFor(query);
    keyLine.textContent = key === "" ? "" : t.searchKey(key);
    history.replaceState(null, "", `#/search/${encodeURIComponent(query)}`);
    if (key === "") {
      clear(results);
    } else {
      try {
        const lemmas: Lemma[] = await searchLemmas(query);
        if (ticket === latest) {
          drawResults(ctx, results, lemmas);
        }
      } catch (error: unknown) {
        if (ticket === latest) {
          results.replaceChildren(h("p", { class: "error-text" }, describeError(t, error)));
        }
      }
    }
  };

  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void runSearch(), DEBOUNCE_MS);
  });

  input.focus();
  if (initialQuery !== "") {
    await runSearch();
  }
}

function drawResults(ctx: Context, results: HTMLElement, lemmas: Lemma[]): void {
  const { t } = ctx;
  clear(results);
  if (lemmas.length === 0) {
    results.append(h("p", { class: "muted" }, t.searchNoResults));
  } else {
    const list: HTMLElement = h("ul", { class: "lemma-list" });
    for (const lemma of lemmas) {
      list.append(h("li", {},
        h("a", { href: `#/entry/${lemma.id}`, class: "headword" }, lemma.headword),
        h("span", { class: "muted" }, ` ${posLabel(t, lemma.part_of_speech)} · ${lemma.variety} · ${lemma.orthography} `),
        (ctx.userId !== null) && statusBadge(t, lemma),
      ));
    }
    results.append(list);
  }
}
