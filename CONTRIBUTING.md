# Contributing

Contributions in English, Italian or Ligurian are welcome.

## Words

Until the lexicon manager exists, propose words by pull request or issue as TSV rows [see `docs/lexicon-format.md`]:

* one row per **wordform**: singular, plural, feminine, every verb form you know;
* spell in grafîa ofiçiâ as published by the Académia Ligùstica do Brénno;
* write `pending` in `status`; reviewers switch it to `approved`;
* contribute only words from your own knowledge, or from sources whose license allows it. **Do not copy entries from copyrighted dictionaries.**

## Meanings and translations

* Each meaning of a word is a separate **sense**, numbered 1, 2, 3 ...
* Write each sense's **definition in Italian**. Definitions in Ligurian will come later, once the keyboard makes typing Ligurian easy [`docs/decisions/0015-definitions-in-italian.md`].
* Translations into **Italian, Spanish and English** are optional. Attach each one to the precise sense it translates.

## Code

* Code, identifiers and comments in English.
* Every change to `engine/src/skeleton.ts` updates `docs/skeleton-spec.md` and adds a test.
* `npm run check` must pass.
