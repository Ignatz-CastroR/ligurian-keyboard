/*
 * 0010_review_queue_pages.sql
 * Author:    Eng. José Ignacio Castro de R. and contributors
 * Date:      2026/10/19, 23:22:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:   The review queue in pages, released as 0.12.1. After a load
 *            of thousands of entries by SQL, the lexicon manager's queue
 *            no longer opened: the view review_queue runs under row
 *            level security, which makes the database check every row of
 *            every table, approved ones included, before it reaches the
 *            pending ones, and the page asked for the whole queue at
 *            once.
 *              review_queue_page[]  the next entries, oldest first, 50
 *                                   a page, one row per entry, with its
 *                                   position and the totals.
 *            Four partial indexes hold only the pending rows. The cost of
 *            a page grows with the number of pending rows, not with the
 *            size of the dictionary: measured in the test engine, about
 *            40 ms with 9,000 pending rows, 0.3 s with 90,000 and 1.2 s
 *            with 300,000, against 0.8 s, 8 s and 29 s for the view.
 * Contract:  Run once, after 0001 to 0009. Nothing in the data changes;
 *            the view review_queue stays as it was, for any client still
 *            using it.
 *            The functions run with their owner's rights, so that row
 *            level security cannot keep them from the indexes. They
 *            therefore decide themselves what each caller sees:
 *            reviewers, admins and the trusted backend see every pending
 *            row; anyone else sees only the pending rows they wrote; an
 *            anonymous visitor sees nothing. A lemma or sense above such
 *            a row is shown only when the caller could read it
 *            themselves [approved and published, or their own]. One
 *            difference from the view, which shows less, not more: for a
 *            translation under a sense the caller cannot read, the view
 *            also hid the lemma, which the caller could read directly;
 *            the function shows it.
 * Decision:  docs/decisions/0033-batch-review.md
 */

/* ====================================================================
   The pending rows, and nothing else, in four small indexes.
   ==================================================================== */

create index lemmas_pending
    on public.lemmas (created_at, id)
    where status = 'pending' and deleted_at is null;

create index wordforms_pending
    on public.wordforms (lemma_id)
    where status = 'pending' and deleted_at is null and not is_base;

create index senses_pending
    on public.senses (lemma_id)
    where status = 'pending' and deleted_at is null;

create index glosses_pending
    on public.glosses (sense_id)
    where status = 'pending' and deleted_at is null;

/* ====================================================================
   Every pending row the caller may review or follow, with its entry,
   and what of its parents the caller may see. Rows of a deleted lemma
   or sense are left out, as in the view since 0007. Internal: called
   only by the two public functions below.
   ==================================================================== */

create function private.review_pending()
returns table (
    kind text, id bigint, lemma_id bigint, text text, created_by uuid, created_at timestamptz,
    version integer, lemma_headword text, lemma_status public.review_status, lemma_public_id text,
    sense_id bigint, sense_number integer, definition_it text, language text, gloss text)
language sql
stable
security definer
set search_path = ''
as $$
    with viewer as (
        select auth.uid() as uid,
               (auth.uid() is null and not private.is_anonymous_client()) or private.is_staff() as everything,
               private.is_anonymous_client() as anonymous
    ),
    rows as (
        select 'lemma'::text as kind, l.id, l.id as lemma_id, l.headword::text as text,
               l.created_by, l.created_at, l.version,
               l.headword::text as lemma_headword, l.status as lemma_status, l.public_id as lemma_public_id,
               true as lemma_visible,
               null::bigint as sense_id, null::integer as sense_number, null::text as definition_it,
               false as sense_visible,
               null::text as language, null::text as gloss
        from public.lemmas as l
        where l.status = 'pending' and l.deleted_at is null
        union all
        select 'wordform', w.id, w.lemma_id, w.form::text, w.created_by, w.created_at, w.version,
               l.headword::text, l.status, l.public_id,
               l.status = 'approved' or l.created_by = (select uid from viewer),
               null, null, null, false, null, null
        from public.wordforms as w
        join public.lemmas as l on l.id = w.lemma_id and l.deleted_at is null
        where w.status = 'pending' and w.deleted_at is null and not w.is_base
        union all
        select 'sense', s.id, s.lemma_id, s.sense_number || '. ' || coalesce(s.definition_it, ''),
               s.created_by, s.created_at, s.version,
               l.headword::text, l.status, l.public_id,
               l.status = 'approved' or l.created_by = (select uid from viewer),
               s.id, s.sense_number, s.definition_it, true, null, null
        from public.senses as s
        join public.lemmas as l on l.id = s.lemma_id and l.deleted_at is null
        where s.status = 'pending' and s.deleted_at is null
        union all
        select 'gloss', g.id, s.lemma_id, g.language || ': ' || g.gloss,
               g.created_by, g.created_at, g.version,
               l.headword::text, l.status, l.public_id,
               l.status = 'approved' or l.created_by = (select uid from viewer),
               g.sense_id, s.sense_number, s.definition_it,
               (s.status = 'approved' and l.status = 'approved') or s.created_by = (select uid from viewer),
               g.language, g.gloss
        from public.glosses as g
        join public.senses as s on s.id = g.sense_id and s.deleted_at is null
        join public.lemmas as l on l.id = s.lemma_id and l.deleted_at is null
        where g.status = 'pending' and g.deleted_at is null
    )
    select r.kind, r.id, r.lemma_id, r.text, r.created_by, r.created_at, r.version,
           case when v.everything or r.lemma_visible then r.lemma_headword end,
           case when v.everything or r.lemma_visible then r.lemma_status end,
           case when v.everything or r.lemma_visible then r.lemma_public_id end,
           r.sense_id,
           case when v.everything or r.sense_visible then r.sense_number end,
           case when v.everything or r.sense_visible then r.definition_it end,
           r.language, r.gloss
    from rows as r, viewer as v
    where not v.anonymous
      and (v.everything or (v.uid is not null and r.created_by = v.uid));
$$;

revoke all on function private.review_pending() from public, anon, authenticated;

/* ====================================================================
   review_queue_page: the next entries of the queue, one row per entry,
   so that no API limit on rows can ever cut an entry in two: each row
   holds the entry's pending rows as a JSON array, oldest first.
   An entry is a lemma with its pending rows; entries come oldest first,
   by the time of their oldest pending row, then by lemma id.
   p_after_created and p_after_lemma are the group_created and lemma_id
   of the last entry already shown, both null for the first page. At
   most 200 entries a page; 50 by default.
   Every row also carries, counted in the same snapshot, the entry's
   entry_number, its position in the whole queue [from 1], and how many
   entries and rows wait in all: the page needs nothing else to label
   itself.
   Paging is by key, not by number: while others review, an entry
   approved in part may appear again further on, and one whose oldest
   pending row moves earlier is reached again from the first page.
   ==================================================================== */

create function public.review_queue_page(
    p_after_created timestamptz default null,
    p_after_lemma bigint default null,
    p_entries integer default 50)
returns table (
    lemma_id bigint, group_created timestamptz, entry_number bigint,
    total_entries bigint, total_items bigint, items jsonb)
language sql
stable
security definer
set search_path = ''
as $$
    with pending as (
        select * from private.review_pending()
    ),
    entries as (
        select p.lemma_id, min(p.created_at) as group_created, count(*) as rows
        from pending as p
        group by p.lemma_id
    ),
    ranked as (
        select e.lemma_id, e.group_created,
               row_number() over (order by e.group_created, e.lemma_id) as entry_number,
               count(*) over () as total_entries,
               sum(e.rows) over () as total_items
        from entries as e
    ),
    chosen as (
        select r.*
        from ranked as r
        where p_after_created is null
           or (r.group_created, r.lemma_id) > (p_after_created, coalesce(p_after_lemma, 0))
        order by r.group_created, r.lemma_id
        limit greatest(1, least(coalesce(p_entries, 50), 200))
    )
    select c.lemma_id, c.group_created, c.entry_number, c.total_entries, c.total_items::bigint,
           (select jsonb_agg(to_jsonb(p) order by p.created_at, p.kind, p.id)
            from pending as p
            where p.lemma_id = c.lemma_id)
    from chosen as c
    order by c.group_created, c.lemma_id;
$$;

revoke all on function public.review_queue_page(timestamptz, bigint, integer) from public, anon, authenticated;
grant execute on function public.review_queue_page(timestamptz, bigint, integer) to authenticated;
