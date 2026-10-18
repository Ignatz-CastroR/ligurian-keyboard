# admin: the lexicon manager

A web page where people search the shared Ligurian dictionary, propose words, review proposals and manage the team. Plain TypeScript, built with [Vite](https://vite.dev), talking directly to the Supabase database. Design: decisions [0018](../docs/decisions/0018-lexicon-manager-design.md), [0023](../docs/decisions/0023-lexicon-manager-spanish-history-csv.md), [0030](../docs/decisions/0030-public-identifiers.md) and [0031](../docs/decisions/0031-backups.md).

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

| Address | Page |
|---|---|
| `#/search/<query>` | Search by ASCII key: typing `zena` finds `Zêna`, typing `penne` finds the lemma `pénna` through its form. A public code such as `LIJ-7K3Q9MDXK` finds its lemma, or the lemma of its form. While the field is empty, the 20 approved lemmas added most recently are listed below it |
| `#/entry/<id>` | One entry: lemma, forms, numbered senses with translations, history; the public code of the lemma and of every form |
| `#/new` | Propose a new lemma; lemmas with the same ASCII key are shown while typing, to avoid duplicates |
| `#/review` | Everything pending, oldest first |
| `#/users` | Own profile; for staff, the list of people and their roles; for admins, backups and restore |
| `#/signin` | Sign in |

## Downloads

Both buttons in the header download the published dictionary, from the same export:

* **TSV:** the engine's own format [`docs/lexicon-format.md`], with comment lines stating the license.
* **CSV:** the same rows for spreadsheets, separated by **semicolons**, as Excel set to Italian or Spanish expects, so a double click opens the file in columns; otherwise RFC 4180: fields quoted only when they hold a semicolon, a double quote, a line break or surrounding spaces, CRLF line endings, and a UTF-8 byte order mark so that Excel shows the Ligurian letters correctly [decision [0025](../docs/decisions/0025-csv-semicolon.md)]. Excel set to English expects commas: open the file there through **Data → From Text/CSV**; LibreOffice asks for the separator when it opens the file, and Google Sheets detects it when importing.

Every field for a Ligurian spelling has buttons for the special letters `à â ä è é ê ë ì î ï ò ó ô ö ù û ü æ ç`, then `ñ`, which some other Ligurian spelling systems write [decision [0024](../docs/decisions/0024-letter-enye.md)]; hold Shift for the upper case letter. A word with `ñ` is entered under its own spelling system, not `ofiçiâ`: whenever a form with `ñ` would be saved under `ofiçiâ`, a warning appears under the form, and saving asks for confirmation first [decision [0028](../docs/decisions/0028-enye-warning-under-oficia.md)]. Changing a lemma's spelling system to `ofiçiâ` checks its inflected forms too.

Elided particles such as `d'`, `l'` and `quell'` are entries of their own. A form that joins a particle and a word, such as `d'ægua`, raises a warning that names its parts, and saving asks for confirmation: the editor and the keyboard split such words by themselves, so the dictionary needs `d'` and `ægua` once each [decision [0029](../docs/decisions/0029-elision.md)].

The header links to the web editor and to the Android keyboard page, `/tastiera/`.

## Public codes

Every lemma and every form shows its **public code**, such as `LIJ-7K3Q9MDXK`, given by the database and never changed [decision [0030](../docs/decisions/0030-public-identifiers.md)]. To find an entry by its code, type the code into the search field; lower case, spaces and hyphens anywhere, `O` for `0` and `I` or `L` for `1` are all accepted. A code whose last character, the check symbol, does not match the others is reported as a typing mistake, never taken for another entry. Each line of an entry's history shows the code of the row it concerns; lines written before 0.10.0 have none.

## Backups

On the people page, admins find two more cards [decision [0031](../docs/decisions/0031-backups.md)]:

* **Download a backup:** the whole dictionary as one JSON file, named by date and time, such as `ligurian-backup-20261018-085840.json`. It holds every row, pending and deleted ones included, the whole history and every profile [name and role; no email and no password]: keep it private and away from Supabase.
* **Restore from a backup:** only into a newly created dictionary with no entries and no history; the database refuses anything else. The file is checked before it is sent, and the page reports what was restored. The full procedure is in [db/README.md](../db/README.md).

The **frequency** of a form is a weight, 1 by default. The daily snapshot adds to it the number of times the Ligurian Wikipedia uses the form [decision [0027](../docs/decisions/0027-real-frequencies.md)], so there is usually no need to change it; raise it only to put a form ahead of what the corpus says. The TSV and CSV downloads show the stored value.

## Files

| File | Contents |
|---|---|
| `index.html` | The page shell |
| `src/main.ts` | Start up, session, header, routing |
| `src/db.ts` | Every database query; optimistic locking; error translation |
| `src/permissions.ts` | Which buttons to show to whom |
| `src/forms.ts` | Input checks and formatting; pure functions |
| `src/export.ts` | TSV to CSV conversion; pure functions |
| `src/public-id.ts` | Public codes: Crockford's base 32, the check symbol, reading a typed code; pure functions |
| `src/backup.ts` | Backup file names, the check of a file before a restore, summaries of counts; pure functions |
| `src/messages.ts` | Every text, in Italian, English and Spanish; the language menu's entries |
| `src/ui.ts` | Page building helpers; never `innerHTML` |
| `src/types.ts` | Row types, mirroring the database |
| `src/views/*.ts` | One file per page |
| `src/style.css` | Light and dark look |
| `test/forms.test.ts` | Input checks, including agreement with the database's letter list |
| `test/permissions.test.ts` | Every button rule checked against the real database rules |
| `test/export.test.ts` | The CSV conversion, against RFC 4180 with semicolons, and in a round trip |
| `test/messages.test.ts` | The three languages: no empty text, no lost placeholder, no untranslated copy; the example code in the search hint is valid |
| `test/public-id.test.ts` | Public codes: both directions of base 32, the check symbol catching every single wrong character and every swap of neighbours, and the forgiving reading of a typed code |
| `test/backup.test.ts` | Backup file names, summaries, every reason a wrong file is refused, and a real backup written by the database passing the check |
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
2. Give them the email and password through a private channel; they sign in and set their display name under **Profile**.
3. In the manager, **Users**, an admin changes their role to `contributor` or `reviewer`.

## Publishing on GitHub Pages

1. GitHub repository → **Settings → Secrets and variables → Actions → Variables** tab → **New repository variable**, twice:
   * `SUPABASE_URL`: the Project URL
   * `SUPABASE_PUBLISHABLE_KEY`: the publishable key

   Use **Variables**, not Secrets: both values are public by design, and variables stay readable for checking.
2. **Settings → Pages → Build and deployment → Source:** GitHub Actions.
3. Push to `main`. The workflow `.github/workflows/pages.yml` runs every test, takes a snapshot of the dictionary, builds the Keyman packages, the web editor and the manager, and publishes them together, with the Android install page and the packages under `/tastiera/`: the editor at `https://<user>.github.io/ligurian-keyboard/`, the manager at `https://<user>.github.io/ligurian-keyboard/admin/` [since 0.4.0; until then the manager was at the root].
4. In Supabase → **Authentication → URL Configuration**, set the **Site URL** to the manager's address, ending in `/admin/`, and add it to the **Redirect URLs**.

When the manager runs locally [`npm run admin:dev`], its "Scrivi" link leads nowhere useful: the editor is a separate local server [`npm run editor:dev`, see [editor/README.md](../editor/README.md)].
