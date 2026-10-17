/*
 * dumps.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 10:58:44, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Choose the Wikipedia dump to count: read the list of dump
 *           runs of a wiki and the status file of a run, and say which
 *           pages-articles file is finished, where it is and what its
 *           SHA-1 must be.
 *           Decision: docs/decisions/0027-real-frequencies.md
 * Contract: Pure functions, no network; tools/find-dump.ts fetches the
 *           pages. Wikimedia's own dumpstatus.json is the authority: a
 *           run is used only when its "articlesdump" job says "done"
 *           and lists the run's pages-articles file, whose SHA-1 is
 *           taken from it. 0.8.0 guessed the run from an RSS file
 *           instead, and the download failed with HTTP 404. The address
 *           is always built on dumps.wikimedia.org, never taken from
 *           the downloaded JSON, so the file cannot come from elsewhere.
 */

export interface ArticlesDump {
  date: string;     // the run, YYYYMMDD
  file: string;     // e.g. lijwiki-20261001-pages-articles.xml.bz2
  url: string;      // absolute https address of the file
  sha1: string;     // 40 hexadecimal digits, lower case
  size: number;     // bytes, as Wikimedia reports it
}

export type DumpCheck =
  | { ok: true; dump: ArticlesDump }
  | { ok: false; reason: string };

export const DUMPS_HOST: string = "https://dumps.wikimedia.org";

// The dates of the runs listed on https://dumps.wikimedia.org/<wiki>/,
// newest first, each once. "latest/" and anything else are ignored.
export function dumpDates(indexHtml: string): string[] {
  const dates: Set<string> = new Set();
  for (const match of indexHtml.matchAll(/href="(\d{8})\/?"/gu)) {
    dates.add(match[1] ?? "");
  }
  return [...dates].filter((d) => d !== "").sort().reverse();
}

// What one run's dumpstatus.json says about its pages-articles file.
export function articlesDump(wiki: string, date: string, statusJson: string): DumpCheck {
  let result: DumpCheck = { ok: false, reason: "no articlesdump job in dumpstatus.json" };
  let status: unknown;
  try {
    status = JSON.parse(statusJson);
  } catch {
    status = null;
  }
  const job: unknown = (status as { jobs?: Record<string, unknown> } | null)?.jobs?.["articlesdump"];
  const wanted: string = `${wiki}-${date}-pages-articles.xml.bz2`;

  if (status === null || typeof status !== "object") {
    result = { ok: false, reason: "dumpstatus.json is not valid JSON" };
  } else if (job !== undefined && job !== null && typeof job === "object") {
    const jobStatus: unknown = (job as { status?: unknown }).status;
    const files: unknown = (job as { files?: unknown }).files;
    const entry: unknown = files !== null && typeof files === "object"
      ? (files as Record<string, unknown>)[wanted] : undefined;
    const sha1: unknown = (entry as { sha1?: unknown } | undefined)?.sha1;
    const size: unknown = (entry as { size?: unknown } | undefined)?.size;
    if (jobStatus !== "done") {
      result = { ok: false, reason: `articlesdump is "${String(jobStatus)}", not "done"` };
    } else if (entry === undefined || entry === null || typeof entry !== "object") {
      result = { ok: false, reason: `articlesdump lists no ${wanted}` };
    } else if (typeof sha1 !== "string" || !/^[0-9a-fA-F]{40}$/u.test(sha1)) {
      result = { ok: false, reason: `${wanted} has no valid SHA-1` };
    } else {
      result = {
        ok: true,
        dump: {
          date,
          file: wanted,
          url: `${DUMPS_HOST}/${wiki}/${date}/${wanted}`,
          sha1: sha1.toLowerCase(),
          size: typeof size === "number" ? size : 0,
        },
      };
    }
  }
  return result;
}
