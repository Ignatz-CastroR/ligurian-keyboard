# 0034: The dictionary for readers, an index and a search by translation

* **Status:** accepted
* **Date:** 2026/10/18
* **Decided by:** Eng. José Ignacio Castro de R.
* **Supersedes:** the points "After the keyboard's beta" and "static files" of [0032](0032-dictionary-second-purpose.md), on when the dictionary for readers begins and how its first pages are served

## Context

Decision [0032](0032-dictionary-second-purpose.md) made the dictionary the project's second purpose and placed its work after the keyboard's beta, starting with public entry pages generated as static files from a daily export.

On 2026/10/18 the friends in Genoa entered a corpus gathered from sefers in Ligurian, in grafîa ofiçiâ: the dictionary grew from 28 approved forms to 11,792 in one day. A dictionary of that size needs a way to be read, not only a way to be typed with. Two needs came first:

* **Browsing,** as on Wiktionary: choosing a letter, Ligurian letters included, and seeing every entry that begins with it.
* **Searching by translation:** typing a word in Italian, Spanish or English and finding the Ligurian entries that translate it. This is many to many: `pluma` may lead to several Ligurian words, and one Ligurian word to several translations.

The lookup the input method needs, plain ASCII in and the Ligurian spelling out, is a different mission, and it stays where it is: in the editor, the keyboard and the lexicon manager.

## Decision

* **A separate, public section of the site, `/dizionario/`,** read only and open to everyone without an account, in Italian, English and Spanish, sharing the site's language choice. It is autonomous: its own page, built from `dictionary/`, apart from the editor and from the lexicon manager, which remains the contributors' tool.
* **The index groups entries by initial letter:** accented vowels under their base letter [`à`, `â`, `ä` under `a`]; `æ` and `ç` as letters of their own, `æ` after `a` and `ç` after `c`; `ñ` under `n`, as the search keys fold it; and any initial that is not a letter, such as an apostrophe, under "#" [shown as "altro", "other", "otros"]. Only initials with entries are shown. Within a letter, entries follow the search keys, in pages of 100.
* **The search by translation** compares the query and every translation without accents, diacritics, capitals or punctuation [`canción`, `cancion` and `CANCIÓN` are the same; `dell'acqua` has the words `dell` and `acqua`], in one language or in all three. A translation matches when it equals the query, begins with it, or, from three characters on, has a later word that begins with it, in that order of rank; the middle of a word is not a match. The query is cut at 100 characters; at most 200 translations are returned, and the page says when there may be more. Results are grouped by Ligurian entry. A public code typed into the field opens its entry.
* **Each entry has a page at `#/voce/<code>`,** its permanent address being its public code [decision [0030](0030-public-identifiers.md)]: the headword, its part of speech, variety and spelling system, its senses with their Italian definitions and their translations by language, and its forms.
* **Published rows only, for everyone.** Four database functions serve the section [migration 0009]: `dictionary_letters()`, `dictionary_index()`, `dictionary_search()` and `dictionary_entry()`. They run with their owner's rights, because row level security, whose policies call functions the planner cannot see through, would otherwise keep every query from its indexes: measured on 12,000 lemmas and 48,000 translations, an ordinary search took 1.6 to 4 seconds as a visitor, beyond the 3 seconds Supabase allows anonymous requests. Each function therefore writes out the filters of publication in full: an approved, live lemma; its approved, live senses and forms; their approved, live translations; tests check them for a visitor, a reviewer and a contributor. The page's database client never uses a stored session either.
* **Live queries for now, not static files.** The section asks the database on every page, through three indexes: the initials of published headwords; the folded translations in byte order, for their start; and trigrams of the folded translations [the `pg_trgm` extension, which Supabase provides], for the start of a later word. The search runs in two steps that each stop at the limit, so a word found in tens of thousands of translations costs no more than a rare one. At today's size and readership this costs the database little, shows each approval at once, and needs no build step. When readers grow enough to matter, the static generation 0032 planned, from the daily export, remains the way to make readers cost the database nothing; it will be its own decision.
* **The rest of 0032's plan keeps its order and its condition:** Spanish translations of the most common words and pronunciation still come after the beta, each with its own decision.

## Consequences

* The roadmap gains the dictionary for readers as 0.12; the bulk import moves to 0.13 and the beta to 0.14.
* The editor's header and the install page's "Dictionary" link now lead to `/dizionario/`; the editor links the lexicon manager separately, and the manager links the dictionary.
* No column is added to any table: the initial and the folded translation are computed by functions, so backups, restores and the export are unchanged.
* The search folds accents with Unicode decomposition, removing the marks before taking lower case, so that it never depends on the database's locale; this suits Italian, Spanish and English. It does not stem words or know synonyms: `plumas` does not find `pluma`. A query of one or two characters looks only at the start of translations. Better matching would be a later decision.
* Every reader's page is a few small queries to the free Supabase project. Its limits, and the egress of the API, now matter to readers as well as to contributors.
