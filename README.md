# ligurian-keyboard

**Scrivi in ligure, in grafîa ofiçiâ, da qualsiasi tastiera.** Digiti `zeneize`, premi la barra spaziatrice e ottieni `zenéize`. Quando più grafie corrispondono agli stessi tasti, un piccolo menu ti lascia scegliere quella giusta, come nelle tastiere giapponesi.

**Provalo subito:** <https://ignatz-castror.github.io/ligurian-keyboard/>

Il progetto nasce per sostenere la rivitalizzazione della lingua ligure. Codice e dati sono aperti: chiunque voglia contribuire con parole, correzioni o codice è il benvenuto. Le associazioni genovesi interessate possono aprire una *issue* o scrivere al manutentore.

La documentazione completa, qui sotto, è in inglese.

---

**Write Ligurian in grafîa ofiçiâ from any keyboard.** Type plain ASCII, `zeneize`, press space, get `zenéize`. When several spellings share the same keys, a small menu lets you pick, as Japanese input methods do.

**Try it now:** <https://ignatz-castror.github.io/ligurian-keyboard/>

The goal is Ligurian revitalization. Code and data are open; contributions are welcome.

## Contents

1. [What this project is](#what-this-project-is)
2. [Why it exists](#why-it-exists)
3. [How typing works](#how-typing-works)
4. [Spelling systems and varieties](#spelling-systems-and-varieties)
5. [The parts of the project](#the-parts-of-the-project)
6. [The shared dictionary](#the-shared-dictionary)
7. [The web editor](#the-web-editor)
8. [The lexicon manager](#the-lexicon-manager)
9. [Where the words come from](#where-the-words-come-from)
10. [Getting started](#getting-started)
11. [Repository layout](#repository-layout)
12. [Tests](#tests)
13. [Design decisions](#design-decisions)
14. [Open questions](#open-questions)
15. [Roadmap](#roadmap)
16. [What is new in each version](#what-is-new-in-each-version)
17. [Contributing](#contributing)
18. [Licenses](#licenses)
19. [Acknowledgements and independence](#acknowledgements-and-independence)

## What this project is

`ligurian-keyboard` is an **input method** for the Ligurian language. It lets anyone write correct Ligurian, in the official spelling, using the ordinary Italian, Spanish or English keyboard they already own, on a computer or a phone.

The person types each word the simple way, with no accents and no special letters. When they press the space bar, the word is replaced by its correct spelling:

| You type | You get |
|---|---|
| `zena` | `Zêna` |
| `citae` | `çitæ` |
| `zeneize` | `zenéize` |
| `canpanna` | `canpànn-a` |

When the same keys lead to more than one real word, a small numbered menu appears and the person picks the right one, exactly as the Japanese keyboard on Windows offers kanji for a word typed in Latin letters.

Behind the keyboard stands a **shared dictionary**: an online database where trusted contributors propose words and reviewers approve them. Only approved words reach the keyboard. The whole project is open: the code under the MIT license, the dictionary under CC BY-SA 4.0.

## Why it exists

### The problem

Ligurian is the regional language of Liguria, with Genoese [*zeneize*] as its best known variety, and it is also spoken in neighbouring communities such as Carloforte and Calasetta in Sardinia and in Monaco. Like many regional languages of Italy, its everyday use has been shrinking for generations.

People who still write Ligurian, in messages, on social networks, in emails, face a practical obstacle. The official spelling, the **grafîa ofiçiâ** published by the Académia Ligùstica do Brénno, uses letters that ordinary keyboards do not have or hide behind awkward shortcuts:

* vowels with circumflex, acute, grave and diaeresis accents: `â ê î ô û`, `é ó`, `à è ì ò ù`, `ä ë ï ö ü`;
* the ligature `æ`;
* the cedilla `ç`;
* the `nn-` convention for the velar n, as in `canpànn-a`.

Faced with this, most people give up on the official spelling. They write Ligurian with Italian spelling habits, each person differently, or they switch to Italian altogether. A written language without a shared, usable spelling is harder to read, harder to teach and harder to keep alive.

### The answer

Make the correct spelling **the easiest thing to type**. If typing `zena` produces `Zêna` with no extra effort, people have no reason to write anything else. A good input method turns the official spelling from an obstacle into a default.

The model is the Japanese input method: nobody in Japan types kanji directly; they type the sound in Latin letters and choose from a menu. The same idea works for Ligurian, with far fewer choices to make, because most words have only one correct spelling for their plain letters.

### What it is not

* **Not a new spelling.** The project follows the grafîa ofiçiâ as published; it does not invent or reform anything.
* **Not a separate text editor.** People write in WhatsApp, Facebook, Word and Gmail; the keyboard must work there [decision [0001](docs/decisions/0001-input-method-not-editor.md)]. The web editor is a demonstration and a tool for long texts until the keyboards exist.
* **Not a copy of existing dictionaries.** Every word is contributed freely and lawfully [see [Where the words come from](#where-the-words-come-from)].

## How typing works

### The skeleton

Every word in the dictionary has an ASCII **skeleton**: the plain letters a person types to reach it. The skeleton is computed, never typed by hand, by these rules [full specification: [docs/skeleton-spec.md](docs/skeleton-spec.md)]:

1. Normalize the word to Unicode NFC, then make it lowercase.
2. Remove every accent from the vowels: `à á â ä` become `a`, and so on for `e i o u`.
3. Turn `æ` into `ae` and `ç` into `c`; the Académia itself allows `ae` when `æ` is unavailable.
4. Turn typographic apostrophes `’ ‘ ʼ` into the plain `'`.
5. Drop hyphens, so `canpànn-a` is reached by typing `canpanna`.

The rules come from the Académia's own alphabet page, the *Arfabêto*.

### From key to word

When the person presses space, the engine computes the skeleton of what was typed and looks it up:

* **One match:** the word is replaced at once, with no question asked.
* **Several matches:** the menu opens, the most frequent word first. Collisions are expected; `penna` leads to both `pénna` and `pénn-a`, `e` to both `e` and `é`.
* **No match:** the word is left exactly as typed, so names, Italian words and anything unknown pass through untouched.

Two details make it feel natural:

* **Capitals are kept.** Typing `Zena` or `ZENA` gives `Zêna` or `ZÊNA`, and proper nouns keep their capital even when typed in lowercase.
* **Punctuation is kept.** Typing `"penna?` keeps the quote and the question mark around the converted word.

### Try it in the terminal

The repository includes a terminal demo that uses a test dictionary of 93 forms:

```
npm run demo
> A zena citae a penna
  penna -> 1:pénn-a  2:pénna  [Enter = 1]
A Zêna çitæ a pénn-a
```

`zena` and `citae` have one spelling each and are replaced silently; `penna` is ambiguous, so the menu asks. The [web editor](#the-web-editor) does the same in the browser, with the real dictionary.

## Spelling systems and varieties

Ligurian has no single spelling accepted by everyone, and it is several varieties, not only Genoese. The project does not take sides [decision [0004](docs/decisions/0004-orthography-and-variety-per-entry.md)]:

* **Every dictionary entry records its spelling system**:
  * `ofiçiâ`, the grafîa ofiçiâ of the Académia Ligùstica do Brénno, which is the **default**;
  * `unitäia`, the grafia unitäia used by part of the Ligurian press and publishers, reserved for later.
* **Every entry records its variety**:

  | Code | Variety |
  |---|---|
  | `zeneize` | Genoese [Genova], the default |
  | `savoneize` | Savonese [Savona] |
  | `spezzin` | Spezzino [La Spezia] |
  | `tabarchin` | Tabarchino [Carloforte and Calasetta] |
  | `monegasco` | Monegasque [Monaco] |

Both lists live in the database, so adding a variety or a spelling system is a single new row, and the keyboard can filter its suggestions by either.

## The parts of the project

```
  contributors and reviewers
            │  propose, review
            ▼
  ┌──────────────────────┐      ┌───────────────────────────┐
  │  lexicon manager     │─────▶│  shared dictionary        │
  │  admin/  [web page]  │◀─────│  db/  [PostgreSQL on      │
  └──────────────────────┘      │        Supabase]          │
                                └─────────────┬─────────────┘
                                              │ export of approved words
                                              ▼
                                ┌───────────────────────────┐
                                │  conversion engine        │
                                │  engine/  [TypeScript]    │
                                └─────┬───────────────┬─────┘
                                      ▼               ▼
                          keyboards for every    web editor
                          system  keyman/        editor/
```

| Part | Folder | What it does | State |
|---|---|---|---|
| Conversion engine | `engine/` | Computes skeletons, loads the word list, converts typed words, builds the menu | working, 17 tests |
| Terminal demo | `engine/src/demo.ts` | Try the engine from the command line | working |
| Shared dictionary | `db/` | Words, meanings, translations, roles, review, history | working and deployed, 27 tests |
| Export to TSV | `db/` [`export_lexicon_tsv()`] | Writes the approved words in the engine's format | working |
| Lexicon manager | `admin/` | Web page to search, propose and review words | working, 14 tests |
| Web editor | `editor/` | Web page where anyone types Ligurian with the engine and the published dictionary | working, 15 tests |
| Keyboards | `keyman/` | Keyboards for Windows, macOS, Linux, Android, iOS | planned |

**Technology** [decision [0007](docs/decisions/0007-technology-stack.md)]: TypeScript everywhere code must run in a browser or a keyboard, so the folding rules are written once; PostgreSQL hosted by Supabase in Frankfurt, the region closest to Genoa; Keyman, free software by SIL International, for the keyboards on every system.

## The shared dictionary

The dictionary is the heart of the project: every word the keyboard knows, and every meaning recorded, lives there. Full reference: [db/README.md](db/README.md).

### What an entry holds

```
pénna  [noun, zeneize, ofiçiâ]
├── forms:   pénna [base form, automatic], pénne
├── sense 1: definition "strumento per scrivere"
│              it: penna, stilografica   es: pluma   en: pen
└── sense 2: definition "piuma di uccello"
               it: piuma                 es: pluma   en: feather
```

* A **lemma** is a dictionary entry: its headword, part of speech, variety and spelling system.
* Its **forms** are every spelling the keyboard may suggest. The base form is created automatically from the headword; inflected forms such as plurals are added by hand, since there is no automatic inflection yet [decision [0006](docs/decisions/0006-wordforms-entered-by-hand.md)].
* Its **senses** are its numbered meanings, each with an optional definition written in Italian [decision [0015](docs/decisions/0015-definitions-in-italian.md)].
* Each sense may carry **translations** into Italian, Spanish and English, several per language when they are synonyms.

### Who may do what

| Role | Can |
|---|---|
| visitor, not signed in | read and search the approved dictionary |
| member | the same; every new account starts here |
| contributor | propose words, forms, senses and translations; they wait for review |
| reviewer | approve, reject and correct anything |
| admin | everything, plus delete, restore and assign roles |

### Rules that protect the data

* **Review is enforced by the database itself**, not by the web page, so no modified client can bypass it [decision [0011](docs/decisions/0011-roles-and-review-workflow.md)].
* **Nothing is ever erased.** Entries are only marked as deleted and can be restored; every change is written to an append only history [decision [0012](docs/decisions/0012-never-hard-delete.md)].
* **No lost edits.** If two reviewers change the same entry at once, the second is told and shown the new version instead of silently overwriting the first.
* **Only approved words are published**, and only published words reach the keyboard.

## The web editor

The web editor is where anyone can write Ligurian today, on a computer or a phone, with nothing to install: <https://ignatz-castror.github.io/ligurian-keyboard/>. Full reference: [editor/README.md](editor/README.md).

* **Type plain letters, press space,** and the word becomes grafîa ofiçiâ; a menu offers the spellings when there are several.
* **Keyboard or touch:** numbers, arrows, Enter and Escape on a computer; a bar of spellings above the keyboard on a phone.
* **Backspace right after a conversion undoes it.**
* **Filters** by variety and spelling system, `zeneize` and `ofiçiâ` by default.
* **Copy, download, clear;** the text stays in the browser and is never sent anywhere.
* **Works offline** after the first visit.

It reads a daily snapshot of the published dictionary, so a word approved today appears tomorrow [decision [0019](docs/decisions/0019-editor-dictionary-snapshot.md)]. On a phone, the text must still be copied into the app where it is going; typing directly into every app is the job of the keyboards.

## The lexicon manager

The lexicon manager is the web page where the team works on the dictionary. It is built and published automatically on GitHub Pages at <https://ignatz-castror.github.io/ligurian-keyboard/admin/>. Full reference: [admin/README.md](admin/README.md).

* **Search by plain ASCII**, the same way one types: `zena` finds `Zêna`, and an inflected form finds its lemma. Open to everyone.
* **Entry pages** with forms, senses, translations and, for reviewers, the full history of every change.
* **Proposals** with buttons for the special letters, and a warning when a similar word already exists.
* **A review queue**, oldest proposals first.
* **Roles and profiles**, managed by admins.
* **Download** of the approved dictionary in the engine's format.
* **Interface in Italian**, the contributors' language, with English available.

Accounts are created by an admin; ask a maintainer if you want to contribute words.

## Where the words come from

Good Ligurian dictionaries exist, but they are their authors' copyrighted work. The project does not copy them [decision [0009](docs/decisions/0009-data-sources.md)]:

* Contributors enter words **from their own knowledge**, or from sources whose license allows reuse.
* **Permission first:** the Académia Ligùstica do Brénno and A Compagna will be asked whether their word lists may seed the dictionary, in exchange for credit and editorial roles.
* **Word frequencies**, which order the menu, will be counted from a freely licensed body of text such as the Ligurian Wikipedia.

Today the real dictionary is just beginning. The file `data/fixtures/test-lexicon.tsv` holds 93 forms from the Académia's public alphabet page, used only by the tests and the demo.

## Getting started

### Requirements

* **Node.js 22.18 or newer**, which runs TypeScript files directly.
* **Git.**
* Only for the lexicon manager and for snapshots of a real dictionary: the address and publishable key of a Supabase project.

### Install and check

```
git clone https://github.com/Ignatz-CastroR/ligurian-keyboard.git
cd ligurian-keyboard
npm install
npm run check
```

`npm run check` type checks the whole project and runs all 73 tests. The database tests need no server: they run on PGlite, a real PostgreSQL compiled to WebAssembly, installed by `npm install`.

### Run the web editor locally

```
npm run lexicon:fixture
npm run editor:dev
```

This uses the 93-form test dictionary and needs no database. With a `.env` [below], `npm run lexicon:snapshot` fetches your real dictionary instead.

### Run the lexicon manager locally

1. Copy `.env.example` to `.env` and fill in your Supabase project's address and **publishable** key. Never put the secret key there.
2. Run `npm run admin:dev` and open the address it prints, usually <http://localhost:5173>.

### Set up your own database

[db/README.md](db/README.md), section "Deploying to Supabase", lists every step: running the four migrations in order, creating the first user and making it admin.

### Every command

| Command | What it does |
|---|---|
| `npm run check` | Type check, then every test |
| `npm test` | Every test |
| `npm run typecheck` | Type check only |
| `npm run test:engine` | Engine tests |
| `npm run test:db` | Database tests |
| `npm run test:admin` | Lexicon manager tests |
| `npm run test:editor` | Web editor tests |
| `npm run demo` | Terminal demo of the keyboard |
| `npm run admin:dev` | Lexicon manager on your computer, reloading on every change |
| `npm run admin:build` | Build the lexicon manager into `admin/dist/` |
| `npm run admin:preview` | Serve that build locally |
| `npm run lexicon:fixture` | Give the web editor the test dictionary |
| `npm run lexicon:snapshot` | Give the web editor a snapshot of the real dictionary [needs `.env`] |
| `npm run editor:dev` | Web editor on your computer, reloading on every change |
| `npm run editor:build` | Build the web editor into `editor/dist/` |
| `npm run site:build` | Build both and join them in `_site/`, as GitHub Pages serves them |
| `npm run site:preview` | Serve `_site/` locally |

Inside this repository, use `npm run typecheck` or `npx tsc`, never a globally installed `tsc`: the project pins its own TypeScript version.

## Repository layout

```
engine/                 the conversion engine
  src/skeleton.ts         ASCII folding
  src/lexicon.ts          loading and indexing the word list
  src/convert.ts          what happens when space is pressed
  src/demo.ts             terminal demo
  test/                   17 tests
db/                     the shared dictionary
  migrations/             0001 to 0004, run in order on Supabase
  test/                   27 tests on PGlite; the Supabase stand in is for tests only
  README.md               data model, roles, client rules, deployment
admin/                  the lexicon manager, published under /admin/
  src/                    TypeScript, one file per page under views/
  test/                   14 tests
  README.md               pages, accounts, publishing
editor/                 the web editor, the front page of the site
  src/ime.ts              the input method's decisions, pure functions
  src/main.ts             the page
  public/sw.js            offline copy
  test/                   15 tests
  README.md               use, snapshot, local runs
tools/                  build tools: dictionary snapshot, site assembly
docs/
  skeleton-spec.md        the folding rules and their sources
  lexicon-format.md       the word list exchange format
  decisions/              one record per design decision
data/
  fixtures/test-lexicon.tsv   93 forms for tests only
  LICENSE.md              CC BY-SA 4.0 for lexicon data
keyman/  export/         planned
.github/workflows/      tests, daily snapshot, build and publication of the site
```

## Tests

73 tests guard the project, and every one runs on every push to `main` before anything is published:

* **Engine [17]:** folding rules, idempotence, collisions, the menu order, casing, punctuation, filters, and the rejection of invalid rows.
* **Database [27]:** each rule is tested from the side of the person who must *not* be able to break it: a contributor trying to approve, a member trying to propose, anyone trying to erase. Six of them prove that the database's own folding equals the engine's, on every test word and every letter.
* **Lexicon manager [14]:** input checks, and a comparison of every button the page shows with what the real database actually accepts, for every role.
* **Web editor [15]:** finishing a word, replacing, the menu, choosing, undoing with Backspace, the filters, the refusal of a broken or empty dictionary snapshot, and the singular and plural of its messages.

## Design decisions

Every important decision is recorded in [docs/decisions/](docs/decisions/README.md) with its context, the decision and its consequences, so that nobody undoes it by accident or repeats the debate.

| N° | Decision |
|---|---|
| [0001](docs/decisions/0001-input-method-not-editor.md) | An input method, not a standalone editor |
| [0002](docs/decisions/0002-one-dictionary-database.md) | One dictionary database, not two; homographs allowed |
| [0003](docs/decisions/0003-open-data-and-licenses.md) | Open data; MIT for code, CC BY-SA 4.0 for data |
| [0004](docs/decisions/0004-orthography-and-variety-per-entry.md) | Spelling system and variety for every entry; grafîa ofiçiâ by default |
| [0005](docs/decisions/0005-ascii-skeleton-is-computed.md) | The ASCII key of every word is computed, never typed |
| [0006](docs/decisions/0006-wordforms-entered-by-hand.md) | Every form entered by hand; no inflection generator yet |
| [0007](docs/decisions/0007-technology-stack.md) | TypeScript, PostgreSQL on Supabase, Keyman, web apps |
| [0008](docs/decisions/0008-repository-name-and-home.md) | The name `ligurian-keyboard`, on the maintainer's GitHub account |
| [0009](docs/decisions/0009-data-sources.md) | No copying of copyrighted dictionaries; permission first |
| [0010](docs/decisions/0010-versioning-and-releases.md) | Semantic versioning, annotated tags, changelog |
| [0011](docs/decisions/0011-roles-and-review-workflow.md) | Roles and review enforced by the database |
| [0012](docs/decisions/0012-never-hard-delete.md) | No hard deletes; history; protection against lost edits |
| [0013](docs/decisions/0013-senses-and-optional-translations.md) | Numbered senses with optional translations |
| [0014](docs/decisions/0014-automatic-base-form.md) | The base form is created automatically and follows its lemma |
| [0015](docs/decisions/0015-definitions-in-italian.md) | Definitions in Italian now; in Ligurian once typing it is easy |
| [0016](docs/decisions/0016-database-first-then-interface.md) | Database first, then the lexicon manager |
| [0017](docs/decisions/0017-ascii-search-keys-in-the-database.md) | ASCII search keys stored in the database |
| [0018](docs/decisions/0018-lexicon-manager-design.md) | Design of the lexicon manager |
| [0019](docs/decisions/0019-editor-dictionary-snapshot.md) | The web editor reads a daily snapshot of the dictionary |
| [0020](docs/decisions/0020-web-editor-design.md) | Design of the web editor |

## Open questions

These need the judgment of native speakers, and contributions are especially welcome:

* **ç written as s.** The Arfabêto allows `ç` to be written as `s`. Should typing `se` also offer `çê`?
* **Grafia unitäia.** Which extra folding rules, if any, the second spelling system needs.
* **Definitions in Ligurian.** When the dictionary should start recording them.
* **Live updates** in the lexicon manager, so reviewers see each other's changes at once.

## Roadmap

1. **Now:** the first real words, entered by the first contributors, and the first texts written in the web editor.
2. **Keyboards** [`keyman/`]: the engine and the dictionary packaged for every operating system and phone.
3. **Real frequencies**, counted from a freely licensed body of text.
4. **Partnerships** with the Académia Ligùstica do Brénno and A Compagna.

## What is new in each version

Every change, file by file, is listed in [CHANGELOG.md](CHANGELOG.md).

* **0.4.0, 2026/10/17: the web editor.** The front page of the site: type plain letters and get grafîa ofiçiâ, with the candidate menu, undo, filters, copy and download, on computers and phones, offline after one visit. A daily snapshot of the dictionary; the lexicon manager moves to `/admin/`.
* **0.3.0, 2026/10/11: the lexicon manager.** The web page to search, propose and review words; search by plain ASCII through keys computed by the database; publication on GitHub Pages. The database is deployed on Supabase.
* **0.2.0, 2026/10/11: the shared dictionary.** The PostgreSQL database with lemmas, forms, numbered senses and translations; roles and review enforced by the database; history; export to the engine's format; the first design decision records.
* **0.1.0, 2026/10/10: the conversion engine.** ASCII folding based on the Académia's alphabet, the word list loader, conversion with the candidate menu, the terminal demo.

## Contributing

Words, corrections, translations, code and reviews from native speakers are all welcome, in English, Italian or Ligurian. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licenses

* **Code:** MIT, see [LICENSE](LICENSE).
* **Dictionary data:** CC BY-SA 4.0, see [data/LICENSE.md](data/LICENSE.md). Anyone may reuse the published dictionary, with credit, under the same license.

## Acknowledgements and independence

The spelling rules follow the *Arfabêto* published by the **Académia Ligùstica do Brénno** at <https://www.zeneize.net/grafia/arfabeto.htm>. The keyboards will be built on **Keyman**, by SIL International.

This is an independent project. It is not affiliated with, or endorsed by, the Académia Ligùstica do Brénno, A Compagna or any other organization.
