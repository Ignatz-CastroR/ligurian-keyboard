# admin: the lexicon manager

A web page where people search the shared Ligurian dictionary, propose words and review proposals; admins also make backups. Profiles, people and roles live in the site's Users section, [users/](../users/README.md), built from this manager's own modules. Plain TypeScript, built with [Vite](https://vite.dev), talking directly to the Supabase database. Design: decisions [0018](../docs/decisions/0018-lexicon-manager-design.md), [0023](../docs/decisions/0023-lexicon-manager-spanish-history-csv.md), [0025](../docs/decisions/0025-csv-semicolon.md), [0030](../docs/decisions/0030-public-identifiers.md), [0031](../docs/decisions/0031-backups.md), [0033](../docs/decisions/0033-batch-review.md) and [0035](../docs/decisions/0035-site-in-five-sections.md).

The interface is in **Italian**, the default, **English** and **Spanish**; the menu in the header switches between them and the choice is remembered in the browser.

## Who can do what

| Person | Can |
|---|---|
| Anyone, signed out | Search the published dictionary, see the latest additions, and download the dictionary as TSV or CSV |
| member | The same, plus edit their own display name and see their own proposals |
| contributor | Propose lemmas, forms, senses and translations; edit their own pending proposals |
| reviewer | Approve, reject and correct anything; see the review queue, the list of people and the history of every entry |
| admin | Everything a reviewer can, plus delete, restore, rename people and change roles; download a backup, and restore one into an empty dictionary |

The database enforces all of this [db/README.md](../db/README.md); the page only hides the buttons that would fail.

## Pages

At the top of every page, the site's bar of five sections [`site/`]; below the manager's title, its own tabs: Search, New lemma [contributors and up], To review [signed in] and Backups [admins], the current one filled.

| Address | Page |
|---|---|
| `#/search/<query>` | Search by ASCII key: typing `zena` finds `Zêna`, typing `penne` finds the lemma `pénna` through its form. A public code such as `LIJ-7K3Q9MDXK` finds its lemma, or the lemma of its form. While the field is empty, the 20 approved lemmas added most recently are listed below it |
| `#/entry/<id>` | One entry: lemma, forms, numbered senses with translations, history; the public code of the lemma and of every form; a link to the same entry in the dictionary for readers when it is published, otherwise the reason it is not [pending, rejected, deleted]. Translations are added one or several at a time: `penna; stilografica` becomes two rows, shown before saving; the language starts unchosen and must be chosen; an edited translation may not hold ";" |
| `#/new` | Propose a new lemma; lemmas with the same ASCII key are shown while typing, to avoid duplicates |
| `#/review` | Everything pending, oldest first, grouped by entry; for staff, batch approval and rejection [see Reviewing below] |
| `#/backups` | For admins: download a backup, restore one into an empty dictionary |
| `#/signin` | Sign in |
| `#/users` | Moved in 0.13.0: opens the Users section, `../utenti/` |

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
* **Restore from a backup:** only into a newly created dictionary with no entries and no history; the database refuses anything else. The file is checked before it is sent, and the page reports what was restored. The full procedure is in [db/README.md](../db/README.md).

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
| `test/backup.test.ts` | Backup file names, summaries, every reason a wrong file is refused, and a real backup written by the database passing the check |
| `test/backup-assembly.test.ts` | The backup assembled from small reads equals `export_backup()`'s on a real database, loses no row when the server sends short pages, starts again when the dictionary changes meanwhile and refuses a dictionary that never rests, retries a failed read, and restores exactly |
| `test/file-names.test.ts` | Download names: padded, digits only, sorting in time order; no fixed name left in the page |
| `test/queue.test.ts` | Grouping by entry, labels in three languages, ranges, entry and "select all" selection, batch items, failure reasons, and a real queue approved whole by the database |
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
