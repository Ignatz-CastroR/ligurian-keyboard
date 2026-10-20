/*
 * sections.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 02:05:40, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The five sections of the site, the same everywhere: their
 *           names in the three languages, where each one lives, the
 *           address of each one from any other, and the words of the
 *           dictionary's size. Pure data and functions, no browser
 *           objects, tested in Node.
 * Contract: The install page /tastiera/ is static HTML and repeats these
 *           names by hand; a test keeps it identical to this file.
 * Decision: docs/decisions/0035-site-in-five-sections.md
 */

export type SiteLang = "it" | "en" | "es";
export type SectionId = "editor" | "dictionary" | "manager" | "keyboard" | "users";

export interface Section {
  id: SectionId;
  // The folder under the site's root; "" is the root itself.
  folder: string;
  name: Readonly<Record<SiteLang, string>>;
}

export const SECTIONS: readonly Section[] = [
  { id: "editor", folder: "", name: { it: "Scrivi", en: "Write", es: "Escribir" } },
  { id: "dictionary", folder: "dizionario", name: { it: "Dizionario", en: "Dictionary", es: "Diccionario" } },
  { id: "manager", folder: "admin", name: { it: "Gestore del lessico", en: "Lexicon manager", es: "Gestor del léxico" } },
  { id: "keyboard", folder: "tastiera", name: { it: "Tastiera", en: "Keyboard", es: "Teclado" } },
  { id: "users", folder: "utenti", name: { it: "Utenti", en: "Users", es: "Usuarios" } },
];

export const BAR_LABEL: Readonly<Record<SiteLang, string>> = {
  it: "Sezioni del sito",
  en: "Sections of the site",
  es: "Secciones del sitio",
};

export function isSiteLang(value: string | null): value is SiteLang {
  return value === "it" || value === "en" || value === "es";
}

// The address of a section seen from another: every section but the
// editor lives one folder below the root.
export function sectionHref(from: SectionId, to: SectionId): string {
  const source: Section | undefined = SECTIONS.find((s) => s.id === from);
  const target: Section | undefined = SECTIONS.find((s) => s.id === to);
  const up: string = source === undefined || source.folder === "" ? "./" : "../";
  return target === undefined || target.folder === "" ? up : `${up}${target.folder}/`;
}

export interface Stats {
  lemmas: number;
  forms: number;
  translations: number;
}

// A count written as the language writes numbers: 28.175, 28,175.
export function formatCount(lang: SiteLang, value: number): string {
  return new Intl.NumberFormat(lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "it-IT").format(value);
}

// "28.175 lemmi · 45.210 forme · 37.773 traduzioni".
export function statsText(lang: SiteLang, stats: Stats): string {
  const n = (value: number): string => formatCount(lang, value);
  const words: Record<SiteLang, [string, string, string, string, string, string]> = {
    it: ["lemma", "lemmi", "forma", "forme", "traduzione", "traduzioni"],
    en: ["lemma", "lemmas", "form", "forms", "translation", "translations"],
    es: ["lema", "lemas", "forma", "formas", "traducción", "traducciones"],
  };
  const [lemma, lemmas, form, forms, translation, translations] = words[lang];
  const intro: Record<SiteLang, string> = { it: "Nel dizionario", en: "In the dictionary", es: "En el diccionario" };
  return `${intro[lang]}: ${n(stats.lemmas)} ${stats.lemmas === 1 ? lemma : lemmas} · `
    + `${n(stats.forms)} ${stats.forms === 1 ? form : forms} · `
    + `${n(stats.translations)} ${stats.translations === 1 ? translation : translations}`;
}
