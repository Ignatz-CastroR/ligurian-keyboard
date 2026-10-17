# keyman

The Ligurian keyboard for phones and tablets, built on [Keyman](https://keyman.com/) by SIL Global, and its dictionary. Users install both from the site's install page, `/tastiera/`.

Decisions: [0021](../docs/decisions/0021-keyman-scope-and-toolchain.md) [scope, toolchain, distribution] and [0022](../docs/decisions/0022-keyman-keyboard-design.md) [design].

## What is here

| Path | What it is |
|---|---|
| `ligurian_keyboard/` | Keyman keyboard project: layer logic [`.kmn`], on-screen layout [`.keyman-touch-layout`], package [`.kps`], the pages Keyman shows on install |
| `ignatzcastror.lij.ligurian_keyboard/` | Keyman lexical model project [the dictionary]: model definition with the search key function, package, install pages |
| `src/touch-layout.ts` | The on-screen layout as a short description; writes the `.keyman-touch-layout` file |
| `src/wordlist.ts` | Dictionary snapshot to Keyman word list; the model's dated version |
| `src/build.ts` | Staging, compilation with `kmc`, packaging |
| `test/` | 30 tests, including a real `kmc` build checked from the inside |
| `build/`, `dist/` | Generated, gitignored: the staged projects and the finished packages |

## Commands, from the repository root

| Command | What it does |
|---|---|
| `npm run keyman:build` | Build both packages into `keyman/dist/` from `editor/public/lexicon.tsv`; run `npm run lexicon:snapshot` or `npm run lexicon:fixture` first |
| `npm run keyman:layout` | Rewrite the `.keyman-touch-layout` file after a change to `src/touch-layout.ts`; commit both |
| `npm run test:keyman` | The Keyman tests only |

`npm run site:build` runs `keyman:build` too, and puts both packages under `_site/tastiera/`.

## Rules for changing anything here

* **Never edit `ligurian_keyboard.keyman-touch-layout` by hand.** Change `src/touch-layout.ts`, run `npm run keyman:layout`, commit both.
* **Never import anything into the model's `.model.ts`.** Keyman copies `searchTermToKey` into the compiled model as text and runs it on old phones: it must stay self-contained and ES3 compatible. Its header lists what is allowed.
* **A change to the folding rules** touches four places; see "The Keyman mirror" in [`docs/skeleton-spec.md`](../docs/skeleton-spec.md).
* **The keyboard version** in the `.kmn` [`&KEYBOARDVERSION`] must equal `version` in `package.json`; a test checks it. The dictionary's version is set by the build from the snapshot's date; the committed `.model.kps` keeps `0.0.0`.
* **`kmc` is pinned exactly** in `package.json`. Upgrading it is a deliberate change: rebuild, read every message, run all tests.

## Testing on a phone

The tests cannot run Keyman's prediction engine, which is not published as a package. After every change that affects behavior:

1. Build with the 93 test words: `npm run lexicon:fixture`, then `npm run keyman:build`. The real dictionary may not hold the words below yet.
2. Copy both files from `keyman/dist/` to the phone and install them as the install page explains.
3. Check: `zena` suggests `Zêna`; `citae` suggests `çitæ`; note whether `çitæ` typed with the long press letters also suggests `çitæ`, and how high [decision 0022, Consequences, expects it may not]; `canpanna` suggests `canpànn-a`; `penna` offers `pénna` and `pénn-a`; a capital comes at the start of a sentence; long press on every vowel, on `c` and on `n`; a double tap on Shift locks capitals.
4. Afterwards, install the dictionary from the site again, to go back to the real words. Both carry the same day's date as their version; if Keyman refuses to replace one with the other, remove the test dictionary first [Keyman help: "Removing Dictionaries"].
