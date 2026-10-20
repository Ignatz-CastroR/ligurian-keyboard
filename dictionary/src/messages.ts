/*
 * messages.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 17:58:06, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/20, 01:38:20: the search finds Ligurian words too;
 *           the links to the other sections left the footer for the
 *           site's bar; a path above an entry replaces "← Index".
 * Purpose:  Every text of the dictionary for readers, in Italian
 *           [default], English and Spanish: the same three languages,
 *           and the same stored choice, as the editor and the lexicon
 *           manager. Parts of speech come from the manager's own texts,
 *           so the two never name them differently.
 * Contract: EN and ES have exactly the type of IT, so the compiler
 *           refuses a message present in one language and missing in
 *           another.
 * Decision: docs/decisions/0034-dictionary-for-readers.md
 */

import { LANGUAGES, isLang, messagesFor as managerMessages, type Lang } from "../../admin/src/messages.ts";

export { LANGUAGES, isLang, type Lang };

const IT = {
  appTitle: "Dizionario ligure",
  appSubtitle: "ligure · italiano · español · English",
  langLabel: "Lingua",

  navIndex: "Indice",
  navSearch: "Cerca",

  indexTitle: "Indice",
  indexIntro: "Scegli una lettera per vedere tutte le voci che cominciano così. Le vocali accentate stanno sotto la loro lettera; æ e ç hanno una lettera propria.",
  indexLetterTitle: (letter: string): string => `Voci che cominciano per ${letter}`,
  indexOther: "altro",
  indexCount: (n: number): string => (n === 1 ? "1 voce" : `${n} voci`),
  indexMore: "Mostra altre voci",
  indexEmpty: "Il dizionario non ha ancora voci pubblicate.",

  searchTitle: "Cerca",
  searchIntro: "Scrivi una parola ligure, con o senza accenti [zena trova Zêna], oppure una parola italiana, spagnola o inglese: il dizionario mostra le voci liguri che le corrispondono. Un codice come LIJ-7K3Q9MDXK apre la sua voce.",
  searchLabel: "Parola da cercare",
  searchLanguage: "Dove cercare",
  searchAll: "ovunque",
  searchLigurianOption: "ligure",
  searchNone: (query: string): string => `Nessuna voce ligure e nessuna traduzione per «${query}».`,
  searchLigurian: "Voci liguri",
  searchTranslations: "Traduzioni",
  searchLigurianNone: "Nessuna voce ligure comincia così.",
  searchTranslationsNone: "Nessuna traduzione corrisponde.",
  searchForm: (form: string): string => `forma ${form}`,
  searchLookupCapped: (n: number): string => `Sono mostrate le prime ${n} voci liguri: scrivi qualche lettera in più per vedere le altre.`,
  searchTypo: "Sembra un codice, ma l'ultimo carattere non corrisponde: controlla di averlo scritto bene.",
  searchResults: (n: number): string => (n === 1 ? "1 voce" : `${n} voci`),
  searchCapped: (n: number): string => `Sono mostrate le prime ${n} traduzioni trovate: rendi la ricerca più precisa per vedere le altre.`,

  entryForms: "Forme",
  entrySenses: "Significati",
  entryNoSenses: "Nessun significato ancora: la voce vale per la grafia.",
  entryNoGlosses: "nessuna traduzione ancora",
  entryCode: "Codice",
  entryVariety: "Varietà",
  entryOrthography: "Grafia",
  entryBase: "forma base",
  entryNotFound: "Nessuna voce pubblicata con questo codice.",
  entryLetter: (letter: string): string => `Lettera ${letter}`,
  entryPath: "Posizione nell'indice",
  entryToIndex: "Vai all'indice",
  entryEdit: "Correggi nel gestore del lessico",
  senseNumber: (n: number): string => `${n}.`,

  loading: "Caricamento…",
  errNotConfigured: "Il dizionario non è configurato: mancano VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.",
  errLoad: (message: string): string => `Il dizionario non ha risposto: ${message}`,
  footer: "Dati CC BY-SA 4.0 · codice MIT",
};

export type Messages = typeof IT;

const EN: Messages = {
  appTitle: "Ligurian dictionary",
  appSubtitle: "Ligurian · italiano · español · English",
  langLabel: "Language",

  navIndex: "Index",
  navSearch: "Search",

  indexTitle: "Index",
  indexIntro: "Choose a letter to see every entry that begins with it. Accented vowels are listed under their letter; æ and ç have letters of their own.",
  indexLetterTitle: (letter: string): string => `Entries beginning with ${letter}`,
  indexOther: "other",
  indexCount: (n: number): string => (n === 1 ? "1 entry" : `${n} entries`),
  indexMore: "Show more entries",
  indexEmpty: "The dictionary has no published entries yet.",

  searchTitle: "Search",
  searchIntro: "Type a Ligurian word, with or without accents [zena finds Zêna], or an Italian, Spanish or English word: the dictionary shows the Ligurian entries that match it. A code such as LIJ-7K3Q9MDXK opens its entry.",
  searchLabel: "Word to search for",
  searchLanguage: "Where to search",
  searchAll: "everywhere",
  searchLigurianOption: "Ligurian",
  searchNone: (query: string): string => `No Ligurian entry and no translation for “${query}”.`,
  searchLigurian: "Ligurian entries",
  searchTranslations: "Translations",
  searchLigurianNone: "No Ligurian entry begins like this.",
  searchTranslationsNone: "No translation matches.",
  searchForm: (form: string): string => `form ${form}`,
  searchLookupCapped: (n: number): string => `Only the first ${n} Ligurian entries are shown: type a few more letters to see the rest.`,
  searchTypo: "This looks like a code, but its last character does not match: check that it was typed correctly.",
  searchResults: (n: number): string => (n === 1 ? "1 entry" : `${n} entries`),
  searchCapped: (n: number): string => `Only the first ${n} translations found are shown: make the search more precise to see the rest.`,

  entryForms: "Forms",
  entrySenses: "Senses",
  entryNoSenses: "No senses yet: the entry records the spelling.",
  entryNoGlosses: "no translation yet",
  entryCode: "Code",
  entryVariety: "Variety",
  entryOrthography: "Spelling",
  entryBase: "base form",
  entryNotFound: "No published entry has this code.",
  entryLetter: (letter: string): string => `Letter ${letter}`,
  entryPath: "Place in the index",
  entryToIndex: "Go to the index",
  entryEdit: "Correct it in the lexicon manager",
  senseNumber: (n: number): string => `${n}.`,

  loading: "Loading…",
  errNotConfigured: "The dictionary is not configured: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are missing.",
  errLoad: (message: string): string => `The dictionary did not answer: ${message}`,
  footer: "Data CC BY-SA 4.0 · code MIT",
};

const ES: Messages = {
  appTitle: "Diccionario ligur",
  appSubtitle: "ligur · italiano · español · inglés",
  langLabel: "Idioma",

  navIndex: "Índice",
  navSearch: "Buscar",

  indexTitle: "Índice",
  indexIntro: "Elige una letra para ver todas las entradas que empiezan por ella. Las vocales acentuadas están bajo su letra; æ y ç tienen letra propia.",
  indexLetterTitle: (letter: string): string => `Entradas que empiezan por ${letter}`,
  indexOther: "otros",
  indexCount: (n: number): string => (n === 1 ? "1 entrada" : `${n} entradas`),
  indexMore: "Mostrar más entradas",
  indexEmpty: "El diccionario todavía no tiene entradas publicadas.",

  searchTitle: "Buscar",
  searchIntro: "Escribe una palabra ligur, con o sin acentos [zena encuentra Zêna], o una palabra italiana, española o inglesa: el diccionario muestra las entradas ligures que le corresponden. Un código como LIJ-7K3Q9MDXK abre su entrada.",
  searchLabel: "Palabra que buscar",
  searchLanguage: "Dónde buscar",
  searchAll: "en todo",
  searchLigurianOption: "ligur",
  searchNone: (query: string): string => `Ninguna entrada ligur y ninguna traducción para «${query}».`,
  searchLigurian: "Entradas ligures",
  searchTranslations: "Traducciones",
  searchLigurianNone: "Ninguna entrada ligur empieza así.",
  searchTranslationsNone: "Ninguna traducción coincide.",
  searchForm: (form: string): string => `forma ${form}`,
  searchLookupCapped: (n: number): string => `Se muestran las primeras ${n} entradas ligures: escribe algunas letras más para ver las demás.`,
  searchTypo: "Parece un código, pero su último carácter no coincide: comprueba que esté bien escrito.",
  searchResults: (n: number): string => (n === 1 ? "1 entrada" : `${n} entradas`),
  searchCapped: (n: number): string => `Se muestran las primeras ${n} traducciones encontradas: precisa la búsqueda para ver las demás.`,

  entryForms: "Formas",
  entrySenses: "Acepciones",
  entryNoSenses: "Todavía no hay acepciones: la entrada registra la grafía.",
  entryNoGlosses: "todavía sin traducción",
  entryCode: "Código",
  entryVariety: "Variedad",
  entryOrthography: "Grafía",
  entryBase: "forma base",
  entryNotFound: "Ninguna entrada publicada tiene este código.",
  entryLetter: (letter: string): string => `Letra ${letter}`,
  entryPath: "Lugar en el índice",
  entryToIndex: "Ir al índice",
  entryEdit: "Corregirla en el gestor del léxico",
  senseNumber: (n: number): string => `${n}.`,

  loading: "Cargando…",
  errNotConfigured: "El diccionario no está configurado: faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.",
  errLoad: (message: string): string => `El diccionario no respondió: ${message}`,
  footer: "Datos CC BY-SA 4.0 · código MIT",
};

const TABLES: Readonly<Record<Lang, Messages>> = { it: IT, en: EN, es: ES };

export function messagesFor(lang: Lang): Messages {
  return TABLES[lang];
}

// A part of speech in the interface's language, as the manager names it.
export function partOfSpeech(lang: Lang, pos: string | null): string {
  const m = managerMessages(lang);
  const labels: Record<string, string> = {
    noun: m.posNoun, verb: m.posVerb, adjective: m.posAdjective, adverb: m.posAdverb,
    pronoun: m.posPronoun, article: m.posArticle, preposition: m.posPreposition,
    conjunction: m.posConjunction, interjection: m.posInterjection, numeral: m.posNumeral,
    proper_noun: m.posProperNoun, other: m.posOther,
  };
  return pos === null ? "" : labels[pos] ?? pos;
}
