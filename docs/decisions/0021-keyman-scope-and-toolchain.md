# 0021: Keyman keyboard: scope, toolchain and distribution

* **Status:** accepted
* **Date:** 2026/10/17
* **Decided by:** Iosef Tesla R. [Ignatz-CastroR]
* **Refines:** [0001](0001-input-method-not-editor.md) and [0007](0007-technology-stack.md), on what Keyman can do on each system

## Context

Decision [0001](0001-input-method-not-editor.md) makes the input method the product, and [0007](0007-technology-stack.md) chose Keyman, by SIL International, to deliver it "on every system". Before building version 0.5.0, Keyman's current documentation and issue tracker were checked on 2026/10/17. Four facts came out of that check.

1. **Predictive text exists only on Android, iOS and the web.** Keyman for Windows, macOS and Linux have no predictive text, and the Keyman team closed the request for it as not planned: it would need a JavaScript engine, a package system and a suggestion interface on every desktop system [keymanapp/keyman issue 11915]. On a desktop, a Keyman keyboard can only offer a layout; it cannot consult our dictionary.
2. **Keyman's word list models use a key function, exactly like our skeleton.** A model turns every word into a search key, so that what the user types matches the stored word whatever its accents. The function is written in TypeScript, given as the `searchTermToKey` property of the model definition, and runs both when the word list is compiled and on every typed word. This is decision [0005](0005-ascii-skeleton-is-computed.md) in Keyman's own terms.
   * Keyman's **default** key function lowercases, decomposes to NFKD and drops combining accents. That turns `ç` into `c`, but leaves `æ` untouched, because `æ` does not decompose. The default is therefore **not** our skeleton.
3. **The compiler runs from the command line, on any system.** `kmc` is published on npm as `@keymanapp/kmc`, with the lexical model compiler and the package compiler as separate modules. Since version 17 it needs neither Windows nor WINE. Keyman Developer, which is Windows only, is not required.
4. **Automatic replacement is new and belongs to Keyman.** In Keyman 18, the current stable version, suggestions appear in a banner and the user taps one. Keyman 19, in beta since 2026/10/06 with a full release expected early in 2027, adds autocorrect of high probability suggestions on Android and iOS, enabled by default on Android. Keyman decides when to replace, with thresholds made for typos in large languages, not for restoring Ligurian accents.

## Decision

1. **Version 0.5.0 targets Android.** iOS follows only when someone can test it on a real device.
2. **One touch layout,** Italian based, since most users are Italian speakers, with long press on the vowels and on `c` for the Ligurian letters [`â ê î ô û æ ç` and the other accented vowels], so that any word can be typed even when the dictionary does not know it.
3. **One lexical model built from the daily dictionary snapshot** [decision [0019](0019-editor-dictionary-snapshot.md)], whose `searchTermToKey` is the engine's `skeleton()`. If the compiler requires the function to be self-contained, it is generated from the engine's source, and a test keeps it identical to the engine, as decision [0017](0017-ascii-search-keys-in-the-database.md) does for SQL.
4. **Built with `kmc` from npm,** inside this repository and its GitHub Actions workflow. No Keyman Developer.
5. **Distributed by ourselves for now:** `.kmp` packages attached to GitHub Releases and rebuilt automatically. Submission to Keyman's official keyboards and lexical-models repositories is reconsidered at version 1.0.0, when the dictionary is stable; the official route needs a reviewed pull request for every dictionary update, which does not fit daily snapshots.
6. **Developed and tested against Keyman 18 stable, and checked on Keyman 19 beta.** The behavior on space is documented honestly for each version: suggestions to tap on 18, possible automatic replacement on 19.
7. **Identifiers,** permanent once published: author `ignatzcastror`, language `lij` [ISO 639-3 for Ligurian], unique part `ligurian_keyboard`; the lexical model is therefore `ignatzcastror.lij.ligurian_keyboard`. The keyboard's own identifier is fixed in the build, following Keyman's naming rules.

## Consequences

* **Desktop users write in the web editor** [decision [0020](0020-web-editor-design.md)]. A desktop Keyman keyboard, if one is ever made, would be a layout only, without the dictionary.
* **Criterion 1 for version 1.0.0** becomes: Keyman on Android, with iOS when a tester exists; desktop served by the web editor. The earlier wording, "at least Android and Windows", is withdrawn.
* **The keyboard cannot copy the editor's behavior exactly.** The editor's rule "one candidate replaces the word on space" depends on Keyman's autocorrect, which only exists from version 19 and follows Keyman's thresholds; the editor's menu becomes Keyman's suggestion banner, which shows only a few suggestions. Whether this is good enough is decided by testing on a real phone, not assumed.
* **A second copy of the folding exists,** in the model's key function. It is kept identical to `skeleton()` by a test, and the same check now guards three places: engine, database and keyboard.
* **Testing needs a real Android phone with the free Keyman app;** Claude cannot do it. Until the friends in Genoa test it, the maintainer is the only tester.
* **Installation is a two step process for users:** install Keyman from the Play Store, then open our package. Instructions are written in Italian.
