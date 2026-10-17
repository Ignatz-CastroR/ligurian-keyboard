# ignatzcastror.lij.ligurian_keyboard

The Keyman lexical model [dictionary] of [ligurian-keyboard](https://github.com/Ignatz-CastroR/ligurian-keyboard): the suggestions shown above the Ligurian keyboard.

* **Words:** the approved `zeneize` forms in `ofiçiâ` of the dictionary snapshot, written by `tools/build-keyman.ts` to `source/wordlist.tsv` inside a staging copy of this folder under `keyman/build/`, never into this folder. The counts in it are the snapshot's frequencies, ranked by the Ligurian Wikipedia since 0.8.0.
* **Search key:** `searchTermToKey` in `source/ignatzcastror.lij.ligurian_keyboard.model.ts` is a self-contained copy of the engine's `skeleton()`. `keyman/test/build.test.ts` proves the two agree, also inside the compiled model.
* **Version:** the snapshot's date, YYYY.M.D; the committed `.model.kps` keeps the placeholder `0.0.0`.
* **Build:** `npm run keyman:build` from the repository root. See `keyman/README.md`.
* **License:** word list CC BY-SA 4.0; code MIT. See [LICENSE.md](LICENSE.md).
