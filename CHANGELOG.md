# Changelog

All notable changes to this project are recorded here. Versions follow
[Semantic Versioning](https://semver.org/): while the major number is 0,
the project is in early development and anything may change.

## [Unreleased]

### Planned
* Export of the approved lexicon to a Keyman keyboard.

## [0.4.0] 2026/10/17

Web editor: type plain letters, get grafîa ofiçiâ. It is now the front
page of the site; the lexicon manager moves to `/admin/`.

### Added
* `editor/`: the web editor [TypeScript, Vite, no framework].
  * Conversion when a space or a new line finishes a word, read from
    the `input` event so that phone keyboards work; nothing happens
    while a phone keyboard is composing, and pasted text is never
    converted.
  * Candidate menu: numbers, arrows, Enter, Tab, Escape, touch; a last
    entry to keep the word as typed. Under the word with a mouse, a
    bar above the on-screen keyboard on touch screens.
  * Typing on with the menu open accepts the highlighted spelling.
  * Backspace right after a conversion undoes it; Ctrl+Z also works.
  * Filters by variety and spelling system, `zeneize` and `ofiçiâ` by
    default.
  * Copy, download as `.txt`, clear; the draft is kept in the browser.
  * Offline use after the first visit, through a service worker.
  * Interface in Italian and English, sharing the language choice
    with the lexicon manager.
  * `src/ime.ts`: every decision as a pure function; 14 tests in
    `test/editor.test.ts`.
* `tools/fetch-lexicon.ts`: daily dictionary snapshot from
  `export_lexicon_tsv()`, checked and stamped; a broken or empty
  snapshot stops the build.
* `tools/use-fixture-lexicon.ts`: the test fixture as a local
  dictionary, no database needed.
* `tools/assemble-site.ts`: joins the editor and the manager into
  `_site/`.
* `Lexicon.entries()` in the engine: every indexed entry.
* npm scripts `test:editor`, `editor:dev`, `editor:build`,
  `lexicon:snapshot`, `lexicon:fixture`, `site:build`, `site:preview`.
* Decisions 0019 [daily dictionary snapshot] and 0020 [design of the
  web editor].

### Changed
* `.github/workflows/admin-pages.yml` replaced by `pages.yml`: it also
  takes the snapshot, builds the editor, publishes the editor at the
  root and the manager under `/admin/`, and runs every day at 03:17 UTC.
* The lexicon manager links to the editor in its header.
* Root README, `admin/README.md` and `editor/README.md` updated.
* `.gitignore`: `_site/` and `editor/public/lexicon.tsv`.

## [0.3.0] 2026/10/11

Lexicon manager: the web page to search, propose and review entries.
The database is now deployed on Supabase [Central EU, Frankfurt].

### Added
* `admin/`: the lexicon manager [TypeScript, Vite, Supabase JS].
  * Search by ASCII key, on headwords and on inflected forms; open to
    signed out visitors for the published entries.
  * Entry page: lemma, forms, numbered senses and translations, with
    edit, approve, reject, delete and restore buttons according to
    the role; history for reviewers and admins.
  * New lemma page, with special letter buttons and a list of
    existing lemmas sharing the same ASCII key.
  * Review queue, oldest first.
  * Own profile; list of people and role changes for staff.
  * TSV export of the published lexicon.
  * Interface in Italian and English.
  * Optimistic locking on every update; version conflicts reload the
    entry and explain.
  * `admin/test/`: 14 tests; every button rule is checked against
    real update attempts on an embedded PostgreSQL.
* `db/migrations/0004_search_keys.sql`: `private.skeleton()`, a SQL
  copy of the engine's folding, and generated, indexed columns
  `lemmas.headword_key` and `wordforms.form_key`.
* `db/test/search-keys.test.ts`: 6 tests; the SQL folding matches the
  engine on every fixture form and every letter in both cases.
* `.github/workflows/admin-pages.yml`: runs every test, builds the
  manager and publishes it on GitHub Pages.
* `.env.example`: template of the manager's two settings.
* Decision records `0017` [ASCII search keys in the database] and
  `0018` [design of the lexicon manager].

### Changed
* `package.json`: version 0.3.0; dependency `@supabase/supabase-js`;
  dev dependency `vite`; scripts `test:admin`, `admin:dev`,
  `admin:build`, `admin:preview`; `test` runs the admin tests too.
* `package-lock.json`: updated.
* `tsconfig.json`: type checks `admin/`.
* `.gitignore`: keeps `.env.example` while ignoring every other
  `.env` file.
* `db/README.md`: migration 0004, search keys, deployment notes.
* `docs/skeleton-spec.md`: the SQL mirror of the folding rules.
* `docs/decisions/README.md`: records 0017 and 0018; realtime updates
  listed as an open question.
* `README.md`: rewritten as a full description of the project: its
  purpose, how typing works, spelling systems and varieties, the parts
  of the project, the shared dictionary, the lexicon manager, data
  sources, setup, layout, tests, decisions, open questions, roadmap,
  and a short summary of every version.

## [0.2.0] 2026/10/11

Dictionary database for PostgreSQL / Supabase, with roles and review.
The database is written and tested, not yet deployed.

### Added
* `db/migrations/0001_lexicon_schema.sql`
  * Tables `lemmas`, `wordforms`, `senses`, `glosses`, `profiles`,
    `audit_log`.
  * Reference tables `varieties` [zeneize, savoneize, spezzin,
    tabarchin, monegasco], `orthographies` [ofiçiâ, unitäia] and
    `gloss_languages` [it, es, en].
  * Domain `ligurian_form`: NFC, Ligurian letters plus `'` and `-`,
    at most 64 characters.
  * Senses: numbered meanings per lemma, with an optional definition
    in Italian [`definition_it`].
  * Glosses: optional Italian, Spanish and English translations,
    attached to one sense, several per language allowed.
  * Wordform column `is_base`; at most one live base form per lemma.
  * Unique live spellings per lemma; homographs allowed across lemmas.
* `db/migrations/0002_rules_and_history.sql`
  * Roles member, contributor, reviewer, admin, checked on every
    insert and update.
  * Contributors' rows forced to `pending` and stamped with their
    author.
  * Automatic base form: creating a lemma creates its headword as a
    wordform, which follows the lemma's spelling and status and
    cannot be edited directly.
  * Automatic sense numbering 1, 2, 3 ... per lemma.
  * No children for deleted lemmas or senses; entries never move
    between parents.
  * `version` bumped on every update, for optimistic locking.
  * Hard deletes refused for everyone; soft delete and restore by
    admins only.
  * Append only `audit_log` written on every change.
  * A `member` profile for every new account; only admins change
    roles; the last admin cannot be demoted.
* `db/migrations/0003_access_and_export.sql`
  * All default Supabase privileges revoked, then only the needed ones
    granted.
  * Row level security on every table.
  * Views `published_wordforms`, `published_dictionary` and
    `review_queue`.
  * `export_lexicon_tsv()`: the published wordforms in the engine's
    format, sorted for stable diffs.
* `db/test/`: Supabase shim, test harness and 21 tests on an embedded
  PostgreSQL [PGlite]; one test loads the export into the engine.
* `db/README.md`: data model, roles, client rules, deployment steps.
* `docs/decisions/`: an index and 16 decision records covering every
  design decision so far: input method, one database, open data and
  licenses, orthography and variety, computed ASCII keys, hand entered
  wordforms, technology stack, repository name, data sources,
  versioning, roles and review, no hard deletes, senses and
  translations, automatic base form, definitions in Italian, and the
  order of work.
* `README.md`: section "Design decisions".
* `README.md`: section "What changed in 0.2.0".

### Changed
* `package.json`: version 0.2.0; dev dependency
  `@electric-sql/pglite`; scripts `test:engine`, `test:db`, and `test`
  running both.
* `package-lock.json`: updated for PGlite.
* `tsconfig.json`: type checks `db/` as well as `engine/`.
* `docs/lexicon-format.md`: meanings and translations described as
  senses with optional Italian, Spanish and English glosses.
* `README.md`: status table.
* `CONTRIBUTING.md`: rules for senses, Italian definitions and
  translations.

## [0.1.0] 2026/10/10

### Added
* Conversion engine: ASCII skeleton folding based on the Académia
  Ligùstica do Brénno alphabet, TSV lexicon loader, per token
  conversion with candidate menu.
* Terminal demo and 17 unit tests.
* Italian and English documentation; MIT license for code, CC BY-SA 4.0
  for lexicon data.
