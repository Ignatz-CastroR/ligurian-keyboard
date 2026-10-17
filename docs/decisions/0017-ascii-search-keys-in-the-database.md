# 0017: ASCII search keys stored in the database

* **Status:** accepted
* **Date:** 2026/10/11
* **Decided by:** Eng. José Ignacio Castro de R.

## Context

The lexicon manager must let people search the dictionary. The people who use it type on Italian keyboards, the very problem this project exists to solve [[0001](0001-input-method-not-editor.md)], so a search for `zena` must find `Zêna`. A plain text search cannot do that: the stored headwords carry the accents the users cannot type. Fetching the whole lexicon into the browser to fold it there does not scale.

## Decision

* Migration `0004_search_keys.sql` adds a function `private.skeleton()`, a SQL copy of the engine's `skeleton()` [[0005](0005-ascii-skeleton-is-computed.md)], and two **generated columns**: `lemmas.headword_key` and `wordforms.form_key`, indexed.
* The database computes the keys itself, on every insert and every change of spelling. No client can send or alter them.
* The manager folds the typed query with the engine's own `skeleton()` and searches the keys by prefix.
* The engine stays the reference. `db/test/search-keys.test.ts` checks that both functions give the same key for every form of the test lexicon and for every letter of the alphabet, in both cases.

## Consequences

* The folding rules now exist twice, in TypeScript and in SQL. That duplication is accepted because a test fails the moment they diverge. Any change to `engine/src/skeleton.ts` requires a new migration replacing `private.skeleton()`, and a regeneration of the keys.
* Upper case letters are folded explicitly in SQL instead of relying on `lower()`, which does not fold accented letters under a C locale.
* Search becomes the same operation as typing: what a person types to search is exactly what they type to write.
