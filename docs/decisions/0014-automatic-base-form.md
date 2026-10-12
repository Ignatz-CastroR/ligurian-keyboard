# 0014: The base form is created automatically and follows its lemma

* **Status:** accepted
* **Date:** 2026/10/11
* **Decided by:** Iosef Tesla R. [Ignatz-CastroR]

## Context

The keyboard suggests wordforms, not lemmas. Without help, every new lemma would need a second, separate entry for its own spelling, and a reviewer would have to approve the same spelling twice.

## Decision

* Creating a lemma **automatically** creates a wordform spelled like its headword, marked as the **base form** [`is_base`].
* The base form **follows its lemma**:
  * approving or rejecting the lemma approves or rejects it;
  * correcting the headword corrects it.
* Nobody may change its spelling, status or deletion directly; editors edit the lemma instead. Its frequency and grammatical tag stay editable.
* Inflected forms are still added by hand and need their own approval.
* The review queue does not list base forms, since they are approved together with their lemma.

## Consequences

* One approval publishes a word and its spelling.
* Renaming a headword onto a spelling the lemma already has as an extra form is refused, with a clear message.
