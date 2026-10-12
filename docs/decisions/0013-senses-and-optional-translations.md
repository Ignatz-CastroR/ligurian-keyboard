# 0013: Meanings as numbered senses, with optional translations

* **Status:** accepted
* **Date:** 2026/10/11
* **Decided by:** Iosef Tesla R. [Ignatz-CastroR]

## Context

A Ligurian word may have several meanings, and translations belong to a meaning, not to the word. If translations hung directly from the word, nothing would say which Spanish *pluma* matches which Italian *penna* or *piuma*.

## Decision

* Each lemma has **numbered senses**: 1, 2, 3 ..., assigned automatically.
* Each sense may have **translations** [`glosses`] in **Italian, Spanish and English**.
  * All translations are **optional**: a sense may have none.
  * A sense may have several translations per language when they are synonyms of that same meaning [`penna`, `stilografica`].
* Translation languages are a reference table, `gloss_languages`; adding one is a single inserted row.
* A lemma may have **no senses** at all: it is then a spelling only entry, still suggested by the keyboard.

## Consequences

* The public dictionary [`published_dictionary`] shows each meaning with its own translations.
* Senses must be reviewed like any other entry.
