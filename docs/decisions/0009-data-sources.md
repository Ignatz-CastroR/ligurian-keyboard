# 0009: Where the words come from

* **Status:** accepted
* **Date:** 2026/10/10
* **Decided by:** Iosef Tesla R. [Ignatz-CastroR]

## Context

Good Ligurian dictionaries exist, but they are other people's copyrighted work. Copying them would expose the project legally and betray their authors. The keyboard's candidate menu also needs real word frequencies, and today every frequency is a placeholder 1.

## Decision

* **No scraping or copying** of copyrighted dictionaries: the Académia's online dictionary, Bampi's dictionaries, Gephras or any other.
* Contributors enter words from **their own knowledge**, or from sources whose license allows reuse [`CONTRIBUTING.md`].
* **Permission first:** the Académia Ligùstica do Brénno and A Compagna will be asked whether the lexicon may be seeded from their word lists, in exchange for credit and editorial roles.
* **Frequencies** will be counted from a freely licensed corpus such as Ligurian Wikipedia [CC BY-SA], after normalizing its mixed spellings to grafîa ofiçiâ.
* The test fixture [`data/fixtures/test-lexicon.tsv`] holds 93 forms copied from the Académia's public alphabet page, for tests only.

## Consequences

* The lexicon grows slowly at first, but on clean legal ground.
