# 0002: One dictionary database, not two dictionaries

* **Status:** accepted
* **Date:** 2026/10/10
* **Decided by:** Eng. José Ignacio Castro de R.

## Context

The original plan had two shared dictionaries: a spelling dictionary feeding the keyboard, and a trilingual dictionary of translations. Two separate dictionaries would duplicate every headword and drift apart: a spelling corrected in one would stay wrong in the other.

## Decision

* **One database** [`db/`] holds everything: lemmas, their spelled wordforms, their meanings and their translations.
* The keyboard's word list is **generated** from it [`export_lexicon_tsv()`]; nobody edits that list by hand.
* **Homographs are allowed:** two lemmas may share a spelling when they differ in part of speech [`pénna` noun, `pénna` verb]. The keyboard export lists that spelling once, with the higher frequency.

## Consequences

* A correction made once is correct everywhere.
* The TSV file in `docs/lexicon-format.md` is an export format, not a place to edit.
