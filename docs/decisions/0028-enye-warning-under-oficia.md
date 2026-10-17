# 0028: The manager warns before saving ñ under the grafîa ofiçiâ

* **Status:** accepted
* **Date:** 2026/10/17
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refines:** [0024](0024-letter-enye.md), on where ñ belongs, and [0018](0018-lexicon-manager-design.md), on what the manager checks before saving

## Context

Since 0.6.0 the letter `ñ` is accepted everywhere [decision [0024](0024-letter-enye.md)], because spelling systems other than the grafîa ofiçiâ write it. The grafîa ofiçiâ itself does not. Nothing stopped a contributor from saving a word with `ñ` under `ofiçiâ`, the default the manager preselects, so a word could easily end up filed under the wrong spelling system without anyone noticing.

## Decision

* **A warning, not a refusal.** The lexicon manager warns whenever a form it is about to save contains `ñ` or `Ñ` and the spelling system is `ofiçiâ`. The database keeps accepting it: it cannot know whether the letter or the spelling system is the mistake, and a reviewer still sees every proposal.
* **Two moments:**
  * while typing, a warning line appears under the form as soon as the condition holds, and disappears when the letter or the spelling system changes;
  * when saving, the manager asks for confirmation and saves only if the person confirms.
* **Where:** proposing a new lemma; editing a lemma, where a change of spelling system to `ofiçiâ` also checks the lemma's inflected forms; adding or editing an inflected form, which takes its lemma's spelling system. The automatic base form follows its lemma and is checked with it.
* **One test, in one place:** `enyeUnderOficia` in `admin/src/forms.ts`, tested in Node, with a test that the spelling system code it compares with is the one in the database.
* **The text tells the person what to do:** choose the right spelling system in the list, or ask an admin to add it. The database lists only `ofiçiâ` and `unitäia` today; another system is a one-row addition to `public.orthographies`.

## Consequences

* A word with `ñ` can still be saved under `ofiçiâ`, but never without the person seeing why that is unusual.
* Words imported in bulk [roadmap 0.9] do not pass through these forms; `validate-lexicon` is the natural place for the same warning there.
