# Contributing

Contributions in English, Italian or Ligurian are welcome.

## Words

Words are proposed in the **lexicon manager** [`admin/`, see `admin/README.md`]. Ask a maintainer for an account; every proposal waits as `pending` until a reviewer approves it.

* Enter every **wordform** you know: plural, feminine, every verb form. The base form is created automatically with the lemma.
* Spell in grafîa ofiçiâ as published by the Académia Ligùstica do Brénno; the manager has buttons for the special letters.
* Contribute only words from your own knowledge, or from sources whose license allows it. **Do not copy entries from copyrighted dictionaries.**

Without an account, a word can still be proposed by issue, as a TSV row [see `docs/lexicon-format.md`].

## Meanings and translations

* Each meaning of a word is a separate **sense**, numbered 1, 2, 3 ...
* Write each sense's **definition in Italian**. Definitions in Ligurian will come later, once the keyboard makes typing Ligurian easy [`docs/decisions/0015-definitions-in-italian.md`].
* Translations into **Italian, Spanish and English** are optional. Attach each one to the precise sense it translates.

## Code

* Code, identifiers and comments in English.
* Every change to `engine/src/skeleton.ts` updates `docs/skeleton-spec.md` and adds a test.
* `npm run check` must pass.
