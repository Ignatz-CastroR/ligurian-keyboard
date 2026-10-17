# corpus

Counts the words of the Ligurian Wikipedia, so that spellings sharing one ASCII key can be ranked by use [decision [0027](../docs/decisions/0027-real-frequencies.md)].

## The parts

| File | What it does |
|---|---|
| `src/dumps.ts` | Chooses the dump: the newest run whose articles job Wikimedia's `dumpstatus.json` reports as done, with its SHA-1 |
| `src/wikitext.ts` | Splits a MediaWiki XML dump into pages as it arrives, keeps the articles [namespace 0, no redirects], strips the wiki markup |
| `src/count.ts` | Finds the words of plain text the way the editor sees them, and counts them under their frequency key |
| `src/frequency-list.ts` | Writes and reads `data/frequencies/lijwiki.tsv`, and adds its counts to a dictionary snapshot |
| `test/corpus.test.ts` | 10 tests, on wikitext and dumps written for the tests |
| `test/dumps.test.ts` | 5 tests, on run lists and status files written for the tests |
| `../tools/find-dump.ts` | The command line that asks dumps.wikimedia.org which run to use, for the workflow |
| `../tools/count-frequencies.ts` | The command line: a dump in, the frequency list out |

All four source files are pure functions, without files or network, and are tested in Node.

## What counts as a word

* A run of letters, apostrophes and hyphens that the engine's `isValidForm` accepts. Digits and punctuation separate words; a word holding a letter Ligurian never writes, such as `ł`, is not counted.
* Counted under its **frequency key**: NFC, lower case, typographic apostrophes and hyphens made ASCII. `Zêna` and `zêna` are one word; `pénna` and `penna` are two.
* Hyphens at the edges are dropped; apostrophes at the edges stay, as in `'na` and `pe'`.
* A word with an apostrophe inside counts whole and in its parts: `l'ægua` counts `l'ægua`, `l'` and `ægua`.

## What the markup stripper drops

Comments; references, formulas, code, galleries, timelines and similar elements with their content; templates and template parameters; tables; file, category and interwiki links; external link addresses; HTML tags; behavior switches such as `__NOTOC__`; bold and italic quotes. The visible text of links, headings and lists stays. It is an approximation for counting, not a renderer.

## Counting on a computer

The workflow on GitHub is the usual way [`data/frequencies/README.md`]. By hand:

1. Run `node tools/find-dump.ts` to learn the newest finished run, its file, its address and its SHA-1; download that file and check it with `sha1sum` or, on Windows, `certutil -hashfile <file> SHA1`.
2. Uncompress it: `bzip2 -dk` on Linux or macOS, 7-Zip on Windows.
3. Run, from the repository root:

   ```
   npm run frequencies:count -- --source "Ligurian Wikipedia [lij.wikipedia.org], dump lijwiki-YYYYMMDD-pages-articles" lijwiki-YYYYMMDD-pages-articles.xml
   ```

   `-` instead of the file name reads standard input, so on Linux `bzip2 -dc dump.xml.bz2 | npm run frequencies:count -- --source "..." -` needs no uncompressed copy. Options: `--orthography` [default `ofiçiâ`], `--out` [default `data/frequencies/lijwiki.tsv`], `--min-count` [default 2].

Dumps are gitignored; never commit one.
