# 0039: Grammar in structured fields

* **Status:** accepted
* **Date:** 2026/10/21
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refines:** [0014](0014-automatic-base-form.md), on what the base form takes from its lemma; [0032](0032-dictionary-second-purpose.md), on the controlled vocabulary it left for a record of its own

## Context

Until 0.16.0 a lemma had a part of speech and nothing else of its grammar, and a form had a free text tag, written as each person pleased: "pl.", "f. sg.", "3 sg. pres.". No program can read that. The generator of inflections planned after 0.16.0 needs each lemma's gender, number, conjugation class and auxiliary; the dictionary for readers should state them; a reviewer should see them. The fields had been asked for more than once.

## Decision

* **The values are lists, kept as tables:** `grammar_genders` [m, f, mf], `grammar_numbers` [sg, pl], `grammar_persons` [1, 2, 3], `verb_forms`, `conjugation_classes` [-â, -ê, -î, -éi] and `auxiliaries` [avéi, êse]. Each value has a code, an Italian name and a place in the menus. Everyone may read the lists; only the SQL Editor changes them, and another value is one insert, never a change of code. Values come from a speaker, never from a guess.
* **Verb forms are the simple forms only:** infinitive, present participle, past participle, gerund, present, imperfect, past historic and future indicative, conditional, present and imperfect subjunctive, imperative. The past historic is the simple past, as Italian "parlasti" [passato remoto]. A compound tense is the auxiliary and the past participle; it is never stored.
* **On the lemma:** the gender, number, person and verb form of its headword; whether it is invariable; and, for verbs only, its conjugation class, its auxiliary and whether it is pronominal. A check refuses those three on any other word, a lemma with no part of speech included.
  * Nouns: gender masculine, feminine or both; number singular, or plural for a noun used only in the plural; invariable or not.
  * Adjectives: the lemma is the masculine singular by default, but any value may be given; the feminine forms are forms of their own.
  * Verbs: the lemma is the infinitive.
  * Pronouns and determiners: person, gender and number.
* **On every form: a list of readings,** each a gender, number, person and verb form. One spelling may stand for several: `parla` is the present indicative, third person singular, and the imperative, second person singular; an invariable noun's spelling is its singular and its plural. Each form keeps one row and one public code; its readings are a list inside the row, reviewed, versioned and kept in the history together with it, so that a reading removed is never lost [0012]. Every code is checked against its list when written, and a code a reading uses may not leave its list.
* **The base form's first reading is its lemma's,** when the lemma has one: taken when the base form is created and whenever the lemma's changes, as it takes the spelling and the status [0014]; nobody changes that reading on the base form directly, and a save that tries is refused as a conflict, since it most often comes from a page read before the lemma changed. Further readings of the same spelling may follow it, added by hand, and stay when the lemma's reading changes. When the lemma's new reading is already one of them, the two change places, the old one staying among the others, so that a change and its undo lose nothing; otherwise the old one is replaced, as a correction is. A reading is never kept twice. While the lemma has no reading, every reading of its base form is its own.
* **A new part of speech, "determiner":** demonstratives, possessives and the like.
* **The free tag stays,** named "grammar note [free text]", for what the fields do not say.
* **The manager:** a group "Grammar" under the part of speech, in the new lemma form and the lemma's edit form; in each form's edit, a group "Grammatical readings", one block per reading with its own fields, and a button to add a reading or remove one; a new form starts with one empty reading; the base form shows its lemma's reading first, not editable there. The fields follow the part of speech as it is chosen:

  | Part of speech | The lemma shows | Each reading of its forms shows |
  |---|---|---|
  | noun, proper noun, adjective, numeral | gender, number, invariable | gender, number |
  | article | gender, number | gender, number |
  | pronoun, determiner | person, gender, number | person, gender, number |
  | verb | verb form, conjugation, auxiliary, pronominal | verb form, person, gender, number |
  | adverb, preposition, conjunction, interjection | nothing | every field of a form |
  | none, other | every field of a form | every field of a form |

  A field that already holds a value, in the lemma or in any reading of the form, is shown whatever the part of speech, so that a save never empties a value nobody saw; a verb's own three are the exception, since only a verb may hold them. A save sends the fields shown and empties the others; a reading left with no value is dropped, and one given twice is kept once. A lemma that becomes a verb with no verb form yet is given the infinitive; one that stops being a verb loses it, since only a verb's lemma is an infinitive. The entry shows each row's grammar in one line, a form's readings separated by ";", and the review queue shows it in brackets after each lemma and form: a lemma's whole grammar, followed by the readings its base form holds beyond the lemma's own, since they are approved with the lemma ["anche: femminile, plurale"]. The general categories are named in Italian, English and Spanish; conjugation classes and auxiliaries are Ligurian words, shown as written.
* **Backups** carry the six lists and the new columns. A backup made before 0.16.0 restores with no grammar; one whose base form does not begin with its lemma's reading was not written by the database, and is refused. A code the backup holds and the target's list lacks is added after the list's last value, since its place in the backup may be taken there by another value.
* **The SQL template** `db/templates/add-entries.sql` takes the same keys on the lemma, and on each form a list `readings`; a form spelled as the headword adds its readings to the base form's. A value its list does not hold is refused with the codes the list does hold. The enrichment format of 0.17.0 uses the same keys [`docs/enrichment-format.md`].

## Consequences

* No entry has any grammar yet: every new column starts empty or false. Grammar arrives by hand, by the template, or by the enrichment of 0.17.0.
* The dictionary for readers does not show grammar yet; it will, once entries carry it, in a release of its own.
* The generator of inflections will write a form's readings as a list, so that a spelling shared by several slots of a paradigm is one form, with one code, and its readings.
* Which fields a part of speech shows is a choice of the interface. The database accepts any listed value on any row, the verb's three excepted, so a template or an import may write what the manager would not offer.
* The generator of inflections, after 0.16.0, reads these fields. Its rules, and the golden paradigms written by native speakers that will test it, get a record of their own.
* In keeping with [0036](0036-built-for-more-than-one-language.md), the values are data in tables, not facts in code: a twin project fills its own lists. The fields each part of speech shows, and the names of the general categories, are in `admin/src/grammar.ts`, apart from the page.
* Migration 0013 must be run before the code of 0.16.0 is pushed; it changes no existing data.
