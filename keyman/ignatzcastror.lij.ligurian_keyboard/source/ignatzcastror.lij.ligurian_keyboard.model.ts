/*
 * ignatzcastror.lij.ligurian_keyboard.model.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 04:05:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/17, 07:50:33: ñ folds to n [decision 0024].
 * Purpose:  Keyman lexical model source for Ligurian: the dictionary
 *           behind the suggestions of the Keyman keyboard. Compiled by
 *           kmc into ignatzcastror.lij.ligurian_keyboard.model.js.
 * Sources:  wordlist.tsv, written by tools/build-keyman.ts from the
 *           dictionary snapshot; generated, never committed.
 * Contract: searchTermToKey folds a word exactly as the engine's
 *           skeleton[] does [engine/src/skeleton.ts], so "zena" finds
 *           "Zêna", "citae" finds "çitæ" and "canpanna" finds
 *           "canpànn-a". keyman/test/build.test.ts proves that the
 *           two functions agree, both on this source and on the
 *           function inside the compiled model.
 * Security: Keyman copies searchTermToKey into the compiled model as
 *           text [Function.prototype.toString] and runs it, transpiled
 *           to ES3, inside its predictive text worker on old Android
 *           phones too. The function must therefore be self-contained:
 *           no imports, no names from outside its own body, and nothing
 *           newer than ES3 except String.prototype.normalize, which
 *           Keyman's own default key function also uses. No Map, Set,
 *           for..of loops or regular expressions with the u flag. It
 *           allocates nothing per call: Keyman calls it for every
 *           character typed while searching for corrections.
 * Decision: docs/decisions/0021-keyman-scope-and-toolchain.md and
 *           docs/decisions/0022-keyman-keyboard-design.md
 */

// The part of Keyman's LexicalModelSource that this model uses. kmc only
// transpiles this file, without type checking, so the declaration is
// local; this project's own type check still covers the whole file.
interface LigurianModelSource {
  readonly format: "trie-1.0";
  readonly sources: string[];
  readonly wordBreaker: { readonly use: "default"; readonly joinWordsAt: string[] };
  readonly languageUsesCasing: boolean;
  readonly searchTermToKey: (term: string) => string;
}

const source: LigurianModelSource = {
  format: "trie-1.0",
  sources: ["wordlist.tsv"],

  // Hyphenated spellings such as "canpànn-a" stay one word, as they are
  // one word for the engine; Unicode's default word breaker would split
  // them at the hyphen.
  wordBreaker: { use: "default", joinWordsAt: ["-"] },

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
