# 0020: Design of the web editor

* **Status:** accepted
* **Date:** 2026/10/17
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refined by:** [0023](0023-lexicon-manager-spanish-history-csv.md), on the interface languages; [0029](0029-elision.md), on elided words

## Context

Decision [0001](0001-input-method-not-editor.md) makes the keyboard, not an editor, the main product. Until the Keyman keyboards exist, though, nobody can type Ligurian with this project at all. The web editor fills that gap and shows the engine working on real text. This record fixes how it behaves.

## Decision

* **The editor is the front page of the site;** the lexicon manager moves to `/admin/`. The public face of the project is the place where people write.
* **A plain text area,** not an editable HTML area: plain text only, and nothing typed can inject markup.
* **Words are finished by the `input` event, not by key presses.** Phone keyboards report almost every key as code 229, so key events cannot tell a space from a letter. The editor looks at the text after each insertion: a space or a new line right before the caret finishes the word before it.
* **Nothing happens while the phone's keyboard is composing** a word, and **pasted or dropped text is never converted.**
* **One candidate replaces the word; several open a menu.** `1` to `9` choose, the arrows move the highlight, Enter or Tab confirm, Escape keeps the word as typed. The menu's last entry, "keep as typed", exists for phones, which have no Escape key.
* **Typing on with the menu open accepts the highlighted spelling,** as Japanese input methods do; deleting keeps the word as typed. The alternative, silently leaving plain ASCII in the text, works against the purpose of the project.
* **Backspace right after a conversion undoes it** and restores what was typed, followed by its space. The browser's own undo [Ctrl+Z] also works, because edits are applied with `insertText` where the browser allows it.
* **The menu opens under the word with a mouse and keyboard, and as a bar above the on-screen keyboard on touch screens.**
* **Spell checking and autocorrect are switched off** in the text area, so Italian dictionaries cannot "correct" plain ASCII Ligurian into Italian words before it is converted. Some phone keyboards ignore this request.
* **Filters by variety and spelling system,** by default `zeneize` and `ofiçiâ` [decision [0004](0004-orthography-and-variety-per-entry.md)].
* **Copy, download as `.txt`, and clear.** The text is kept in the browser between visits; nothing is ever sent anywhere.
* **Interface in Italian by default, English available,** sharing the language choice with the lexicon manager.
* **The decisions live in pure functions** [`editor/src/ime.ts`], tested in Node; `main.ts` only applies them to the page.

## Consequences

* **On a phone, text must still be copied out of the editor** into WhatsApp or any other app. Typing straight into other apps is the job of the Keyman keyboards, the next stage.
* **The ranking of candidates is only as good as the frequencies.** Until real frequencies exist [decision [0009](0009-data-sources.md)], menu order is alphabetical, and typing on accepts the first spelling in that order.
* A conversion cannot be undone after the caret has moved away; the word can then only be retyped or corrected by hand.
