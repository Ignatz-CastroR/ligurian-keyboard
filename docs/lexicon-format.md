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

This TSV is an **export**, not the place where people edit. The source of truth will be the database in `db/`; a nightly job writes this file plus the Keyman model.

Glosses in Italian and English belong to the lexicon database, linked to the lemma; they are not needed by the input method and are not part of this file.
