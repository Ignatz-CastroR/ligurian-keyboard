/*
 * 0008_backup_time_limit.sql
 * Author:    Eng. José Ignacio Castro de R. and contributors
 * Date:      2026/10/18, 16:10:37, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:   Give a backup and a restore up to 60 seconds through the
 *            API, released as 0.11.1. Supabase stops every statement of
 *            a signed-in user after 8 seconds; once the friends in Genoa
 *            had entered their corpus, export_backup[] needed more and
 *            the lexicon manager's backup button failed with "canceling
 *            statement due to statement timeout".
 * Contract:  Run once, after 0001 to 0007. It changes no data and no
 *            rule: only the time limit of these two functions. Inside
 *            PostgreSQL alone, a function's own statement_timeout cannot
 *            lengthen the statement already running; it works because
 *            PostgREST, Supabase's API, reads the setting and applies it
 *            to the whole request before calling the function, as
 *            Supabase documents for functions called through its client
 *            libraries. 60 seconds is the highest limit Supabase allows
 *            for such calls. The SQL Editor is not bound by it, and
 *            remains the way for a dictionary too large for a minute
 *            [db/README.md].
 * Decision:  docs/decisions/0031-backups.md
 */

alter function public.export_backup() set statement_timeout = '60s';
alter function public.restore_backup(jsonb) set statement_timeout = '60s';
