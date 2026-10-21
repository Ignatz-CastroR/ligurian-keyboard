# Diçionäio lìgure [grafîa ofiçiâ]: lexical model history

The package version is the date of the dictionary snapshot it was built from, as YYYY.M.D. The model itself changes only with the project's versions; only the project versions that changed the model, or the words and counts it is built from, are listed here.

## Project 0.14.3 2026/10/20

* Counts are the frequency list's own again, and a form beginning with a lowercase letter weighs at least three times its twins spelled with capitals, such as damàsco beside Damàsco. Keyman 19 auto-corrects only to a suggestion holding at least 66% of the weight of those matching the typed keys as closely; the rule of 0.14.2 gave 53%, so "damasco" still became Damàsco, on a second space. Now damàsco holds 75%.

## Project 0.14.2 2026/10/20

* Named in Ligurian: "Diçionäio lìgure [grafîa ofiçiâ]", for the language "Lìgure" [decision 0037].
* Every count is doubled, and a form beginning with a lowercase letter weighs one more than its twin spelled with a capital, such as damàsco beside Damàsco. Keyman's auto-correction then turns "damasco" into damàsco, not Damàsco; typed "Damasco", it still gives Damàsco. No other order changes.

## Project 0.9.0 2026/10/17

* An own word breaker: a word ends after an apostrophe with a letter on each side, so after `d'` the suggestions start again for the next word; hyphenated words stay whole, as before [decision 0029].

## Project 0.8.2 2026/10/17

* The first frequency list: the counts of the Ligurian Wikipedia dump of 2026/10/01 are added to the stored frequencies, so suggestions follow real use.

## Project 0.8.0 2026/10/17

* The counts come from the snapshot ranked by the Ligurian Wikipedia: each form's stored frequency plus the number of times the Ligurian Wikipedia uses it, so the most used spelling is suggested first [decision 0027].

## Project 0.6.0 2026/10/17

* Search keys fold `ñ` to `n`, as the engine's `skeleton()` now does.

## Project 0.5.0 2026/10/17

* First version: approved zeneize forms in grafîa ofiçiâ from the dictionary database; search keys identical to the engine's `skeleton()`; hyphenated spellings kept as one word; suggestions follow the casing the user typed.
