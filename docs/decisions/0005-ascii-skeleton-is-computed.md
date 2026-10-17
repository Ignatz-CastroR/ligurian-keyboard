# 0005: The ASCII key of every word is computed, never typed

* **Status:** accepted
* **Date:** 2026/10/10
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refined by:** [0024](0024-letter-enye.md), on the folding of ñ

## Context

The keyboard must map what a user types in plain ASCII to the correct grafîa ofiçiâ spelling. If editors had to type that ASCII key for every word by hand, they would make mistakes and the keys would drift from the spellings.

## Decision

* A deterministic function, `skeleton()` [`engine/src/skeleton.ts`], folds every official spelling into its ASCII key: `çitæ` becomes `citae`.
* Its rules come from the Académia's official alphabet page, the *Arfabêto*, and are specified in `docs/skeleton-spec.md`.
* Editors only ever type the real spelling. The key is computed.
* Typed words are folded the same way and looked up: one match is replaced silently, several open a menu, none leave the word as typed.

## Consequences

* A change to `skeleton.ts` must update `docs/skeleton-spec.md` and add a test [`CONTRIBUTING.md`].
* **Still open:** whether typing `se` should also offer `çê`, since the *Arfabêto* allows writing ç as s. Native contributors should decide; it is listed in `docs/skeleton-spec.md`.
