# Skeleton specification

Version 0.1, 2026/10/10. Normative source: Académia Ligùstica do Brénno, *Arfabêto*, <https://www.zeneize.net/grafia/arfabeto.htm>.

The **skeleton** of a word is the plain ASCII string a user types to reach it. The engine computes it from the stored spelling; contributors never type keys by hand. Implementation: `engine/src/skeleton.ts`. Any change to one must be mirrored in the other and covered by a test.

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
