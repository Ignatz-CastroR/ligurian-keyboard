# Word frequencies

`lijwiki.tsv`, once committed, holds how many times each word appears in the articles of the **Ligurian Wikipedia** [<https://lij.wikipedia.org/>]. The daily site build adds these counts to the dictionary's own frequencies, so that the web editor's menu and the Android keyboard's suggestions put the most used spelling first [decision [0027](../../docs/decisions/0027-real-frequencies.md)].

## The file

* UTF-8 text with LF line endings.
* Comment lines start with `#`. Three are required: `# Source:` names the dump that was counted, `# Orthography:` the spelling system of its text [`ofiçiâ`], `# Counted:` the time of the count in UTC.
* Then the header `form<TAB>count` and one row per word: the word in lower case, NFC, with ASCII apostrophes, and how many times it appears.
* Rows are sorted by form, so a recount shows in `git diff` only where the counts changed.
* Words seen only once are left out.

`corpus/src/frequency-list.ts` writes and reads the file; a damaged file stops the site build, and the site keeps its last good version.

## Making a new count

1. On GitHub: **Actions → Frequencies from the Ligurian Wikipedia → Run workflow**. Leave `latest` to use the newest finished run, or give a run's date as YYYYMMDD. The step "Find the dump" prints every run it tried and why it took or skipped it.
2. When the run is green, download the artifact `frequencies-lijwiki-YYYYMMDD` from the run's page and unzip it.
3. Put `lijwiki.tsv` in this folder, replacing the old one.
4. Read the change with `git diff --stat` and a look at the first lines: the `# Source:` line must name the new dump, and the number of words should be close to the old one.
5. Commit and push. The Pages build that follows ranks the dictionary with it.

On a computer, the same count runs with `npm run frequencies:count`; see `corpus/README.md`.

## License and attribution

The counts are derived from the text of the Ligurian Wikipedia, written by its contributors and published under the Creative Commons Attribution-ShareAlike 4.0 license [CC BY-SA 4.0]: <https://creativecommons.org/licenses/by-sa/4.0/>. The counts are published under the same license, as is all data in this repository.

Attribution: "Word counts derived from the Ligurian Wikipedia [lij.wikipedia.org], by its contributors, CC BY-SA 4.0; counted by ligurian-keyboard."
