# dictionary: the dictionary for readers

The public, read only section of the site, published at <https://ignatz-castror.github.io/ligurian-keyboard/dizionario/>: Ligurian in grafîa ofiçiâ with translations into Italian, Spanish and English, open to everyone without an account. Plain TypeScript, built with [Vite](https://vite.dev). Design: decisions [0034](../docs/decisions/0034-dictionary-for-readers.md) and [0035](../docs/decisions/0035-site-in-five-sections.md); the dictionary as a purpose of the project: decision [0032](../docs/decisions/0032-dictionary-second-purpose.md).

The interface is in **Italian**, the default, **English** and **Spanish**, and shares its language choice with the editor and the lexicon manager.

## Views

At the top, the site's bar of five sections with the dictionary's size [`site/`]; below the title, the tabs Index and Search.

| Address | View |
|---|---|
| `#/indice/<letter>` | The index: every initial with entries, then the entries of the chosen letter, a hundred at a time, each with its translations on one line. Accented vowels are listed under their base letter; `æ` follows `a` and `ç` follows `c`; an initial that is not a letter is listed under "altro" |
| `#/cerca/<where>/<words>` | The search, in `lij` [Ligurian spellings], `it`, `es`, `en` [translations] or `tutte` [both], its results in two groups. **Ligurian entries:** published entries whose headword or a form begins with the words, typed with or without accents [`zena` finds `Zêna`; `penne` finds `pénna`, saying which form matched], exact matches first [the headword, then a form], then words that begin with it [the headword, then a form], at most 50. **Translations:** accents, capitals and punctuation are ignored; exact matches come first, then translations that begin with the words, then, from three characters on, translations with a later word that begins with them; at most 200 translations, with a notice when there may be more; results are grouped by entry. A public code typed here opens its entry |
| `#/voce/<code>` | One entry, by the public code of its lemma or of any of its forms: above it, the letter of the index it belongs to, computed as the database computes it; senses with their Italian definitions and translations by language, then the forms, and a link to correct it in the lexicon manager |

## Data

The page calls four functions of migration 0009 and one of 0011, as an anonymous visitor, and never uses a stored session; the bar asks 0011's `dictionary_stats()` for the size:

| Function | Answers |
|---|---|
| `dictionary_letters()` | Every initial with published entries, and how many |
| `dictionary_index(initial, after_key, after_id, limit)` | One page of an initial's entries, ordered by search key, each with its translations |
| `dictionary_search(query, language, limit)` | Translations matching the query, at most 200, with their entry and rank; the query cut at 100 characters |
| `dictionary_lookup(query, limit)` | Published entries by their Ligurian spelling, at most 50 here, each with the form that matched and its translations |
| `dictionary_entry(code)` | One published entry as JSON, or null |

Each function returns published rows only, to everyone. Their contracts are in `db/migrations/0009_dictionary_for_readers.sql`, `db/migrations/0011_site_sections.sql` and `db/README.md`.

## Files

| File | Contents |
|---|---|
| `index.html` | The page shell |
| `src/main.ts` | The page: the site's bar, header, the three views, routing |
| `src/model.ts` | The order of the letters, the letter of a headword, the addresses, translations grouped by sense, results grouped by entry, codes typed into the search; pure functions |
| `src/db.ts` | The five calls to the database |
| `src/messages.ts` | Every text, in Italian, English and Spanish; parts of speech from the lexicon manager's own texts |
| `src/style.css` | Light and dark look, phone layout |
| `test/dictionary.test.ts` | 9 tests of `model.ts` and the messages, the last three on the real database: an entry's translations and a search grouped as the page shows them, the letter of every initial the spelling allows equal to the database's, a Ligurian word typed without accents finding its entry |
| `vite.config.ts` | Build settings |

## Running it on your computer

With the root `.env` holding the Supabase address and publishable key [see `admin/README.md`]:

```bash
npm run dictionary:dev
```

`npm run dictionary:build` writes the static page to `dictionary/dist/`; `npm run site:build` puts it under `_site/dizionario/` with the rest of the site.
