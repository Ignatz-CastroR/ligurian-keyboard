# 0027: Real frequencies from the Ligurian Wikipedia

* **Status:** accepted
* **Date:** 2026/10/17
* **Decided by:** Eng. José Ignacio Castro de R.
* **Supersedes:** the point "Frequencies" of [0009](0009-data-sources.md), on normalizing the corpus
* **Refines:** [0019](0019-editor-dictionary-snapshot.md), on what the snapshot's frequencies are

## Context

When several spellings share one ASCII key, the web editor's menu and the keyboard's suggestion bar list them by frequency. Until now every frequency was the database's default 1, so the order was alphabetical: `penna` offered `pénn-a` before `pénna` only because of the alphabet. Decision [0009](0009-data-sources.md) promised frequencies counted from a freely licensed body of text, such as the Ligurian Wikipedia.

The Ligurian Wikipedia writes in the grafîa ofiçiâ of the Académia Ligùstica do Brénno, the project's default spelling system, and its text is under CC BY-SA 4.0, the license of the project's data [decision [0003](0003-open-data-and-licenses.md)]. Wikimedia publishes a complete dump of it about twice a month.

## Decision

* **The corpus is the Ligurian Wikipedia,** read from Wikimedia's `pages-articles` dump: articles only [namespace 0], no redirects, with the wiki markup stripped [`corpus/src/wikitext.ts`]. The stripper is an approximation built for counting, documented in its file; markup that slips through does no harm, because only valid Ligurian words are counted and a count only matters against spellings with the same ASCII key.
* **No normalization of the text.** 0009 imagined normalizing mixed spellings to grafîa ofiçiâ first. The Ligurian Wikipedia already writes it, and a normalizer would itself be a dictionary nobody has yet. A word written in another system simply matches no ofiçiâ form and counts for nothing.
* **What a word is:** a run of letters, apostrophes and hyphens that passes the engine's own `isValidForm`, counted under its frequency key: NFC, lower case, typographic apostrophes made ASCII [`corpus/src/count.ts`]. A word with an apostrophe inside counts whole and in its parts: `l'ægua` counts `l'ægua`, `l'` and `ægua`. The parts never share an ASCII key with the whole, so they cannot distort a ranking; they let `ægua` be found in elided text.
* **The counts are a committed file,** `data/frequencies/lijwiki.tsv`, sorted by form so that a recount shows as a readable diff, without words seen only once. Its header records the dump, the spelling system and the time of the count [`corpus/src/frequency-list.ts`].
* **Counting runs on GitHub, by hand,** in the workflow "Frequencies from the Ligurian Wikipedia" [`.github/workflows/frequencies.yml`]. It downloads the dump, checks it against Wikimedia's SHA-1 list, counts it and offers the file as an artifact. A person downloads it, reads the diff and commits it. The job has no write permission: nothing reaches the repository without a person [as in [0026](0026-workflow-runtimes.md)]. A few recounts a year are plenty.
* **The snapshot adds, it never replaces.** When the daily snapshot is taken [decision [0019](0019-editor-dictionary-snapshot.md)], each row written in the list's spelling system gets freq = the database's freq + the corpus count. The database's default 1 thus acts as add-one smoothing, so an unseen word still ranks; and a reviewer can still raise a word by raising its freq in the manager. A frequency list that fails to read stops the build, like a bad snapshot. Without a list, the database's frequencies are used as they are.
* **The database is not written to.** The counts live in the repository, not in the `freq` column: writing them there would need the secret key in a workflow and would fill the audit log with machine edits.

## Consequences

* The editor's menu and the keyboard's suggestion bar put the spelling the Ligurian Wikipedia uses most often first. The editor and the Keyman dictionary read the same snapshot, so they always agree.
* The snapshot's `freq` is a ranking weight, no longer the database's value; the manager's TSV and CSV downloads still show the database's own. `docs/lexicon-format.md` says so.
* **Known limits:**
  * Wikipedia's prose is encyclopedic, and some of its articles are generated stubs, so everyday words may rank lower than in speech.
  * A form spelled the same in the grafîa ofiçiâ and in a careless spelling of another word inherits that word's count.
  * Most articles are in zeneize; the counts are applied to every variety written in ofiçiâ.

  A second corpus can be added later as another file with the same format.
* The counts are derived from CC BY-SA 4.0 text and are published under the same license, with attribution, in `data/frequencies/README.md`.
