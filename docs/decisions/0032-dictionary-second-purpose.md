# 0032: The dictionary as a second purpose, for the diaspora first

* **Status:** accepted
* **Date:** 2026/10/18
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refines:** [0001](0001-input-method-not-editor.md), on what the project is for; [0002](0002-one-dictionary-database.md), on what the one database serves
* **Superseded in part by:** [0034](0034-dictionary-for-readers.md), on when the dictionary for readers begins and how its first pages are served
* **Refined by:** [0039](0039-grammar-in-structured-fields.md), on the controlled vocabulary of grammar, which replaces a controlled `grammatical_tag`

## Context

The project began as an input method, and the database exists to feed it [decision [0001](0001-input-method-not-editor.md)]. Because that database already records lemmas with every form, numbered senses, definitions, translations into Italian, Spanish and English tied to one sense, review, history, open data and, since 0.10.0, a permanent public code for every entry [decision [0002](0002-one-dictionary-database.md)], it is also the framework of a trilingual Ligurian dictionary.

A framework is not yet a dictionary: it lacks content, an editorial policy, fields that dictionaries carry, and pages for readers. Without a decision, that second purpose would either be ignored or pull the project away from the keyboard.

The audience is clear. Many descendants of Ligurian emigrants live in Argentina and elsewhere in Latin America; La Boca, in Buenos Aires, was built largely by Genoese immigrants. They often know Ligurian words by ear rather than by their spelling, and read Spanish rather than Italian. Dictionaries that exist only in Italian are closed to them.

## Decision

* **The project has two purposes on one database:** the input method first, the dictionary second. The criteria for 1.0.0 remain those of the input method; dictionary work does not delay them.
* **The dictionary's first audience is the diaspora,** above all in Latin America. Where a choice must be made, it favours what they need:
  * finding a word from how it sounds, through the same ASCII search the keyboard uses;
  * Spanish translations;
  * pronunciation.
* **After the keyboard's beta, the dictionary work begins, in this order:**
  1. **Public entry pages,** one per lemma, at a permanent address built from its public code, generated as static files from a daily export, like the snapshot, so that any number of readers costs the database nothing.
  2. **Spanish translations of the most common words,** chosen by their frequency in the corpus.
  3. **Pronunciation,** at least in IPA; recordings by native speakers if the project can host them.
* **Each of these steps gets its own decision record** before it is built, as does any later field: usage examples, register and regional labels, etymology, cross references, a controlled vocabulary for `grammatical_tag`, definitions in Ligurian [decision [0015](0015-definitions-in-italian.md)], an editorial style guide, and citable releases of the data.
* **The dictionary is presented as infrastructure that serves the Ligurian community and its institutions,** open and free to reuse, never as a rival to the Académia Ligùstica do Brénno or A Compagna.

## Consequences

* The roadmap gains dictionary steps after the beta, without moving the steps before it.
* Contributors from the diaspora, with the words, expressions and family vocabulary they preserved abroad, are welcome as contributors like anyone else; their entries are reviewed like everyone's.
* The words of the dictionary still come only from contributors' own knowledge or from sources whose license allows reuse [decision [0009](0009-data-sources.md)]; no protected dictionary is copied to grow it faster.
