/*
 * grammar.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/21, 12:40:15, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Prove migration 0013: the six lists hold exactly the values
 *           decided, readable by everyone and changed by nobody through
 *           the API, and a value in use never leaves its list; a lemma
 *           takes only listed values, and a verb's own properties only on
 *           a verb; a form holds a list of readings, each checked, as
 *           many as its spelling stands for; the base form's first
 *           reading is its lemma's, kept in step and never changed alone,
 *           while more may follow; contributors write grammar on their
 *           own entries only; the review queue shows it; a backup keeps
 *           it, with its lists, and one made before 0.16.0 restores with
 *           none. And the two limits of
 *           0.15.0 it repairs: a renumbered sense writes one line of
 *           history, while two live senses still never share a number;
 *           user_history[] names the fields an update set to null.
 * Contract: Every test builds its own database. A rule is tested from
 *           the side of the person who must NOT be able to break it.
 * Decision: docs/decisions/0039-grammar-in-structured-fields.md and
 *           docs/decisions/0040-two-limits-of-the-sense-review-lifted.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import {
  USERS, actAs, affectedAs, asUser, createSeededDatabase, migrationNames, rowsAs, type Identity,
} from "./harness.ts";

const admin = asUser(USERS.admin);
const reviewer = asUser(USERS.reviewer);
const contributor = asUser(USERS.contributor);
const contributor2 = asUser(USERS.contributor2);
const member = asUser(USERS.member);

const LISTS: Record<string, string[]> = {
  grammar_genders: ["m", "f", "mf"],
  grammar_numbers: ["sg", "pl"],
  grammar_persons: ["1", "2", "3"],
  verb_forms: [
    "inf", "ptcp_pres", "ptcp_past", "ger", "ind_pres", "ind_impf", "ind_past", "ind_fut", "cond",
    "subj_pres", "subj_impf", "imp",
  ],
  conjugation_classes: ["-â", "-ê", "-î", "-éi"],
  auxiliaries: ["avéi", "êse"],
};

const GRAMMAR_COLUMNS: string =
  "gender, number, person, verb_form, invariable, conjugation, auxiliary, pronominal";

// A reading as the database stores it: the four keys, null where none.
function reading(values: Partial<Record<"gender" | "number" | "person" | "verb_form", string>>): Record<string, string | null> {
  return { gender: values.gender ?? null, number: values.number ?? null, person: values.person ?? null, verb_form: values.verb_form ?? null };
}

interface Grammar {
  gender: string | null;
  number: string | null;
  person: string | null;
  verb_form: string | null;
  invariable?: boolean;
  conjugation?: string | null;
  auxiliary?: string | null;
  pronominal?: boolean;
}

// A database error with this SQLSTATE.
const hasCode = (code: string) => (thrown: unknown): boolean => (thrown as { code?: string }).code === code;

async function lemmaOf(db: PGlite, id: number): Promise<Grammar & { version: number }> {
  const row = (await rowsAs<Grammar & { version: number }>(db, "trusted",
    `select ${GRAMMAR_COLUMNS}, version from lemmas where id = $1`, [id]))[0];
  assert.ok(row !== undefined);
  return row;
}

interface FormRow { readings: Record<string, string | null>[]; version: number }

async function baseOf(db: PGlite, lemma: number): Promise<FormRow> {
  const row = (await rowsAs<FormRow>(db, "trusted",
    "select readings, version from wordforms where lemma_id = $1 and is_base", [lemma]))[0];
  assert.ok(row !== undefined);
  return row;
}

async function insertForm(db: PGlite, who: Identity, lemma: number, form: string, readings: unknown): Promise<FormRow & { id: number }> {
  const row = (await rowsAs<FormRow & { id: number }>(db, who,
    "insert into wordforms (lemma_id, form, readings) values ($1, $2, $3::jsonb) returning id, readings, version",
    [lemma, form, JSON.stringify(readings)]))[0];
  assert.ok(row !== undefined);
  return row;
}

async function insertLemma(db: PGlite, who: Identity, columns: string, values: unknown[]): Promise<number> {
  const marks: string = values.map((_, i) => `$${i + 1}`).join(", ");
  const row = (await rowsAs<{ id: number }>(db, who, `insert into lemmas (${columns}) values (${marks}) returning id`, values))[0];
  assert.ok(row !== undefined);
  return row.id;
}

/* ====================================================================
   The lists
   ==================================================================== */

test("migration 0013 runs after 0012", () => {
  const names: string[] = migrationNames();
  assert.equal(names[names.indexOf("0012_sense_repairs.sql") + 1], "0013_grammar.sql");
});

test("the six lists hold exactly the values decided, in their order, their codes in NFC", async () => {
  const db = await createSeededDatabase();
  for (const [table, codes] of Object.entries(LISTS)) {
    const rows = await rowsAs<{ code: string; position: number }>(db, "anon", `select code, position from ${table} order by position`);
    assert.deepEqual(rows.map((r) => r.code), codes, table);
    assert.deepEqual(rows.map((r) => r.position), codes.map((_, i) => i + 1), table);
    assert.ok(codes.every((c) => c === c.normalize("NFC")), table);
  }
  const named = await rowsAs<{ name: string }>(db, "anon", "select name from verb_forms where code = 'ind_past'");
  assert.deepEqual(named, [{ name: "passato remoto" }], "the past historic, not a compound tense");
});

test("everyone may read the lists; nobody may change them through the API, an admin included", async () => {
  const db = await createSeededDatabase();
  for (const table of Object.keys(LISTS)) {
    for (const who of ["anon", member, admin] as Identity[]) {
      assert.ok((await rowsAs(db, who, `select code from ${table}`)).length > 0, `${table} read`);
      await assert.rejects(affectedAs(db, who, `insert into ${table} (code, name, position) values ('zz', 'zz', 99)`),
        /permission denied/u, `${table} insert`);
      await assert.rejects(affectedAs(db, who, `update ${table} set name = 'zz'`), /permission denied/u, `${table} update`);
      await assert.rejects(affectedAs(db, who, `delete from ${table}`), /permission denied/u, `${table} delete`);
    }
  }
  // A new value is one insert from the SQL Editor.
  await affectedAs(db, "trusted", "insert into grammar_genders (code, name, position) values ('n', 'neutro', 4)");
  await insertLemma(db, "trusted", "headword, gender", ["nêutro", "n"]);
  // Not two values at one place in the menus, not an empty or decomposed code.
  await assert.rejects(affectedAs(db, "trusted", "insert into grammar_genders (code, name, position) values ('x', 'x', 4)"),
    hasCode("23505"));
  await assert.rejects(affectedAs(db, "trusted", "insert into grammar_genders (code, name, position) values ('', 'x', 9)"),
    hasCode("23514"));
  await assert.rejects(affectedAs(db, "trusted", "insert into conjugation_classes (code, name, position) values ($1, 'x', 9)",
    ["-â"]), hasCode("23514"));
});

/* ====================================================================
   Lemmas and forms
   ==================================================================== */

test("a lemma takes only listed values; a verb's own properties only on a verb", async () => {
  const db = await createSeededDatabase();
  for (const [column, value] of [["gender", "x"], ["number", "du"], ["person", "4"], ["verb_form", "ind_perf"],
    ["conjugation", "-ô"], ["auxiliary", "stâ"]] as const) {
    await assert.rejects(insertLemma(db, contributor, `headword, part_of_speech, ${column}`, ["vànni", "verb", value]),
      hasCode("23503"), column);
  }
  for (const pos of [null, "noun", "adjective", "other"]) {
    for (const [column, value] of [["conjugation", "-â"], ["auxiliary", "avéi"], ["pronominal", true]] as const) {
      await assert.rejects(insertLemma(db, contributor, `headword, part_of_speech, ${column}`, ["vànni", pos, value]),
        hasCode("23514"), `${column} on ${String(pos)}`);
    }
  }
  const verb: number = await insertLemma(db, contributor, `headword, part_of_speech, ${GRAMMAR_COLUMNS}`,
    ["lavâse", "verb", null, null, null, "inf", false, "-â", "êse", true]);
  assert.deepEqual(await lemmaOf(db, verb), {
    gender: null, number: null, person: null, verb_form: "inf", invariable: false,
    conjugation: "-â", auxiliary: "êse", pronominal: true, version: 1,
  });
  // A verb that stops being one must shed its verb's properties first.
  await assert.rejects(affectedAs(db, contributor, "update lemmas set part_of_speech = 'noun' where id = $1", [verb]),
    hasCode("23514"));
  assert.equal(await affectedAs(db, contributor,
    "update lemmas set part_of_speech = 'noun', conjugation = null, auxiliary = null, pronominal = false, verb_form = null where id = $1",
    [verb]), 1);

  // Any value on any row otherwise: a feminine adjective lemma, a noun
  // only plural, an invariable one, a determiner with its person.
  await insertLemma(db, contributor, "headword, part_of_speech, gender, number", ["bèlla", "adjective", "f", "sg"]);
  await insertLemma(db, contributor, "headword, part_of_speech, gender, number", ["fòrbxi", "noun", "f", "pl"]);
  await insertLemma(db, contributor, "headword, part_of_speech, gender, invariable", ["çittæ", "noun", "f", true]);
  await insertLemma(db, contributor, "headword, part_of_speech, person, gender, number", ["mæ", "determiner", "1", "m", "sg"]);
  await assert.rejects(insertLemma(db, contributor, "headword, part_of_speech", ["mæ", "determinative"]), hasCode("23514"));

});

test("a form holds as many readings as its spelling stands for, each checked and stored in one shape", async () => {
  const db = await createSeededDatabase();
  const verb: number = await insertLemma(db, contributor, "headword, part_of_speech, verb_form", ["parlâ", "verb", "inf"]);
  // "parla": present indicative, third person singular, and imperative,
  // second person singular; one row, one public code.
  const parla = await insertForm(db, contributor, verb, "parla", [
    { verb_form: "ind_pres", person: "3", number: "sg" }, { verb_form: "imp", person: "2", number: "sg", gender: null }]);
  assert.deepEqual(parla.readings, [
    reading({ verb_form: "ind_pres", person: "3", number: "sg" }), reading({ verb_form: "imp", person: "2", number: "sg" })]);
  assert.equal((await insertForm(db, contributor, verb, "parlo", null)).readings.length, 0, "null is no reading");

  const refused: [unknown, RegExp][] = [
    [{ gender: "f" }, /must be a JSON list/u],
    [["f"], /reading 1: it must be an object/u],
    [[{ genre: "f" }], /reading 1: unknown key: genre/u],
    [[{ number: "sg" }, { person: 3 }], /reading 2: "person" must be a code, written in quotes/u],
    [[{ verb_form: "ind_perf" }], /reading 1: "ind_perf" is not a value of verb_forms/u],
    [[{ gender: null }], /reading 1: it gives no value/u],
    [[{}], /reading 1: it gives no value/u],
    [[{ number: "pl" }, { number: "pl", gender: null }], /reading 2: the same reading is given twice/u],
    [Array.from({ length: 33 }, (_, i) => ({ number: i % 2 === 0 ? "sg" : "pl", person: String(i) })), /at most 32 readings/u],
  ];
  for (const [readings, message] of refused) {
    await assert.rejects(insertForm(db, contributor, verb, "parlava", readings),
      (e: unknown) => hasCode("22023")(e) && message.test(String((e as Error).message)), JSON.stringify(readings));
  }
  // An update is checked the same way.
  await assert.rejects(affectedAs(db, contributor, "update wordforms set readings = $2::jsonb where id = $1",
    [parla.id, JSON.stringify([{ person: "4" }])]), /reading 1: "4" is not a value of grammar_persons/u);
});

test("the base form's first reading is its lemma's, when it has one, kept in step and never changed alone; more may follow and stay", async () => {
  const db = await createSeededDatabase();
  const lemma: number = await insertLemma(db, contributor, "headword, part_of_speech, gender, number", ["càn", "noun", "m", "sg"]);
  const sg = reading({ gender: "m", number: "sg" });
  const pl = reading({ gender: "m", number: "pl" });
  assert.deepEqual(await baseOf(db, lemma), { readings: [sg], version: 1 });
  const setBase = (who: Identity, readings: unknown): Promise<number> =>
    affectedAs(db, who, "update wordforms set readings = $2::jsonb where lemma_id = $1 and is_base", [lemma, JSON.stringify(readings)]);

  // An invariable noun: its spelling is the plural too, a second reading
  // of the base form, added by hand.
  assert.equal(await setBase(contributor, [sg, pl]), 1);
  assert.deepEqual(await baseOf(db, lemma), { readings: [sg, pl], version: 2 });

  // The first reading changes only with the lemma, whoever tries; a
  // conflict, since a page read before the lemma changed sends the old.
  await assert.rejects(setBase(contributor, [pl]), hasCode("40001"));
  for (const who of [contributor, admin, "trusted"] as Identity[]) {
    for (const readings of [[pl, sg], [pl], [], [reading({ gender: "f", number: "sg" }), pl]]) {
      await assert.rejects(setBase(who, readings), /the first reading of a base form is its lemma's/u, JSON.stringify([who, readings]));
    }
    await assert.rejects(affectedAs(db, who, "update wordforms set form = 'càin' where lemma_id = $1 and is_base", [lemma]),
      /the base form follows its lemma/u);
  }

  // The lemma's reading changes to one the base form lacks: the first
  // is replaced, as a correction; the others stay.
  await affectedAs(db, contributor, "update lemmas set gender = 'mf' where id = $1", [lemma]);
  const both = reading({ gender: "mf", number: "sg" });
  assert.deepEqual(await baseOf(db, lemma), { readings: [both, pl], version: 3 });
  // To one the base form has: the two change places, so that a change
  // and its undo lose nothing.
  await affectedAs(db, contributor, "update lemmas set gender = 'm', number = 'pl' where id = $1", [lemma]);
  assert.deepEqual((await baseOf(db, lemma)).readings, [pl, both]);
  await affectedAs(db, contributor, "update lemmas set gender = 'mf', number = 'sg' where id = $1", [lemma]);
  assert.deepEqual((await baseOf(db, lemma)).readings, [both, pl], "undone, nothing lost");
  await affectedAs(db, contributor, "update lemmas set gender = 'm', number = 'pl' where id = $1", [lemma]);
  assert.deepEqual((await baseOf(db, lemma)).readings, [pl, both]);
  // No reading on the lemma: none first, the others stay.
  await setBase(contributor, [pl, sg]);
  await affectedAs(db, contributor, "update lemmas set gender = null, number = null where id = $1", [lemma]);
  assert.deepEqual((await baseOf(db, lemma)).readings, [sg]);
  // Without a reading of its own, the lemma leaves its base form's free,
  // the first included; given one again, it takes the first place.
  assert.equal(await setBase(contributor, [pl, sg]), 1);
  await affectedAs(db, contributor, "update lemmas set gender = 'm', number = 'sg' where id = $1", [lemma]);
  assert.deepEqual((await baseOf(db, lemma)).readings, [sg, pl], "already there: moved first, not kept twice");
  await affectedAs(db, contributor, "update lemmas set gender = null, number = null where id = $1", [lemma]);
  await setBase(contributor, []);
  assert.deepEqual((await baseOf(db, lemma)).readings, []);

  // A change of something else leaves the base form alone; so do
  // invariable and the verb's properties, which are the lemma's only.
  const version: number = (await baseOf(db, lemma)).version;
  await affectedAs(db, contributor, "update lemmas set note = 'una nota', invariable = true where id = $1", [lemma]);
  assert.equal((await baseOf(db, lemma)).version, version);

  // Every change is in the history, the base form's readings included.
  const lines = await rowsAs<{ table_name: string; changed: string[] }>(db, "trusted",
    `select table_name, array(select k from jsonb_object_keys(new_row) as k
                              where new_row -> k is distinct from old_row -> k
                                and k not in ('version', 'updated_at') order by k) as changed
       from audit_log where action = 'update' order by id`);
  assert.deepEqual(lines.slice(0, 3).map((l) => `${l.table_name}: ${l.changed.join(", ")}`).sort(),
    ["lemmas: gender", "wordforms: readings", "wordforms: readings"]);
  assert.ok(lines.length > 10);
});

test("a value a reading uses never leaves its list, nor changes; an unused one may", async () => {
  const db = await createSeededDatabase();
  await affectedAs(db, "trusted", "insert into grammar_persons (code, name, position) values ('4', 'quarta', 4)");
  const lemma: number = await insertLemma(db, contributor, "headword, part_of_speech", ["parlâ", "verb"]);
  await insertForm(db, contributor, lemma, "parlemmo", [{ verb_form: "ind_pres", person: "1", number: "pl" }]);
  for (const sql of ["delete from grammar_persons where code = '1'", "update grammar_persons set code = 'uno' where code = '1'",
    "delete from verb_forms where code = 'ind_pres'", "delete from grammar_numbers where code = 'pl'"]) {
    await assert.rejects(affectedAs(db, "trusted", sql), (e: unknown) => hasCode("23503")(e)
      && /used by the readings of forms/u.test(String((e as Error).message)), sql);
  }
  assert.equal(await affectedAs(db, "trusted", "update grammar_persons set name = 'prima persona' where code = '1'"), 1,
    "a name may change");
  assert.equal(await affectedAs(db, "trusted", "delete from grammar_persons where code = '4'"), 1, "unused");
});

test("contributors write grammar on their own pending entries only; members on none", async () => {
  const db = await createSeededDatabase();
  const own: number = await insertLemma(db, contributor, "headword, part_of_speech", ["bèllo", "adjective"]);
  assert.equal(await affectedAs(db, contributor, "update lemmas set gender = 'm', number = 'sg' where id = $1", [own]), 1);
  assert.equal(await affectedAs(db, contributor2, "update lemmas set gender = 'f' where id = $1", [own]), 0);
  assert.equal(await affectedAs(db, member, "update lemmas set gender = 'f' where id = $1", [own]), 0);
  await assert.rejects(insertLemma(db, member, "headword, gender", ["bèlla", "f"]), /role member may not propose entries/u);
  await affectedAs(db, reviewer, "update lemmas set status = 'approved' where id = $1", [own]);
  assert.equal(await affectedAs(db, contributor, "update lemmas set gender = 'f' where id = $1", [own]), 0,
    "approved: no longer the contributor's to change");
  assert.equal((await lemmaOf(db, own)).gender, "m");
  assert.equal(await affectedAs(db, reviewer, "update lemmas set gender = 'mf' where id = $1", [own]), 1);
});

test("the review queue shows a lemma's grammar with its base form's readings, a form's readings, and none on senses and translations", async () => {
  const db = await createSeededDatabase();
  const verb: number = await insertLemma(db, contributor, `headword, part_of_speech, ${GRAMMAR_COLUMNS}`,
    ["lavâse", "verb", null, null, null, "inf", false, "-â", "êse", true]);
  await insertForm(db, contributor, verb, "lava", [{ verb_form: "ind_pres", person: "3", number: "sg" }, { verb_form: "imp", person: "2", number: "sg" }]);
  const sense = (await rowsAs<{ id: number }>(db, contributor, "insert into senses (lemma_id) values ($1) returning id", [verb]))[0];
  // An invariable noun whose base form holds its plural too: approved
  // with the lemma, so shown on the lemma's row.
  const city: number = await insertLemma(db, contributor, "headword, part_of_speech, gender, number, invariable", ["çittæ", "noun", "f", "sg", true]);
  await affectedAs(db, contributor, "update wordforms set readings = $2::jsonb where lemma_id = $1 and is_base",
    [city, JSON.stringify([reading({ gender: "f", number: "sg" }), reading({ gender: "f", number: "pl" })])]);
  await rowsAs(db, contributor, "insert into glosses (sense_id, language, gloss) values ($1, 'it', 'lavarsi')", [sense?.id]);

  for (const who of [reviewer, contributor]) {
    const pages = await rowsAs<{ items: Record<string, unknown>[] }>(db, who, "select items from public.review_queue_page()");
    const all: Record<string, unknown>[] = pages.flatMap((p) => p.items);
    const byKind = new Map(all.filter((i) => i["lemma_id"] === verb).map((i) => [i["kind"], i]));
    const cityRow = all.find((i) => i["lemma_id"] === city && i["kind"] === "lemma");
    assert.deepEqual(cityRow?.["readings"], [reading({ gender: "f", number: "sg" }), reading({ gender: "f", number: "pl" })]);
    const pick = (kind: string): Record<string, unknown> => {
      const item: Record<string, unknown> = byKind.get(kind) ?? {};
      return Object.fromEntries([...GRAMMAR_COLUMNS.split(", "), "readings"].map((c) => [c, item[c]]));
    };
    assert.deepEqual(pick("lemma"), {
      gender: null, number: null, person: null, verb_form: "inf", invariable: false,
      conjugation: "-â", auxiliary: "êse", pronominal: true, readings: [reading({ verb_form: "inf" })],
    });
    assert.deepEqual(pick("wordform"), {
      gender: null, number: null, person: null, verb_form: null, invariable: null,
      conjugation: null, auxiliary: null, pronominal: null,
      readings: [reading({ verb_form: "ind_pres", person: "3", number: "sg" }), reading({ verb_form: "imp", person: "2", number: "sg" })],
    });
    for (const kind of ["sense", "gloss"]) {
      assert.ok(Object.values(pick(kind)).every((v) => v === null), kind);
    }
  }
});

/* ====================================================================
   Backups
   ==================================================================== */

interface Backup { tables: Record<string, Record<string, unknown>[]>; counts: Record<string, number> }

async function exportBackup(db: PGlite): Promise<Backup> {
  const backup = (await rowsAs<{ backup: Backup }>(db, admin, "select public.export_backup() as backup"))[0]?.backup;
  assert.ok(backup !== undefined);
  return backup;
}

async function restore(db: PGlite, backup: unknown): Promise<void> {
  await rowsAs(db, admin, "select public.restore_backup($1::jsonb)", [JSON.stringify(backup)]);
}

test("a backup keeps the grammar and its lists, a value added to a list included", async () => {
  const db = await createSeededDatabase();
  await affectedAs(db, "trusted", "insert into grammar_genders (code, name, position) values ('n', 'neutro', 4)");
  const verb: number = await insertLemma(db, contributor, `headword, part_of_speech, ${GRAMMAR_COLUMNS}`,
    ["lavâse", "verb", null, null, null, "inf", false, "-â", "êse", true]);
  await insertForm(db, contributor, verb, "lava", [{ verb_form: "ind_pres", person: "3", number: "sg" }, { verb_form: "imp", person: "2", number: "sg" }]);
  const neuter: number = await insertLemma(db, contributor, "headword, part_of_speech, gender, invariable", ["nêutro", "noun", "n", true]);
  await affectedAs(db, contributor, "update wordforms set readings = $2::jsonb where lemma_id = $1 and is_base",
    [neuter, JSON.stringify([reading({ gender: "n" }), reading({ gender: "n", number: "pl" })])]);
  const backup: Backup = await exportBackup(db);
  for (const table of Object.keys(LISTS)) {
    assert.equal(backup.counts[table], (backup.tables[table] ?? []).length, table);
  }
  assert.deepEqual(backup.tables["grammar_genders"]?.map((g) => g["code"]), ["f", "m", "mf", "n"]);

  // Restored into a fresh database whose fourth gender is another: the
  // backup's own comes after it, and nothing is lost.
  const target = await createSeededDatabase();
  await affectedAs(target, "trusted", "insert into grammar_genders (code, name, position) values ('c', 'comune', 4)");
  await restore(target, backup);
  assert.deepEqual(await rowsAs(target, "anon", "select code, name, position from grammar_genders order by position"), [
    { code: "m", name: "maschile", position: 1 }, { code: "f", name: "femminile", position: 2 },
    { code: "mf", name: "maschile e femminile", position: 3 }, { code: "c", name: "comune", position: 4 },
    { code: "n", name: "neutro", position: 5 },
  ]);
  const again: Backup = await exportBackup(target);
  for (const table of ["lemmas", "wordforms", "senses", "glosses", "audit_log", ...Object.keys(LISTS).filter((t) => t !== "grammar_genders")]) {
    assert.deepEqual(again.tables[table], backup.tables[table], table);
  }

  // The same backup into a database like the first: identical lists.
  const twin = await createSeededDatabase();
  await restore(twin, backup);
  assert.deepEqual((await exportBackup(twin)).tables["grammar_genders"], backup.tables["grammar_genders"]);
});

test("a backup made before 0.16.0 restores with no grammar; a list that is not a list is refused", async () => {
  const db = await createSeededDatabase();
  const lemma: number = await insertLemma(db, contributor, "headword, part_of_speech", ["pénna", "noun"]);
  await rowsAs(db, contributor, "insert into wordforms (lemma_id, form) values ($1, 'pénne')", [lemma]);
  const backup: Backup = await exportBackup(db);
  assert.ok((backup.tables["wordforms"] ?? []).every((w) => JSON.stringify(w["readings"]) === "[]"));
  const strip = (rows: Record<string, unknown>[] | undefined, columns: string): Record<string, unknown>[] =>
    (rows ?? []).map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => !columns.split(", ").includes(k))));
  const tables: Record<string, unknown> = Object.fromEntries(Object.entries(backup.tables).filter(([k]) => !(k in LISTS)));
  tables["lemmas"] = strip(backup.tables["lemmas"], GRAMMAR_COLUMNS);
  tables["wordforms"] = strip(backup.tables["wordforms"], "readings");
  const old = { ...backup, tables };

  const target = await createSeededDatabase();
  await restore(target, old);
  assert.deepEqual(await lemmaOf(target, lemma), {
    gender: null, number: null, person: null, verb_form: null, invariable: false,
    conjugation: null, auxiliary: null, pronominal: false, version: 1,
  });
  const restored = await rowsAs<{ readings: unknown }>(target, "trusted", "select readings from wordforms");
  assert.ok(restored.length === 2 && restored.every((w) => JSON.stringify(w.readings) === "[]"), "no readings");
  assert.deepEqual((await exportBackup(target)).tables["grammar_genders"], backup.tables["grammar_genders"],
    "the lists the migration wrote");

  for (const bad of [{}, "m", null]) {
    const broken = { ...backup, tables: { ...backup.tables, grammar_genders: bad } };
    const empty = await createSeededDatabase();
    await assert.rejects(restore(empty, broken), hasCode("22023"), JSON.stringify(bad));
  }
});

test("a backup whose base form does not begin with its lemma's reading is refused, and leaves nothing behind", async () => {
  const db = await createSeededDatabase();
  await insertLemma(db, contributor, "headword, part_of_speech, gender, number", ["pénna", "noun", "f", "sg"]);
  const backup: Backup = await exportBackup(db);
  const wordforms = (backup.tables["wordforms"] ?? []).map((w) =>
    (w["is_base"] === true ? { ...w, readings: [reading({ gender: "m", number: "pl" })] } : w));
  const target = await createSeededDatabase();
  await assert.rejects(restore(target, { ...backup, tables: { ...backup.tables, wordforms } }),
    (e: unknown) => hasCode("22023")(e) && /does not begin with its lemma's reading/u.test(String((e as Error).message)));
  assert.deepEqual(await rowsAs(target, "trusted", "select id from lemmas"), []);
  await restore(target, backup);
  assert.equal((await rowsAs(target, "trusted", "select id from lemmas")).length, 1, "the true backup restores");
});

/* ====================================================================
   The two limits of 0.15.0
   ==================================================================== */

// An entry as the SQL loads left it: one sense per translation.
async function splitEntry(db: PGlite, headword: string, translations: string[]): Promise<{ lemma: number; senses: number[]; glosses: number[] }> {
  await actAs(db, "trusted");
  const lemma: number = (await db.query<{ id: number }>(
    "insert into lemmas (headword, status) values ($1, 'approved') returning id", [headword])).rows[0]?.id ?? -1;
  const senses: number[] = [];
  const glosses: number[] = [];
  for (const translation of translations) {
    const sense: number = (await db.query<{ id: number }>(
      "insert into senses (lemma_id, status) values ($1, 'approved') returning id", [lemma])).rows[0]?.id ?? -1;
    glosses.push((await db.query<{ id: number }>(
      "insert into glosses (sense_id, language, gloss, status) values ($1, 'it', $2, 'approved') returning id",
      [sense, translation])).rows[0]?.id ?? -1);
    senses.push(sense);
  }
  await db.query("select private.mark_split_lemmas()");
  return { lemma, senses, glosses };
}

async function seenOf(db: PGlite, lemma: number): Promise<unknown> {
  await actAs(db, "trusted");
  return {
    lemma: (await db.query("select id, version from lemmas where id = $1", [lemma])).rows[0],
    senses: (await db.query("select id, version from senses where lemma_id = $1 and deleted_at is null", [lemma])).rows,
    glosses: (await db.query(`select g.id, g.version from glosses g join senses s on s.id = g.sense_id
                              where s.lemma_id = $1 and s.deleted_at is null and g.deleted_at is null`, [lemma])).rows,
  };
}

const REGROUP: string = "select public.regroup_senses($1, $2::jsonb, $3::jsonb) as report";

test("a sense a regrouping renumbers writes one line of history, from its old number to its new", async () => {
  const db = await createSeededDatabase();
  const entry = await splitEntry(db, "béllo", ["bello", "carino", "grazioso"]);
  const start: number = Number((await rowsAs<{ n: string }>(db, "trusted", "select coalesce(max(id), 0) as n from audit_log"))[0]?.n);
  // Reversed: the first and the third change places, the second stays.
  await rowsAs(db, reviewer, REGROUP, [entry.lemma, JSON.stringify(await seenOf(db, entry.lemma)),
    JSON.stringify([{ glosses: [entry.glosses[2]] }, { glosses: [entry.glosses[1]] }, { glosses: [entry.glosses[0]] }])]);
  const lines = await rowsAs<{ row_id: number; before: number; after: number }>(db, "trusted",
    `select row_id, (old_row ->> 'sense_number')::int as before, (new_row ->> 'sense_number')::int as after
       from audit_log where id > $1 and table_name = 'senses' order by id`, [start]);
  assert.deepEqual(lines.sort((a, b) => a.row_id - b.row_id), [
    { row_id: entry.senses[0], before: 1, after: 3 },
    { row_id: entry.senses[2], before: 3, after: 1 },
  ]);
  const versions = await rowsAs<{ id: number; version: number }>(db, "trusted",
    "select id, version from senses where lemma_id = $1 order by id", [entry.lemma]);
  assert.deepEqual(versions.map((v) => v.version), [2, 1, 2], "each moved sense raised once");
});

test("two live senses of a lemma never share a number: at once outside a regrouping, at its end inside one", async () => {
  const db = await createSeededDatabase();
  const entry = await splitEntry(db, "béllo", ["bello", "carino"]);
  await assert.rejects(affectedAs(db, "trusted", "update senses set sense_number = 1 where id = $1", [entry.senses[1]]),
    hasCode("23P01"));
  await assert.rejects(affectedAs(db, "trusted", "insert into senses (lemma_id, sense_number) values ($1, 2)", [entry.lemma]),
    hasCode("23P01"));
  // A deleted sense frees its number.
  await affectedAs(db, "trusted", "update senses set deleted_at = now() where id = $1", [entry.senses[1]]);
  assert.equal(await affectedAs(db, "trusted", "insert into senses (lemma_id, sense_number) values ($1, 2)", [entry.lemma]), 1);

  // Inside one transaction, the rule is checked at once again as soon as
  // a regrouping returns: the deferral never outlives it.
  const other = await splitEntry(db, "brutto", ["brutto", "laido"]);
  await actAs(db, "trusted");
  await db.exec("begin");
  try {
    await db.query(REGROUP, [other.lemma, JSON.stringify(await seenOf(db, other.lemma)),
      JSON.stringify([{ glosses: [other.glosses[1]] }, { glosses: [other.glosses[0]] }])]);
    await assert.rejects(db.query("update senses set sense_number = 1 where id = $1", [other.senses[0]]), hasCode("23P01"));
  } finally {
    await db.exec("rollback");
  }
});

test("user_history names the fields an update set to null: a review date set, then cleared, reads as both", async () => {
  const db = await createSeededDatabase();
  const entry = await splitEntry(db, "béllo", ["bello", "carino"]);
  await affectedAs(db, reviewer, "update lemmas set senses_reviewed_at = now() where id = $1", [entry.lemma]);
  await affectedAs(db, reviewer, "update lemmas set senses_reviewed_at = null where id = $1", [entry.lemma]);
  await affectedAs(db, reviewer, "update lemmas set note = 'nota', gender = 'm' where id = $1", [entry.lemma]);
  await affectedAs(db, reviewer, "update lemmas set note = null where id = $1", [entry.lemma]);
  const history = await rowsAs<{ table_name: string; changed: string[] | null; cleared: string[] | null }>(db, reviewer,
    "select table_name, changed, cleared from public.user_history($1)", [USERS.reviewer]);
  assert.deepEqual(history.filter((h) => h.table_name === "lemmas").map((h) => [h.changed, h.cleared]), [
    [["note"], ["note"]],
    [["gender", "note"], []],
    [["senses_reviewed_at"], ["senses_reviewed_at"]],
    [["senses_reviewed_at"], []],
  ]);
  await insertLemma(db, contributor, "headword", ["mæ"]);
  const inserts = await rowsAs<{ action: string; cleared: string[] | null }>(db, contributor,
    "select action, cleared from public.user_history($1)", [USERS.contributor]);
  assert.deepEqual(inserts, [{ action: "insert", cleared: null }, { action: "insert", cleared: null }], "a lemma and its base form");
});
