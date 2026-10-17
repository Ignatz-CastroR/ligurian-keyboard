/*
 * build.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 04:05:05, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/17, 07:50:33: ñ, Ñ and a decomposed ñ among the
 *           pieces of the pseudo-random strings.
 * Updated:  2026/10/17, 12:27:55: the model's own word breaker, which
 *           must split words exactly where the engine's splitElision[]
 *           does [decision 0029].
 * Purpose:  Tests of the Keyman build on the test fixture: the packages
 *           kmc produces, and above all the compiled dictionary, which
 *           must find every word exactly as the engine does.
 * Method:   One real build with kmc into a temporary folder. The compiled
 *           model is then loaded in an isolated JavaScript context, with
 *           stand-ins for the two Keyman objects it calls, and the key
 *           function and word index it hands to Keyman are captured and
 *           checked. This runs on Node's modern engine: it proves what the
 *           model contains, not that old phones can run it; that comes
 *           from kmc transpiling the model to ES3. Keyman's prediction
 *           engine itself is not published as a package, so suggestions
 *           as such are checked on a phone, not here.
 */

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { skeleton } from "../../engine/src/skeleton.ts";
import { splitElision } from "../../engine/src/elision.ts";
import { stampSnapshot } from "../../editor/src/snapshot.ts";
import modelSource from "../ignatzcastror.lij.ligurian_keyboard/source/ignatzcastror.lij.ligurian_keyboard.model.ts";
import {
  BuildError, buildPackages, KEYBOARD_ID, KEYBOARD_PACKAGE, keyboardVersion, kmcArguments, MANIFEST, MODEL_ID,
  MODEL_PACKAGE, type Manifest,
} from "../src/build.ts";
import { readZip } from "./zip.ts";

const FIXTURE: string = readFileSync(new URL("../../data/fixtures/test-lexicon.tsv", import.meta.url), "utf8");
const TAKEN_AT: Date = new Date(Date.UTC(2026, 9, 17, 9, 1, 25));
const SNAPSHOT: string = stampSnapshot(FIXTURE, TAKEN_AT);

interface TrieEntry {
  key: string;
  weight: number;
  content: string;
}

interface TrieNode {
  type: "leaf" | "internal";
  entries?: TrieEntry[];
  children?: Record<string, TrieNode>;
}

interface CapturedModel {
  trie: { totalWeight: number; root: TrieNode };
  options: {
    searchTermToKey: (term: string) => string;
    languageUsesCasing: boolean;
    wordBreaker: (text: string) => Span[];
  };
}

interface Span {
  start: number;
  end: number;
  length: number;
  text: string;
}

let work: string = "";
let manifest: Manifest;
let model: CapturedModel;

// Every [key, word] pair stored in the compiled trie.
function trieEntries(node: TrieNode): TrieEntry[] {
  const found: TrieEntry[] = [...(node.entries ?? [])];
  for (const child of Object.values(node.children ?? {})) {
    found.push(...trieEntries(child));
  }
  return found;
}

// Load the compiled model with stand-ins for Keyman's worker and trie
// model, and keep what it hands to Keyman: the trie and the options,
// including the key function.
function loadCompiledModel(code: string): CapturedModel {
  let captured: CapturedModel | null = null;
  const sandbox = {
    LMLayerWorker: {
      loadModel(instance: CapturedModel): void {
        captured = instance;
      },
    },
    models: {
      TrieModel: function TrieModel(this: CapturedModel, trie: CapturedModel["trie"], options: CapturedModel["options"]): void {
        this.trie = trie;
        this.options = options;
      },
    },
    wordBreakers: { default: (): string[] => [] },
  };
  runInNewContext(code, sandbox);
  if (captured === null) {
    throw new Error("the compiled model never called LMLayerWorker.loadModel");
  }
  return captured;
}

// The pieces the pseudo-random strings are made of: the plain and
// accented letters in both cases, every hyphen and apostrophe the folding
// knows, a space, decomposed accents, and characters that change length
// or need two UTF-16 units when lower-cased or stored.
const PIECES: readonly string[] = [
  ..."aeioucnzAEIOUCNZ", ..."àáâäèéêëìíîïòóôöùúûüæçñÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÆÇÑ",
  "-", "\u2010", "\u2011", "'", "\u2018", "\u2019", "\u02BC", " ", "e\u0302", "a\u0300", "c\u0327",
  "n\u0303",
  "ß", "İ", "\uFB01", "\u{1F600}", "\u0000",
];
const RANDOM_STRINGS: number = 5000;
const MAX_RANDOM_LENGTH: number = 12;

// mulberry32: a small pseudo-random generator with good low bits, seeded
// so the corpus is the same on every run. Returns integers in [0, n).
function generator(seed: number): (n: number) => number {
  let state: number = seed >>> 0;
  return (n: number): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t: number = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) % n);
  };
}

interface RandomMix {
  text: string;
  length: number;        // number of pieces
  pieces: number[];      // indexes into PIECES
}

function randomMixes(): RandomMix[] {
  const next: (n: number) => number = generator(20261017);
  const mixes: RandomMix[] = [];
  for (let n: number = 0; n < RANDOM_STRINGS; n += 1) {
    const length: number = 1 + next(MAX_RANDOM_LENGTH);
    const pieces: number[] = [];
    for (let i: number = 0; i < length; i += 1) {
      pieces.push(next(PIECES.length));
    }
    mixes.push({ text: pieces.map((p) => PIECES[p] ?? "").join(""), length, pieces });
  }
  return mixes;
}

// Inputs on which the keyboard's key function must equal skeleton[]:
// every character up to U+02FF and the typographic punctuation block, in
// both cases; every fixture word as written, capitalized, in capitals and
// decomposed [NFD]; and the pseudo-random mixes of the hard cases.
function keyCorpus(words: readonly string[]): string[] {
  const corpus: string[] = [];
  for (let code: number = 0; code <= 0x2ff; code += 1) {
    corpus.push(String.fromCodePoint(code));
  }
  for (let code: number = 0x2010; code <= 0x2027; code += 1) {
    corpus.push(String.fromCodePoint(code));
  }
  for (const word of words) {
    corpus.push(word, word.toUpperCase(), word.charAt(0).toUpperCase() + word.slice(1), word.normalize("NFD"));
  }
  corpus.push(...randomMixes().map((m) => m.text));
  return corpus;
}

before(() => {
  work = mkdtempSync(join(tmpdir(), "ligurian-keyman-"));
  manifest = buildPackages(SNAPSHOT, { outDir: join(work, "out"), stageDir: join(work, "stage"), now: new Date() });
  const compiled: string = readFileSync(join(work, "stage", MODEL_ID, "build", `${MODEL_ID}.model.js`), "utf8");
  model = loadCompiledModel(compiled);
});

after(() => {
  rmSync(work, { recursive: true, force: true });
});

test("the build writes both packages and an accurate manifest", () => {
  assert.ok(existsSync(join(work, "out", KEYBOARD_PACKAGE)));
  assert.ok(existsSync(join(work, "out", MODEL_PACKAGE)));
  const written: Manifest = JSON.parse(readFileSync(join(work, "out", MANIFEST), "utf8")) as Manifest;
  assert.deepEqual(written, manifest);
  assert.equal(manifest.keyboard.version, keyboardVersion());
  assert.equal(manifest.model.version, "2026.10.17", "the model is dated by the snapshot, not by the build");
  assert.equal(manifest.model.snapshot, "2026/10/17 09:01:25 UTC");
  assert.equal(manifest.model.words, 93);
});

test("the pseudo-random strings really cover every piece and every length", () => {
  const mixes: RandomMix[] = randomMixes();
  const used: Set<number> = new Set(mixes.flatMap((m) => m.pieces));
  const lengths: Set<number> = new Set(mixes.map((m) => m.length));
  assert.equal(used.size, PIECES.length, "every piece is drawn");
  assert.equal(lengths.size, MAX_RANDOM_LENGTH, "every length from 1 to 12 occurs");
  // Strings of one or two pieces repeat by necessity [79 and 6,241
  // possibilities]; longer ones must all differ.
  const longer: string[] = mixes.filter((m) => m.length >= 3).map((m) => m.pieces.join(","));
  assert.equal(new Set(longer).size, longer.length, "no long string repeats");
  assert.ok(longer.length > RANDOM_STRINGS * 0.8);
  assert.deepEqual(randomMixes(), mixes, "the same corpus on every run");
});

test("the key function in the compiled model folds exactly like skeleton[]", () => {
  const words: string[] = trieEntries(model.trie.root).map((e) => e.content);
  const disagreements: string[] = keyCorpus(words)
    .filter((input) => model.options.searchTermToKey(input) !== skeleton(input))
    .map((input) => JSON.stringify(input));
  assert.deepEqual(disagreements.slice(0, 20), [], "inputs folded differently by the keyboard and the engine");
});

test("the key function in the source also folds exactly like skeleton[]", () => {
  const words: string[] = trieEntries(model.trie.root).map((e) => e.content);
  const disagreements: string[] = keyCorpus(words)
    .filter((input) => modelSource.searchTermToKey(input) !== skeleton(input))
    .map((input) => JSON.stringify(input));
  assert.deepEqual(disagreements.slice(0, 20), []);
});

test("every word is stored under its skeleton, once, and nothing else is stored", () => {
  const stored: TrieEntry[] = trieEntries(model.trie.root);
  const forms: string[] = stored.map((e) => e.content);
  assert.equal(stored.length, 93);
  assert.equal(new Set(forms).size, forms.length, "no word stored twice");
  for (const entry of stored) {
    assert.equal(entry.key, skeleton(entry.content), `key of ${entry.content}`);
    assert.ok(entry.weight >= 1, `${entry.content} must be reachable`);
  }
});

test("plain typing reaches the special letters, the hyphen and the capital", () => {
  const byKey = (key: string): string[] =>
    trieEntries(model.trie.root).filter((e) => e.key === key).map((e) => e.content).sort();
  assert.deepEqual(byKey(model.options.searchTermToKey("zena")), ["Zêna"]);
  assert.deepEqual(byKey(model.options.searchTermToKey("citae")), ["çitæ"]);
  assert.deepEqual(byKey(model.options.searchTermToKey("canpanna")), ["canpànn-a"]);
  assert.ok(byKey(model.options.searchTermToKey("penna")).includes("pénna"));
});

test("suggestions follow the user's casing", () => {
  assert.equal(model.options.languageUsesCasing, true);
  assert.equal(modelSource.languageUsesCasing, true);
});

// The pieces of the word breaker's corpus: the Ligurian letters in both
// cases, decomposed accents, every apostrophe and hyphen, and the space.
const BREAK_PIECES: readonly string[] = [
  ..."adlqsnAD", ..."àâäèéêìîòôöùûüæçñÀÂÆÇÑ",
  "'", "'", "\u2018", "\u2019", "\u02BC", "-", "\u2010", "\u2011", " ", " ", "e\u0302", "a\u0300",
];

function breakCorpus(): string[] {
  const next: (n: number) => number = generator(29);
  const corpus: string[] = [
    "d'ægua", "D'ÆGUA", "quell'òmmo", "l'ægua d'avéi", "canpànn-a", "'na", "pe'", "d''ægua", "a'b'c",
    "un gotto d'aeg", "d'", "d' ægua", "-d'a-", "",
  ];
  for (let n: number = 0; n < 3000; n += 1) {
    let text: string = "";
    const length: number = 1 + next(14);
    for (let i: number = 0; i < length; i += 1) {
      text += BREAK_PIECES[next(BREAK_PIECES.length)] ?? "";
    }
    corpus.push(text);
  }
  return corpus;
}

// What the engine considers the words of a text: its space-separated
// tokens, each split after its inner apostrophes.
function engineWords(text: string): string[] {
  return text.split(" ").filter((token) => token !== "").flatMap((token) => splitElision(token));
}

function checkBreaker(breaker: (text: string) => Span[]): string[] {
  const problems: string[] = [];
  for (const text of breakCorpus()) {
    const spans: Span[] = breaker(text);
    const words: string[] = spans.map((span) => span.text);
    if (JSON.stringify(words) !== JSON.stringify(engineWords(text))) {
      problems.push(`${JSON.stringify(text)}: ${JSON.stringify(words)} vs ${JSON.stringify(engineWords(text))}`);
    }
    let last: number = 0;
    for (const span of spans) {
      if (text.substring(span.start, span.end) !== span.text || span.length !== span.end - span.start || span.start < last) {
        problems.push(`${JSON.stringify(text)}: bad span ${JSON.stringify(span)}`);
      }
      last = span.end;
    }
  }
  return problems;
}

test("the compiled word breaker splits words exactly where the engine does", () => {
  assert.equal(typeof model.options.wordBreaker, "function");
  // Array.from: the compiled model runs in its own JavaScript context,
  // whose arrays deepEqual would otherwise refuse to compare.
  assert.deepEqual(Array.from(model.options.wordBreaker("un gotto d'aeg"), (s) => s.text), ["un", "gotto", "d'", "aeg"]);
  assert.deepEqual(Array.from(model.options.wordBreaker("a canpànn-a"), (s) => s.text), ["a", "canpànn-a"],
    "hyphenated words stay whole");
  assert.deepEqual(checkBreaker(model.options.wordBreaker).slice(0, 20), []);
});

test("the word breaker in the source also splits exactly where the engine does", () => {
  assert.deepEqual(checkBreaker(modelSource.wordBreaker.use).slice(0, 20), []);
});

test("the keyboard package declares the keyboard, its version and Ligurian", () => {
  const files: Map<string, Buffer> = readZip(readFileSync(join(work, "out", KEYBOARD_PACKAGE)));
  const kmp = JSON.parse(files.get("kmp.json")?.toString("utf8") ?? "{}") as {
    info: { version: { description: string } };
    keyboards: { id: string; version: string; languages: { id: string }[] }[];
  };
  assert.equal(kmp.info.version.description, keyboardVersion());
  assert.equal(kmp.keyboards.length, 1);
  assert.equal(kmp.keyboards[0]?.id, KEYBOARD_ID);
  assert.deepEqual(kmp.keyboards[0]?.languages.map((l) => l.id), ["lij"]);
  for (const name of [`${KEYBOARD_ID}.js`, "readme.htm", "welcome.htm", "LICENSE.md"]) {
    assert.ok(files.has(name), `${name} in ${KEYBOARD_PACKAGE}`);
  }
});

test("the dictionary package declares the model, its dated version and Ligurian", () => {
  const files: Map<string, Buffer> = readZip(readFileSync(join(work, "out", MODEL_PACKAGE)));
  const kmp = JSON.parse(files.get("kmp.json")?.toString("utf8") ?? "{}") as {
    info: { version: { description: string } };
    lexicalModels: { id: string; languages: { id: string }[] }[];
  };
  assert.equal(kmp.info.version.description, "2026.10.17");
  assert.equal(kmp.lexicalModels.length, 1);
  assert.equal(kmp.lexicalModels[0]?.id, MODEL_ID);
  assert.deepEqual(kmp.lexicalModels[0]?.languages.map((l) => l.id), ["lij"]);
  const license: string = files.get("LICENSE.md")?.toString("utf8") ?? "";
  assert.match(license, /CC BY-SA 4\.0/, "the word list carries the data license");
  const packaged: string = files.get(`${MODEL_ID}.model.js`)?.toString("utf8") ?? "";
  const compiled: string = readFileSync(join(work, "stage", MODEL_ID, "build", `${MODEL_ID}.model.js`), "utf8");
  assert.equal(packaged, compiled, "the package holds the model that was tested");
});

test("kmc never reports errors to Keyman and treats warnings as errors", () => {
  const args: string[] = kmcArguments("project.kpj");
  assert.equal(args[0], "build");
  assert.ok(args.includes("--no-error-reporting"));
  assert.ok(args.includes("--compiler-warnings-as-errors"));
  assert.equal(args.at(-1), "project.kpj");
});

test("a failing kmc stops the build and leaves earlier packages untouched", () => {
  const out: string = join(work, "kept-kmc");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "earlier.txt"), "earlier build", "utf8");
  const compiled: string[] = [];
  const failOnModel = (projectFile: string): void => {
    compiled.push(projectFile);
    if (projectFile.endsWith(`${MODEL_ID}.kpj`)) {
      throw new BuildError(["kmc failed [simulated]"]);
    }
  };
  assert.throws(
    () => buildPackages(SNAPSHOT, { outDir: out, stageDir: join(work, "stage-kmc"), now: new Date(), compile: failOnModel }),
    (error: unknown) => error instanceof BuildError && error.problems.includes("kmc failed [simulated]"),
  );
  assert.equal(compiled.length, 2, "the keyboard compiled, then the model failed");
  assert.equal(readFileSync(join(out, "earlier.txt"), "utf8"), "earlier build");
  assert.ok(!existsSync(join(out, KEYBOARD_PACKAGE)), "nothing new was written");
});

test("a bad snapshot stops the build and leaves earlier packages untouched", () => {
  const out: string = join(work, "kept");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "earlier.txt"), "earlier build", "utf8");
  const bad: string = "form\tfreq\tvariety\torthography\tstatus\nzen@\t1\tzeneize\tofiçiâ\tapproved\n";
  assert.throws(
    () => buildPackages(bad, { outDir: out, stageDir: join(work, "stage-bad"), now: new Date() }),
    (error: unknown) => error instanceof BuildError && error.problems.some((p) => p.includes("invalid form")),
  );
  assert.equal(readFileSync(join(out, "earlier.txt"), "utf8"), "earlier build");
});
