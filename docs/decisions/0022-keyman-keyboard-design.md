# 0022: Design of the Keyman keyboard and dictionary

* **Status:** accepted
* **Date:** 2026/10/17
* **Decided by:** Iosef Tesla R. [Ignatz-CastroR]
* **Refines:** [0021](0021-keyman-scope-and-toolchain.md), point 3: the key function is a hand-written copy guarded by tests, not generated from the engine's source

## Context

Decision [0021](0021-keyman-scope-and-toolchain.md) fixed what version 0.5.0 delivers: an Android keyboard and a lexical model built from the daily dictionary snapshot, compiled with `kmc` from npm and distributed by the project itself. This record fixes how the two are built and how they behave.

## Decision

### The keyboard: `ligurian_keyboard`

* **Name shown to users:** "Ligure [grafîa ofiçiâ]"; language code `lij`; targets phones and tablets.
* **Layout:** Italian QWERTY, the layout most users already know. Long press gives every Ligurian letter, in a fixed order: grave, acute, circumflex, diaeresis, as in the *Arfabêto*:
  * `a`: à á â ä æ
  * `e`: è é ê ë; `i`: ì í î ï; `o`: ò ó ô ö; `u`: ù ú û ü
  * `c`: ç

  These are exactly the non-ASCII letters `skeleton()` folds; a test keeps the two sets identical in both directions, in lower case and in capitals. A dot on the key shows that it has a long press.
* **An apostrophe key on the main layer,** because Ligurian elides constantly [`l'`, `d'`, `ch'`]; typographic quotes on its long press.
* **Layers:** lower case, Shift, caps lock and numbers. A capital comes by itself at the start of the text and after `. ! ? …` plus a space; one tap on Shift gives one capital; a double tap locks capitals. The layer logic is SIL EuroLatin's, the reference keyboard for European languages. The double tap needs **Keyman 17 or newer**, so the keyboard declares 17.0.
* **Every key that types a character has a `U_XXXX` id,** so it types exactly that character on any layer, with no rules in the `.kmn` file.
* **The layout file is generated** from `keyman/src/touch-layout.ts` by `npm run keyman:layout`, never edited by hand; a test fails when the committed file differs. The JSON is about 2,600 lines; a short description with tests is reviewable, the raw file is not.

### The dictionary: `ignatzcastror.lij.ligurian_keyboard`

* **Words:** the approved **zeneize** forms in **ofiçiâ**, the defaults of decision [0004](0004-orthography-and-variety-per-entry.md). Other varieties will get their own models, with their own unique part, when they have words.
* **Search key:** `searchTermToKey` is a self-contained copy of `skeleton()`, written in the subset Keyman can run on old phones [ES3, no `Map`, no `for..of`, no regular expression `u` flag]. Keyman compiles it into the model as text, so it cannot import the engine. Tests prove that it equals `skeleton()` on every character up to U+02FF, on every fixture word in four forms and on 5,000 pseudo-random strings, **both in the source and inside the compiled model**, which the tests load in an isolated JavaScript context to capture what it hands to Keyman. That proves what the model contains; that old phones can run it comes from `kmc` transpiling it to ES3. A copy written by hand and proven equal by tests replaces the generation from the engine's source that 0021 foresaw: generating the code would add a build step with its own failure modes, while the proof is the same as for the database copy [0017]. The folding now lives in three places, engine, database [0017] and keyboard, each guarded by a test. The function allocates nothing per call, because Keyman calls it for every typed character while searching for corrections.
* **Casing:** `languageUsesCasing` is on, so `Penna` at the start of a sentence suggests `Pénna`, and `Zêna` keeps its capital.
* **Hyphens:** the word breaker keeps `canpànn-a` as one word, as the engine does.
* **Counts:** whole numbers of at least 1. Keyman never offers a word whose count is 0, and an approved word must always be reachable.
* **Version:** the snapshot's UTC date as `YYYY.M.D`, for example `2026.10.17`. A newer dictionary always has a higher version, and anyone can read the dictionary's date from it. The committed `.model.kps` keeps the placeholder `0.0.0`.
* **License:** the package holds CC BY-SA 4.0 data and MIT code, and says so in its `LICENSE.md`.

### The build

* `tools/build-keyman.ts` [`npm run keyman:build`] reads the same snapshot as the web editor, so the keyboard and the editor always offer the same words.
* It **copies both projects into a staging folder** and writes the word list and the version there; the committed sources are never modified by a build.
* `kmc` is pinned **exactly** to 18.0.254, runs with **warnings treated as errors** and always with `--no-error-reporting`, so no build sends anything to Keyman's error reporting service.
* A bad snapshot, an empty dictionary or a `kmc` failure stops the build with every reason, and leaves the previous packages untouched.

### Distribution

* **The site:** `/tastiera/` holds an install page in Italian and English and both packages, rebuilt with the site every day. The editor's header links to it.
* **Releases:** `release-assets.yml` attaches both packages to every release as soon as it is published.

## Consequences

* **Installation takes two packages.** `kmc` refuses a package that holds both a keyboard and a lexical model [error `PackageCannotContainBothModelsAndKeyboards`]; Keyman pairs the two by the language code `lij`.
* **Suggestions themselves cannot be tested automatically.** Keyman's prediction engine is not published as a package. The tests check everything Keyman receives [the key function, the word index, the options, the package contents]; whether the banner behaves well is checked on a real phone.
* **`æ` typed with the long press probably gets weaker suggestions than `ae` typed in plain letters.** While searching for corrections, Keyman 18 turns each typed character into a key on its own and compares it with single characters of the dictionary's index; `æ` becomes `ae`, two characters, so it never matches and every such word costs edits. `ç` and the hyphen are not affected. No fix exists inside Keyman's word list models without breaking the identity with `skeleton()`; typing `ae` works fully, and the phone checklist in `keyman/README.md` measures how bad the long press case is.
* **Rows are 1150 units wide.** Keyman puts a 15 unit gap before every key and stretches the last key of any shorter row, so every row is computed to the same width with Keyman's own arithmetic, which a test repeats.
* **Elided forms are one word.** Like the engine, Keyman's default word breaker keeps `l'ægua` together, so it gets a suggestion only if the dictionary holds `l'ægua` itself. Whether to split at the apostrophe, in the engine and in the keyboard together, is an open question for the native contributors.
* **Updating the dictionary on the phone means installing the package again.** Self-distributed packages do not update themselves; that comes only with Keyman's official repository [0021].
