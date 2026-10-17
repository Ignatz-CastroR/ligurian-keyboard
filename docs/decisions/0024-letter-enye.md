# 0024: The letter ñ

* **Status:** accepted
* **Date:** 2026/10/17
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refines:** [0004](0004-orthography-and-variety-per-entry.md), on the letters a spelling may contain; [0005](0005-ascii-skeleton-is-computed.md), on the folding rules; and [0022](0022-keyman-keyboard-design.md), on the long press of n
* **Refined by:** [0028](0028-enye-warning-under-oficia.md), on ñ saved under the grafîa ofiçiâ

## Context

Some ways of writing Ligurian, other than the grafîa ofiçiâ, use the letter `ñ`. The project records every entry with its own spelling system [decision [0004](0004-orthography-and-variety-per-entry.md)], so it must be able to store their words; until now it could not. The lexicon manager had no button for `ñ`, and the letter was refused in four places: the database's `ligurian_form` domain, the manager's own check before sending, the engine that loads the published dictionary, and the Android keyboard, which offers exactly the letters the skeleton folds.

A button alone would have been worse than nothing: words typed with it would have failed on saving.

## Decision

* **`ñ` and `Ñ` are Ligurian letters** for the whole project: the database accepts them [migration `0005_letter_enye.sql`], and so do the manager and the engine.
* **The skeleton folds `ñ` to `n`,** like any letter with a diacritic, in all three copies of the rule: `engine/src/skeleton.ts`, `private.skeleton()` in the database, and the keyboard dictionary's `searchTermToKey`. Typing `n` finds the spelling with `ñ`.
* **The manager's letter buttons end with `ñ`,** after the letters of the grafîa ofiçiâ, which keep their order; Shift gives `Ñ`.
* **The Android keyboard offers `ñ` on a long press of `n`,** because its rule is to offer exactly the letters the skeleton folds, in lower case and in capitals, and a test enforces it.
* **No restriction by spelling system.** The database does not tie `ñ` to a particular spelling system: it never checked letters per system, and the list of systems is open. Choosing the right system for a word stays the contributor's job, checked by the reviewers.
* **Tests read the letters from the database itself,** built from every migration, instead of from the file that first defined them, so that a later change to the letters cannot go unnoticed.

## Consequences

* **Migration 0005 must be run once in Supabase** before a word with `ñ` can be saved. It is safe on the live database: the new letter list includes the old one, and no stored word can contain `ñ`, so no stored search key changes.
* A word with `ñ` reaches the web editor's dictionary like any other, under its own spelling system. The Android dictionary holds only the zeneize forms in grafîa ofiçiâ [decision [0022](0022-keyman-keyboard-design.md)], so it gets such a word only if it is recorded in grafîa ofiçiâ.
* The keyboard's layout file changes, and with it the keyboard package: version 0.6.0 is a real change for people who have it installed.
* Adding a letter now touches, at the least: a migration, `LIGURIAN_LETTERS` and `SPECIAL_LETTERS` in `admin/src/forms.ts`, `VALID_FORM` in `engine/src/lexicon.ts`, the three copies of the folding rule, `LONG_PRESS` in `keyman/src/touch-layout.ts`, and `docs/skeleton-spec.md`. Every one of them except the buttons and the documentation is guarded by a test that fails if it is forgotten.
