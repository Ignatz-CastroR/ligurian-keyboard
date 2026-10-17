/*
 * keyboard.test.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/17, 04:03:48, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of the Keyman keyboard's sources: the on-screen layout
 *           [keyman/src/touch-layout.ts and the file it writes], the
 *           .kmn header, and the two package sources.
 * Method:   Static checks, no kmc: build.test.ts compiles the keyboard.
 *           The .kmn layer logic is checked as text, rule by rule: it
 *           cannot run outside Keyman, so these tests at least stop an
 *           accidental change from passing unnoticed.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isPlainAscii, skeleton } from "../../engine/src/skeleton.ts";
import { KEYBOARD_ID, keyboardVersion, MODEL_ID, MODEL_VERSION_PLACEHOLDER } from "../src/build.ts";
import {
  charKeyId, KEYMAN_DEFAULT_PAD, renderTouchLayout, ROW_WIDTH, touchLayout, type TouchKey, type TouchLayer,
  type TouchLayout, type TouchSubKey,
} from "../src/touch-layout.ts";

const layout: TouchLayout = touchLayout();
const layers: TouchLayer[] = layout.phone.layer;

// Line endings are normalized: with core.autocrlf, a Windows checkout has
// CRLF where the repository has LF, and the tests must pass on both.
function read(relative: string): string {
  return readFileSync(new URL(`../${relative}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

function layerById(id: string): TouchLayer {
  const layer: TouchLayer | undefined = layers.find((l) => l.id === id);
  assert.ok(layer, `layer ${id}`);
  return layer;
}

// Every key and long press key of a layer, flattened.
function allKeys(layer: TouchLayer): (TouchKey | TouchSubKey)[] {
  return layer.row.flatMap((row) => row.key.flatMap((key) => [key, ...(key.sk ?? []), ...(key.multitap ?? [])]));
}

// Every character a layer can type, by tap or long press.
function typeable(layer: TouchLayer): Set<string> {
  return new Set(allKeys(layer).filter((k) => k.id.startsWith("U_")).map((k) => k.text));
}

// The Ligurian letters the engine folds: every non-ASCII lower case letter
// that skeleton[] turns into plain ASCII.
function ligurianLetters(): string[] {
  const letters: string[] = [];
  for (let code: number = 0xc0; code <= 0x24f; code += 1) {
    const ch: string = String.fromCodePoint(code);
    if (ch === ch.toLowerCase() && ch !== ch.toUpperCase() && skeleton(ch) !== ch && isPlainAscii(skeleton(ch))) {
      letters.push(ch);
    }
  }
  return letters;
}

test("the committed layout file is exactly what touch-layout.ts writes", () => {
  const committed: string = read(`${KEYBOARD_ID}/source/${KEYBOARD_ID}.keyman-touch-layout`);
  assert.equal(committed, renderTouchLayout(), "run npm run keyman:layout and commit the result");
});

test("phones and tablets get the same layout, with four layers", () => {
  assert.deepEqual(layout.tablet, layout.phone);
  assert.deepEqual(layers.map((l) => l.id), ["default", "shift", "caps", "numeric"]);
});

// The non-ASCII letters a letter layer can type.
function accentedLetters(layer: TouchLayer): string[] {
  return [...typeable(layer)].filter((ch) => /\p{L}/u.test(ch) && !isPlainAscii(ch)).sort();
}

test("the keyboard offers exactly the letters skeleton[] folds, no more, no fewer", () => {
  const letters: string[] = ligurianLetters();
  assert.deepEqual(letters, [..."àáâäæçèéêëìíîïòóôöùúûü"], "the letters skeleton[] folds");
  assert.deepEqual(accentedLetters(layerById("default")), [...letters].sort());
  const capitals: string[] = letters.map((ch) => ch.toUpperCase()).sort();
  assert.deepEqual(accentedLetters(layerById("shift")), capitals);
  assert.deepEqual(accentedLetters(layerById("caps")), capitals);
  assert.deepEqual(accentedLetters(layerById("numeric")), [], "no letters among the symbols");
});

test("every Ligurian letter is typeable in lower case and in capitals", () => {
  const letters: string[] = ligurianLetters();
  for (const ch of letters) {
    assert.ok(typeable(layerById("default")).has(ch), `${ch} on the default layer`);
    assert.ok(typeable(layerById("shift")).has(ch.toUpperCase()), `${ch.toUpperCase()} on the shift layer`);
    assert.ok(typeable(layerById("caps")).has(ch.toUpperCase()), `${ch.toUpperCase()} on the caps layer`);
  }
  for (const ch of "abcdefghijklmnopqrstuvwxyz'") {
    assert.ok(typeable(layerById("default")).has(ch), `${ch} on the default layer`);
  }
  for (const ch of "0123456789") {
    assert.ok(typeable(layerById("numeric")).has(ch), `${ch} on the numeric layer`);
  }
});

test("every character key types what it shows", () => {
  for (const layer of layers) {
    for (const key of allKeys(layer).filter((k) => k.id.startsWith("U_"))) {
      assert.equal(key.id, charKeyId(key.text), `${layer.id}: ${key.text}`);
    }
  }
  assert.equal(charKeyId("ç"), "U_00E7");
  assert.throws(() => charKeyId("ae"));
});

test("no id appears twice on one layer, and every layer switch has a target", () => {
  const ids: Set<string> = new Set(layers.map((l) => l.id));
  for (const layer of layers) {
    const keyIds: string[] = allKeys(layer).map((k) => k.id);
    assert.equal(new Set(keyIds).size, keyIds.length, `duplicate ids on ${layer.id}`);
    for (const key of allKeys(layer)) {
      if (key.nextlayer !== undefined) {
        assert.ok(ids.has(key.nextlayer), `${layer.id}: ${key.id} switches to missing layer ${key.nextlayer}`);
      }
    }
  }
});

// Keyman's own arithmetic [web/src/engine/keyboard/src/keyboards/
// activeLayout.ts, release 18.0.254]: a missing or zero pad becomes 15,
// a missing width 100.
function rowWidth(keys: readonly TouchKey[]): number {
  return keys.reduce((sum, key) => sum + ((key.pad ?? 0) || KEYMAN_DEFAULT_PAD) + (key.width ?? 100), 0);
}

test("every row is exactly as wide as the others, so Keyman stretches no key", () => {
  for (const layer of layers) {
    for (const row of layer.row) {
      assert.equal(rowWidth(row.key), ROW_WIDTH, `${layer.id}, row ${row.id}`);
    }
  }
});

test("Shift: one tap for one capital, a double tap locks, Shift unlocks", () => {
  const shift = (layerId: string): TouchKey | undefined =>
    layerById(layerId).row.flatMap((r) => r.key).find((k) => k.id === "K_SHIFT");
  assert.equal(shift("default")?.nextlayer, "shift");
  assert.equal(shift("default")?.multitap?.[0]?.nextlayer, "caps");
  assert.equal(shift("shift")?.nextlayer, "default");
  assert.equal(shift("shift")?.multitap?.[0]?.nextlayer, "caps");
  assert.equal(shift("caps")?.nextlayer, "default");
  assert.equal(shift("caps")?.multitap, undefined);
});

test("the layer logic: capitals at the start of a sentence, then lower case", () => {
  const kmn: string = read(`${KEYBOARD_ID}/source/${KEYBOARD_ID}.kmn`);
  const rules: string[] = kmn.split("\n").map((line) => line.trim()).filter((line) => line !== "" && !line.startsWith("c "));
  const expected: string[] = [
    "begin Unicode > use(main)",
    "begin NewContext > use(newContext)",
    "begin PostKeystroke > use(postKeystroke)",
    "group(main) using keys",
    "store(digit) '0123456789'",
    "store(sentenceEnd) '.!?…'",
    "store(whitespace) ' ' U+00A0 U+000A U+000D U+0009",
    "group(newContext) readonly",
    "platform('touch') > use(chooseLayer)",
    "group(postKeystroke) readonly",
    "platform('touch') if(&newLayer = \"\") if(&layer = 'numeric') any(digit) > context",
    "platform('touch') if(&layer = 'caps') > context",
    "platform('touch') if(&newLayer = \"\") > use(chooseLayer)",
    "group(chooseLayer) readonly",
    "nul > layer('shift')",
    "any(sentenceEnd) any(whitespace) > layer('shift')",
    "any(sentenceEnd) any(whitespace) any(whitespace) > layer('shift')",
    "nomatch > layer('default')",
  ];
  assert.deepEqual(rules.filter((line) => !line.startsWith("store(&")), expected);
});

test("the keyboard version matches the project version", () => {
  const pkg = JSON.parse(read("../package.json")) as { version: string };
  assert.equal(keyboardVersion(), pkg.version);
  const kmn: string = read(`${KEYBOARD_ID}/source/${KEYBOARD_ID}.kmn`);
  assert.ok(kmn.startsWith("\uFEFF"), "the .kmn keeps its UTF-8 byte order mark");
  assert.match(kmn, /^store\(&VERSION\) '17\.0'$/m, "multitap needs Keyman 17");
  assert.match(kmn, new RegExp(`^store\\(&LAYOUTFILE\\) '${KEYBOARD_ID}\\.keyman-touch-layout'$`, "m"));
});

test("the package sources declare the right ids, Ligurian and the version placeholder", () => {
  const keyboardKps: string = read(`${KEYBOARD_ID}/source/${KEYBOARD_ID}.kps`);
  assert.match(keyboardKps, new RegExp(`<ID>${KEYBOARD_ID}</ID>`));
  assert.match(keyboardKps, /<Language ID="lij">/);
  assert.match(keyboardKps, /<FollowKeyboardVersion\/>/);
  const modelKps: string = read(`${MODEL_ID}/source/${MODEL_ID}.model.kps`);
  assert.match(modelKps, new RegExp(`<ID>${MODEL_ID.replaceAll(".", "\\.")}</ID>`));
  assert.match(modelKps, /<Language ID="lij">/);
  assert.ok(modelKps.includes(MODEL_VERSION_PLACEHOLDER), "the build replaces this placeholder");
});
