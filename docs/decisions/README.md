# Decision records

Every important decision about this project is recorded here, one file each, so that nobody undoes it by accident or repeats the debate. Each record states its context, the decision, and its consequences.

A decision is never edited away. If it changes, a new record replaces it, and the old one is marked **superseded** with a link to its successor.

| N° | Decision | Date | Status |
|---|---|---|---|
| [0001](0001-input-method-not-editor.md) | An input method, not a standalone editor | 2026/10/10 | accepted |
| [0002](0002-one-dictionary-database.md) | One dictionary database, not two dictionaries | 2026/10/10 | accepted |
| [0003](0003-open-data-and-licenses.md) | Open data and licenses | 2026/10/10 | accepted |
| [0004](0004-orthography-and-variety-per-entry.md) | Orthography and variety recorded for every entry | 2026/10/10 | accepted |
| [0005](0005-ascii-skeleton-is-computed.md) | The ASCII key of every word is computed, never typed | 2026/10/10 | accepted |
| [0006](0006-wordforms-entered-by-hand.md) | Every wordform is entered by hand; no morphology generator yet | 2026/10/10 | accepted |
| [0007](0007-technology-stack.md) | Technology stack | 2026/10/10 | accepted |
| [0008](0008-repository-name-and-home.md) | Repository name and home | 2026/10/10 | accepted |
| [0009](0009-data-sources.md) | Where the words come from | 2026/10/10 | accepted; superseded in part by [0027](0027-real-frequencies.md) |
| [0010](0010-versioning-and-releases.md) | Versioning and releases | 2026/10/10 | accepted |
| [0011](0011-roles-and-review-workflow.md) | Roles and the review workflow | 2026/10/10 | accepted |
| [0012](0012-never-hard-delete.md) | Never hard delete; keep the whole history | 2026/10/10 | accepted |
| [0013](0013-senses-and-optional-translations.md) | Meanings as numbered senses, with optional translations | 2026/10/11 | accepted |
| [0014](0014-automatic-base-form.md) | The base form is created automatically and follows its lemma | 2026/10/11 | accepted |
| [0015](0015-definitions-in-italian.md) | Definitions are written in Italian, for now | 2026/10/11 | accepted |
| [0016](0016-database-first-then-interface.md) | Database first, then the lexicon manager | 2026/10/11 | accepted |
| [0017](0017-ascii-search-keys-in-the-database.md) | ASCII search keys stored in the database | 2026/10/11 | accepted |
| [0018](0018-lexicon-manager-design.md) | Design of the lexicon manager | 2026/10/11 | accepted |
| [0019](0019-editor-dictionary-snapshot.md) | The web editor reads a daily snapshot of the dictionary | 2026/10/17 | accepted |
| [0020](0020-web-editor-design.md) | Design of the web editor | 2026/10/17 | accepted |
| [0021](0021-keyman-scope-and-toolchain.md) | Keyman keyboard: scope, toolchain and distribution | 2026/10/17 | accepted |
| [0022](0022-keyman-keyboard-design.md) | Design of the Keyman keyboard and dictionary | 2026/10/17 | accepted |
| [0023](0023-lexicon-manager-spanish-history-csv.md) | Lexicon manager in Spanish, latest additions, CSV download | 2026/10/17 | accepted; superseded in part by [0025](0025-csv-semicolon.md) |
| [0024](0024-letter-enye.md) | The letter ñ | 2026/10/17 | accepted |
| [0025](0025-csv-semicolon.md) | The CSV download is separated by semicolons | 2026/10/17 | accepted |
| [0026](0026-workflow-runtimes.md) | Workflow runners and runtimes | 2026/10/17 | accepted |
| [0027](0027-real-frequencies.md) | Real frequencies from the Ligurian Wikipedia | 2026/10/17 | accepted |
| [0028](0028-enye-warning-under-oficia.md) | The manager warns before saving ñ under the grafîa ofiçiâ | 2026/10/17 | accepted |
| [0029](0029-elision.md) | Elided words are split at the apostrophe | 2026/10/17 | accepted |
| [0030](0030-public-identifiers.md) | Public identifiers for lemmas and wordforms | 2026/10/18 | accepted |
| [0031](0031-backups.md) | Backups from the lexicon manager | 2026/10/18 | accepted |
| [0032](0032-dictionary-second-purpose.md) | The dictionary as a second purpose, for the diaspora first | 2026/10/18 | accepted |

## Still open

These questions are not decided yet. Each will get its own record once it is.

* **ç written as s:** should typing `se` also offer `çê`? To be answered by native contributors. See `docs/skeleton-spec.md`.
* **Grafia unitäia:** which extra folding rules it needs, if any.
* **Realtime updates in the lexicon manager:** whether reviewers should see each other's changes live. See [0018](0018-lexicon-manager-design.md).
* **When to add Ligurian definitions:** a judgment call by the maintainers, once the input method is mature. See [0015](0015-definitions-in-italian.md).
