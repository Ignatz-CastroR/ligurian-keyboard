/*
 * links.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 01:44:30, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The way from a lemma in the lexicon manager to the same
 *           entry in the dictionary for readers, which already links
 *           back with "Correct it in the lexicon manager". A lemma is in
 *           the dictionary only when it is approved and not deleted,
 *           the rule of dictionary_entry[] in migration 0009; otherwise
 *           the reason it is not there yet.
 * Contract: Pure, no browser objects, tested in Node.
 * Decision: docs/decisions/0035-site-in-five-sections.md
 */

import type { Status } from "./types.ts";

export type DictionaryLink =
  | { kind: "published"; href: string }
  | { kind: "absent"; reason: "pending" | "rejected" | "deleted" };

// The manager lives at /admin/, the dictionary at /dizionario/.
export function dictionaryLink(lemma: { public_id: string; status: Status; deleted_at: string | null }): DictionaryLink {
  let link: DictionaryLink;
  if (lemma.deleted_at !== null) {
    link = { kind: "absent", reason: "deleted" };
  } else if (lemma.status === "approved") {
    link = { kind: "published", href: `../dizionario/#/voce/${encodeURIComponent(lemma.public_id)}` };
  } else {
    link = { kind: "absent", reason: lemma.status === "rejected" ? "rejected" : "pending" };
  }
  return link;
}
