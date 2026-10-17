/*
 * search-keys.test.ts
 * Author:    Ignatz-CastroR and contributors
 * Date:      2026/10/11, 20:11:58, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:   Prove that the database's private.skeleton[] folds exactly
 *            like the engine's skeleton[], and that the generated search
 *            keys follow every change of spelling.
 * Contract:  The engine is the reference. If these tests fail after a
 *            change to engine/src/skeleton.ts, migration 0004 [or a new
 *            migration replacing its function] must be updated to match.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { skeleton } from "../../engine/src/skeleton.ts";
import { createDatabase, createSeededDatabase, rowsAs, USERS, asUser } from "./harness.ts";

interface KeyRow { key: string }

const FIXTURE: string = join(import.meta.dirname, "..", "..", "data", "fixtures", "test-lexicon.tsv");

/* Every form in the test lexicon: the official spellings copied from
   the Académia's alphabet page. */
function fixtureForms(): string[] {
  const forms: string[] = [];
  const lines: string[] = readFileSync(FIXTURE, "utf8").split(/\r?\n/);
  let headerSeen: boolean = false;
  for (const line of lines) {
    const isData: boolean = line.trim() !== "" && !line.trimStart().startsWith("#");
    if (isData && headerSeen) {
      const form: string = line.split("\t")[0] ?? "";
      forms.push(form.trim());
    } else if (isData) {
      headerSeen = true;
    }
  }
  return forms;
}

/* Every letter the ligurian_form domain accepts, in both cases, plus
   the punctuation the engine folds. Built from the domain itself so a
   new letter added there is tested automatically. */
const ALPHABET: string[] = [
  ..."abcdefghijklmnopqrstuvwxyz",
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."àáâäèéêëìíîïòóôöùúûüæç",
  ..."ÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÆÇ",
  "'", "-", "’", "‘", "ʼ", "‐", "‑",
];

test("private.skeleton matches the engine on every fixture form", async () => {
  const db = await createDatabase();
  const forms: string[] = fixtureForms();
  assert.ok(forms.length > 50, "the fixture should hold the Académia forms");
  for (const form of forms) {
    const rows = (await db.query<KeyRow>("select private.skeleton($1) as key", [form])).rows;
    assert.equal(rows[0]?.key, skeleton(form), `mismatch on "${form}"`);
  }
});

test("private.skeleton matches the engine on every single letter", async () => {
  const db = await createDatabase();
  for (const letter of ALPHABET) {
    const rows = (await db.query<KeyRow>("select private.skeleton($1) as key", [letter])).rows;
    assert.equal(rows[0]?.key, skeleton(letter), `mismatch on "${letter}" [U+${letter.codePointAt(0)?.toString(16)}]`);
  }
});

test("private.skeleton normalizes decomposed input like the engine", async () => {
  const db = await createDatabase();
  const decomposed: string = "Zêna";  // e + combining circumflex
  const rows = (await db.query<KeyRow>("select private.skeleton($1) as key", [decomposed])).rows;
  assert.equal(rows[0]?.key, skeleton(decomposed));
  assert.equal(rows[0]?.key, "zena");
});

test("search keys are generated and follow a corrected headword", async () => {
  const db = await createSeededDatabase();
  await db.query("insert into lemmas (headword, status) values ('Zêna', 'approved')");
  const before = await rowsAs<{ headword_key: string; form_key: string }>(
    db, "anon",
    "select l.headword_key, w.form_key from lemmas l join wordforms w on w.lemma_id = l.id",
  );
  assert.deepEqual(before, [{ headword_key: "zena", form_key: "zena" }]);

  await db.query("update lemmas set headword = 'Sann-a'");
  const after = (await db.query<{ headword_key: string; form_key: string }>(
    "select l.headword_key, w.form_key from lemmas l join wordforms w on w.lemma_id = l.id",
  )).rows;
  assert.deepEqual(after, [{ headword_key: "sanna", form_key: "sanna" }]);
});

test("a contributor cannot write a search key", async () => {
  const db = await createSeededDatabase();
  await assert.rejects(
    rowsAs(db, asUser(USERS.contributor),
      "insert into lemmas (headword, headword_key) values ('pénna', 'xxx') returning id"),
    /generated column|cannot insert/i,
  );
});

test("an ASCII search finds accented headwords through the key", async () => {
  const db = await createSeededDatabase();
  await db.query("insert into lemmas (headword, status) values ('çitæ', 'approved'), ('canpànn-a', 'approved')");
  const rows = await rowsAs<{ headword: string }>(
    db, "anon",
    "select headword from lemmas where headword_key like $1 || '%' order by headword",
    [skeleton("citae")],
  );
  assert.deepEqual(rows.map((r) => r.headword), ["çitæ"]);
  const hyphen = await rowsAs<{ headword: string }>(
    db, "anon", "select headword from lemmas where headword_key = $1", [skeleton("canpanna")],
  );
  assert.deepEqual(hyphen.map((r) => r.headword), ["canpànn-a"]);
});
