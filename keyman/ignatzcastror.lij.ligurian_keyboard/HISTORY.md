# Dizionario ligure [grafîa ofiçiâ]: lexical model history

The package version is the date of the dictionary snapshot it was built from, as YYYY.M.D. The model itself changes only with the project's versions; only the project versions that changed the model, or the words and counts it is built from, are listed here.

## Project 0.8.2 2026/10/17

* The first frequency list: the counts of the Ligurian Wikipedia dump of 2026/10/01 are added to the stored frequencies, so suggestions follow real use.

## Project 0.8.0 2026/10/17

* The counts come from the snapshot ranked by the Ligurian Wikipedia: each form's stored frequency plus the number of times the Ligurian Wikipedia uses it, so the most used spelling is suggested first [decision 0027].

## Project 0.6.0 2026/10/17

* Search keys fold `ñ` to `n`, as the engine's `skeleton()` now does.

## Project 0.5.0 2026/10/17

* First version: approved zeneize forms in grafîa ofiçiâ from the dictionary database; search keys identical to the engine's `skeleton()`; hyphenated spellings kept as one word; suggestions follow the casing the user typed.
