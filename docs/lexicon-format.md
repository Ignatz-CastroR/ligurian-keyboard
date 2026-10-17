# Lexicon exchange format

The engine reads a UTF-8 TSV file. Lines that are blank or start with `#` are ignored. The first other line is the header.

| Column | Required | Meaning |
|---|---|---|
| `form` | yes | One **wordform**, exactly as spelled, NFC. Inflected forms are separate rows: `brasso` and `brasse` are two rows. |
| `freq` | yes | Non-negative number; higher ranks earlier in the menu. |
| `variety` | yes | `zeneize`, `savoneize`, `tabarchin`, `monegasco`, ... |
| `orthography` | yes | `ofiçiâ` by default; `unitäia` reserved for later. |
| `status` | yes | Only `approved` rows reach users; `pending` and `rejected` are skipped. |

Rows with an invalid form or frequency are reported with their line number, never silently dropped.

This TSV is an **export**, not the place where people edit. The source of truth is the database in `db/`: `export_lexicon_tsv()` writes its approved forms in this format, and the daily site build saves that output, checked and stamped with its date, as the snapshot from which the web editor and the Keyman dictionary are built [decisions [0019](decisions/0019-editor-dictionary-snapshot.md) and [0022](decisions/0022-keyman-keyboard-design.md)].

Meanings and translations belong to the dictionary database [`db/`]: each lemma has numbered senses, and each sense optional glosses in Italian, Spanish and English. The input method does not need them, so they are not part of this file.
