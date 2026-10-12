# ligurian-keyboard

**Scrivi in ligure, in grafîa ofiçiâ, da qualsiasi tastiera.** Digiti `zeneize`, premi la barra spaziatrice e ottieni `zenéize`. Quando più grafie corrispondono agli stessi tasti, un piccolo menu ti lascia scegliere quella giusta, come nelle tastiere giapponesi.

Il progetto nasce per sostenere la rivitalizzazione della lingua ligure. Codice e dati sono aperti: chiunque voglia contribuire con parole, correzioni o codice è il benvenuto. Le associazioni genovesi interessate possono aprire una *issue* o scrivere al manutentore.

---

**Write Ligurian in grafîa ofiçiâ from any keyboard.** Type plain ASCII, `zeneize`, press space, get `zenéize`. When several spellings share the same keys, a small menu lets you pick, as Japanese input methods do.

The goal is Ligurian revitalization. Code and data are open; contributions are welcome.

## Status: 0.2, engine and database

| Part | Folder | State |
|---|---|---|
| Conversion engine [TypeScript] | `engine/` | working, 17 tests |
| Terminal demo | `engine/src/demo.ts` | working |
| Web editor [PWA] | `editor/` | planned |
| Lexicon manager for contributors and admins | `admin/` | planned |
| Dictionary database and roles [PostgreSQL / Supabase] | `db/` | working, 21 tests; not yet deployed |
| Export to TSV | `db/` [`export_lexicon_tsv()`] | working |
| Export to Keyman | `keyman/` | planned |

## What changed in 0.2.0

Version 0.2.0 adds the **dictionary database**: the shared place where the Ligurian lexicon will live, be reviewed and be exported. Full reference: [db/README.md](db/README.md). Every change:

**New folder `db/`**
* `db/migrations/0001_lexicon_schema.sql`: the tables.
  * `lemmas`: dictionary entries, with headword, variety, orthography, part of speech and a note.
  * `wordforms`: every spelling the keyboard may suggest, base and inflected.
  * `senses`: the numbered meanings of each lemma, with an optional definition **in Italian** [`definition_it`].
  * `glosses`: optional Italian, Spanish and English translations, each tied to **one** sense.
  * `varieties`, `orthographies` and `gloss_languages`: reference lists, so a misspelled code cannot be stored.
  * `profiles`: one per user, with the role.
  * `audit_log`: the change history.
  * Spelling check on every form: NFC, Ligurian letters plus `'` and `-`, at most 64 characters.
* `db/migrations/0002_rules_and_history.sql`: the rules, enforced inside the database.
  * Contributors' proposals always enter as `pending`.
  * Creating a lemma automatically creates its **base form**, which then follows the lemma's spelling and review status.
  * Senses are numbered 1, 2, 3 ... automatically.
  * Nothing can be attached to a deleted entry, and entries cannot be moved between parents.
  * Every row has a `version` number for optimistic locking.
  * No hard deletes: only soft deletion, by admins.
  * An append only history of every change.
  * Every new account gets a `member` profile, and the last admin cannot be demoted.
* `db/migrations/0003_access_and_export.sql`: who may see and change what.
  * Four roles: member, contributor, reviewer, admin, enforced by row level security.
  * Views `published_wordforms`, `published_dictionary` and `review_queue`.
  * `export_lexicon_tsv()`: the published lexicon in the exact format the engine reads.
* `db/test/`: 21 tests on an embedded PostgreSQL [PGlite]. No server is needed. One test loads the export into the engine, so database and engine are tested together.
* `db/README.md`: data model, roles, client rules and Supabase deployment, rewritten from a placeholder.

**New folder `docs/decisions/`**
* `docs/decisions/README.md`: index of every design decision, and the questions still open.
* 16 decision records, each with its context, the decision and its consequences:
  * `0001`: an input method, not a standalone editor.
  * `0002`: one dictionary database, not two dictionaries; homographs allowed.
  * `0003`: open data; MIT for code, CC BY-SA 4.0 for data.
  * `0004`: orthography and variety recorded for every entry; grafîa ofiçiâ by default.
  * `0005`: the ASCII key of every word is computed by `skeleton()`, never typed.
  * `0006`: every wordform entered by hand; no morphology generator yet.
  * `0007`: TypeScript, PostgreSQL on Supabase [Frankfurt], Keyman, web apps, PGlite for tests.
  * `0008`: the name `ligurian-keyboard`, on the maintainer's GitHub account.
  * `0009`: no copying of copyrighted dictionaries; permission first; frequencies from a free corpus.
  * `0010`: semantic versioning, annotated tags, changelog.
  * `0011`: roles member, contributor, reviewer, admin; review enforced in the database.
  * `0012`: no hard deletes; audit log; optimistic locking.
  * `0013`: numbered senses with optional Italian, Spanish and English translations.
  * `0014`: the base form is created automatically and follows its lemma.
  * `0015`: definitions in Italian for now; in Ligurian once the input method is mature.
  * `0016`: database first, then the lexicon manager.

**Changed files**
* `package.json`: version `0.2.0`. New dev dependency `@electric-sql/pglite`. New scripts `test:engine` and `test:db`; `test` now runs both.
* `package-lock.json`: updated by npm for PGlite.
* `tsconfig.json`: now also type checks `db/`.
* `docs/lexicon-format.md`: translations are now described as optional and per sense, in Italian, Spanish and English.
* `CONTRIBUTING.md`: rules for proposing meanings: definitions in Italian, translations per meaning.
* `README.md`: this section and the status table.
* `CHANGELOG.md`: the 0.2.0 entry.

**Unchanged:** the engine, its 17 tests, the demo and the fixture.

## Try it

Requires Node.js 22.18 or newer.

```
npm install
npm run check     # typecheck + all 38 tests
npm run demo      # type: A zena citae a penna
```

## How it works

1. Every stored spelling is folded to an ASCII **skeleton**: `çitæ` → `citae`. Rules: [docs/skeleton-spec.md](docs/skeleton-spec.md).
2. The typed word is folded the same way and looked up.
3. One match: replaced. Several: menu, most frequent first. None: kept as typed.

## Data

The real lexicon does not exist yet; `data/fixtures/test-lexicon.tsv` holds 93 forms copied from the Académia Ligùstica do Brénno alphabet page, for tests only. Format: [docs/lexicon-format.md](docs/lexicon-format.md).

## Licenses

* Code: MIT, see `LICENSE`.
* Lexicon data: CC BY-SA 4.0, see `data/LICENSE.md`.

## Design decisions

Every important design decision, with its reasons, is recorded in [docs/decisions/](docs/decisions/README.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
