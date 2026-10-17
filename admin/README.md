# admin: the lexicon manager

A web page where people search the shared Ligurian dictionary, propose words, review proposals and manage the team. Plain TypeScript, built with [Vite](https://vite.dev), talking directly to the Supabase database. Design: decisions [0018](../docs/decisions/0018-lexicon-manager-design.md) and [0023](../docs/decisions/0023-lexicon-manager-spanish-history-csv.md).

The interface is in **Italian**, the default, **English** and **Spanish**; the menu in the header switches between them and the choice is remembered in the browser.

## Who can do what

| Person | Can |
|---|---|
| Anyone, signed out | Search the published dictionary, see the latest additions, and download the dictionary as TSV or CSV |
| member | The same, plus edit their own display name and see their own proposals |
| contributor | Propose lemmas, forms, senses and translations; edit their own pending proposals |
| reviewer | Approve, reject and correct anything; see the review queue, the list of people and the history of every entry |
| admin | Everything a reviewer can, plus delete, restore, rename people and change roles |

The database enforces all of this [db/README.md](../db/README.md); the page only hides the buttons that would fail.

## Pages

| Address | Page |
|---|---|
| `#/search/<query>` | Search by ASCII key: typing `zena` finds `Zêna`, typing `penne` finds the lemma `pénna` through its form. While the field is empty, the 20 approved lemmas added most recently are listed below it |
| `#/entry/<id>` | One entry: lemma, forms, numbered senses with translations, history |
| `#/new` | Propose a new lemma; lemmas with the same ASCII key are shown while typing, to avoid duplicates |
| `#/review` | Everything pending, oldest first |
| `#/users` | Own profile; for staff, the list of people and their roles |
| `#/signin` | Sign in |

## Downloads

Both buttons in the header download the published dictionary, from the same export:

* **TSV:** the engine's own format [`docs/lexicon-format.md`], with comment lines stating the license.
* **CSV:** the same rows for spreadsheets, RFC 4180: comma separated, CRLF line endings, a UTF-8 byte order mark so that Excel shows the Ligurian letters correctly. Excel set to Italian or Spanish expects semicolons: open the file through **Data → From Text/CSV** instead of a double click, or use LibreOffice, Google Sheets or Numbers.

Every field for a Ligurian spelling has buttons for the special letters `à â ä è é ê ë ì î ï ò ó ô ö ù û ü æ ç`, then `ñ`, which some other Ligurian spelling systems write [decision [0024](../docs/decisions/0024-letter-enye.md)]; hold Shift for the upper case letter. A word with `ñ` is entered under its own spelling system, not `ofiçiâ`.

## Files

| File | Contents |
|---|---|
| `index.html` | The page shell |
| `src/main.ts` | Start up, session, header, routing |
| `src/db.ts` | Every database query; optimistic locking; error translation |
| `src/permissions.ts` | Which buttons to show to whom |
| `src/forms.ts` | Input checks and formatting; pure functions |
| `src/export.ts` | TSV to CSV conversion; pure functions |
| `src/messages.ts` | Every text, in Italian, English and Spanish; the language menu's entries |
| `src/ui.ts` | Page building helpers; never `innerHTML` |
| `src/types.ts` | Row types, mirroring the database |
| `src/views/*.ts` | One file per page |
| `src/style.css` | Light and dark look |
| `test/forms.test.ts` | Input checks, including agreement with the database's letter list |
| `test/permissions.test.ts` | Every button rule checked against the real database rules |
| `test/export.test.ts` | The CSV conversion, against RFC 4180 and in a round trip |
| `test/messages.test.ts` | The three languages: no empty text, no lost placeholder, no untranslated copy |
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
3. Push to `main`. The workflow `.github/workflows/pages.yml` runs every test, takes a snapshot of the dictionary, builds the web editor and the manager, and publishes them together: the editor at `https://<user>.github.io/ligurian-keyboard/`, the manager at `https://<user>.github.io/ligurian-keyboard/admin/` [since 0.4.0; until then the manager was at the root].
4. In Supabase → **Authentication → URL Configuration**, set the **Site URL** to the manager's address, ending in `/admin/`, and add it to the **Redirect URLs**.

When the manager runs locally [`npm run admin:dev`], its "Scrivi" link leads nowhere useful: the editor is a separate local server [`npm run editor:dev`, see [editor/README.md](../editor/README.md)].
