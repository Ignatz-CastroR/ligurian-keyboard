# 0004: Orthography and variety recorded for every entry

* **Status:** accepted
* **Date:** 2026/10/10
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refined by:** [0024](0024-letter-enye.md), on the letters a spelling may contain

## Context

Ligurian has no single accepted spelling standard. The grafîa ofiçiâ of the Académia Ligùstica do Brénno and A Compagna is Genoese based; the grafia unitäia is used by the Ligurian press and several publishers. Ligurian is also several varieties, not only Genoese. Hardcoding one spelling and one variety would take sides in a dispute among speakers.

## Decision

* **Grafîa ofiçiâ is the default, not an obligation.**
* Every lemma records its **orthography** [`ofiçiâ`, `unitäia`] and its **variety** [`zeneize`, `savoneize`, `spezzin`, `tabarchin`, `monegasco`].
* Both are reference tables in the database, so a misspelled code cannot be stored, and a new one is a single inserted row.

## Consequences

* The keyboard can filter by variety and orthography.
* Supporting grafia unitäia later may need extra folding rules: see the open questions in `docs/skeleton-spec.md`.
