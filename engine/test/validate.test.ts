/*
 * validate.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 03:36:17, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of the lexicon file check [validate.ts]: the reading
 *           rules, every error and warning, the sections of the report
 *           and their order, the printed text and the exit code.
 * Method:   Small TSV texts written here. The spellings come from
 *           data/fixtures/test-lexicon.tsv and the other engine tests;
 *           strings such as "abc1" are invalid on purpose.
 * Contract: No test reads a file. The mirror tests import the lexicon
 *           manager's rules from admin/src/forms.ts and prove that
 *           validate.ts applies the same ones.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { Lexicon } from "../src/lexicon.ts";
import {
  exitCodeOf, formatReport, validateLexicon, type CollisionGroup, type Finding, type ValidationReport,
} from "../src/validate.ts";
import { enyeUnderOficia, joinedElisions, MAX_FORM_LENGTH, OFICIA } from "../../admin/src/forms.ts";

const HEADER: string = "form\tfreq\tvariety\torthography\tstatus";
const FREQ_RULE: string = "digits only, from 0 to 2147483647";

// One data row; by default a valid approved row in zeneize and ofiçiâ.
function row(
  form: string, freq: string = "1", status: string = "approved", variety: string = "zeneize", orthography: string = "ofiçiâ",
): string {
  return [form, freq, variety, orthography, status].join("\t");
}

function tsv(...lines: string[]): string {
  return lines.join("\n");
}

// Findings as "line: message", compact to compare.
function at(findings: readonly Finding[]): string[] {
  return findings.map((f) => `${f.line}: ${f.message}`);
}

// The messages that start with a prefix, without it.
function after(findings: readonly Finding[], prefix: string): string[] {
  return findings.filter((f) => f.message.startsWith(prefix)).map((f) => f.message.slice(prefix.length));
}

test("a clean file has no finding, the right counts and exit code 0", () => {
  const report: ValidationReport = validateLexicon(tsv(
    HEADER,
    row("zenéize"),
    row("câza", "3"),
    row("çitæ", "2", "pending"),
    row("pægoa", "1", "rejected"),
  ));
  assert.equal(report.rowsRead, 4);
  assert.equal(report.validRows, 4);
  assert.deepEqual(report.statusCounts, { approved: 2, pending: 1, rejected: 1 });
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.duplicates, []);
  assert.deepEqual(report.collisions, []);
  assert.deepEqual(report.zeroFreq, []);
  assert.deepEqual(report.warnings, []);
  assert.equal(exitCodeOf(report), 0);
});

test("comment and blank lines are skipped, yet every line number is the file's own", () => {
  const report: ValidationReport = validateLexicon(tsv(
    "# a comment",
    "",
    HEADER,
    "   # an indented comment",
    row("pénna", "10"),
    "",
    "\t \t",
    row("abc1"),
    row("pénn-a", "15"),
    row("pénna", "1", "pending"),
  ));
  assert.equal(report.rowsRead, 4);
  assert.deepEqual(at(report.errors), ['8: invalid form "abc1": "1" is not accepted']);
  assert.deepEqual(report.duplicates.map((g) => g.rows.map((r) => r.line)), [[5, 10]]);
  assert.deepEqual(report.collisions.map((g) => g.forms.map((f) => f.line)), [[9, 5]]);
});

test("a byte order mark and CRLF line ends give exactly the report of the plain LF file", () => {
  const lines: string[] = ["# a comment", HEADER, row("é"), row("e"), row("abc1"), row(" ò"), ""];
  const plain: ValidationReport = validateLexicon(lines.join("\n"));
  assert.equal(plain.collisions.length, 1, "the reports compared are not empty");
  assert.equal(plain.errors.length, 1);
  assert.equal(plain.warnings.length, 1);
  assert.deepEqual(validateLexicon(lines.join("\r\n")), plain);
  assert.deepEqual(validateLexicon(`\uFEFF${lines.join("\r\n")}`), plain);
  assert.deepEqual(validateLexicon(`\uFEFF${lines.join("\n")}`), plain);
  assert.deepEqual(validateLexicon(`${lines.slice(0, 3).join("\r\n")}\n${lines.slice(3).join("\n")}`), plain, "mixed line ends");
  const bare: ValidationReport = validateLexicon(`\uFEFF${lines.slice(1).join("\r\n")}`);
  assert.deepEqual(at(bare.errors), ['4: invalid form "abc1": "1" is not accepted'], "a mark right before the header");
});

test("a file without a header line has one error, about the whole file", () => {
  for (const text of ["", "\n\n", "# only\n# comments\n", "\uFEFF", " \t \r\n"]) {
    const report: ValidationReport = validateLexicon(text);
    assert.deepEqual(report.errors, [{ line: 0, message: "no header line" }], JSON.stringify(text));
    assert.equal(report.rowsRead, 0);
    assert.deepEqual(report.warnings, []);
    assert.equal(exitCodeOf(report), 1);
  }
});

test("a missing required column is one error naming it, and no row is checked", () => {
  const one: ValidationReport = validateLexicon(tsv("# c", "form\tfreq\tvariety\tstatus", "abc1\tx\tzeneize\tapproved"));
  assert.deepEqual(at(one.errors), ["2: missing column: orthography; no row checked"]);
  assert.equal(one.rowsRead, 0);
  assert.equal(one.validRows, 0);
  const two: ValidationReport = validateLexicon(tsv("form\tvariety\tstatus", "pénna\tzeneize\tapproved"));
  assert.deepEqual(at(two.errors), ["1: missing columns: freq, orthography; no row checked"]);
  const capital: ValidationReport = validateLexicon(tsv("Form\tfreq\tvariety\torthography\tstatus", row("pénna")));
  assert.deepEqual(at(capital.errors), ["1: missing column: form; no row checked"], "names are case sensitive, as in Lexicon");
  assert.deepEqual(at(capital.warnings), ['1: unknown column "Form": ignored']);
});

test("columns are found by name, in any order; an unknown column is a warning and is ignored", () => {
  const report: ValidationReport = validateLexicon(tsv(
    "status\tnote\torthography\tform\tvariety\tfreq",
    "pending\tanything\tofiçiâ\tpénna\tzeneize\t0",
    "approved\t\tofiçiâ\tpénn-a\tzeneize\t15",
  ));
  assert.deepEqual(report.errors, []);
  assert.deepEqual(at(report.warnings), ['1: unknown column "note": ignored']);
  assert.deepEqual(report.statusCounts, { approved: 1, pending: 1, rejected: 0 });
});

test("a column named twice is an error and stops the check", () => {
  const report: ValidationReport = validateLexicon(tsv(`${HEADER}\tfreq\tnote\tnote`, `${row("abc1")}\t2\t\t`));
  assert.deepEqual(at(report.errors), [
    '1: column "freq" named 2 times; no row checked',
    '1: column "note" named 2 times; no row checked',
  ]);
  assert.deepEqual(at(report.warnings), ['1: unknown column "note": ignored']);
  assert.equal(report.rowsRead, 0);
});

test("empty column names at the end of the header are ignored, with one warning", () => {
  const report: ValidationReport = validateLexicon(tsv(
    `${HEADER}\t\t`,
    row("pénna"),
    `${row("pénn-a")}\t`,
    `${row("òmmo")}\t \t`,
    `${row("ægua")}\tx`,
    `${row("avéi")}\t\t\t`,
    "d'\t1\tzeneize\tofiçiâ",
  ));
  assert.deepEqual(at(report.warnings), ["1: empty column names at the end of the header: ignored"]);
  assert.deepEqual(at(report.errors), [
    '5: cell 6 holds "x" under an empty column name',
    "6: expected 5 to 7 cells, found 8",
    "7: expected 5 to 7 cells, found 4",
  ]);
  assert.equal(report.validRows, 3);
  const one: ValidationReport = validateLexicon(tsv(`${HEADER}\t`, row("pénna")));
  assert.deepEqual(at(one.warnings), ["1: empty column name at the end of the header: ignored"]);
  assert.deepEqual(one.errors, []);
});

test("an empty column name inside the header is a warning; a value under it is an error", () => {
  const report: ValidationReport = validateLexicon(tsv(
    "form\t\tfreq\tvariety\torthography\tstatus",
    "pénna\t\t1\tzeneize\tofiçiâ\tapproved",
    "pénn-a\tx\t1\tzeneize\tofiçiâ\tapproved",
  ));
  assert.deepEqual(at(report.warnings), ["1: empty column name at position 2: ignored"]);
  assert.deepEqual(at(report.errors), ['3: cell 2 holds "x" under an empty column name']);
});

test("each row error is reported on its line; the row counts as read, not as valid", () => {
  const report: ValidationReport = validateLexicon(tsv(
    HEADER,
    "pénna\t1\tzeneize\tofiçiâ",
    row("abc1"),
    row("d’avéi"),
    row(""),
    row("pénna", ""),
    row("pénna", "x"),
    row("pénna", "-1"),
    row("pénna", "1", "approved", ""),
    row("pénna", "1", "approved", "zeneize", ""),
    row("pénna", "1", "Approved"),
    row("pénna", "1", "accepted"),
  ));
  assert.deepEqual(at(report.errors), [
    "2: expected 5 cells, found 4",
    '3: invalid form "abc1": "1" is not accepted',
    `4: invalid form "d’avéi": "’" is not accepted; only the plain apostrophe ' is accepted`,
    '5: invalid form "": empty',
    `6: invalid freq "": ${FREQ_RULE}`,
    `7: invalid freq "x": ${FREQ_RULE}`,
    `8: invalid freq "-1": ${FREQ_RULE}`,
    "9: empty variety",
    "10: empty orthography",
    '11: invalid status "Approved": approved, pending or rejected',
    '12: invalid status "accepted": approved, pending or rejected',
  ]);
  assert.equal(report.rowsRead, 11);
  assert.equal(report.validRows, 0);
  assert.deepEqual(report.duplicates, [], "rows with errors are never duplicates");
  assert.equal(exitCodeOf(report), 1);
});

test("every typographic apostrophe is refused, with a pointer to the plain one", () => {
  for (const apostrophe of ["\u2019", "\u2018", "\u02BC"]) {
    const report: ValidationReport = validateLexicon(tsv(HEADER, row(`d${apostrophe}avéi`)));
    assert.deepEqual(at(report.errors), [
      `2: invalid form "d${apostrophe}avéi": "${apostrophe}" is not accepted; only the plain apostrophe ' is accepted`,
    ]);
  }
  assert.deepEqual(validateLexicon(tsv(HEADER, row("d'avéi"))).errors, [], "the plain apostrophe is accepted");
});

test("freq must be plain digits, from 0 to the largest integer the database holds", () => {
  const refused: string[] = [
    "1e3", "0x10", "+5", "1.5", "1.0", "-0", "Infinity", "NaN", "1 000", "\u0661", "2147483648", "99999999999999999999",
  ];
  for (const freq of refused) {
    const report: ValidationReport = validateLexicon(tsv(HEADER, row("pénna", freq)));
    assert.deepEqual(at(report.errors), [`2: invalid freq "${freq}": ${FREQ_RULE}`], freq);
  }
  for (const freq of ["0", "007", "2147483647"]) {
    assert.deepEqual(validateLexicon(tsv(HEADER, row("pénna", freq))).errors, [], freq);
  }
  const parsed: ValidationReport = validateLexicon(tsv(HEADER, row("pénna", "007"), row("pénn-a", "2147483647")));
  assert.deepEqual(parsed.collisions[0]?.forms.map((f) => f.freq), [2147483647, 7]);
});

test("every error of a row is reported; a wrong number of cells alone stops the row", () => {
  const report: ValidationReport = validateLexicon(tsv(HEADER, "abc1\tx\t\t\tAccepted", "abc1\tx"));
  assert.deepEqual(at(report.errors), [
    '2: invalid form "abc1": "1" is not accepted',
    `2: invalid freq "x": ${FREQ_RULE}`,
    "2: empty variety",
    "2: empty orthography",
    '2: invalid status "Accepted": approved, pending or rejected',
    "3: expected 5 cells, found 2",
  ]);
});

test("whitespace around any cell, and a value not in NFC, are warnings; the value is read cleaned", () => {
  const report: ValidationReport = validateLexicon(tsv(
    HEADER,
    " pénna \t 1\t zeneize\tofiçiâ \tapproved ",
    "pe\u0301nn-a\t1\tzeneize\tofic\u0327i\u00e2\tapproved",
    "\u00A0òmmo\t1\tzeneize\u00A0\tofiçiâ\tapproved",
  ));
  assert.deepEqual(report.errors, []);
  assert.deepEqual(at(report.warnings), [
    '2: whitespace around form " pénna "',
    '2: whitespace around freq " 1"',
    '2: whitespace around variety " zeneize"',
    '2: whitespace around orthography "ofiçiâ "',
    '2: whitespace around status "approved "',
    '3: form is not in NFC: read as "pénn-a"',
    '3: orthography is not in NFC: read as "ofiçiâ"',
    String.raw`4: whitespace around form "\u00A0òmmo"`,
    String.raw`4: whitespace around variety "zeneize\u00A0"`,
  ]);
  assert.deepEqual(
    report.collisions.map((g) => [g.key, g.variety, g.orthography, g.forms.length]),
    [["penna", "zeneize", "ofiçiâ", 2]],
    "the cleaned values group together",
  );
  assert.deepEqual(report.statusCounts, { approved: 3, pending: 0, rejected: 0 });
});

test("hidden characters, quotes and backslashes in a quoted value are shown as escapes", () => {
  const report: ValidationReport = validateLexicon(tsv(
    HEADER,
    row("pénna\u200B"),
    row("pe\u0301\u0301nna"),
    row("a\"b\\c"),
    row("\uFEFFòmmo"),
    row("òmmo\u{E0041}"),
  ));
  assert.deepEqual(at(report.errors), [
    String.raw`2: invalid form "pénna\u200B": "\u200B" is not accepted`,
    String.raw`3: invalid form "pé\u0301nna": "\u0301" is not accepted`,
    String.raw`4: invalid form "a\"b\\c": "\"" and "\\" are not accepted`,
    String.raw`6: invalid form "òmmo\u{E0041}": "\u{E0041}" is not accepted`,
  ]);
  assert.deepEqual(at(report.warnings), [String.raw`5: whitespace around form "\uFEFFòmmo"`]);
});

test("rows with the same form, variety and orthography are duplicates, whatever their status", () => {
  const report: ValidationReport = validateLexicon(tsv(
    HEADER,
    row("pénna"),
    row("òmmo", "1", "pending"),
    row("pénna", "5", "rejected"),
    row("òmmo"),
    row("pénna", "1", "pending"),
    row("pénna", "1", "approved", "savoneize"),
    row("pénna", "1", "approved", "zeneize", "unitäia"),
    row("pénn-a"),
  ));
  assert.deepEqual(report.duplicates, [
    {
      form: "pénna", variety: "zeneize", orthography: "ofiçiâ",
      rows: [{ line: 2, status: "approved" }, { line: 4, status: "rejected" }, { line: 6, status: "pending" }],
    },
    {
      form: "òmmo", variety: "zeneize", orthography: "ofiçiâ",
      rows: [{ line: 3, status: "pending" }, { line: 5, status: "approved" }],
    },
  ]);
  assert.deepEqual(report.errors, []);
  assert.equal(exitCodeOf(report), 1);
});

test("approved forms sharing a key collide; other varieties and pending rows do not", () => {
  const report: ValidationReport = validateLexicon(tsv(
    HEADER,
    row("pénna", "10"),
    row("pénn-a", "15"),
    row("é", "1", "approved", "savoneize"),
    row("e"),
    row("é", "1", "approved", "zeneize", "unitäia"),
    row("ò", "1", "pending"),
    row("o"),
  ));
  assert.deepEqual(report.collisions, [{
    key: "penna",
    variety: "zeneize",
    orthography: "ofiçiâ",
    forms: [{ form: "pénn-a", freq: 15, line: 3 }, { form: "pénna", freq: 10, line: 2 }],
  }]);
});

test("collision groups are ordered by size, then by key; forms in the order of Lexicon's menu", () => {
  const text: string = tsv(
    HEADER,
    row("o"),
    row("ò"),
    row("pénna", "10"),
    row("pénn-a", "15"),
    row("à", "3"),
    row("â", "9"),
    row("a", "3"),
    row("é"),
    row("e"),
  );
  const report: ValidationReport = validateLexicon(text);
  assert.deepEqual(report.collisions.map((g) => g.key), ["a", "e", "o", "penna"]);
  const lexicon: Lexicon = Lexicon.fromTsv(text);
  for (const group of report.collisions) {
    assert.deepEqual(group.forms.map((f) => f.form), lexicon.lookup(group.key).map((e) => e.form), group.key);
  }
  const largest: CollisionGroup | undefined = report.collisions[0];
  assert.equal(largest?.forms[0]?.form, "â", "the highest freq first");
  const tie: string[] = ["à", "a"].sort((x, y) => x.localeCompare(y, "it"));
  assert.deepEqual(largest?.forms.slice(1).map((f) => f.form), tie, "equal freq: localeCompare in Italian");
});

test("a repeated form appears once in its collision group, with its first row", () => {
  const report: ValidationReport = validateLexicon(tsv(HEADER, row("pénna", "10"), row("pénn-a", "15"), row("pénna", "20")));
  assert.deepEqual(report.collisions[0]?.forms, [{ form: "pénn-a", freq: 15, line: 3 }, { form: "pénna", freq: 10, line: 2 }]);
  assert.deepEqual(report.duplicates.map((g) => g.rows.map((r) => r.line)), [[2, 4]]);
  assert.deepEqual(validateLexicon(tsv(HEADER, row("pénna"), row("pénna"))).collisions, [], "one form is no menu");
});

test("approved rows with freq 0 are reported; pending and rejected ones are not", () => {
  const report: ValidationReport = validateLexicon(tsv(
    HEADER,
    row("ægua", "0"),
    row("avéi", "0", "pending"),
    row("òmmo", "0", "rejected"),
    row("pénna", "00"),
    row("pénn-a", "1"),
  ));
  assert.deepEqual(report.zeroFreq, [
    { line: 2, form: "ægua", variety: "zeneize", orthography: "ofiçiâ" },
    { line: 5, form: "pénna", variety: "zeneize", orthography: "ofiçiâ" },
  ]);
  assert.deepEqual(report.warnings, [], "freq 0 has a section of its own");
  assert.equal(exitCodeOf(report), 0);
});

test("ñ under ofiçiâ warns, in either case; under another orthography it does not", () => {
  const report: ValidationReport = validateLexicon(tsv(
    HEADER,
    row("tañu"),
    row("Ñaro"),
    row("tañu", "1", "approved", "zeneize", "unitäia"),
    row("Ñaro", "1", "approved", "savoneize", "ofic\u0327i\u00e2"),
    row("tan\u0303u", "1", "approved", "tabarchin"),
    row("pénna"),
  ));
  assert.deepEqual(at(report.warnings), [
    "2: ñ under ofiçiâ: tañu",
    "3: ñ under ofiçiâ: Ñaro",
    '5: orthography is not in NFC: read as "ofiçiâ"',
    "5: ñ under ofiçiâ: Ñaro",
    '6: form is not in NFC: read as "tañu"',
    "6: ñ under ofiçiâ: tañu",
  ]);
  assert.equal(exitCodeOf(report), 0);
});

test("a joined elision warns with its parts; an apostrophe at the start or the end does not", () => {
  const report: ValidationReport = validateLexicon(tsv(
    HEADER,
    row("d'ægua"),
    row("quell'òmmo"),
    row("'na"),
    row("pe'"),
    row("d'"),
    row("canpànn-a"),
  ));
  assert.deepEqual(at(report.warnings), [
    "2: joined elision: d'ægua [d' + ægua]",
    "3: joined elision: quell'òmmo [quell' + òmmo]",
  ]);
  assert.equal(exitCodeOf(report), 0);
});

test("a row with an error is counted as read and appears in no other section", () => {
  const report: ValidationReport = validateLexicon(tsv(
    `${HEADER}\t`,
    `${row("pénna")}\t`,
    `${row("pénn-a")}\t`,
    `${row(" pénna", "0")}\tx`,
    `${row("tañu")}\tx`,
    `${row("d'ægua")}\tx`,
  ));
  assert.equal(report.rowsRead, 5);
  assert.equal(report.validRows, 2);
  assert.deepEqual(report.errors.map((f) => f.line), [4, 5, 6]);
  assert.deepEqual(report.duplicates, [], "line 4 would repeat line 2");
  assert.deepEqual(
    report.collisions.map((g) => g.forms.map((f) => f.line).sort((a, b) => a - b)),
    [[2, 3]],
    "line 4 would join the menu",
  );
  assert.deepEqual(report.zeroFreq, [], "line 4 has freq 0");
  assert.deepEqual(at(report.warnings), ["1: empty column name at the end of the header: ignored"], "lines 4 to 6 would warn");
});

test("a header without data rows is a warning about the whole file, not an error", () => {
  const report: ValidationReport = validateLexicon(tsv("# c", HEADER, "", "# the end", ""));
  assert.deepEqual(report.warnings, [{ line: 0, message: "no data rows" }]);
  assert.deepEqual(report.errors, []);
  assert.equal(exitCodeOf(report), 0);
  assert.deepEqual(validateLexicon(tsv(HEADER, row("abc1"))).warnings, [], "rows with errors are still data rows");
});

test("the printed report: the summary, the sections in order, the result", () => {
  const text: string = tsv(
    "# example",
    `${HEADER}\tnote`,
    `${row("pénna", "10")}\t`,
    `${row("pénn-a", "15")}\t`,
    `${row("abc1")}\t`,
    row("òmmo"),
    `${row("pénna", "1", "pending")}\t`,
    `${row("ægua", "0")}\t`,
    `${row("tañu")}\t`,
    `${row("d'ægua")}\t`,
    `${row(" avéi ", "2", "rejected")}\t`,
  );
  assert.equal(formatReport(validateLexicon(text), "example.tsv"), [
    "validate-lexicon: example.tsv",
    "Rows: 9 read · 7 valid · approved 5 · pending 1 · rejected 1",
    "Errors: 2 · Duplicates: 1 · Collisions: 1 · Approved with freq 0: 1 · Warnings: 4",
    "",
    "Errors:",
    '  line 5: invalid form "abc1": "1" is not accepted',
    "  line 6: expected 6 cells, found 5",
    "",
    "Exact duplicates:",
    "  pénna · zeneize · ofiçiâ: line 3 [approved] · line 7 [pending]",
    "",
    "Skeleton collisions [the input method shows a menu]:",
    "  penna · zeneize · ofiçiâ: pénn-a [line 4, freq 15] · pénna [line 3, freq 10]",
    "",
    "Approved rows with freq 0:",
    "  line 8: ægua · zeneize · ofiçiâ",
    "",
    "Warnings:",
    '  line 2: unknown column "note": ignored',
    "  line 9: ñ under ofiçiâ: tañu",
    "  line 10: joined elision: d'ægua [d' + ægua]",
    '  line 11: whitespace around form " avéi "',
    "",
    "Result: 2 errors · 1 duplicate",
    "",
  ].join("\n"));
});

test("the printed report omits empty sections and writes singular and plural correctly", () => {
  assert.equal(formatReport(validateLexicon(tsv(HEADER, row("pénna"))), "clean.tsv"), [
    "validate-lexicon: clean.tsv",
    "Rows: 1 read · 1 valid · approved 1 · pending 0 · rejected 0",
    "Errors: 0 · Duplicates: 0 · Collisions: 0 · Approved with freq 0: 0 · Warnings: 0",
    "",
    "Result: OK",
    "",
  ].join("\n"));
  const empty: string = formatReport(validateLexicon(""), "empty.tsv");
  assert.ok(empty.endsWith("\n\nErrors:\n  no header line\n\nResult: 1 error\n"), empty);
  const three: string = formatReport(validateLexicon(tsv(HEADER, row("abc1"), row("abc2"), row("abc3"))), "three.tsv");
  assert.ok(three.endsWith("\nResult: 3 errors\n"), three);
  const hidden: string = "zene\u200Bize";
  const duplicate: string = formatReport(
    validateLexicon(tsv(HEADER, row("pénna"), row("pénna", "1", "approved", hidden), row("pénna", "2", "rejected", hidden))),
    "duplicate.tsv",
  );
  assert.ok(duplicate.includes(String.raw`  pénna · zene\u200Bize · ofiçiâ: line 3 [approved] · line 4 [rejected]`), duplicate);
  assert.ok(duplicate.endsWith("\nResult: 1 duplicate\n"), duplicate);
  const warned: string = formatReport(validateLexicon(tsv(HEADER, row("é"), row("e"), row(" òmmo"))), "warned.tsv");
  assert.ok(warned.endsWith("\nResult: OK\n"), warned);
});

test("the exit code is 1 for an error or for a duplicate alone; collisions and warnings give 0", () => {
  assert.equal(exitCodeOf(validateLexicon(tsv(HEADER, row("é"), row("e"), row(" òmmo"), row("ægua", "0")))), 0);
  assert.equal(exitCodeOf(validateLexicon(tsv(HEADER, row("abc1")))), 1);
  const duplicate: ValidationReport = validateLexicon(tsv(HEADER, row("pénna"), row("pénna", "1", "pending")));
  assert.deepEqual(duplicate.errors, []);
  assert.equal(exitCodeOf(duplicate), 1);
});

test("the ñ and elision warnings agree with the lexicon manager's [admin/src/forms.ts]", () => {
  const forms: string[] = ["tañu", "Ñaro", "pénna", "d'ægua", "quell'òmmo", "l'ægua", "'na", "pe'", "d'", "canpànn-a"];
  assert.ok(enyeUnderOficia(forms, OFICIA).length > 0 && joinedElisions(forms).length > 0, "the comparison is not empty");
  for (const orthography of [OFICIA, "unitäia", "ofic\u0327i\u00e2"]) {
    const report: ValidationReport = validateLexicon(
      tsv(HEADER, ...forms.map((f) => row(f, "1", "approved", "zeneize", orthography))),
    );
    assert.deepEqual(report.errors, []);
    assert.deepEqual(after(report.warnings, `ñ under ${OFICIA}: `), enyeUnderOficia(forms, orthography), orthography);
    assert.deepEqual(after(report.warnings, "joined elision: "), joinedElisions(forms), orthography);
  }
});

test("the longest form accepted is the database's, as the lexicon manager has it", () => {
  const tooLong: string = "a".repeat(MAX_FORM_LENGTH + 1);
  const report: ValidationReport = validateLexicon(tsv(
    HEADER,
    row("a".repeat(MAX_FORM_LENGTH)),
    row("e\u0301".repeat(MAX_FORM_LENGTH)),
    row(tooLong),
  ));
  assert.deepEqual(at(report.errors), [
    `4: invalid form "${tooLong}": ${MAX_FORM_LENGTH + 1} characters; at most ${MAX_FORM_LENGTH} are accepted`,
  ], "characters are counted after NFC, as the database counts them");
  assert.equal(report.validRows, 2);
});
