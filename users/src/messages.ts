/*
 * messages.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 02:00:40, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/20, 23:49:12: "significati rivisti", the review of a
 *           lemma's senses [decision 0038].
 * Purpose:  The texts of the Users section that the lexicon manager does
 *           not already have, in Italian [default], English and Spanish.
 *           Profiles, roles, statuses and errors keep the manager's own
 *           texts, so the two sections never name them differently.
 * Contract: EN and ES have exactly the type of IT, so the compiler
 *           refuses a message present in one language and missing in
 *           another.
 * Decision: docs/decisions/0035-site-in-five-sections.md
 */

import type { Lang } from "../../admin/src/messages.ts";
import type { LexiconTable } from "../../admin/src/types.ts";
import type { Verb } from "./model.ts";

const IT = {
  appTitle: "Utenti",
  appSubtitle: "chi scrive il dizionario ligure, e che cosa ha fatto",
  signInPrompt: "Accedi per vedere il tuo profilo e tutto ciò che hai scritto nel dizionario.",

  peopleTitle: "Le persone del dizionario",
  peopleIntro: "Ogni persona con il suo ruolo e le sue modifiche. Apri una persona per vedere la sua cronologia completa, con data e ora. I nuovi account sono creati da un amministratore nel pannello di Supabase e partono come membri.",
  colChanges: "Modifiche",
  colLastChange: "Ultima modifica",
  openHistory: "Cronologia",
  sqlEditor: "SQL Editor [nessuna persona]",
  sqlEditorNote: "Modifiche scritte dall'SQL Editor di Supabase senza indicare una persona.",
  noProfile: "persona senza profilo",
  myHistory: "La mia cronologia completa",

  personPath: "Posizione nella sezione",
  personTitle: (name: string): string => `Cronologia di ${name}`,
  summaryTitle: "In breve",
  summaryTotal: (written: string): string => (written === "1" ? "1 modifica in tutto" : `${written} modifiche in tutto`),
  summaryNone: "Nessuna modifica.",
  summaryRange: (first: string, last: string): string => `dal ${first} al ${last}`,
  historyTitle: "Tutte le modifiche, dalla più recente",
  historyMore: "Mostra altre modifiche",
  historyEnd: "Questa è la prima modifica: la cronologia è completa.",
  historyShown: (written: string): string => (written === "1" ? "1 modifica mostrata" : `${written} modifiche mostrate`),
  colWhen: "Data e ora",
  colWhat: "Azione",
  colKind: "Tipo",
  colItem: "Voce",
  colStatus: "Stato dopo",
  colFields: "Campi cambiati",
  openEntry: "Apri la voce nel gestore del lessico",
  kinds: { lemmas: "lemma", wordforms: "forma", senses: "significato", glosses: "traduzione" } as Record<LexiconTable, string>,
  verbs: {
    insert: "creato", update: "modificato", approve: "approvato", reject: "rifiutato",
    unreview: "rimesso in attesa", review_senses: "significati rivisti", list_senses: "messo fra i significati da rivedere", soft_delete: "eliminato", restore: "ripristinato",
  } as Record<Verb, string>,
};

export type UserMessages = typeof IT;

const EN: UserMessages = {
  appTitle: "Users",
  appSubtitle: "who writes the Ligurian dictionary, and what they did",
  signInPrompt: "Sign in to see your profile and everything you wrote in the dictionary.",

  peopleTitle: "The people of the dictionary",
  peopleIntro: "Everyone with their role and their changes. Open a person to see their complete history, with date and time. New accounts are created by an admin in the Supabase dashboard and start as members.",
  colChanges: "Changes",
  colLastChange: "Last change",
  openHistory: "History",
  sqlEditor: "SQL Editor [no person]",
  sqlEditorNote: "Changes written from Supabase's SQL Editor without naming a person.",
  noProfile: "person without a profile",
  myHistory: "My complete history",

  personPath: "Place in the section",
  personTitle: (name: string): string => `History of ${name}`,
  summaryTitle: "In short",
  summaryTotal: (written: string): string => (written === "1" ? "1 change in all" : `${written} changes in all`),
  summaryNone: "No changes.",
  summaryRange: (first: string, last: string): string => `from ${first} to ${last}`,
  historyTitle: "Every change, the latest first",
  historyMore: "Show more changes",
  historyEnd: "This is the first change: the history is complete.",
  historyShown: (written: string): string => (written === "1" ? "1 change shown" : `${written} changes shown`),
  colWhen: "Date and time",
  colWhat: "Action",
  colKind: "Kind",
  colItem: "Entry",
  colStatus: "Status after",
  colFields: "Fields changed",
  openEntry: "Open the entry in the lexicon manager",
  kinds: { lemmas: "lemma", wordforms: "form", senses: "sense", glosses: "translation" },
  verbs: {
    insert: "created", update: "edited", approve: "approved", reject: "rejected",
    unreview: "sent back to review", review_senses: "senses reviewed", list_senses: "put on the senses to review", soft_delete: "deleted", restore: "restored",
  },
};

const ES: UserMessages = {
  appTitle: "Usuarios",
  appSubtitle: "quién escribe el diccionario ligur, y qué ha hecho",
  signInPrompt: "Inicia sesión para ver tu perfil y todo lo que has escrito en el diccionario.",

  peopleTitle: "Las personas del diccionario",
  peopleIntro: "Cada persona con su rol y sus cambios. Abre una persona para ver su historial completo, con fecha y hora. Las cuentas nuevas las crea un administrador en el panel de Supabase y empiezan como miembros.",
  colChanges: "Cambios",
  colLastChange: "Último cambio",
  openHistory: "Historial",
  sqlEditor: "SQL Editor [ninguna persona]",
  sqlEditorNote: "Cambios escritos desde el SQL Editor de Supabase sin indicar una persona.",
  noProfile: "persona sin perfil",
  myHistory: "Mi historial completo",

  personPath: "Lugar en la sección",
  personTitle: (name: string): string => `Historial de ${name}`,
  summaryTitle: "En resumen",
  summaryTotal: (written: string): string => (written === "1" ? "1 cambio en total" : `${written} cambios en total`),
  summaryNone: "Ningún cambio.",
  summaryRange: (first: string, last: string): string => `del ${first} al ${last}`,
  historyTitle: "Todos los cambios, el más reciente primero",
  historyMore: "Mostrar más cambios",
  historyEnd: "Este es el primer cambio: el historial está completo.",
  historyShown: (written: string): string => (written === "1" ? "1 cambio mostrado" : `${written} cambios mostrados`),
  colWhen: "Fecha y hora",
  colWhat: "Acción",
  colKind: "Tipo",
  colItem: "Entrada",
  colStatus: "Estado después",
  colFields: "Campos cambiados",
  openEntry: "Abrir la entrada en el gestor del léxico",
  kinds: { lemmas: "lema", wordforms: "forma", senses: "acepción", glosses: "traducción" },
  verbs: {
    insert: "creado", update: "editado", approve: "aprobado", reject: "rechazado",
    unreview: "devuelto a revisión", review_senses: "acepciones revisadas", list_senses: "puesto entre las acepciones por revisar", soft_delete: "eliminado", restore: "restaurado",
  },
};

const TABLES: Readonly<Record<Lang, UserMessages>> = { it: IT, en: EN, es: ES };

export function userMessagesFor(lang: Lang): UserMessages {
  return TABLES[lang];
}
