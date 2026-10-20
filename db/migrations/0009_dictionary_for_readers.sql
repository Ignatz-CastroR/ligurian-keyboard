/*
 * 0009_dictionary_for_readers.sql
 * Author:    Eng. José Ignacio Castro de R. and contributors
 * Date:      2026/10/18, 17:31:44, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:   The reading side of the dictionary, released as 0.12.0
 *            [decision 0034]: four functions for the public section
 *            /dizionario/, open to everyone without an account:
 *              dictionary_letters[]   the initials of the index, with
 *                                     how many entries each has;
 *              dictionary_index[]     the entries of one initial, in
 *                                     pages, each with its translations;
 *              dictionary_search[]    entries found by a translation in
 *                                     Italian, Spanish or English;
 *              dictionary_entry[]     one entry by its public code.
 * Contract:  Run once, after 0001 to 0008. Nothing in the existing data
 *            changes and no column is added, so backups and restores are
 *            unaffected. It installs the pg_trgm extension, which
 *            Supabase provides, if it is not installed yet, and builds
 *            three indexes; on a large dictionary that takes seconds.
 *            Every function returns published rows only, whoever calls
 *            it: an approved, live lemma; its approved, live senses and
 *            forms; their approved, live translations. The four public
 *            functions run with their owner's rights [security
 *            definer], so that row level security, whose policies call
 *            functions the planner cannot see through, does not stop
 *            the indexes being used; the filters of publication are
 *            therefore written out in full in each of them, and a
 *            reviewer signed in sees exactly what a visitor sees.
 *            The folding never relies on the database's locale: marks
 *            are removed before lower case is taken, and æ, œ and ç are
 *            named explicitly.
 * Decision:  docs/decisions/0034-dictionary-for-readers.md
 */

/* ====================================================================
   pg_trgm, for the search by the start of any word of a translation.
   Supabase keeps extensions in the schema "extensions"; an existing
   installation elsewhere is used where it is.
   ==================================================================== */

create extension if not exists pg_trgm with schema extensions;

/* ====================================================================
   The initial of a headword in the index: accented vowels under their
   base letter [à, â, ä under a], æ and ç as letters of their own, ñ
   under n as the search keys fold it, and anything that is not a
   letter, such as an initial apostrophe, under "#". Upper and lower
   case alike, in any locale.
   ==================================================================== */

create function private.index_initial(p_headword text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
    select case
        when s.c in ('æ', 'Æ') then 'æ'
        when s.c in ('ç', 'Ç') then 'ç'
        when left(private.skeleton(s.c), 1) ~ '^[a-z]$' then left(private.skeleton(s.c), 1)
        else '#'
    end
    from (select left(normalize(p_headword, NFC), 1) as c) as s;
$$;

/* ====================================================================
   The form in which a translation is searched, and the query compared
   with it: accents and diacritics removed, then lower case [canción,
   cancion and CANCIÓN all give cancion]; æ and œ written out; every
   punctuation mark, apostrophes and brackets included, made a space,
   so that dell'acqua, agua [potable] and water-bottle have the words
   acqua, potable and bottle; spaces collapsed.
   ==================================================================== */

create function private.search_text(p_text text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
    select btrim(regexp_replace(
        lower(replace(replace(replace(replace(
            regexp_replace(normalize(p_text, NFD), '[̀-ͯ]', '', 'g'),
            'Æ', 'ae'), 'æ', 'ae'), 'Œ', 'oe'), 'œ', 'oe')),
        '[[:space:][:punct:]«»“”„‘’‚ʼ¡¿–—…·]+', ' ', 'g'));
$$;

/* What is indexed and compared: the folded translation, cut at 200
   characters so that no translation, however long, can exceed the
   size an index entry may have. */
create function private.search_key(p_text text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
    select left(private.search_text(p_text), 200);
$$;

/* LIKE treats % and _ as wildcards: a query must match them literally.
   search_text[] already turns them into spaces; this is the second
   lock. */
create function private.like_literal(p_text text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
    select replace(replace(replace(p_text, '\', '\\'), '%', '\%'), '_', '\_');
$$;

revoke all on function private.index_initial(text) from public, anon, authenticated;
revoke all on function private.search_text(text) from public, anon, authenticated;
revoke all on function private.search_key(text) from public, anon, authenticated;
revoke all on function private.like_literal(text) from public, anon, authenticated;

/* Pure functions over text. Everyone who writes a lemma or a
   translation evaluates them, because the indexes below are built on
   them, and PostgreSQL checks the right to call them as the writer. */
grant execute on function private.index_initial(text) to anon, authenticated;
grant execute on function private.search_text(text) to anon, authenticated;
grant execute on function private.search_key(text) to anon, authenticated;
grant execute on function private.like_literal(text) to anon, authenticated;

/* ====================================================================
   Indexes. The index's letters and pages read only published lemmas,
   so their index holds only those. The search reads translations by
   the start of their folded text [btree] or by the start of any word
   in it [trigrams].
   ==================================================================== */

create index lemmas_index_initial
    on public.lemmas (private.index_initial(headword), headword_key, id)
    where status = 'approved' and deleted_at is null;

/* The btree uses the C collation, byte order, in which a prefix LIKE
   is a range and ORDER BY can follow the index, whatever the
   database's own collation is. */
create index glosses_search_key
    on public.glosses ((private.search_key(gloss) collate "C"), id)
    where status = 'approved' and deleted_at is null;

do $$
declare
    v_schema text;
begin
    select n.nspname into v_schema
    from pg_extension as e join pg_namespace as n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm';
    execute format(
        'create index glosses_search_trigrams on public.glosses
           using gin (private.search_key(gloss) %I.gin_trgm_ops)
           where status = ''approved'' and deleted_at is null',
        v_schema);
end;
$$;

/* ====================================================================
   The translations of one published lemma, as JSON, ordered by sense
   and language: [{"sense_number", "definition_it", "language",
   "gloss"}]. A published sense without translations appears once, with
   language and gloss null. Nothing, when the lemma is not published.
   ==================================================================== */

create function private.published_glosses(p_lemma_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(jsonb_agg(jsonb_build_object(
               'sense_number', s.sense_number,
               'definition_it', s.definition_it,
               'language', g.language,
               'gloss', g.gloss)
           order by s.sense_number, g.language, g.gloss), '[]'::jsonb)
    from public.lemmas as l
    join public.senses as s
      on s.lemma_id = l.id and s.status = 'approved' and s.deleted_at is null
    left join public.glosses as g
      on g.sense_id = s.id and g.status = 'approved' and g.deleted_at is null
    where l.id = p_lemma_id and l.status = 'approved' and l.deleted_at is null;
$$;

revoke all on function private.published_glosses(bigint) from public, anon, authenticated;

/* ====================================================================
   dictionary_letters: every initial with at least one published entry.
   The order of the letters is the page's to decide [æ after a, ç after
   c]; this returns them by initial.
   ==================================================================== */

create function public.dictionary_letters()
returns table (initial text, entries bigint)
language sql
stable
security definer
set search_path = ''
as $$
    select private.index_initial(l.headword), count(*)
    from public.lemmas as l
    where l.status = 'approved' and l.deleted_at is null
    group by private.index_initial(l.headword)
    order by 1;
$$;

/* ====================================================================
   dictionary_index: the published entries of one initial, ordered by
   headword_key, then id, in pages of at most 200. The next page starts
   after the last entry received: p_after_key and p_after_id are its
   headword_key and id, both null for the first page. A key given
   without an id starts after every entry with that key.
   ==================================================================== */

create function public.dictionary_index(
    p_initial text,
    p_after_key text default null,
    p_after_id bigint default null,
    p_limit integer default 100)
returns table (
    id bigint, public_id text, headword text, headword_key text,
    part_of_speech text, variety text, orthography text, glosses jsonb)
language sql
stable
security definer
set search_path = ''
as $$
    select l.id, l.public_id, l.headword::text, l.headword_key, l.part_of_speech::text,
           l.variety, l.orthography, private.published_glosses(l.id)
    from public.lemmas as l
    where private.index_initial(l.headword) = p_initial
      and l.status = 'approved' and l.deleted_at is null
      and (p_after_key is null
           or (l.headword_key, l.id) > (p_after_key, coalesce(p_after_id, 9223372036854775807)))
    order by l.headword_key, l.id
    limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;

/* ====================================================================
   dictionary_search: published entries whose translation matches the
   query, in one language or in all [p_language null]. A translation
   matches when it equals the query [rank 0], begins with it [rank 1],
   or has a later word that begins with it [rank 2], all compared through
   search_key[]. The query is cut at 100 characters and folded once. A
   query of one or two characters looks for the start of translations
   only, through the btree index; from three characters on, the
   trigram index also finds the start of any word. One row per
   matching translation, at most 200; the page groups them by entry. A
   query that is empty after folding finds nothing.
   ==================================================================== */

create function public.dictionary_search(
    p_query text,
    p_language text default null,
    p_limit integer default 100)
returns table (
    id bigint, public_id text, headword text, headword_key text,
    part_of_speech text, sense_number integer, definition_it text,
    language text, gloss text, rank integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_query  text := private.search_text(left(coalesce(p_query, ''), 100));
    v_like   text;
    v_limit  integer := greatest(1, least(coalesce(p_limit, 100), 200));
    v_found  integer;
begin
    if v_query = '' then
        return;
    end if;
    v_like := private.like_literal(v_query);

    /* Two steps, each stopping at the limit, so that a common word
       matching tens of thousands of translations costs no more than a
       rare one. Each runs as dynamic SQL with the query as literals,
       planned with its own pattern: a prefix held in a parameter could
       not use the btree index. format[] quotes every value.
       First, translations that begin with the query, in the order of
       the btree index, which puts an exact match before longer ones:
       rank 0 for an exact match, 1 for a start. */
    return query execute format($sql$
        select l.id, l.public_id, l.headword::text, l.headword_key, l.part_of_speech::text,
               s.sense_number, s.definition_it, g.language, g.gloss,
               case when private.search_key(g.gloss) = %3$L then 0 else 1 end
        from public.glosses as g
        join public.senses as s
          on s.id = g.sense_id and s.status = 'approved' and s.deleted_at is null
        join public.lemmas as l
          on l.id = s.lemma_id and l.status = 'approved' and l.deleted_at is null
        where g.status = 'approved' and g.deleted_at is null
          and (%1$L::text is null or g.language = %1$L::text)
          and (private.search_key(g.gloss) collate "C") like %2$L
        order by (private.search_key(g.gloss) collate "C"), g.id
        limit %4$s
    $sql$, p_language, v_like || '%', v_query, v_limit);
    get diagnostics v_found = row_count;

    /* Then, from three characters on and while the limit allows, those
       with a later word that begins with it [rank 2], found through the
       trigram index and returned by translation. */
    if length(v_query) >= 3 and v_found < v_limit then
        return query execute format($sql$
            select m.id, m.public_id, m.headword, m.headword_key, m.part_of_speech,
                   m.sense_number, m.definition_it, m.language, m.gloss, m.rank
            from (
                select l.id, l.public_id, l.headword::text, l.headword_key, l.part_of_speech::text,
                       s.sense_number, s.definition_it, g.language, g.gloss, 2,
                       private.search_key(g.gloss) as key
                from public.glosses as g
                join public.senses as s
                  on s.id = g.sense_id and s.status = 'approved' and s.deleted_at is null
                join public.lemmas as l
                  on l.id = s.lemma_id and l.status = 'approved' and l.deleted_at is null
                where g.status = 'approved' and g.deleted_at is null
                  and (%1$L::text is null or g.language = %1$L::text)
                  and private.search_key(g.gloss) like %2$L
                  and private.search_key(g.gloss) like %3$L
                  and private.search_key(g.gloss) not like %4$L
                limit %5$s
            ) as m (id, public_id, headword, headword_key, part_of_speech,
                    sense_number, definition_it, language, gloss, rank, key)
            order by m.key, m.headword_key, m.id, m.sense_number
        $sql$, p_language, '%' || v_like || '%', '% ' || v_like || '%', v_like || '%', v_limit - v_found);
    end if;
end;
$$;

/* ====================================================================
   dictionary_entry: one published entry by the public code of its
   lemma or of one of its forms, as JSON: the lemma, its published
   forms, base form first, and its published senses with their
   translations. Null when no published entry has that code.
   ==================================================================== */

create function public.dictionary_entry(p_public_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    with target as (
        select l.*
        from public.lemmas as l
        where l.status = 'approved' and l.deleted_at is null
          and (l.public_id = p_public_id
               or l.id = (select w.lemma_id from public.wordforms as w
                          where w.public_id = p_public_id
                            and w.status = 'approved' and w.deleted_at is null))
        limit 1
    )
    select jsonb_build_object(
        'id', t.id,
        'public_id', t.public_id,
        'headword', t.headword,
        'part_of_speech', t.part_of_speech,
        'variety', t.variety,
        'orthography', t.orthography,
        'note', t.note,
        'forms', (
            select coalesce(jsonb_agg(jsonb_build_object(
                       'form', w.form, 'public_id', w.public_id,
                       'grammatical_tag', w.grammatical_tag, 'is_base', w.is_base)
                   order by w.is_base desc, w.form), '[]'::jsonb)
            from public.wordforms as w
            where w.lemma_id = t.id and w.status = 'approved' and w.deleted_at is null),
        'glosses', private.published_glosses(t.id))
    from target as t;
$$;

revoke all on function public.dictionary_letters() from public, anon, authenticated;
revoke all on function public.dictionary_index(text, text, bigint, integer) from public, anon, authenticated;
revoke all on function public.dictionary_search(text, text, integer) from public, anon, authenticated;
revoke all on function public.dictionary_entry(text) from public, anon, authenticated;
grant execute on function public.dictionary_letters() to anon, authenticated;
grant execute on function public.dictionary_index(text, text, bigint, integer) to anon, authenticated;
grant execute on function public.dictionary_search(text, text, integer) to anon, authenticated;
grant execute on function public.dictionary_entry(text) to anon, authenticated;
