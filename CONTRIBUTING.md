# Contributing

Contributions in English, Italian or Ligurian are welcome.

## Words

Until the lexicon manager exists, propose words by pull request or issue as TSV rows [see `docs/lexicon-format.md`]:

* one row per **wordform**: singular, plural, feminine, every verb form you know;
* spell in grafîa ofiçiâ as published by the Académia Ligùstica do Brénno;
* write `pending` in `status`; reviewers switch it to `approved`;
* contribute only words from your own knowledge, or from sources whose license allows it. **Do not copy entries from copyrighted dictionaries.**

## Code

* Code, identifiers and comments in English.
* Every change to `engine/src/skeleton.ts` updates `docs/skeleton-spec.md` and adds a test.
* `npm run check` must pass.
