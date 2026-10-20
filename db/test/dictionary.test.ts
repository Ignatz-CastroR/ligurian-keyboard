/*
 * dictionary.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 17:45:20, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Prove migration 0009, the reading side of the dictionary:
 *           the initials of the index; the index in pages; the search by
 *           translation, folding accents and taking the query literally;
 *           one entry by its public code; and, above all, that every
 *           function shows published rows only, to a visitor and to a
 *           reviewer alike.
 * Contract: Every test builds its own database.
 * Decision: docs/decisions/0034-dictionary-for-readers.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { USERS, asUser, createSeededDatabase, migrationNames, rowsAs, type Identity } from "./harness.ts";

const admin = asUser(USERS.admin);
const reviewer = asUser(USERS.reviewer);
const contributor = asUser(USERS.contributor);

interface IndexRow { id: number; public_id: string; headword: string; headword_key: string; glosses: GlossJson[] }
interface GlossJson { sense_number: number; definition_it: string | null; language: string | null; gloss: string | null }
interface SearchRow { headword: string; language: string; gloss: string; rank: number; sense_number: number }
interface Entry { headword: string; public_id: string; forms: { form: string; is_base: boolean }[]; glosses: GlossJson[] }

async function one(db: PGlite, who: Identity, sql: string, params: unknown[] = []): Promise<number> {
  return (await rowsAs<{ id: number }>(db, who, sql, params))[0]?.id ?? -1;
}

/* A lemma with its senses and translations, all approved unless told. */
async function entry(db: PGlite, headword: string, senses: [string | null, [string, string][]][], status: string = "approved"): Promise<number> {
  const lemma: number = await one(db, admin, "insert into lemmas (headword, status) values ($1, $2) returning id", [headword, status]);
  for (const [definition, glosses] of senses) {
    const sense: number = await one(db, admin, "insert into senses (lemma_id, definition_it, status) values ($1, $2, 'approved') returning id",
      [lemma, definition]);
    for (const [language, gloss] of glosses) {
      await one(db, admin, "insert into glosses (sense_id, language, gloss, status) values ($1, $2, $3, 'approved') returning id",
        [sense, language, gloss]);
    }
  }
  return lemma;
}

async function sample(db: PGlite): Promise<Record<string, number>> {
  return {
    penna: await entry(db, "pénna", [["strumento per scrivere", [["it", "penna"], ["es", "pluma"], ["en", "pen"], ["en", "fountain pen"]]],
      [null, [["it", "piuma"], ["es", "pluma"]]]]),
    aegua: await entry(db, "ægua", [["acqua", [["it", "acqua"], ["es", "agua"], ["en", "water"]]]]),
    aegua2: await entry(db, "Ægoa", [[null, []]]),
    arbo: await entry(db, "àrbo", [["albero", [["es", "árbol"]]]]),
    abaco: await entry(db, "abaco", []),
    ce: await entry(db, "çê", [["cielo", [["es", "cielo"]]]]),
    zena: await entry(db, "Zêna", [["Genova", [["es", "Génova"], ["en", "Genoa"]]]]),
    canson: await entry(db, "cansón", [["canzone", [["es", "canción"], ["en", "song"]]]]),
    apos: await entry(db, "'na", [["una", [["it", "una"]]]]),
    pending: await entry(db, "zinzìn", [["zanzara", [["es", "mosquito"]]]], "pending"),
    deleted: await entry(db, "zuppa", [["zuppa", [["es", "sopa"]]]]),
  };
}

async function letters(db: PGlite, who: Identity): Promise<Record<string, number>> {
  const rows = await rowsAs<{ initial: string; entries: number }>(db, who, "select * from public.dictionary_letters()");
  return Object.fromEntries(rows.map((r) => [r.initial, Number(r.entries)]));
}

test("migration 0009 runs after 0008", () => {
  const names: string[] = migrationNames();
  assert.equal(names[names.indexOf("0008_backup_time_limit.sql") + 1], "0009_dictionary_for_readers.sql");
});

test("the index groups accented vowels under their base letter, æ and ç apart, ñ under n, the rest under #", async () => {
  const db = await createSeededDatabase();
  const cases: [string, string][] = [
    ["àrbo", "a"], ["Âse", "a"], ["abaco", "a"], ["ægua", "æ"], ["Ægoa", "æ"], ["çê", "ç"], ["Çitæ", "ç"],
    ["éuggio", "e"], ["ñato", "n"], ["Zêna", "z"], ["'na", "#"], ["-ezzo", "#"],
  ];
  for (const [word, expected] of cases) {
    const got = (await rowsAs<{ i: string }>(db, "anon", "select private.index_initial($1) as i", [word]))[0]?.i;
    assert.equal(got, expected, word);
  }
});

test("every function shows published rows only, to a visitor and to a reviewer alike", async () => {
  const db = await createSeededDatabase();
  const ids = await sample(db);
  await rowsAs(db, admin, "update lemmas set deleted_at = now() where id = $1", [ids["deleted"]]);
  // A pending translation on a published sense, and a contributor's
  // own pending lemma.
  const sense: number = await one(db, admin, "select id from senses where lemma_id = $1 order by sense_number limit 1", [ids["penna"]]);
  await one(db, admin, "insert into glosses (sense_id, language, gloss, status) values ($1, 'es', 'boli', 'pending') returning id", [sense]);
  await one(db, contributor, "insert into lemmas (headword) values ('zetta') returning id");

  const expected = { "#": 1, a: 2, "æ": 2, c: 1, "ç": 1, p: 1, z: 1 };
  for (const who of ["anon", reviewer, contributor] as Identity[]) {
    assert.deepEqual(await letters(db, who), expected);
    const z = await rowsAs<IndexRow>(db, who, "select * from public.dictionary_index('z')");
    assert.deepEqual(z.map((r) => r.headword), ["Zêna"]);
    assert.deepEqual(await rowsAs(db, who, "select headword from public.dictionary_search('boli')"), []);
    assert.deepEqual(await rowsAs(db, who, "select headword from public.dictionary_search('mosquito')"), []);
    assert.deepEqual(await rowsAs(db, who, "select headword from public.dictionary_search('sopa')"), []);
    const pending = await rowsAs<{ e: Entry | null }>(db, who,
      "select public.dictionary_entry(public_id) as e from lemmas where id = $1", [ids["pending"]]);
    assert.equal(pending[0]?.e ?? null, null);
  }
});

test("the index comes in pages ordered by search key, each entry with its translations by sense", async () => {
  const db = await createSeededDatabase();
  await sample(db);
  const first = await rowsAs<IndexRow>(db, "anon", "select * from public.dictionary_index('a', null, null, 1)");
  assert.deepEqual(first.map((r) => r.headword), ["abaco"]);
  const last: IndexRow | undefined = first.at(-1);
  const second = await rowsAs<IndexRow>(db, "anon", "select * from public.dictionary_index('a', $1, $2, 5)",
    [last?.headword_key, last?.id]);
  assert.deepEqual(second.map((r) => r.headword), ["àrbo"]);
  assert.deepEqual(first[0]?.glosses, []);

  const p = await rowsAs<IndexRow>(db, "anon", "select * from public.dictionary_index('p')");
  assert.deepEqual(p[0]?.glosses.map((g) => [g.sense_number, g.language, g.gloss]), [
    [1, "en", "fountain pen"], [1, "en", "pen"], [1, "es", "pluma"], [1, "it", "penna"],
    [2, "es", "pluma"], [2, "it", "piuma"],
  ]);
  // A sense without translations still appears, once.
  const ae = await rowsAs<IndexRow>(db, "anon", "select * from public.dictionary_index('æ')");
  assert.deepEqual(ae.map((r) => [r.headword, r.glosses.length]), [["Ægoa", 1], ["ægua", 3]]);
  assert.deepEqual(ae[0]?.glosses, [{ sense_number: 1, definition_it: null, language: null, gloss: null }]);
  // At most 200 per page, at least 1.
  assert.equal((await rowsAs(db, "anon", "select * from public.dictionary_index('a', null, null, 0)")).length, 1);
});

test("a translation is found with or without accents and capitals, exact matches first, word starts too", async () => {
  const db = await createSeededDatabase();
  await sample(db);
  const search = async (query: string, language: string | null = null): Promise<SearchRow[]> =>
    rowsAs<SearchRow>(db, "anon", "select * from public.dictionary_search($1, $2)", [query, language]);

  for (const query of ["canción", "cancion", "CANCIÓN", "  Cancion  "]) {
    assert.deepEqual((await search(query)).map((r) => [r.headword, r.gloss, r.rank]), [["cansón", "canción", 0]], query);
  }
  assert.deepEqual((await search("genov")).map((r) => [r.headword, r.gloss, r.rank]), [["Zêna", "Génova", 1]]);
  // "pen" is exact for one translation, the start of a word in another.
  assert.deepEqual((await search("pen")).map((r) => [r.gloss, r.rank]), [["pen", 0], ["penna", 1], ["fountain pen", 2]]);
  // The same word in two senses of one entry: two rows, one per sense.
  assert.deepEqual((await search("pluma")).map((r) => [r.headword, r.sense_number]), [["pénna", 1], ["pénna", 2]]);
  // One language only.
  assert.deepEqual((await search("pen", "it")).map((r) => r.gloss), ["penna"]);
  assert.deepEqual((await search("pen", "es")).map((r) => r.gloss), []);
  // The middle of a word is not a match.
  assert.deepEqual(await search("enna"), []);
});

test("a query is never a pattern: % and _ count as punctuation, not wildcards, and an empty query finds nothing", async () => {
  const db = await createSeededDatabase();
  await sample(db);
  const glossesOf = async (query: string): Promise<string[]> =>
    (await rowsAs<SearchRow>(db, "anon", "select * from public.dictionary_search($1)", [query])).map((r) => r.gloss);
  // As wildcards these would match pen and penna.
  for (const query of ["p_n", "pe%a", "%", "_", "", "   ", "\\", "%%%"]) {
    assert.deepEqual(await glossesOf(query), [], JSON.stringify(query));
  }
  // Punctuation in the query is ignored, as in the translations.
  assert.deepEqual(await glossesOf("pen!"), await glossesOf("pen"));
  assert.equal((await rowsAs(db, "anon", "select * from public.dictionary_search('a', null, 1)")).length, 1);
});

test("a word starts after punctuation too, and a short query looks only at the start of translations", async () => {
  const db = await createSeededDatabase();
  await entry(db, "ægua", [["acqua", [["it", "dell'acqua"], ["es", "agua [potable]"], ["en", "water-bottle"]]]]);
  const glossesOf = async (query: string): Promise<string[]> =>
    (await rowsAs<SearchRow>(db, "anon", "select * from public.dictionary_search($1)", [query])).map((r) => r.gloss);
  assert.deepEqual(await glossesOf("acqua"), ["dell'acqua"]);
  assert.deepEqual(await glossesOf("potable"), ["agua [potable]"]);
  assert.deepEqual(await glossesOf("bottle"), ["water-bottle"]);
  assert.deepEqual(await glossesOf("dell acqua"), ["dell'acqua"]);
  // Two characters: the start of a translation only, not of its words.
  assert.deepEqual(await glossesOf("ag"), ["agua [potable]"]);
  assert.deepEqual(await glossesOf("po"), []);
});

test("a very long query is cut, not refused, and answers at once", async () => {
  const db = await createSeededDatabase();
  await sample(db);
  const started: number = Date.now();
  const rows = await rowsAs(db, "anon", "select * from public.dictionary_search($1)", ["canción ".repeat(2500)]);
  assert.deepEqual(rows, []);
  assert.ok(Date.now() - started < 5000);
  const cut = await rowsAs<SearchRow>(db, "anon", "select * from public.dictionary_search($1)", ["canción" + " ".repeat(5000) + "x"]);
  assert.deepEqual(cut.map((r) => r.gloss), ["canción"]);
});

test("an entry is found by the code of its lemma or of any of its forms, with its forms and senses", async () => {
  const db = await createSeededDatabase();
  const ids = await sample(db);
  await one(db, admin, "insert into wordforms (lemma_id, form, grammatical_tag, status) values ($1, 'pénne', 'pl.', 'approved') returning id", [ids["penna"]]);
  await one(db, admin, "insert into wordforms (lemma_id, form, status) values ($1, 'pénnin', 'pending') returning id", [ids["penna"]]);
  const codes = await rowsAs<{ lemma: string; form: string }>(db, "trusted",
    `select l.public_id as lemma, w.public_id as form from lemmas l join wordforms w on w.lemma_id = l.id
      where l.id = $1 and w.form = 'pénne'`, [ids["penna"]]);
  const { lemma, form } = codes[0] ?? { lemma: "", form: "" };
  for (const code of [lemma, form]) {
    const e: Entry | undefined = (await rowsAs<{ e: Entry }>(db, "anon", "select public.dictionary_entry($1) as e", [code]))[0]?.e;
    assert.equal(e?.headword, "pénna");
    assert.equal(e?.public_id, lemma);
    assert.deepEqual(e?.forms.map((f) => [f.form, f.is_base]), [["pénna", true], ["pénne", false]]);
    assert.equal(e?.glosses.length, 6);
  }
  assert.equal((await rowsAs<{ e: Entry | null }>(db, "anon", "select public.dictionary_entry('LIJ-0000000A0') as e"))[0]?.e ?? null, null);
});

test("the public functions run as their owner, so their indexes can serve every caller, and are open to visitors", async () => {
  const db = await createSeededDatabase();
  await sample(db);
  const definers = await rowsAs<{ proname: string; prosecdef: boolean }>(db, "trusted",
    `select p.proname, p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'dictionary\\_%' order by 1`);
  assert.deepEqual(definers.map((r) => [r.proname, r.prosecdef]),
    [["dictionary_entry", true], ["dictionary_index", true], ["dictionary_letters", true], ["dictionary_search", true]]);
  for (const call of ["dictionary_letters()", "dictionary_index('a')", "dictionary_search('xyz')", "dictionary_entry('x')"]) {
    await rowsAs(db, "anon", `select * from public.${call}`);
  }

  // The queries the functions run, as their owner does, with sequential
  // scans discouraged so that the tiny test data does not hide a plan
  // that could not use an index.
  // A trigram index answers through a bitmap scan only, so for it plain
  // index scans are discouraged too: a btree cannot be scanned for a
  // pattern that starts with a wildcard except as a whole.
  const plan = async (sql: string, bitmapOnly: boolean = false): Promise<string> => {
    await db.exec(`set enable_seqscan = off; set enable_indexscan = ${bitmapOnly ? "off" : "on"}`);
    try {
      return (await rowsAs<{ "QUERY PLAN": string }>(db, "trusted", `explain ${sql}`)).map((r) => r["QUERY PLAN"]).join("\n");
    } finally {
      await db.exec("reset enable_seqscan; reset enable_indexscan");
    }
  };
  assert.match(await plan(`select id from public.lemmas where private.index_initial(headword) = 'p'
    and status = 'approved' and deleted_at is null order by headword_key, id limit 100`), /lemmas_index_initial/u);
  assert.match(await plan(`select id from public.glosses where status = 'approved' and deleted_at is null
    and (private.search_key(gloss) collate "C") like 'can%'
    order by (private.search_key(gloss) collate "C"), id limit 200`), /Index Scan using glosses_search_key[\s\S]*Index Cond/u);
  // With enough rows for selectivity to matter, and the btree out of
  // the way, a pattern that starts with a wildcard must be served by
  // the trigram index.
  const sense: number = (await rowsAs<{ id: number }>(db, "trusted", "select min(id) as id from public.senses"))[0]?.id ?? -1;
  await rowsAs(db, "trusted", `insert into public.glosses (sense_id, language, gloss, status)
    select $1, 'en', 'word ' || i, 'approved' from generate_series(1, 3000) as i`, [sense]);
  await db.exec("analyze public.glosses; drop index public.glosses_search_key");
  assert.match(await plan(`select id from public.glosses where status = 'approved' and deleted_at is null
    and private.search_key(gloss) like '%pen%'`, true), /Bitmap Index Scan on glosses_search_trigrams[\s\S]*Index Cond: \(private\.search_key\(gloss\) ~~ '%pen%'/u);
});
