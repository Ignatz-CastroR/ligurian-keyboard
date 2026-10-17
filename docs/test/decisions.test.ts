/*
 * decisions.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 11:24:09, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Keep the decision records and their two tables in step: the
 *           index in docs/decisions/README.md and the table in the root
 *           README.md must name every record exactly as its own title
 *           does, and every cross-reference must be answered by the
 *           record it points to. Both drifted apart once, by hand.
 * Contract: The records are the source of truth; the tables follow them.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const DIR: URL = new URL("../decisions/", import.meta.url);
const read = (url: URL): string => readFileSync(url, "utf8");

interface Decision {
  number: string;
  file: string;
  title: string;
  date: string;
  status: string;
  links: Record<"refines" | "refinedBy" | "supersedes" | "supersededBy", string[]>;
}

function numbersOn(text: string, label: string): string[] {
  const line: string = text.split("\n").find((l) => l.startsWith(`* **${label}:**`)) ?? "";
  return [...line.matchAll(/\[(\d{4})\]/gu)].map((m) => m[1] ?? "");
}

const decisions: Decision[] = readdirSync(DIR)
  .filter((file) => /^\d{4}-.*\.md$/u.test(file))
  .sort()
  .map((file): Decision => {
    const text: string = read(new URL(file, DIR));
    const head: RegExpMatchArray | null = text.match(/^# (\d{4}): (.+)$/mu);
    let status: string = text.match(/\*\*Status:\*\* (\w+)/u)?.[1] ?? "";
    const supersededBy: string[] = numbersOn(text, "Superseded in part by");
    if (supersededBy.length > 0) {
      status += supersededBy.map((n) => `; superseded in part by [${n}]`).join("");
    }
    return {
      number: head?.[1] ?? "",
      file,
      title: head?.[2] ?? "",
      date: text.match(/\*\*Date:\*\* (\d{4}\/\d{2}\/\d{2})/u)?.[1] ?? "",
      status,
      links: {
        refines: numbersOn(text, "Refines"),
        refinedBy: numbersOn(text, "Refined by"),
        supersedes: numbersOn(text, "Supersedes"),
        supersededBy,
      },
    };
  });

test("every record has a number matching its file, a title, a date and a status", () => {
  assert.ok(decisions.length >= 28);
  decisions.forEach((d, index) => {
    assert.equal(d.number, String(index + 1).padStart(4, "0"), `${d.file}: numbers run without gaps`);
    assert.ok(d.file.startsWith(`${d.number}-`), d.file);
    assert.notEqual(d.title, "", d.file);
    assert.match(d.date, /^\d{4}\/\d{2}\/\d{2}$/u, d.file);
    assert.ok(d.status.startsWith("accepted") || d.status.startsWith("superseded"), d.file);
  });
});

test("the index names every record by its own title, date and status", () => {
  const index: string = read(new URL("README.md", DIR));
  const rows: string[] = index.split("\n").filter((l) => /^\| \[\d{4}\]/u.test(l));
  const expected: string[] = decisions.map((d) => {
    const status: string = d.status.replace(/\[(\d{4})\]/gu, (_w, n: string) => {
      const target: Decision | undefined = decisions.find((x) => x.number === n);
      return `[${n}](${target?.file ?? ""})`;
    });
    return `| [${d.number}](${d.file}) | ${d.title} | ${d.date} | ${status} |`;
  });
  assert.deepEqual(rows, expected);
});

test("the root README names every record by its own title", () => {
  const readme: string = read(new URL("../../README.md", import.meta.url));
  const rows: string[] = readme.split("\n").filter((l) => /^\| \[\d{4}\]\(docs\/decisions\//u.test(l));
  assert.deepEqual(rows, decisions.map((d) => `| [${d.number}](docs/decisions/${d.file}) | ${d.title} |`));
});

test("every cross-reference is answered by the record it points to", () => {
  const byNumber: Map<string, Decision> = new Map(decisions.map((d) => [d.number, d]));
  const pairs: [keyof Decision["links"], keyof Decision["links"]][] = [
    ["refines", "refinedBy"], ["refinedBy", "refines"],
    ["supersedes", "supersededBy"], ["supersededBy", "supersedes"],
  ];
  for (const d of decisions) {
    for (const [mine, theirs] of pairs) {
      for (const n of d.links[mine]) {
        const other: Decision | undefined = byNumber.get(n);
        assert.ok(other !== undefined, `${d.number} points to a missing record ${n}`);
        assert.ok(other.links[theirs].includes(d.number), `${d.number} ${mine} ${n}, but ${n} does not answer in "${theirs}"`);
      }
    }
  }
});
