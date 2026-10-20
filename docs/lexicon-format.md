# Lexicon exchange format

The engine reads a UTF-8 TSV file. Lines that are blank or start with `#` are ignored. The first other line is the header.

| Column | Required | Meaning |
|---|---|---|
| `form` | yes | One **wordform**, exactly as spelled, NFC. Inflected forms are separate rows: `brasso` and `brasse` are two rows. |
| `freq` | yes | Non-negative number; higher ranks earlier in the menu. In the database and in the manager's downloads it is the stored value, 1 by default. In the daily snapshot it is a ranking weight: the stored value plus the number of times the Ligurian Wikipedia uses the form, for rows in the spelling system of the frequency list [decision [0027](decisions/0027-real-frequencies.md)]. The snapshot then carries a `# Frequencies:` line naming the list. |
| `variety` | yes | `zeneize`, `savoneize`, `tabarchin`, `monegasco`, ... |
| `orthography` | yes | `ofiçiâ` by default; `unitäia` reserved for later. |
| `status` | yes | Only `approved` rows reach users; `pending` and `rejected` are skipped. |

Rows with an invalid form or frequency are reported with their line number, never silently dropped.

`npm run lexicon:validate -- <file.tsv>` checks a file in this format without changing it, each finding at the file's own line number: every row the engine or the database would refuse, rows that repeat the same form, variety and orthography, the approved forms that share a skeleton and so open a menu, in the menu's order, approved forms with freq 0, and the lexicon manager's two warnings [decisions [0028](decisions/0028-enye-warning-under-oficia.md) and [0029](decisions/0029-elision.md)]. It exits with 0 when the file has no error and no duplicate, 1 when it has either, and 2 when the file cannot be read. The checks are in `engine/src/validate.ts`.

This TSV is an **export**, not the place where people edit. The source of truth is the database in `db/`: `export_lexicon_tsv()` writes its approved forms in this format, and the daily site build saves that output, checked and stamped with its date, as the snapshot from which the web editor and the Keyman dictionary are built [decisions [0019](decisions/0019-editor-dictionary-snapshot.md) and [0022](decisions/0022-keyman-keyboard-design.md)].

Meanings and translations belong to the dictionary database [`db/`]: each lemma has numbered senses, and each sense optional glosses in Italian, Spanish and English. The input method does not need them, so they are not part of this file.
