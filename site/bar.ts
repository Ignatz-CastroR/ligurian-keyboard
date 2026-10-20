/*
 * bar.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 02:09:15, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The bar at the top of every page of the site: the five
 *           sections as large buttons, the current one marked, and the
 *           size of the published dictionary beneath them. Used by the
 *           editor, the dictionary, the lexicon manager and the Users
 *           section; the install page repeats it in static HTML.
 * Contract: Built with createElement and textContent only. The size is
 *           read from the database's dictionary_stats[] by a plain
 *           request with the publishable key, and only shown when it
 *           arrives: offline, or without the build settings, the bar
 *           shows the sections alone.
 * Decision: docs/decisions/0035-site-in-five-sections.md
 */

import "./bar.css";
import { BAR_LABEL, SECTIONS, sectionHref, statsText, type SectionId, type SiteLang, type Stats } from "./sections.ts";

let cachedStats: Promise<Stats | null> | null = null;

// The dictionary's size, asked once per page load.
export function loadStats(url: string | undefined, key: string | undefined): Promise<Stats | null> {
  if (cachedStats === null) {
    cachedStats = url === undefined || url === "" || key === undefined || key === ""
      ? Promise.resolve(null)
      : fetch(`${url}/rest/v1/rpc/dictionary_stats`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: "{}",
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((rows: unknown) => {
          const row = Array.isArray(rows) ? rows[0] as Record<string, unknown> | undefined : undefined;
          return row === undefined ? null : {
            lemmas: Number(row["lemmas"] ?? 0), forms: Number(row["forms"] ?? 0), translations: Number(row["translations"] ?? 0),
          };
        })
        .catch(() => null);
  }
  return cachedStats;
}

export function siteBar(current: SectionId, lang: SiteLang, stats: Promise<Stats | null>): HTMLElement {
  const bar: HTMLElement = document.createElement("div");
  bar.className = "site-bar";
  const nav: HTMLElement = document.createElement("nav");
  nav.setAttribute("aria-label", BAR_LABEL[lang]);
  for (const section of SECTIONS) {
    const link: HTMLAnchorElement = document.createElement("a");
    link.href = sectionHref(current, section.id);
    link.textContent = section.name[lang];
    link.className = section.id === current ? "site-section current" : "site-section";
    link.dataset["section"] = section.id;
    if (section.id === current) {
      link.setAttribute("aria-current", "page");
    }
    nav.append(link);
  }
  const size: HTMLElement = document.createElement("p");
  size.className = "site-size";
  size.hidden = true;
  void stats.then((value) => {
    if (value !== null) {
      size.textContent = statsText(lang, value);
      size.hidden = false;
    }
  });
  bar.append(nav, size);
  return bar;
}

// Put the bar at the very top of the page, replacing an earlier one.
export function mountSiteBar(current: SectionId, lang: SiteLang, stats: Promise<Stats | null>): void {
  const existing: Element | null = document.querySelector(".site-bar");
  const bar: HTMLElement = siteBar(current, lang, stats);
  if (existing === null) {
    document.body.prepend(bar);
  } else {
    existing.replaceWith(bar);
  }
}
