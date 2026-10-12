# 0016: Database first, then the lexicon manager

* **Status:** accepted
* **Date:** 2026/10/11
* **Decided by:** Iosef Tesla R. [Ignatz-CastroR]

## Decision

* The order of work is: the dictionary database [`v0.2.0`], its deployment to Supabase, then the **lexicon manager** [`admin/`], then the web editor and the Keyman export.
* The **lexicon manager** is a TypeScript web application where:
  * everyone can search the published dictionary;
  * contributors sign in and propose words, forms, senses and translations;
  * reviewers work through the review queue;
  * admins manage roles, deletions, history and the TSV export.
* It talks directly to Supabase and can be hosted free on GitHub Pages. Since every permission is enforced by the database [[0011](0011-roles-and-review-workflow.md)], even a modified copy of the page cannot break the rules.

## Consequences

* Until the lexicon manager exists, words are proposed by pull request or issue, as described in `CONTRIBUTING.md`.
