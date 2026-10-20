/*
 * templates.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/19, 23:36:20, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Run the SQL Editor templates of db/templates/ exactly as
 *           they are committed: add-entries.sql writes each entry whole,
 *           one sense with all its translations, each translation its
 *           own row in its own language, as the person named in its
 *           first step, which it requires; its examples write nothing;
 *           a refused entry, an unknown or repeated key included, leaves
 *           nothing written and names the place; and
 *           check-loaded-entries.sql measures the shape a load that
 *           split senses leaves behind.
 * Contract: The template's placeholder user id is replaced with a test
 *           user's, as a person following its Usage would do.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { USERS, asUser, createSeededDatabase, rowsAs } from "./harness.ts";

const ADD: string = readFileSync(new URL("../templates/add-entries.sql", import.meta.url), "utf8");
const CHECK: string = readFileSync(new URL("../templates/check-loaded-entries.sql", import.meta.url), "utf8");
const PLACEHOLDER: string = "00000000-0000-0000-0000-000000000000";

interface GlossRow { sense_number: number; language: string; gloss: string; status: string }

// The SQL Editor runs the whole text as one transaction, as the
// trusted backend: here, as the database's owner, outside any role.
async function runAs(db: PGlite, sql: string): Promise<void> {
  await db.exec(`begin; ${sql}; commit;`);
}

const STEP_4: string = "/* Step 4: remove the helpers.";

// The template as a person fills it: their id in step 1, their entries
// in step 3, just above step 4.
function filled(user: string | null, entries: string[]): string {
  const withUser: string = user === null ? ADD : ADD.replace(PLACEHOLDER, user);
  const lines: string = entries.map((e) => `select pg_temp.add_entry($entry$${e}$entry$);`).join("\n");
  assert.ok(withUser.includes(STEP_4));
  return withUser.replace(STEP_4, `${lines}\n\n${STEP_4}`);
}

const PENNA: string = `{ "headword": "pénna", "part_of_speech": "noun",
  "forms": [ {"form": "pénne", "tag": "pl."} ],
  "senses": [
    { "definition_it": "strumento per scrivere",
      "translations": {"it": ["penna", "stilografica"], "es": ["pluma"], "en": ["pen"]} },
    { "translations": {"it": ["piuma"], "es": ["pluma"], "en": ["feather"]} } ] }`;
const CE: string = `{ "headword": "çê", "part_of_speech": "noun",
  "senses": [ { "definition_it": "cielo", "translations": {"it": ["cielo"], "es": ["cielo"], "en": ["sky"]} } ] }`;

test("the template writes each entry whole: one sense holds all its translations, each in its own language", async () => {
  const db = await createSeededDatabase();
  assert.ok(ADD.includes(PLACEHOLDER));
  await runAs(db, filled(USERS.contributor, [PENNA, CE]));

  const lemmas = await rowsAs<{ headword: string; status: string; created_by: string }>(db, "trusted",
    "select headword, status::text as status, created_by::text as created_by from lemmas order by id");
  assert.deepEqual(lemmas.map((l) => [l.headword, l.status, l.created_by]),
    [["pénna", "pending", USERS.contributor], ["çê", "pending", USERS.contributor]]);

  const glosses = await rowsAs<GlossRow>(db, "trusted",
    `select s.sense_number, g.language, g.gloss, g.status::text as status
       from glosses g join senses s on s.id = g.sense_id join lemmas l on l.id = s.lemma_id
      where l.headword = 'pénna' order by s.sense_number, g.language, g.gloss`);
  assert.deepEqual(glosses.map((g) => [g.sense_number, g.language, g.gloss]), [
    [1, "en", "pen"], [1, "es", "pluma"], [1, "it", "penna"], [1, "it", "stilografica"],
    [2, "en", "feather"], [2, "es", "pluma"], [2, "it", "piuma"],
  ]);
  const forms = await rowsAs<{ form: string; grammatical_tag: string | null }>(db, "trusted",
    "select form, grammatical_tag from wordforms where not is_base order by form");
  assert.deepEqual(forms, [{ form: "pénne", grammatical_tag: "pl." }]);

  // The history names the person, the entries wait in the queue, and
  // the helpers are gone once the run ends.
  const actors = await rowsAs<{ actor: string }>(db, "trusted", "select distinct actor::text as actor from audit_log");
  assert.deepEqual(actors, [{ actor: USERS.contributor }]);
  const waiting = await rowsAs<{ total_entries: number }>(db, asUser(USERS.reviewer),
    "select total_entries::int as total_entries from public.review_queue_page() limit 1");
  assert.equal(waiting[0]?.total_entries, 2);
  await assert.rejects(db.exec("select pg_temp.add_entry('{}')"), /does not exist/u);
});

test("the examples are comments: a run with no entry of its own writes nothing", async () => {
  const db = await createSeededDatabase();
  await runAs(db, ADD.replace(PLACEHOLDER, USERS.contributor));
  assert.deepEqual(await rowsAs(db, "trusted", "select id from lemmas"), []);
});

test("a refused entry leaves nothing written, and the error names the headword, the place and the reason", async () => {
  const cases: [string, RegExp][] = [
    [`{"headword": "cà", "senses": [{"translations": {"it": ["casa; dimora"]}}]}`,
      /entry "cà", the it translation "casa; dimora" of sense 1: it holds a ";"/u],
    [`{"headword": "cà", "senses": [{"translations": {"fr": ["maison"]}}]}`, /entry "cà", the "fr" translations of sense 1: unknown translation language "fr"/u],
    [`{"headword": "cà", "senses": [{"translations": {"it": "casa"}}]}`, /entry "cà", the "it" translations of sense 1: they must be a list/u],
    [`{"headword": "cà", "status": "maybe"}`, /entry "cà", the lemma: invalid input value for enum/u],
    [`{"headword": "c@"}`, /entry "c@", the lemma:/u],
    [`{"part_of_speech": "noun"}`, /entry "\?", the lemma: the entry has no headword/u],
    [`{"headword": "cà", "pos": "noun"}`, /entry "cà", the lemma: unknown key: pos/u],
    [`{"headword": "cà", "senses": [{"definition": "casa"}]}`, /entry "cà", sense 1: unknown key: definition/u],
    [`{"headword": "cà", "senses": [{"translation": {"it": ["casa"]}}]}`, /entry "cà", sense 1: unknown key: translation/u],
    [`{"headword": "cà", "senses": ["casa"]}`, /entry "cà", sense 1: a sense must be an object/u],
    [`{"headword": "cà", "forms": [{"form": "cæ", "grammatical_tag": "pl."}]}`, /entry "cà", the form .*: unknown key: grammatical_tag/u],
    [`{"headword": "cà", "forms": [{"form": "c@"}]}`, /entry "cà", the form "c@":/u],
    [`{"headword": "cà", "senses": [{"translations": {"it": ["casa"], "it": ["dimora"]}}]}`, /the key "it" is written twice/u],
    [`{"headword": "cà", "headword": "ca"}`, /the key "headword" is written twice/u],
  ];
  for (const [entry, message] of cases) {
    const db = await createSeededDatabase();
    await assert.rejects(runAs(db, filled(USERS.reviewer, [entry, CE])), message, entry);
    await db.exec("rollback").catch(() => undefined);
    const count = await rowsAs<{ n: number }>(db, "trusted", "select count(*)::int as n from lemmas");
    assert.equal(count[0]?.n, 0, entry);
  }
});

test("step 1 is required: zeros, a deleted line, or a reused session without it are all refused", async () => {
  const db = await createSeededDatabase();
  await assert.rejects(runAs(db, filled(null, [CE])), /step 1 names nobody/u);
  await db.exec("rollback").catch(() => undefined);
  const noStep1: string = filled(USERS.reviewer, [CE]).replace(/^select set_config\('request\.jwt\.claims'.*$/mu, "");
  await assert.rejects(runAs(db, noStep1), /step 1 names nobody/u);
  await db.exec("rollback").catch(() => undefined);
  // A session that kept the helpers [no step 4] cannot write without a
  // person either: step 1 lasts one run.
  const keepHelpers: string = filled(USERS.reviewer, [CE]).slice(0, filled(USERS.reviewer, [CE]).indexOf(STEP_4));
  await runAs(db, keepHelpers);
  await assert.rejects(runAs(db, `select pg_temp.add_entry($entry$${PENNA}$entry$)`), /step 1 names nobody/u);
  await db.exec("rollback").catch(() => undefined);
  const count = await rowsAs<{ n: number }>(db, "trusted", "select count(*)::int as n from lemmas");
  assert.equal(count[0]?.n, 1);
});

test("a reviewer may write entries approved; a contributor's stay pending", async () => {
  const approved = await createSeededDatabase();
  await runAs(approved, filled(USERS.reviewer, [PENNA, CE.replace('"headword": "çê",', '"headword": "çê", "status": "approved",')]));
  const statuses = await rowsAs<{ status: string }>(approved, "trusted", "select status::text as status from lemmas order by id");
  assert.deepEqual(statuses.map((s) => s.status), ["pending", "approved"]);
  const forced = await createSeededDatabase();
  await runAs(forced, filled(USERS.contributor, [CE.replace('"headword": "çê",', '"headword": "çê", "status": "approved",')]));
  assert.deepEqual(await rowsAs(forced, "trusted", "select status::text as status from lemmas"), [{ status: "pending" }]);
});

test("the check measures what a load that made a sense per translation leaves behind, and changes nothing", async () => {
  const db = await createSeededDatabase();
  await runAs(db, filled(USERS.reviewer, [PENNA, CE]));
  // A load in the old shape: a sense per translation, all in Italian,
  // one with a ";", no author.
  await db.exec(`
    insert into lemmas (headword, status) values ('ægua', 'approved');
    insert into senses (lemma_id, status) select id, 'approved' from lemmas where headword = 'ægua';
    insert into senses (lemma_id, status) select id, 'approved' from lemmas where headword = 'ægua';
    insert into senses (lemma_id, status) select id, 'approved' from lemmas where headword = 'ægua';
    insert into glosses (sense_id, language, gloss, status)
      select s.id, 'it', (array['acqua', 'agua', 'water; aqua'])[s.sense_number], 'approved'
      from senses s join lemmas l on l.id = s.lemma_id where l.headword = 'ægua';`);
  const before = await rowsAs(db, "trusted", "select count(*) from audit_log");
  const measures = new Map((await rowsAs<{ measure: string; value: number }>(db, "trusted", CHECK))
    .map((r) => [r.measure, Number(r.value)]));
  assert.equal(measures.get("lemmas whose senses look split one per translation"), 1);
  assert.equal(measures.get("senses in those lemmas"), 3);
  assert.equal(measures.get('translations holding ";" [several in one]'), 1);
  assert.equal(measures.get("translations in it"), 7);
  assert.equal(measures.get("translations in es"), 3);
  assert.equal(measures.get("translations in en"), 3);
  assert.equal(measures.get("lemmas with no author [written as the trusted backend, or account deleted]"), 1);
  assert.equal(measures.get("rows waiting for review"), 16);
  const queue = await rowsAs<{ total_items: number }>(db, asUser(USERS.reviewer),
    "select total_items::int as total_items from public.review_queue_page() limit 1");
  assert.equal(queue[0]?.total_items, measures.get("rows waiting for review"));
  assert.deepEqual(await rowsAs(db, "trusted", "select count(*) from audit_log"), before);
});
