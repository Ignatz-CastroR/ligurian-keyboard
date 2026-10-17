# Contributing

Contributions in English, Italian, Spanish or Ligurian are welcome.

## Words

Words are proposed in the **lexicon manager** [`admin/`, see `admin/README.md`]. Ask a maintainer for an account; every proposal waits as `pending` until a reviewer approves it.

* Enter every **wordform** you know: plural, feminine, every verb form. The base form is created automatically with the lemma.
* Spell in grafîa ofiçiâ as published by the Académia Ligùstica do Brénno; the manager has buttons for the special letters. A word written in another spelling system, for example with `ñ`, is entered with that system chosen.
* Enter each **elided particle** once, as an entry of its own: `d'`, `l'`, `quell'`. Never enter `d'ægua` or `l'ægua`: enter `ægua`, and the editor and the keyboard join the particle and the word by themselves, since they split a word after its inner apostrophe [`docs/decisions/0029-elision.md`]. The manager warns if a form joins the two.
* Contribute only words from your own knowledge, or from sources whose license allows it. **Do not copy entries from copyrighted dictionaries.**

Without an account, a word can still be proposed by issue, as a TSV row [see `docs/lexicon-format.md`].

## Meanings and translations

* Each meaning of a word is a separate **sense**, numbered 1, 2, 3 ...
* Write each sense's **definition in Italian**. Definitions in Ligurian will come later, once the keyboard makes typing Ligurian easy [`docs/decisions/0015-definitions-in-italian.md`].
* Translations into **Italian, Spanish and English** are optional. Attach each one to the precise sense it translates.

## Code

* Code, identifiers and comments in English.
* A change to the folding rules in `engine/src/skeleton.ts` is made in four places at once, as `docs/skeleton-spec.md` explains: that page, `engine/src/skeleton.ts`, a new migration replacing `private.skeleton()`, and the Keyman model's `searchTermToKey`, plus `LONG_PRESS` in `keyman/src/touch-layout.ts` when a letter is added. The tests fail until all of them agree.
* Every new design decision gets a record in `docs/decisions/` and a row in both decision tables, in `docs/decisions/README.md` and in `README.md`; `docs/test/decisions.test.ts` checks that the tables follow the records.
* `npm run check` must pass.
