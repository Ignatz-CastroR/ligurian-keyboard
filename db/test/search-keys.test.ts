/*
 * search-keys.test.ts
 * Author:    Ignatz-CastroR and contributors
 * Date:      2026/10/11, 20:11:58, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:   2026/10/17, 07:50:33: the alphabet is read from the
 *            database itself; the letter ñ [decision 0024].
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
import { Lexicon } from "../../engine/src/lexicon.ts";
import { createDatabase, createSeededDatabase, domainLetters, rowsAs, USERS, asUser } from "./harness.ts";

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

/* Every character the ligurian_form domain accepts, read from the
   database itself after every migration, so a letter added by a new
   migration is tested automatically. The class is "a-zA-Z" followed by
   single characters. */
async function domainAlphabet(): Promise<string[]> {
  const letterClass: string = await domainLetters(await createDatabase());
  assert.ok(letterClass.startsWith("a-zA-Z"), letterClass);
  return [
    ..."abcdefghijklmnopqrstuvwxyz",
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    ...letterClass.slice("a-zA-Z".length),
  ];
}

/* The domain's characters plus the punctuation the engine folds but
   the domain refuses: typographic apostrophes and hyphens. */
async function foldAlphabet(): Promise<string[]> {
  return [...await domainAlphabet(), "’", "‘", "ʼ", "‐", "‑"];
}

test("the alphabet read from the database is the expected one", async () => {
  assert.deepEqual((await domainAlphabet()).join(""),
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    + "àáâäèéêëìíîïòóôöùúûüæçñÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÆÇÑ'-");
});

test("the engine loads a word holding any character the database accepts", async () => {
  const rejected: string[] = [];
  for (const ch of await domainAlphabet()) {
    const lexicon: Lexicon = Lexicon.fromTsv(`form\tfreq\tvariety\torthography\tstatus\na${ch}a\t1\tzeneize\tofiçiâ\tapproved\n`);
    if (lexicon.errors.length > 0 || lexicon.size !== 1) {
      rejected.push(ch);
    }
  }
  assert.deepEqual(rejected, [], "the published dictionary would lose these words");
});

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
  for (const letter of await foldAlphabet()) {
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

test("a spelling with ñ is accepted, in both cases, and found by typing n", async () => {
  const db = await createSeededDatabase();
  // Test strings, not Ligurian words.
  await db.query(`insert into lemmas (headword, orthography, status)
                  values ('tañu', 'unitäia', 'approved'), ('Ñaro', 'unitäia', 'approved')`);
  const rows = await rowsAs<{ headword: string; headword_key: string }>(
    db, "anon", "select headword, headword_key from lemmas order by headword_key",
  );
  assert.deepEqual(rows, [
    { headword: "Ñaro", headword_key: "naro" },
    { headword: "tañu", headword_key: "tanu" },
  ]);
  const forms = await rowsAs<{ form: string }>(
    db, "anon", "select form from wordforms where form_key = $1", [skeleton("tanu")],
  );
  assert.deepEqual(forms.map((r) => r.form), ["tañu"]);
});

test("the domain still refuses what it refused before ñ", async () => {
  const db = await createDatabase();
  for (const bad of ["ã", "õ", "ñ", "ß", "a b", "x".repeat(65)]) {
    await assert.rejects(db.query("select $1::public.ligurian_form", [bad]), /ligurian_form/, JSON.stringify(bad));
  }
});
