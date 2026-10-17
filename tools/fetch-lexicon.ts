/*
 * fetch-lexicon.ts
 * Author:   Ignatz-CastroR and contributors
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
 * Returns:  exit code 0 when the snapshot was written; 1 when a setting
 *           is missing, the call fails or the snapshot fails its checks.
 *           On failure nothing is written, so a bad snapshot can never
 *           be published: the build stops and the site keeps its last
 *           good version.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkSnapshot, stampSnapshot } from "../editor/src/snapshot.ts";

const TARGET: string = fileURLToPath(new URL("../editor/public/lexicon.tsv", import.meta.url));

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
      const problems: string[] = checkSnapshot(data);
      if (problems.length > 0) {
        console.error("The snapshot failed its checks; nothing was written:");
        for (const problem of problems) {
          console.error(`  ${problem}`);
        }
        process.exitCode = 1;
      } else {
        writeFileSync(TARGET, stampSnapshot(data, new Date()), "utf8");
        console.log(`Snapshot written to ${TARGET}`);
      }
    }
  }
}

await main();
