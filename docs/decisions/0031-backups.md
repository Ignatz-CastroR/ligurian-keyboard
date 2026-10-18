# 0031: Backups from the lexicon manager

* **Status:** accepted
* **Date:** 2026/10/18
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refines:** [0012](0012-never-hard-delete.md), on keeping the whole history

## Context

The dictionary lives in one Supabase project. Nothing is ever deleted inside it [decision [0012](0012-never-hard-delete.md)], but the project itself can still be lost: an account problem, a mistake in a migration, or the provider. The criteria for 1.0.0 ask for a backup routine, and bulk imports must not begin before a restore has been proven, since an import adds many rows at once.

Three ways were weighed: a button in the lexicon manager; a `pg_dump` script on a maintainer's computer, which needs PostgreSQL's tools installed and the database password in a local file; and a scheduled GitHub Action, which needs the password as a repository secret and its files encrypted, since the artifacts of a public repository can be read by others.

## Decision

* **Backups are made from the lexicon manager,** by an admin, with one button on the people page. The database writes the backup itself, through `public.export_backup()`, and the browser saves it as one JSON file named by local date and time, such as `ligurian-backup-20261018-085840.json`. No secret is stored anywhere and nothing has to be installed. A maintainer can also run `select public.export_backup();` in Supabase's SQL Editor.
* **Only admins may download one,** the database refusing everyone else: a backup holds every row, pending, rejected and deleted ones included, the whole history and every profile.
* **A backup holds** the reference lists [varieties, spelling systems, gloss languages], the profiles [display name and role; no email and no password], lemmas, wordforms, senses, glosses and the whole audit log, each row exactly as stored, codes included. It declares its format and format version, `ligurian-keyboard-backup` version 1, and the count of rows in each table.
* **Login accounts are not in a backup.** They live in Supabase's own `auth` schema, which a project cannot export this way. A profile is restored only onto an account that exists with the same id, as in a restore into the same project after its data was lost; the person restoring keeps their own role, and a restore never lowers the role of anyone who is an admin already. A new project gives every account a new id: there, admins give people back their roles by hand, from the names and roles the backup lists.
* **A restore goes only into an empty dictionary,** one with no lexicon rows and no history at all, deleted ones included, so that it can never overwrite or mix with live data. It runs from the same page, again for admins only, through `public.restore_backup()`, or from the SQL Editor.
* **A restore is exact.** Ids, codes, versions, dates, authors, statuses and the history are loaded as they were; the triggers that stamp new rows, create base forms and write history step aside for the restore alone, through a flag that no API request can set. The identity counters then continue after the highest id restored, and every restored code is registered so that it is never issued again.
* **An author with no account of the same id** is replaced by no author and counted in the restore's report. In a new project that means every author; the history still records each author's old id, and the backup maps each id to a name.
* **The file is checked twice:** by the manager before it is sent, so that a wrong file is refused at once with a clear reason, and by the database, which refuses anything that is not a complete backup of format version 1, with all nine tables, and any entry without a valid code.
* **The round trip is tested automatically:** a dictionary with every kind of row is backed up, restored into a fresh database, and backed up again; both backups and both exports must be identical.

## Consequences

* **Authorship is not carried into a new project:** entries arrive there without an author, and only the history and the backup file say who wrote them.
* A backup routine depends on an admin pressing a button, regularly, and keeping the files somewhere other than Supabase. A scheduled, automatic backup remains possible later, as a separate decision.
* Backups contain the history and the profiles, which are private to the project; the files must not be published or shared, unlike the dictionary itself.
* **Size:** through the API, Supabase stops a statement after a few seconds, so a backup that grows large is downloaded and restored from the SQL Editor instead, with `select public.export_backup();` and `select public.restore_backup('...');`. Today's dictionary is far below that limit.
* **Size, updated 2026/10/18, version 0.11.1:** the limit was reached the same day, once the friends in Genoa had entered their corpus: Supabase gives a signed-in user 8 seconds per statement. Migration 0008 gives both functions 60 seconds of their own, the most Supabase allows through the API or the Dashboard; beyond a minute, a maintainer runs the backup with `psql` over a session that lifts its own limit [db/README.md]. A backup assembled by the manager table by table, in small pages, remains the lasting answer, when a minute is no longer enough.
* Bulk imports may now be built on top of a proven restore.
