/*
 * dumps.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 11:12:30, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of the choice of the dump to count [dumps.ts]: the run
 *           list, and every answer a run's dumpstatus.json can give.
 * Method:   The index page and the status files are written for these
 *           tests in the shape Wikimedia publishes them.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { articlesDump, dumpDates, DUMPS_HOST } from "../src/dumps.ts";

const SHA1: string = "0123456789abcdef0123456789ABCDEF01234567";

function status(job: unknown): string {
  return JSON.stringify({ jobs: { metacurrentdump: { status: "done", files: {} }, articlesdump: job }, version: "0.8" });
}

function done(date: string, extra: Record<string, unknown> = {}): string {
  const file: string = `lijwiki-${date}-pages-articles.xml.bz2`;
  return status({
    status: "done",
    updated: "2026-10-02 08:00:00",
    files: { [file]: { size: 31457280, url: `/lijwiki/${date}/${file}`, md5: "x", sha1: SHA1, ...extra } },
  });
}

test("the run list keeps dated runs only, newest first, each once", () => {
  const html: string = `<html><body><h1>Index of /lijwiki/</h1><pre>
<a href="../">../</a>
<a href="20260820/">20260820/</a>  20-Aug-2026 04:00  -
<a href="20261001/">20261001/</a>  01-Oct-2026 04:00  -
<a href="20260901/">20260901/</a>  01-Sep-2026 04:00  -
<a href="20261001/">20261001/</a>
<a href="latest/">latest/</a>     17-Oct-2026 02:00  -
</pre></body></html>`;
  assert.deepEqual(dumpDates(html), ["20261001", "20260901", "20260820"]);
  assert.deepEqual(dumpDates("<html>nothing here</html>"), []);
});

test("a finished run gives its file, an address on Wikimedia and its SHA-1 in lower case", () => {
  const check = articlesDump("lijwiki", "20261001", done("20261001"));
  assert.deepEqual(check, {
    ok: true,
    dump: {
      date: "20261001",
      file: "lijwiki-20261001-pages-articles.xml.bz2",
      url: `${DUMPS_HOST}/lijwiki/20261001/lijwiki-20261001-pages-articles.xml.bz2`,
      sha1: SHA1.toLowerCase(),
      size: 31457280,
    },
  });
});

test("the address never comes from the downloaded JSON", () => {
  const check = articlesDump("lijwiki", "20261001", done("20261001", { url: "https://example.org/evil.xml.bz2" }));
  assert.ok(check.ok);
  assert.ok(check.ok && check.dump.url.startsWith(`${DUMPS_HOST}/lijwiki/20261001/`));
});

test("an unfinished, missing, unsigned or unreadable run is refused with its reason", () => {
  const cases: [string, RegExp][] = [
    [status({ status: "in-progress", files: {} }), /"in-progress", not "done"/u],
    [status({ status: "waiting" }), /"waiting"/u],
    [status({ status: "done", files: { "lijwiki-20261001-pages-articles-multistream.xml.bz2": { sha1: SHA1 } } }),
      /lists no lijwiki-20261001-pages-articles\.xml\.bz2/u],
    [done("20261001", { sha1: "not-a-hash" }), /no valid SHA-1/u],
    [done("20261001", { sha1: undefined }), /no valid SHA-1/u],
    [JSON.stringify({ jobs: {} }), /no articlesdump job/u],
    ["<html>404 Not Found</html>", /not valid JSON/u],
    ["null", /not valid JSON/u],
  ];
  for (const [json, reason] of cases) {
    const check = articlesDump("lijwiki", "20261001", json);
    assert.equal(check.ok, false, json);
    assert.match(check.ok ? "" : check.reason, reason, json);
  }
});

test("the file of another run's date is not taken for this run", () => {
  const check = articlesDump("lijwiki", "20261001", done("20260901"));
  assert.equal(check.ok, false);
});
