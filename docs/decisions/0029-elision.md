# 0029: Elided words are split at the apostrophe

* **Status:** accepted
* **Date:** 2026/10/17
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refines:** [0020](0020-web-editor-design.md), on how the editor converts a word; [0022](0022-keyman-keyboard-design.md), on the keyboard's word breaker and elided forms; [0018](0018-lexicon-manager-design.md), on what the manager checks before saving

## Context

Ligurian elides constantly: `d'ægua`, `l'ægua`, `quell'òmmo`, `d'avéi`. Until 0.8.3 the engine and the keyboard treated each such spelling as one word, so the dictionary would have needed `ægua`, `d'ægua`, `l'ægua` and every other combination of every particle with every word, each typed and reviewed on its own. That cannot scale, and it was the open question recorded in [0022](0022-keyman-keyboard-design.md).

## Decision

* **The particles live in the dictionary,** as ordinary entries: `d'`, `l'`, `quell'`, each entered once by contributors and approved by reviewers, like any wordform. Nothing is hardcoded, so a particle nobody foresaw needs no new version of the software. The alternative, a closed list in the code, was rejected: every new particle would have needed a release and four copies kept identical, as the folding rules do.
* **One rule splits a word,** `splitElision` in `engine/src/elision.ts`: after every apostrophe [`'`, `’`, `‘`, `ʼ`] with a letter right before it and a letter right after it. An apostrophe at the start or the end, as in `'na` or `pe'`, never splits; neither do hyphens, so `canpànn-a` stays whole. U+02BC, which Unicode files as a letter, is treated as an apostrophe, never as a letter.
* **In the web editor,** a finished word is first looked up whole. Only when the whole word is not in the dictionary is it split, and each part converted on its own: `d'aegua` becomes `d'ægua` from `d'` and `ægua`. A part the dictionary does not know stays as typed; when no part is known, nothing changes. Each part keeps the casing it was typed in. When a part has several spellings, the menu offers the combinations, ranked by the sum of the parts' ranks, at most 9 of them.
* **The whole word wins.** A word that really is one word with an apostrophe inside, entered as such, is found whole and never split.
* **In the Android keyboard,** the dictionary package carries its own word breaker, a self-contained copy of the same rule written for Keyman's ES3 runtime. After `d'` the word starts again, so typing `d'aeg` suggests `ægua`. The breaker also keeps hyphenated words whole, which the previous setting [`joinWordsAt: ["-"]`] did. A test proves that the breaker, in the source and inside the compiled model, splits exactly where `splitElision` does, on a fixed list and 3,000 pseudo-random strings.
* **The lexicon manager warns,** and asks before saving, when a form being typed joins a particle and a word, such as `d'ægua`; it names the parts so the contributor can enter them instead.
* **The corpus counter** uses the same `splitElision` for the parts of an elided word, so counts and conversions always agree on what a part is.

## Consequences

* The dictionary holds each particle and each word once; elided spellings come for free.
* **The particles must be entered.** Until `d'`, `l'` and the rest are in the dictionary, the parts after them are still converted, but the particles themselves stay as typed, which for plain `d'` and `l'` is already correct.
* **Keyman may add a space after a particle chosen from the suggestion bar,** since it adds one after every accepted suggestion. Typing the particle in full and going on with the next word avoids it. To be observed on a phone.
* **A whole word with an inner apostrophe gets no suggestion from the keyboard,** because the breaker splits it; the editor still finds it whole. Such entries should be rare, and the manager's warning keeps them so.
* The open question of [0022](0022-keyman-keyboard-design.md) on elided forms is settled.
