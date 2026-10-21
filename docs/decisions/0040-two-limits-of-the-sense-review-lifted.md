# 0040: Two limits of the sense review lifted

* **Status:** accepted
* **Date:** 2026/10/21
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refines:** [0038](0038-senses-reviewed-one-by-one.md), on how a kept sense is renumbered and how the Users section reads a cleared review date

## Context

[0038](0038-senses-reviewed-one-by-one.md) recorded two limits of 0.15.0. The Users section read any change of a lemma's review date as "significati rivisti", its clearing included, since the history's summary named the fields an update changed, not their values. And a kept sense that a regrouping renumbered wrote two lines of history: the rule that two live senses of a lemma never share a number was a unique index, checked at each row, so the sense first moved to a temporary number above every number in use, then to its final one.

## Decision

* **One live sense per number is now a constraint that a transaction may check at its end:** an exclusion constraint on the lemma and the number of its live senses. By default it is checked at the end of each statement, where the index checked each row: a single statement that swaps two numbers is now accepted, since the rule holds when it ends. Breaking it is SQLSTATE 23P01. `regroup_senses()` alone defers it while the senses move, and checks it before it returns. A kept sense goes straight to its final number, with one line of history, from its old number to its new. No temporary number is used.
* **`user_history()` names the fields an update set to null,** in a column `cleared`, beside `changed`. The Users section reads a review date cleared as "significati rimessi in attesa".

## Consequences

* The manager reads 23P01 as a duplicate, as it read 23505 from the index.
* `regroup_senses()` ends with the rule checked at once, whatever the caller had set for it before: a session of the SQL Editor that had deferred every constraint finds this one checked at once again after the call. No request through the API can defer it.
* The deferral never outlives the regrouping: a test proves that, within the same transaction, the rule is checked at once again as soon as the call returns.
* Lines of history written before 0.16.0 keep their two lines. Clearings made before 0.16.0 now read right too, since `cleared` is computed from the stored lines.
