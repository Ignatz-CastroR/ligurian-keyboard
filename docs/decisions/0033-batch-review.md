# 0033: Batch review, the queue grouped by entry

* **Status:** accepted
* **Date:** 2026/10/18
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refines:** [0011](0011-roles-and-review-workflow.md), on how reviewers act on the queue

## Context

Until 0.10.0 the review queue listed every pending row on its own, each with its own Approve and Reject buttons. An entry proposed by a contributor is several rows: the lemma, each inflected form, each sense and each translation. A trial entry showed the cost: one lemma with a form, two senses and a translation needed five separate approvals, in five round trips, with no visible link between the rows beyond their order. A sense without an Italian definition appeared as a bare "1" or "2", which says nothing to a reviewer.

The single buttons also read each row's current version just before changing it. A row a contributor corrected after the reviewer opened the queue was therefore approved in its new form, which the reviewer had never seen.

The bulk import planned next will put hundreds of pending rows in the queue at once; reviewing them one click at a time would not be practical.

## Decision

* **The queue is grouped by entry, and lists only what can be published.** A pending row whose lemma or sense is deleted no longer appears: approving it could never publish it.
* **Grouped by entry:** Each lemma heads its group, with its own row when it is pending, then its pending forms, then each sense followed by the translations of that sense. A group appears whenever any of its rows is pending, also when the lemma itself is already approved; the group's heading then says so. Groups keep the queue's order, oldest first.
* **Every row is labelled from its data:** a sense by its number and its Italian definition, or as having no definition, such as "Significato 2, senza definizione", never as a bare number; a translation by its language and text, with the number of its sense.
* **Batch selection:** a box on every row, a box per entry that selects all its rows, a "select all" box, and Shift+click to select a range of rows; then **Approve selected** or **Reject selected**. Rejecting more than one row asks for confirmation first.
* **Approving an entry approves its pending parts with it:** the entry's own buttons, and its box, act on every pending row of the group. Each part can still be approved or rejected on its own, before or instead; a part rejected first stays rejected when the entry is approved afterwards. Rejecting an entry rejects its pending parts the same way, so that no part of a rejected lemma is left waiting in the queue.
* **What the reviewer saw is what is approved.** The page sends each row with the version it read. A row changed since is not overwritten: it is reported as changed by someone else, and stays pending. After a batch, no row of it stays selected, so a changed row is never approved by a reflexive second click; the rows that failed are marked in the queue instead. While a batch runs, every button of the page waits.
* **One database call per batch:** `public.review_batch(items, status)` [migration 0007] receives up to 500 rows, each named by kind, id and version, and the status `approved` or `rejected`. The page sends at most 200 rows per call, to stay well below the time limit Supabase sets on a statement made through its API; a larger selection becomes several calls.
* **Each row is changed on its own.** A row that fails, because its version changed, because it no longer exists or was deleted, or because a rule refuses the change, is listed with its reason, and every other row of the batch is still changed. The page shows the list above the queue until the next action. If a call is refused whole partway through a large selection, the page still reports what the earlier calls changed, then reloads.
* **Nothing about the rules changes.** The function runs as the caller: row level security, the role rules of the triggers, the automatic base form and the audit log apply to every row as they do to a single update, and each change writes its own line of history with the reviewer's name. Only reviewers, admins and the trusted backend may call it; anyone else, a client token without a user included, is refused before any row is touched. A batch changes only pending rows: it reviews the queue, not the dictionary, and an approved entry is changed from its own page. A deleted row, or one whose lemma or sense is deleted, is never changed by a batch, not even by an admin. A malformed request is refused whole.
* **The single row buttons stay,** and go through the same function, with the same versions, so that one click and a batch follow the same rules.

## Consequences

* A whole entry is approved with one click, and a page of proposals with two.
* A contributor's correction made while a reviewer is reading the queue can no longer be approved unseen.
* A batch is not one transaction: when some rows fail, the others stay changed. This is deliberate, since a version conflict on one translation must not undo the approval of fifty unrelated words; the list of failures says exactly what is still pending.
* The queue view gains columns [each row's version, its lemma's headword, status and public code, and the sense of senses and translations]. Its six original columns are unchanged, so a page cached from 0.10.0 keeps working until it is reloaded.
* Migration 0007 must be run before the code of 0.11.0 is pushed: that lexicon manager reads the new columns and calls the new function.
* The approval of an entry is a choice made in the interface over the rows the page shows. The database still knows nothing of entries: it approves exactly the rows it is given, so a part proposed after the queue was read is never approved by accident.
