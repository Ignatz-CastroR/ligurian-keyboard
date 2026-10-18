/*
 * search.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 20:21:50, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/17, 07:31:51: the latest additions below the
 *           search field.
 * Purpose:  Search the dictionary by typing plain ASCII. Open to
 *           everyone: signed out visitors see the published entries.
 *           While the field is empty, the 20 approved lemmas added most
 *           recently are listed below it; typing replaces them with the
 *           results, and emptying the field brings them back.
 * Updated:  2026/10/18, 09:12:06: a public code typed into the field,
 *           such as LIJ-7K3Q9MDXK, finds its entry, and a code with a
 *           wrong check character is reported as a typo; every lemma
 *           listed shows its code [decision 0030].
 */

import type { Context } from "../context.ts";
import type { Lemma } from "../types.ts";
import { latestLemmas, lemmasWithPublicId, searchKeyFor, searchLemmas } from "../db.ts";
import { readTypedCode, type TypedCode } from "../public-id.ts";
import { formatDateTime } from "../forms.ts";
import { appendAll, clear, describeError, h, posLabel, statusBadge } from "../ui.ts";

const DEBOUNCE_MS: number = 250;

// Does this query search for something [a word or a code]?
function isActive(query: string): boolean {
  return readTypedCode(query).kind !== "none" || searchKeyFor(query) !== "";
}

export async function renderSearch(ctx: Context, root: HTMLElement, initialQuery: string): Promise<void> {
  const { t } = ctx;
  const input: HTMLInputElement = h("input", {
    type: "search", class: "search-box", value: initialQuery,
    placeholder: t.searchPlaceholder, autocomplete: "off", spellcheck: "false",
    "aria-label": t.navSearch,
  });
  const keyLine: HTMLElement = h("p", { class: "muted key-line" });
  const results: HTMLElement = h("div", { class: "results" });
  const latestList: HTMLElement = h("div", {}, h("p", { class: "muted" }, t.loading));
  const latestSection: HTMLElement = h("section", { class: "latest", "aria-labelledby": "latest-title" },
    h("h3", { id: "latest-title" }, t.latestTitle),
    h("p", { class: "muted small-text" }, t.latestIntro),
    latestList,
  );

  appendAll(root,
    h("h2", {}, t.navSearch),
    input,
    h("p", { class: "muted" }, t.searchHint),
    h("p", { class: "muted small-text" }, t.searchCodeHint),
    ctx.userId === null && h("p", { class: "muted" }, t.searchPublicNote),
    keyLine,
    results,
    latestSection,
  );
  latestSection.hidden = isActive(initialQuery);
  void loadLatest(ctx, latestList);

  // Only the answer to the latest query may be drawn: a slow early
  // answer must not overwrite a fast later one.
  let latest: number = 0;
  let timer: number | undefined;

  const runSearch = async (): Promise<void> => {
    const query: string = input.value;
    const ticket: number = ++latest;
    const typed: TypedCode = readTypedCode(query);
    const key: string = typed.kind === "none" ? searchKeyFor(query) : "";
    history.replaceState(null, "", `#/search/${encodeURIComponent(query)}`);
    latestSection.hidden = isActive(query);
    if (typed.kind === "typo") {
      keyLine.textContent = "";
      results.replaceChildren(h("p", { class: "error-text" }, t.searchCodeTypo(typed.typed)));
    } else if (typed.kind === "none" && key === "") {
      keyLine.textContent = "";
      clear(results);
    } else {
      keyLine.textContent = typed.kind === "code" ? t.searchCode(typed.code) : t.searchKey(key);
      try {
        const lemmas: Lemma[] = typed.kind === "code" ? await lemmasWithPublicId(typed.code) : await searchLemmas(query);
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

// The latest additions, newest first, each with the date it was added.
async function loadLatest(ctx: Context, target: HTMLElement): Promise<void> {
  const { t } = ctx;
  try {
    const lemmas: Lemma[] = await latestLemmas();
    if (lemmas.length === 0) {
      target.replaceChildren(h("p", { class: "muted" }, t.latestEmpty));
    } else {
      const list: HTMLElement = h("ol", { class: "lemma-list latest-list" });
      for (const lemma of lemmas) {
        list.append(h("li", {},
          h("time", { class: "muted small-text nowrap", datetime: lemma.created_at }, formatDateTime(lemma.created_at)),
          h("span", {},
            h("a", { href: `#/entry/${lemma.id}`, class: "headword" }, lemma.headword),
            h("span", { class: "muted" }, ` ${posLabel(t, lemma.part_of_speech)} · ${lemma.variety} · ${lemma.orthography} `),
            h("span", { class: "muted mono", title: t.publicIdNote }, lemma.public_id)),
        ));
      }
      target.replaceChildren(list);
    }
  } catch (error: unknown) {
    target.replaceChildren(h("p", { class: "error-text" }, describeError(t, error)));
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
        h("span", { class: "muted mono", title: t.publicIdNote }, `${lemma.public_id} `),
        (ctx.userId !== null) && statusBadge(t, lemma),
      ));
    }
    results.append(list);
  }
}
