# db: the shared Ligurian dictionary

The source of truth for every word the keyboard knows and every meaning the dictionary records. Plain PostgreSQL, designed to run on [Supabase](https://supabase.com), which adds login and an HTTP API on top. Nothing here is Supabase specific except `auth.users` and `auth.uid()`, so the database can move to any PostgreSQL server.

## Layout

| File | Contents |
|---|---|
| `migrations/0001_lexicon_schema.sql` | Tables, reference data, the `ligurian_form` domain, indexes |
| `migrations/0002_rules_and_history.sql` | Triggers: role rules, automatic base form, sense numbering, versions, audit log, profiles |
| `migrations/0003_access_and_export.sql` | Privileges, row level security, views, TSV export |
| `migrations/0004_search_keys.sql` | ASCII search keys: `private.skeleton()` and the generated columns `headword_key`, `form_key` |
| `migrations/0005_letter_enye.sql` | The letter `ñ`: accepted in spellings, folded to `n` in the search keys [decision [0024](../docs/decisions/0024-letter-enye.md)] |
| `migrations/0006_public_ids_and_backups.sql` | Public identifiers such as `LIJ-7K3Q9MDXK` for lemmas and wordforms [decision [0030](../docs/decisions/0030-public-identifiers.md)]; `export_backup()` and `restore_backup()` [decision [0031](../docs/decisions/0031-backups.md)] |
| `migrations/0007_batch_review.sql` | `review_queue` gains each row's version, its lemma and its sense; `review_batch()` approves or rejects many queue rows in one call [decision [0033](../docs/decisions/0033-batch-review.md)] |
| `migrations/0008_backup_time_limit.sql` | A time limit of 60 seconds for `export_backup()` and `restore_backup()` through the API, above the 8 seconds Supabase gives signed-in users [decision [0031](../docs/decisions/0031-backups.md)] |
| `migrations/0009_dictionary_for_readers.sql` | The reading side of the dictionary: `dictionary_letters()`, `dictionary_index()`, `dictionary_search()` and `dictionary_entry()`, open to everyone, published rows only, running with their owner's rights so their indexes serve every caller; the `pg_trgm` extension and three indexes [decision [0034](../docs/decisions/0034-dictionary-for-readers.md)] |
| `migrations/0010_review_queue_pages.sql` | The review queue in pages: `review_queue_page()`, one row per entry with its position and the totals, and four partial indexes holding only pending rows; its cost grows with the pending rows, not with the dictionary [decision [0033](../docs/decisions/0033-batch-review.md)] |
| `templates/add-entries.sql` | For the SQL Editor: adds whole entries in the right shape, each sense with all its translations, each translation in its own language, credited to the person named in its first step, which is required; unknown or repeated keys refused; all or nothing |
| `templates/check-loaded-entries.sql` | For the SQL Editor, read only: measures entries loaded before the template [senses split one per translation, translations holding ";", translations by language, rows with no author] |
| `test/supabase-shim.sql` | **Tests only:** the parts of Supabase the migrations need |
| `test/harness.ts` | A fresh in-memory database per test; switching between users |
| `test/review-pages.test.ts` | 7 tests; 0010 runs after 0009; every caller gets the pending rows the view shows them and no parent they could not read themselves; entries oldest first, one API row each, page after page without gap or repeat; an entry of 61 rows still one row; position and totals right after others reviewed meanwhile; visitors refused; at the live dictionary's size, a page many times faster than the view |
| `test/templates.test.ts` | 6 tests; the templates run exactly as committed: entries written whole, credited, waiting in the queue, the helpers gone afterwards; the examples write nothing; fourteen wrong entries refused, each named with its place, nothing written; step 1 required, even in a reused session; approval only for a reviewer; the check measures a split load, agrees with the queue and changes nothing |
| `test/backup-time-limit.test.ts` | 3 tests; 0008 runs after 0007; `export_backup()` and `restore_backup()` gain a limit of 60 seconds and keep every other setting; the limit is the functions' own and leaves a session's limit unchanged |
| `test/batch-review.test.ts` | 16 tests; 0007 applied to a database with pending rows keeps the queue's original columns row for row; rows of a deleted lemma or sense leave the queue and a batch reports them; only pending rows are changed; a client token without a user is refused; a contributor sees their translation on another's sense under the right lemma; the queue carries each row's version, lemma and sense; a whole entry approved in one call, with one line of history per row; a part rejected first stays rejected; rows changed, missing or deleted since the queue was read, or refused by a rule, are reported while the rest go through; even an admin never changes a deleted row; a row named twice is changed once; only staff and the trusted backend may call it; a malformed request changes nothing |
| `test/dictionary.test.ts` | 10 tests; 0009 runs after 0008; the initials of the index; published rows only, for a visitor, a reviewer and a contributor alike; the index in pages by search key; the search folding accents and capitals, exact matches first, word starts too, one language or all; a query never a pattern, an empty one finding nothing; word starts after punctuation, short queries at the start only; a very long query cut, not refused; an entry by the code of its lemma or of a form; the functions run as their owner and their query plans use the indexes |
| `test/lexicon-db.test.ts` | 21 tests; each rule is tested from the side that must not break it |
| `test/public-ids-backup.test.ts` | 13 tests; every code valid, unique across both tables, out of every client's reach and never reused; the database and the manager compute the same check symbols; entries written before 0006 receive codes with a line of history; only admins back up and restore; a backup restored into a fresh database gives back an identical backup and export; a restore refuses a dictionary that is not empty or an incomplete file, works into the same project after its data was lost, and leaves nothing behind when it fails halfway; codes and the restore flag are out of every client's reach |
| `test/search-keys.test.ts` | 10 tests; the SQL folding agrees with the engine's on every fixture form and on every letter the database accepts, read from the database itself; the engine loads a word holding any of those letters; `ñ` is accepted and found by typing `n`; invalid spellings are refused |

Every design decision behind this database is recorded in [docs/decisions/](../docs/decisions/README.md).

Run the tests with `npm run test:db`. No server and no PostgreSQL installation are needed: they use [PGlite](https://pglite.dev), a real PostgreSQL compiled to WebAssembly and installed by `npm install`.

## Data model

```
lemmas  1 ──< wordforms     every spelled form: the automatic base form + inflected forms
        1 ──< senses        numbered meanings: 1, 2, 3 ...
                  1 ──< glosses    optional translations of ONE sense: it, es, en
profiles:  one per user, holds the role
audit_log: one row per insert, update, soft delete or restore
```

Example, a lemma with two meanings:

```
pénna [noun, zeneize, ofiçiâ]
├── wordforms: pénna [base, automatic], pénne
├── sense 1: definition_it "strumento per scrivere"
│     it: penna, stilografica   es: pluma   en: pen
└── sense 2: definition_it "piuma di uccello"
      it: piuma                 es: pluma   en: feather
```

### Tables

| Table | One row per | Key columns |
|---|---|---|
| `varieties` | Ligurian variety | `code` [`zeneize`, `savoneize`, `spezzin`, `tabarchin`, `monegasco`], `name` |
| `orthographies` | Spelling system | `code` [`ofiçiâ`, `unitäia`], `name` |
| `gloss_languages` | Translation language | `code` [`it`, `es`, `en`], `name` |
| `profiles` | User | `user_id`, `display_name`, `role` |
| `lemmas` | Dictionary entry | `public_id`, `headword`, `headword_key`, `variety`, `orthography`, `part_of_speech`, `note` |
| `wordforms` | Spelling the keyboard may suggest | `public_id`, `lemma_id`, `form`, `form_key`, `is_base`, `grammatical_tag`, `freq` |
| `senses` | Meaning of a lemma | `lemma_id`, `sense_number`, `definition_it` [optional, in Italian] |
| `glosses` | Translation of a sense | `sense_id`, `language`, `gloss` |
| `audit_log` | Change | `table_name`, `row_id`, `action`, `actor`, `at`, `old_row`, `new_row` |

Every lexicon table [`lemmas`, `wordforms`, `senses`, `glosses`] also has `status` [`pending`, `approved`, `rejected`], `version`, `created_by`, `created_at`, `updated_at` and `deleted_at`.

### Rules of the model

* **Variety and orthography** belong to the lemma; its wordforms, senses and glosses inherit them. Grafîa ofiçiâ and `zeneize` are the defaults. [decision [0004](../docs/decisions/0004-orthography-and-variety-per-entry.md)]
* **Homographs are allowed:** `pénna` as noun and `pénna` as verb are two lemmas. The export lists the spelling once, with the higher frequency. [decision [0002](../docs/decisions/0002-one-dictionary-database.md)]
* **Spelling:** every headword and form must be NFC, use only Ligurian letters plus `'` and `-`, and be at most 64 characters. It must also be unique per lemma among live rows.
* **The base form is automatic.** Creating a lemma creates a wordform spelled like its headword, marked `is_base = true`, with the same status. It **follows its lemma**:
  * Approving or rejecting the lemma approves or rejects it.
  * Correcting the headword corrects it.
  * Nobody may change its spelling, status or deletion directly; edit the lemma instead.
  * Its frequency and grammatical tag stay editable.

  [decision [0014](../docs/decisions/0014-automatic-base-form.md)]
* **Extra forms** [inflections such as `pénne`] are added by hand and need their **own** approval; the lexicon manager approves them together with their lemma when a reviewer approves the whole entry [decision [0033](../docs/decisions/0033-batch-review.md)]. There is no morphology generator yet. [decision [0006](../docs/decisions/0006-wordforms-entered-by-hand.md)]
* **Senses** are numbered 1, 2, 3 ... per lemma automatically when no number is given. A sense may have a definition, or none. A lemma may have no senses at all: it is then a spelling only entry, still suggested by the keyboard. [decision [0013](../docs/decisions/0013-senses-and-optional-translations.md)]
* **Definitions are written in Italian** [`definition_it`]. Typing correct Ligurian is still too hard for most editors, which is the very problem this project exists to solve. Definitions in Ligurian [`definition_lij`, a column to add later] are planned for when the input method is mature. [decision [0015](../docs/decisions/0015-definitions-in-italian.md)]
* **Translations are optional.** A sense may have none, one, or several per language when they are synonyms of that same meaning [`penna`, `stilografica`]. A new language is one row in `gloss_languages`, with no schema change. [decision [0013](../docs/decisions/0013-senses-and-optional-translations.md)]
* **Search keys are computed.** `headword_key` and `form_key` hold the ASCII skeleton of the spelling [`Zêna` → `zena`], generated by the database with `private.skeleton()`, a copy of the engine's folding kept identical by a test. Clients cannot write them. [decision [0017](../docs/decisions/0017-ascii-search-keys-in-the-database.md)]
* **Public identifiers.** Every lemma and every wordform carries a code such as `LIJ-7K3Q9MDXK`: `LIJ-`, eight characters of Crockford's base 32 and a check symbol that catches a mistyped character or two swapped neighbours. The database draws it at random when the row is inserted, keeps it forever, never gives it to two entries and never reuses it, even for a deleted entry; `private.issued_public_ids` remembers every code ever issued. Senses and glosses have none. [decision [0030](../docs/decisions/0030-public-identifiers.md)]
* **Entries never move.** A wordform or sense stays on its lemma, a gloss on its sense; to move one, delete it and create it again.
* **No children for deleted parents.** Nothing can be added to a deleted lemma or a deleted sense.

## Roles

| Role | Reads | Proposes | Approves and corrects | Soft deletes, restores | Changes roles |
|---|---|---|---|---|---|
| anonymous | published | | | | |
| member | published + own | | | | |
| contributor | published + own | yes, always `pending` | own pending rows only, never the status | | |
| reviewer | everything | yes | yes | | |
| admin | everything | yes | yes | yes | yes |

* The roles and the review workflow: [decision [0011](../docs/decisions/0011-roles-and-review-workflow.md)].
* Every new account starts as **member**. An admin promotes trusted people. Nobody can promote themselves, and the last admin cannot be demoted.
* **Published** means approved, not deleted, and belonging to a published parent: wordforms and senses to a published lemma, glosses to a published sense. Published data is public by design [CC BY-SA 4.0; decision [0003](../docs/decisions/0003-open-data-and-licenses.md)].
* Rules are enforced twice: row level security decides *which rows* a user may touch, and triggers decide *what* may change in them. A buggy or malicious client cannot bypass either.
* A session with **no user id** is a trusted backend [service role, SQL Editor]. It is exempt from the role rules, but **not** from the integrity rules: no hard deletes, no editing the base form directly, no changing history. Keep the service role key secret.

## Rules every client must follow

* **Never delete.** [decision [0012](../docs/decisions/0012-never-hard-delete.md)] Hard deletes are refused for everyone. Admins set `deleted_at = now()`; setting it back to `null` restores.
* **Optimistic locking.** Read a row's `version`, then update with `... where id = $1 and version = $2`. Zero affected rows means someone else changed it first: reload and show the user the new state. The database bumps `version` itself.
* `id`, `public_id`, `created_by`, `created_at`, `updated_at`, `version`, `is_base` and the parent id are owned by the database; values sent for them are overwritten. `headword_key` and `form_key` are generated columns: sending a value for them is an error.
* The lexicon manager [`admin/`] is the reference client: every query it sends is in `admin/src/db.ts`.

## Views and functions

| Name | Who may read it | Contents |
|---|---|---|
| `published_wordforms` | everyone | What the keyboard may suggest: form, variety, orthography, frequency |
| `published_dictionary` | everyone | One row per published translation: headword, sense number, Italian definition, language, gloss. A sense without translations appears once, with empty language and gloss |
| `review_queue_page(after_created, after_lemma, entries)` | signed-in users | The next entries of the queue, 50 by default and at most 200, oldest first: one row per entry, with `group_created` [the time of its oldest pending row, which with `lemma_id` names the next page], `entry_number`, the totals of entries and rows, and the entry's pending rows as JSON. One row per entry, so no cap on API rows can cut an entry. Each caller gets the pending rows `review_queue` shows them; a lemma or sense above them only when they could read it themselves. Paging is by key: while others review, an entry approved in part may come again further on |
| `review_queue` | signed-in users | Slow on a large dictionary, since row level security checks every row: the lexicon manager reads the two functions above since 0.12.1. Pending lemmas, extra forms, senses and glosses, oldest first. Base forms are left out, as they are approved with their lemma. Non-staff see only their own rows. Since 0007, each row also carries its `version`, its lemma's headword, status and public code, and, for senses and glosses, the sense's id, number and Italian definition and the gloss's language and text, so a client can group the queue by entry; and a row whose lemma or sense is deleted is left out |
| `review_batch(items, status)` | reviewers, admins; the SQL Editor | Approves or rejects up to 500 queue rows, each given as `{"kind", "id", "version"}`. Each row is changed on its own, at the given version, and only while it is pending and neither it nor its lemma or sense is deleted; the result lists every row not changed, with its reason: `conflict` [changed since it was read], `notfound` [missing, deleted, or under a deleted parent] or `error` with its SQLSTATE [no longer pending, or a rule refused it]. Every other row is still changed [decision [0033](../docs/decisions/0033-batch-review.md)] |
| `dictionary_letters()` | everyone | Every initial of the index with published entries, and how many: accented vowels under their base letter, `æ` and `ç` apart, `ñ` under `n`, anything else under `#` |
| `dictionary_index(initial, after_key, after_id, limit)` | everyone | The published entries of one initial, by `headword_key` then id, at most 200 per page, each with its published senses and translations as JSON; the next page starts after the last entry received |
| `dictionary_search(query, language, limit)` | everyone | Published translations that equal the query, begin with it, or, from three characters on, have a later word that begins with it [rank 0, 1, 2], compared without accents, diacritics, capitals or punctuation; one language or all; the query cut at 100 characters and never treated as a pattern; at most 200 rows, in two steps that each stop at the limit |
| `dictionary_entry(code)` | everyone | One published entry, by the code of its lemma or of one of its forms, as JSON: lemma, published forms, published senses and translations; null otherwise |
| `export_lexicon_tsv()` | everyone | The published wordforms in exactly the format of `docs/lexicon-format.md`, sorted for stable diffs |
| `export_backup()` | admins; the SQL Editor | The whole dictionary as one JSON document: reference lists, profiles, every lexicon row and the whole history [decision [0031](../docs/decisions/0031-backups.md)] |
| `restore_backup(backup)` | admins; the SQL Editor | Loads such a document into a dictionary with no entries and no history, exactly as backed up, and reports what it loaded |

## Deploying to Supabase

Why PostgreSQL, Supabase and the Frankfurt region: [decision [0007](../docs/decisions/0007-technology-stack.md)].

1. Create a project at supabase.com [free plan], region **Central EU [Frankfurt]**, the closest to Genoa. Save the database password in a password manager.
2. In **SQL Editor**, open a new query, paste `migrations/0001_lexicon_schema.sql` and press **Run**. Repeat with `0002` to `0010`, in order. **Never** run `test/supabase-shim.sql` there.
   * Supabase warns about "destructive operations" for files that merely mention `delete` or `drop`, as `0002` does to forbid deletion. On a new, empty project it is safe to confirm.
   * `0005` also gets the warning, because it drops the letter check of `ligurian_form` and adds the wider one back in the same run; no data is touched. It is safe to confirm on the live database too.
   * `0006` gives every existing lemma and wordform its public identifier: one ordinary update each, which raises its version by one and writes a line of history. If Supabase warns about it, it is safe to confirm. Run it **before** pushing the code of 0.10.0, whose lexicon manager reads the new column.
   * `0007` changes no data: it replaces the `review_queue` view with one that has more columns, and adds `review_batch()`. Run it **before** pushing the code of 0.11.0, whose lexicon manager reads those columns and calls that function.
   * `0008` changes no data: it gives the backup and restore functions a time limit of 60 seconds. It can be run before or after pushing 0.11.1.
   * `0009` changes no data: it installs `pg_trgm` if it is missing, adds the dictionary's four functions and builds three indexes, which on a large dictionary may take a few seconds. Run it **before** pushing the code of 0.12.0, whose dictionary page calls those functions.
   * `0010` changes no data: it adds the queue's two functions and four small indexes. Run it **before** pushing the code of 0.12.1, whose review page calls those functions.
   * Each migration runs **once**. Later migrations are run alone, in order, on a database that already has the earlier ones.
3. In **Authentication → Users**, create your own user with your email and a password.
4. Make yourself the first admin, in the SQL Editor:

   ```sql
   update public.profiles set role = 'admin'
   where user_id = (select id from auth.users where email = 'YOUR_EMAIL');
   ```

5. Check it: `select role from public.profiles;` must return `admin`.
   * Also check that no table is left open: this must return no rows.

     ```sql
     select c.relname from pg_class as c
     join pg_namespace as n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
     ```
6. Keep the project URL and the publishable key in a local `.env` file, copied from `.env.example`; `.gitignore` excludes `.env`. The secret key belongs nowhere in this repository.
7. Start the lexicon manager: [admin/README.md](../admin/README.md).

## Backups and restore

Design: [decision 0031](../docs/decisions/0031-backups.md).

**Backing up.** Sign in to the lexicon manager as an admin, open the people page [your name in the header] and press **Download a backup**. The browser saves one JSON file, such as `ligurian-backup-20261018-085840.json`. Keep the files somewhere other than Supabase, and never publish them: unlike the dictionary, they hold every pending and deleted row, the whole history and the profiles. Without the manager, `select public.export_backup();` in the SQL Editor returns the same document.

**What is not in a backup:** the login accounts, which live in Supabase's own `auth` schema.

**Restoring, after the project is lost:**

1. Create a new project and run every migration, as in steps 1 and 2 above.
2. Create your own user and make yourself admin, as in steps 3 and 4. Point the site at the new project [`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the repository variables and in `.env`].
3. In the lexicon manager, on the people page, choose the backup file under **Restore from a backup** and press **Restore**. The manager checks the file first; the database checks it again and refuses unless the dictionary has no entries and no history at all.
4. Read the report: rows restored per table, profiles skipped, and entries whose author has no account yet, saved without an author. History keeps every author's id.
5. Create the other people's accounts and give them back their roles on the people page, using the names and roles the backup lists under `profiles`. A new project gives every account a new id, so no profile and no author can be matched automatically; entries arrive without an author, and the history keeps each author's old id, which the backup maps to a name.

Every id, public code, version, date and line of history comes back exactly as it was, and new entries continue after the highest id. The same steps restore into the same project after its data was lost, from step 3; there, profiles and authors are matched to the existing accounts, and nobody who is an admin already loses that role.

**Adding entries by SQL.** Paste `templates/add-entries.sql` into the SQL Editor, put in its first step the user id of the person whose words these are [required], add one line per entry in step 3 after the examples, which are comments, and run it. Each entry is a JSON object: headword, part of speech, forms, and senses, each sense with ALL its translations as lists by language, `{"it": ["penna", "stilografica"], "es": ["pluma"], "en": ["pen"]}`. Two translations are two items, never one text with ";". The whole run is one transaction: a refused entry stops it, writes nothing, and names the headword. `templates/check-loaded-entries.sql` measures, without changing anything, what earlier loads left behind.

**Large backups.** Supabase stops every statement made through its API after 8 seconds for signed-in users, and 60 seconds is the most a function or the Dashboard may be given [migration 0008 gives `export_backup()` and `restore_backup()` that minute]. Since 0.11.2 the lexicon manager no longer calls `export_backup()`: it assembles the same file from small reads, a thousand rows at most each, so its backup button has no time limit to meet. The limits still apply to the two functions themselves, to a restore, and to anything run in the SQL Editor:

1. **Up to a minute,** the SQL Editor: `select public.export_backup();` gives the document, and `select public.restore_backup($backup$ ... $backup$::jsonb);`, with the file's content between the two markers, restores it.
2. **Beyond a minute,** `psql` from your computer, PostgreSQL's command line client, over the **Session pooler** connection string from the project's **Connect** button. A session there may lift its own limit:

   ```bash
   psql "<session pooler connection string>" -At -v ON_ERROR_STOP=1 \
     -c "set statement_timeout = 0" \
     -c "select public.export_backup()" > ligurian-backup-$(date +%Y%m%d-%H%M%S).json
   ```

   Each `-c` runs in the same session, one after the other. The connection is the trusted backend, so the backup is allowed; type the database password when asked and never write it into a file. Check that the file starts with `{"format": "ligurian-keyboard-backup"` before relying on it.

A restore remains one statement: a backup too large to restore in a minute through the manager must be restored through `psql`, which is a known issue.
