# Change Log

Format follows [Keep a Changelog][keepachangelog]. Versions follow
[Semantic Versioning][semver]: while the major number is 0, the
project is in early development and anything may change, so every
release is published on GitHub as a pre-release. Every version has an
annotated git tag, `vX.Y.Z`, and a release on the
[Releases page][releases]; the version numbers in the headings below
link to every change between that version and the one before it.

Each entry says what changed, why, and how it was verified. Dates are
YYYY/MM/DD. The test counts are those of `npm run check` at the tag.

## [Unreleased]

### Planned
- 0.8: real frequencies, counted from a freely licensed body of text,
  so that the editor's menu and the keyboard's suggestion bar put the
  common spelling first instead of the alphabetical one.

## [0.7.0] [2026/10/17] [new runners; CSV with semicolons]

### Changed
- Both workflows run on `ubuntu-26.04`, named explicitly, instead of
  `ubuntu-latest`. GitHub moves `ubuntu-latest` from Ubuntu 24.04 to
  26.04 gradually between 2026/10/19 and 2026/11/19, and warns that
  builds may break; naming the image makes the move now, in a commit
  of its own, and keeps the next change of `ubuntu-latest` from
  altering a build unannounced. The image was checked first: it holds
  the GitHub CLI 2.102.0 that the release job uses to attach the
  packages, and `setup-node` installs Node.js itself. NOTE: if a first
  run fails, nothing is published and the site keeps its last good
  version; going back is one line per job, to `ubuntu-24.04`.
- GitHub's actions at their current major versions, every one on
  Node.js 24: `checkout` v4 → v7, `setup-node` v4 → v7,
  `upload-artifact` v4 → v7, `download-artifact` v4 → v8,
  `upload-pages-artifact` v3 → v5, `deploy-pages` v4 → v5. Since
  2026/09/23 GitHub runs every JavaScript action on Node.js 24
  whatever it declares, so the old versions kept working, but on a
  runtime they were not written for and with deprecation notices on
  every run. Each new version's `action.yml` was read to confirm
  `node24`, and its breaking changes were read: none touches these
  workflows. Both workflows pass `actionlint`, apart from the
  `ubuntu-26.04` label itself, which that linter's release does not
  know yet.
- The project is built on Node.js 24, the current long term support
  version, instead of 22. `pages.yml` gains a job, `minimum-node`,
  that runs every test again on Node.js 22, the oldest version
  `package.json` promises [22.18 or newer]; nothing is deployed unless
  both pass. Verified here first: 121 of 121 tests pass on Node.js
  24.22.0 and on 22.22.0.
- The checkout keeps no credentials in the Pages workflow either
  [`persist-credentials: false`, already so in the release workflow]:
  no job pushes to the repository.
- The CSV download is separated by semicolons instead of commas.
  Excel set to Italian or Spanish, the languages of the project's
  readers, uses the comma as its decimal mark and expects semicolons:
  with commas, a double click showed every row in one column. A field
  is now quoted when it holds a semicolon; a comma is ordinary text.
  Everything else is unchanged: double quotes doubled, CRLF line
  endings, the UTF-8 byte order mark. No `sep=;` first line, which is
  not standard and shows up as a row of data outside Excel. NOTE:
  Excel set to English now needs Data, From Text/CSV, the trade made
  on purpose. `admin/src/export.ts`, with `CSV_SEPARATOR`.
- `admin/test/export.test.ts`: the independent RFC 4180 reader takes
  the separator as a parameter; new cases for the semicolon, alone and
  inside a field; the comma case now proves that a comma is not
  quoted. 7 tests, 121 in all.
- Decision records 0025 [the semicolon; it supersedes the point
  "Comma, not semicolon" of 0023] and 0026 [runners and runtimes;
  records 0019 and 0021 point to it].
- `README.md`: automation, downloads, test counts, decisions; the
  roadmap moves real frequencies to 0.8, bulk import to 0.9, and
  backups and the beta to 0.10, in English and in the Italian
  summary. `admin/README.md`: the CSV format.
- Keyboard version 0.7.0, following the project's; the keyboard and
  the dictionary are unchanged.

### Fixed
- `admin/src/export.ts` and `admin/test/export.test.ts` held the byte
  order mark as the invisible character itself, against the project's
  rule of writing invisible characters as escapes, where a reader
  cannot see them and an editor may silently drop them. Both now write
  `\uFEFF`.

## [0.6.0] [2026/10/17] [the site in Spanish; the letter ñ]

### Added
- A Spanish interface for the whole site, beside Italian and English:
  - the lexicon manager: every text in `admin/src/messages.ts`, now
    with a third table; a menu in the header, each language named in
    itself [Italiano, English, Español], replaces the old two-way
    button, which could not grow past two languages;
  - the web editor: the same menu, with the same languages in the
    same order, and every text in `editor/src/messages.ts`. The
    choice is stored in one browser setting shared by both pages, so
    it follows the visitor between them; a test keeps the two menus
    identical, so neither page can offer a language the other lacks;
  - the Android install page under `/tastiera/`: a Spanish section
    after the English one, with the dictionary's size and date filled
    in like the others, and links to both sections at the top of the
    page.
- The latest additions on the search page: while the search field is
  empty, the 20 approved lemmas created most recently, newest first,
  each with its date and time, part of speech, variety and spelling
  system, and a link to the entry. Typing replaces them with the
  results; emptying the field brings them back. Approved lemmas only,
  for every viewer, staff included, so that the list means the same
  thing to everyone; pending work already has the review queue.
  Ordered by creation time, because the database records no approval
  time: a lemma proposed long ago and approved today is placed by the
  day it was proposed. Lemmas, not forms: an inflected form added to
  an existing lemma is not listed. `latestLemmas()` in
  `admin/src/db.ts`; no database change, since anonymous visitors
  could already read approved lemmas, `created_at` included, under the
  row security of migration 0003.
- "Scarica CSV" next to "Scarica TSV". `admin/src/export.ts` converts
  the same export the TSV comes from, `export_lexicon_tsv()`, so the
  two files always hold the same rows. RFC 4180: comma separated,
  fields quoted only when needed, double quotes doubled, every line
  ending with CRLF; a UTF-8 byte order mark at the start, without
  which Excel misreads `â ê ô æ ç`. The TSV's comment lines are
  dropped, since CSV has no comments. NOTE: Excel set to Italian or
  Spanish expects semicolons and, on a double click, shows each row in
  one column; opening the file through Data, From Text/CSV works, as
  do LibreOffice, Google Sheets and Numbers. The standard separator
  was preferred over one tuned to one program's regional setting.
- The letter `ñ`, which some Ligurian spelling systems other than the
  grafîa ofiçiâ write, accepted across the whole project: a button in
  the manager, after the letters of the grafîa ofiçiâ, with `Ñ` under
  Shift; the search key `n`, so that typing `n` finds it; a long press
  of `n` on the Android keyboard. A button alone would have been worse
  than nothing: the database, the manager's own check, the engine and
  the keyboard's tests all refused the letter, so every word typed
  with it would have failed on saving, and an approved one would have
  been dropped from the published dictionary. Changed together:
  - `db/migrations/0005_letter_enye.sql`: the `ligurian_form` domain
    accepts `ñ Ñ`; `private.skeleton()` folds them to `n`. NOTE: run
    it once in the Supabase SQL Editor before the first word with `ñ`
    is saved. Supabase warns of a "destructive operation" because the
    file drops the domain's letter check and adds the wider one back
    in the same run; no data is touched. It is safe on the live
    database: the new list includes the old one, and no stored word
    can contain `ñ` yet, so no stored search key changes.
  - `engine/src/skeleton.ts` and `engine/src/lexicon.ts`: `ñ` folds to
    `n` and is a valid letter of a published form.
  - `searchTermToKey` in the Keyman dictionary folds `ñ` to `n`, as
    the engine does.
  - `keyman/src/touch-layout.ts`: `ñ` on a long press of `n`, and the
    regenerated `.keyman-touch-layout` file. The keyboard's rule is to
    offer exactly the letters the skeleton folds, and a test enforces
    it, so the keyboard could not stay behind.
  - `admin/src/forms.ts`: `ñ Ñ` in `LIGURIAN_LETTERS`, `ñ` at the end
    of `SPECIAL_LETTERS`.
- Tests, 120 in all [103 at 0.5.1]:
  - `admin/test/export.test.ts`, 6 tests: quoting, line endings, the
    byte order mark, comment lines, and a round trip of all 93 fixture
    forms through an RFC 4180 reader written independently of the
    code it checks.
  - `admin/test/messages.test.ts`, 4 tests: no empty text, no dropped
    placeholder, and no Spanish text copied from Italian or English,
    except the eight that are the same by nature, such as *verbo*.
  - `db/test/search-keys.test.ts`, 4 new tests: the alphabet the
    database really accepts, pinned; the engine loads a word holding
    any of its letters; `ñ` and `Ñ` are stored, keyed `n` and found;
    the domain still refuses `ã`, a decomposed `ñ`, spaces and words
    of 65 letters.
  - `admin/test/forms.test.ts`, 1 new test: the palette ends with `ñ`
    and repeats no letter.
  - `editor/test/editor.test.ts`, 2 new tests: the editor's languages
    are exactly the manager's, and no Spanish text is empty or copied
    from Italian or English; the singular and plural test covers
    Spanish too.
- Decision records 0023 [Spanish, latest additions, CSV] and 0024
  [the letter ñ]. Records 0004, 0005, 0018, 0020 and 0022 point to
  them.

### Changed
- The letter lists in the tests are read from a real database built
  from every migration, through `domainLetters()` in
  `db/test/harness.ts`, instead of from the file that first defined
  them, `0001_lexicon_schema.sql`. Reading 0001 would have kept
  passing after 0005 while comparing against a list the database no
  longer uses. Proven by removing 0005 and running the tests: three
  of them fail.
- `admin/test/forms.test.ts` used `ñ` as its example of a refused
  letter; the example is now `ã`, and a new line proves that `ñ` is
  accepted.
- `keyman/test/build.test.ts`: `ñ`, `Ñ` and a decomposed `ñ` join the
  pieces of the 5,000 pseudo-random strings on which the keyboard's
  search keys are compared with the engine's.
- `admin/src/main.ts` and `editor/src/main.ts`: the stored language
  may be `it`, `en` or `es`, and anything else falls back to Italian;
  each of the manager's downloads names its own file type.
  `admin/src/style.css` and `editor/src/style.css`: the language
  menu; in the manager also the latest additions, which wrap cleanly
  on phones.
- Keyboard version 0.6.0, following the project's, and this time with
  a real change: `ñ` on `n`. Installed copies are replaced by the new
  package. The keyboard's `HISTORY.md`, `readme.htm`, `welcome.htm`
  and `README.md`, the install page under `/tastiera/` in both
  languages, and the dictionary's `HISTORY.md` say so.
- `docs/skeleton-spec.md`, version 0.2: the rule `ñ` → `n`; the SQL
  mirror now lives in migration 0005.
- `db/README.md`: migration 0005 and its warning in Supabase.
  `admin/README.md`, `editor/README.md`, root `README.md` in English
  and in its Italian summary, `CONTRIBUTING.md`, decisions 0020 and
  0022: languages, latest additions, downloads, the letter `ñ`, test
  counts. A word written
  with `ñ` is entered under its own spelling system, not `ofiçiâ`.
- `CHANGELOG.md` rewritten in this format: every entry now says why,
  not only what, and how it was verified.

### Fixed
- Lexicon manager on phones: the header links were squeezed into a
  narrow column beside the title, and the longer ones broke in two
  ["Nuovo / lemma", "Da / revisionare"; worse in Spanish]. Each link
  now stays on one line, and below 640 pixels the links take a row of
  their own under the title. `admin/src/style.css`; checked in a
  browser at 390 pixels in Italian and Spanish.

## [0.5.1] [2026/10/17] [copyright holder's name]

### Changed
- The copyright holder and maintainer is named
  "Eng. José Ignacio Castro de R." everywhere, as in `LICENSE`. Until
  then the Keyman packages, the decision records and several headers
  used other forms of the name, and a published keyboard package
  carries its copyright line onto every phone that installs it.
  Changed in:
  - the Keyman keyboard: `&COPYRIGHT` in the `.kmn`, the `.kps`, its
    `readme.htm` and its `LICENSE.md`. Keyboard version 0.5.1, so
    that Keyman treats the package as newer and replaces installed
    copies;
  - the Keyman dictionary: its `.model.kps` and its `LICENSE.md`;
  - the "Decided by" line of decision records 0001 to 0022;
  - the "Author" header of the engine and database test sources.

### Fixed
- `LICENSE` ends with a newline again; without it, git marks the last
  line of the license as changed whenever text is added after it.
- `CHANGELOG.md`, 0.5.0: the `.gitignore` entry described a pattern
  the repository does not use. The entry now describes the file as it
  is.

## [0.5.0] [2026/10/17] [the Android keyboard]

### Added
- `keyman/ligurian_keyboard/`: the Keyman keyboard "Ligure [grafîa
  ofiçiâ]", for phones and tablets.
  - Italian QWERTY layout, the one most users already know. Long press
    on `a e i o u` gives the vowels with grave, acute, circumflex and
    diaeresis, in that order, as in the Académia's *Arfabêto*; on `a`
    also `æ`; on `c`, `ç`. These are exactly the non-ASCII letters the
    skeleton folds, and a test keeps the two sets identical in both
    directions and in both cases. A dot marks the keys with a long
    press.
  - An apostrophe key on the main layer, because Ligurian elides
    constantly [`l'`, `d'`, `ch'`]; typographic quotes on its long
    press. A numbers and symbols layer.
  - A capital comes by itself at the start of the text and after
    `. ! ? …` plus a space; a double tap on Shift locks capitals. The
    layer logic is SIL EuroLatin's. The double tap needs Keyman 17, so
    the keyboard declares 17.0; `kmc` refuses it under any older
    version.
  - Every key that types a character has a `U_XXXX` id, so it types
    exactly that character on any layer, with no rules in the `.kmn`.
- `keyman/ignatzcastror.lij.ligurian_keyboard/`: the Keyman lexical
  model, the dictionary behind the suggestion bar.
  - The approved zeneize forms in ofiçiâ of the daily dictionary
    snapshot, the same file the web editor reads, so the keyboard and
    the editor always offer the same words.
  - `searchTermToKey`: a copy of the engine's `skeleton()`. Keyman's
    own default key function turns `ç` into `c` but leaves `æ`
    untouched, because `æ` does not decompose, so it could not be
    used. Keyman compiles the function into the model as text and runs
    it on old phones, so the copy is self-contained and written in
    ES3: no imports, no `Map`, no `for..of`, no regular expressions
    with the `u` flag. `zena` finds `Zêna`, `citae` finds `çitæ`,
    `canpanna` finds `canpànn-a`.
  - Suggestions follow the casing typed: `Penna` at the start of a
    sentence suggests `Pénna`, and `Zêna` keeps its capital.
    Hyphenated spellings stay one word, as in the engine.
  - Version = the snapshot's UTC date, `YYYY.M.D`, so a newer
    dictionary always has a higher version and anyone can read its
    date. The committed `.model.kps` keeps the placeholder `0.0.0`.
  - Its `LICENSE.md` covers both the CC BY-SA 4.0 word list and the
    MIT code inside the package.
- `keyman/src/`: the layout as a short, reviewable description
  [`touch-layout.ts`] instead of 2,600 lines of hand-edited JSON; the
  snapshot turned into Keyman's word list [`wordlist.ts`]; staging and
  compilation with `kmc` [`build.ts`]. The build copies both projects
  into a staging folder and never modifies the committed sources; the
  staging folder is a parameter, so that tests running in parallel
  never share one.
- `keyman/test/`, 30 tests, 103 in all. A real build with `kmc`, whose
  compiled dictionary is loaded and inspected: its search keys equal
  `skeleton()` on every character up to U+02FF, on every fixture word
  in four forms and on 5,000 pseudo-random strings, whose coverage of
  every piece and every length is itself tested. Also: exactly the
  Ligurian letters on the layout, in both cases; rows of equal width
  by Keyman's own arithmetic, 1,150 units each; the layer rules; the
  contents of both packages; the refusal of a bad snapshot and of a
  failing compiler, keeping the earlier packages; error reporting
  always off.
- `tools/build-keyman.ts` [`npm run keyman:build`] and
  `tools/write-touch-layout.ts` [`npm run keyman:layout`, the only way
  the layout file changes; a test fails when the committed file
  differs from what it writes].
- `editor/public/tastiera/`: the install page, in Italian and English,
  with both packages and the dictionary's date and size, linked from
  the editor's header as "Tastiera Android".
- `.github/workflows/release-assets.yml`: attaches both packages to
  every published release.
- `@keymanapp/kmc` 18.0.254 as a development dependency, pinned
  exactly, so that a new Keyman release cannot change the packages
  unannounced. npm scripts `test:keyman`, `keyman:build`,
  `keyman:layout`.
- Decision records 0021 [scope, toolchain, distribution: Android
  first, because Keyman offers suggestions only on Android, iOS and
  the web] and 0022 [design of the keyboard and dictionary]. Record
  0021 was committed on its own, before the code, and is part of this
  version; records 0001 and 0007 point to it.

### Changed
- `npm run site:build` builds the Keyman packages first;
  `tools/assemble-site.ts` puts them under `_site/tastiera/` and
  refuses to assemble without them. The daily site build therefore
  refreshes the dictionary package too.
- `docs/skeleton-spec.md`: new section "The Keyman mirror"; from now
  on a change of rule touches four places. The header of
  `engine/src/skeleton.ts` points to both mirrors.
- `editor/public/sw.js`: the offline copy leaves `/tastiera/` alone,
  as it does `/admin/`, since installing the keyboard needs a
  connection anyway.
- Web editor, Italian texts: "senza accenti" instead of "in lettere
  normali", as on the install page.
- `README.md` rewritten: links to use and download everything, at the
  top; what a visitor can download and which version to choose; how
  the input method works in the editor and in the Android keyboard;
  how a word travels from the dictionary to the screen; privacy;
  automation; the criteria for 1.0.0; a complete summary in Italian.
- `docs/lexicon-format.md`: describes the daily snapshot as it now
  works. Decision records 0008 and 0021: wording made impersonal; no
  decision changed.
- `.gitignore`: a shorter comment on the local commit script,
  `COMMIT-PUSH-SCRIPT.bat`; the local folders section renamed.
- `LICENSE`: the copyright holder is Eng. José Ignacio Castro de R.

### Fixed
- Found while building, before the tag: the layout test compared the
  committed file byte for byte, and failed on a Windows checkout,
  where git turns line endings into CRLF. The test now normalizes line
  endings before comparing; checked on a simulated CRLF clone.

### Security
- `release-assets.yml` is split in two jobs. The build, which runs
  `npm install` and the compiler, gets a read-only token; a separate
  job with write access does nothing but upload the two files. A
  compromised dependency therefore never holds a token that can
  change the repository or its releases.
- `kmc` always runs with `--no-error-reporting`, so no build sends
  anything to Keyman's error reporting service; a test checks it.

### Known issues
- `æ` typed with the long press probably gets weaker suggestions than
  `ae` typed in plain letters. While searching for corrections,
  Keyman 18 compares one typed character with one character of the
  index; `æ` stands for two, `ae`, so it never matches and every such
  word costs edits. `ç` and the hyphen are not affected. No fix exists
  inside Keyman's word list models without breaking the identity with
  `skeleton()`; typing `ae` always works. The phone checklist in
  `keyman/README.md` measures how bad it is.
- Elided forms are one word: `l'ægua` gets a suggestion only if the
  dictionary holds `l'ægua` itself, as in the engine. Whether to split
  at the apostrophe is an open question for native contributors.
- Not yet tested on real phones.

## [0.4.1] [2026/10/17] [singular in the editor's status]

### Fixed
- Web editor: the dictionary status said "1 forme" / "1 forms" for a
  dictionary of one form, which is exactly what the live site showed
  on its first day. `editor/src/messages.ts` now agrees in number in
  both languages: forma/forme, form/forms. One new test, 73 in all.

## [0.4.0] [2026/10/17] [the web editor]

### Added
- `editor/`: the web editor, now the front page of the site, because
  the public face of the project should be the place where people
  write. TypeScript and Vite, no framework.
  - A word is finished when a space or a new line follows it, read
    from the `input` event and not from key presses: phone keyboards
    report almost every key as code 229, so key events cannot tell a
    space from a letter. Nothing happens while a phone keyboard is
    composing, and pasted or dropped text is never converted.
  - One candidate replaces the word; several open a menu: `1` to `9`
    choose, the arrows move, Enter or Tab confirm, Escape keeps the
    word as typed. The menu's last entry, "keep as typed", exists for
    phones, which have no Escape key. It opens under the word with a
    mouse, and as a bar above the on-screen keyboard on touch screens.
  - Typing on with the menu open accepts the highlighted spelling, as
    Japanese input methods do; leaving plain ASCII in the text
    silently would work against the purpose of the project.
  - Backspace right after a conversion undoes it; Ctrl+Z also works,
    because edits go through the browser's own `insertText` where it
    allows it.
  - Spell checking and autocorrect are switched off, so Italian
    dictionaries cannot "correct" plain Ligurian into Italian words
    before it is converted. Some phone keyboards ignore this.
  - Filters by variety and spelling system, `zeneize` and `ofiçiâ` by
    default; copy, download as `.txt`, clear; the draft is kept in the
    browser and never sent anywhere.
  - Offline use after the first visit, through a service worker.
  - Interface in Italian and English, sharing the language choice
    with the lexicon manager.
  - `src/ime.ts`: every decision as a pure function, so it can be
    tested without a browser; 14 tests in `test/editor.test.ts`.
- `tools/fetch-lexicon.ts`: the daily dictionary snapshot, taken from
  `export_lexicon_tsv()` with the publishable key, checked with the
  engine's own loader and stamped with the time in UTC. A failed call,
  an invalid row or an empty dictionary stops the build, and the site
  keeps its last good version. The editor itself never talks to the
  database and holds no key.
- `tools/use-fixture-lexicon.ts`: the test fixture as a local
  dictionary, so the editor runs with no database.
- `tools/assemble-site.ts`: joins the editor and the manager into
  `_site/`.
- `Lexicon.entries()` in the engine: every indexed entry.
- npm scripts `test:editor`, `editor:dev`, `editor:build`,
  `lexicon:snapshot`, `lexicon:fixture`, `site:build`, `site:preview`.
- Decision records 0019 [daily dictionary snapshot] and 0020 [design
  of the web editor]. 72 tests in all.

### Changed
- The lexicon manager moves from the root of the site to `/admin/`.
  NOTE: from this version on, the Site URL in Supabase's
  Authentication settings, and its Redirect URLs, must be the
  manager's new address, ending in `/admin/`.
- `.github/workflows/admin-pages.yml` replaced by `pages.yml`: it also
  takes the snapshot, builds the editor, publishes the editor at the
  root and the manager under `/admin/`, and runs every day at 03:17
  UTC as well as on every push, so that newly approved words reach the
  site within a day without a commit.
- The lexicon manager links to the editor in its header.
- Root `README.md`, `admin/README.md` and `editor/README.md` updated.
- `.gitignore`: `_site/` and `editor/public/lexicon.tsv`, both
  generated, never committed.

## [0.3.0] [2026/10/11] [the lexicon manager]

The database is deployed on Supabase from this version, in the
Central EU region [Frankfurt], the closest to Genoa.

### Added
- `admin/`: the lexicon manager, plain TypeScript with no framework,
  so that anyone who knows TypeScript can read every line, built by
  Vite into static files and talking directly to Supabase. Every rule
  is enforced by the database, so the page holds no secret and needs
  no server of its own.
  - Search by ASCII key, on headwords and on inflected forms, open to
    signed out visitors for the published entries.
  - Entry page: lemma, forms, numbered senses and translations, with
    edit, approve, reject, delete and restore buttons according to the
    role; history for reviewers and admins.
  - New lemma page, with buttons for the special letters and a list
    of the existing lemmas that share the same ASCII key, to avoid
    duplicates.
  - Review queue, oldest first. Own profile; for staff, the list of
    people and role changes. TSV export of the published lexicon.
  - Interface in Italian, the default, and English; the compiler
    refuses a text missing from either.
  - Optimistic locking on every update: a version conflict reloads
    the entry and explains, instead of silently overwriting another
    person's edit.
  - No sign up page: accounts are created by an admin, which avoids
    spam accounts and Supabase's tiny free email quota.
  - `admin/test/`, 14 tests: every button rule is checked against
    real update attempts on an embedded PostgreSQL, so the page never
    offers what the database would refuse.
- `db/migrations/0004_search_keys.sql`: `private.skeleton()`, a SQL
  copy of the engine's folding, and generated, indexed columns
  `lemmas.headword_key` and `wordforms.form_key`, so that `zena`
  finds `Zêna` without the browser downloading the whole lexicon.
  The database computes the keys itself; no client can send them.
- `db/test/search-keys.test.ts`, 6 tests: the SQL folding equals the
  engine's on every fixture form and on every letter in both cases.
  Upper case letters are folded explicitly, because `lower()` does
  not fold accented letters under a C locale. 58 tests in all.
- `.github/workflows/admin-pages.yml`: runs every test, builds the
  manager and publishes it on GitHub Pages.
- `.env.example`: the template of the manager's two settings.
- Decision records 0017 [ASCII search keys in the database] and 0018
  [design of the lexicon manager].

### Changed
- `package.json`: version 0.3.0; dependency `@supabase/supabase-js`;
  dev dependency `vite`; scripts `test:admin`, `admin:dev`,
  `admin:build`, `admin:preview`; `test` runs the admin tests too.
  `package-lock.json` updated; `tsconfig.json` type checks `admin/`.
- `db/migrations/0001` to `0003`: header comments in the house format,
  author and date with time and place; no statement changed.
- `.gitignore`: keeps `.env.example` while ignoring every other `.env`
  file.
- `db/README.md`: migration 0004, search keys, deployment notes.
  `docs/skeleton-spec.md`: the SQL mirror of the folding rules.
  `docs/decisions/README.md`: records 0017 and 0018; realtime updates
  listed as an open question.
- `README.md` rewritten as a full description of the project: its
  purpose, how typing works, spelling systems and varieties, the parts
  of the project, the shared dictionary, the lexicon manager, data
  sources, setup, layout, tests, decisions, open questions, roadmap,
  and a short summary of every version.

### Security
- Text is inserted with `textContent`, never `innerHTML`, so nothing
  a contributor types can inject markup or script into another
  person's page.
- Only the publishable key reaches the browser; it is public by
  design, and row level security decides what each person may do.
  The secret key never leaves the Supabase dashboard.

## [0.2.0] [2026/10/11] [the dictionary database]

Written and tested, not yet deployed.

### Added
- `db/migrations/0001_lexicon_schema.sql`:
  - tables `lemmas`, `wordforms`, `senses`, `glosses`, `profiles`,
    `audit_log`;
  - reference tables `varieties` [zeneize, savoneize, spezzin,
    tabarchin, monegasco], `orthographies` [ofiçiâ, unitäia] and
    `gloss_languages` [it, es, en], so that adding one is a single
    new row, with no schema change;
  - the domain `ligurian_form`: NFC, Ligurian letters plus `'` and
    `-`, at most 64 characters;
  - senses: numbered meanings per lemma, with an optional definition
    in Italian, `definition_it`; definitions in Ligurian are deferred
    until typing Ligurian is easy;
  - glosses: optional Italian, Spanish and English translations,
    attached to one sense, so that each translation matches one
    precise meaning; several per language allowed;
  - the wordform column `is_base`, at most one live base form per
    lemma; unique live spellings per lemma; homographs allowed across
    lemmas, since a noun and a verb may be spelled alike.
- `db/migrations/0002_rules_and_history.sql`:
  - roles member, contributor, reviewer and admin, checked on every
    insert and update;
  - contributors' rows forced to `pending` and stamped with their
    author;
  - automatic base form: creating a lemma creates its headword as a
    wordform, which follows the lemma's spelling and status and
    cannot be edited directly;
  - automatic sense numbering 1, 2, 3 ... per lemma;
  - no children for deleted lemmas or senses; entries never move
    between parents;
  - `version` bumped on every update, for optimistic locking;
  - hard deletes refused for everyone; soft delete and restore by
    admins only, so nothing is ever lost;
  - an append-only `audit_log`, written on every change;
  - a `member` profile for every new account; only admins change
    roles; the last admin cannot be demoted, so the project can never
    lock itself out.
- `db/migrations/0003_access_and_export.sql`:
  - views `published_wordforms`, `published_dictionary` and
    `review_queue`;
  - `export_lexicon_tsv()`: the published wordforms in the engine's
    format, sorted, so that two exports of the same data are
    identical and their differences readable.
- `db/test/`: a Supabase stand-in, a test harness and 21 tests on an
  embedded PostgreSQL [PGlite], each rule tested from the side of the
  person who must not be able to break it; one test loads the export
  into the engine. 38 tests in all.
- `db/README.md`: data model, roles, client rules, deployment steps,
  each rule linked to its decision record.
- `docs/decisions/`: an index and 16 decision records, 0001 to 0016,
  covering every design decision since the start: input method, one
  database, open data and licenses, orthography and variety, computed
  ASCII keys, hand-entered wordforms, technology stack, repository
  name, data sources, versioning, roles and review, no hard deletes,
  senses and translations, automatic base form, definitions in
  Italian, and the order of work.
- `README.md`: sections "Design decisions" and "What changed in
  0.2.0".

### Changed
- `package.json`: version 0.2.0; dev dependency
  `@electric-sql/pglite`; scripts `test:engine`, `test:db`, and `test`
  running both. `package-lock.json` updated for PGlite.
  `tsconfig.json` type checks `db/` as well as `engine/`.
- `docs/lexicon-format.md`: meanings and translations described as
  senses with optional Italian, Spanish and English glosses.
- `README.md`: status table. `CONTRIBUTING.md`: rules for senses,
  Italian definitions and translations.

### Security
- `0003` revokes every default Supabase privilege, then grants only
  the ones needed, and turns on row level security on every table.

## [0.1.0] [2026/10/10] [the conversion engine]

### Added
- `engine/src/skeleton.ts`: folds a spelling to its ASCII key, by the
  rules of the Académia Ligùstica do Brénno's *Arfabêto*: accented
  vowels lose the mark, `æ` becomes `ae`, as the Académia itself
  allows when `æ` is unavailable, `ç` becomes `c`, hyphens are
  dropped so that `canpànn-a` is reached by typing `canpanna`, and
  typographic apostrophes become `'`.
- `engine/src/lexicon.ts`: loads the word list [TSV with `form`,
  `freq`, `variety`, `orthography`, `status`], indexes the approved
  rows by skeleton, and reports every invalid row with its line
  number, never dropping one silently.
- `engine/src/convert.ts`: decides for each typed token whether to
  replace it, offer a menu or keep it, as Japanese input methods do;
  keeps punctuation and the casing typed; offers first a candidate
  typed exactly.
- `engine/src/demo.ts`: an interactive terminal demo
  [`npm run demo`].
- `engine/test/engine.test.ts`: 17 tests.
- `data/fixtures/test-lexicon.tsv`: 93 forms copied from the
  Académia's alphabet page, for tests only.
- `docs/skeleton-spec.md` and `docs/lexicon-format.md`.
- `README.md` in English with an Italian section; `CONTRIBUTING.md`.
- `LICENSE` [MIT, code] and `data/LICENSE.md` [CC BY-SA 4.0, data].
- `.gitignore`, every entry commented.
- `package.json`, `package-lock.json` and `tsconfig.json`: strict
  TypeScript run directly by Node.js 22.18 or newer, with no build
  step; scripts `test`, `typecheck`, `check` and `demo`.
- Placeholder READMEs for the planned folders `admin/`, `db/`,
  `editor/`, `export/` and `keyman/`.
- After the tag, in a separate commit: this `CHANGELOG.md`.

[keepachangelog]: https://keepachangelog.com/en/1.1.0/
[semver]: https://semver.org/
[releases]: https://github.com/Ignatz-CastroR/ligurian-keyboard/releases
[Unreleased]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/releases/tag/v0.1.0
