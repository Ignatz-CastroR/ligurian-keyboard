/*
 * demo.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/10, 21:08:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Terminal demo of the input method. Type a line of plain ASCII
 *           Ligurian; each ambiguous word opens a numbered menu, the way
 *           the candidate window of a Japanese IME does.
 * Arguments: optional path to a lexicon TSV
 *            default: data/fixtures/test-lexicon.tsv
 * Tectonics: npm run demo
 */

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { Lexicon, convertToken, renderChoice, type Conversion } from "./index.ts";

const DEFAULT_LEXICON: string = "data/fixtures/test-lexicon.tsv";

async function main(): Promise<void> {
  const path: string = process.argv[2] ?? DEFAULT_LEXICON;
  const lexicon: Lexicon = Lexicon.fromTsv(readFileSync(path, "utf8"));
  for (const err of lexicon.errors) {
    console.warn(`lexicon line ${err.line}: ${err.message}`);
  }
  console.log(`Loaded ${lexicon.size} wordforms from ${path}. Empty line quits.`);

  // An async line iterator keeps buffered lines, so piped input works too.
  const rl = createInterface({ input: stdin, terminal: false });
  const lines: AsyncIterator<string> = rl[Symbol.asyncIterator]();
  const ask: Ask = async (prompt: string): Promise<string> => {
    stdout.write(prompt);
    const next: IteratorResult<string> = await lines.next();
    return next.done === true ? "" : next.value;
  };

  let line: string = await ask("> ");
  while (line.trim() !== "") {
    const output: string[] = [];
    for (const token of line.split(/\s+/).filter((t) => t !== "")) {
      output.push(await resolve(ask, convertToken(lexicon, token)));
    }
    console.log(output.join(" "));
    line = await ask("> ");
  }
  rl.close();
}

type Ask = (prompt: string) => Promise<string>;

async function resolve(ask: Ask, conv: Conversion): Promise<string> {
  let word: string = conv.typed;
  if (conv.kind === "replace") {
    word = renderChoice(conv, 0);
  } else if (conv.kind === "choose") {
    const menu: string = conv.candidates.map((c, i) => `${i + 1}:${c}`).join("  ");
    const answer: string = await ask(`  ${conv.typed} -> ${menu}  [Enter = 1] `);
    const picked: number = answer.trim() === "" ? 0 : Number(answer) - 1;
    word = renderChoice(conv, Number.isInteger(picked) ? picked : 0);
  }
  return word;
}

await main();
