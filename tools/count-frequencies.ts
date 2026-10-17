/*
 * count-frequencies.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 10:09:31, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Count the words of the Ligurian Wikipedia and write the
 *           frequency list the dictionary snapshot uses to rank
 *           spellings that share one ASCII key.
 *           Decision: docs/decisions/0027-real-frequencies.md
 * Usage:    npm run frequencies:count -- --source "<what>" <dump.xml | ->
 *           The dump is the UNCOMPRESSED pages-articles XML; "-" reads
 *           it from standard input, so the workflow pipes it straight
 *           from bzip2 without writing it to disk:
 *             bzip2 -dc lijwiki-20261001-pages-articles.xml.bz2 |
 *               npm run frequencies:count -- --source "..." -
 *           On Windows, extract the .bz2 with 7-Zip first and pass the
 *           .xml file's path.
 * Arguments:
 *           --source       required: what was counted, written into
 *                          the file's "# Source:" line
 *           --orthography  spelling system of the text [ofiçiâ]
 *           --out          where to write [data/frequencies/lijwiki.tsv]
 *           --min-count    leave out rarer words [2]
 * Returns:  exit code 0 when the list was written; 1 on a bad argument,
 *           a read error, or a dump with no article in it, in which case
 *           nothing is written and the old list stays as it was.
 */

import { createReadStream, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { Readable } from "node:stream";
import { addCounts } from "../corpus/src/count.ts";
import { DEFAULT_MIN_COUNT, formatFrequencyList, readFrequencyList } from "../corpus/src/frequency-list.ts";
import { isArticle, PageSplitter, stripWikitext } from "../corpus/src/wikitext.ts";
import { formatUtc } from "../editor/src/snapshot.ts";

const DEFAULT_OUT: string = fileURLToPath(new URL("../data/frequencies/lijwiki.tsv", import.meta.url));

interface Totals {
  pages: number;
  articles: number;
}

async function countDump(input: Readable, counts: Map<string, number>): Promise<Totals> {
  const splitter: PageSplitter = new PageSplitter();
  const totals: Totals = { pages: 0, articles: 0 };
  input.setEncoding("utf8");
  for await (const chunk of input) {
    for (const page of splitter.push(String(chunk))) {
      totals.pages += 1;
      if (isArticle(page)) {
        totals.articles += 1;
        addCounts(stripWikitext(page.text), counts);
      }
    }
  }
  return totals;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      source: { type: "string" },
      orthography: { type: "string", default: "ofiçiâ" },
      out: { type: "string", default: DEFAULT_OUT },
      "min-count": { type: "string", default: String(DEFAULT_MIN_COUNT) },
    },
  });
  const inputPath: string | undefined = positionals[0];
  const minCount: number = Number(values["min-count"]);
  const source: string = (values.source ?? "").trim();

  if (inputPath === undefined || positionals.length !== 1) {
    console.error("Give exactly one input: the uncompressed dump's path, or - for standard input.");
    process.exitCode = 1;
  } else if (source === "") {
    console.error("Missing --source: say what is being counted, e.g. \"Ligurian Wikipedia, dump lijwiki-20261001\".");
    process.exitCode = 1;
  } else if (!Number.isInteger(minCount) || minCount < 1) {
    console.error(`--min-count must be a whole number from 1 up, not "${values["min-count"]}".`);
    process.exitCode = 1;
  } else {
    const counts: Map<string, number> = new Map();
    const input: Readable = inputPath === "-" ? process.stdin : createReadStream(inputPath);
    let totals: Totals = { pages: 0, articles: 0 };
    try {
      totals = await countDump(input, counts);
    } catch (error: unknown) {
      console.error(`Cannot read ${inputPath}: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
    let tokens: number = 0;
    for (const count of counts.values()) {
      tokens += count;
    }
    console.log(`Pages read: ${totals.pages}; articles counted: ${totals.articles}.`);
    console.log(`Distinct words: ${counts.size}; words counted: ${tokens}.`);

    if (process.exitCode === 1) {
      console.error("Nothing was written.");
    } else if (totals.articles === 0) {
      console.error("No article found: is this a pages-articles XML dump, uncompressed? Nothing was written.");
      process.exitCode = 1;
    } else {
      const text: string = formatFrequencyList({
        source,
        orthography: (values.orthography ?? "ofiçiâ").normalize("NFC"),
        counted: formatUtc(new Date()),
        counts,
      }, minCount);
      // The list must read back cleanly, or the snapshot would refuse it.
      const { problems } = readFrequencyList(text);
      if (problems.length > 0) {
        console.error("The new list fails its own reader; nothing was written:");
        for (const problem of problems.slice(0, 20)) {
          console.error(`  ${problem.line > 0 ? `line ${problem.line}: ` : ""}${problem.message}`);
        }
        process.exitCode = 1;
      } else {
        writeFileSync(values.out ?? DEFAULT_OUT, text, "utf8");
        console.log(`Frequency list written to ${values.out ?? DEFAULT_OUT}.`);
      }
    }
  }
}

await main();
