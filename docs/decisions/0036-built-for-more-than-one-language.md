# 0036: Built for more than one language

* **Status:** accepted
* **Date:** 2026/10/20
* **Decided by:** Eng. José Ignacio Castro de R.

## Context

Ligurian is one of many languages of Italy at risk, among them Lombard, Piedmontese, Venetian, Emilian, Friulian, Neapolitan and Sicilian. Their speakers face the same problems Ligurian speakers do: phones with no keyboard for their spelling, no shared dictionary, and words that live in the memory of fewer people every year. The maintainer intends, once this project is mature, to start twin projects for some of them.

What this project has built is mostly not about Ligurian: an input method that turns plain letters into a spelling with accents, a dictionary database with review and full history, a manager for contributors, a dictionary for readers, backups and a site of five sections. What is about Ligurian is a small set of facts spread through the code:

* the letters a spelling may contain [the `ligurian_form` domain of migration 0001, as changed by 0005, and `LIGURIAN_LETTERS` in `admin/src/forms.ts`];
* how a spelling is folded to plain letters [`engine/src/skeleton.ts` and `private.skeleton()`], and which elided particles exist [`engine/src/elision.ts`];
* the order of the index's letters, with `æ` after `a` and `ç` after `c` [`dictionary/src/model.ts` and `private.index_initial()`];
* the prefix of public codes, `LIJ-` [`admin/src/public-id.ts`];
* the varieties and spelling systems, which are already data [the tables `varieties` and `orthographies`];
* the Keyman keyboard and its names;
* the names "Ligurian", "ligure" and "ligur" in the texts of every page.

If each new feature adds such facts in new places, a twin project would have to find and change them all, and every fix made in one project would have to be ported by hand to the others.

## Decision

* **One codebase, with the language as data.** From 0.13.0 on, no new code states a fact about Ligurian where a fact about another language would have to be written instead. A new feature takes such facts from the database or from a single place in the code that names the language. It never repeats them in its own files.
* **What already exists is moved over time, not all at once.** The facts listed above are the inventory. Each one moves to its single place when the code around it is next changed for another reason, and each move is tested like any other change. No release is made only to move them.
* **Ligurian stays the first and, for now, the only language.** Nothing in this decision delays the beta in Genoa or 1.0.0. A twin project begins only after 1.0.0, with its own decision.

## Consequences

* The work of 0.13.0 follows it in part, and says where it does not. The five sections are named in `site/sections.ts` without the word "Ligurian"; the translation form takes its languages from the table `gloss_languages` and its messages name none; the dictionary's Ligurian search folds the query with `private.skeleton()`, which already holds the rules. Two facts were copied all the same, and join the inventory above: `initialOf()` in `dictionary/src/model.ts` repeats `private.index_initial()` in TypeScript, `æ` and `ç` included, so that an entry's page can name its letter without asking the database again, and a test keeps the two equal on every initial the spelling allows; and `dictionary_lookup()` keeps only the letters `a` to `z` and the apostrophe of the folded query, the alphabet `private.skeleton()` writes for Ligurian.
* Reviews of each release check new code for new hard-coded facts about Ligurian, as they check for the project's other conventions.
* Still open, each for its own decision once a twin project is near:
  * whether a twin project runs its own database and site from the same code, or shares one database with a column naming the language;
  * how a fix reaches every project: one repository with each language as configuration, or a shared core used by several repositories;
  * how each project's community governs its own spelling, review and licenses.
