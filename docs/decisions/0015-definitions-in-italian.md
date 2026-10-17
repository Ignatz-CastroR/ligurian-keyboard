# 0015: Definitions are written in Italian, for now

* **Status:** accepted
* **Date:** 2026/10/11
* **Decided by:** Eng. José Ignacio Castro de R.

## Context

Every sense of a lemma may carry a definition: a short text explaining the meaning. A dictionary meant to support the revitalization of Ligurian would ideally define Ligurian words **in Ligurian**, as monolingual dictionaries do.

But writing correct Ligurian, in grafîa ofiçiâ, is today hard even for proficient speakers. Its letters [`â`, `æ`, `ç`, `ö`, `ü` and the rest] are missing from ordinary keyboards. Spelling errors in definitions would undermine the dictionary's authority.

This is the very problem the project exists to solve, and it is circular: good Ligurian definitions need a good input method, and a good input method needs the large lexicon that this dictionary is building.

## Decision

Definitions are written **in Italian**, in the column `senses.definition_it`.

* Italian is the language every expected editor writes fluently and correctly.
* Italian, Spanish and English **translations** remain separate, in `glosses`. A definition explains a meaning; a gloss names an equivalent word.
* The database cannot verify which language a text is in. Writing definitions in Italian is a rule for editors, enforced by review.

## Future

Once the input method is mature, backed by a lexicon large enough to make typing Ligurian realistic, editors will also write definitions in Ligurian:

* A new nullable column, `senses.definition_lij`, added by a new migration. `lij` is the ISO 639-3 code for Ligurian, which has no two-letter code.
* Italian definitions stay; the two coexist.
* The trigger for revisiting this decision is a judgment call by the maintainers, not a fixed number of words.

## Consequences

* Editors can start defining words immediately, with no new tooling.
* The dictionary is not yet monolingual. Every Italian definition is a candidate for a Ligurian one later, so nothing written now is wasted.
* Naming the column `definition_it`, not `definition`, makes the language explicit in the schema and leaves room for `definition_lij` without renaming anything.
