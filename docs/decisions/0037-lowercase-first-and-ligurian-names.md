# 0037: The Android keyboard: lowercase first, Ligurian names, Keyman 19

* **Status:** accepted
* **Date:** 2026/10/20
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refines:** [0022](0022-keyman-keyboard-design.md), on the names Keyman shows, on the weights of the word list, and on the Keyman version the install page recommends

## Context

On 2026/10/20 the keyboard and its dictionary were tried on a phone. Four things came to light:

* **Another dictionary took our place.** Keyman's catalog holds a Ligurian dictionary of its own, `jeanm.lij.conseggio`, and Keyman had selected it for the language. Its suggestions mixed Italian words with Ligurian ones [`damasco` gave "damaschine"; `impeio` gave "impio" and "impedio"]. Only after it was removed did our dictionary take over.
* **Keyman 18 never replaces a word by itself**, so a person typing plain letters must tap every suggestion. **Keyman 19**, in beta since October 2026 and expected stable early in 2027, adds auto-correction: with "Predictions with auto-corrections" selected, `ligure` became `lìgure`, `zeneize` became `zenéize`, `goaera` became `goæra` and `AEGOA` became `ÆGOA`, with no tap. When the correction is uncertain, a first press of space highlights it in grey and a second applies it.
* **Twins spelled alike but for a capital tie.** The dictionary holds 147 such pairs among its approved forms, such as damàsco and Damàsco, or zìtta and Zìtta. The frequency list counts words in lower case, so both forms of a pair receive the same count, and Keyman breaks the tie in its own way: typed in lowercase, `damasco` was auto-corrected to `Damàsco`. The web editor already offers the lowercase form first in such a menu, and a word typed with a capital makes the two forms one in both.
* **The space bar read "Ligure - Ligure [grafîa ofiçiâ]".** Keyman writes the language's name, a dash and the keyboard's name; ours named the language in Italian and repeated it inside the keyboard's name.

## Decision

* **Lowercase first.** In the Keyman word list, every count is doubled, and a form beginning with a lowercase letter weighs one more when another form is spelled the same but for capitals. Typed in lowercase, `damasco` becomes `damàsco`; typed `Damasco`, Keyman capitalizes every suggestion, and the result is `Damàsco` as before. Doubling first changes no other order: for counts a < b, 2a + 1 is still below 2b. The rule lives in `keyman/src/wordlist.ts`, where the word list is built.
* **Names in Ligurian.** The language is **Lìgure**, capitalized as Keyman writes every language's name. The keyboard is **grafîa ofiçiâ**, so the space bar reads "Lìgure - grafîa ofiçiâ". The dictionary is **Diçionäio lìgure [grafîa ofiçiâ]**. Keyman's own settings list a dictionary by its identifier, `ignatzcastror.lij.ligurian_keyboard`, which does not change.
* **The install page recommends Keyman 19** for its auto-correction, and says what Keyman 18 does instead. It tells the reader to check two settings: that the dictionary selected for Lìgure is ours, removing any other, and that "Predictions with auto-corrections" is selected. Its examples are words the dictionary holds.
* **Keyman stays the keyboard on phones.** Native keyboards of the project's own, for phones or desktops, would each be a decision of their own.

## Consequences

* The dictionary package's counts are twice what they were. Keyman weighs suggestions by their share of the total, so the shares do not change but for the extra one.
* The keyboard's identifier, the dictionary's identifier and their language code, `lij`, do not change, so installed copies update in place.
* The install page now depends on a Keyman beta. When Keyman 19 becomes stable, the page points to the ordinary app again.
* The other Ligurian dictionary in Keyman's catalog will keep being offered to new users. The install page's check is the defence; asking Keyman's catalog to list ours as well is a later decision.
