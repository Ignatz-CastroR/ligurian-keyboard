# dictionary: the dictionary for readers

The public, read only section of the site, published at <https://ignatz-castror.github.io/ligurian-keyboard/dizionario/>: Ligurian in grafîa ofiçiâ with translations into Italian, Spanish and English, open to everyone without an account. Plain TypeScript, built with [Vite](https://vite.dev). Design: decision [0034](../docs/decisions/0034-dictionary-for-readers.md); the dictionary as a purpose of the project: decision [0032](../docs/decisions/0032-dictionary-second-purpose.md).

The interface is in **Italian**, the default, **English** and **Spanish**, and shares its language choice with the editor and the lexicon manager.

## Views

| Address | View |
|---|---|
| `#/indice/<letter>` | The index: every initial with entries, then the entries of the chosen letter, a hundred at a time, each with its translations on one line. Accented vowels are listed under their base letter; `æ` follows `a` and `ç` follows `c`; an initial that is not a letter is listed under "altro" |
| `#/cerca/<language>/<words>` | The search by translation, in `it`, `es`, `en` or `tutte`: accents, capitals and punctuation are ignored; exact matches come first, then translations that begin with the words, then, from three characters on, translations with a later word that begins with them; at most 200 translations, with a notice when there may be more; results are grouped by entry. A public code typed here opens its entry |
| `#/voce/<code>` | One entry, by the public code of its lemma or of any of its forms: senses with their Italian definitions and translations by language, then the forms |

Looking up a Ligurian word typed in plain letters, `zena` for `Zêna`, is not this section's job: the editor and the lexicon manager do it.

## Data

The page calls four functions of migration 0009, as an anonymous visitor, and never uses a stored session:

| Function | Answers |
|---|---|
| `dictionary_letters()` | Every initial with published entries, and how many |
| `dictionary_index(initial, after_key, after_id, limit)` | One page of an initial's entries, ordered by search key, each with its translations |
| `dictionary_search(query, language, limit)` | Translations matching the query, at most 200, with their entry and rank; the query cut at 100 characters |
| `dictionary_entry(code)` | One published entry as JSON, or null |

Each function returns published rows only, to everyone. Their contracts are in `db/migrations/0009_dictionary_for_readers.sql` and `db/README.md`.

## Files

| File | Contents |
|---|---|
| `index.html` | The page shell |
| `src/main.ts` | The page: header, the three views, routing |
| `src/model.ts` | The order of the letters, the addresses, translations grouped by sense, results grouped by entry, codes typed into the search; pure functions |
| `src/db.ts` | The four calls to the database |
| `src/messages.ts` | Every text, in Italian, English and Spanish; parts of speech from the lexicon manager's own texts |
| `src/style.css` | Light and dark look, phone layout |
| `test/dictionary.test.ts` | 7 tests of `model.ts` and the messages, the last on rows from the real database |
| `vite.config.ts` | Build settings |

## Running it on your computer

With the root `.env` holding the Supabase address and publishable key [see `admin/README.md`]:

```bash
npm run dictionary:dev
```

`npm run dictionary:build` writes the static page to `dictionary/dist/`; `npm run site:build` puts it under `_site/dizionario/` with the rest of the site.
