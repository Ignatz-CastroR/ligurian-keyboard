# Decision records

Every important decision about this project is recorded here, one file each, so that nobody undoes it by accident or repeats the debate. Each record states its context, the decision, and its consequences.

A decision is never edited away. If it changes, a new record replaces it, and the old one is marked **superseded** with a link to its successor.

| N° | Decision | Date | Status |
|---|---|---|---|
| [0001](0001-input-method-not-editor.md) | An input method, not a standalone editor | 2026/10/10 | accepted |
| [0002](0002-one-dictionary-database.md) | One dictionary database, not two dictionaries | 2026/10/10 | accepted |
| [0003](0003-open-data-and-licenses.md) | Open data; MIT for code, CC BY-SA 4.0 for data | 2026/10/10 | accepted |
| [0004](0004-orthography-and-variety-per-entry.md) | Orthography and variety recorded for every entry; ofiçiâ by default | 2026/10/10 | accepted |
| [0005](0005-ascii-skeleton-is-computed.md) | The ASCII key of every word is computed, never typed | 2026/10/10 | accepted |
| [0006](0006-wordforms-entered-by-hand.md) | Every wordform entered by hand; no morphology generator yet | 2026/10/10 | accepted |
| [0007](0007-technology-stack.md) | TypeScript, PostgreSQL on Supabase, Keyman, web apps | 2026/10/10 | accepted |
| [0008](0008-repository-name-and-home.md) | Name `ligurian-keyboard`, on the maintainer's GitHub account | 2026/10/10 | accepted |
| [0009](0009-data-sources.md) | No copying of copyrighted dictionaries; permission first; corpus frequencies | 2026/10/10 | accepted |
| [0010](0010-versioning-and-releases.md) | Semantic versioning, annotated tags, changelog | 2026/10/10 | accepted |
| [0011](0011-roles-and-review-workflow.md) | Roles member, contributor, reviewer, admin; review enforced in the database | 2026/10/11 | accepted |
| [0012](0012-never-hard-delete.md) | No hard deletes; audit log; optimistic locking | 2026/10/10 | accepted |
| [0013](0013-senses-and-optional-translations.md) | Numbered senses with optional Italian, Spanish and English translations | 2026/10/11 | accepted |
| [0014](0014-automatic-base-form.md) | The base form is created automatically and follows its lemma | 2026/10/11 | accepted |
| [0015](0015-definitions-in-italian.md) | Definitions in Italian for now; in Ligurian once the input method is mature | 2026/10/11 | accepted |
| [0016](0016-database-first-then-interface.md) | Database first, then the lexicon manager | 2026/10/11 | accepted |

## Still open

These questions are not decided yet. Each will get its own record once it is.

* **ç written as s:** should typing `se` also offer `çê`? To be answered by native contributors. See `docs/skeleton-spec.md`.
* **Grafia unitäia:** which extra folding rules it needs, if any.
* **When to add Ligurian definitions:** a judgment call by the maintainers, once the input method is mature. See [0015](0015-definitions-in-italian.md).
