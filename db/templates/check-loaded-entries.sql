/*
 * check-loaded-entries.sql
 * Author:    Eng. José Ignacio Castro de R. and contributors
 * Date:      2026/10/19, 23:34:00, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:   2026/10/20, 00:21:40: live rows only, under live parents;
 *            every language counted, even with no translation; ","
 *            and "/" measured too.
 * Purpose:   Measure, without changing anything, the shape of entries
 *            loaded by SQL before add-entries.sql existed, so that the
 *            repairs of 0.13.0 can be sized: senses split one per
 *            translation, translations that may hold several,
 *            translations by language, rows with no author.
 * Usage:     Paste into the SQL Editor and press Run. Every query only
 *            reads. The answer is one table of measures.
 * Contract:  Rows count only when they and every parent above them are
 *            live, as in the review queue.
 */

with live_lemmas as (
    select id, created_by from public.lemmas where deleted_at is null
),
live_senses as (
    select s.id, s.lemma_id, s.definition_it
    from public.senses as s
    join live_lemmas as l on l.id = s.lemma_id
    where s.deleted_at is null
),
live_glosses as (
    select g.id, g.sense_id, g.language, g.gloss, g.status
    from public.glosses as g
    join live_senses as s on s.id = g.sense_id
    where g.deleted_at is null
),
sense_sizes as (
    select s.id, s.lemma_id, s.definition_it, count(g.id) as translations
    from live_senses as s
    left join live_glosses as g on g.sense_id = s.id
    group by s.id, s.lemma_id, s.definition_it
),
split_lemmas as (
    /* Several senses, none with a definition, each with exactly one
       translation: what a load that made a sense per translation
       leaves behind. */
    select lemma_id
    from sense_sizes
    group by lemma_id
    having count(*) > 1 and bool_and(definition_it is null) and bool_and(translations = 1)
)
select 'lemmas, live' as measure, count(*) as value
    from live_lemmas
union all
select 'lemmas whose senses look split one per translation', count(*)
    from split_lemmas
union all
select 'senses in those lemmas', count(*)
    from sense_sizes where lemma_id in (select lemma_id from split_lemmas)
union all
select 'translations holding ";" [several in one]', count(*)
    from live_glosses where gloss like '%;%'
union all
select 'translations holding "," or "/" [may be several in one]', count(*)
    from live_glosses where gloss like '%,%' or gloss like '%/%'
union all
select 'translations in ' || l.code, count(g.id)
    from public.gloss_languages as l
    left join live_glosses as g on g.language = l.code
    group by l.code
union all
select 'lemmas with no author [written as the trusted backend, or account deleted]', count(*)
    from live_lemmas where created_by is null
union all
select 'rows waiting for review', count(*)
    from (select id from public.lemmas where status = 'pending' and deleted_at is null
          union all
          select w.id from public.wordforms as w join live_lemmas as l on l.id = w.lemma_id
           where w.status = 'pending' and w.deleted_at is null and not w.is_base
          union all
          select s.id from public.senses as s join live_lemmas as l on l.id = s.lemma_id
           where s.status = 'pending' and s.deleted_at is null
          union all
          select id from live_glosses where status = 'pending') as pending;
