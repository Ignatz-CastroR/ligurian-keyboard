# 0011: Roles and the review workflow

* **Status:** accepted
* **Date:** 2026/10/10, refined 2026/10/11
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refined by:** [0033](0033-batch-review.md), on batch review and the queue grouped by entry

## Context

Many people will add words, and not all of them will spell perfectly. The lexicon's authority depends on review. The rules must hold even against a buggy or malicious client.

## Decision

* **Four roles:**
  * **member:** every new account; reads the published lexicon only.
  * **contributor:** proposes entries; they always enter as `pending`.
  * **reviewer:** approves, rejects and corrects any entry.
  * **admin:** reviewer powers, plus soft delete, restore and changing roles.
* Only an admin promotes people. Nobody can promote themselves, and the last admin cannot be demoted.
* Every entry has a review status: `pending`, `approved` or `rejected`. Only approved entries with approved parents are published.
* The rules are enforced **inside the database**: row level security decides which rows a user may touch, and triggers decide what may change in them. The web interface only displays them.

## Consequences

* New accounts must be promoted by hand. This is deliberate friction that keeps spam out of the review queue.
