# 0025: The CSV download is separated by semicolons

* **Status:** accepted
* **Date:** 2026/10/17
* **Decided by:** Eng. José Ignacio Castro de R.
* **Supersedes:** the point "Comma, not semicolon" of [0023](0023-lexicon-manager-spanish-history-csv.md)
* **Updated:** 2026/10/18, version 0.11.0: the CSV and TSV downloads are named by the local date and time of the download

## Context

Version 0.6.0 offered the dictionary as CSV separated by commas, the separator of RFC 4180 [decision [0023](0023-lexicon-manager-spanish-history-csv.md)]. The people who will open the file are mostly Italian and Spanish speakers, and Excel set to Italian or Spanish uses the comma as its decimal mark and therefore expects semicolons between fields. With commas, a double click on the file showed every row in a single column, and opening it correctly needed Excel's Data menu.

## Decision

* **Semicolon as the separator.** Everything else stays as RFC 4180 describes it: a field is quoted when it holds the separator, a double quote, a line break or surrounding spaces; a double quote inside a field is written twice; every line ends with CRLF.
* **A comma is ordinary text** and is not quoted.
* **The UTF-8 byte order mark stays,** so that Excel shows the Ligurian letters correctly.
* **No `sep=;` first line.** It would make Excel in every language open the file in columns, but it is not part of any standard: LibreOffice, Google Sheets and other programs show it as a first row of data.
* ~~**The file name stays** `ligurian-lexicon.csv`.~~ Replaced on 2026/10/18, in version 0.11.0, by the next point; kept here struck through so that the original decision remains readable.
* **The file name carries the local date and time of the download** [since 2026/10/18, version 0.11.0]: `ligurian-lexicon-YYYYMMDD-HHMMSS.csv`, such as `ligurian-lexicon-20261018-123107.csv`, and the TSV download likewise, `ligurian-lexicon-20261018-123107.tsv`. Until 0.10.0 both were always named `ligurian-lexicon.csv` and `ligurian-lexicon.tsv`, so a second download overwrote the first or became `ligurian-lexicon [1].csv`, and nothing in the name said which day's dictionary a file held. The stamp is the one the backups already use [decision [0031](0031-backups.md)]: digits only, because `/` and `:` are forbidden in file names on Windows; local time without a zone, matching the person's own clock, so that files sort by name in the order they were made. Two people in different time zones who download at the same instant get names hours apart; that is accepted for consistency with the backups.

## Consequences

* Excel set to Italian or Spanish opens the file in columns with a double click.
* Excel set to English expects commas and shows each row in one column on a double click; Data, From Text/CSV opens it correctly. This is the trade made on purpose, in favour of the project's own readers.
* The TSV download is unchanged in content, and remains the format for programs. A program that expects the fixed name `ligurian-lexicon.tsv` must be given the stamped file's path; nothing in this repository depended on the fixed name.
