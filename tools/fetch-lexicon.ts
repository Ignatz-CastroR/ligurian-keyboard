/*
 * fetch-lexicon.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 02:12:21, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Take the dictionary snapshot for the web editor: call
 *           export_lexicon_tsv[] on Supabase, check the result, stamp it
 *           with the time and write it to editor/public/lexicon.tsv,
 *           which Vite copies into the published site.
 * Usage:    npm run lexicon:snapshot
 * Settings: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, from the
 *           root .env locally or from the workflow's environment. The
 *           function is granted to anon, so the publishable key suffices;
 *           the secret key is never needed and must never be used here.
 * Updated:  2026/10/17, 10:14:52: real frequencies. When the committed
 *           frequency list data/frequencies/lijwiki.tsv exists, its
 *           counts are added to the freq column of the rows written in
 *           its orthography, and a "# Frequencies:" line records which
 *           list was used. A list that fails to read stops the build,
 *           like a bad snapshot [decision 0027].
 * Returns:  exit code 0 when the snapshot was written; 1 when a setting
 *           is missing, the call fails or the snapshot fails its checks.
 *           On failure nothing is written, so a bad snapshot can never
 *           be published: the build stops and the site keeps its last
 *           good version.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkSnapshot, stampSnapshot } from "../editor/src/snapshot.ts";
import { applyFrequencies, readFrequencyList } from "../corpus/src/frequency-list.ts";

const TARGET: string = fileURLToPath(new URL("../editor/public/lexicon.tsv", import.meta.url));
const FREQUENCIES: string = fileURLToPath(new URL("../data/frequencies/lijwiki.tsv", import.meta.url));

// The snapshot with the corpus counts added, or the reasons it cannot
// have them. Without a frequency list, the database's own freq stands.
function rankWithCorpus(tsv: string): { tsv: string; problems: string[] } {
  let result: { tsv: string; problems: string[] } = { tsv, problems: [] };
  if (!existsSync(FREQUENCIES)) {
    console.log("No frequency list in data/frequencies/; the database's frequencies are used as they are.");
  } else {
    const { list, problems } = readFrequencyList(readFileSync(FREQUENCIES, "utf8"));
    if (problems.length > 0) {
      result = {
        tsv,
        problems: problems.map((p) => `data/frequencies/lijwiki.tsv${p.line > 0 ? `, line ${p.line}` : ""}: ${p.message}`),
      };
    } else {
      const ranked = applyFrequencies(tsv, list);
      const note: string = `# Frequencies: ${list.source}; counted ${list.counted}; `
        + `${ranked.matched} rows in ${list.orthography} ranked by it.`;
      console.log(note.slice(2));
      result = { tsv: `${note}\n${ranked.tsv}`, problems: [] };
    }
  }
  return result;
}

async function main(): Promise<void> {
  const url: string = process.env["VITE_SUPABASE_URL"] ?? "";
  const key: string = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "";

  if (url === "" || key === "") {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY [see .env.example].");
    process.exitCode = 1;
  } else {
    const client: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await client.rpc("export_lexicon_tsv");

    if (error !== null) {
      console.error(`export_lexicon_tsv failed: ${error.message}`);
      process.exitCode = 1;
    } else if (typeof data !== "string") {
      console.error("export_lexicon_tsv did not return text.");
      process.exitCode = 1;
    } else {
      const ranked: { tsv: string; problems: string[] } = rankWithCorpus(data);
      const problems: string[] = [...ranked.problems, ...checkSnapshot(ranked.tsv)];
      if (problems.length > 0) {
        console.error("The snapshot failed its checks; nothing was written:");
        for (const problem of problems) {
          console.error(`  ${problem}`);
        }
        process.exitCode = 1;
      } else {
        writeFileSync(TARGET, stampSnapshot(ranked.tsv, new Date()), "utf8");
        console.log(`Snapshot written to ${TARGET}`);
      }
    }
  }
}

await main();
