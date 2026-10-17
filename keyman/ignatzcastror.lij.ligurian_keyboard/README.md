# ignatzcastror.lij.ligurian_keyboard

The Keyman lexical model [dictionary] of [ligurian-keyboard](https://github.com/Ignatz-CastroR/ligurian-keyboard): the suggestions shown above the Ligurian keyboard.

* **Words:** the approved `zeneize` forms in `ofiçiâ` of the dictionary snapshot, written to `source/wordlist.tsv` by `tools/build-keyman.ts`. That file is generated and never committed.
* **Search key:** `searchTermToKey` in `source/ignatzcastror.lij.ligurian_keyboard.model.ts` is a self-contained copy of the engine's `skeleton()`. `keyman/test/build.test.ts` proves the two agree, also inside the compiled model.
* **Version:** the snapshot's date, YYYY.M.D; the committed `.model.kps` keeps the placeholder `0.0.0`.
* **Build:** `npm run keyman:build` from the repository root. See `keyman/README.md`.
* **License:** word list CC BY-SA 4.0; code MIT. See [LICENSE.md](LICENSE.md).
