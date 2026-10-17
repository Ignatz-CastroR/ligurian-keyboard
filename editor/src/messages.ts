/*
 * messages.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/17, 02:12:54, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Every text the web editor shows, in Italian [default, for
 *           Genoese readers] and English.
 * Contract: EN has exactly the type of IT, so the compiler refuses a
 *           message present in one language and missing in the other.
 *           The language choice is shared with the lexicon manager.
 */

export type Lang = "it" | "en";

const IT = {
  appTitle: "Scrivi in ligure",
  appSubtitle: "In grafîa ofiçiâ, da qualsiasi tastiera",
  navDictionary: "Dizionario",
  switchLang: "English",

  textLabel: "Testo",
  placeholder: "Scrivi qui in lettere normali, per esempio: a zena",
  help: "Scrivi le parole in lettere normali e premi lo spazio: diventano grafîa ofiçiâ. "
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
  navDictionary: "Dictionary",
  switchLang: "Italiano",

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

export function messagesFor(lang: Lang): Messages {
  return lang === "en" ? EN : IT;
}
