# editor: the web editor

**Scrivi in ligure.** The page where anyone types Ligurian in plain letters and gets grafîa ofiçiâ, using the published dictionary. It is the front page of the site: <https://ignatz-castror.github.io/ligurian-keyboard/>. Plain TypeScript, built with [Vite](https://vite.dev). Design: decisions [0019](../docs/decisions/0019-editor-dictionary-snapshot.md) and [0020](../docs/decisions/0020-web-editor-design.md).

## How to use it

| You do | It does |
|---|---|
| Type a word and press space or Enter | One spelling: the word is replaced. Several: a menu opens |
| `1` to `9` | Choose that spelling |
| Arrows up and down, then Enter or Tab | Choose the highlighted spelling |
| Escape, or the last menu entry | Keep the word as typed |
| Keep typing with the menu open | Accept the highlighted spelling |
| Backspace right after a conversion | Undo it: the typed word comes back |
| Ctrl+Z | The browser's own undo, conversions included |

On a phone the menu is a bar above the keyboard; tap a spelling. The text must then be copied into the app where it is going: typing straight into other apps is the job of the Android keyboard, installed from the page `/tastiera/` [see [keyman/README.md](../keyman/README.md)].

The text stays in the browser between visits and is never sent anywhere. After one visit the page also works without a connection.

## Where the words come from

The editor never talks to the database. When the site is built, `tools/fetch-lexicon.ts` takes a **snapshot** of the published dictionary [`export_lexicon_tsv()`], checks it and saves it as `editor/public/lexicon.tsv`; the editor downloads that file. The workflow rebuilds the site every day at 03:17 UTC, so a word approved today reaches the editor by tomorrow. To publish at once: GitHub → **Actions → Site on GitHub Pages → Run workflow**.

## Files

| File | Contents |
|---|---|
| `index.html` | The page shell |
| `src/ime.ts` | Every decision of the input method, as pure functions: which word was finished, replace or menu, choose, undo |
| `src/snapshot.ts` | Reading, stamping and checking the dictionary snapshot; shared with the build tools |
| `src/main.ts` | The page: events, the menu, filters, copy, download, draft |
| `src/messages.ts` | Every text, in Italian, English and Spanish; the language menu's entries |
| `src/dom.ts` | The page building helper; never `innerHTML` |
| `src/style.css` | Light and dark look, phone layout |
| `public/sw.js` | Offline copy of the page and the dictionary |
| `public/tastiera/index.html` | Install page of the Android keyboard; the site build puts the two Keyman packages next to it |
| `test/editor.test.ts` | 17 tests of `ime.ts`, `snapshot.ts` and the messages, including the three languages |
| `vite.config.ts` | Build settings |

## Running it on your computer

Without Supabase, on the 93-form test fixture:

```
npm run lexicon:fixture
npm run editor:dev
```

With your real dictionary [needs the root `.env`, see `.env.example`]:

```
npm run lexicon:snapshot
npm run editor:dev
```

Open the address Vite prints. Ctrl+C stops it.

To try the whole site as GitHub Pages serves it, with the editor, the manager, the install page and the Keyman packages:

```
npm run site:build
npm run site:preview
```

`site:build` needs a snapshot first; it writes `_site/`, ignored by git.

## Known limits

* **Candidate order follows the Ligurian Wikipedia:** the most used spelling first, from the committed frequency list [`data/frequencies/`, decision [0027](../docs/decisions/0027-real-frequencies.md)]. Encyclopedic prose is not everyday speech, so a common spoken word may still come second. Without the list, the order is alphabetical.
* **Some phone keyboards autocorrect anyway,** turning plain ASCII Ligurian into Italian words before the editor sees it. If that happens, switch off autocorrect in the phone keyboard's settings while writing Ligurian.
* **A conversion cannot be undone after the caret has moved;** retype the word instead.
