/*
 * validate.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 03:34:57, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Check a lexicon TSV file [docs/lexicon-format.md] and report
 *           what is wrong or suspicious in it: rows the engine or the
 *           database would refuse, exact duplicates, the skeleton
 *           collisions for which the input method opens a menu, approved
 *           forms with freq 0, and the lexicon manager's two warnings
 *           [decisions 0028 and 0029]. tools/validate-lexicon.ts prints it.
 * Contract: Pure functions: text in, report out, nothing changed. Line
 *           numbers are the file's own, comment and blank lines included;
 *           a finding about the whole file has line 0. A row with an
 *           error counts as read and appears in no other section.
 */

import { isValidForm, Lexicon, type LexiconEntry } from "./lexicon.ts";
import { skeleton } from "./skeleton.ts";
import { splitElision } from "./elision.ts";

export type RowStatus = "approved" | "pending" | "rejected";

// One error or warning; line 0 when it concerns the whole file.
export interface Finding {
  line: number;
  message: string;
}

// A valid row, by its line and the three cells that identify an entry.
export interface RowRef {
  line: number;
  form: string;
  variety: string;
  orthography: string;
}

export interface DuplicateRow {
  line: number;
  status: RowStatus;
}

// Rows with the same form, variety and orthography, whatever their status.
export interface DuplicateGroup {
  form: string;
  variety: string;
  orthography: string;
  rows: DuplicateRow[];       // ascending by line
}

export interface CollisionForm {
  form: string;
  freq: number;               // of the form's first row
  line: number;               // the form's first row
}

// Approved forms that one typed key reaches in one variety and spelling
// system: the words for which the input method opens a menu.
export interface CollisionGroup {
  key: string;                // skeleton[] of every form in the group
  variety: string;
  orthography: string;
  forms: CollisionForm[];     // in the order of the menu
}

export interface ValidationReport {
  rowsRead: number;           // data rows, with or without errors
  validRows: number;          // data rows without errors
  statusCounts: Record<RowStatus, number>;  // of the valid rows
  errors: Finding[];
  duplicates: DuplicateGroup[];
  collisions: CollisionGroup[];
  zeroFreq: RowRef[];         // approved rows with freq 0
  warnings: Finding[];
}

// A row that passed every check; Lexicon takes it as a LexiconEntry.
interface ValidRow extends LexiconEntry {
  line: number;
  status: RowStatus;
}

interface Header {
  names: string[];            // every cell, trimmed; "" for a cell without a name
  width: number;              // cells up to the last named one
}

interface HeaderCheck {
  header: Header;
  errors: string[];
  warnings: string[];
}

interface RowCheck {
  row: ValidRow | null;       // null when the row has an error
  errors: string[];
  warnings: string[];         // empty when the row has an error
}

// The columns docs/lexicon-format.md requires, as Lexicon does.
const REQUIRED_COLUMNS: readonly string[] = ["form", "freq", "variety", "orthography", "status"];
const STATUSES: readonly RowStatus[] = ["approved", "pending", "rejected"];

// The largest value of the database's integer freq column.
const MAX_FREQ: number = 2147483647;

// Mirrors of admin/src/forms.ts, which the engine must not import: the
// longest form the database's ligurian_form domain accepts, and the code
// of the grafîa ofiçiâ. engine/test/validate.test.ts proves they agree.
const MAX_FORM_LENGTH: number = 64;
const OFICIA: string = "ofiçiâ";

// Characters a report shows as escapes: control and format characters
// [a byte order mark, a zero width space], combining marks that NFC left
// alone, and every separator but the plain space [a no-break space].
const HIDDEN: RegExp = /[\p{C}\p{M}\p{Z}]/u;

// Check the text of a lexicon TSV file. Never throws: every problem, down
// to a missing header, is a finding in the report.
export function validateLexicon(text: string): ValidationReport {
  const lines: string[] = text.replace(/^\uFEFF/u, "").split(/\r?\n/);
  const errors: Finding[] = [];
  const warnings: Finding[] = [];
  const rows: ValidRow[] = [];
  let rowsRead: number = 0;

  // The header is the first line that is neither blank nor a # comment.
  let headerAt: number = 0;
  while (headerAt < lines.length && isSkippable(lines[headerAt] ?? "")) {
    headerAt += 1;
  }

  if (headerAt === lines.length) {
    errors.push({ line: 0, message: "no header line" });
  } else {
    const headerLine: number = headerAt + 1;
    const check: HeaderCheck = checkHeader(lines[headerAt] ?? "");
    errors.push(...atLine(headerLine, check.errors));
    warnings.push(...atLine(headerLine, check.warnings));
    // A missing or repeated column leaves the meaning of every cell in
    // doubt, so no row is checked.
    if (check.errors.length === 0) {
      for (let i: number = headerAt + 1; i < lines.length; i += 1) {
        const raw: string = lines[i] ?? "";
        if (!isSkippable(raw)) {
          const result: RowCheck = checkRow(raw.split("\t"), check.header, i + 1);
          rowsRead += 1;
          if (result.row === null) {
            errors.push(...atLine(i + 1, result.errors));
          } else {
            rows.push(result.row);
            warnings.push(...atLine(i + 1, result.warnings));
          }
        }
      }
      if (rowsRead === 0) {
        warnings.push({ line: 0, message: "no data rows" });
      }
    }
  }

  return {
    rowsRead,
    validRows: rows.length,
    statusCounts: countStatuses(rows),
    errors: byLine(errors),
    duplicates: findDuplicates(rows),
    collisions: findCollisions(rows),
    zeroFreq: rows.filter((r) => r.status === "approved" && r.freq === 0).map(refOf),
    warnings: byLine(warnings),
  };
}

// The report as plain text: a summary, then each section that has items,
// in a fixed order, then the result. The text ends with a newline.
export function formatReport(report: ValidationReport, source: string): string {
  const counts: Record<RowStatus, number> = report.statusCounts;
  const lines: string[] = [
    `validate-lexicon: ${source}`,
    `Rows: ${report.rowsRead} read · ${report.validRows} valid · approved ${counts.approved}`
      + ` · pending ${counts.pending} · rejected ${counts.rejected}`,
    `Errors: ${report.errors.length} · Duplicates: ${report.duplicates.length}`
      + ` · Collisions: ${report.collisions.length} · Approved with freq 0: ${report.zeroFreq.length}`
      + ` · Warnings: ${report.warnings.length}`,
    "",
  ];
  addSection(lines, "Errors:", report.errors.map(formatFinding));
  addSection(lines, "Exact duplicates:", report.duplicates.map(
    (g) => `${entryName(g)}: ${g.rows.map((r) => `line ${r.line} [${r.status}]`).join(" · ")}`,
  ));
  addSection(lines, "Skeleton collisions [the input method shows a menu]:", report.collisions.map(
    (g) => `${g.key} · ${visible(g.variety)} · ${visible(g.orthography)}: `
      + g.forms.map((f) => `${f.form} [line ${f.line}, freq ${f.freq}]`).join(" · "),
  ));
  addSection(lines, "Approved rows with freq 0:", report.zeroFreq.map((r) => `line ${r.line}: ${entryName(r)}`));
  addSection(lines, "Warnings:", report.warnings.map(formatFinding));
  lines.push(`Result: ${resultOf(report)}`);
  return `${lines.join("\n")}\n`;
}

// 1 when the file has an error or a duplicate, 0 otherwise: collisions
// and warnings never fail a file.
export function exitCodeOf(report: ValidationReport): 0 | 1 {
  let code: 0 | 1 = 0;
  if (report.errors.length > 0 || report.duplicates.length > 0) {
    code = 1;
  }
  return code;
}

// Blank, or a # comment: exactly the lines Lexicon skips.
function isSkippable(line: string): boolean {
  return line.trim() === "" || line.trimStart().startsWith("#");
}

// The header's columns and what is wrong with them: a missing or repeated
// column is an error; a column the format does not define, or a cell
// without a name, is a warning and is ignored.
function checkHeader(text: string): HeaderCheck {
  const names: string[] = text.split("\t").map((cell) => cell.trim());
  const errors: string[] = [];
  const warnings: string[] = [];
  let width: number = names.length;
  while (width > 0 && names[width - 1] === "") {
    width -= 1;
  }

  const missing: string[] = REQUIRED_COLUMNS.filter((c) => !names.includes(c));
  if (missing.length > 0) {
    errors.push(`missing ${missing.length === 1 ? "column" : "columns"}: ${missing.join(", ")}; no row checked`);
  }
  const counts: Map<string, number> = new Map();
  for (const name of names) {
    if (name !== "") {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  for (const [name, count] of counts) {
    if (count > 1) {
      errors.push(`column "${visible(name)}" named ${count} times; no row checked`);
    }
    if (!REQUIRED_COLUMNS.includes(name)) {
      warnings.push(`unknown column "${visible(name)}": ignored`);
    }
  }
  for (let i: number = 0; i < width; i += 1) {
    if (names[i] === "") {
      warnings.push(`empty column name at position ${i + 1}: ignored`);
    }
  }
  if (width < names.length) {
    const what: string = names.length - width === 1 ? "empty column name" : "empty column names";
    warnings.push(`${what} at the end of the header: ignored`);
  }
  return { header: { names, width }, errors, warnings };
}

// Every error in one data row, or the row and its warnings when it has
// none. A wrong number of cells stops the checks, because the cells can
// no longer be matched with their columns.
function checkRow(cells: string[], header: Header, line: number): RowCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  let row: ValidRow | null = null;

  const countError: string | null = cellCountError(cells.length, header);
  if (countError !== null) {
    errors.push(countError);
  } else {
    const form: string = normalized("form", trimmed("form", cellOf(cells, header, "form"), warnings), warnings);
    const freqText: string = trimmed("freq", cellOf(cells, header, "freq"), warnings);
    const variety: string = normalized("variety", trimmed("variety", cellOf(cells, header, "variety"), warnings), warnings);
    const orthography: string = normalized(
      "orthography", trimmed("orthography", cellOf(cells, header, "orthography"), warnings), warnings,
    );
    const statusText: string = trimmed("status", cellOf(cells, header, "status"), warnings);
    const status: RowStatus | undefined = STATUSES.find((s) => s === statusText);

    errors.push(...formErrors(form));
    // Plain digits only, as the manager's checkFreq[] accepts: Number[]
    // alone would let "1e3", "0x10" or "1.5" through to the database.
    if (!/^[0-9]+$/.test(freqText) || Number(freqText) > MAX_FREQ) {
      errors.push(`invalid freq "${visible(freqText)}": digits only, from 0 to ${MAX_FREQ}`);
    }
    if (variety === "") {
      errors.push("empty variety");
    }
    if (orthography === "") {
      errors.push("empty orthography");
    }
    if (status === undefined) {
      errors.push(`invalid status "${visible(statusText)}": approved, pending or rejected`);
    }
    errors.push(...unnamedCellErrors(cells, header));

    if (errors.length === 0 && status !== undefined) {
      row = { line, form, freq: Number(freqText), variety, orthography, status };
      warnings.push(...managerWarnings(form, orthography));
    }
  }
  return { row, errors, warnings: row === null ? [] : warnings };
}

// A row needs one cell per column; the cells under the empty names at the
// end of the header may be left out. Null when the count is right.
function cellCountError(count: number, header: Header): string | null {
  let message: string | null = null;
  if (count < header.width || count > header.names.length) {
    const expected: string = header.width === header.names.length
      ? String(header.width)
      : `${header.width} to ${header.names.length}`;
    message = `expected ${expected} cells, found ${count}`;
  }
  return message;
}

// The raw cell of a column the header holds exactly once.
function cellOf(cells: readonly string[], header: Header, column: string): string {
  return cells[header.names.indexOf(column)] ?? "";
}

// The cell without the whitespace around it, which earns a warning.
function trimmed(column: string, raw: string, warnings: string[]): string {
  const value: string = raw.trim();
  if (value !== raw) {
    warnings.push(`whitespace around ${column} "${visible(raw)}"`);
  }
  return value;
}

// The value in NFC, as the database stores it; a value that was not
// already NFC earns a warning.
function normalized(column: string, value: string, warnings: string[]): string {
  const nfc: string = value.normalize("NFC");
  if (nfc !== value) {
    warnings.push(`${column} is not in NFC: read as "${visible(nfc)}"`);
  }
  return nfc;
}

// What the engine or the database refuses in a form: a character that
// isValidForm[] rejects, or more characters than the ligurian_form domain
// allows. Each character is tested with isValidForm[] itself, so no
// letter list is copied here.
function formErrors(form: string): string[] {
  const errors: string[] = [];
  const chars: string[] = [...form];
  if (form === "") {
    errors.push(`invalid form "": empty`);
  } else if (!isValidForm(form)) {
    const refused: string[] = [...new Set(chars.filter((ch) => !isValidForm(ch)))];
    let message: string = `invalid form "${visible(form)}"`;
    if (refused.length > 0) {
      const quoted: string[] = refused.map((ch) => `"${visible(ch)}"`);
      message += `: ${listed(quoted)} ${refused.length === 1 ? "is" : "are"} not accepted`;
    }
    if (refused.some((ch) => isTypographicApostrophe(ch))) {
      message += "; only the plain apostrophe ' is accepted";
    }
    errors.push(message);
  }
  if (chars.length > MAX_FORM_LENGTH) {
    errors.push(`invalid form "${visible(form)}": ${chars.length} characters; at most ${MAX_FORM_LENGTH} are accepted`);
  }
  return errors;
}

// The skeleton folds every typographic apostrophe to the plain one, so
// the list of them lives in skeleton.ts alone.
function isTypographicApostrophe(ch: string): boolean {
  return ch !== "'" && skeleton(ch) === "'";
}

// A value under a column without a name: the file holds something its
// header does not explain.
function unnamedCellErrors(cells: readonly string[], header: Header): string[] {
  const errors: string[] = [];
  for (let i: number = 0; i < cells.length; i += 1) {
    const value: string = (cells[i] ?? "").trim();
    if (header.names[i] === "" && value !== "") {
      errors.push(`cell ${i + 1} holds "${visible(value)}" under an empty column name`);
    }
  }
  return errors;
}

// The lexicon manager's two warnings, applied to a file. These rules
// mirror enyeUnderOficia[] and joinedElisions[] in admin/src/forms.ts
// [decisions 0028 and 0029]; engine/test/validate.test.ts proves that the
// two copies agree. The orthography arrives already in NFC.
function managerWarnings(form: string, orthography: string): string[] {
  const warnings: string[] = [];
  if (orthography === OFICIA && /[ñÑ]/u.test(form)) {
    warnings.push(`ñ under ${OFICIA}: ${form}`);
  }
  const parts: string[] = splitElision(form);
  if (parts.length > 1) {
    warnings.push(`joined elision: ${form} [${parts.join(" + ")}]`);
  }
  return warnings;
}

// Form, variety and orthography: what makes two rows one entry. No cell
// can hold a tab, so the tab keeps the three apart.
function identity(entry: LexiconEntry): string {
  return `${entry.form}\t${entry.variety}\t${entry.orthography}`;
}

// Groups of rows that are one entry, in the order of their first line.
function findDuplicates(rows: readonly ValidRow[]): DuplicateGroup[] {
  const groups: Map<string, DuplicateGroup> = new Map();
  for (const row of rows) {
    const key: string = identity(row);
    const group: DuplicateGroup = groups.get(key)
      ?? { form: row.form, variety: row.variety, orthography: row.orthography, rows: [] };
    group.rows.push({ line: row.line, status: row.status });
    groups.set(key, group);
  }
  return [...groups.values()].filter((g) => g.rows.length > 1);
}

// The approved forms that share a key, in the order of the input method's
// menu. Lexicon itself orders them, so the report cannot drift from what
// users see; like Lexicon, it keeps the first row of a repeated entry.
function findCollisions(rows: readonly ValidRow[]): CollisionGroup[] {
  const lexicon: Lexicon = new Lexicon();
  const firstLine: Map<string, number> = new Map();
  const keys: Map<string, Omit<CollisionGroup, "forms">> = new Map();
  for (const row of rows) {
    if (row.status === "approved") {
      const key: string = skeleton(row.form);
      lexicon.add(row);
      if (!firstLine.has(identity(row))) {
        firstLine.set(identity(row), row.line);
      }
      keys.set(`${key}\t${row.variety}\t${row.orthography}`, { key, variety: row.variety, orthography: row.orthography });
    }
  }
  const groups: CollisionGroup[] = [];
  for (const { key, variety, orthography } of keys.values()) {
    // skeleton[] is idempotent, so looking up the key finds its own forms.
    const entries: LexiconEntry[] = lexicon.lookup(key, { variety, orthography });
    if (entries.length > 1) {
      const forms: CollisionForm[] = entries.map(
        (e) => ({ form: e.form, freq: e.freq, line: firstLine.get(identity(e)) ?? 0 }),
      );
      groups.push({ key, variety, orthography, forms });
    }
  }
  return groups.sort(compareGroups);
}

// Larger groups first, then by key, variety and orthography in code unit
// order, which does not depend on the ICU version.
function compareGroups(a: CollisionGroup, b: CollisionGroup): number {
  let order: number = b.forms.length - a.forms.length;
  if (order === 0) {
    order = codeUnitOrder(a.key, b.key);
  }
  if (order === 0) {
    order = codeUnitOrder(a.variety, b.variety);
  }
  if (order === 0) {
    order = codeUnitOrder(a.orthography, b.orthography);
  }
  return order;
}

function codeUnitOrder(a: string, b: string): number {
  let order: number = 0;
  if (a < b) {
    order = -1;
  } else if (a > b) {
    order = 1;
  }
  return order;
}

function countStatuses(rows: readonly ValidRow[]): Record<RowStatus, number> {
  const counts: Record<RowStatus, number> = { approved: 0, pending: 0, rejected: 0 };
  for (const row of rows) {
    counts[row.status] += 1;
  }
  return counts;
}

function refOf(row: ValidRow): RowRef {
  return { line: row.line, form: row.form, variety: row.variety, orthography: row.orthography };
}

function atLine(line: number, messages: readonly string[]): Finding[] {
  return messages.map((message) => ({ line, message }));
}

// Ordered by line; the sort is stable, so the findings of one line keep
// the order in which they were found.
function byLine(findings: readonly Finding[]): Finding[] {
  return [...findings].sort((a, b) => a.line - b.line);
}

// A value as the report shows it: hidden characters become escapes such
// as \u200B, and a backslash or a double quote is escaped too, so that the
// quotes around a value always show where it starts and ends.
function visible(text: string): string {
  let shown: string = "";
  for (const ch of text) {
    const code: number = ch.codePointAt(0) ?? 0;
    const hex: string = code.toString(16).toUpperCase();
    if (ch === "\\" || ch === "\"") {
      shown += `\\${ch}`;
    } else if (ch !== " " && HIDDEN.test(ch)) {
      shown += code > 0xFFFF ? `\\u{${hex}}` : `\\u${hex.padStart(4, "0")}`;
    } else {
      shown += ch;
    }
  }
  return shown;
}

// "a", "a and b", "a, b and c".
function listed(items: readonly string[]): string {
  const last: string = items[items.length - 1] ?? "";
  return items.length < 2 ? last : `${items.slice(0, -1).join(", ")} and ${last}`;
}

function entryName(entry: Pick<RowRef, "form" | "variety" | "orthography">): string {
  return `${entry.form} · ${visible(entry.variety)} · ${visible(entry.orthography)}`;
}

function formatFinding(finding: Finding): string {
  return finding.line > 0 ? `line ${finding.line}: ${finding.message}` : finding.message;
}

// A heading, its items indented two spaces, then a blank line; nothing at
// all when there is no item. A loop, not a spread: a real dictionary can
// have more items than a call takes arguments.
function addSection(lines: string[], heading: string, items: readonly string[]): void {
  if (items.length > 0) {
    lines.push(heading);
    for (const item of items) {
      lines.push(`  ${item}`);
    }
    lines.push("");
  }
}

// "OK", or what makes the file fail: "1 error", "3 errors · 2 duplicates".
function resultOf(report: ValidationReport): string {
  const parts: string[] = [];
  if (report.errors.length > 0) {
    parts.push(`${report.errors.length} ${report.errors.length === 1 ? "error" : "errors"}`);
  }
  if (report.duplicates.length > 0) {
    parts.push(`${report.duplicates.length} ${report.duplicates.length === 1 ? "duplicate" : "duplicates"}`);
  }
  return parts.length === 0 ? "OK" : parts.join(" · ");
}
