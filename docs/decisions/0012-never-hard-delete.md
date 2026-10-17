# 0012: Never hard delete; keep the whole history

* **Status:** accepted
* **Date:** 2026/10/10
* **Decided by:** Eng. José Ignacio Castro de R.

## Context

In lexicography, the history of an entry is itself data. A careless edit or vandalism must always be reversible, and two editors working at once must not silently overwrite each other.

## Decision

* **No hard deletes**, for anyone, the trusted backend included. Entries are **soft deleted** by setting `deleted_at`, and restored by clearing it. Only admins do either.
* An **append only audit log** records every insert, update, soft delete and restore: who, when, and the row before and after. Nobody can change it.
* **Optimistic locking:** every row has a `version` number, which the database raises on every update. A client updates `where id = ... and version = ...`; zero affected rows means someone else changed the row first.

## Consequences

* The database only grows. At the expected size, this is negligible.
