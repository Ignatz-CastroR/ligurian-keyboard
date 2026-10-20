# 0035: The site in five sections

* **Status:** accepted
* **Date:** 2026/10/20
* **Decided by:** Eng. José Ignacio Castro de R.
* **Supersedes:** the point "The lookup the input method needs [...] stays where it is" of [0034](0034-dictionary-for-readers.md), on where a Ligurian word typed without accents can be looked up
* **Refines:** [0018](0018-lexicon-manager-design.md), on the manager's navigation, its users page and its translation form; [0031](0031-backups.md), on where backups are made

## Context

By 0.12.1 the site had grown part by part: the editor at the root, the lexicon manager under `/admin/`, the install page under `/tastiera/`, the dictionary for readers under `/dizionario/`. Each part linked a different set of the others, in its own words and its own place: small text links in a header, a footer or a bar at the top. Using the site on 2026/10/19, the maintainer found the following:

* **The sections were hard to see and hard to reach.** Some pages were dead ends: the install page did not link the lexicon manager at all. An entry in the dictionary linked to the manager to be corrected, but the same entry in the manager had no way back to the dictionary.
* **The manager mixed two kinds of thing in one row of links.** Its own pages [search, new lemma, review] sat beside links to other sections, and its users page held three unrelated things: one's own profile, the list of people with their roles, and the backups.
* **No one could see what a person had done.** The history existed, complete, in `audit_log`, but only entry by entry.
* **The dictionary's size was nowhere.** After the corpus of 2026/10/18 it held 28,175 lemmas, but no page said so.
* **A reader could not look up a Ligurian word in the dictionary,** only translations. Decision 0034 had left the Ligurian lookup to the editor and the manager, but readers type `zena` and expect `Zêna`.
* **The entry page of the dictionary said "Index" twice:** once as a tab, once as "← Index" above the entry.
* **The translation form proposed Italian as the language of every translation,** and accepted "penna; stilografica" as one translation. Measured on the live data, 7 translations hold ";", and the translations are 37,733 Italian, 24 Spanish and 16 English. Some "Italian" ones are not Italian, because the form proposed Italian and was not changed.

## Decision

* **Five sections, the same on every page, as five large buttons in a bar at the top:** Write [the editor, `/`], Dictionary [`/dizionario/`], Lexicon manager [`/admin/`], Keyboard [`/tastiera/`] and Users [`/utenti/`]. The current section is filled; on a phone the buttons wrap into rows. Their names, order and addresses live in one file, `site/sections.ts`. The static install page repeats them by hand, and a test keeps it identical to that file. Under the buttons, every page that talks to the database shows the dictionary's size: published lemmas, forms and translations [`dictionary_stats()`, migration 0011]. The install page shows instead the number of words in the keyboard's dictionary package, which it already did.
* **Each section has its own second level, below the bar.** The dictionary keeps its tabs Index and Search. The manager gets its own tabs: Search, New lemma, To review, and for admins Backups, the current one marked.
* **Users becomes a section of its own, `/utenti/`.** It holds one's own profile and one's complete history. Reviewers and admins also see every person, with their role, the number of changes and the time of the last one, and can open anyone's complete history. The changes written from the SQL Editor, with no person, are listed under "SQL Editor [no person]". A history lists every change, newest first, a hundred at a time until the first, each with its date and time to the second, what it was, the entry it belongs to [linked], the status it left and, for an edit, the fields it changed; an approval reads as "approved", not as "edited: status". Three database functions serve it [migration 0011]: `people_activity()`, `user_history()` and `user_summary()`. They show reviewers and admins anyone's history, everyone else only their own, and visitors nothing. The section is built from the manager's own modules, so the two share one sign-in and never name a role or a status differently. The manager's old address `#/users` leads there.
* **Backups move to the manager's Backups tab,** unchanged, for admins.
* **The dictionary also finds Ligurian words, typed with or without accents.** Its one search field looks in Ligurian spellings and in translations, in all three languages or in one of them, and shows the two groups of results apart: "Ligurian entries", by headword or by form [`dictionary_lookup()`, migration 0011], and "Translations", as before. `zena`, `Zena` and `Zêna` find `Zêna`; `penne` finds `pénna` by its plural, saying which form matched. Published entries only, for everyone, as in 0034.
* **Every entry links to its other face.** An entry in the dictionary already linked to the manager; an entry in the manager now links to the same entry in the dictionary when it is published. When it is not, the manager says why: pending, rejected or deleted.
* **Above an entry of the dictionary, its place in the index:** "Letter Z › Zêna", where the letter is the one the index lists it under, computed as the database computes it. This replaces the second "Index" link.
* **The translation form asks for the language every time and accepts several translations at once.** The language starts unchosen and must be chosen. Several translations of the same sense may be typed in one field, separated by ";": the form shows them before saving, and each becomes its own row, as the database keeps them. An edited translation may not hold ";". Commas and slashes stay as typed, since "bianco, candido" may be one translation.

## Consequences

* Migration 0011 must run before the site of 0.13.0 is published, or the bar shows no size, the dictionary's Ligurian search fails, and the Users section shows only errors. It adds one index, on the history by person, and changes no data.
* The site build has a fifth application, `users/`, assembled into `_site/utenti/`, and copies the bar's stylesheet to `_site/site-bar.css` for the install page. The editor's offline cache leaves `/utenti/` alone, as it leaves the manager and the dictionary.
* The manager's users page, `admin/src/views/users.ts`, is gone: its profile and people cards now live in `users/src/views/people.ts`, and its backup and restore cards in `admin/src/views/backups.ts`.
* The data already loaded is not repaired here. Translations that hold ";", senses split one per translation, and translations whose language is wrong will be repaired in 0.14.0, with a page per entry for that purpose. This decision only stops the forms from making more of them.
* The history pages read `audit_log` by person. With the new index, a page of a hundred changes is one indexed read, whatever the size of the history.
