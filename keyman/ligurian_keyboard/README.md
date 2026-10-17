# ligurian_keyboard

The Keyman keyboard of [ligurian-keyboard](https://github.com/Ignatz-CastroR/ligurian-keyboard), for phones and tablets.

* **Layout:** Italian QWERTY. Long press on `a e i o u` gives the vowels with grave, acute, circumflex and diaeresis, and `æ` on `a`; long press on `c` gives `ç`.
* **Suggestions:** come from the separate lexical model package [`../ignatzcastror.lij.ligurian_keyboard`]; Keyman pairs them by the language code `lij`.
* **Sources:** `source/ligurian_keyboard.kmn` [layer logic], `source/ligurian_keyboard.keyman-touch-layout` [written by `npm run keyman:layout` from `keyman/src/touch-layout.ts`; never edit it by hand], `source/ligurian_keyboard.kps` [package].
* **Build:** `npm run keyman:build` from the repository root. See `keyman/README.md`.
* **License:** MIT, see [LICENSE.md](LICENSE.md).
