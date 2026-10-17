/*
 * messages.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/17, 02:12:54, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/17, 08:23:03: Spanish, and a language menu with the
 *           same entries as the lexicon manager's [decision 0023].
 * Purpose:  Every text the web editor shows, in Italian [default, for
 *           Genoese readers], English and Spanish.
 * Contract: EN and ES have exactly the type of IT, so the compiler
 *           refuses a message present in one language and missing in
 *           another. The language choice is shared with the lexicon
 *           manager, and LANGUAGES lists the same languages in the same
 *           order; a test compares the two.
 */

export type Lang = "it" | "en" | "es";

// The language menu: each language named in itself.
export const LANGUAGES: readonly { code: Lang; name: string }[] = [
  { code: "it", name: "Italiano" },
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
];

export function isLang(value: string | null): value is Lang {
  return LANGUAGES.some((l) => l.code === value);
}

const IT = {
  appTitle: "Scrivi in ligure",
  appSubtitle: "In grafîa ofiçiâ, da qualsiasi tastiera",
  navKeyboard: "Tastiera Android",
  navDictionary: "Dizionario",
  langLabel: "Lingua dell'interfaccia",

  textLabel: "Testo",
  placeholder: "Scrivi qui senza accenti, per esempio: a zena",
  help: "Scrivi le parole senza accenti e premi lo spazio: diventano grafîa ofiçiâ. "
    + "Se più grafie sono possibili, scegli con i numeri, con le frecce e Invio, oppure toccandola. "
    + "Esc lascia la parola come l'hai scritta. Backspace subito dopo una conversione la annulla.",

  varietyLabel: "Varietà",
  orthographyLabel: "Grafia",
  allOptions: "tutte",

  copy: "Copia",
  copied: "Testo copiato.",
  copyFailed: "Copia non riuscita: seleziona il testo e copialo a mano.",
  download: "Scarica .txt",
  downloadName: "testo-ligure.txt",
  clear: "Svuota",
  confirmClear: "Cancellare tutto il testo?",

  keepTyped: "lascia come scritto",
  menuLabel: "Grafie possibili",

  loading: "Caricamento del dizionario…",
  ready: (forms: number, takenAt: string | null): string =>
    `Dizionario: ${forms} ${forms === 1 ? "forma" : "forme"}${takenAt === null ? "" : `, aggiornato al ${takenAt}`}.`,
  unavailable: "Dizionario non disponibile: puoi scrivere, ma le parole non vengono convertite.",
};

export type Messages = typeof IT;

const EN: Messages = {
  appTitle: "Write in Ligurian",
  appSubtitle: "In grafîa ofiçiâ, from any keyboard",
  navKeyboard: "Android keyboard",
  navDictionary: "Dictionary",
  langLabel: "Interface language",

  textLabel: "Text",
  placeholder: "Type here in plain letters, for example: a zena",
  help: "Type words in plain letters and press space: they become grafîa ofiçiâ. "
    + "When several spellings are possible, pick one with the numbers, with the arrows and Enter, or by tapping it. "
    + "Escape keeps the word as you typed it. Backspace right after a conversion undoes it.",

  varietyLabel: "Variety",
  orthographyLabel: "Spelling",
  allOptions: "all",

  copy: "Copy",
  copied: "Text copied.",
  copyFailed: "Copying failed: select the text and copy it by hand.",
  download: "Download .txt",
  downloadName: "ligurian-text.txt",
  clear: "Clear",
  confirmClear: "Delete all the text?",

  keepTyped: "keep as typed",
  menuLabel: "Possible spellings",

  loading: "Loading the dictionary…",
  ready: (forms: number, takenAt: string | null): string =>
    `Dictionary: ${forms} ${forms === 1 ? "form" : "forms"}${takenAt === null ? "" : `, updated ${takenAt}`}.`,
  unavailable: "Dictionary unavailable: you can type, but words are not converted.",
};

const ES: Messages = {
  appTitle: "Escribir en ligur",
  appSubtitle: "En grafîa ofiçiâ, desde cualquier teclado",
  navKeyboard: "Teclado Android",
  navDictionary: "Diccionario",
  langLabel: "Idioma de la interfaz",

  textLabel: "Texto",
  placeholder: "Escribe aquí sin acentos, por ejemplo: a zena",
  help: "Escribe las palabras sin acentos y pulsa la barra espaciadora: se convierten en grafîa ofiçiâ. "
    + "Si hay varias grafías posibles, elige con los números, con las flechas e Intro, o tocándola. "
    + "Esc deja la palabra tal como la escribiste. Retroceso justo después de una conversión la deshace.",

  varietyLabel: "Variedad",
  orthographyLabel: "Ortografía",
  allOptions: "todas",

  copy: "Copiar",
  copied: "Texto copiado.",
  copyFailed: "No se pudo copiar: selecciona el texto y cópialo a mano.",
  download: "Descargar .txt",
  downloadName: "texto-ligur.txt",
  clear: "Vaciar",
  confirmClear: "¿Borrar todo el texto?",

  keepTyped: "dejar como está",
  menuLabel: "Grafías posibles",

  loading: "Cargando el diccionario…",
  ready: (forms: number, takenAt: string | null): string =>
    `Diccionario: ${forms} ${forms === 1 ? "forma" : "formas"}${takenAt === null ? "" : `, actualizado el ${takenAt}`}.`,
  unavailable: "Diccionario no disponible: puedes escribir, pero las palabras no se convierten.",
};

const TABLES: Record<Lang, Messages> = { it: IT, en: EN, es: ES };

export function messagesFor(lang: Lang): Messages {
  return TABLES[lang];
}
