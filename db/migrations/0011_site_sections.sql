/*
 * 0011_site_sections.sql
 * Author:    Eng. José Ignacio Castro de R. and contributors
 * Date:      2026/10/20, 01:42:15, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:   What the site's new structure needs from the database,
 *            released as 0.13.0 [decision 0035]:
 *              dictionary_stats[]   the size of the published
 *                                   dictionary, shown on every page;
 *              dictionary_lookup[]  published entries found by their
 *                                   Ligurian spelling, typed with or
 *                                   without accents, for the dictionary;
 *              people_activity[]    how many changes each person made,
 *                                   for the Users section;
 *              user_history[]       every change one person made, newest
 *                                   first, in pages;
 *              user_summary[]       those changes counted by kind.
 *            One index on the history, by person.
 * Contract:  Run once, after 0001 to 0010. Nothing in the data changes.
 *            The functions run with their owner's rights, so that row
 *            level security cannot keep them from their indexes, and
 *            decide themselves what each caller sees:
 *              the dictionary's two are open to everyone and show
 *              published rows only;
 *              the history's three show reviewers and admins anyone's
 *              changes, the changes written from the SQL Editor
 *              included [asked for with a null person], and anyone else
 *              their own changes only. A visitor without an account is
 *              refused.
 * Decision:  docs/decisions/0035-site-in-five-sections.md
 */

create index audit_log_actor on public.audit_log (actor, id desc);

/* ====================================================================
   dictionary_stats: lemmas, forms and translations published.
   ==================================================================== */

create function public.dictionary_stats()
returns table (lemmas bigint, forms bigint, translations bigint)
language sql
stable
security definer
set search_path = ''
as $$
    with published as (
        select l.id from public.lemmas as l
        where l.status = 'approved' and l.deleted_at is null
    )
    select
        (select count(*) from published),
        (select count(*) from public.wordforms as w
          where w.status = 'approved' and w.deleted_at is null
            and w.lemma_id in (select id from published)),
        (select count(*) from public.glosses as g
           join public.senses as s on s.id = g.sense_id
          where g.status = 'approved' and g.deleted_at is null
            and s.status = 'approved' and s.deleted_at is null
            and s.lemma_id in (select id from published));
$$;

/* ====================================================================
   dictionary_lookup: published entries whose headword or one of whose
   forms begins with the query, compared by search key, so that zena,
   Zena and Zêna all find Zêna. Exact matches first, so that a whole
   word typed is never pushed out by longer words that begin with it:
   rank 0, the headword is the query; 1, a form is the query; 2, the
   headword begins with it; 3, a form begins with it. One row per
   entry, its best match, at most 100,
   each with its published translations. A query whose key is empty
   finds nothing. Dynamic SQL with the key as a literal, so that the
   prefix can use the search key indexes of 0004.
   ==================================================================== */

create function public.dictionary_lookup(p_query text, p_limit integer default 50)
returns table (
    id bigint, public_id text, headword text, part_of_speech text,
    matched_form text, rank integer, glosses jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_key    text := regexp_replace(private.skeleton(left(coalesce(p_query, ''), 64)), '[^a-z'']', '', 'g');
    v_limit  integer := greatest(1, least(coalesce(p_limit, 50), 100));
begin
    if v_key = '' then
        return;
    end if;
    return query execute format($sql$
        with matches as (
            select l.id, null::text as matched_form,
                   case when l.headword_key = %1$L then 0 else 2 end as rank
            from public.lemmas as l
            where l.headword_key like %2$L
              and l.status = 'approved' and l.deleted_at is null
            union all
            select w.lemma_id, w.form::text,
                   case when w.form_key = %1$L then 1 else 3 end
            from public.wordforms as w
            where w.form_key like %2$L and not w.is_base
              and w.status = 'approved' and w.deleted_at is null
        ),
        best as (
            select distinct on (m.id) m.id, m.matched_form, m.rank
            from matches as m
            join public.lemmas as l
              on l.id = m.id and l.status = 'approved' and l.deleted_at is null
            order by m.id, m.rank, m.matched_form
        )
        select l.id, l.public_id, l.headword::text, l.part_of_speech::text,
               b.matched_form, b.rank, private.published_glosses(l.id)
        from best as b
        join public.lemmas as l on l.id = b.id
        order by b.rank, l.headword_key, l.id
        limit %3$s
    $sql$, v_key, private.like_literal(v_key) || '%', v_limit);
end;
$$;

/* ====================================================================
   Who may read whose history: staff anyone's, the trusted backend
   anyone's, everyone else their own. A null person means the changes
   written with no user, from the SQL Editor; only staff see those.
   ==================================================================== */

create function private.may_read_history(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select not private.is_anonymous_client()
       and (
            (auth.uid() is null)
            or private.is_staff()
            or (p_user is not null and p_user = auth.uid())
       );
$$;

/* ====================================================================
   people_activity: every person with at least one change, and the
   changes written with no user [user_id null], with how many changes
   and when the last one was. Staff and the trusted backend only.
   ==================================================================== */

create function public.people_activity()
returns table (user_id uuid, display_name text, changes bigint, last_change timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if private.is_anonymous_client() or (auth.uid() is not null and not private.is_staff()) then
        raise exception 'only reviewers and admins may see everyone''s activity' using errcode = '42501';
    end if;
    return query
    select a.actor, p.display_name, count(*), max(a.at)
    from public.audit_log as a
    left join public.profiles as p on p.user_id = a.actor
    group by a.actor, p.display_name
    order by max(a.at) desc;
end;
$$;

/* ====================================================================
   user_history: one person's changes, newest first, at most 200 a
   page; p_before is the id of the last change already shown, null for
   the first page. Each change names its table, row, action and time,
   what was changed [a headword, a form, a definition, a translation],
   its review status after the change, and the lemma it belongs to, so
   that a page can link to the entry.
   ==================================================================== */

create function public.user_history(p_user uuid, p_before bigint default null, p_limit integer default 100)
returns table (
    id bigint, table_name text, row_id bigint, action text, at timestamptz,
    label text, status text, lemma_id bigint, changed text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if not private.may_read_history(p_user) then
        raise exception 'you may read only your own history' using errcode = '42501';
    end if;
    /* Dynamic SQL, so that each call is planned for its own person:
       a null person, the SQL Editor's changes, must be found as "is
       null", which the index serves too. */
    return query execute format($sql$
        select a.id, a.table_name, a.row_id, a.action, a.at,
               coalesce(x.r ->> 'headword', x.r ->> 'form', x.r ->> 'gloss', x.r ->> 'definition_it',
                        case when a.table_name = 'senses' then 'sense ' || (x.r ->> 'sense_number') end),
               x.r ->> 'status',
               case a.table_name
                   when 'lemmas' then a.row_id
                   when 'glosses' then (select s.lemma_id from public.senses as s where s.id = (x.r ->> 'sense_id')::bigint)
                   else (x.r ->> 'lemma_id')::bigint
               end,
               case when a.action = 'update' then
                   array(select k from jsonb_object_keys(a.new_row) as k
                         where a.new_row -> k is distinct from a.old_row -> k
                           and k not in ('version', 'updated_at')
                         order by k)
               end
        from public.audit_log as a,
             lateral (select coalesce(a.new_row, a.old_row) as r) as x
        where %1$s and (%2$L::bigint is null or a.id < %2$L::bigint)
        order by a.actor, a.id desc
        limit %3$s
    $sql$,
        case when p_user is null then 'a.actor is null' else format('a.actor = %L::uuid', p_user) end,
        p_before,
        greatest(1, least(coalesce(p_limit, 100), 200)));
end;
$$;

/* ====================================================================
   user_summary: one person's changes counted by table and action, with
   the first and last time.
   ==================================================================== */

create function public.user_summary(p_user uuid)
returns table (table_name text, action text, changes bigint, first_change timestamptz, last_change timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if not private.may_read_history(p_user) then
        raise exception 'you may read only your own history' using errcode = '42501';
    end if;
    return query execute format($sql$
        select a.table_name, a.action, count(*), min(a.at), max(a.at)
        from public.audit_log as a
        where %1$s
        group by a.table_name, a.action
        order by a.table_name, a.action
    $sql$, case when p_user is null then 'a.actor is null' else format('a.actor = %L::uuid', p_user) end);
end;
$$;

revoke all on function private.may_read_history(uuid) from public, anon, authenticated;
revoke all on function public.dictionary_stats() from public, anon, authenticated;
revoke all on function public.dictionary_lookup(text, integer) from public, anon, authenticated;
revoke all on function public.people_activity() from public, anon, authenticated;
revoke all on function public.user_history(uuid, bigint, integer) from public, anon, authenticated;
revoke all on function public.user_summary(uuid) from public, anon, authenticated;
grant execute on function public.dictionary_stats() to anon, authenticated;
grant execute on function public.dictionary_lookup(text, integer) to anon, authenticated;
grant execute on function public.people_activity() to authenticated;
grant execute on function public.user_history(uuid, bigint, integer) to authenticated;
grant execute on function public.user_summary(uuid) to authenticated;
