/*
 * split-semicolon-glosses.sql
 * Author:    Eng. José Ignacio Castro de R. and contributors
 * Date:      2026/10/20, 23:49:34, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:   2026/10/21, 10:04:43: lemmas on the list of senses to review
 *            are no longer skipped [migration 0012, as revised].
 * Purpose:   Split the translations that hold ";" into one translation
 *            each, from the Supabase SQL Editor, with
 *            split_semicolon_glosses[] of migration 0012: each piece in
 *            the same sense, with the same language and status; the
 *            original soft deleted.
 * Usage:     1. Copy this whole file into a new query and press Run, with
 *               nothing selected. It is a dry run: it lists every such
 *               translation, its pieces and what would be done, and
 *               changes nothing. The last row counts them.
 *            2. Read the list. If it is right, change false to true in
 *               the line marked below and press Run again.
 * Contract:  The SQL Editor runs as the trusted backend: the pieces have
 *            no author, like the rows they come from, and the history
 *            records every change. All or nothing: one run is one
 *            transaction. A lemma on the list of senses to review stays
 *            on it: its reviewer then sees the pieces as translations of
 *            one sense. A translation that is nothing but separators is
 *            listed as skipped.
 */

with report as (
    select public.split_semicolon_glosses(false) as r    /* false: dry run; true: apply */
)
select g.item ->> 'headword'             as headword,
       g.item ->> 'public_id'            as code,
       (g.item ->> 'sense_number')::int  as sense,
       g.item ->> 'language'             as language,
       g.item ->> 'gloss'                as translation,
       g.item -> 'pieces'                as pieces,
       g.item ->> 'action'               as action,
       g.item ->> 'reason'               as reason
from report, jsonb_array_elements(report.r -> 'glosses') as g(item)
union all
select 'TOTAL', null, null, null, null, null,
       case when (report.r ->> 'applied')::boolean then 'applied' else 'dry run' end,
       format('to split: %s; skipped: %s; pieces added: %s; pieces already there: %s',
              report.r ->> 'split', report.r ->> 'skipped', report.r ->> 'inserted', report.r ->> 'already_present')
from report;
