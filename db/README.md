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
| `test/supabase-shim.sql` | **Tests only:** the parts of Supabase the migrations need |
| `test/harness.ts` | A fresh in-memory database per test; switching between users |
| `test/lexicon-db.test.ts` | 21 tests; each rule is tested from the side that must not break it |
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
| `lemmas` | Dictionary entry | `headword`, `headword_key`, `variety`, `orthography`, `part_of_speech`, `note` |
| `wordforms` | Spelling the keyboard may suggest | `lemma_id`, `form`, `form_key`, `is_base`, `grammatical_tag`, `freq` |
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
* **Extra forms** [inflections such as `pénne`] are added by hand and need their **own** approval. There is no morphology generator yet. [decision [0006](../docs/decisions/0006-wordforms-entered-by-hand.md)]
* **Senses** are numbered 1, 2, 3 ... per lemma automatically when no number is given. A sense may have a definition, or none. A lemma may have no senses at all: it is then a spelling only entry, still suggested by the keyboard. [decision [0013](../docs/decisions/0013-senses-and-optional-translations.md)]
* **Definitions are written in Italian** [`definition_it`]. Typing correct Ligurian is still too hard for most editors, which is the very problem this project exists to solve. Definitions in Ligurian [`definition_lij`, a column to add later] are planned for when the input method is mature. [decision [0015](../docs/decisions/0015-definitions-in-italian.md)]
* **Translations are optional.** A sense may have none, one, or several per language when they are synonyms of that same meaning [`penna`, `stilografica`]. A new language is one row in `gloss_languages`, with no schema change. [decision [0013](../docs/decisions/0013-senses-and-optional-translations.md)]
* **Search keys are computed.** `headword_key` and `form_key` hold the ASCII skeleton of the spelling [`Zêna` → `zena`], generated by the database with `private.skeleton()`, a copy of the engine's folding kept identical by a test. Clients cannot write them. [decision [0017](../docs/decisions/0017-ascii-search-keys-in-the-database.md)]
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
* `id`, `created_by`, `created_at`, `updated_at`, `version`, `is_base` and the parent id are owned by the database; values sent for them are overwritten. `headword_key` and `form_key` are generated columns: sending a value for them is an error.
* The lexicon manager [`admin/`] is the reference client: every query it sends is in `admin/src/db.ts`.

## Views and functions

| Name | Who may read it | Contents |
|---|---|---|
| `published_wordforms` | everyone | What the keyboard may suggest: form, variety, orthography, frequency |
| `published_dictionary` | everyone | One row per published translation: headword, sense number, Italian definition, language, gloss. A sense without translations appears once, with empty language and gloss |
| `review_queue` | signed-in users | Pending lemmas, extra forms, senses and glosses, oldest first. Base forms are left out, as they are approved with their lemma. Non-staff see only their own rows |
| `export_lexicon_tsv()` | everyone | The published wordforms in exactly the format of `docs/lexicon-format.md`, sorted for stable diffs |

## Deploying to Supabase

Why PostgreSQL, Supabase and the Frankfurt region: [decision [0007](../docs/decisions/0007-technology-stack.md)].

1. Create a project at supabase.com [free plan], region **Central EU [Frankfurt]**, the closest to Genoa. Save the database password in a password manager.
2. In **SQL Editor**, open a new query, paste `migrations/0001_lexicon_schema.sql` and press **Run**. Repeat with `0002`, `0003`, `0004` and `0005`, in that order. **Never** run `test/supabase-shim.sql` there.
   * Supabase warns about "destructive operations" for files that merely mention `delete` or `drop`, as `0002` does to forbid deletion. On a new, empty project it is safe to confirm.
   * `0005` also gets the warning, because it drops the letter check of `ligurian_form` and adds the wider one back in the same run; no data is touched. It is safe to confirm on the live database too.
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
