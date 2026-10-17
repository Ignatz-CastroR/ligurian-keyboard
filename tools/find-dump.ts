/*
 * find-dump.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 11:04:37, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Find the newest finished pages-articles dump of a wiki on
 *           dumps.wikimedia.org, or check a given run, and report its
 *           file name, address and SHA-1 for the frequencies workflow.
 *           Decision: docs/decisions/0027-real-frequencies.md
 * Usage:    node tools/find-dump.ts [--wiki lijwiki] [--date YYYYMMDD]
 *           Without --date, the newest runs are tried in turn, at most
 *           MAX_RUNS of them, and the first one whose articles job is
 *           done wins.
 * Returns:  exit code 0 and, when GITHUB_OUTPUT is set, the lines date=,
 *           file=, url= and sha1= appended to it; exit code 1 when no
 *           run qualifies. Every run tried is printed with the reason
 *           it was taken or skipped, so a failure explains itself.
 */

import { appendFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { articlesDump, dumpDates, DUMPS_HOST, type DumpCheck } from "../corpus/src/dumps.ts";

const MAX_RUNS: number = 6;
const HEADERS: Record<string, string> = {
  "user-agent": "ligurian-keyboard frequency counter; https://github.com/Ignatz-CastroR/ligurian-keyboard",
};

async function text(url: string): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const response: Response = await fetch(url, { headers: HEADERS });
    return { ok: response.ok, status: response.status, body: await response.text() };
  } catch (error: unknown) {
    return { ok: false, status: 0, body: error instanceof Error ? error.message : String(error) };
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      wiki: { type: "string", default: "lijwiki" },
      date: { type: "string", default: "" },
    },
  });
  const wiki: string = values.wiki ?? "lijwiki";
  const given: string = (values.date ?? "").trim();

  if (!/^[a-z_]{2,30}wiki$/u.test(wiki)) {
    console.error(`Not a wiki name: "${wiki}".`);
    process.exitCode = 1;
  } else if (given !== "" && given !== "latest" && !/^\d{8}$/u.test(given)) {
    console.error(`A dump date is YYYYMMDD, not "${given}".`);
    process.exitCode = 1;
  } else {
    let dates: string[] = [];
    if (given !== "" && given !== "latest") {
      dates = [given];
    } else {
      const index = await text(`${DUMPS_HOST}/${wiki}/`);
      if (!index.ok) {
        console.error(`Cannot read ${DUMPS_HOST}/${wiki}/: HTTP ${index.status} ${index.body.slice(0, 200)}`);
      }
      dates = dumpDates(index.body).slice(0, MAX_RUNS);
      console.log(`Runs listed: ${dates.join(", ") || "none"}`);
    }

    let found: DumpCheck = { ok: false, reason: "no run listed" };
    for (const date of dates) {
      if (!found.ok) {
        const status = await text(`${DUMPS_HOST}/${wiki}/${date}/dumpstatus.json`);
        found = status.ok
          ? articlesDump(wiki, date, status.body)
          : { ok: false, reason: `dumpstatus.json: HTTP ${status.status}` };
        console.log(`  ${date}: ${found.ok ? `using ${found.dump.file} [${found.dump.size} bytes]` : found.reason}`);
      }
    }

    if (!found.ok) {
      console.error("No finished pages-articles dump found; nothing to count.");
      process.exitCode = 1;
    } else {
      const lines: string = [
        `date=${found.dump.date}`, `file=${found.dump.file}`, `url=${found.dump.url}`, `sha1=${found.dump.sha1}`,
      ].join("\n");
      console.log(lines);
      const output: string | undefined = process.env["GITHUB_OUTPUT"];
      if (output !== undefined && output !== "") {
        appendFileSync(output, `${lines}\n`, "utf8");
      }
    }
  }
}

await main();
