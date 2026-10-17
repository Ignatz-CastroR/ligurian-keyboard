# Skeleton specification

Version 0.2, 2026/10/17 [0.1, 2026/10/10; 0.2 adds ñ]. Normative source: Académia Ligùstica do Brénno, *Arfabêto*, <https://www.zeneize.net/grafia/arfabeto.htm>.

The **skeleton** of a word is the plain ASCII string a user types to reach it. The engine computes it from the stored spelling; contributors never type keys by hand. Implementation: `engine/src/skeleton.ts`, with three copies kept identical by tests: see "The SQL mirror" and "The Keyman mirror" below. A change to one rule means changing all four places.

## Rules, applied in this order

1. Normalize to Unicode NFC, then lowercase.
2. Fold each character with the table below.
3. Drop hyphens.
4. Every other character is kept unchanged.

| Stored | Skeleton | Grounds in the Arfabêto |
|---|---|---|
| à á â ä | a | accents mark stress and length only |
| è é ê ë | e | idem |
| ì í î ï | i | idem |
| ò ó ô ö | o | ö is long open [O:]; still an o for typing |
| ù ú û ü | u | idem |
| æ | ae | the Académia itself allows `ae` when æ is unavailable |
| ç | c | the c of Italian *ce*, *ci* syllables pronounced [s] |
| ñ | n | not in the *Arfabêto*: written by other Ligurian spelling systems; decision [0024](decisions/0024-letter-enye.md) |
| ’ ‘ ʼ | ' | typographic apostrophe → ASCII |
| - | dropped | `canpànn-a` must be reachable by typing `canpanna` |

Kept as is because they are already ASCII: `j`, `x`, the digraph `eu`, the trigraph `scc`, apostrophes.

## Properties guaranteed by tests

* **Idempotent:** skeleton[skeleton[w]] = skeleton[w].
* **ASCII output** for every valid wordform.
* **Many to one:** collisions are expected and resolved by the candidate menu.

## Known collisions [intended]

| Typed | Candidates |
|---|---|
| `penna` | pénna, pénn-a |
| `e` | e, é |
| `o` | o, ò |

## Open questions for native contributors

1. **ç written as s.** The Arfabêto says ç may always be replaced by a single s [çê → sê]. Should typing `se` also offer `çê`? Today it does not.
2. **ae ambiguity.** A real *a + e* sequence and æ share the key `ae`. The menu handles it, but frequent words may deserve priority by corpus frequency.
3. **Grafia unitäia.** When a second orthography is added, does it need extra folding rules [e.g. its own diacritics]? The table is designed to be extended, not replaced.

## The SQL mirror

The database holds a copy of these rules, `private.skeleton()`, created in `db/migrations/0004_search_keys.sql` and last replaced in `0005_letter_enye.sql`, to compute the search keys of every lemma and wordform [decision [0017](decisions/0017-ascii-search-keys-in-the-database.md)]. `db/test/search-keys.test.ts` fails if the two ever disagree. **Changing a rule here means changing `engine/src/skeleton.ts` and adding a new migration that replaces `private.skeleton()`.**

## The Keyman mirror

The keyboard's dictionary holds a second copy, `searchTermToKey` in `keyman/ignatzcastror.lij.ligurian_keyboard/source/ignatzcastror.lij.ligurian_keyboard.model.ts` [decision [0022](decisions/0022-keyman-keyboard-design.md)]. Keyman compiles it into the model as text, so it cannot import the engine and must stay self-contained and ES3 compatible. `keyman/test/build.test.ts` fails if it ever disagrees with `skeleton()`, checked both in the source and inside the compiled model. `keyman/test/keyboard.test.ts` also fails if a letter folded here cannot be typed on the keyboard. **Changing a rule here therefore means changing four places: this page, `engine/src/skeleton.ts`, a new migration for `private.skeleton()`, and the model's `searchTermToKey`, plus `LONG_PRESS` in `keyman/src/touch-layout.ts` when a letter is added.**
