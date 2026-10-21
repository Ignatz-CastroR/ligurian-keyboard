# ligurian-keyboard

**Write Ligurian in grafîa ofiçiâ from any keyboard.** Type plain letters, `zeneize`, and get the official spelling, `zenéize`. When several spellings share the same letters, you choose: from a numbered menu in the web editor, as with the Japanese keyboards on a computer, or from the suggestion bar on a phone.

**Scrivi in ligure, in grafîa ofiçiâ, da qualsiasi tastiera.** Il riassunto completo in italiano è alla fine di questa pagina: [Riassunto in italiano](#riassunto-in-italiano).

## Use it now

| What | Where | Install needed |
|---|---|---|
| **Web editor**: write Ligurian in the browser, on a computer or a phone | <https://ignatz-castror.github.io/ligurian-keyboard/> | nothing |
| **Android keyboard**: write Ligurian in every app | install page: <https://ignatz-castror.github.io/ligurian-keyboard/tastiera/> | the free Keyman app, then two packages |
| **Dictionary**: browse it letter by letter, look up a Ligurian word typed with or without accents, or find it from its Italian, Spanish or English translation | <https://ignatz-castror.github.io/ligurian-keyboard/dizionario/> | nothing |
| **Lexicon manager**: search by plain letters, propose and review words | <https://ignatz-castror.github.io/ligurian-keyboard/admin/> | nothing; an account to propose |
| **Users**: your profile and everything you wrote; for reviewers, everyone's complete history | <https://ignatz-castror.github.io/ligurian-keyboard/utenti/> | an account |
| **Source code** of every version | <https://github.com/Ignatz-CastroR/ligurian-keyboard/releases> | Node.js, to build it |

See [Downloads and versions](#downloads-and-versions) for exactly what can be downloaded, and which version to choose.

---

## Contents

1. [What this project is](#what-this-project-is)
2. [Why it exists](#why-it-exists)
3. [The long-term goal: a Ligurian text editor](#the-long-term-goal-a-ligurian-text-editor)
4. [Downloads and versions](#downloads-and-versions)
5. [How the input method works](#how-the-input-method-works)
6. [Spelling systems and varieties](#spelling-systems-and-varieties)
7. [The parts of the project](#the-parts-of-the-project)
8. [The shared dictionary](#the-shared-dictionary)
9. [How a word travels from the dictionary to your screen](#how-a-word-travels-from-the-dictionary-to-your-screen)
10. [The site in five sections](#the-site-in-five-sections)
11. [The web editor](#the-web-editor)
12. [The Android keyboard](#the-android-keyboard)
13. [The dictionary for readers](#the-dictionary-for-readers)
14. [The lexicon manager](#the-lexicon-manager)
15. [The Users section](#the-users-section)
16. [Where the words come from](#where-the-words-come-from)
17. [Privacy](#privacy)
18. [Getting started as a developer](#getting-started-as-a-developer)
19. [Repository layout](#repository-layout)
20. [Tests](#tests)
21. [Automation](#automation)
22. [Design decisions](#design-decisions)
23. [Open questions](#open-questions)
24. [Roadmap and the road to 1.0.0](#roadmap-and-the-road-to-100)
25. [What is new in each version](#what-is-new-in-each-version)
26. [Contributing](#contributing)
27. [Licenses](#licenses)
28. [Acknowledgements and independence](#acknowledgements-and-independence)
29. [Riassunto in italiano](#riassunto-in-italiano)

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

When the same letters lead to more than one real word, the person picks the right one. In the web editor a numbered menu opens, as the Japanese keyboard on Windows offers kanji for a word typed in Latin letters. On a phone, Keyman's suggestion bar above the keys shows the spellings side by side, and a tap picks one; Keyman draws that bar itself, so a vertical menu there would need a keyboard app of this project's own [decision [0037](docs/decisions/0037-lowercase-first-and-ligurian-names.md)].

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

## The long-term goal: a Ligurian text editor

This repository is the foundation of a larger objective: **a fully integrated Ligurian text editor for computers, phones and tablets**, with spell checking, predictive text and automatic correction, which does not merely spell each word correctly but helps its writer produce correct Ligurian.

That editor will be **a separate project, in a repository of its own, built on this one.** It will use this repository's conversion engine, its shared and reviewed dictionary, the dictionary's public codes, the frequency lists and, next, the inflection generator as its base. Here those components are **dogfooded:** they run in production, inside an input method used every day, so each one is proven by real writers before the editor depends on it.

For that, this repository will offer its engine and its dictionary exports as a dependency with a stable, versioned interface; the 1.0.0 criterion of frozen foundations [see [Roadmap and the road to 1.0.0](#roadmap-and-the-road-to-100)] is its first step.

### Four layers of correction

The input method in this repository performs the first layer today. The editor will add three more, each building on the one before:

| Layer | What it corrects | Example |
|---|---|---|
| **0. Orthographic restoration** [today] | Plain letters to the grafîa ofiçiâ | `zeneize` → `zenéize` |
| **1. Phonologically informed spelling correction** | Spellings that follow pronunciation, or Italian spelling habits, instead of the official orthography | `sun` → `són` |
| **2. Lexical normalization** | Italian loanwords and calques for which Ligurian has a word of its own | a common Italianism → its native Ligurian equivalent |
| **3. Idiomatic normalization** | Constructions copied from Italian, replaced by the Ligurian construction, inflected to agree with their context | `dovéi` → `avéighe da` |

### Design principles

* **Corrections are proposals, never silent rewrites.** Beyond layer 0, every correction is shown with its reason and the dictionary entry behind it, and the writer accepts it or keeps their own text. An Italianism may be deliberate, quoted, or established in a given variety; the editor informs, the writer decides.
* **Every rule is data, not code.** A form or construction to be corrected is an entry of the reviewed dictionary, linked by its public code to its preferred equivalent, with its variety and its sense, and reviewed like any other entry. Native speakers and linguists, not programmers, decide what is correct, and the rules are published as open data under CC BY-SA 4.0.
* **Layer 1 rests on an error model:** a table of the sound to spelling correspondences of the grafîa ofiçiâ, which generates candidate spellings for a misspelled word; the dictionary keeps only real words, and the frequency lists rank them.
* **Layer 3 rests on the inflection generator.** Replacing `dovéi` with `avéighe da` means conjugating `avéighe` in the person, number, tense and mood of the verb it replaces, and placing its clitic correctly; paradigms come from native speakers or from grammars whose license permits their use, never from guesswork.
* **One engine everywhere.** Written once in TypeScript, the engine of this repository runs in the input method today and, through the editor, in applications for computers and phones tomorrow; the input method keeps serving every other application.
* **Each layer is built only when its data exists,** and only after a decision record of its own.

This extends, and does not reverse, decision [0001](docs/decisions/0001-input-method-not-editor.md): this repository remains an input method, the way to write Ligurian in the applications people already use; the editor is a second product, in its own repository, built on its foundations.

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
| Android keyboard | Android with the free [Keyman](https://keyman.com/android/) app, version 17 or newer; version 19, in beta, for automatic correction |
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
* **Elided words are converted part by part.** If the whole word is not in the dictionary, it is split after each inner apostrophe and every part is converted on its own: `d'aegua` gives `d'ægua` from the entries `d'` and `ægua`, so the dictionary needs each particle and each word only once [decision [0029](docs/decisions/0029-elision.md)]. The Android keyboard splits words at the same place, so after `d'` it suggests the next word afresh.

### In the Android keyboard: suggestions

On Android the project does not replace Android's keyboard system; it runs inside **Keyman**, a free keyboard app by SIL Global that hosts keyboards for thousands of languages. The work is shared:

1. **The keyboard package** draws the keys. Every key types exactly the letter shown; a long press on a vowel, on `c` or on `n` gives every Ligurian letter. A capital comes by itself at the start of a sentence.
2. **Keyman's predictive text** watches the word being typed. For every letter, it folds the word with our `searchTermToKey`, the keyboard's copy of the skeleton, and searches **the dictionary package**, an index of every approved word built from its skeleton. Keyman also tolerates small typing mistakes.
3. **The best matches appear in the suggestion bar** above the keys, in the casing the person is typing: `penna` offers `pénna` and `pénn-a`; `Penna`, at the start of a sentence, offers `Pénna`.
4. **Tapping a suggestion** puts it in the text, followed by a space. With **Keyman 19** [in beta until early 2027] and "Predictions with auto-corrections" selected, space applies the highlighted suggestion by itself: `ligure` becomes `lìgure`, `zeneize` becomes `zenéize`, `AEGOA` becomes `ÆGOA`. When several words compete, the bar shows them and highlights one in grey; a first press of space may only highlight it, a second applies it. Keyman 18 applies a suggestion only when it is tapped. A word typed in lowercase is corrected to the lowercase form of a pair such as `damàsco` and `Damàsco` [decision [0037](docs/decisions/0037-lowercase-first-and-ligurian-names.md)].

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
| Conversion engine | `engine/` | Computes skeletons, loads the word list, converts typed words and elided words, builds the menu, checks lexicon files | working, 54 tests |
| Word counts | `corpus/` | Counts the words of the Ligurian Wikipedia, so the most used spelling comes first | working, 16 tests |
| Terminal demo | `engine/src/demo.ts` | Try the engine from the command line | working |
| Shared dictionary | `db/` | Words, meanings, translations, roles, review, history | working and deployed, 93 tests |
| Export | `db/` [`export_lexicon_tsv()`] | Writes the approved words in the engine's format | working |
| Lexicon manager | `admin/` | Web page to search, propose and review words, in Italian, English and Spanish | working, 66 tests |
| Dictionary for readers | `dictionary/` | Public page: the index by initial letter, the search by Ligurian spelling and by translation, one page per entry, in Italian, English and Spanish | working, 9 tests |
| Users section | `users/` | Profiles, the people of the dictionary, each person's complete history | working, 4 tests |
| Site sections | `site/` | The bar of five sections and the dictionary's size, shared by every page | working, 4 tests |
| Web editor | `editor/` | Web page where anyone types Ligurian with the engine and the published dictionary, in Italian, English and Spanish | working, 24 tests |
| Android keyboard | `keyman/` | Keyman keyboard and dictionary for Android phones and tablets, rebuilt daily | working, 33 tests; to be tested on real phones |
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
* Every lemma and every form has a **public code**, such as `LIJ-7K3Q9MDXK`, given by the database and never changed or reused, so that an entry keeps its name in backups and future imports; its last character is a check symbol that catches a mistyped code [decision [0030](docs/decisions/0030-public-identifiers.md)].

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
* **Backups** of the whole dictionary, history included, are downloaded by admins from the lexicon manager, and restore exactly into a new, empty dictionary [decision [0031](docs/decisions/0031-backups.md)].

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

## The site in five sections

Every page of the site begins with the same bar of five large buttons, the current one filled: **Write** [the web editor], **Dictionary**, **Lexicon manager**, **Keyboard** [the Android install page] and **Users**. Beneath them, the size of the published dictionary: lemmas, forms and translations. Each section has its own tabs below the bar: the dictionary its index and search, the manager its search, new lemma, review and backups. An entry in the dictionary links to the same entry in the manager, and the other way round. Design: decision [0035](docs/decisions/0035-site-in-five-sections.md).

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

1. Install the free **Keyman** app by SIL Global, **version 19** for automatic correction: <https://keyman.com/beta/>. Version 18, on the Play Store, offers the words but does not replace them: <https://keyman.com/android/>.
2. Download both packages from the install page: the keyboard, `ligurian_keyboard.kmp`, and the dictionary, `ignatzcastror.lij.ligurian_keyboard.model.kmp`.
3. In Keyman: menu, **Settings**, **Install Keyboard or Dictionary**, **Install from local file**; choose the keyboard package and tap **Install**. Repeat with the dictionary package.
4. In Keyman: menu, **Settings**, **Installed languages**, **Lìgure**. Under **Dictionary** it must say `ignatzcastror.lij.ligurian_keyboard`; if another Ligurian dictionary is selected, choose ours, and remove the other if it stays. On the same page choose **Predictions with auto-corrections**.
5. To use it in every app: in Keyman, menu, **Get Started**, **Enable Keyman as system-wide keyboard**. Then switch keyboards in any app with the keyboard icon.

Keyman pairs the two packages through their language code, `lij`, the ISO 639-3 code for Ligurian.

### Using it

* **Type plain letters**; with Keyman 19 the word becomes grafîa ofiçiâ when you press space, and with Keyman 18 the suggestion bar offers it, to tap. On the space bar the keyboard reads "Lìgure - grafîa ofiçiâ".
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
* **Another Ligurian dictionary** sits in Keyman's catalog, `jeanm.lij.conseggio`, and Keyman may select it for the language; its suggestions mix in Italian words. In Keyman, Settings, Installed languages, Lìgure, the dictionary must be `ignatzcastror.lij.ligurian_keyboard`; remove the other if it stays selected.
* **Automatic correction needs Keyman 19,** still in beta until early 2027.
* **Typing `æ` with the long press** probably gives weaker suggestions than typing `ae`: Keyman's correction search compares one typed character at a time, and `æ` stands for two. Typing `ae` always works.
* **A particle chosen from the suggestion bar** may be followed by a space, which Keyman adds after every accepted suggestion; typing `d'` in full and going on with the word avoids it [decision [0029](docs/decisions/0029-elision.md)].
* **iPhone and iPad** are not tested yet; **desktop computers** get no suggestions from Keyman.

## The dictionary for readers

<https://ignatz-castror.github.io/ligurian-keyboard/dizionario/> · full reference: [dictionary/README.md](dictionary/README.md) · design: decision [0034](docs/decisions/0034-dictionary-for-readers.md)

* **The index, as on Wiktionary:** choose a letter and see every entry that begins with it, with its translations. Accented vowels are listed under their letter; `æ` and `ç` have letters of their own.
* **One search, two kinds of results:** type a Ligurian word, with or without accents, and find its entry by headword or by any of its forms [`zena` finds `Zêna`; `penne` finds `pénna`, saying which form matched]; or type a word in Italian, Spanish or English and find the Ligurian entries that translate it, grouped by entry. Search everywhere, in Ligurian only, or in one language of translation [decision [0035](docs/decisions/0035-site-in-five-sections.md)].
* **A page for every entry** at a permanent address built from its public code: senses, Italian definitions, translations by language, and forms. Above it, the letter of the index it belongs to.
* **Published words only,** for everyone, without an account.

## The lexicon manager

<https://ignatz-castror.github.io/ligurian-keyboard/admin/> · full reference: [admin/README.md](admin/README.md) · design: decisions [0018](docs/decisions/0018-lexicon-manager-design.md) and [0023](docs/decisions/0023-lexicon-manager-spanish-history-csv.md)

* **Search by plain letters**, the same way one types: `zena` finds `Zêna`, and an inflected form finds its lemma. Open to everyone.
* **Latest additions:** while the search field is empty, the 20 approved entries added most recently are listed below it, newest first, with the date and time each was added.
* **Entry pages** with forms, senses, translations, the public code of the lemma and of every form, and, for reviewers, the full history of every change.
* **Search by public code:** typing `LIJ-7K3Q9MDXK` finds its entry; a code with a wrong check symbol is reported as a typing mistake.
* **Its own tabs** under the site's bar: Search, New lemma, To review and, for admins, Backups.
* **Backups and restore,** for admins, in the Backups tab: the whole dictionary as one JSON file, and a restore into an empty dictionary.
* **A link to the dictionary** on every published entry, and on any other the reason it is not there yet: pending, rejected or deleted.
* **Translations several at a time:** type `penna; stilografica` and each becomes its own translation, shown before saving; the language is always chosen, never assumed.
* **Proposals** with buttons for the special letters, `ñ` included, and a warning when a lemma with the same skeleton already exists.
* **A review queue grouped by entry**, oldest proposals first: each lemma with its pending forms, senses and translations beneath it, every sense labelled by its number and definition. Reviewers tick rows, a whole entry or everything, Shift+click for a range, and approve or reject them in one database call; approving an entry approves all its pending parts. A row changed by someone else meanwhile is reported, not overwritten, and the rest of the batch still goes through [decision [0033](docs/decisions/0033-batch-review.md)].
* **Roles and profiles** are now in the Users section.
* **Downloads** of the approved dictionary: **TSV**, the engine's format, and **CSV** for spreadsheets [separated by semicolons, as Excel set to Italian or Spanish expects, so a double click opens it in columns; with a byte order mark so that Excel shows the Ligurian letters; with Excel set to English, open it through Data, From Text/CSV]. Each file is named by the local date and time of the download, such as `ligurian-lexicon-20261018-123107.csv`, so downloads never overwrite each other and sort in the order they were made.
* **Interface in Italian**, the contributors' language, **English** and **Spanish**, chosen from a menu in the header.

## The Users section

<https://ignatz-castror.github.io/ligurian-keyboard/utenti/> · full reference: [users/README.md](users/README.md) · design: decision [0035](docs/decisions/0035-site-in-five-sections.md)

* **Your profile** and your display name, and **your complete history:** every change you made, newest first, with its date and time to the second, what it was [created, edited, approved, rejected, deleted, restored], the entry it belongs to, the status it left and, for an edit, the fields it changed. A summary counts your changes by kind.
* **For reviewers and admins, everyone:** every person with their role, how many changes they made and when the last one was, and anyone's complete history; also the changes written from Supabase's SQL Editor with no person named. Admins rename people and change roles here.
* **One sign-in** with the lexicon manager: signed in to one, you are signed in to the other.

## Where the words come from

Good Ligurian dictionaries exist, but they are their authors' copyrighted work. The project does not copy them [decision [0009](docs/decisions/0009-data-sources.md)]:

* Contributors enter words **from their own knowledge**, or from sources whose license allows reuse.
* **Permission first:** the Académia Ligùstica do Brénno and A Compagna will be asked whether their word lists may seed the dictionary, in exchange for credit and editorial roles.
* **Word frequencies**, which order the menu and the suggestions, are counted from the **Ligurian Wikipedia**, which writes mostly in grafîa ofiçiâ and whose text is under CC BY-SA 4.0 [decision [0027](docs/decisions/0027-real-frequencies.md)]. A maintainer runs the workflow "Frequencies from the Ligurian Wikipedia" a few times a year; it downloads Wikimedia's latest dump, checks it, counts every word of every article and offers the list as a file to download, which the maintainer reviews and commits as `data/frequencies/lijwiki.tsv`. When the site is built, each word in grafîa ofiçiâ gets its count added to the frequency stored in the dictionary, so a word the corpus never uses keeps its stored weight and a reviewer can still raise a word by hand. The list in use since 0.8.2 counts the dump of 2026/10/01: 83,574 distinct words since 0.8.3, each seen at least twice, about 2.2 million occurrences in all.

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

`npm run check` type checks the whole project and runs all 309 tests. The database tests need no server: they run on PGlite, a real PostgreSQL compiled to WebAssembly. The Keyman tests run Keyman's own compiler, `kmc`, installed by `npm install`.

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

[db/README.md](db/README.md), section "Deploying to Supabase", lists every step: running every migration in order, creating the first user and making it admin.

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
| `npm run test:docs` | Decision record and text file tests |
| `npm run test:users` | Users section tests |
| `npm run test:site` | Tests of the site's five sections |
| `npm run demo` | Terminal demo of the input method |
| `npm run admin:dev` | Lexicon manager on your computer, reloading on every change |
| `npm run admin:build` | Build the lexicon manager into `admin/dist/` |
| `npm run admin:preview` | Serve that build locally |
| `npm run dictionary:dev` | Dictionary for readers on your computer, reloading on every change [needs `.env`] |
| `npm run dictionary:build` | Build the dictionary for readers into `dictionary/dist/` |
| `npm run test:dictionary` | Dictionary for readers tests |
| `npm run users:dev` | Users section on your computer, reloading on every change [needs `.env`] |
| `npm run users:build` | Build the Users section into `users/dist/` |
| `npm run lexicon:fixture` | Use the test dictionary as the snapshot |
| `npm run lexicon:validate -- <file.tsv>` | Check a lexicon file without changing it: rows that would be refused, duplicates, the words that open a menu, approved forms with freq 0, the manager's two warnings; exit code 0, 1 or 2 |
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
  src/validate.ts         checking a lexicon file
  src/demo.ts             terminal demo
  test/                   54 tests
db/                     the shared dictionary
  migrations/             0001 to 0011, run in order on Supabase
  templates/              SQL Editor templates: adding whole entries, measuring earlier loads
  test/                   93 tests on PGlite; the Supabase stand in is for tests only
  README.md               data model, roles, client rules, deployment
admin/                  the lexicon manager, published under /admin/
  src/                    TypeScript, one file per page under views/
  test/                   66 tests
  README.md               pages, accounts, downloads, codes, backups, publishing
dictionary/             the dictionary for readers, published under /dizionario/
  src/model.ts            letters, addresses, grouping; pure functions
  src/main.ts             the page
  test/                   9 tests
  README.md               views, data, local runs
users/                  the Users section, published under /utenti/
  src/model.ts            addresses, what each change was; pure functions
  src/views/              the people and one person's history
  test/                   4 tests
  README.md               views, permissions, local runs
site/                   what every section shares
  sections.ts             the five sections, their names and addresses
  bar.ts, bar.css         the bar of five buttons and the dictionary's size
  test/                   4 tests
editor/                 the web editor, the front page of the site
  src/ime.ts              the input method's decisions, pure functions
  src/main.ts             the page
  public/sw.js            offline copy
  public/tastiera/        the Android install page
  test/                   24 tests
  README.md               use, snapshot, local runs
keyman/                 the Android keyboard and its dictionary
  ligurian_keyboard/      Keyman keyboard project
  ignatzcastror.lij.ligurian_keyboard/   Keyman dictionary project
  src/                    layout, word list, build
  test/                   33 tests
  README.md               build, rules for changes, testing on a phone
corpus/                 counting the words of the Ligurian Wikipedia
  src/                    words, the choice of the dump, the dump and its markup, the frequency list
  test/                   16 tests
  README.md               how a count is made and committed
tools/                  dictionary snapshot, lexicon checks, word counts, Keyman packages, site assembly
docs/
  skeleton-spec.md        the folding rules, their sources and their copies
  lexicon-format.md       the word list exchange format
  decisions/              one record per design decision
  test/                   5 tests: the decision tables follow the records; no invisible character written literally
data/
  fixtures/test-lexicon.tsv   93 forms for tests only
  frequencies/            word counts from the Ligurian Wikipedia
  LICENSE.md              CC BY-SA 4.0 for lexicon data
export/                 further dictionary formats, planned
.github/workflows/      tests, daily site build, Keyman packages for releases, word counts
```

## Tests

309 tests guard the project, and every one runs on every push to `main` before anything is published:

* **Engine [54]:** folding rules, idempotence, collisions, the menu order, casing, punctuation, filters, and the rejection of invalid rows; elided words split after the inner apostrophe and converted part by part, with each part's casing, the menu of combinations and its limit, and the whole word winning over its parts; lexicon files checked line by line, their line numbers kept across comments, a byte order mark and CRLF endings, every error and warning, duplicates, collisions in the menu's own order, the printed report and its exit codes, and the `ñ` and elision warnings proved identical to the lexicon manager's; and the forms the engine accepts, capitals included, refusing `ſ` and the Kelvin sign.
* **Database [93]:** each rule is tested from the side of the person who must *not* be able to break it: a contributor trying to approve, a member trying to propose, anyone trying to erase. Ten of them guard the search keys: the database's own folding equals the engine's on every test word and on every letter the database accepts, a list read from the database itself; the engine loads a word holding any of those letters; and `ñ` is accepted and found by typing `n`. Thirteen more guard the public codes and backups: every code valid, unique across lemmas and forms, out of every client's reach and never reused; the database and the manager computing the same check symbols; old entries receiving codes with a line of history; and a backup restored into a fresh database giving back an identical backup and export, while a restore into a dictionary that is not empty, or from an incomplete file, is refused; a restore works into the same project after its data was lost, and leaves nothing behind when it fails halfway. Sixteen guard batch review: migration 0007 applied to a database with pending rows keeps the queue's original columns row for row; the queue carries each row's version, lemma and sense and leaves out rows of a deleted lemma or sense; a whole entry approved in one call writes one line of history per row; rows changed, missing or deleted since the queue was read, or refused by a rule, are reported while the rest of the batch goes through; even an admin's batch never touches a deleted row; only pending rows are changed; contributors, members, anonymous visitors and a token without a user are refused before any row is touched; a malformed request changes nothing. Seven guard the queue in pages: every caller gets the rows the view shows them and no parent they could not read, entries come oldest first and whole, one API row each, position and totals stay right while others review, and a page answers many times faster than the view at the live dictionary's size. Six run the SQL templates exactly as committed, fourteen wrong entries among them. Three more guard the backup's time limit of 60 seconds, which leaves every other setting of the backup and restore functions as it was. Ten guard the dictionary for readers: the initials of the index, published rows only for a visitor, a reviewer and a contributor alike, the index in pages, the search folding accents, capitals and punctuation with exact matches first, never treating a query as a pattern and cutting a very long one, an entry found by the code of its lemma or of any form, and query plans that use the indexes. Seven guard the site's sections: the dictionary's size counting published rows only, the same for everyone; a Ligurian word found with or without accents, by headword or by form, published entries only, through the search key indexes, a whole word typed never pushed out by longer words that begin with it; and each person's history complete and in pages, readable by reviewers and admins for anyone, the SQL Editor's changes included, by everyone else for themselves only, and by visitors not at all.
* **Lexicon manager [66]:** input checks, the engine's form check accepting exactly the database's letters on every Unicode code point, the warning before a particle and a word are saved as one form, with a letter list identical to the real database's; the warning before `ñ` is saved under grafîa ofiçiâ, compared with the database's own spelling system codes; a comparison of every button the page shows with what the real database actually accepts, for every role; the CSV conversion against RFC 4180 with semicolons, with a round trip; and the three languages, with no empty text, lost placeholder or untranslated copy; public codes, whose check symbol catches every single wrong character and every swap of neighbours, read forgivingly when typed; and backup files, every wrong one refused with its reason before it reaches the database, and assembled from small reads into a file identical to the database's own, losing no row when the server sends short pages, starting again when the dictionary changes meanwhile, and retrying a failed read; download names stamped with the local date and time, sorting in time order; the review queue grouped by entry, its labels in three languages never showing a sense as a bare number, the selection by row, Shift+click range, entry and everything, cleared after each batch, and a real queue from the database approved whole in one call; several translations typed in one field split on ";", each once; and the link from an entry to the dictionary offered exactly for the entries the real database publishes.
* **Dictionary for readers [9]:** the order of the index's letters, every view's address read back exactly, translations grouped by sense and language, search results grouped by entry, codes typed into the search field, its three languages, and the page's grouping run on rows from the real database; the letter shown above an entry equal to the database's own for every letter the spelling allows; and a Ligurian word typed without accents finding its entry, with the form that matched.
* **Users section [4]:** the addresses of its views, any other falling back to the first page; each change of a history read as what it was, on rows the real database writes; and its three languages.
* **The site's sections [4]:** five sections in one order with their names in three languages; every section reaching every other by a relative address, as the site build publishes them; and the dictionary's size written as each language writes numbers.
* **Web editor [24]:** finishing a word, replacing, an elided word typed in a sentence, the menu, choosing, undoing with Backspace, the filters, the refusal of a broken or empty dictionary snapshot, and the singular and plural of its messages; its three languages, the same as the manager's, with Spanish really translated; and the install page's own script, run against a stand in for the browser, translating its links to the editor and the dictionary into the language being read, and keeping them in view at the top of the screen.
* **Android keyboard [34]:** a real build with Keyman's compiler; the names Keyman shows; a lowercase form weighing three times its capitalized twins in the word list, and holding more than Keyman 19's 66% auto-correction share on every pair of counts tried; the model's own word breaker, which splits words exactly where the engine does and keeps hyphenated words whole, in the source and in the compiled model; the compiled dictionary loaded and inspected, proving that its search keys equal the engine's on every character up to U+02FF, every test word in four forms and 5,000 pseudo-random strings whose coverage is itself tested; exactly the Ligurian letters on the layout, in both cases; rows of equal width by Keyman's own arithmetic; the layer rules; the contents of both packages; the refusal of a bad snapshot or a failing compiler, keeping earlier packages; error reporting always off.
* **Word counts [16]:** the choice of the dump from Wikimedia's own status files, refusing unfinished, unsigned or unreadable runs and any address but Wikimedia's; what a word is, in capitals, with elision and with foreign letters; markup stripped from written-for-the-test wikitext, unclosed markup included; the dump read in pieces cut anywhere, articles only; the frequency list written, read back, and refused line by line when damaged; and, end to end, the corpus deciding which spelling of `penna` the editor offers first; and the committed list itself read without a single problem.
* **Documents and text files [5]:** no file holds an invisible character written literally, such as a byte order mark, where a reader cannot see it; decision records numbered without gaps; both tables, in `docs/decisions/README.md` and here, name every record exactly as its own title does; and every "Refines" or "Supersedes" is answered by the record it points to.

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
| [0029](docs/decisions/0029-elision.md) | Elided words are split at the apostrophe |
| [0030](docs/decisions/0030-public-identifiers.md) | Public identifiers for lemmas and wordforms |
| [0031](docs/decisions/0031-backups.md) | Backups from the lexicon manager |
| [0032](docs/decisions/0032-dictionary-second-purpose.md) | The dictionary as a second purpose, for the diaspora first |
| [0033](docs/decisions/0033-batch-review.md) | Batch review, the queue grouped by entry |
| [0034](docs/decisions/0034-dictionary-for-readers.md) | The dictionary for readers, an index and a search by translation |
| [0035](docs/decisions/0035-site-in-five-sections.md) | The site in five sections |
| [0036](docs/decisions/0036-built-for-more-than-one-language.md) | Built for more than one language |
| [0037](docs/decisions/0037-lowercase-first-and-ligurian-names.md) | The Android keyboard: lowercase first, Ligurian names, Keyman 19 |

## Open questions

These need the judgment of native speakers, and contributions are especially welcome:

* **ç written as s.** The *Arfabêto* allows `ç` to be written as `s`. Should typing `se` also offer `çê`?
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
6. **Operations:** a database backup routine [in place since 0.10, by hand] and validated bulk imports.

| Version | Content |
|---|---|
| 0.6 | Done: the lexicon manager in Spanish, its latest additions, the CSV download; the letter `ñ` |
| 0.7 | Done: workflows on Ubuntu 26.04 and Node.js 24, also checked on Node.js 22; the CSV download separated by semicolons |
| 0.8 | Done: real frequencies from the Ligurian Wikipedia; a warning before `ñ` is saved under grafîa ofiçiâ |
| 0.9 | Done: elided words split at the apostrophe, in the editor and the keyboard; accents never needed, said plainly; the manager links to the keyboard page |
| 0.10 | Done: public codes for lemmas and forms; backups downloaded from the lexicon manager, with a tested restore |
| 0.11 | Done: batch review, the queue grouped by entry; downloads named by date and time; the install page links the editor and the dictionary in the language being read |
| 0.12 | Done: the dictionary for readers, a public section with an index by initial letter, a search by translation in Italian, Spanish and English, and a page for every entry |
| 0.13 | Done: the site in five sections, as clear buttons on every page; the manager's own tabs; Users as a section with each person's complete history; the dictionary's size everywhere; Ligurian words searchable in the dictionary; translations several at once, their language always chosen |
| 0.14 | Done: a checker for lexicon files, reporting every row that would be refused, duplicates, the words that open a menu and the manager's warnings |
| 0.15 | Repairs of the entries loaded by SQL before 0.12.1: every lemma whose senses were split one per translation reviewed by a person, one page each; translations' texts and languages corrected |
| 0.16 | Grammar for every form, base lemma included, in structured fields chosen by part of speech; the enrichment format published as a document |
| 0.17 | A structured import with a dry run and authors, carrying the grammar fields; the enrichment format for translations and definitions prepared outside the site; etymology, examples, definitions in four languages, usage labels and images in every entry; pronunciation in IPA by variety |
| 0.18 | Recordings by native speakers, with their consent and a free license |
| 0.19 | Hardening, contributor documentation; beta with speakers in Genoa |
| 1.0 | All criteria met |

Partnerships with the Académia Ligùstica do Brénno and A Compagna are sought throughout.

**The dictionary, a second purpose.** The same database is the framework of a trilingual Ligurian dictionary, whose first audience is the diaspora, above all in Latin America: people who often know Ligurian words by ear and read Spanish rather than Italian. Its first part arrived in 0.12, before the beta: a public section with an index by initial letter, a search by translation and a page for every entry at the address of its public code [decision [0034](docs/decisions/0034-dictionary-for-readers.md)]. After the keyboard's beta, without delaying 1.0.0, come Spanish translations of the most common words, and pronunciation [decision [0032](docs/decisions/0032-dictionary-second-purpose.md)].

**Other languages of Italy.** Once this project is mature, twin projects may serve other endangered languages of Italy, such as Lombard, Piedmontese or Friulian. So that one codebase can serve them, no new code states a fact about Ligurian where a fact about another language would have to be written instead; the facts already in the code move to a single place, one by one, as their code is next changed [decision [0036](docs/decisions/0036-built-for-more-than-one-language.md)]. Nothing in this delays the beta or 1.0.0.

## What is new in each version

Every change, file by file, is listed in [CHANGELOG.md](CHANGELOG.md).

* **0.14.3, 2026/10/20:** the fix of 0.14.2 did not work on the phone, and now should: a word typed in lowercase, such as `damasco`, becomes `damàsco` on the first space, not `Damàsco` on the second. The README no longer promises the editor's numbered menu on the phone, where Keyman's suggestion bar does that job.
* **0.14.2, 2026/10/20:** with Keyman 19's auto-correction, a word typed in lowercase becomes the lowercase form of a pair such as `damàsco` and `Damàsco`; the space bar reads "Lìgure - grafîa ofiçiâ"; the install page recommends Keyman 19 and shows how to make sure our dictionary is the one in use.
* **0.14.1, 2026/10/20:** the site builds again. The word frequency list still held 28 words written with the long s, `ſ`, from old texts quoted on the Ligurian Wikipedia, which 0.14.0 stopped accepting as letters; they are removed, and a test now reads the committed list.
* **0.14.0, 2026/10/20: a checker for lexicon files.** `npm run lexicon:validate -- <file.tsv>` reads a word list without changing it and reports, line by line, every row the engine or the database would refuse, rows repeated, the words for which the input method opens a menu, in the menu's order, approved forms with freq 0, and the manager's warnings about `ñ` and elision; its exit code tells a script whether the file may be used. The engine no longer accepts `ſ` or the Kelvin sign as letters, which the database always refused.
* **0.13.1, 2026/10/20:** the dictionary's subtitle names each language in itself, Ligurian as "lìgure".
* **0.13.0, 2026/10/20: the site in five sections.** The same five large buttons on every page, the current one filled: Write, Dictionary, Lexicon manager, Keyboard and Users, with the dictionary's size beneath them. The manager has its own tabs, Backups among them. Users is a section of its own, `/utenti/`, with each person's complete history to the second. The dictionary finds Ligurian words typed with or without accents, and each entry links to its other face in the manager and back. Translations can be added several at a time, separated by ";", and their language is always chosen.
* **0.12.1, 2026/10/19:** the review queue opens again after a load of thousands of entries: it comes in pages of 50 entries, with the totals, and reads only the pending rows. A tested SQL template adds entries in the right shape from the SQL Editor.
* **0.12.0, 2026/10/18: the dictionary for readers.** A public section, <https://ignatz-castror.github.io/ligurian-keyboard/dizionario/>, open to everyone: an index by initial letter as on Wiktionary, a search by translation in Italian, Spanish or English that ignores accents, and a page for every entry at the address of its public code. The editor, the install page and the manager link to it.
* **0.11.2, 2026/10/18:** the backup button works on a dictionary of any size: the lexicon manager assembles the file from small reads instead of one long request, and shows how many rows it has read.
* **0.11.1, 2026/10/18:** the backup button works again on a larger dictionary, with a time limit of 60 seconds instead of Supabase's 8, and a clear message if even that is exceeded; the install page keeps its links and language links in view while scrolling.
* **0.11.0, 2026/10/18: batch review.** The review queue is grouped by entry, each lemma with its pending forms, senses and translations, and a sense without a definition is no longer shown as a bare number. Reviewers select rows, whole entries or everything, Shift+click for a range, and approve or reject them in one call; approving an entry approves its parts; rows changed by someone else meanwhile are listed with the reason and left pending, never overwritten. The TSV and CSV downloads carry the date and time in their names. The install page links both the editor and the dictionary, in Italian, English or Spanish as the reader is reading.
* **0.10.0, 2026/10/18: public codes and backups.** Every lemma and form receives a code such as `LIJ-7K3Q9MDXK`, which never changes and is never reused, shown in the lexicon manager and searchable there, with a check symbol that catches a mistyped code. Admins download the whole dictionary as one JSON file and can restore it, exactly, into a new and empty dictionary.
* **0.9.0, 2026/10/17: elided words.** `d'aegua` becomes `d'ægua` from the entries `d'` and `ægua`, in the editor and in the Android keyboard alike; the manager warns before a particle and a word are saved as one form, and links to the keyboard page; the install page says plainly that accents are never needed.
* **0.8.3, 2026/10/17:** a stray apostrophe is no longer counted as a word; the snapshot's frequency line says how many rows were found in the list; two invisible characters written as escapes, and a test that forbids them anywhere.
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

Quando le stesse lettere portano a più parole, si sceglie quella giusta: da un menu numerato nell'editor web, come con le tastiere giapponesi del computer, o dalla barra dei suggerimenti sul telefono. Il progetto nasce per sostenere la rivitalizzazione della lingua ligure; codice e dati sono aperti.

### L'obiettivo a lungo termine: un editor di testo ligure

Questo progetto è la base di un obiettivo più ampio: **un editor di testo ligure completamente integrato, per computer, telefoni e tablet**, con controllo ortografico, testo predittivo e correzione automatica, che non si limita a scrivere ogni parola nella grafia giusta, ma aiuta chi scrive a produrre un ligure corretto. L'editor sarà **un progetto separato, in un repository proprio, costruito su questo:** userà come base il motore di conversione, il dizionario condiviso e revisionato, i suoi codici pubblici, gli elenchi di frequenza e, presto, il generatore delle forme flesse. Qui quei componenti funzionano già in produzione, dentro un metodo di scrittura usato ogni giorno, e ognuno viene messo alla prova da chi scrive davvero prima che l'editor ne dipenda.

L'editor aggiungerà tre livelli di correzione a quello che il metodo di scrittura offre già:

| Livello | Che cosa corregge | Esempio |
|---|---|---|
| **0. Ripristino della grafia** [oggi] | Le lettere semplici diventano grafîa ofiçiâ | `zeneize` → `zenéize` |
| **1. Correzione ortografica guidata dalla pronuncia** | Grafie che seguono la pronuncia, o le abitudini dell'italiano, invece della grafia ufficiale | `sun` → `són` |
| **2. Normalizzazione lessicale** | Prestiti e calchi dall'italiano per cui il ligure ha una parola sua | un italianismo comune → il suo equivalente ligure |
| **3. Normalizzazione idiomatica** | Costrutti copiati dall'italiano, sostituiti dal costrutto ligure, flesso in accordo con il contesto | `dovéi` → `avéighe da` |

* **Le correzioni sono proposte, mai sostituzioni silenziose.** Oltre il livello 0, ogni correzione mostra il motivo e la voce del dizionario da cui nasce, e chi scrive la accetta o tiene il proprio testo: un italianismo può essere voluto, citato o radicato in una varietà.
* **Ogni regola è un dato, non codice.** Una forma o un costrutto da correggere è una voce del dizionario revisionato, collegata con il suo codice pubblico all'equivalente preferito, con la sua varietà e il suo significato. Decidono i parlanti nativi e i linguisti, non i programmatori, e le regole sono pubblicate come dati aperti sotto CC BY-SA 4.0.
* **Il livello 1 si fonda su un modello degli errori,** una tabella delle corrispondenze tra suoni e grafia della grafîa ofiçiâ; **il livello 3 sul generatore delle forme flesse,** perché sostituire `dovéi` con `avéighe da` vuol dire coniugare `avéighe` nella persona, nel numero, nel tempo e nel modo del verbo sostituito.
* **Ogni livello si costruisce solo quando esistono i dati,** e dopo una decisione registrata apposta.

Questo repository resta un metodo di scrittura, il modo di scrivere in ligure nelle app che si usano già; l'editor sarà un secondo prodotto, in un repository proprio, costruito sulle sue fondamenta.

### Come usarlo, subito

| Cosa | Dove | Da installare |
|---|---|---|
| **Editor web**: scrivere in ligure nel browser, su computer o telefono | <https://ignatz-castror.github.io/ligurian-keyboard/> | niente |
| **Tastiera Android**: scrivere in ligure in tutte le app | <https://ignatz-castror.github.io/ligurian-keyboard/tastiera/> | l'app gratuita Keyman, poi due pacchetti |
| **Dizionario**: sfogliarlo lettera per lettera, cercare una parola ligure scritta con o senza accenti, o trovarla dalla sua traduzione italiana, spagnola o inglese | <https://ignatz-castror.github.io/ligurian-keyboard/dizionario/> | niente |
| **Gestore del lessico**: cercare per lettere semplici, proporre e revisionare parole | <https://ignatz-castror.github.io/ligurian-keyboard/admin/> | niente; un account per proporre |
| **Utenti**: il proprio profilo e tutto ciò che si è scritto; per i revisori, la cronologia completa di tutti | <https://ignatz-castror.github.io/ligurian-keyboard/utenti/> | un account |
| **Codice sorgente** di ogni versione | <https://github.com/Ignatz-CastroR/ligurian-keyboard/releases> | Node.js, per compilarlo |

### Che cosa si può scaricare

* **La tastiera**, `ligurian_keyboard.kmp`, e **il dizionario**, `ignatzcastror.lij.ligurian_keyboard.model.kmp`, dalla pagina di installazione. Il dizionario viene ricostruito ogni giorno con le parole approvate; la sua versione è la sua data, per esempio `2026.10.17`.
* **L'elenco delle parole approvate**, in formato TSV o CSV: aggiornato al momento, dai pulsanti "Scarica TSV" e "Scarica CSV" del dizionario, in file che portano nel nome la data e l'ora dello scaricamento; oppure la copia del giorno, da cui sono costruiti l'editor e la tastiera: <https://ignatz-castror.github.io/ligurian-keyboard/lexicon.tsv>.
* **Il proprio testo**, come file `.txt`, dall'editor.
* **Il codice sorgente** di ogni versione, dalla pagina Releases di GitHub; dalla 0.5.0 ogni versione porta con sé anche i due pacchetti per Keyman.

**Quale versione scegliere:** il sito offre sempre l'ultima versione funzionante, con il dizionario del giorno. Non esiste ancora una versione stabile: fino alla 1.0.0 ogni versione è pubblicata come *pre-release*, e tutto può ancora cambiare.

### Come funziona

* **Lo scheletro.** Ogni parola del dizionario ha uno "scheletro": le lettere semplici con cui la si scrive. Si calcola togliendo gli accenti alle vocali, trasformando `æ` in `ae`, `ç` in `c` e `ñ` in `n`, uniformando gli apostrofi e togliendo i trattini, secondo l'*Arfabêto* dell'Académia. Ciò che si scrive viene ridotto allo stesso modo e cercato nel dizionario.
* **Nell'editor web**, la parola viene sostituita quando si preme lo spazio: se c'è una sola grafia, subito; se ce ne sono di più, appare un menu; se la parola è sconosciuta, resta com'è. Le maiuscole e la punteggiatura si conservano; Backspace subito dopo annulla la conversione. L'editor funziona anche senza connessione dopo la prima visita, e il testo non lascia mai il browser.
* **Nella tastiera Android**, che funziona dentro l'app gratuita **Keyman** di SIL Global, le grafie compaiono nella barra dei suggerimenti mentre si scrive; con Keyman 19, ancora in prova, la parola diventa ligure da sola premendo lo spazio, con Keyman 18 si tocca quella giusta. Sulla barra dello spazio la tastiera si chiama «Lìgure - grafîa ofiçiâ». Tenendo premute le vocali, la `c` e la `n` si ottengono tutte le lettere liguri, `ñ` compresa; c'è un tasto per l'apostrofo; la maiuscola arriva da sola a inizio frase, e due tocchi su Maiusc bloccano le maiuscole. Sui computer Keyman non offre suggerimenti: lì si usa l'editor web.

### Il dizionario

Il dizionario condiviso è un database dove i collaboratori propongono parole, con le loro forme, i significati numerati, le definizioni in italiano e le traduzioni in italiano, spagnolo e inglese. I revisori le approvano, anche molte insieme: la coda di revisione raggruppa ogni lemma con le sue forme, i suoi significati e le sue traduzioni in attesa, e approvare la voce approva tutte le sue parti. Solo le parole approvate arrivano all'editor e alla tastiera, entro un giorno. Nulla viene mai cancellato davvero, ogni modifica resta nella cronologia, e le regole sono imposte dal database stesso. Ogni voce registra la sua varietà, `zeneize` per impostazione predefinita, e il suo sistema di scrittura, `ofiçiâ` per impostazione predefinita. Ogni lemma e ogni forma ha un codice pubblico, come `LIJ-7K3Q9MDXK`, che non cambia mai, e gli amministratori possono scaricare una copia di sicurezza di tutto il dizionario. Le parole vengono solo dalla conoscenza dei collaboratori o da fonti con licenza libera: nessun dizionario protetto da diritto d'autore viene copiato. Gli account li crea un amministratore: chi vuole contribuire può chiederne uno. Tutto il sito, l'editor, la pagina del dizionario e quella della tastiera, è in italiano, inglese e spagnolo; il gestore del lessico mostra sotto il campo di ricerca le 20 voci approvate aggiunte più di recente. Il **dizionario per i lettori**, <https://ignatz-castror.github.io/ligurian-keyboard/dizionario/>, aperto a tutti senza account, ha un indice per lettera iniziale come Wikizionario, con le vocali accentate sotto la loro lettera e `æ` e `ç` come lettere proprie, una ricerca per traduzione in italiano, spagnolo o inglese che ignora gli accenti, e una pagina per ogni voce all'indirizzo del suo codice pubblico.

### Limiti attuali

* La tastiera non è ancora stata provata da parlanti nativi sui loro telefoni; ogni segnalazione è benvenuta.
* La `æ` scritta con la pressione prolungata dà probabilmente suggerimenti più deboli di `ae`; scrivere `ae` funziona sempre.
* Le forme elise si dividono all'apostrofo: `d'aegua` dà `d'ægua` dalle voci `d'` e `ægua`, quindi il dizionario ha bisogno di ogni particella e di ogni parola una volta sola. Le particelle `d'`, `l'`, `quell'` e le altre vanno però inserite nel dizionario.
* Le frequenze delle parole vengono dalla Wikipedia in ligure, scritta per lo più in grafîa ofiçiâ: i suoi testi sono enciclopedici, quindi le parole di tutti i giorni possono risultare meno frequenti che nel parlato.

### Verso la versione 1.0.0

La 1.0.0 arriverà quando ci saranno: la tastiera Android provata sul campo, qualche migliaio di forme approvate con frequenze reali, regole e formati congelati, le questioni aperte risolte, alcune settimane d'uso reale a Genova, e copie di sicurezza regolari del database. Il percorso: frequenze reali [0.8, fatto], forme elise divise all'apostrofo [0.9, fatto], codici pubblici per lemmi e forme e copie di sicurezza scaricate dal gestore del lessico [0.10, fatto], revisione di più voci insieme, con la coda raggruppata per voce [0.11, fatto], il dizionario per i lettori, con un indice per lettera iniziale e la ricerca per traduzione [0.12, fatto], la struttura del sito, con le cinque sezioni su ogni pagina e una sezione Utenti propria [0.13, fatto], un controllo dei file del lessico, riga per riga [0.14, fatto], strumenti per riparare le voci caricate via SQL [0.15], la grammatica di ogni forma, lemma compreso [0.16], importazione strutturata con verifica e voci più ricche, con etimologia, esempi, definizioni in quattro lingue, etichette d'uso e immagini [0.17], registrazioni di parlanti nativi [0.18], documentazione e prova con parlanti genovesi [0.19]. Lo stesso database è anche la struttura di un dizionario trilingue, pensato prima di tutto per i discendenti dei liguri emigrati, soprattutto in America Latina: dopo la prova a Genova arriveranno le traduzioni spagnole delle parole più comuni e la pronuncia.

### Contribuire

Sono benvenuti parole, correzioni, traduzioni, codice e revisioni di parlanti nativi, in italiano, in ligure, in spagnolo o in inglese: vedi [CONTRIBUTING.md](CONTRIBUTING.md). Le associazioni genovesi interessate possono aprire una *issue*.

### Licenze e indipendenza

Il codice è sotto licenza MIT, i dati del dizionario sotto CC BY-SA 4.0. Le regole di grafia seguono l'*Arfabêto* dell'Académia Ligùstica do Brénno; la tastiera Android si basa su Keyman di SIL Global. Il progetto è indipendente e non è affiliato né approvato dall'Académia Ligùstica do Brénno, da A Compagna, da SIL Global o da altre organizzazioni.
