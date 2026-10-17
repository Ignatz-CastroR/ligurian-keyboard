# ligurian-keyboard

**Write Ligurian in grafîa ofiçiâ from any keyboard.** Type plain letters, `zeneize`, and get the official spelling, `zenéize`. When several spellings share the same letters, you choose, as with the Japanese keyboards.

**Scrivi in ligure, in grafîa ofiçiâ, da qualsiasi tastiera.** Il riassunto completo in italiano è alla fine di questa pagina: [Riassunto in italiano](#riassunto-in-italiano).

## Use it now

| What | Where | Install needed |
|---|---|---|
| **Web editor**: write Ligurian in the browser, on a computer or a phone | <https://ignatz-castror.github.io/ligurian-keyboard/> | nothing |
| **Android keyboard**: write Ligurian in every app | install page: <https://ignatz-castror.github.io/ligurian-keyboard/tastiera/> | the free Keyman app, then two packages |
| **Dictionary**: search the approved words | <https://ignatz-castror.github.io/ligurian-keyboard/admin/> | nothing |
| **Source code** of every version | <https://github.com/Ignatz-CastroR/ligurian-keyboard/releases> | Node.js, to build it |

See [Downloads and versions](#downloads-and-versions) for exactly what can be downloaded, and which version to choose.

---

## Contents

1. [What this project is](#what-this-project-is)
2. [Why it exists](#why-it-exists)
3. [Downloads and versions](#downloads-and-versions)
4. [How the input method works](#how-the-input-method-works)
5. [Spelling systems and varieties](#spelling-systems-and-varieties)
6. [The parts of the project](#the-parts-of-the-project)
7. [The shared dictionary](#the-shared-dictionary)
8. [How a word travels from the dictionary to your screen](#how-a-word-travels-from-the-dictionary-to-your-screen)
9. [The web editor](#the-web-editor)
10. [The Android keyboard](#the-android-keyboard)
11. [The lexicon manager](#the-lexicon-manager)
12. [Where the words come from](#where-the-words-come-from)
13. [Privacy](#privacy)
14. [Getting started as a developer](#getting-started-as-a-developer)
15. [Repository layout](#repository-layout)
16. [Tests](#tests)
17. [Automation](#automation)
18. [Design decisions](#design-decisions)
19. [Open questions](#open-questions)
20. [Roadmap and the road to 1.0.0](#roadmap-and-the-road-to-100)
21. [What is new in each version](#what-is-new-in-each-version)
22. [Contributing](#contributing)
23. [Licenses](#licenses)
24. [Acknowledgements and independence](#acknowledgements-and-independence)
25. [Riassunto in italiano](#riassunto-in-italiano)

---

## What this project is

`ligurian-keyboard` is an **input method** for the Ligurian language. It lets anyone write correct Ligurian, in the official spelling, using the ordinary Italian, Spanish or English keyboard they already own.

The person types each word the simple way, with no accents and no special letters, and gets the correct spelling:

| You type | You get |
|---|---|
| `zena` | `Zêna` |
| `citae` | `çitæ` |
| `zeneize` | `zenéize` |
| `canpanna` | `canpànn-a` |

When the same letters lead to more than one real word, the person picks the right one from a short list, exactly as the Japanese keyboard on Windows offers kanji for a word typed in Latin letters.

The project has four parts, all open source:

* a **conversion engine** that knows how plain letters map to official spellings;
* a **shared dictionary**, an online database where trusted contributors propose words and reviewers approve them;
* a **web editor**, where anyone can write Ligurian in a browser with nothing to install;
* an **Android keyboard**, built on Keyman, which offers the official spellings in every app.

Only approved words reach the editor and the keyboard. The code is under the MIT license, the dictionary under CC BY-SA 4.0.

## Why it exists

### The problem

Ligurian is the regional language of Liguria, with Genoese [*zeneize*] as its best known variety. It is also spoken in neighbouring communities such as Carloforte and Calasetta in Sardinia and in Monaco. Like many regional languages of Italy, its everyday use has been shrinking for generations.

People who still write Ligurian, in messages, on social networks, in emails, face a practical obstacle. The official spelling, the **grafîa ofiçiâ** published by the Académia Ligùstica do Brénno, uses letters that ordinary keyboards do not have or hide behind awkward shortcuts:

* vowels with circumflex, acute, grave and diaeresis accents: `â ê î ô û`, `é ó`, `à è ì ò ù`, `ä ë ï ö ü`;
* the ligature `æ`;
* the cedilla `ç`;
* the `nn-` convention for the velar n, as in `canpànn-a`.

Faced with this, most people give up on the official spelling. They write Ligurian with Italian spelling habits, each person differently, or they switch to Italian altogether. A written language without a shared, usable spelling is harder to read, harder to teach and harder to keep alive.

### The answer

Make the correct spelling **the easiest thing to type**. If typing `zena` produces `Zêna` with no extra effort, people have no reason to write anything else. A good input method turns the official spelling from an obstacle into a default.

The model is the Japanese input method: nobody in Japan types kanji directly; they type the sound in Latin letters and choose from a list. The same idea works for Ligurian, with far fewer choices to make, because most words have only one correct spelling for their plain letters.

### What it is not

* **Not a new spelling.** The project follows the grafîa ofiçiâ as published; it does not invent or reform anything.
* **Not a replacement for the apps people use.** People write in WhatsApp, Facebook, Word and Gmail; the keyboard must work there [decision [0001](docs/decisions/0001-input-method-not-editor.md)]. The web editor is a demonstration, a tool for long texts, and the solution for computers.
* **Not a copy of existing dictionaries.** Every word is contributed freely and lawfully [see [Where the words come from](#where-the-words-come-from)].

## Downloads and versions

### What a visitor can download

| Item | Link | What it is | Updated |
|---|---|---|---|
| Keyboard package | <https://ignatz-castror.github.io/ligurian-keyboard/tastiera/ligurian_keyboard.kmp> | The Keyman keyboard: layout and long press letters | with every new version |
| Dictionary package | <https://ignatz-castror.github.io/ligurian-keyboard/tastiera/ignatzcastror.lij.ligurian_keyboard.model.kmp> | The suggestions: every approved word | every day |
| Install page | <https://ignatz-castror.github.io/ligurian-keyboard/tastiera/> | Both packages, their versions, step by step instructions in Italian, English and Spanish | every day |
| Word list, live | the lexicon manager's "Download TSV" and "Download CSV" buttons | The approved dictionary as TSV, the engine's format, or as CSV for spreadsheets; CC BY-SA 4.0 | live |
| Word list, daily | <https://ignatz-castror.github.io/ligurian-keyboard/lexicon.tsv> | The snapshot the editor and the keyboard are built from, with its date in the first line | every day |
| Your own text | the web editor's download button | What you wrote, as a `.txt` file | live |
| Source code | <https://github.com/Ignatz-CastroR/ligurian-keyboard/releases> | Every version, as `.zip` and `.tar.gz`; from 0.5.0 on, each release also carries both Keyman packages | per version |

The web editor itself needs no download: it opens in any modern browser and, after the first visit, keeps working without a connection.

### Which version to choose

* **Everyone: use the site.** The web editor and the install page always serve the newest working version, and the dictionary package there is rebuilt every day with the words approved so far.
* **A fixed version:** each entry on the [Releases page](https://github.com/Ignatz-CastroR/ligurian-keyboard/releases) carries its source code and, from 0.5.0 on, its two Keyman packages. The dictionary inside a release is the one of the day that release was published.
* **There is no stable release yet.** Until 1.0.0 every version is published as a **pre-release**, as semantic versioning prescribes for 0.x versions: anything may still change. GitHub's "latest release" link ignores pre-releases, so always use the Releases page itself. What 1.0.0 requires is listed in [Roadmap and the road to 1.0.0](#roadmap-and-the-road-to-100).

### Requirements

| Item | Needs |
|---|---|
| Web editor | any recent browser: Chrome, Firefox, Safari, Edge, on a computer or a phone |
| Android keyboard | Android with the free [Keyman](https://keyman.com/android/) app, version 17 or newer; Keyman 18 is current |
| iPhone and iPad | Keyman exists, but the keyboard is not tested there yet |
| Windows, macOS, Linux | use the web editor: Keyman offers no suggestions on desktop computers [decision [0021](docs/decisions/0021-keyman-scope-and-toolchain.md)] |

## How the input method works

### The skeleton

Every word in the dictionary has an ASCII **skeleton**: the plain letters a person types to reach it. The skeleton is computed, never typed by hand, by these rules [full specification: [docs/skeleton-spec.md](docs/skeleton-spec.md)]:

1. Normalize the word to Unicode NFC, then make it lowercase.
2. Remove every accent from the vowels: `à á â ä` become `a`, and so on for `e i o u`.
3. Turn `æ` into `ae` and `ç` into `c`; the Académia itself allows `ae` when `æ` is unavailable. Turn `ñ`, which some other Ligurian spelling systems write, into `n`.
4. Turn typographic apostrophes `’ ‘ ʼ` into the plain `'`.
5. Drop hyphens, so `canpànn-a` is reached by typing `canpanna`.

The rules come from the Académia's own alphabet page, the *Arfabêto*. The skeleton is the single idea behind everything else: the dictionary stores words by their skeleton, and whatever the person types is folded the same way before it is looked up.

The same folding exists in three places, and tests prove they never disagree:

| Copy | Used by | Proven equal by |
|---|---|---|
| `engine/src/skeleton.ts` | the web editor, the terminal demo, all tools | the reference |
| `private.skeleton()` in the database | search in the lexicon manager | `db/test/search-keys.test.ts` |
| `searchTermToKey` in the Keyman dictionary | the Android keyboard | `keyman/test/build.test.ts` |

### In the web editor: replace on space

The web editor uses the engine directly, in the browser.

1. **A word is finished** when a space or a new line appears right after it. The editor reads the text after every change [the browser's `input` event], not individual key presses, because phone keyboards do not report which key was pressed. While a phone keyboard is still composing a word, nothing happens; pasted text is never converted.
2. **The finished word is folded** to its skeleton and looked up in the dictionary, filtered by the chosen variety and spelling system [`zeneize` and `ofiçiâ` by default].
3. **One match:** the word is replaced at once. **Several matches:** a menu opens, most frequent first; choose with `1` to `9`, the arrows and Enter, or a tap; Escape, or the menu's last entry, keeps the word as typed. **No match:** the word stays exactly as typed, so names, Italian words and anything unknown pass through untouched.
4. **Typing on with the menu open** accepts the highlighted spelling. **Backspace right after a conversion** undoes it and restores what was typed.

Two details make it feel natural:

* **Capitals are kept.** Typing `Zena` or `ZENA` gives `Zêna` or `ZÊNA`; proper nouns keep their capital even when typed in lowercase.
* **Punctuation is kept.** Typing `"penna?` keeps the quote and the question mark around the converted word.

### In the Android keyboard: suggestions

On Android the project does not replace Android's keyboard system; it runs inside **Keyman**, a free keyboard app by SIL Global that hosts keyboards for thousands of languages. The work is shared:

1. **The keyboard package** draws the keys. Every key types exactly the letter shown; a long press on a vowel, on `c` or on `n` gives every Ligurian letter. A capital comes by itself at the start of a sentence.
2. **Keyman's predictive text** watches the word being typed. For every letter, it folds the word with our `searchTermToKey`, the keyboard's copy of the skeleton, and searches **the dictionary package**, an index of every approved word built from its skeleton. Keyman also tolerates small typing mistakes.
3. **The best matches appear in the suggestion bar** above the keys, in the casing the person is typing: `penna` offers `pénna` and `pénn-a`; `Penna`, at the start of a sentence, offers `Pénna`.
4. **Tapping a suggestion** puts it in the text, followed by a space. In Keyman 18 a suggestion is applied when tapped; Keyman 19, in beta in October 2026, can also apply a very likely suggestion by itself when space is pressed.

The difference from the editor is deliberate: the editor decides on space, Keyman suggests while typing. Both reach the same words, because both fold with the same rules and read the same dictionary.

### Try it in the terminal

The repository includes a terminal demo that uses a test dictionary of 93 forms:

```
npm run demo
> A zena citae a penna
  penna -> 1:pénn-a  2:pénna  [Enter = 1]
A Zêna çitæ a pénn-a
```

`zena` and `citae` have one spelling each and are replaced silently; `penna` is ambiguous, so the menu asks.

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

Both lists live in the database, so adding a variety or a spelling system is a single new row. The web editor filters by both. The Android dictionary holds the `zeneize` words in `ofiçiâ` today; other varieties will get their own dictionaries when they have words [decision [0022](docs/decisions/0022-keyman-keyboard-design.md)].

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
                                              │ daily snapshot of
                                              │ the approved words
                                              ▼
                                ┌───────────────────────────┐
                                │  conversion engine        │
                                │  engine/  [TypeScript]    │
                                └─────┬───────────────┬─────┘
                                      ▼               ▼
                          Android keyboard       web editor
                          keyman/                editor/
```

| Part | Folder | What it does | State |
|---|---|---|---|
| Conversion engine | `engine/` | Computes skeletons, loads the word list, converts typed words, builds the menu | working, 17 tests |
| Word counts | `corpus/` | Counts the words of the Ligurian Wikipedia, so the most used spelling comes first | working, 15 tests |
| Terminal demo | `engine/src/demo.ts` | Try the engine from the command line | working |
| Shared dictionary | `db/` | Words, meanings, translations, roles, review, history | working and deployed, 31 tests |
| Export | `db/` [`export_lexicon_tsv()`] | Writes the approved words in the engine's format | working |
| Lexicon manager | `admin/` | Web page to search, propose and review words, in Italian, English and Spanish | working, 28 tests |
| Web editor | `editor/` | Web page where anyone types Ligurian with the engine and the published dictionary, in Italian, English and Spanish | working, 17 tests |
| Android keyboard | `keyman/` | Keyman keyboard and dictionary for Android phones and tablets, rebuilt daily | working, 30 tests; to be tested on real phones |
| Other exports | `export/` | Further formats of the dictionary | planned |

**Technology** [decision [0007](docs/decisions/0007-technology-stack.md)]: TypeScript everywhere code must run in a browser or a keyboard, so the folding rules are written once; PostgreSQL hosted by Supabase in Frankfurt, the region closest to Genoa; Keyman, free software by SIL Global, for the phone keyboard; GitHub Pages for the site; GitHub Actions for tests, builds and publication.

## The shared dictionary

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

Only **forms** reach the editor and the keyboard; senses and translations serve the people who read the dictionary.

### Who may do what

| Role | Can |
|---|---|
| visitor, not signed in | read and search the approved dictionary |
| member | the same; every new account starts here |
| contributor | propose words, forms, senses and translations; they wait for review |
| reviewer | approve, reject and correct anything |
| admin | everything, plus delete, restore and assign roles |

Accounts are created by an admin; there is no self sign up.

### Rules that protect the data

* **Review is enforced by the database itself**, not by the web page, so no modified client can bypass it [decision [0011](docs/decisions/0011-roles-and-review-workflow.md)].
* **Nothing is ever erased.** Entries are only marked as deleted and can be restored; every change is written to an append only history [decision [0012](docs/decisions/0012-never-hard-delete.md)].
* **No lost edits.** If two reviewers change the same entry at once, the second is told and shown the new version instead of silently overwriting the first.
* **Only approved words are published**, and only published words reach the editor and the keyboard.

## How a word travels from the dictionary to your screen

1. A contributor **proposes** a word in the lexicon manager; it is stored as `pending`. Its base form and its search key are computed by the database at once.
2. A reviewer **approves** it. From that moment it is **published**: visible to every visitor in the lexicon manager and included in the export.
3. **The site is rebuilt**: every day at 03:17 UTC [21:17 in Costa Rica; 04:17 or 05:17 in Genoa, depending on daylight saving], on every change to the code, or by hand from GitHub's Actions page. The build takes a **snapshot** of the export, `export_lexicon_tsv()`.
4. **The snapshot is ranked:** each word written in grafîa ofiçiâ receives the number of times the Ligurian Wikipedia uses it, added to its frequency in the dictionary [`data/frequencies/lijwiki.tsv`; decision [0027](docs/decisions/0027-real-frequencies.md)].
5. **The snapshot is checked** with the engine's own loader. If any row is invalid, or no approved word exists, or the frequency list is damaged, the build stops and the site keeps its previous version: a broken dictionary is never published.
6. **The web editor** receives the whole snapshot, every variety and spelling system.
7. **The Android dictionary package** is rebuilt from the same snapshot: its approved `zeneize` forms in `ofiçiâ`, indexed by skeleton, versioned by the snapshot's date, for example `2026.10.17`.
8. People see the new word **the next time they open the editor**, or **after they install the new dictionary package**. Keyman does not update a package downloaded from a website by itself; installing it again replaces it.

So a word approved today reaches everyone within a day, and at once if a maintainer runs the site workflow by hand.

## The web editor

<https://ignatz-castror.github.io/ligurian-keyboard/> · full reference: [editor/README.md](editor/README.md) · design: decisions [0019](docs/decisions/0019-editor-dictionary-snapshot.md) and [0020](docs/decisions/0020-web-editor-design.md)

* **Type plain letters, press space,** and the word becomes grafîa ofiçiâ; a menu offers the spellings when there are several.
* **Keyboard or touch:** numbers, arrows, Enter and Escape on a computer; a bar of spellings above the keyboard on a phone.
* **Backspace right after a conversion undoes it;** Ctrl+Z works too.
* **Filters** by variety and spelling system, `zeneize` and `ofiçiâ` by default, remembered in the browser.
* **Copy, download as `.txt`, clear;** the text is kept in the browser between visits and never sent anywhere.
* **Works offline** after the first visit.
* **Interface in Italian, English and Spanish,** chosen from a menu in the header and shared with the lexicon manager.

On a phone, the text must be copied into the app where it is going; typing directly into every app is the job of the Android keyboard.

## The Android keyboard

Install page: <https://ignatz-castror.github.io/ligurian-keyboard/tastiera/> · full reference: [keyman/README.md](keyman/README.md) · design: decisions [0021](docs/decisions/0021-keyman-scope-and-toolchain.md) and [0022](docs/decisions/0022-keyman-keyboard-design.md)

### Installing it

1. Install the free **Keyman** app by SIL Global: <https://keyman.com/android/>.
2. Download both packages from the install page: the keyboard, `ligurian_keyboard.kmp`, and the dictionary, `ignatzcastror.lij.ligurian_keyboard.model.kmp`.
3. In Keyman: menu, **Settings**, **Install Keyboard or Dictionary**, **Install from local file**; choose the keyboard package and tap **Install**. Repeat with the dictionary package.
4. To use it in every app: in Keyman, menu, **Get Started**, **Enable Keyman as system-wide keyboard**. Then switch keyboards in any app with the keyboard icon.

Keyman pairs the two packages through their language code, `lij`, the ISO 639-3 code for Ligurian.

### Using it

* **Type plain letters**; the suggestion bar offers the word in grafîa ofiçiâ. Tap it.
* **Long press** for any Ligurian letter, in a fixed order: grave, acute, circumflex, diaeresis.

  | Key | Long press |
  |---|---|
  | `a` | à á â ä æ |
  | `e` | è é ê ë |
  | `i` | ì í î ï |
  | `o` | ò ó ô ö |
  | `u` | ù ú û ü |
  | `c` | ç |
  | `n` | ñ |

  These are exactly the letters the skeleton folds; a test keeps the two lists identical. A dot on a key shows that it has a long press.
* **An apostrophe key** sits on the main layer, next to the space bar, because Ligurian elides constantly: `l'`, `d'`, `ch'`.
* **Capitals** come by themselves at the start of the text and after `. ! ? …` and a space. One tap on Shift gives one capital; a double tap locks capitals.
* **Numbers and symbols** on the `123` layer, including `€ « »` and typographic quotes.
* **New words:** install the dictionary package again from the install page; its version is its date.

### Known limits

* **Not yet tested by native speakers on their phones.** Reports are welcome.
* **Typing `æ` with the long press** probably gives weaker suggestions than typing `ae`: Keyman's correction search compares one typed character at a time, and `æ` stands for two. Typing `ae` always works.
* **Elided forms** such as `l'ægua` count as one word, in the editor and in the keyboard alike; they get a suggestion only if the dictionary holds them as written.
* **iPhone and iPad** are not tested yet; **desktop computers** get no suggestions from Keyman.

## The lexicon manager

<https://ignatz-castror.github.io/ligurian-keyboard/admin/> · full reference: [admin/README.md](admin/README.md) · design: decisions [0018](docs/decisions/0018-lexicon-manager-design.md) and [0023](docs/decisions/0023-lexicon-manager-spanish-history-csv.md)

* **Search by plain letters**, the same way one types: `zena` finds `Zêna`, and an inflected form finds its lemma. Open to everyone.
* **Latest additions:** while the search field is empty, the 20 approved entries added most recently are listed below it, newest first, with the date and time each was added.
* **Entry pages** with forms, senses, translations and, for reviewers, the full history of every change.
* **Proposals** with buttons for the special letters, `ñ` included, and a warning when a lemma with the same skeleton already exists.
* **A review queue**, oldest proposals first.
* **Roles and profiles**, managed by admins.
* **Downloads** of the approved dictionary: **TSV**, the engine's format, and **CSV** for spreadsheets [separated by semicolons, as Excel set to Italian or Spanish expects, so a double click opens it in columns; with a byte order mark so that Excel shows the Ligurian letters; with Excel set to English, open it through Data, From Text/CSV].
* **Interface in Italian**, the contributors' language, **English** and **Spanish**, chosen from a menu in the header.

## Where the words come from

Good Ligurian dictionaries exist, but they are their authors' copyrighted work. The project does not copy them [decision [0009](docs/decisions/0009-data-sources.md)]:

* Contributors enter words **from their own knowledge**, or from sources whose license allows reuse.
* **Permission first:** the Académia Ligùstica do Brénno and A Compagna will be asked whether their word lists may seed the dictionary, in exchange for credit and editorial roles.
* **Word frequencies**, which order the menu and the suggestions, are counted from the **Ligurian Wikipedia**, which writes mostly in grafîa ofiçiâ and whose text is under CC BY-SA 4.0 [decision [0027](docs/decisions/0027-real-frequencies.md)]. A maintainer runs the workflow "Frequencies from the Ligurian Wikipedia" a few times a year; it downloads Wikimedia's latest dump, checks it, counts every word of every article and offers the list as a file to download, which the maintainer reviews and commits as `data/frequencies/lijwiki.tsv`. When the site is built, each word in grafîa ofiçiâ gets its count added to the frequency stored in the dictionary, so a word the corpus never uses keeps its stored weight and a reviewer can still raise a word by hand. The list in use since 0.8.2 counts the dump of 2026/10/01: 83,575 distinct words, each seen at least twice, about 2.2 million occurrences in all.

The real dictionary is just beginning. The file `data/fixtures/test-lexicon.tsv` holds 93 forms from the Académia's public alphabet page, used only by the tests and the demo.

## Privacy

* **The web editor** never sends your text anywhere. It is kept only in your own browser, and the dictionary is a file downloaded from the site; the editor has no connection to the database.
* **The Android keyboard** runs inside Keyman; the project adds no network access of its own. Keyman's own policy: <https://help.keyman.com/products/android/18.0/about/privacy>.
* **The lexicon manager** stores only what contributors enter, the e-mail address of their account and their role.
* **Builds** never send data to Keyman's error reporting service: the compiler always runs with `--no-error-reporting`.

## Getting started as a developer

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

`npm run check` type checks the whole project and runs all 142 tests. The database tests need no server: they run on PGlite, a real PostgreSQL compiled to WebAssembly. The Keyman tests run Keyman's own compiler, `kmc`, installed by `npm install`.

Inside this repository, use `npm run typecheck` or `npx tsc`, never a globally installed `tsc`: the project pins its own TypeScript version.

### Run the web editor locally

```
npm run lexicon:fixture
npm run editor:dev
```

This uses the 93-form test dictionary and needs no database. With a `.env` [below], `npm run lexicon:snapshot` fetches the real dictionary instead.

### Build the Android packages locally

```
npm run lexicon:fixture
npm run keyman:build
```

Both packages appear in `keyman/dist/`. Copy them to an Android phone and install them as above. `keyman/README.md` lists what to check on the phone.

### Run the lexicon manager locally

1. Copy `.env.example` to `.env` and fill in your Supabase project's address and **publishable** key. Never put the secret key there.
2. Run `npm run admin:dev` and open the address it prints, usually <http://localhost:5173>.

### Set up your own database

[db/README.md](db/README.md), section "Deploying to Supabase", lists every step: running the five migrations in order, creating the first user and making it admin.

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
| `npm run test:keyman` | Android keyboard tests |
| `npm run test:corpus` | Word counting tests |
| `npm run test:docs` | Decision record tests |
| `npm run demo` | Terminal demo of the input method |
| `npm run admin:dev` | Lexicon manager on your computer, reloading on every change |
| `npm run admin:build` | Build the lexicon manager into `admin/dist/` |
| `npm run admin:preview` | Serve that build locally |
| `npm run lexicon:fixture` | Use the test dictionary as the snapshot |
| `npm run lexicon:snapshot` | Take a snapshot of the real dictionary, ranked by the frequency list when one is committed [needs `.env`] |
| `npm run frequencies:count -- --source "..." <dump.xml>` | Count the words of an uncompressed Wikipedia dump into `data/frequencies/lijwiki.tsv` |
| `npm run editor:dev` | Web editor on your computer, reloading on every change |
| `npm run editor:build` | Build the web editor into `editor/dist/` |
| `npm run keyman:build` | Build the Android keyboard and dictionary packages into `keyman/dist/` from the snapshot |
| `npm run keyman:layout` | Rewrite the keyboard's layout file from `keyman/src/touch-layout.ts` |
| `npm run site:build` | Build everything and join it in `_site/`, as GitHub Pages serves it |
| `npm run site:preview` | Serve `_site/` locally |

## Repository layout

```
engine/                 the conversion engine
  src/skeleton.ts         ASCII folding
  src/lexicon.ts          loading and indexing the word list
  src/convert.ts          what happens when a word is finished
  src/demo.ts             terminal demo
  test/                   17 tests
db/                     the shared dictionary
  migrations/             0001 to 0005, run in order on Supabase
  test/                   31 tests on PGlite; the Supabase stand in is for tests only
  README.md               data model, roles, client rules, deployment
admin/                  the lexicon manager, published under /admin/
  src/                    TypeScript, one file per page under views/
  test/                   28 tests
  README.md               pages, accounts, downloads, publishing
editor/                 the web editor, the front page of the site
  src/ime.ts              the input method's decisions, pure functions
  src/main.ts             the page
  public/sw.js            offline copy
  public/tastiera/        the Android install page
  test/                   17 tests
  README.md               use, snapshot, local runs
keyman/                 the Android keyboard and its dictionary
  ligurian_keyboard/      Keyman keyboard project
  ignatzcastror.lij.ligurian_keyboard/   Keyman dictionary project
  src/                    layout, word list, build
  test/                   30 tests
  README.md               build, rules for changes, testing on a phone
corpus/                 counting the words of the Ligurian Wikipedia
  src/                    words, the choice of the dump, the dump and its markup, the frequency list
  test/                   15 tests
  README.md               how a count is made and committed
tools/                  dictionary snapshot, word counts, Keyman packages, site assembly
docs/
  skeleton-spec.md        the folding rules, their sources and their copies
  lexicon-format.md       the word list exchange format
  decisions/              one record per design decision
  test/                   4 tests: the decision tables follow the records
data/
  fixtures/test-lexicon.tsv   93 forms for tests only
  frequencies/            word counts from the Ligurian Wikipedia
  LICENSE.md              CC BY-SA 4.0 for lexicon data
export/                 further dictionary formats, planned
.github/workflows/      tests, daily site build, Keyman packages for releases, word counts
```

## Tests

142 tests guard the project, and every one runs on every push to `main` before anything is published:

* **Engine [17]:** folding rules, idempotence, collisions, the menu order, casing, punctuation, filters, and the rejection of invalid rows.
* **Database [31]:** each rule is tested from the side of the person who must *not* be able to break it: a contributor trying to approve, a member trying to propose, anyone trying to erase. Ten of them guard the search keys: the database's own folding equals the engine's on every test word and on every letter the database accepts, a list read from the database itself; the engine loads a word holding any of those letters; and `ñ` is accepted and found by typing `n`.
* **Lexicon manager [28]:** input checks, with a letter list identical to the real database's; the warning before `ñ` is saved under grafîa ofiçiâ, compared with the database's own spelling system codes; a comparison of every button the page shows with what the real database actually accepts, for every role; the CSV conversion against RFC 4180 with semicolons, with a round trip; and the three languages, with no empty text, lost placeholder or untranslated copy.
* **Web editor [17]:** finishing a word, replacing, the menu, choosing, undoing with Backspace, the filters, the refusal of a broken or empty dictionary snapshot, and the singular and plural of its messages; its three languages, the same as the manager's, with Spanish really translated.
* **Android keyboard [30]:** a real build with Keyman's compiler; the compiled dictionary loaded and inspected, proving that its search keys equal the engine's on every character up to U+02FF, every test word in four forms and 5,000 pseudo-random strings whose coverage is itself tested; exactly the Ligurian letters on the layout, in both cases; rows of equal width by Keyman's own arithmetic; the layer rules; the contents of both packages; the refusal of a bad snapshot or a failing compiler, keeping earlier packages; error reporting always off.
* **Word counts [15]:** the choice of the dump from Wikimedia's own status files, refusing unfinished, unsigned or unreadable runs and any address but Wikimedia's; what a word is, in capitals, with elision and with foreign letters; markup stripped from written-for-the-test wikitext, unclosed markup included; the dump read in pieces cut anywhere, articles only; the frequency list written, read back, and refused line by line when damaged; and, end to end, the corpus deciding which spelling of `penna` the editor offers first.
* **Decision records [4]:** numbered without gaps; both tables, in `docs/decisions/README.md` and here, name every record exactly as its own title does; and every "Refines" or "Supersedes" is answered by the record it points to.

## Automation

| Workflow | When | What |
|---|---|---|
| **Site on GitHub Pages** [`pages.yml`] | every push to `main`; every day at 03:17 UTC; by hand | runs every test on Node.js 24, and again on Node.js 22, the oldest version the project supports; takes a snapshot of the dictionary, builds the Keyman packages, the web editor and the lexicon manager, publishes them. If anything fails, the site keeps its last good version. |
| **Keyman packages for a release** [`release-assets.yml`] | when a release is published; by hand, for an existing tag | runs every test, takes a snapshot, builds both Keyman packages and attaches them to the release. The build runs with a read only token; a separate step with write access only uploads the two files. |
| **Frequencies from the Ligurian Wikipedia** [`frequencies.yml`] | by hand only | finds the newest finished dump of the Ligurian Wikipedia in Wikimedia's own status files, downloads it, checks its SHA-1, counts its words and offers `lijwiki.tsv` as a file to download. It writes nothing: a maintainer reviews the file and commits it. |

All three run on **Ubuntu 26.04**, named explicitly rather than through `ubuntu-latest`, so that GitHub's next change of image cannot alter a build unannounced, and use the Node.js 24 versions of GitHub's actions [decision [0026](docs/decisions/0026-workflow-runtimes.md)]. Both need two repository variables, `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; both values are public by design. GitHub pauses scheduled runs after 60 days without activity in the repository; the Actions page then offers to enable them again.

## Design decisions

Every important decision is recorded in [docs/decisions/](docs/decisions/README.md) with its context, the decision and its consequences, so that nobody undoes it by accident or repeats the debate.

| N° | Decision |
|---|---|
| [0001](docs/decisions/0001-input-method-not-editor.md) | An input method, not a standalone editor |
| [0002](docs/decisions/0002-one-dictionary-database.md) | One dictionary database, not two dictionaries |
| [0003](docs/decisions/0003-open-data-and-licenses.md) | Open data and licenses |
| [0004](docs/decisions/0004-orthography-and-variety-per-entry.md) | Orthography and variety recorded for every entry |
| [0005](docs/decisions/0005-ascii-skeleton-is-computed.md) | The ASCII key of every word is computed, never typed |
| [0006](docs/decisions/0006-wordforms-entered-by-hand.md) | Every wordform is entered by hand; no morphology generator yet |
| [0007](docs/decisions/0007-technology-stack.md) | Technology stack |
| [0008](docs/decisions/0008-repository-name-and-home.md) | Repository name and home |
| [0009](docs/decisions/0009-data-sources.md) | Where the words come from |
| [0010](docs/decisions/0010-versioning-and-releases.md) | Versioning and releases |
| [0011](docs/decisions/0011-roles-and-review-workflow.md) | Roles and the review workflow |
| [0012](docs/decisions/0012-never-hard-delete.md) | Never hard delete; keep the whole history |
| [0013](docs/decisions/0013-senses-and-optional-translations.md) | Meanings as numbered senses, with optional translations |
| [0014](docs/decisions/0014-automatic-base-form.md) | The base form is created automatically and follows its lemma |
| [0015](docs/decisions/0015-definitions-in-italian.md) | Definitions are written in Italian, for now |
| [0016](docs/decisions/0016-database-first-then-interface.md) | Database first, then the lexicon manager |
| [0017](docs/decisions/0017-ascii-search-keys-in-the-database.md) | ASCII search keys stored in the database |
| [0018](docs/decisions/0018-lexicon-manager-design.md) | Design of the lexicon manager |
| [0019](docs/decisions/0019-editor-dictionary-snapshot.md) | The web editor reads a daily snapshot of the dictionary |
| [0020](docs/decisions/0020-web-editor-design.md) | Design of the web editor |
| [0021](docs/decisions/0021-keyman-scope-and-toolchain.md) | Keyman keyboard: scope, toolchain and distribution |
| [0022](docs/decisions/0022-keyman-keyboard-design.md) | Design of the Keyman keyboard and dictionary |
| [0023](docs/decisions/0023-lexicon-manager-spanish-history-csv.md) | Lexicon manager in Spanish, latest additions, CSV download |
| [0024](docs/decisions/0024-letter-enye.md) | The letter ñ |
| [0025](docs/decisions/0025-csv-semicolon.md) | The CSV download is separated by semicolons |
| [0026](docs/decisions/0026-workflow-runtimes.md) | Workflow runners and runtimes |
| [0027](docs/decisions/0027-real-frequencies.md) | Real frequencies from the Ligurian Wikipedia |
| [0028](docs/decisions/0028-enye-warning-under-oficia.md) | The manager warns before saving ñ under the grafîa ofiçiâ |

## Open questions

These need the judgment of native speakers, and contributions are especially welcome:

* **ç written as s.** The *Arfabêto* allows `ç` to be written as `s`. Should typing `se` also offer `çê`?
* **Elided forms.** Should `l'ægua` be split at the apostrophe, in the editor and in the keyboard alike, or should the dictionary hold every elided form?
* **Grafia unitäia.** Which extra folding rules, if any, the second spelling system needs.
* **Definitions in Ligurian.** When the dictionary should start recording them.
* **Live updates** in the lexicon manager, so reviewers see each other's changes at once.

## Roadmap and the road to 1.0.0

Version 1.0.0 is a promise of stability, given when these criteria are met, not on a date:

1. **The Android keyboard,** with iOS when a tester exists; on computers, the web editor.
2. **A usable dictionary:** several thousand approved forms with inflections, and real frequencies.
3. **Frozen foundations:** the skeleton rules, the word list format, and the database schema with a written migration policy.
4. **Settled open questions,** or explicit decisions to postpone them.
5. **Real use** by native speakers for several weeks, with their reports fixed.
6. **Operations:** a database backup routine and validated bulk imports.

| Version | Content |
|---|---|
| 0.6 | Done: the lexicon manager in Spanish, its latest additions, the CSV download; the letter `ñ` |
| 0.7 | Done: workflows on Ubuntu 26.04 and Node.js 24, also checked on Node.js 22; the CSV download separated by semicolons |
| 0.8 | Done: real frequencies from the Ligurian Wikipedia; a warning before `ñ` is saved under grafîa ofiçiâ |
| 0.9 | Bulk import with validation |
| 0.10 | Backups, hardening, contributor documentation; beta with speakers in Genoa |
| 1.0 | All criteria met |

Partnerships with the Académia Ligùstica do Brénno and A Compagna are sought throughout.

## What is new in each version

Every change, file by file, is listed in [CHANGELOG.md](CHANGELOG.md).

* **0.8.2, 2026/10/17: the first frequency list.** 83,575 words counted from the Ligurian Wikipedia dump of 2026/10/01; the editor and the keyboard now rank spellings by it.
* **0.8.1, 2026/10/17:** the frequencies workflow finds the newest finished dump in Wikimedia's own status files; its first run had failed with HTTP 404.
* **0.8.0, 2026/10/17: real frequencies.** The words of the Ligurian Wikipedia are counted, and the editor's menu and the keyboard's suggestions put the most used spelling first. The lexicon manager warns, and asks, before a word with `ñ` is saved under grafîa ofiçiâ, which does not write that letter.
* **0.7.0, 2026/10/17: ready for GitHub's new runners.** Both workflows run on Ubuntu 26.04 and on the Node.js 24 versions of GitHub's actions, and the project is built on Node.js 24 and still checked on Node.js 22. The CSV download is separated by semicolons, so Excel set to Italian or Spanish opens it in columns with a double click.
* **0.6.0, 2026/10/17: the site in Spanish.** A Spanish interface beside Italian and English, in the lexicon manager, the web editor and the install page; the 20 latest additions below the search field; the dictionary downloadable as CSV as well as TSV. The letter `ñ`, written by some other Ligurian spelling systems, is accepted everywhere: a button in the manager, the search key `n`, a long press of `n` on the Android keyboard.
* **0.5.1, 2026/10/17:** the copyright holder's name made uniform, inside the Keyman packages too.
* **0.5.0, 2026/10/17: the Android keyboard.** A Keyman keyboard with an Italian layout and every Ligurian letter on long press, and a dictionary package whose suggestions use the engine's own search keys; both rebuilt every day, offered on an install page under `/tastiera/`, and attached to every release.
* **0.4.1, 2026/10/17:** singular and plural in the web editor's dictionary status.
* **0.4.0, 2026/10/17: the web editor.** The front page of the site: type plain letters and get grafîa ofiçiâ, with the candidate menu, undo, filters, copy and download, on computers and phones, offline after one visit. A daily snapshot of the dictionary; the lexicon manager moves to `/admin/`.
* **0.3.0, 2026/10/17: the lexicon manager.** The web page to search, propose and review words; search by plain letters through keys computed by the database; publication on GitHub Pages. The database is deployed on Supabase.
* **0.2.0, 2026/10/11: the shared dictionary.** The PostgreSQL database with lemmas, forms, numbered senses and translations; roles and review enforced by the database; history; export to the engine's format; the first design decision records.
* **0.1.0, 2026/10/10: the conversion engine.** ASCII folding based on the Académia's alphabet, the word list loader, conversion with the candidate menu, the terminal demo.

## Contributing

Words, corrections, translations, code and reviews from native speakers are all welcome, in English, Italian, Spanish or Ligurian. See [CONTRIBUTING.md](CONTRIBUTING.md). Genoese associations interested in the project are invited to open an issue.

## Licenses

* **Code:** MIT, see [LICENSE](LICENSE).
* **Dictionary data:** CC BY-SA 4.0, see [data/LICENSE.md](data/LICENSE.md). Anyone may reuse the published dictionary, with credit, under the same license. The Android dictionary package carries both licenses, since it holds data and code.

## Acknowledgements and independence

The spelling rules follow the *Arfabêto* published by the **Académia Ligùstica do Brénno** at <https://www.zeneize.net/grafia/arfabeto.htm>. The Android keyboard is built on **Keyman**, free software by SIL Global.

This is an independent project. It is not affiliated with, or endorsed by, the Académia Ligùstica do Brénno, A Compagna, SIL Global or any other organization.

---

## Riassunto in italiano

### Che cos'è

`ligurian-keyboard` è un **metodo di scrittura** per il ligure. Permette a chiunque di scrivere in ligure corretto, nella grafia ufficiale, la **grafîa ofiçiâ** dell'Académia Ligùstica do Brénno, con la normale tastiera italiana del computer o del telefono. Si scrive la parola senza accenti e senza lettere speciali, e si ottiene la grafia giusta:

| Scrivi | Ottieni |
|---|---|
| `zena` | `Zêna` |
| `citae` | `çitæ` |
| `zeneize` | `zenéize` |
| `canpanna` | `canpànn-a` |

Quando le stesse lettere portano a più parole, si sceglie quella giusta da un breve elenco, come con le tastiere giapponesi. Il progetto nasce per sostenere la rivitalizzazione della lingua ligure; codice e dati sono aperti.

### Come usarlo, subito

| Cosa | Dove | Da installare |
|---|---|---|
| **Editor web**: scrivere in ligure nel browser, su computer o telefono | <https://ignatz-castror.github.io/ligurian-keyboard/> | niente |
| **Tastiera Android**: scrivere in ligure in tutte le app | <https://ignatz-castror.github.io/ligurian-keyboard/tastiera/> | l'app gratuita Keyman, poi due pacchetti |
| **Dizionario**: cercare le parole approvate | <https://ignatz-castror.github.io/ligurian-keyboard/admin/> | niente |
| **Codice sorgente** di ogni versione | <https://github.com/Ignatz-CastroR/ligurian-keyboard/releases> | Node.js, per compilarlo |

### Che cosa si può scaricare

* **La tastiera**, `ligurian_keyboard.kmp`, e **il dizionario**, `ignatzcastror.lij.ligurian_keyboard.model.kmp`, dalla pagina di installazione. Il dizionario viene ricostruito ogni giorno con le parole approvate; la sua versione è la sua data, per esempio `2026.10.17`.
* **L'elenco delle parole approvate**, in formato TSV o CSV: aggiornato al momento, dai pulsanti "Scarica TSV" e "Scarica CSV" del dizionario; oppure la copia del giorno, da cui sono costruiti l'editor e la tastiera: <https://ignatz-castror.github.io/ligurian-keyboard/lexicon.tsv>.
* **Il proprio testo**, come file `.txt`, dall'editor.
* **Il codice sorgente** di ogni versione, dalla pagina Releases di GitHub; dalla 0.5.0 ogni versione porta con sé anche i due pacchetti per Keyman.

**Quale versione scegliere:** il sito offre sempre l'ultima versione funzionante, con il dizionario del giorno. Non esiste ancora una versione stabile: fino alla 1.0.0 ogni versione è pubblicata come *pre-release*, e tutto può ancora cambiare.

### Come funziona

* **Lo scheletro.** Ogni parola del dizionario ha uno "scheletro": le lettere semplici con cui la si scrive. Si calcola togliendo gli accenti alle vocali, trasformando `æ` in `ae`, `ç` in `c` e `ñ` in `n`, uniformando gli apostrofi e togliendo i trattini, secondo l'*Arfabêto* dell'Académia. Ciò che si scrive viene ridotto allo stesso modo e cercato nel dizionario.
* **Nell'editor web**, la parola viene sostituita quando si preme lo spazio: se c'è una sola grafia, subito; se ce ne sono di più, appare un menu; se la parola è sconosciuta, resta com'è. Le maiuscole e la punteggiatura si conservano; Backspace subito dopo annulla la conversione. L'editor funziona anche senza connessione dopo la prima visita, e il testo non lascia mai il browser.
* **Nella tastiera Android**, che funziona dentro l'app gratuita **Keyman** di SIL Global, le grafie compaiono nella barra dei suggerimenti mentre si scrive: si tocca quella giusta. Tenendo premute le vocali, la `c` e la `n` si ottengono tutte le lettere liguri, `ñ` compresa; c'è un tasto per l'apostrofo; la maiuscola arriva da sola a inizio frase, e due tocchi su Maiusc bloccano le maiuscole. Sui computer Keyman non offre suggerimenti: lì si usa l'editor web.

### Il dizionario

Il dizionario condiviso è un database dove i collaboratori propongono parole, con le loro forme, i significati numerati, le definizioni in italiano e le traduzioni in italiano, spagnolo e inglese. I revisori le approvano; solo le parole approvate arrivano all'editor e alla tastiera, entro un giorno. Nulla viene mai cancellato davvero, ogni modifica resta nella cronologia, e le regole sono imposte dal database stesso. Ogni voce registra la sua varietà, `zeneize` per impostazione predefinita, e il suo sistema di scrittura, `ofiçiâ` per impostazione predefinita. Le parole vengono solo dalla conoscenza dei collaboratori o da fonti con licenza libera: nessun dizionario protetto da diritto d'autore viene copiato. Gli account li crea un amministratore: chi vuole contribuire può chiederne uno. Tutto il sito, l'editor, la pagina del dizionario e quella della tastiera, è in italiano, inglese e spagnolo; la pagina del dizionario mostra sotto il campo di ricerca le 20 voci approvate aggiunte più di recente.

### Limiti attuali

* La tastiera non è ancora stata provata da parlanti nativi sui loro telefoni; ogni segnalazione è benvenuta.
* La `æ` scritta con la pressione prolungata dà probabilmente suggerimenti più deboli di `ae`; scrivere `ae` funziona sempre.
* Le forme elise, come `l'ægua`, contano come una parola sola: ricevono un suggerimento solo se il dizionario le contiene così.
* Le frequenze delle parole vengono dalla Wikipedia in ligure, scritta per lo più in grafîa ofiçiâ: i suoi testi sono enciclopedici, quindi le parole di tutti i giorni possono risultare meno frequenti che nel parlato.

### Verso la versione 1.0.0

La 1.0.0 arriverà quando ci saranno: la tastiera Android provata sul campo, qualche migliaio di forme approvate con frequenze reali, regole e formati congelati, le questioni aperte risolte, alcune settimane d'uso reale a Genova, e copie di sicurezza regolari del database. Il percorso: frequenze reali [0.8, fatto], importazione in blocco con verifica [0.9], copie di sicurezza, documentazione e prova con parlanti genovesi [0.10].

### Contribuire

Sono benvenuti parole, correzioni, traduzioni, codice e revisioni di parlanti nativi, in italiano, in ligure, in spagnolo o in inglese: vedi [CONTRIBUTING.md](CONTRIBUTING.md). Le associazioni genovesi interessate possono aprire una *issue*.

### Licenze e indipendenza

Il codice è sotto licenza MIT, i dati del dizionario sotto CC BY-SA 4.0. Le regole di grafia seguono l'*Arfabêto* dell'Académia Ligùstica do Brénno; la tastiera Android si basa su Keyman di SIL Global. Il progetto è indipendente e non è affiliato né approvato dall'Académia Ligùstica do Brénno, da A Compagna, da SIL Global o da altre organizzazioni.
