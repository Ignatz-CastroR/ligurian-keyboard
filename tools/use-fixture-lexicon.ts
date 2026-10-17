/*
 * use-fixture-lexicon.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 02:12:33, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Put the 93-form test fixture where the web editor looks for
 *           its dictionary, so the editor can be tried locally without
 *           a Supabase project.
 * Usage:    npm run lexicon:fixture, then npm run editor:dev
 * Contract: Local use only. editor/public/lexicon.tsv is ignored by git;
 *           the published site always gets a real snapshot from the
 *           database [tools/fetch-lexicon.ts].
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { stampSnapshot } from "../editor/src/snapshot.ts";

const SOURCE: string = fileURLToPath(new URL("../data/fixtures/test-lexicon.tsv", import.meta.url));
const TARGET: string = fileURLToPath(new URL("../editor/public/lexicon.tsv", import.meta.url));

writeFileSync(TARGET, stampSnapshot(readFileSync(SOURCE, "utf8"), new Date()), "utf8");
console.log(`Test fixture copied to ${TARGET}`);
