# 0023: Lexicon manager in Spanish, latest additions, CSV download

* **Status:** accepted
* **Date:** 2026/10/17
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refines:** [0018](0018-lexicon-manager-design.md), on the interface languages and the downloads; [0020](0020-web-editor-design.md) and [0022](0022-keyman-keyboard-design.md), on the languages of the web editor and of the install page

## Context

The lexicon manager [decision [0018](0018-lexicon-manager-design.md)] was in Italian and English, offered the dictionary only as TSV, and showed nothing on its search page until the visitor typed. Three improvements were asked for: a Spanish interface, the latest additions visible at once, and a CSV download for spreadsheets. Each needs a choice that is not obvious.

## Decision

### Spanish

* **Three interface languages:** Italian, the default, English and Spanish, chosen from a menu in the header that names each language in itself: Italiano, English, Español.
* **Every text exists in all three:** the compiler refuses a message missing from any language, and a test refuses empty texts, dropped placeholders and Spanish texts copied from Italian or English, except the few words that are the same by nature, such as *verbo*.
* **The whole site speaks Spanish:** the web editor gets the same menu with the same three languages, and the choice is shared through the same browser setting, so it follows the visitor between the editor and the manager; a test keeps the two menus identical. The Android install page, a static page, gets a Spanish section after the English one, reached from links at its top.
* **No database change:** the names of varieties, spelling systems and translation languages are written in themselves, the same for everyone.

### Latest additions

* **Below the search field,** while it is empty: the **20 approved lemmas created most recently**, newest first, each with its date and time, part of speech, variety and spelling system, and a link to the entry. Typing replaces the list with the results; emptying the field brings it back.
* **Approved lemmas only, for every viewer.** Staff could also see pending proposals, but the list must mean the same thing to everyone, and pending work already has the review queue.
* **Ordered by creation time.** The database records no approval time; a lemma proposed long ago and approved today is placed by the day it was proposed. Recording approval times would need a new column and a migration; not worth it for this list.
* **Lemmas, not forms:** an inflected form added to an existing lemma does not appear; the list shows new entries of the dictionary.
* **No database change:** anonymous visitors may already read approved lemmas, `created_at` included, under the row security of migration 0003.

### CSV download

* **Converted in the browser** from the same export as the TSV, `export_lexicon_tsv()`, so the two files always hold the same rows.
* **RFC 4180:** comma separated; fields quoted only when needed; double quotes doubled; every line ending with CRLF.
* **A UTF-8 byte order mark at the start,** without which Excel misreads `â ê ô æ ç`.
* **The TSV's comment lines are dropped,** since CSV has no comments. The license, CC BY-SA 4.0, is stated on every page of the site and in the repository.
* **Comma, not semicolon.** Excel set to Italian or Spanish expects semicolons and, when the file is opened with a double click, shows each row in one column; importing it through Excel's Data menu, or opening it in LibreOffice, Google Sheets or Numbers, works. The standard separator was preferred over one tuned to one program's regional setting.

## Consequences

* The admin tests grow by 10: six for the CSV conversion, including a round trip through an independent RFC 4180 reader, and four for the languages. The editor tests grow by 2: Spanish really translated, and the same menu as the manager's.
* A fourth interface language costs one table of texts and one entry in the menu.
* If approval times become important, a migration can add them later, and the list can switch its order without changing its place on the page.
