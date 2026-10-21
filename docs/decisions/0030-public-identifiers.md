# 0030: Public identifiers for lemmas and wordforms

* **Status:** accepted
* **Date:** 2026/10/18
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refines:** [0012](0012-never-hard-delete.md), on what the database owns in every row and what the history records

## Context

Every row already has an `id`, a number the database counts up and never reuses. That number belongs to one database. A restore into a new project, a merge with another source or a future import can renumber rows, and a number such as `37` means nothing outside the database it came from.

The project needs a name for an entry that survives all of that: to link a lemma with its inflected forms in a backup or an import file, to recognize a row that is already in the dictionary when the same file is imported twice, and to let people cite an entry without ambiguity.

## Decision

* **Lemmas and wordforms each carry a public identifier,** the column `public_id`. Senses and glosses do not: they live inside a lemma and are never cited or imported on their own.
* **The format is `LIJ-` followed by nine characters,** for example `LIJ-7K3Q9MDXK`:
  * `LIJ`, the ISO 639-3 code of Ligurian, the same prefix for lemmas and wordforms; the table says which one a code names;
  * eight characters of **Crockford's base 32**, the digits and the letters without `I`, `L`, `O` and `U`, so that a code read aloud or copied by hand cannot confuse `1` with `I` or `L`, or `0` with `O`;
  * **Crockford's check symbol,** the value of the eight characters modulo 37, written with the same 32 characters plus `*`, `~`, `$`, `=` and `U`. Because 37 is a prime larger than 32, it catches every single mistyped character and every swap of two neighbouring characters among the eight.
* **The eight characters are random,** 40 bits drawn by the database, so a code reveals nothing about when or by whom an entry was made. About a trillion codes exist; a collision with an earlier code simply draws again.
* **The database assigns the code** when a row is inserted, and **keeps it forever:** a value sent by a client, an admin or the trusted backend is overwritten on insert and ignored on update, as `id` and `version` are. The only exception is a restore [decision [0031](0031-backups.md)], which keeps the codes its backup carries. A check constraint refuses any malformed code or wrong check symbol in the table itself.
* **A code is unique across both tables and never reused.** Every code ever issued is recorded in a private table, `private.issued_public_ids`, from which nothing is deleted; a deleted entry keeps its code, and no other entry can ever receive it.
* **Existing entries receive their codes in migration 0006,** through ordinary updates, so each one raises the row's version and leaves a line in the history.
* **The lexicon manager shows the codes,** on every lemma and form and in each line of history, and **finds an entry by its code** typed into the search field. Typing is forgiving, as Crockford intends: case, spaces and hyphens anywhere, `O` for `0` and `I` or `L` for `1` are accepted. A code whose check symbol does not match is reported as a typing mistake, never taken for another entry.
* **The codes are not in the daily snapshot** nor in the TSV and CSV downloads. The input method needs only spellings, and adding a column would change the format that the editor, the Keyman dictionary and `validate-lexicon` read [`docs/lexicon-format.md`].

## Consequences

* Backups [decision [0031](0031-backups.md)] and future bulk imports can refer to entries by a name that does not depend on one database.
* The check symbol makes a mistyped code fail loudly instead of finding a different entry.
* Migration 0006 raises the version of every existing lemma and wordform by one; a page left open in the manager before the migration reports a conflict on its next save and reloads.
* The TypeScript copy of the format in `admin/src/public-id.ts` and the SQL in migration 0006 must compute the same check symbols; a test compares them on hundreds of codes, and on codes drawn by the database itself.
