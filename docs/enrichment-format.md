# Enrichment format

**Draft 1, 2026/10/21.** Published with 0.16.0 so that scripts can be written against it. Three choices are settled: one JSON object per line; an existing entry named by its public code and its headword, a sense by its number; enrichment adds, never replaces. The rest becomes final when `import_entries()`, planned for 0.17.0, reads it; until then details may still change, and every change is listed in [CHANGELOG.md](../CHANGELOG.md).

## What it is for

Translations, definitions and grammar prepared outside the site, by a script or by hand, loaded into entries that already exist; and whole new entries. Until then, new entries are written with `db/templates/add-entries.sql`, whose format is the one below for a new entry, without `"op"`.

## The file

* UTF-8, every text in NFC. One JSON object per line [JSON Lines, `.jsonl`]. Blank lines and lines starting with `#` are ignored.
* Each object says what it does in `"op"`: `"add"`, a new entry, or `"enrich"`, an entry already in the dictionary.
* The import first runs dry: it reports every line it would refuse, with its line number and the reason, and writes nothing. The real run writes the whole file or, if any line is refused, nothing.
* Everything written is credited to the person who runs the import, under their role's rules: a contributor's rows arrive pending.

## A new entry: `"op": "add"`

```json
{"op": "add", "headword": "pénna", "part_of_speech": "noun", "gender": "f", "number": "sg",
 "forms": [{"form": "pénne", "tag": "pl.", "readings": [{"gender": "f", "number": "pl"}]}],
 "senses": [{"definition_it": "strumento per scrivere",
             "translations": {"it": ["penna", "stilografica"], "es": ["pluma"], "en": ["pen"]}}]}
```

| Key | Required | Meaning |
|---|---|---|
| `headword` | yes | The lemma, as spelled. |
| `part_of_speech` | no | `noun`, `verb`, `adjective`, `adverb`, `pronoun`, `determiner`, `article`, `preposition`, `conjunction`, `interjection`, `numeral`, `proper_noun`, `other`. |
| `variety`, `orthography` | no | `zeneize` and `ofiçiâ` when absent. |
| `note`, `status` | no | `status` is `pending` unless `approved` is asked by a reviewer or an admin. |
| grammar keys | no | See [Grammar](#grammar). |
| `forms` | no | A list of objects: `form`, and optionally `tag` [a free grammar note] and `readings`, a list of readings, each with some of the four keys of a reading. A form spelled as the headword is the base form: its readings follow the lemma's, any already there skipped. |
| `senses` | no | A list of objects: `definition_it`, optional, in Italian; `translations`, an object whose keys are `it`, `es`, `en`, each a list of strings, one translation each, never holding `;`. |

## An existing entry: `"op": "enrich"`

```json
{"op": "enrich", "lemma": "LIJ-7K3Q9MDXK", "headword": "pénna",
 "grammar": {"gender": "f", "number": "sg"},
 "forms": [{"form": "pénne", "readings": [{"gender": "f", "number": "pl"}]}],
 "senses": [{"number": 1, "translations": {"es": ["pluma"], "en": ["pen"]}},
            {"definition_it": "piuma di uccello", "translations": {"it": ["piuma"], "en": ["feather"]}}]}
```

| Key | Required | Meaning |
|---|---|---|
| `lemma` | yes | The lemma's public code [decision [0030](decisions/0030-public-identifiers.md)]. |
| `headword` | yes | The lemma's headword, compared with the code's: a mistyped code is refused rather than enriching the wrong word. |
| `grammar` | no | The lemma's grammar keys; its reading is also its base form's first. |
| `forms` | no | Forms by spelling, each with its `readings`: a spelling the lemma lacks is added as a new form; one it has, the base form included, receives the readings it lacks, after those it has. A base form's first reading comes only from `grammar`. |
| `senses` | no | A sense with `number` adds to that live sense; a sense without one is a new sense, numbered after the last. |

**Enrichment adds; it never replaces.**

* A translation already in the sense, same language and same text, is skipped and counted.
* A definition is written only where the sense has none; a different one already there is reported, not overwritten.
* The lemma's grammar fills only empty fields; a different value already there is reported, not overwritten. For `invariable` and `pronominal`, `false` is no value: `true` fills them, and `false` given where `true` is stored is reported. A verb's own three given to a lemma that is not a verb are refused, as the database refuses them. A form's readings are added to those it has; one it has already is skipped and counted.
* Corrections and removals are made by people in the lexicon manager, where every change is reviewed and kept in the history.

**Sense numbers must be settled.** A sense is named by its number, which a regrouping of the senses changes [decision [0038](decisions/0038-senses-reviewed-one-by-one.md)]. A line naming a sense of a lemma still waiting on the list of senses to review is refused; lemmas never on the list, or already reviewed, are ready.

## Grammar

The keys and values of decision [0039](decisions/0039-grammar-in-structured-fields.md). Values are codes, written as text in quotes, `"3"`, not `3`. A value its list does not hold is refused with the codes the list holds.

A lemma has one reading, its headword's, written with the first four keys on the lemma itself. A form has a list of them, `"readings"`, since one spelling may stand for several: `parla` is `[{"verb_form": "ind_pres", "person": "3", "number": "sg"}, {"verb_form": "imp", "person": "2", "number": "sg"}]`. A reading gives at least one value, and none is given twice.

| Key | On | Values |
|---|---|---|
| `gender` | lemma, reading | `m`, `f`, `mf` [both] |
| `number` | lemma, reading | `sg`, `pl` |
| `person` | lemma, reading | `1`, `2`, `3` |
| `verb_form` | lemma, reading | `inf`, `ptcp_pres`, `ptcp_past`, `ger`, `ind_pres`, `ind_impf`, `ind_past` [past historic], `ind_fut`, `cond`, `subj_pres`, `subj_impf`, `imp` |
| `invariable` | lemma | `true` or `false` |
| `conjugation` | lemma of a verb | `-â`, `-ê`, `-î`, `-éi` |
| `auxiliary` | lemma of a verb | `avéi`, `êse` |
| `pronominal` | lemma of a verb | `true` or `false` |

The lists live in the database [`grammar_genders`, `grammar_numbers`, `grammar_persons`, `verb_forms`, `conjugation_classes`, `auxiliaries`]; a value added there is accepted at once. A verb's lemma is its infinitive; compound tenses are never stored.
