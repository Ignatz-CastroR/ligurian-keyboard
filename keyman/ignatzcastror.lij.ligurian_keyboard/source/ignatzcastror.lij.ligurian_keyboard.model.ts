/*
 * ignatzcastror.lij.ligurian_keyboard.model.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 04:05:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/17, 07:50:33: ñ folds to n [decision 0024].
 * Updated:  2026/10/17, 12:21:09: an own word breaker, which splits an
 *           elided word after its inner apostrophe, as the engine's
 *           splitElision[] does, and keeps hyphenated words whole
 *           [decision 0029].
 * Purpose:  Keyman lexical model source for Ligurian: the dictionary
 *           behind the suggestions of the Keyman keyboard. Compiled by
 *           kmc into ignatzcastror.lij.ligurian_keyboard.model.js.
 * Sources:  wordlist.tsv, written by tools/build-keyman.ts from the
 *           dictionary snapshot; generated, never committed.
 * Contract: searchTermToKey folds a word exactly as the engine's
 *           skeleton[] does [engine/src/skeleton.ts], so "zena" finds
 *           "Zêna", "citae" finds "çitæ" and "canpanna" finds
 *           "canpànn-a". wordBreaker splits words exactly where the
 *           engine's splitElision[] does [engine/src/elision.ts], so
 *           after "d'" the suggestions start again for the next word.
 *           keyman/test/build.test.ts proves that both pairs agree,
 *           on this source and on the functions inside the compiled
 *           model.
 * Security: Keyman copies both functions into the compiled model as
 *           text [Function.prototype.toString] and runs it, transpiled
 *           to ES3, inside its predictive text worker on old Android
 *           phones too. Each function must therefore be self-contained:
 *           no imports, no names from outside its own body, and nothing
 *           newer than ES3 except String.prototype.normalize, which
 *           Keyman's own default key function also uses. No Map, Set,
 *           for..of loops or regular expressions with the u flag.
 *           searchTermToKey allocates nothing per call: Keyman calls it
 *           for every character typed while searching for corrections.
 * Decision: docs/decisions/0021-keyman-scope-and-toolchain.md and
 *           docs/decisions/0022-keyman-keyboard-design.md
 */

// The part of Keyman's LexicalModelSource that this model uses. kmc only
// transpiles this file, without type checking, so the declaration is
// local; this project's own type check still covers the whole file.
// One word found by the word breaker, as Keyman's Span: its text and
// where it starts and ends in the text given to the breaker.
interface WordSpan {
  readonly start: number;
  readonly end: number;
  readonly length: number;
  readonly text: string;
}

interface LigurianModelSource {
  readonly format: "trie-1.0";
  readonly sources: string[];
  readonly wordBreaker: { readonly use: (text: string) => WordSpan[] };
  readonly languageUsesCasing: boolean;
  readonly searchTermToKey: (term: string) => string;
}

const source: LigurianModelSource = {
  format: "trie-1.0",
  sources: ["wordlist.tsv"],

  // Words are runs of letters, digits, combining accents, apostrophes
  // and hyphens, so hyphenated spellings such as "canpànn-a" stay one
  // word, as they are for the engine. Inside a run, a word ends after an
  // apostrophe that has a letter on each side: "d'ægua" is the two words
  // "d'" and "ægua", so typing "d'aeg" suggests "ægua". Unicode's default
  // word breaker would keep "d'ægua" whole and split "canpànn-a".
  // A letter is any character with two cases, which every Ligurian
  // letter has; ES3 has no Unicode letter class.
  wordBreaker: {
    use: function (text: string): WordSpan[] {
      const spans: WordSpan[] = [];
      let start: number = -1;
      for (let i: number = 0; i <= text.length; i += 1) {
        const ch: string = i < text.length ? text.charAt(i) : " ";
        const code: number = ch.charCodeAt(0);
        const letter: boolean = ch.toLowerCase() !== ch.toUpperCase();
        const apostrophe: boolean = ch === "'" || ch === "\u2019" || ch === "\u2018" || ch === "\u02BC";
        const inWord: boolean = letter || apostrophe
          || (code >= 48 && code <= 57)
          || (code >= 0x0300 && code <= 0x036F)
          || ch === "-" || ch === "\u2010" || ch === "\u2011";
        if (inWord && start < 0) {
          start = i;
        }
        if (start >= 0 && !inWord) {
          spans.push({ start: start, end: i, length: i - start, text: text.substring(start, i) });
          start = -1;
        }
        if (apostrophe && start >= 0 && i > 0 && i + 1 < text.length) {
          const before: string = text.charAt(i - 1);
          const after: string = text.charAt(i + 1);
          if (before.toLowerCase() !== before.toUpperCase() && after.toLowerCase() !== after.toUpperCase()) {
            spans.push({ start: start, end: i + 1, length: i + 1 - start, text: text.substring(start, i + 1) });
            start = -1;
          }
        }
      }
      return spans;
    },
  },

  // Suggestions follow the casing the user typed: "Penna" at the start
  // of a sentence suggests "Pénna". Proper nouns stored with a capital,
  // such as "Zêna", keep it.
  languageUsesCasing: true,

  // A copy of skeleton[]: same steps, same table, same order. Accented
  // vowels lose the mark; æ becomes "ae"; ç becomes "c"; ñ becomes "n";
  // typographic apostrophes become the ASCII apostrophe; hyphens are
  // dropped.
  searchTermToKey: function (term: string): string {
    const lowered: string = term.normalize("NFC").toLowerCase();
    let key: string = "";
    for (let i: number = 0; i < lowered.length; i += 1) {
      const ch: string = lowered.charAt(i);
      switch (ch) {
        case "à": case "á": case "â": case "ä":
          key += "a";
          break;
        case "è": case "é": case "ê": case "ë":
          key += "e";
          break;
        case "ì": case "í": case "î": case "ï":
          key += "i";
          break;
        case "ò": case "ó": case "ô": case "ö":
          key += "o";
          break;
        case "ù": case "ú": case "û": case "ü":
          key += "u";
          break;
        case "æ":
          key += "ae";
          break;
        case "ç":
          key += "c";
          break;
        case "ñ":
          key += "n";
          break;
        case "\u2019": case "\u2018": case "\u02BC":
          key += "'";
          break;
        case "-": case "\u2010": case "\u2011":
          break;
        default:
          key += ch;
      }
    }
    return key;
  },
};

export default source;
