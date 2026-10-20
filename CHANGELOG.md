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
- 0.14.0: repairs of the entries loaded by SQL before 0.12.1: a repair
  page per entry, merging senses split one per translation by default
  and allowing other groupings; the language of a translation
  corrected by hand; translations that hold ";" split; possibly the
  authors of those entries credited afterwards. `import_entries()`, a
  structured import with a dry run and authors, in the format of
  `db/templates/add-entries.sql`, and an enrichment format, keyed by
  public code and sense, for translations and definitions prepared
  outside the site.
- 0.15.0: grammar for every form, base lemma included, in structured
  fields [gender, number, person, tense and mood]; richer entries:
  etymology, examples, definitions in four languages, usage labels,
  images uploaded to Supabase; pronunciation in IPA by form and
  variety.
- 0.16.0: recordings by native speakers, with their consent and a free
  license.
- Then: hardening, contributor documentation; a beta with native
  speakers in Genoa.
- 1.0.0: when every criterion in the README's roadmap is met.

## [0.13.0] [2026/10/20] [the site in five sections]

### Added
- The same bar of five large buttons at the top of every page, the
  current one filled: Write, Dictionary, Lexicon manager, Keyboard and
  Users, with the size of the published dictionary beneath them
  [decision 0035]. Until now each page linked a different set of the
  others in small text, the install page did not link the manager at
  all, and no page said how big the dictionary is. The names, order
  and addresses live in one file, `site/sections.ts`, used by every
  application; the static install page repeats them by hand and a
  test keeps it identical. The size comes from `dictionary_stats()`
  [migration 0011] and is shown only when it arrives, so a page
  offline or without its build settings still shows the sections.
  Verified by 4 tests of `site/` [order and names in three languages;
  every section reaching every other by a relative address, as the
  site build publishes them; numbers written as each language writes
  them], 6 tests of the install page, a database test counting
  published rows only for everyone, and every section photographed
  in a headless browser against a stand in database, on a computer,
  and the dictionary and the install page on a phone too.
- The Users section, `/utenti/`, a section of its own [decision 0035].
  One's profile and one's complete history; for reviewers and admins,
  every person with their role, number of changes and time of the
  last one, and anyone's complete history, the SQL Editor's changes
  included. A history lists every change, newest first, a hundred at
  a time until the first: date and time to the second, what it was
  [an approval reads as "approved", not "edited: status"], the entry,
  linked, the status it left and the fields an edit changed, after a
  summary by kind. Until now the history could be seen only entry by
  entry. Three functions of migration 0011 serve it,
  `people_activity()`, `user_history()` and `user_summary()`, with one
  index on the history by person; they decide themselves who sees
  what. Built from the manager's modules, so the two share one
  sign-in. Verified by 3 database tests [history complete and in
  pages without gap or repeat; staff reading anyone's, everyone else
  only their own, visitors nothing] and 4 tests of `users/`
  [addresses; each change read as what it was, on rows the real
  database writes; three languages].
- The dictionary finds Ligurian words, typed with or without accents,
  by headword or by any form: `zena` finds `Zêna`, `penne` finds
  `pénna` and says which form matched [decision 0035, superseding in
  part 0034]. One search field shows two groups, Ligurian entries and
  translations, everywhere, in Ligurian only, or in one language of
  translation. Readers type `zena` and expect `Zêna`; until now only
  the editor and the manager could do that. Served by
  `dictionary_lookup()` [migration 0011] through the search key
  indexes of migration 0004; exact matches come first, so a whole word
  typed is never pushed out by longer words that begin with it.
  Verified by 3 database tests [accents, capitals and spaces; an exact
  form before sixty headwords that begin with it; pending, rejected and
  deleted rows never found, not even by a reviewer; query plans using
  `lemmas_headword_key` and `wordforms_form_key` on 3,000 lemmas] and
  a dictionary test on the real database.
- A link from every published entry in the manager to the same entry
  in the dictionary; for any other, the reason it is not there
  [pending, rejected, deleted]. The dictionary linked to the manager,
  but not the other way round. Verified by 2 tests, one comparing the
  link with what the real database publishes for each status.
- Translations several at a time: `penna; stilografica` typed in one
  field becomes two rows, shown before saving, each once. On the live
  data, 7 translations hold ";". Verified by a test of the splitter
  [spaces, empty pieces, repeats, composed and decomposed accents,
  commas and slashes kept, length].
- Decision 0036, built for more than one language: one codebase with
  the language as data, so that twin projects for other endangered
  languages of Italy may follow after 1.0.0; nothing new hard-codes a
  fact about Ligurian, and the facts already in the code move to a
  single place as their code is next changed.

### Changed
- The manager has its own tabs under the site's bar: Search, New
  lemma, To review and, for admins, Backups, the current one marked.
  Its users page is gone: profiles and people moved to the Users
  section, and the backup and restore cards, unchanged, to the
  Backups tab [`admin/src/views/backups.ts`]. The old address
  `#/users` opens `../utenti/`. The profile link next to one's name
  leads there too.
- The language of a new translation starts unchosen and must be
  chosen; until now it started at Italian, and the live data holds
  37,733 Italian translations against 24 Spanish and 16 English. An
  edited translation may not hold ";".
- Above an entry of the dictionary, its letter in the index, "Letter
  Z › Zêna", replaces a second "← Index" link; the letter is computed
  as the database computes it, which a test checks for every letter
  the spelling allows.
- The footer of the dictionary and the header of the manager no longer
  carry links to the other sections; the bar does.
- After signing in, the form returns to the first page of the section
  it is in.
- The editor's offline cache leaves `/utenti/` alone. The site build
  has a fifth application, `users/`, assembled into `_site/utenti/`,
  and copies the bar's stylesheet to `_site/site-bar.css` for the
  install page; new commands `users:dev`, `users:build`, `test:users`
  and `test:site`.
- Two older tests follow the new functions: the dictionary's public
  functions now number six, all running as their owner.
- `README.md`, `db/README.md`, `admin/README.md`,
  `dictionary/README.md`, `editor/README.md`, a new `users/README.md`,
  decisions 0018, 0031 and 0034, and both decision tables: the five
  sections, migration 0011, the roadmap in its agreed order, test
  counts.
- Keyboard version 0.13.0, following the project's; the keys are
  unchanged.

### Known issues
- Migration 0011 must run before this version is pushed: the bar, the
  dictionary's Ligurian search and the Users section call its
  functions.
- The data already loaded is not repaired: senses split one per
  translation, translations holding ";" and translations whose
  language is wrong wait for 0.14.0.
- The install page shows the size of the keyboard's dictionary
  package, not the live size of the dictionary.
- When a run of several translations meets a refusal partway, the
  translations before it are saved; the reloaded entry shows which.

An independent review found no blocker and no hole in migration 0011
[grants, the rule of who reads whose history, published rows only,
dynamic SQL]. It found ten smaller problems, all fixed before release:
an entry matching by a whole form could be pushed out of the 50
Ligurian results by longer headwords; a run of translations refused
partway did not show those already saved; the editor did not read the
root `.env`, so its bar had no size in a local build; decision 0036
claimed no new copy of a fact about Ligurian where there were two;
the bar took three rows on a phone; a search limited to one kind said
that neither kind had been found; following a tab moved the keyboard's
focus away; table cells on a phone had no column names, and the
people table's fields no accessible names; the browser's own message
replaced the manager's when no language was chosen; and a test name
promised more initials than it checked.

Tests: 275, passing on Node.js 22 [engine 24, db 93, admin 65,
editor 24, dictionary 9, users 4, site 4, keyman 32, corpus 15,
docs 5].

## [0.12.1] [2026/10/19] [the review queue in pages]

### Fixed
- The review queue no longer opened after a load of thousands of
  entries by SQL: it showed the database's time limit, and in words
  meant for backups. Two causes, reproduced with 12,000 approved and
  3,000 pending lemmas: the view `review_queue` runs under row level
  security, which makes the database check every row of every table,
  approved ones included, before it reaches the pending ones; and the
  page asked for the whole queue at once, then drew every row.
  - Migration 0010: `review_queue_page()` returns the next 50 entries,
    oldest first, one row per entry with its pending rows as JSON, so
    that no cap on API rows can cut an entry in two, and with the
    entry's position and the totals, counted in the same snapshot. It
    reads four new partial indexes, which hold the pending rows alone.
    Reviewers and admins get every pending row; anyone else only their
    own, with a lemma or sense above them only when they could read it
    themselves. The view stays, unchanged, for any client still
    using it.
  - The manager shows the queue in pages of 50 entries, with the
    entries and rows waiting and Previous and Next; "Select all"
    covers the page. Position and totals come from the database, so
    they stay right while several reviewers work at once; every button
    waits while a page is turned, and a late answer to an older
    request is dropped.
  Measured in the test engine, a page costs about 40 ms with 9,000
  pending rows, 0.3 s with 90,000 and 1.2 s with 300,000, against
  0.8, 8 and 29 seconds for the view: its cost grows with the pending
  rows, not with the dictionary. Verified by 7 database tests [every
  caller getting the rows the view shows them and no parent they could
  not read; entries oldest first, whole, one API row each; an entry of
  61 rows still one row; position and totals right after others
  reviewed meanwhile; visitors refused; a page more than four times
  faster than the view at the live dictionary's size] and the page run
  by hand in a headless browser with 120 stand in entries.
  An independent review found no blocker. It found that the first
  version computed the position in the browser, so that with two
  reviewers the last entries could become unreachable, and returned
  one API row per pending row, which Supabase's cap of 1,000 rows
  could cut in the middle of an entry; both fixed before release.
- A database timeout was always reported with the backup's
  instructions. It now says the database took too long and to try
  again; a restore past the limit points to the procedure for large
  backups.

### Added
- `db/templates/add-entries.sql`, for the SQL Editor: adds whole
  entries in the right shape, each sense with all its translations,
  each translation its own row in its own language, credited to the
  person named in its first step, which is required. One transaction:
  a refused entry writes nothing, and the error names the headword
  and the form or translation at fault. Refused: unknown keys, such as
  a misspelt "definition"; a key written twice in one object; a
  translation holding ";". Its examples are comments, and its helpers
  are removed at the end of the run. Loads made before it created one
  sense per translation and wrote every translation as Italian.
- `db/templates/check-loaded-entries.sql`, read only: measures what
  those loads left behind, to size the repairs of 0.13.0; it counts
  live rows under live parents only, as the queue does.
  Verified by 6 database tests that run both files exactly as
  committed, fourteen wrong entries among them.

### Changed
- `db/README.md`, `admin/README.md`, `README.md` and decision 0033:
  the queue in pages, migration 0010, the templates, test counts.
- Keyboard version 0.12.1, following the project's; the keys are
  unchanged.

### Known issues
- Migration 0010 must run before this version is pushed: the review
  page calls its function.
- Paging is by key: while others review, an entry approved in part
  may appear again further on, and one whose oldest pending row moves
  earlier is reached again from the first page.
- Entries loaded by SQL before the template keep their split senses
  and their Italian labels until the repair tools of 0.13.0.
- The view `review_queue` remains readable by every signed-in user and
  slow on a large dictionary; nothing in the manager uses it now.

Tests: 255, passing on Node.js 22 and 24 [engine 24, db 86, admin 62,
editor 24, dictionary 7, keyman 32, corpus 15, docs 5].

## [0.12.0] [2026/10/18] [the dictionary for readers]

### Added
- The dictionary for readers, a public section of the site at
  `/dizionario/`, read only and open to everyone without an account,
  in Italian, English and Spanish [decision 0034, superseding in part
  0032]. The friends in Genoa had grown the dictionary to 11,792
  approved forms in one day, and a dictionary that size needs a way
  to be read, not only a way to be typed with.
  - **The index,** as on Wiktionary: every initial with entries, then
    the entries of the chosen letter, a hundred at a time, each with
    its translations on one line. Accented vowels are listed under
    their base letter; `æ` and `ç` have letters of their own, `æ` after
    `a` and `ç` after `c`; an initial that is not a letter is listed
    under "altro".
  - **The search by translation,** in Italian, Spanish, English or
    all three, ignoring accents, diacritics and capitals: exact
    matches first, then translations beginning with the words, then
    translations with a word beginning with them; results grouped by
    entry. A public code typed into the field opens its entry.
  - **A page for every entry** at `#/voce/<code>`, the code of its
    lemma or of any of its forms: senses with their Italian
    definitions and translations by language, then the forms.
  - Migration 0009: `dictionary_letters()`, `dictionary_index()`,
    `dictionary_search()` and `dictionary_entry()`. They run with
    their owner's rights, so that row level security cannot keep
    their queries from the indexes, and each writes out the filters
    of publication in full. Three indexes: the initials of published
    headwords; the folded translations in byte order; and their
    trigrams, through the `pg_trgm` extension, installed if missing.
    The search runs in two steps that each stop at its limit of 200;
    the query is cut at 100 characters. No column is added, so
    backups, restores and the export are unchanged. The page's
    database client never uses a stored session.
  - A new Vite app, `dictionary/`, built into `_site/dizionario/`.
  Verified by 10 database tests [published rows only for a visitor,
  a reviewer and a contributor alike, with pending, deleted and
  unpublished parents in the data; the initials of unusual headwords;
  paging; folding of accents, capitals and punctuation; a query never
  treated as a pattern; word starts after punctuation; a 20,000
  character query cut; an entry by the code of a form; the functions
  running as their owner and their query plans using the indexes], 7
  tests of the page's logic and texts, the last on rows from the real
  database, and the page run by hand in a headless browser against a
  stand in for the database, on a computer and at phone width.
  An independent review measured the first version on a real
  PostgreSQL with 12,000 lemmas and 48,000 translations: under row
  level security no index was used, and an ordinary search took 1.6
  to 4 seconds, beyond the 3 seconds Supabase allows a visitor. Fixed
  before release; on the test engine, which is slower than a server,
  a search now takes 4 to 50 milliseconds, a common word included.
  The review's other findings are fixed too: the folding no longer
  depends on the database's locale, a word now starts after any
  punctuation, a long query is cut, and the page never acts on a
  search the reader has already left.

### Fixed
- A backup assembled while someone edited could fail to restore, or
  restore a lemma without its base form: many small reads are not one
  snapshot, and two lemmas renamed into each other's spelling between
  two pages appeared twice under one spelling. Since 0.11.2. The
  manager now reads the history's highest id again at the end; every
  change writes a line of history, so an unchanged history proves the
  file exact. Otherwise the backup starts again, up to three times,
  then refuses rather than offer a file that might not restore. A
  failed read is tried again, up to three times. Verified by 3
  manager tests, replacing one, among them the renaming swap the
  review used to break a restore.

### Changed
- The editor's "Dictionary" link and the install page's dictionary
  link lead to `/dizionario/`; the editor links the lexicon manager
  separately, and the manager links the dictionary. The editor's
  offline copy leaves `/dizionario/` alone, as it does `/admin/`.
- `.gitignore`: the dictionary's build folder, `/dictionary/dist/`.
- `README.md`, `db/README.md`, `dictionary/README.md`: the dictionary
  for readers, migration 0009, test counts [242 in all], and the
  roadmap, which marks 0.12 done. Decision 0032 is superseded in part
  by 0034, on when the dictionary for readers begins and how its
  pages are served.
- Keyboard version 0.12.0, following the project's; the keys are
  unchanged.

### Known issues
- Migration 0009 must run before this version is pushed: the
  dictionary page calls its functions.
- Every reader's page queries the free Supabase project live. The
  static pages decision 0032 planned remain the way to make readers
  cost the database nothing, when readership calls for it.
- The search does not stem words: `plumas` does not find `pluma`.

Tests: 242, passing on Node.js 22 and 24 [engine 24, db 73, admin 62,
editor 24, dictionary 7, keyman 32, corpus 15, docs 5].

## [0.11.2] [2026/10/18] [backups from small reads]

### Fixed
- The backup button still failed after 0.11.1 on the live dictionary,
  now 11,792 approved forms with their history. Raising the time limit
  of one statement was not enough: the lexicon manager no longer asks
  for the backup in one statement. It assembles the same file from
  small reads, a thousand rows at most each, and shows how many rows
  it has read [`assembleBackup()` in `admin/src/backup.ts`, its reads
  in `backupSource()` in `admin/src/db.ts`].
  - Many reads are not one snapshot, so the highest id of every table
    is read first, history first, then translations, senses, forms
    and lemmas, and no row above its table's bound is taken: the file
    never holds a row without its parent, nor history about a row it
    lacks. An edit made while the backup runs may appear without its
    line of history; a backup taken while nobody edits is exact.
  - Only an empty page ends a table, never a short one, so a server
    that caps its pages below a thousand rows loses nothing.
  - The file is identical in format to `export_backup()`'s, which
    stays for the SQL Editor and `psql`; `restore_backup()` and the
    manager's own check accept it unchanged.
  Verified by 4 manager tests on a real database: the assembled file
  equals `export_backup()`'s table by table and count by count, with
  pending, rejected and deleted rows, edits and two authors; pages
  capped at 3 rows lose no row; an entry written while the backup runs
  is left out whole and the file restores into a fresh database
  exactly; an empty dictionary reads no page. The live button must
  still be tried once, since only it talks to Supabase.

### Changed
- `exportBackup()` removed from `admin/src/db.ts`, no longer used.
- `db/README.md`, `admin/README.md` and decision 0031: how the backup
  is assembled, and which limits still apply, to the SQL Editor and to
  a restore.
- Keyboard version 0.11.2, following the project's; the keys are
  unchanged.

### Known issues
- A restore is still one statement, held to a minute through the
  manager or the SQL Editor; a larger backup is restored with `psql`.
- No migration in this version.

Tests: 223, passing on Node.js 22 and 24 [engine 24, db 63, admin 60,
editor 24, keyman 32, corpus 15, docs 5].

## [0.11.1] [2026/10/18] [backups on a larger dictionary]

### Fixed
- The backup button failed with "canceling statement due to statement
  timeout" once the friends in Genoa had entered their corpus.
  Supabase stops every statement of a signed-in user after 8 seconds,
  and `export_backup()` builds the whole dictionary and its history in
  one statement. Migration 0008 gives `export_backup()` and
  `restore_backup()` a time limit of 60 seconds of their own, which
  Supabase's API applies when the lexicon manager calls them; it is
  the highest Supabase allows there. Verified by 3 database tests
  [the limit set on both functions, every other setting of theirs
  unchanged, a session's own limit untouched by a backup]; the limit
  itself is applied by Supabase's API, which the tests cannot run, so
  the button must be tried once on the live dictionary after the
  migration.
- The lexicon manager reported a statement stopped at the time limit
  as a raw database error. It now says, in Italian, English and
  Spanish, that the operation took too long, and where to turn for a
  very large backup [SQLSTATE 57014, a new kind "timeout" in
  `admin/src/errors.ts`]. Verified by a manager test.
- The install page's links to the editor and the dictionary, and its
  language links, scrolled out of view as soon as a reader chose
  English or Spanish. They now stay at the top of the screen, in a bar
  of their own, and the sections stop below it. Verified by an editor
  test and in a headless browser, on a computer and at phone width.

### Changed
- `db/README.md`: the routes for a large backup, the SQL Editor up to
  a minute and, beyond that, `psql` over a session that lifts its own
  limit; decision 0031 notes the change, keeping its original text.
- Keyboard version 0.11.1, following the project's; the keys are
  unchanged.

### Known issues
- 60 seconds is a ceiling: a dictionary that outgrows it again needs
  the backup assembled by the manager table by table, in small pages.
- Migration 0008 changes no data and can be run before or after this
  version is pushed; until it runs, the button fails as before.

Tests: 219, passing on Node.js 22 and 24 [engine 24, db 63, admin 56,
editor 24, keyman 32, corpus 15, docs 5].

## [0.11.0] [2026/10/18] [batch review]

### Added
- Batch review in the lexicon manager [decision 0033, refining 0011].
  A contributor's entry is several rows, the lemma, each form, each
  sense and each translation, and until now each needed its own
  approval, one round trip each.
  - The review queue is grouped by entry: each lemma heads its group,
    with its own row when it is pending, then its pending forms, then
    each sense followed by the translations of that sense. A group
    also appears when only new parts of an approved lemma wait; its
    heading then says so.
  - A box on every row and on every entry, **Select all**, Shift+click
    for a range, and **Approve selected** and **Reject selected**.
    Each entry has its own **Approve entry** and **Reject entry**,
    which act on all its pending rows; each row keeps its own two
    buttons. Rejecting more than one row asks first.
  - Migration 0007: `public.review_batch(items, status)` approves or
    rejects up to 500 pending rows in one call, each at the version
    the page read. Each row is changed on its own, in its own
    subtransaction: a row changed since, missing, deleted, under a
    deleted lemma or sense, no longer pending or refused by a rule is
    returned with its reason, and every other row is still changed.
    It runs as the caller, so row level security, the role rules, the
    automatic base form and the audit log apply exactly as to a single
    update; only reviewers, admins and the trusted backend may call
    it, and a client token without a user is refused before any row
    is touched; a deleted row is never changed, not even by an admin;
    a malformed request is refused whole. The page sends at most 200
    rows per call.
  - The rows that failed are listed above the queue with their reason
    and marked in it. No row of a batch stays selected afterwards, so
    a row someone changed is never approved by a reflexive second
    click; while a batch runs, every button of the page waits; if a
    call is refused whole partway through a large selection, the page
    still reports what earlier calls changed, and reloads.
  Verified by 16 database tests [migration 0007 applied to a database
  holding pending rows of every kind, keeping the queue's original
  columns row for row; a whole entry approved in one call with one
  line of history per row; a part rejected first staying rejected;
  changed, missing, deleted, orphaned, already reviewed and refused
  rows reported while the rest go through; contributors, members,
  anonymous visitors and a token without a user refused before any
  row is touched; every kind of malformed request refused, and 500
  items accepted while 501 are not], 10 manager tests of the pure
  logic in `admin/src/queue.ts`, the last one approving a real queue
  read from the database, and, by hand, the page run in a headless
  browser against a stand in for the database, on a computer and at
  phone width. An independent review of the migration and the page
  found no blocker; its findings are fixed in this version and listed
  under Fixed.
- `README.md`: the project's long-term goal, in English and in the
  Italian summary: a fully integrated Ligurian text editor for
  computers, phones and tablets, with spell checking, predictive text
  and automatic correction, to be built as a separate project in its
  own repository on top of this one, whose components are dogfooded
  here first. It describes four layers of
  correction [orthographic restoration, done today; phonologically
  informed spelling correction, as `sun` to `són`; lexical
  normalization of Italianisms; idiomatic normalization, as `dovéi` to
  `avéighe da`], and the principles that bind them: corrections are
  proposals, every rule is reviewed dictionary data, one engine runs
  everywhere, and each layer waits for its data and its own decision
  record. It extends decision 0001 without reversing it. Verified:
  `npm run check`, all tests passing, the decision tables included.

### Changed
- The TSV and CSV downloads are named by the local date and time of
  the click, such as `ligurian-lexicon-20261018-123107.csv`, instead
  of always `ligurian-lexicon.csv` and `ligurian-lexicon.tsv`: a
  second download no longer overwrites the first or becomes
  `ligurian-lexicon [1].csv`, the name says which day's dictionary a
  file holds, and the files sort by name in the order they were made.
  The stamp is the one backups already used, digits only and local
  time, now built by one function, `admin/src/file-names.ts`, for all
  three downloads. Decision 0025, which said the CSV's name stays
  fixed, is updated accordingly: the original point is kept, struck
  through, above the new one. Verified by 4 manager tests [the
  names, padding, sort order across days, months and years, and no
  fixed name left in the page].
- The review queue labels a sense by its number and Italian
  definition, or as having none, such as "Significato 2, senza
  definizione", and a translation by its language, its text and the
  number of its sense. A sense without a definition used to appear as
  a bare "1" or "2". Migration 0007 adds to `review_queue` each row's
  version, its lemma's headword, status and public code, and the
  sense of senses and translations; its six original columns are
  unchanged. Verified by a database test of the new columns and a
  manager test of the labels in all three languages.
- The single Approve and Reject buttons of the queue go through
  `review_batch()` too, with the version the page read. They used to
  read each row's current version just before changing it, so a row a
  contributor corrected after the queue was opened was approved in a
  form the reviewer had never seen.
- The install page `/tastiera/` has two links at the top, to the
  editor and to the dictionary, in the language being read: the
  section the address names [`#it`, `#en`, `#es`, with a new link to
  return to Italian], else the language chosen elsewhere on the site,
  else Italian. Following a link from a named section makes that the
  site's language, so the editor or the dictionary opens in it. The
  single link "← Scrivi in ligure" was in Italian only and led to the
  editor alone. Without its script the page still works, in Italian.
  Verified by 5 editor tests that run the page's own script against a
  stand in for the browser, and in a headless browser.
- `AppError` and the translation of PostgreSQL error codes moved from
  `admin/src/db.ts` to `admin/src/errors.ts`, so that the queue's pure
  logic can read a batch failure without loading Supabase.

- `README.md`, `db/README.md`, `admin/README.md` and
  `editor/README.md`: batch review, the stamped download names, the
  install page's links, migration 0007, test counts [215 in all], and
  the roadmap, which marks 0.11 done and moves bulk import to 0.12 and
  the beta to 0.13, in English and in the Italian summary.
- Keyboard version 0.11.0, following the project's; the keys are
  unchanged.

### Removed
- `setStatusById()` in `admin/src/db.ts` and `QUEUE_KIND_TABLE` in
  `admin/src/types.ts`, used only by the old queue buttons.

### Fixed
- A pending form, sense or translation whose lemma or sense had been
  deleted stayed in the review queue, and could be approved; with
  whole entry approval it would have been approved in one click under
  a heading that called the lemma pending. Since 0.2.0. The queue now
  leaves such rows out, and a batch reports them as not found.
- A contributor's translation on another contributor's pending sense
  was missing from their own queue, and a form on another's pending
  lemma showed no lemma. Since 0.2.0. The queue now finds the lemma
  through the sense whoever may read it, without revealing the other
  contributor's text.
- The backup file was named by the time the download finished; it is
  now named by the time of the click, like the TSV and CSV.
- The test counts in the README's table of parts, which still said 31
  for the database and 29 for the lexicon manager, and the count in
  "Install and check", which still said 154; the instructions for
  setting up a database said "the five migrations" since 0005.

### Known issues
- Migration 0007 must run on Supabase **before** this version is
  pushed: its lexicon manager calls `review_batch()`. Without it the
  queue still appears, since the page falls back to the old columns,
  but every Approve and Reject fails with a function not found. The
  migration changes no data. Run the whole file in the SQL Editor,
  with nothing selected.
- A batch is not one transaction: when some rows fail, the others stay
  changed. This is by design [decision 0033]; the list of failures
  says what is still pending.

Tests: 215, passing on Node.js 22 and 24 [engine 24, db 60, admin 56,
editor 23, keyman 32, corpus 15, docs 5].

## [0.10.0] [2026/10/18] [public codes and backups]

### Added
- Public identifiers for lemmas and wordforms [decision 0030]. Every
  row's `id` is a number that belongs to one database: a restore into
  a new project or a future import could renumber it. Each lemma and
  each wordform now also carries `public_id`, such as
  `LIJ-7K3Q9MDXK`: `LIJ-`, eight random characters of Crockford's
  base 32 [no I, L, O or U, so a code cannot be misread] and
  Crockford's check symbol, the value modulo 37, which catches every
  single mistyped character and every swap of two neighbours.
  - Migration 0006: the database draws the code when a row is
    inserted, keeps it on every update, and overwrites any value a
    client, an admin or the trusted backend sends. A check constraint
    refuses a malformed code or a wrong check symbol in the table
    itself. Every code ever issued is recorded in
    `private.issued_public_ids`, so a code is unique across lemmas
    and wordforms and never given again, not even after a deletion.
  - Existing lemmas and wordforms receive their codes in migration
    0006, through ordinary updates: each one's version rises by one
    and the history records the assignment.
  - The lexicon manager shows the codes on entry pages, for the lemma
    and every form, beside each lemma in search results and in the
    latest additions, and in each line of an entry's history. A code
    typed into the search field finds its lemma, or the lemma of its
    form; lower case, spaces, a missing hyphen, `O` for `0` and `I` or
    `L` for `1` are forgiven, and a code with a wrong check symbol is
    reported as a typing mistake.
  - The codes are not in the daily snapshot nor in the TSV and CSV
    downloads, whose format stays as it was.
  Verified by 5 database tests [codes valid, unique and registered;
  no one can choose or change one; malformed codes refused by the
  constraint even with the trigger disabled; the database's check
  symbols equal the manager's on 400 bodies and on 200 codes the
  database drew; entries written before 0006 receiving their codes
  with one line of history each] and 7 manager tests, among them one
  that changes every character of a code to every other symbol, and
  swaps every pair of neighbours, and sees each one refused.
- Backups and restore, for admins [decision 0031]. On the people page
  of the lexicon manager, **Download a backup** saves the whole
  dictionary as one JSON file named by local date and time, such as
  `ligurian-backup-20261018-085840.json`: the reference lists, the
  profiles [display name and role; no email, no password], every
  lemma, wordform, sense and gloss, pending, rejected and deleted ones
  included, and the whole history. **Restore from a backup** loads
  such a file into a dictionary that has no entries and no history at
  all, and reports what it loaded.
  - Migration 0006: `public.export_backup()`, which refuses everyone
    but admins and the SQL Editor, and `public.restore_backup()`,
    which also refuses a dictionary that is not empty and any file
    that is not a backup of format version 1. A restore keeps every
    id, code, version, date, status and line of history as it was;
    the triggers that stamp new rows, create base forms and write
    history step aside for the restore alone, through a flag no API
    request can set; the identity counters continue after the highest
    restored id; every restored code is registered, so it is never
    drawn again.
  - Login accounts are not in a backup. A profile is restored onto an
    account with the same id; an author with no such account is
    replaced by no author and counted in the report, while the
    history keeps their id. The person restoring keeps their own
    role, and no admin is ever demoted by a restore.
  - Through the API, Supabase stops a statement after a few seconds;
    a large backup is downloaded and restored from the SQL Editor.
  - The manager checks a file before sending it, and names the reason
    it refuses one: not JSON, not a backup, another format version, a
    table missing.
  Verified by 8 database tests, the main one a round trip: a
  dictionary with approved, pending, rejected and deleted rows,
  inflected forms, senses, translations, edits and several authors is
  backed up, restored into a fresh database whose roles were reset,
  and backed up again, and both backups, table by table, the roles
  and both TSV exports are identical. Others restore into the same
  project after its tables were emptied, refuse incomplete files, and
  prove that a restore failing halfway leaves no row, no code and no
  flag behind, and that a contributor who set the flag still meets
  every rule. An independent review of the migration found that a
  restore into the same project failed, because the registry still
  held the backup's codes; fixed before release. A
  mutation check removed in turn each of the restore's safeguards
  [the history and base form guards, the immutability of codes, the
  registration of restored codes, the reset of the identity
  counters]; every removal made a test fail. Also 4 manager tests on
  file names, summaries and refused files, including a real backup
  written by the database, and 1 that compares the backup button
  with what the database allows, for every role.
- Decision records 0030 [public identifiers] and 0031 [backups];
  record 0012 points to both.
- Decision record 0032: the dictionary as a second purpose of the
  project, after the input method, with the diaspora in Latin America
  as its first audience; records 0001 and 0002 point to it. The
  README's roadmap describes the dictionary steps that follow the
  beta, in English and in the Italian summary.
- The README's acknowledgements thank Alessio Gastaldi, who suggested
  a lasting identifier for every entry.

### Changed
- Migration 0005's header names the author as every other file does,
  `Eng. José Ignacio Castro de R. and contributors`. It was written
  after 0.5.1 made the name uniform, so the old GitHub handle was a
  slip. The change is a comment: a database that already ran 0005
  needs nothing. Migrations 0001 to 0004 keep their original headers.
  Verified: `npm run check`, all tests passing.
- The database test harness can stop after a given migration, so a
  migration is tested on data written before it.
- `downloadText()` moved from the manager's `main.ts` to `ui.ts`, where
  the backup download uses it too.
- `README.md`, `db/README.md` and `admin/README.md`: public codes,
  backups and the restore procedure, test counts [180 in all], and the
  roadmap, which marks 0.10 done and moves bulk import to 0.11 and the
  beta to 0.12, in English and in the Italian summary.
- Keyboard version 0.10.0, following the project's; the keys are
  unchanged.

### Known issues
- Backups are made by hand: an admin must press the button regularly
  and keep the files outside Supabase. An automatic, scheduled backup
  needs a decision of its own.
- In a new Supabase project every account has a new id, so a restore
  there brings back no author and no role: roles are given back by
  hand from the names and roles the backup lists, and the history and
  the backup file are the only record of who wrote what.
- Migration 0006 raises the version of every existing lemma and form
  by one; a page of the manager left open across the migration reports
  a conflict on its next save, and reloads.

## [0.9.0] [2026/10/17] [elided words]

### Added
- Elided words are split at the apostrophe [decision 0029]. The
  dictionary needed `ægua`, `d'ægua`, `l'ægua` and every other
  combination of a particle with a word; now each particle [`d'`,
  `l'`, `quell'`] and each word is entered once, and the input method
  joins them:
  - `engine/src/elision.ts`, `splitElision`: a word splits after
    every apostrophe with a letter right before and right after it;
    an apostrophe at the start or the end, as in `'na` and `pe'`,
    never splits, nor does a hyphen. U+02BC, which Unicode files as a
    letter, counts as an apostrophe.
  - `engine/src/convert.ts`: a word is looked up whole first, and the
    whole word always wins. Only when it is not in the dictionary is
    it split and each part converted on its own, with its own casing:
    `d'aegua` gives `d'ægua`, `D'AEGUA` gives `D'ÆGUA`. An unknown
    part stays as typed; with no known part, nothing changes. When a
    part has several spellings, the menu offers the combinations,
    ranked by the sum of the parts' ranks, at most 9. The web editor
    needed no change: it receives the candidates as before.
  - The Keyman dictionary package carries its own word breaker, a
    self-contained ES3 copy of the same rule, so after `d'` the
    suggestions start again for the next word. It also keeps
    hyphenated words whole, as the previous setting did.
  - The corpus counter takes the parts of an elided word from the
    same `splitElision`.
  Verified by 7 engine tests, an editor test that types `un gotto
  d'aegua`, and 2 Keyman tests: the word breaker splits exactly where
  `splitElision` does, in the source and inside the compiled model,
  on a fixed list and 3,000 pseudo-random strings of Ligurian
  letters, decomposed accents, apostrophes, hyphens and spaces. The
  first run of that test found a real disagreement, U+02BC, now
  settled in the engine.
- The lexicon manager warns, and asks before saving, when a form
  being typed joins a particle and a word, such as `d'ægua`, and names
  its parts: `d'ægua [d' + ægua]`. On a lemma, only the headword being
  typed is checked, not its saved forms. The ñ warning and this one
  share one warning area and ask one question each. Texts in Italian,
  English and Spanish; 1 test. NOTE: run in a simulated browser on the
  new lemma page, as for 0.8.0: both warnings appear and disappear as
  they should, and answering no stops the save.
- The manager's header links to the Android keyboard page,
  `/tastiera/`, as the editor's already did.
- Decision record 0029 [elided words]; records 0018, 0020 and 0022
  point to it, and the open question of 0022 on elided forms is
  marked as settled.

### Changed
- The install page says first, in Italian, English and Spanish, that
  accents are never needed: typing `zeneize` puts `zenéize` in the
  suggestion bar. The long press comes last, as an option. A new line
  explains that the word starts again after an apostrophe. The
  keyboard's welcome page says the same, in Italian and English.
- `README.md`, `CONTRIBUTING.md`, `admin/README.md`,
  `editor/README.md` and `keyman/README.md`: elided words, the
  particles as entries of their own, the phone checklist, test counts
  [154 in all], and the roadmap, which moves bulk import to 0.10 and
  backups and the beta to 0.11, in English and in the Italian summary.
- Keyboard version 0.9.0, following the project's; the keys are
  unchanged.

### Known issues
- Keyman adds a space after every accepted suggestion, so choosing a
  particle such as `d'` from the suggestion bar may leave `d' ` with
  a space. Typing the particle and going on with the word avoids it;
  to be observed on a phone.
- The Android keyboard still cannot replace a word by itself on
  space: Keyman 18 applies a suggestion only when it is tapped.
  Keyman 19, in beta since 2026/10/06 with the stable release
  expected early in 2027, adds autocorrection of high probability
  typos on Android and iPhone; whether it treats `zeneize` as such a
  typo for `zenéize` must be tested on a phone with the beta.
- The particles themselves are not in the dictionary yet. Until they
  are, the part after them is still converted and the particle stays
  as typed.

## [0.8.3] [2026/10/17] [counting fixes; no literal invisible characters]

### Fixed
- `corpus/src/frequency-list.ts` held the byte order mark as the
  invisible character itself, twice, since 0.8.0: the very mistake
  0.7.0 and 0.8.0 had fixed elsewhere, made again in the file that
  0.8.0 added. Both are written as escapes now. Found while preparing
  this version, by the same byte search as before; nothing had
  guarded against it.
- A word must hold at least one letter [`isCountableWord` in
  `corpus/src/count.ts`]. The first list counted a lone apostrophe,
  `'`, 633 times. It matched no form and changed no ranking. The
  committed `data/frequencies/lijwiki.tsv` loses that one row and its
  `# Words:` line reads 83,574; nothing else in it changes. The reader
  refuses such a row from now on, so a list made by an older counter
  cannot slip it back in.
- The snapshot's `# Frequencies:` line said "17 rows in ofiçiâ ranked
  by it", which reads as if the snapshot held 17 rows; it held 22. It
  now says "17 of 22 rows in ofiçiâ found in it": `applyFrequencies`
  also reports how many rows were in the list's orthography.

### Added
- `docs/test/source-text.test.ts`: every text file of the repository
  is read, and the test fails on any byte order mark, zero width
  space or joiner, word joiner or no-break space written literally.
  The one exception is the encoding mark at the start of the Keyman
  `.kmn` source. 143 tests in all.

### Changed
- `README.md`: test counts, the list's word count, the new test.
- Keyboard version 0.8.3, following the project's; the keyboard is
  unchanged.

## [0.8.2] [2026/10/17] [the first frequency list]

### Added
- `data/frequencies/lijwiki.tsv`, the first frequency list, counted
  by the workflow "Frequencies from the Ligurian Wikipedia" from the
  dump `lijwiki-20261001-pages-articles` on 2026/10/17 16:52:26 UTC:
  83,575 distinct words, each seen at least twice, 2,228,526
  occurrences in all. From the next Pages build on, the snapshot adds
  these counts to the stored frequencies of every form in grafîa
  ofiçiâ, so the editor's menu and the keyboard's suggestions rank
  spellings by real use. Checked before committing with the
  project's own reader: no bad line, LF endings, no byte order mark.
  Some counts: `Zêna` 2,020, `çitæ` 1,811, `zenéize` 807, `pénn-a`
  15, `pénna` 10.

### Changed
- `README.md`: the list in use, in English and in the Italian
  summary; the Ligurian Wikipedia is described as writing mostly, not
  only, in grafîa ofiçiâ.
- Keyboard version 0.8.2, following the project's; the keyboard is
  unchanged. The dictionary package's `HISTORY.md` records the first
  list.

### Known issues
- The Ligurian Wikipedia is not written only in grafîa ofiçiâ: the
  list also holds `zena` [1,909] beside `Zêna` [2,020], and 427 words
  with `ñ` [3,517 occurrences]. Such spellings match no ofiçiâ form
  unless one is spelled the same, so they rarely affect a ranking.
- Wikipedia's own vocabulary weighs in: `progètti` is seen 8,623
  times, mostly from navigation text, not prose.
- A lone apostrophe, `'`, is counted as a word [633 times]. It
  matches no form, so it is harmless; the counter should require at
  least one letter, a fix for the next recount.

## [0.8.1] [2026/10/17] [the dump found from Wikimedia's status files]

### Fixed
- The first run of "Frequencies from the Ligurian Wikipedia" failed:
  the download of the dump returned HTTP 404. 0.8.0 guessed the run
  from Wikimedia's RSS file for the latest dump and built the file's
  address by hand, and that address did not exist. The run's log
  showed no date, so the exact cause could not be seen. Now
  `tools/find-dump.ts` reads the list of runs on dumps.wikimedia.org,
  newest first, and each run's own `dumpstatus.json`; it takes the
  first run whose articles job is "done" and lists the run's
  `pages-articles.xml.bz2`, with the SHA-1 given there. Every run
  tried is printed with the reason it was taken or skipped, so a
  failure now explains itself. A date typed by hand is checked the
  same way.
- The address is always built on dumps.wikimedia.org from the wiki,
  the date and the file name, never taken from the downloaded JSON.
  The wiki name and the date are validated before they are used.

### Added
- `corpus/src/dumps.ts`, the pure part of that choice, with 5 tests in
  `corpus/test/dumps.test.ts`: the run list, a finished run, an
  address offered by the JSON and ignored, and eight ways a run is
  refused. 142 tests in all. The command line was also run against a
  stand-in server: an unfinished run and a missing status file were
  skipped, the next finished run was taken, a bad date was refused.

### Changed
- `frequencies.yml`: the steps "Find the dump" and "Download and
  verify the dump" use the tool's results; the SHA-1 list file is no
  longer downloaded.
- Decision 0027, `README.md`, `corpus/README.md` and
  `data/frequencies/README.md` describe the new choice of the dump.
- Keyboard version 0.8.1, following the project's; the keyboard is
  unchanged.

## [0.8.0] [2026/10/17] [real frequencies; the ñ warning]

### Added
- Real frequencies from the Ligurian Wikipedia [decision 0027]. The
  Ligurian Wikipedia writes in grafîa ofiçiâ, and its text is under
  CC BY-SA 4.0, the license of the project's data. Its words are
  counted and the counts are added to the dictionary's own
  frequencies when the daily snapshot is taken, so the editor's menu
  and the keyboard's suggestion bar put the most used spelling first
  instead of the alphabetical one. Verified end to end in a test: the
  fixture offers `pénn-a` before `pénna` for `penna`; after a count in
  which `pénna` is more frequent, `pénna` comes first, and no form is
  gained or lost.
- `corpus/`, three modules of pure functions:
  - `src/wikitext.ts` splits a MediaWiki dump into pages as it
    arrives, keeps the articles [namespace 0, no redirects] and strips
    the wiki markup. Verified on a dump cut into pieces of 1, 7 and 64
    characters, and on a synthetic dump of 20,000 pages and 90 MB,
    counted in 13 seconds;
  - `src/count.ts` finds the words the way the editor sees them and
    counts each under its frequency key [NFC, lower case, ASCII
    apostrophe]; an elided word counts whole and in its parts;
  - `src/frequency-list.ts` writes, reads and applies
    `data/frequencies/lijwiki.tsv`; a damaged list is reported line by
    line.
  10 tests, on wikitext and dumps written for the tests; no Wikipedia
  text is copied into the repository.
- `tools/count-frequencies.ts` [`npm run frequencies:count`]: a dump
  in, the frequency list out; it reads the file back with its own
  reader before writing it, and writes nothing on any error.
- `.github/workflows/frequencies.yml`, "Frequencies from the Ligurian
  Wikipedia", run by hand: it downloads the latest dump [or a dated
  one], checks it against Wikimedia's SHA-1 list, counts it and offers
  `lijwiki.tsv` as an artifact. It has no write permission; a person
  reviews and commits the file. NOTE: until the first list is
  committed, the snapshot uses the database's frequencies unchanged,
  as before.
- `data/frequencies/README.md` and `corpus/README.md`: the format, how
  to make a new count, the attribution; `data/LICENSE.md` names the
  Ligurian Wikipedia as the source of the counts.
- The lexicon manager warns before a form with `ñ` is saved under the
  grafîa ofiçiâ, which does not write that letter [decision 0028].
  A warning line appears under the form while the condition holds,
  and saving asks for confirmation; the database still accepts the
  word, because only a person can tell whether the letter or the
  spelling system is wrong. Checked when proposing a lemma, editing a
  lemma [a change to `ofiçiâ` checks its inflected forms too], and
  adding or editing an inflected form. Texts in Italian, English and
  Spanish. `enyeUnderOficia` in `admin/src/forms.ts`, with 2 tests,
  one of which checks the code `ofiçiâ` against the real database.
  NOTE: the new lemma page was also run in a simulated browser
  [happy-dom, outside the repository]: the warning appears for
  `Españ`, hides under `unitäia`, returns under `ofiçiâ`, and saving
  stops when the question is answered no; `pénna` raises nothing. The
  entry page's forms share the same two helpers, but were checked by
  the type checker only.
- `docs/test/decisions.test.ts`, 4 tests [`npm run test:docs`]: both
  decision tables name every record exactly as its own title does,
  with its date and status, and every "Refines" or "Supersedes" is
  answered by the record it points to. Both tables had drifted from
  the records by hand.
- Decision records 0027 [real frequencies; it supersedes the point of
  0009 about normalizing the corpus] and 0028 [the ñ warning].

### Changed
- `tools/fetch-lexicon.ts` ranks the snapshot with the committed
  frequency list, adds a `# Frequencies:` line naming it, and stops
  the build if the list is damaged. The snapshot's `freq` is now a
  ranking weight; `docs/lexicon-format.md` says so. The manager's TSV
  and CSV downloads keep the stored value.
- `engine/src/lexicon.ts` exports `isValidForm`, the one test of a
  valid form now shared by the loader and the corpus counter.
- Every source header names the author as "Eng. José Ignacio Castro
  de R. and contributors", as `LICENSE` names the copyright holder.
  0.5.1 had changed only the engine and database test headers; 56
  other files still read "Ignatz-CastroR and contributors". The old
  headers without a time or a place gained the place, and the time
  where one is on record: that of the commit that first published the
  file. The database test headers are aligned like every other. The
  pages `admin/index.html` and `editor/index.html` and both Keyman
  `.kpj` projects gained the header they lacked; kmc still compiles
  the projects, as the Keyman tests prove. NOTE: the migrations in
  `db/migrations/` are left exactly as they were run on Supabase,
  header included.
- Keyboard version 0.8.0, following the project's; the keyboard is
  unchanged. The dictionary package's counts now come from the ranked
  snapshot; its `HISTORY.md` says so, and states its rule exactly:
  only the project versions that changed the model or its words are
  listed.
- `.gitignore` version 1.1: the build folders named one by one with a
  leading `/`, so that no future source folder called `dist` or
  `build` is hidden; Wikipedia dumps excluded; stale comments updated.
- Workflow headers: the decisions are listed under one `Decision:`
  label in all three workflows.
- Decision tables in `docs/decisions/README.md` and `README.md`
  rebuilt from the records' own titles; 0011 dated 2026/10/10, as the
  record itself; 0009 and 0023 marked as superseded in part. Missing
  answers added: 0024 refines 0022; 0019, 0018 and 0024 are refined
  by 0027 and 0028.
- `README.md`: the corpus, the workflow, the snapshot's ranking step,
  the commands, the layout, the test counts and the roadmap, in
  English and in the Italian summary.

### Fixed
- `engine/src/lexicon.ts` still held the byte order mark as the
  invisible character itself, the very mistake 0.7.0 fixed in the
  manager; it now writes `\uFEFF`. Found by a byte search of every
  tracked file. NOTE: the BOM at the start of
  `keyman/ligurian_keyboard/source/ligurian_keyboard.kmn` stays: it
  is the file's encoding mark, not a character in code.
- `README.md` spoke of four migrations; there are five.
- `db/README.md` counted 6 search key tests; there are 10.
- `admin/src/main.ts` said the web editor knows only Italian and
  English; it has offered Spanish since 0.6.0.
- `CHANGELOG.md`, 0.6.0: the install page is in three languages, not
  two. 0.3.0 is dated 2026/10/17, the day of its tag, in the CHANGELOG
  and in the README.
- Decision records 0007 and 0021 say "SIL Global", the name the rest
  of the project uses; 0008 places the Italian summary at the end of
  `README.md`, where it is.
- `CONTRIBUTING.md`: a change to the folding rules names all four
  places, as `docs/skeleton-spec.md` does, and Spanish joins the
  languages of contribution, as in `README.md`;
  `docs/skeleton-spec.md` no longer speaks of a single copy.
- `admin/README.md` and `editor/README.md`: the site build also makes
  the Keyman packages and the install page.
- `keyman/ignatzcastror.lij.ligurian_keyboard/README.md`: the word
  list is written into the staging copy, not into the committed
  folder; the dictionary's `readme.htm` carries the copyright line,
  as the keyboard's does.

### Known issues
- The counts reflect encyclopedic prose; everyday words may rank lower
  than in speech, and generated stub articles weigh in. A second
  corpus can be added as another file of the same format.
- The workflow finds the latest dump through Wikimedia's RSS file for
  it; if that file changes, the run stops before counting, and a dump
  date typed by hand still works.

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
  and `README.md`, the install page under `/tastiera/` in all three
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

## [0.3.0] [2026/10/17] [the lexicon manager]

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
[Unreleased]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.13.0...HEAD
[0.13.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.12.1...v0.13.0
[0.12.1]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.11.2...v0.12.0
[0.11.2]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.11.1...v0.11.2
[0.11.1]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.8.3...v0.9.0
[0.8.3]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.8.2...v0.8.3
[0.8.2]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Ignatz-CastroR/ligurian-keyboard/releases/tag/v0.1.0
