# admin: the lexicon manager

A web page where people search the shared Ligurian dictionary, propose words and review proposals; admins also make backups. Profiles, people and roles live in the site's Users section, [users/](../users/README.md), built from this manager's own modules. Plain TypeScript, built with [Vite](https://vite.dev), talking directly to the Supabase database. Design: decisions [0018](../docs/decisions/0018-lexicon-manager-design.md), [0023](../docs/decisions/0023-lexicon-manager-spanish-history-csv.md), [0025](../docs/decisions/0025-csv-semicolon.md), [0030](../docs/decisions/0030-public-identifiers.md), [0031](../docs/decisions/0031-backups.md), [0033](../docs/decisions/0033-batch-review.md), [0035](../docs/decisions/0035-site-in-five-sections.md), [0038](../docs/decisions/0038-senses-reviewed-one-by-one.md) and [0039](../docs/decisions/0039-grammar-in-structured-fields.md).

The interface is in **Italian**, the default, **English** and **Spanish**; the menu in the header switches between them and the choice is remembered in the browser.

## Who can do what

| Person | Can |
|---|---|
| Anyone, signed out | Search the published dictionary, see the latest additions, and download the dictionary as TSV or CSV |
| member | The same, plus edit their own display name and see their own proposals |
| contributor | Propose lemmas, forms, senses and translations; edit their own pending proposals |
| reviewer | Approve, reject and correct anything; see the review queue, the list of people and the history of every entry; regroup the senses of a lemma, which removes the senses it replaces |
| admin | Everything a reviewer can, plus delete, restore, rename people and change roles; download a backup, and restore one into an empty dictionary |

The database enforces all of this [db/README.md](../db/README.md); the page only hides the buttons that would fail.

## Pages

At the top of every page, the site's bar of five sections [`site/`]; below the manager's title, its own tabs: Search, New lemma [contributors and up], To review [signed in], Significati da rivedere [reviewers and admins] and Backups [admins], the current one filled.

| Address | Page |
|---|---|
| `#/search/<query>` | Search by ASCII key: typing `zena` finds `Zêna`, typing `penne` finds the lemma `pénna` through its form. A public code such as `LIJ-7K3Q9MDXK` finds its lemma, or the lemma of its form. While the field is empty, the 20 approved lemmas added most recently are listed below it |
| `#/entry/<id>` | One entry: lemma, forms, numbered senses with translations, history; the grammar of the lemma and of each form in one line, edited in fields of their own [see Grammar below]; the public code of the lemma and of every form; a link to the same entry in the dictionary for readers when it is published, otherwise the reason it is not [pending, rejected, deleted]. Translations are added one or several at a time: `penna; stilografica` becomes two rows, shown before saving; the language starts unchosen and must be chosen; an edited translation may not hold ";" |
| `#/new` | Propose a new lemma, with its grammar; lemmas with the same ASCII key are shown while typing, to avoid duplicates |
| `#/review` | Everything pending, oldest first, grouped by entry; for staff, batch approval and rejection [see Reviewing below] |
| `#/senses` | For reviewers and admins: the lemmas whose senses wait to be reviewed, fewest senses first, 50 a page [see Repairing the senses below] |
| `#/repair/<id>` | For reviewers and admins: the senses of one lemma, regrouped with a key |
| `#/backups` | For admins: download a backup, restore one into an empty dictionary |
| `#/signin` | Sign in |
| `#/users` | Moved in 0.13.0: opens the Users section, `../utenti/` |

## Grammar

Under the part of speech, a group **Grammatica** holds the grammar of a lemma, in the form for a new lemma and in the lemma's edit. A form, in its edit and in the form to add one, has **Analisi grammaticali**: one block per reading, "Analisi 1", "Analisi 2" and so on, each with the fields of a form, **Aggiungi un'analisi** to add one and **Togli** to remove one, since one spelling may stand for several readings [`parla`: present indicative, third person singular, and imperative, second person singular]. A new form starts with one empty reading. Every field is optional. Which fields show follows the part of speech as it is chosen [`src/grammar.ts`]:

| Part of speech | The lemma | Each reading of its forms |
|---|---|---|
| noun, proper noun, adjective, numeral | gender, number, invariable | gender, number |
| article | gender, number | gender, number |
| pronoun, determiner | person, gender, number | person, gender, number |
| verb | verb form, conjugation, auxiliary, pronominal | verb form, person, gender, number |
| adverb, preposition, conjunction, interjection | none | every field of a form |
| none, other | every field of a form | every field of a form |

* A field that already holds a value, in the lemma or in any reading of the form, stays shown whatever the part of speech, so that a save never empties a value nobody saw; a verb's own three are the exception, since the database accepts them on verbs only.
* A save sends the fields shown and empties the others: a verb that becomes a noun loses its conjugation, auxiliary and pronominal mark, as the database requires. A reading left with no value is dropped, and one given twice is kept once.
* A lemma that becomes a verb with no verb form yet is given the infinitive, its lemma's form; one that stops being a verb loses the infinitive.
* The base form's first reading is its lemma's, when the lemma has one: its edit shows it, "Analisi 1, quella del lemma", and offers no field for it; the database keeps it in step. Further readings of the same spelling are added there by hand, such as the plural reading of an invariable noun; they stay when the lemma's reading changes, and if the lemma's new reading is one of them, the two change places. A page read before the lemma changed is told to reload, as for any conflict.
* The menus list the values of the database's lists in their order. Gender, number, person and verb form are named in the page's language; conjugation classes and auxiliaries are Ligurian words, shown as written. A value added to a list in the database appears the next time the manager is opened or reloaded, with its Italian name.
* The entry shows the grammar in one line, such as "femminile, singolare, invariabile", a form's readings separated by ";"; the review queue shows it in brackets after each lemma and form, a lemma's followed by the readings its base form adds, which are approved with it: "femminile, singolare, invariabile; anche: femminile, plurale".
* Each reading is a group named by its number for screen readers, and its button says which reading it removes.
* The free text field of a form is now named **Nota grammaticale [testo libero]**, for what the fields do not say [decision [0039](../docs/decisions/0039-grammar-in-structured-fields.md)].

## Repairing the senses

Before 0.12.1, words loaded by SQL received one sense per translation. Migration 0012 lists the lemmas left in that shape on the day it runs, once and for all: no edit takes a lemma off the list, and no new entry joins it. The tab **Significati da rivedere** shows the lemmas on the list not yet reviewed, fewest senses first, 50 a page, each with its translations; **Comincia dal primo** opens the first of the whole queue.

The page of a lemma, `#/repair/<id>`, lists its translations, each with its current sense and a **Nuovo significato** menu that starts at the current one, and an Italian definition field for each group of translations, labelled with the number its sense will have. A field shows the definition of the sense that holds exactly its translations, if one does, and keeps what is typed while the menus change. Three actions decide, each also on a key while neither a text field nor a menu has the focus; on a menu the keys choose, as usual, and after a choice made with the mouse the focus leaves the menu:

| Key | Action | Sends |
|---|---|---|
| 1 | **Un solo significato** | every translation in one sense, with the first field's text |
| 2 | **Lascia così** | the senses as they are, ignoring the menus, numbered 1, 2, 3 without gaps; a field whose group holds exactly a sense's translations gives that sense its text |
| 3 | **Raggruppa** | one sense per number chosen, in increasing order, numbered 1, 2, 3, each with its field's text |

What a field shows is what is sent: what was typed, or else the definition of the sense holding exactly its translations. A definition shown in a field that the chosen action would not use stops the action, with a message, so that no definition is lost by a key press: clear the field first, or use **Raggruppa**. A field that disappears, because no translation is left in its group, takes its typed text with it.

Each action is one call to `regroup_senses()` [migration 0012], with the lemma, every sense and every translation at the version the page read. A sense whose translations stay together is kept, with its id and history; the others are recreated, their translations copied and the originals removed, and the numbers never collide; since 0.16.0 a renumbered sense writes one line of history [decision [0040](../docs/decisions/0040-two-limits-of-the-sense-review-lifted.md)]. The lemma is marked reviewed, and the next lemma of the queue opens, or the first still waiting, with a summary of what changed; when none waits, the queue says it is finished. If anyone changed the lemma meanwhile, another reviewer's "Lascia così" included, nothing is saved: the page reloads and says so. **Salta** opens the next lemma without saving; a link opens the entry, where a translation's text or language is corrected. A lemma with a sense that has no translation cannot be regrouped until the sense gets a translation in the entry, or an admin removes it; a lemma with no sense left is closed with **Lascia così**. The entry page links to the repair page for reviewers and admins, and says when the senses were last reviewed [decision [0038](../docs/decisions/0038-senses-reviewed-one-by-one.md)].

## Reviewing

The review queue comes in pages of 50 entries, oldest first, with the number of entries and rows waiting above it and **Pagina precedente** and **Pagina seguente** below; when a page is reviewed, the next entries move up into it, and only a page with nothing after it gives way to the one before. The position and totals come from the database with each page, so they stay right while others review at the same time. Each page shows every pending row grouped by entry: each lemma heads its group, with its own row when it is pending, then its pending forms, then each sense followed by its translations. A group also appears when the lemma is already approved and only new parts wait; its heading then says so. A sense is labelled by its number and Italian definition, or as having none, such as "Significato 2, senza definizione".

Reviewers and admins have a box on every row and on every entry, a **Seleziona tutto** box for the rows of the page, and **Approva i selezionati** and **Rifiuta i selezionati**; Shift+click selects every row between the last box clicked and this one. Each entry also has **Approva la voce** and **Rifiuta la voce**, which act on all its pending rows; each row keeps its own two buttons. Rejecting more than one row asks first.

Every action goes through one call to `review_batch()` [migration 0007], with each row at the version the page read, at most 200 rows per call. A row someone changed in the meantime is not overwritten: it stays pending and is listed above the queue with the reason, together with any row that was deleted or refused by a rule; every other row is changed all the same. After a batch no row of it stays selected, so a row changed by someone else is never approved by a second click in its new form; the rows that failed are marked in the queue until the next action, and while a batch runs every button of the page waits. A pending row whose lemma or sense was deleted no longer appears in the queue [decision [0033](../docs/decisions/0033-batch-review.md)].

## Downloads

Both buttons in the header download the published dictionary, from the same export. Each file is named by the local date and time of the click, digits only, such as `ligurian-lexicon-20261018-123107.tsv` and `ligurian-lexicon-20261018-123107.csv`, so that a second download never overwrites the first and the files sort by name in the order they were made; backups are named the same way, `ligurian-backup-20261018-123107.json` [`src/file-names.ts`].

* **TSV:** the engine's own format [`docs/lexicon-format.md`], with comment lines stating the license.
* **CSV:** the same rows for spreadsheets, separated by **semicolons**, as Excel set to Italian or Spanish expects, so a double click opens the file in columns; otherwise RFC 4180: fields quoted only when they hold a semicolon, a double quote, a line break or surrounding spaces, CRLF line endings, and a UTF-8 byte order mark so that Excel shows the Ligurian letters correctly [decision [0025](../docs/decisions/0025-csv-semicolon.md)]. Excel set to English expects commas: open the file there through **Data → From Text/CSV**; LibreOffice asks for the separator when it opens the file, and Google Sheets detects it when importing.

Every field for a Ligurian spelling has buttons for the special letters `à â ä è é ê ë ì î ï ò ó ô ö ù û ü æ ç`, then `ñ`, which some other Ligurian spelling systems write [decision [0024](../docs/decisions/0024-letter-enye.md)]; hold Shift for the upper case letter. A word with `ñ` is entered under its own spelling system, not `ofiçiâ`: whenever a form with `ñ` would be saved under `ofiçiâ`, a warning appears under the form, and saving asks for confirmation first [decision [0028](../docs/decisions/0028-enye-warning-under-oficia.md)]. Changing a lemma's spelling system to `ofiçiâ` checks its inflected forms too.

Elided particles such as `d'`, `l'` and `quell'` are entries of their own. A form that joins a particle and a word, such as `d'ægua`, raises a warning that names its parts, and saving asks for confirmation: the editor and the keyboard split such words by themselves, so the dictionary needs `d'` and `ægua` once each [decision [0029](../docs/decisions/0029-elision.md)].

The header links to the web editor and to the Android keyboard page, `/tastiera/`.

## Public codes

Every lemma and every form shows its **public code**, such as `LIJ-7K3Q9MDXK`, given by the database and never changed [decision [0030](../docs/decisions/0030-public-identifiers.md)]. To find an entry by its code, type the code into the search field; lower case, spaces and hyphens anywhere, `O` for `0` and `I` or `L` for `1` are all accepted. A code whose last character, the check symbol, does not match the others is reported as a typing mistake, never taken for another entry. Each line of an entry's history shows the code of the row it concerns; lines written before 0.10.0 have none.

## Backups

In the Backups tab, admins find two cards [decision [0031](../docs/decisions/0031-backups.md)]:

* **Download a backup:** the whole dictionary as one JSON file, named by date and time, such as `ligurian-backup-20261018-085840.json`. The page assembles it from many small reads, a thousand rows at most each, showing how many rows it has read, so no single request can meet the database's time limit however large the dictionary grows; at the end it checks that the history did not grow meanwhile, since every change writes a line of it, and starts again otherwise, up to three times, so the file always restores; the file is identical in format to the one `export_backup()` writes in the SQL Editor. It holds every row, pending and deleted ones included, the whole history and every profile [name and role; no email and no password]: keep it private and away from Supabase.
* **Restore from a backup:** only into a newly created dictionary with no entries and no history; the database refuses anything else. The file is chosen with the page's own button, **Scegli il file**, and its name is shown in the page's language: the browser's own chooser, which speaks the browser's language, is hidden, though still reached by the keyboard and named for screen readers by the field's title and the button. The file is checked before it is sent, and the page reports what was restored. The full procedure is in [db/README.md](../db/README.md).

The **frequency** of a form is a weight, 1 by default. The daily snapshot adds to it the number of times the Ligurian Wikipedia uses the form [decision [0027](../docs/decisions/0027-real-frequencies.md)], so there is usually no need to change it; raise it only to put a form ahead of what the corpus says. The TSV and CSV downloads show the stored value.

## Files

| File | Contents |
|---|---|
| `index.html` | The page shell |
| `src/main.ts` | Start up, session, the site's bar, header and tabs, routing |
| `src/links.ts` | The link from a lemma to the dictionary for readers, or why there is none; pure functions |
| `src/db.ts` | Every database query; optimistic locking; error translation |
| `src/permissions.ts` | Which buttons to show to whom |
| `src/forms.ts` | Input checks and formatting; pure functions |
| `src/export.ts` | TSV to CSV conversion; pure functions |
| `src/public-id.ts` | Public codes: Crockford's base 32, the check symbol, reading a typed code; pure functions |
| `src/backup.ts` | A backup assembled from small reads, the check of a backup file before a restore, summaries of counts; pure functions |
| `src/file-names.ts` | Download names stamped with the local date and time, for the TSV, the CSV and backups; pure functions |
| `src/queue.ts` | The review queue grouped by entry, its labels, the selection and the items of a batch; pure functions |
| `src/repair.ts` | The repair page's logic: the rows, what was seen, the definition fields, the groups each action sends, the keys; pure functions |
| `src/grammar.ts` | Grammar: the fields each part of speech shows, what a save sends, a form's readings, the names of the values in three languages, the one line that sums a row up; pure functions |
| `src/grammar-fields.ts` | The grammar's fields in a form: a lemma's, following the part of speech, and a form's list of readings |
| `src/errors.ts` | The kinds of failure, and how a PostgreSQL error code becomes one |
| `src/messages.ts` | Every text, in Italian, English and Spanish; the language menu's entries |
| `src/ui.ts` | Page building helpers; never `innerHTML` |
| `src/types.ts` | Row types, mirroring the database |
| `src/views/*.ts` | One file per page; `backups.ts` is the Backups tab |
| `src/style.css` | Light and dark look |
| `test/forms.test.ts` | Input checks, including agreement with the database's letter list; several translations split on ";" |
| `test/links.test.ts` | The link to the dictionary, offered exactly for the entries the real database publishes |
| `test/permissions.test.ts` | Every button rule checked against the real database rules |
| `test/export.test.ts` | The CSV conversion, against RFC 4180 with semicolons, and in a round trip |
| `test/messages.test.ts` | The three languages: no empty text, no lost placeholder, no untranslated copy; the example code in the search hint is valid |
| `test/public-id.test.ts` | Public codes: both directions of base 32, the check symbol catching every single wrong character and every swap of neighbours, and the forgiving reading of a typed code |
| `test/backup.test.ts` | Backup file names, summaries, every reason a wrong file is refused, and a real backup written by the database passing the check; no file chooser of the browser's shown, every one named by the page in its own language |
| `test/backup-assembly.test.ts` | The backup assembled from small reads equals `export_backup()`'s on a real database, loses no row when the server sends short pages, starts again when the dictionary changes meanwhile and refuses a dictionary that never rests, retries a failed read, and restores exactly |
| `test/file-names.test.ts` | Download names: padded, digits only, sorting in time order; no fixed name left in the page |
| `test/queue.test.ts` | Grouping by entry, labels in three languages, ranges, entry and "select all" selection, batch items, failure reasons, and a real queue approved whole by the database |
| `test/grammar.test.ts` | The fields of each part of speech, every part the manager offers decided, a value held kept in view, what a save sends, a form's readings and a base form's first, the infinitive given to a new verb and taken from a lemma that stops being one, every value of the real database's lists named in three languages, the menus' order, the one line of a row's grammar; 23P01 read as a duplicate |
| `test/repair.test.ts` | The repair page's logic: rows, what was seen, definition fields that follow their translations, a definition shown that an action would lose, the keys, the queue's rule; then on the real database, the five entries a speaker grouped and definitions kept through a reordering |
| `vite.config.ts` | Build settings |

## Running it on your computer

1. Copy `.env.example` in the repository root to `.env` and fill in the two values from Supabase:
   * **Project URL:** Project Settings → Data API. It looks like `https://abcd….supabase.co`; it is **not** the dashboard address.
   * **Publishable key:** Project Settings → API Keys, starting with `sb_publishable_`.

   Never put the **secret** key there.
2. Run:

   ```
   npm install
   npm run admin:dev
   ```

3. Open the address it prints, usually <http://localhost:5173>.

`npm run admin:build` writes the static site to `admin/dist/` [ignored by git]; `npm run admin:preview` serves that build locally.

## Accounts

There is no sign up page. To add a person:

1. Supabase → **Authentication → Users → Add user → Create new user**, with their email and a temporary password; tick **Auto Confirm User**.
2. Give them the email and password through a private channel; they sign in and set their display name in the **Users** section, `/utenti/`.
3. In the **Users** section, an admin changes their role to `contributor` or `reviewer`.

## Publishing on GitHub Pages

1. GitHub repository → **Settings → Secrets and variables → Actions → Variables** tab → **New repository variable**, twice:
   * `SUPABASE_URL`: the Project URL
   * `SUPABASE_PUBLISHABLE_KEY`: the publishable key

   Use **Variables**, not Secrets: both values are public by design, and variables stay readable for checking.
2. **Settings → Pages → Build and deployment → Source:** GitHub Actions.
3. Push to `main`. The workflow `.github/workflows/pages.yml` runs every test, takes a snapshot of the dictionary, builds the Keyman packages, the web editor, the manager, the dictionary for readers and the Users section, and publishes them together, with the Android install page and the packages under `/tastiera/`: the editor at `https://<user>.github.io/ligurian-keyboard/`, the manager at `https://<user>.github.io/ligurian-keyboard/admin/` [since 0.4.0; until then the manager was at the root].
4. In Supabase → **Authentication → URL Configuration**, set the **Site URL** to the manager's address, ending in `/admin/`, and add it to the **Redirect URLs**, together with the Users section's address, ending in `/utenti/`.

When the manager runs locally [`npm run admin:dev`], the bar's buttons to the other sections lead nowhere useful: each section is a separate local server [`npm run editor:dev`, `npm run dictionary:dev`, `npm run users:dev`].
