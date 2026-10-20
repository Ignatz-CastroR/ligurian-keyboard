/*
 * review-pages.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/19, 23:25:40, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Prove migration 0010: the review queue in pages shows every
 *           caller the pending rows the view review_queue shows them,
 *           and never a parent they could not read themselves; one API
 *           row per entry, so no cap on rows can cut an entry; entries
 *           oldest first, page after page without gap or repeat while
 *           nobody reviews; position and totals counted by the
 *           database, right even after others reviewed meanwhile;
 *           anonymous visitors refused; and at the live dictionary's
 *           size, many times faster than the view.
 * Contract: Every test builds its own database.
 * Decision: docs/decisions/0033-batch-review.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { USERS, asUser, createSeededDatabase, migrationNames, rowsAs, type Identity } from "./harness.ts";

const admin = asUser(USERS.admin);
const reviewer = asUser(USERS.reviewer);
const contributor = asUser(USERS.contributor);
const contributor2 = asUser(USERS.contributor2);
const member = asUser(USERS.member);

interface Row { kind: string; id: number; lemma_id: number; group_created?: string; [column: string]: unknown }

async function one(db: PGlite, who: Identity, sql: string, params: unknown[] = []): Promise<number> {
  return (await rowsAs<{ id: number }>(db, who, sql, params))[0]?.id ?? -1;
}

/* Entries written one statement after another, so that each has its
   own time: a contributor's whole entry, a second contributor's parts
   on it, an approved lemma with new parts, a deleted one. */
async function fill(db: PGlite): Promise<Record<string, number>> {
  const penna: number = await one(db, contributor, "insert into lemmas (headword) values ('pénna') returning id");
  const sense: number = await one(db, contributor, "insert into senses (lemma_id, definition_it) values ($1, 'strumento') returning id", [penna]);
  await one(db, contributor, "insert into glosses (sense_id, language, gloss) values ($1, 'es', 'pluma') returning id", [sense]);
  await one(db, contributor2, "insert into glosses (sense_id, language, gloss) values ($1, 'en', 'pen') returning id", [sense]);
  await one(db, contributor2, "insert into wordforms (lemma_id, form) values ($1, 'pénne') returning id", [penna]);
  const ca: number = await one(db, admin, "insert into lemmas (headword, status) values ('cà', 'approved') returning id");
  await one(db, contributor, "insert into wordforms (lemma_id, form) values ($1, 'cæ') returning id", [ca]);
  const zena: number = await one(db, contributor2, "insert into lemmas (headword) values ('Zêna') returning id");
  const gone: number = await one(db, contributor, "insert into lemmas (headword) values ('zuppa') returning id");
  await one(db, contributor, "insert into senses (lemma_id) values ($1) returning id", [gone]);
  await rowsAs(db, admin, "update lemmas set deleted_at = now() where id = $1", [gone]);
  return { penna, ca, zena, gone };
}

const VIEW_COLUMNS: string = `kind, id, lemma_id, text, created_by, created_at, version, lemma_headword,
  lemma_status, lemma_public_id, sense_id, sense_number, definition_it, language, gloss`;

interface PageRow { lemma_id: number; group_created: string; entry_number: number; total_entries: number; total_items: number; items: Row[] }

const key = (r: Row): string => `${r.kind}:${r.id}`;

async function page(db: PGlite, who: Identity, after: PageRow | null, size: number): Promise<PageRow[]> {
  // Timestamps travel as text, as through the API.
  return rowsAs<PageRow>(db, who,
    `select lemma_id, group_created::text as group_created, entry_number::int as entry_number,
            total_entries::int as total_entries, total_items::int as total_items, items
       from public.review_queue_page($1::timestamptz, $2, $3)`,
    [after?.group_created ?? null, after?.lemma_id ?? null, size]);
}

async function allPages(db: PGlite, who: Identity, size: number): Promise<PageRow[][]> {
  const pages: PageRow[][] = [];
  let after: PageRow | null = null;
  let done: boolean = false;
  while (!done) {
    const rows: PageRow[] = await page(db, who, after, size);
    if (rows.length === 0) {
      done = true;
    } else {
      pages.push(rows);
      after = rows.at(-1) ?? null;
    }
  }
  return pages;
}

const itemsOf = (pages: PageRow[][]): Row[] => pages.flat().flatMap((p) => p.items);

test("migration 0010 runs after 0009", () => {
  const names: string[] = migrationNames();
  assert.equal(names[names.indexOf("0009_dictionary_for_readers.sql") + 1], "0010_review_queue_pages.sql");
});

test("every caller gets the pending rows the view shows them, and no parent they could not read themselves", async () => {
  const db = await createSeededDatabase();
  const ids = await fill(db);
  // A translation under another contributor's pending sense of an
  // approved lemma: the view hid the lemma too; the pages show it, and
  // the second contributor can read it directly.
  const sense: number = await one(db, contributor, "insert into senses (lemma_id, definition_it) values ($1, 'casa') returning id", [ids["ca"]]);
  await one(db, contributor2, "insert into glosses (sense_id, language, gloss) values ($1, 'es', 'casa') returning id", [sense]);

  for (const who of [reviewer, admin, contributor, contributor2, member]) {
    const view: Row[] = await rowsAs<Row>(db, who, `select ${VIEW_COLUMNS} from review_queue`);
    const paged: Row[] = itemsOf(await allPages(db, who, 1));
    assert.deepEqual(paged.map(key).sort(), view.map(key).sort(), JSON.stringify(who));
    for (const row of paged) {
      if (row["lemma_headword"] !== null) {
        const readable = await rowsAs(db, who, "select 1 from lemmas where id = $1 and headword = $2", [row.lemma_id, row["lemma_headword"]]);
        assert.equal(readable.length, 1, `${JSON.stringify(who)} sees lemma ${row.lemma_id} it cannot read`);
      }
      if (row["definition_it"] !== null || row["sense_number"] !== null) {
        const readable = await rowsAs(db, who, "select 1 from senses where id = $1", [row["sense_id"]]);
        assert.equal(readable.length, 1, `${JSON.stringify(who)} sees sense ${String(row["sense_id"])} it cannot read`);
      }
    }
  }
  const own: Row[] = itemsOf(await allPages(db, contributor2, 10));
  const hidden: Row | undefined = own.find((r) => r.kind === "gloss" && r["gloss"] === "pen");
  assert.deepEqual([hidden?.["lemma_headword"], hidden?.["definition_it"]], [null, null]);
  const visibleLemma: Row | undefined = own.find((r) => r.kind === "gloss" && r["gloss"] === "casa");
  assert.deepEqual([visibleLemma?.["lemma_headword"], visibleLemma?.["definition_it"]], ["cà", null]);
});

test("entries come oldest first, whole, one API row each, page after page without gap or repeat", async () => {
  const db = await createSeededDatabase();
  const ids = await fill(db);
  const pages: PageRow[][] = await allPages(db, reviewer, 1);
  assert.deepEqual(pages.map((p) => p.map((e) => e.lemma_id)), [[ids["penna"]], [ids["ca"]], [ids["zena"]]]);
  assert.deepEqual(pages.map((p) => p[0]?.entry_number), [1, 2, 3]);
  assert.ok(pages.flat().every((e) => e.total_entries === 3 && e.total_items === 7));
  assert.deepEqual(pages[0]?.[0]?.items.map(key).sort(),
    itemsOf(await allPages(db, reviewer, 50)).filter((r) => r.lemma_id === ids["penna"]).map(key).sort());
  assert.deepEqual(pages[1]?.[0]?.items.map((r) => [r.kind, r["lemma_status"]]), [["wordform", "approved"]]);
  assert.ok(!itemsOf(pages).some((r) => r.lemma_id === ids["gone"]));
});

test("an entry of many rows is still one API row, so a cap on rows can never cut it", async () => {
  const db = await createSeededDatabase();
  const lemma: number = await one(db, contributor, "insert into lemmas (headword) values ('pénna') returning id");
  for (let n = 1; n <= 30; n += 1) {
    const sense: number = await one(db, contributor, "insert into senses (lemma_id) values ($1) returning id", [lemma]);
    await one(db, contributor, "insert into glosses (sense_id, language, gloss) values ($1, 'it', $2) returning id", [sense, `voce${n}`]);
  }
  const rows: PageRow[] = await page(db, reviewer, null, 50);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.items.length, 61);
});

test("position and totals stay right when others review meanwhile, so the last entries are never out of reach", async () => {
  const db = await createSeededDatabase();
  for (let n = 1; n <= 12; n += 1) {
    await one(db, contributor, "insert into lemmas (headword) values ($1) returning id", [`zz${"a".repeat(n)}`]);
  }
  const first: PageRow[] = await page(db, reviewer, null, 5);
  const second: PageRow[] = await page(db, reviewer, first.at(-1) ?? null, 5);
  assert.deepEqual([second[0]?.entry_number, second[0]?.total_entries], [6, 12]);
  // Someone approves three entries of the first page.
  for (const entry of first.slice(0, 3)) {
    await rowsAs(db, admin, "update lemmas set status = 'approved' where id = $1", [entry.lemma_id]);
  }
  const third: PageRow[] = await page(db, reviewer, second.at(-1) ?? null, 5);
  const last: PageRow | undefined = third.at(-1);
  assert.deepEqual([third[0]?.entry_number, last?.entry_number, last?.total_entries], [8, 9, 9]);
});

test("visitors are refused; a member sees nothing; the internal function is out of reach", async () => {
  const db = await createSeededDatabase();
  await fill(db);
  await assert.rejects(rowsAs(db, "anon", "select * from public.review_queue_page()"),
    (error: unknown) => (error as { code?: string }).code === "42501");
  await assert.rejects(rowsAs(db, reviewer, "select * from private.review_pending()"),
    (error: unknown) => (error as { code?: string }).code === "42501");
  assert.deepEqual(await page(db, member, null, 50), []);
});

test("at the live dictionary's size, a page answers many times faster than the view", async () => {
  const db = await createSeededDatabase();
  const name: string = "translate(i::text, '0123456789', 'abcdefghil')";
  await db.exec(`
    insert into lemmas (headword, status) select 'p' || ${name} || 'a', 'approved' from generate_series(1, 12000) as i;
    insert into senses (lemma_id, definition_it, status) select id, 'def', 'approved' from lemmas;
    insert into glosses (sense_id, language, gloss, status)
      select s.id, l.code, l.code || ' casa ' || s.id::text, 'approved'
      from senses as s cross join (values ('it'), ('es'), ('en')) as l (code);
    insert into lemmas (headword, status) select 'q' || ${name} || 'o', 'pending' from generate_series(1, 3000) as i;
    insert into senses (lemma_id, status) select id, 'pending' from lemmas where status = 'pending';
    insert into glosses (sense_id, language, gloss, status)
      select id, 'it', 'nuova ' || id::text, 'pending' from senses where status = 'pending';
    analyze;`);
  const time = async (sql: string): Promise<number> => {
    const started: number = Date.now();
    await rowsAs(db, reviewer, sql);
    return Date.now() - started;
  };
  const view: number = await time("select * from review_queue");
  const paged: number = await time("select * from public.review_queue_page()");
  assert.ok(paged * 4 < view, `page ${paged} ms, view ${view} ms`);
  const rows: PageRow[] = await page(db, reviewer, null, 50);
  assert.deepEqual([rows.length, rows[0]?.total_entries, rows[0]?.total_items], [50, 3000, 9000]);
});
