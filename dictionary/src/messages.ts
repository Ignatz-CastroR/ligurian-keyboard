/*
 * messages.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 17:58:06, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
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
  navEditor: "Scrivi in ligure",
  navKeyboard: "Tastiera Android",
  navManager: "Gestore del lessico",

  indexTitle: "Indice",
  indexIntro: "Scegli una lettera per vedere tutte le voci che cominciano così. Le vocali accentate stanno sotto la loro lettera; æ e ç hanno una lettera propria.",
  indexLetterTitle: (letter: string): string => `Voci che cominciano per ${letter}`,
  indexOther: "altro",
  indexCount: (n: number): string => (n === 1 ? "1 voce" : `${n} voci`),
  indexMore: "Mostra altre voci",
  indexEmpty: "Il dizionario non ha ancora voci pubblicate.",

  searchTitle: "Cerca per traduzione",
  searchIntro: "Scrivi una parola in italiano, spagnolo o inglese: il dizionario mostra le voci liguri che la traducono. Gli accenti non servono. Per cercare una parola ligure scritta senza accenti, usa l'editor o il gestore del lessico; un codice come LIJ-7K3Q9MDXK apre la sua voce.",
  searchLabel: "Parola da cercare",
  searchLanguage: "Lingua della traduzione",
  searchAll: "tutte",
  searchNone: (query: string): string => `Nessuna voce tradotta con «${query}».`,
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
  entryBack: "← Indice",
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
  navEditor: "Write in Ligurian",
  navKeyboard: "Android keyboard",
  navManager: "Lexicon manager",

  indexTitle: "Index",
  indexIntro: "Choose a letter to see every entry that begins with it. Accented vowels are listed under their letter; æ and ç have letters of their own.",
  indexLetterTitle: (letter: string): string => `Entries beginning with ${letter}`,
  indexOther: "other",
  indexCount: (n: number): string => (n === 1 ? "1 entry" : `${n} entries`),
  indexMore: "Show more entries",
  indexEmpty: "The dictionary has no published entries yet.",

  searchTitle: "Search by translation",
  searchIntro: "Type a word in Italian, Spanish or English: the dictionary shows the Ligurian entries that translate it. Accents are not needed. To look up a Ligurian word typed without accents, use the editor or the lexicon manager; a code such as LIJ-7K3Q9MDXK opens its entry.",
  searchLabel: "Word to search for",
  searchLanguage: "Language of the translation",
  searchAll: "all",
  searchNone: (query: string): string => `No entry is translated as “${query}”.`,
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
  entryBack: "← Index",
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
  navEditor: "Escribe en ligur",
  navKeyboard: "Teclado Android",
  navManager: "Gestor del léxico",

  indexTitle: "Índice",
  indexIntro: "Elige una letra para ver todas las entradas que empiezan por ella. Las vocales acentuadas están bajo su letra; æ y ç tienen letra propia.",
  indexLetterTitle: (letter: string): string => `Entradas que empiezan por ${letter}`,
  indexOther: "otros",
  indexCount: (n: number): string => (n === 1 ? "1 entrada" : `${n} entradas`),
  indexMore: "Mostrar más entradas",
  indexEmpty: "El diccionario todavía no tiene entradas publicadas.",

  searchTitle: "Buscar por traducción",
  searchIntro: "Escribe una palabra en italiano, español o inglés: el diccionario muestra las entradas ligures que la traducen. Los acentos no hacen falta. Para buscar una palabra ligur escrita sin acentos, usa el editor o el gestor del léxico; un código como LIJ-7K3Q9MDXK abre su entrada.",
  searchLabel: "Palabra que buscar",
  searchLanguage: "Idioma de la traducción",
  searchAll: "todos",
  searchNone: (query: string): string => `Ninguna entrada se traduce como «${query}».`,
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
  entryBack: "← Índice",
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
