# Changelog

All notable changes to this project are recorded here, version by
version and file by file. Versions follow
[Semantic Versioning](https://semver.org/): while the major number is 0,
the project is in early development and anything may change, so every
release is published on GitHub as a pre-release. Every version has an
annotated git tag, `vX.Y.Z`, and a release on the
[Releases page](https://github.com/Ignatz-CastroR/ligurian-keyboard/releases);
the links at the end of this file show every change between two
versions.

## [Unreleased]

### Planned
* Version 0.6.0: real frequencies, counted from a freely licensed body
  of text, so suggestions come in a sensible order.

## [0.5.0] 2026/10/17

The Android keyboard: type plain letters in any app and get grafîa
ofiçiâ from the suggestion bar.

### Added
* `keyman/ligurian_keyboard/`: Keyman keyboard "Ligure [grafîa
  ofiçiâ]" for phones and tablets.
  * Italian QWERTY layout; long press on `a e i o u` for the vowels
    with grave, acute, circumflex and diaeresis, on `a` also for `æ`,
    on `c` for `ç`; a dot marks the keys with a long press.
  * An apostrophe key on the main layer; a numbers and symbols layer.
  * A capital at the start of the text and of every sentence; a
    double tap on Shift locks capitals. Needs Keyman 17 or newer.
* `keyman/ignatzcastror.lij.ligurian_keyboard/`: Keyman lexical model,
  the dictionary behind the suggestions.
  * The approved zeneize forms in ofiçiâ of the dictionary snapshot.
  * `searchTermToKey`: a self-contained, ES3 compatible copy of the
    engine's `skeleton()`, so `zena` finds `Zêna`, `citae` finds
    `çitæ` and `canpanna` finds `canpànn-a`.
  * Suggestions follow the casing typed; hyphenated spellings stay one
    word.
  * Version = the snapshot's date, `YYYY.M.D`.
  * License file covering both the CC BY-SA 4.0 word list and the MIT
    code.
* `keyman/src/`: the layout as a short description
  [`touch-layout.ts`], snapshot to Keyman word list [`wordlist.ts`],
  staging and compilation with `kmc` [`build.ts`].
* `keyman/test/`: 30 tests. A real build with `kmc`; the compiled
  dictionary loaded and inspected, proving that its search keys equal
  `skeleton()` on every character up to U+02FF, every fixture word in
  four forms and 5,000 pseudo-random strings, whose coverage of every
  piece and every length is itself tested; exactly the Ligurian
  letters on the layout, in both cases; rows of equal width by
  Keyman's own arithmetic; the layer rules; package contents; refusal
  of a bad snapshot and of a failing compiler, keeping earlier
  packages; error reporting always off. 103 tests in all.
* `tools/build-keyman.ts` [`npm run keyman:build`] and
  `tools/write-touch-layout.ts` [`npm run keyman:layout`].
* `editor/public/tastiera/`: install page in Italian and English, with
  both packages and the dictionary's date and size; linked from the
  editor's header as "Tastiera Android".
* `.github/workflows/release-assets.yml`: attaches both packages to
  every published release. The build runs with a read-only token; a
  separate job with write access only uploads the files.
* `@keymanapp/kmc` 18.0.254 as a development dependency, pinned
  exactly; always run with `--no-error-reporting`.
* npm scripts `test:keyman`, `keyman:build`, `keyman:layout`.
* Decision records 0021 [scope, toolchain, distribution] and 0022
  [design of the keyboard and dictionary]; records 0001 and 0007 now
  point to 0021.

### Changed
* `npm run site:build` builds the Keyman packages first;
  `tools/assemble-site.ts` puts them under `_site/tastiera/` and
  refuses to assemble without them. The daily site build therefore
  refreshes the dictionary package too.
* `docs/skeleton-spec.md`: new section "The Keyman mirror"; a rule
  change now touches four places. The header of
  `engine/src/skeleton.ts` points to both mirrors.
* `editor/public/sw.js`: the offline copy leaves `/tastiera/` alone,
  as it does `/admin/`.
* Web editor, Italian texts: "senza accenti" instead of "in lettere
  normali", as on the install page.
* `README.md` rewritten: links to use and download everything, at the
  top; what a visitor can download and which version to choose; how
  the input method works in the editor and in the Android keyboard;
  how a word travels from the dictionary to the screen; privacy;
  automation; the criteria for 1.0.0; a complete summary in Italian.
* `docs/lexicon-format.md`: describes the daily snapshot as it now
  works.
* Decision records 0008 and 0021: wording made impersonal; no
  decision changed.
* `.gitignore`: the local commit script is ignored in all its numbered
  versions; the local folders section renamed.

## [0.4.1] 2026/10/17

### Fixed
* Web editor: the dictionary status said "1 forme" / "1 forms" for a
  dictionary of one form; it now agrees in number in both languages.
  One new test; 73 in all.

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

The conversion engine: plain letters in, grafîa ofiçiâ out.

### Added
* `engine/src/skeleton.ts`: folds a spelling to its ASCII key, by the
  rules of the Académia Ligùstica do Brénno's *Arfabêto*: accented
  vowels lose the mark, `æ` becomes `ae`, `ç` becomes `c`, hyphens are
  dropped, typographic apostrophes become `'`.
* `engine/src/lexicon.ts`: loads the word list [TSV with `form`,
  `freq`, `variety`, `orthography`, `status`], indexes the approved
  rows by skeleton, and reports every invalid row with its line
  number.
* `engine/src/convert.ts`: decides for each typed token whether to
  replace it, offer a menu or keep it; keeps punctuation and the
  casing typed; offers first a candidate typed exactly.
* `engine/src/demo.ts`: interactive terminal demo [`npm run demo`].
* `engine/test/engine.test.ts`: 17 tests.
* `data/fixtures/test-lexicon.tsv`: 93 forms copied from the
  Académia's alphabet page, for tests only.
* `docs/skeleton-spec.md` and `docs/lexicon-format.md`.
* `README.md` in English with an Italian section; `CONTRIBUTING.md`.
* `LICENSE` [MIT, code] and `data/LICENSE.md` [CC BY-SA 4.0, data].
* `.gitignore`, every entry commented.
* `package.json`, `package-lock.json` and `tsconfig.json`: strict
  TypeScript run directly by Node.js 22.18 or newer, with no build
  step; scripts `test`, `typecheck`, `check` and `demo`.
* Placeholder READMEs for the planned folders `admin/`, `db/`,
  `editor/`, `export/` and `keyman/`.
* After the tag, in a separate commit: this `CHANGELOG.md`.

[Unreleased]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/releases/tag/v0.1.0
