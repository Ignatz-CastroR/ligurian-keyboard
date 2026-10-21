/*
 * 0012_sense_repairs.sql
 * Author:    Eng. José Ignacio Castro de R. and contributors
 * Date:      2026/10/20, 23:02:55, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:   2026/10/21, 10:04:43: after an independent review, before
 *            any release: the list frozen when this migration runs; the
 *            lemma's own version in what was seen; a change made
 *            meanwhile always a conflict; the best reviewed duplicate
 *            kept; temporary numbers above every number in use; a lemma
 *            with no sense left closed with no group; the split no longer
 *            skipping lemmas on the list, its pieces normalized, its dry
 *            run counting the same; the parent locked by the insert
 *            trigger; a token without a user a client for the new rules.
 * Updated:   2026/10/21, 10:57:43: after a second review: a translation's
 *            insert locks the lemma before the sense, as a regrouping
 *            does, so the two never wait for each other; a regrouping
 *            locks the translations it reads; the split's dry run counts a
 *            piece already added by the same run as there, as the real
 *            run does, and trims every kind of space.
 * Purpose:   The repairs of the entries loaded by SQL before 0.12.1,
 *            released as 0.15.0 [decision 0038]. Those loads made one
 *            sense per translation; a speaker's judgement of a sample
 *            showed that no default regrouping fits them, so every lemma
 *            is reviewed by a person, one at a time:
 *              lemmas.senses_review_needed  the lemmas left in that shape
 *                                           when this migration runs: the
 *                                           work list, frozen, so that no
 *                                           later edit adds or drops one;
 *              lemmas.senses_reviewed_at    when a reviewer last confirmed
 *                                           how the lemma's translations
 *                                           are grouped into senses;
 *              sense_review_queue[]         the lemmas on the list not yet
 *                                           reviewed, in pages, fewest
 *                                           senses first;
 *              regroup_senses[]             a reviewer's grouping applied
 *                                           in one transaction, and the
 *                                           lemma marked reviewed;
 *              split_semicolon_glosses[]    translations holding ";" split
 *                                           into one row each, after a
 *                                           dry run.
 *            restore_backup[] is replaced, so that a restore keeps both
 *            columns; a backup made before 0.15.0 restores with no review
 *            date, and its list is drawn again from the entries' shape.
 *            The insert trigger of the lexicon tables now locks the parent
 *            it checks, so that a translation can never be added to a
 *            sense that a regrouping or an admin is deleting at the same
 *            moment.
 * Contract:  Run once, after 0001 to 0011, BEFORE pushing the code of
 *            0.15.0: its lexicon manager calls the new functions. Download
 *            a backup first. The only data it changes: every lemma on the
 *            list gets senses_review_needed, by an ordinary update that
 *            raises its version by one and writes a line of history, as
 *            0006 did for the public codes.
 *            Run the whole file at once, as the SQL Editor does: it is
 *            then one transaction, and a failure leaves nothing behind.
 *            Reviewers may not soft delete [0002]. Regrouping must soft
 *            delete the senses and translations it replaces, so
 *            regroup_senses[] raises a flag for its own transaction, as
 *            restore_backup[] does in 0006, and under that flag the update
 *            trigger lets a reviewer soft delete senses and translations,
 *            never restore them, and nothing else. No API request can set
 *            the flag; it counts only for staff and the trusted backend.
 * Decision:  docs/decisions/0038-senses-reviewed-one-by-one.md
 */

/* ====================================================================
   The work list and its progress. senses_review_needed: the lemma was
   left split one sense per translation, and waits for a person to group
   its senses; set below, once, for the lemmas in that shape today, and
   afterwards only by the trusted backend or a restore. A list drawn
   from the entries' shape at every reading would lose a lemma as soon
   as anyone added a translation or a definition to it, and would gain
   every new entry of that shape. senses_reviewed_at: when a reviewer
   last confirmed the grouping; null, never. Set by the database's
   clock, whatever time a client sends.
   ==================================================================== */

alter table public.lemmas add column senses_review_needed boolean not null default false;
alter table public.lemmas add column senses_reviewed_at timestamptz;

create index lemmas_senses_review_waiting on public.lemmas (id)
    where senses_review_needed and senses_reviewed_at is null and deleted_at is null;

/* ====================================================================
   The regrouping flag: true only inside regroup_senses[], which sets
   it for its own transaction. As with private.restoring[] in 0006, the
   API exposes no function that calls set_config[] or runs SQL, and the
   flag counts only for staff and the trusted backend.
   ==================================================================== */

create function private.regrouping()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(current_setting('ligurian.regrouping', true), '') = 'on'
       and (auth.uid() is null or private.is_staff());
$$;

/* ====================================================================
   0002's update trigger, unchanged but for two things. Under the
   regrouping flag a reviewer may soft delete a sense or a translation;
   restoring stays an admin's power. And inside restore_backup[] an
   update keeps the row exactly as the backup holds it, as 0006's other
   triggers already do: a restore updates rows only to draw the work
   list of a backup made before it existed.
   ==================================================================== */

create or replace function private.lexicon_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_uid  uuid := auth.uid();
    v_role public.app_role := private.user_role();
begin
    /* A restore keeps every row exactly as the backup holds it. */
    if private.restoring() then
        return new;
    end if;

    /* Bookkeeping columns are owned by the database, whoever asks. */
    new.id         := old.id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.version    := old.version + 1;
    new.updated_at := now();

    /* An entry never moves to another parent: delete and recreate it. */
    if tg_table_name in ('wordforms', 'senses') then
        new.lemma_id := old.lemma_id;
    elsif tg_table_name = 'glosses' then
        new.sense_id := old.sense_id;
    end if;

    /* The base form follows its lemma; only the lemma trigger moves it. */
    if tg_table_name = 'wordforms' then
        new.is_base := old.is_base;
        if old.is_base and pg_trigger_depth() = 1 and (
               new.form is distinct from old.form
            or new.status is distinct from old.status
            or new.deleted_at is distinct from old.deleted_at) then
            raise exception 'the base form follows its lemma; edit the lemma instead'
                using errcode = '42501';
        end if;
    end if;

    if v_uid is not null then
        if v_role = 'contributor' then
            if new.status is distinct from old.status then
                raise exception 'contributors may not change the review status'
                    using errcode = '42501';
            end if;
            if new.deleted_at is distinct from old.deleted_at then
                raise exception 'contributors may not delete or restore entries'
                    using errcode = '42501';
            end if;
        elsif v_role = 'reviewer' then
            /* Inside regroup_senses[] only: a soft delete of a sense or a
               translation the regrouping replaces. */
            if new.deleted_at is distinct from old.deleted_at
               and not (old.deleted_at is null and new.deleted_at is not null
                        and tg_table_name in ('senses', 'glosses')
                        and private.regrouping()) then
                raise exception 'only admins may delete or restore entries'
                    using errcode = '42501';
            end if;
        elsif v_role is distinct from 'admin' then
            raise exception 'role % may not edit entries', coalesce(v_role::text, 'none')
                using errcode = '42501';
        end if;
    end if;

    return new;
end;
$$;

/* ====================================================================
   Who may set the two columns. senses_review_needed: only the trusted
   backend and a restore; a client's insert has it cleared and a
   client's change of it is refused. senses_reviewed_at: reviewers,
   admins, the trusted backend and a restore; a contributor's insert has
   it cleared, a contributor's change of it is refused. Set by a client,
   the review date is always the database's own clock; cleared, it sends
   the lemma back to the queue if the lemma is on the list. A token that
   claims to be a client but carries no user is a client here too.
   ==================================================================== */

create function private.lemma_senses_reviewed_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_client boolean := auth.uid() is not null or private.is_anonymous_client();
    v_staff  boolean := private.is_staff();
begin
    if private.restoring() then
        return new;
    end if;

    if tg_op = 'INSERT' then
        if v_client then
            new.senses_review_needed := false;
            if new.senses_reviewed_at is not null then
                new.senses_reviewed_at := case when v_staff then now() end;
            end if;
        end if;
    elsif v_client then
        if new.senses_review_needed is distinct from old.senses_review_needed then
            raise exception 'only the trusted backend may change which lemmas wait for their senses to be reviewed'
                using errcode = '42501';
        end if;
        if new.senses_reviewed_at is distinct from old.senses_reviewed_at then
            if not v_staff then
                raise exception 'only reviewers and admins may mark the senses of a lemma as reviewed'
                    using errcode = '42501';
            end if;
            if new.senses_reviewed_at is not null then
                new.senses_reviewed_at := now();
            end if;
        end if;
    end if;

    return new;
end;
$$;

create trigger lemmas_senses_reviewed before insert or update on public.lemmas
    for each row execute function private.lemma_senses_reviewed_guard();

/* ====================================================================
   mark_split_lemmas: put on the list every live lemma not yet reviewed
   that is split one sense per translation: two or more live senses,
   none with a definition, each with exactly one live translation. The
   shape db/templates/check-loaded-entries.sql measures. Run once below;
   restore_backup[] runs it for a backup made before the list existed;
   the trusted backend may run it again. Returns how many it marked.
   Each sense's translations are counted through the index on
   glosses.sense_id: a join with a grouped count would leave the plan to
   the table statistics, and without them it took minutes at the
   dictionary's live size.
   ==================================================================== */

create function private.mark_split_lemmas()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_count integer;
begin
    update public.lemmas as l
    set senses_review_needed = true
    where l.deleted_at is null
      and not l.senses_review_needed
      and l.senses_reviewed_at is null
      and l.id in (
          select s.lemma_id
          from public.senses as s
          where s.deleted_at is null
          group by s.lemma_id
          having count(*) > 1
             and bool_and(s.definition_it is null)
             and bool_and((select count(*) from public.glosses as g
                           where g.sense_id = s.id and g.deleted_at is null) = 1));
    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

/* The list as it stands today. */
select private.mark_split_lemmas();

/* ====================================================================
   The lemmas waiting: on the list, live, not yet reviewed, with their
   number of live senses. Internal.
   ==================================================================== */

create function private.sense_review_candidates()
returns table (lemma_id bigint, senses integer)
language sql
stable
security definer
set search_path = ''
as $$
    select l.id,
           (select count(*)::integer from public.senses as s
            where s.lemma_id = l.id and s.deleted_at is null)
    from public.lemmas as l
    where l.senses_review_needed and l.senses_reviewed_at is null and l.deleted_at is null;
$$;

/* ====================================================================
   sense_review_queue: the next lemmas on the list not yet reviewed,
   fewest senses first,
   then by search key in byte order [collate "C", the same everywhere],
   then by id. p_after_senses, p_after_key and p_after_id are the
   senses, headword_key and lemma_id of the last lemma already shown,
   all three null for the first page. At most 200 a page; 50 by
   default. Each row carries its position in the whole queue [from 1],
   the number waiting, and the lemma's translations with their sense
   numbers, enough to show the page without another call.
   Reviewers, admins and the trusted backend only. It runs with its
   owner's rights so that row level security cannot keep it from the
   indexes; it checks the caller itself.
   ==================================================================== */

create function public.sense_review_queue(
    p_after_senses integer default null,
    p_after_key text default null,
    p_after_id bigint default null,
    p_limit integer default 50)
returns table (
    lemma_id bigint, public_id text, headword text, headword_key text, part_of_speech text,
    status text, senses integer, queue_position bigint, total bigint, translations jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
    if private.is_anonymous_client() or (auth.uid() is not null and not private.is_staff()) then
        raise exception 'only reviewers and admins may review senses' using errcode = '42501';
    end if;
    if p_after_id is not null and (p_after_senses is null or p_after_key is null) then
        raise exception 'a page after a lemma needs its senses, key and id' using errcode = '22023';
    end if;

    return query
    with candidates as (
        select * from private.sense_review_candidates()
    ),
    ranked as (
        select c.lemma_id, l.public_id, l.headword::text as headword, l.headword_key,
               l.part_of_speech, l.status::text as status, c.senses,
               row_number() over (order by c.senses, l.headword_key collate "C", l.id) as queue_position,
               count(*) over () as total
        from candidates as c
        join public.lemmas as l on l.id = c.lemma_id
    ),
    chosen as (
        select r.*
        from ranked as r
        where p_after_id is null
           or (r.senses, r.headword_key collate "C", r.lemma_id)
              > (p_after_senses, p_after_key collate "C", p_after_id)
        order by r.senses, r.headword_key collate "C", r.lemma_id
        limit greatest(1, least(coalesce(p_limit, 50), 200))
    )
    select ch.lemma_id, ch.public_id, ch.headword, ch.headword_key, ch.part_of_speech,
           ch.status, ch.senses, ch.queue_position, ch.total,
           (select coalesce(jsonb_agg(jsonb_build_object(
                       'sense_number', s.sense_number, 'language', g.language, 'gloss', g.gloss)
                   order by s.sense_number, g.id), '[]'::jsonb)
            from public.senses as s
            join public.glosses as g on g.sense_id = s.id and g.deleted_at is null
            where s.lemma_id = ch.lemma_id and s.deleted_at is null)
    from chosen as ch
    order by ch.senses, ch.headword_key collate "C", ch.lemma_id;
end;
$$;

/* ====================================================================
   regroup_senses: a reviewer's grouping of one lemma's translations
   into senses, applied in one transaction, and the lemma marked
   reviewed.

   p_seen:   {"lemma": {"id", "version"}, "senses": [{"id", "version"}],
             "glosses": [{"id", "version"}]}: the lemma, and every live
             sense and translation of it, at the version the reviewer
             saw. Anything different now [the lemma changed or reviewed
             by someone else, a row changed, added or removed since]
             refuses the whole call with 40001, and nothing changes.
   p_groups: [{"glosses": [ids], "definition_it": text}], the new senses
             in their new order: every live translation exactly once; an
             empty list only for a lemma with no live sense left.
             "definition_it" is the Italian definition of that sense; an
             empty text or null means none, and a missing key keeps the
             definition a kept sense already has [a new sense then has
             none].

   A group holding exactly the translations of an existing sense keeps
   that sense, renumbered if needed through a temporary number above
   every number in use, so that no two live senses ever share a number. Any other
   group becomes a new sense: a translation's sense never changes
   [0002], so its translations are copied in, keeping their language,
   text and status, and the originals are soft deleted. Translations
   spelled alike in the same language within one group are copied once,
   the best reviewed of them [approved, then pending, then rejected],
   then the first given. A new sense is approved when every translation in it
   came from an approved sense, pending otherwise. Senses left empty are
   soft deleted. The lemma is marked reviewed in every case, a grouping
   that changes nothing included.

   Refused: a caller who is not a reviewer, an admin or the trusted
   backend [42501]; a lemma that does not exist or is deleted [P0002];
   a malformed request, a translation missing, given twice or not the
   lemma's, a lemma with more than 100 live senses or with a live sense
   that has no translation [22023].

   Returns {"kept", "created", "deleted", "moved", "merged_duplicates",
   "renumbered", "definitions", "changed", "senses_reviewed_at"}:
   senses kept, created and soft deleted; translations copied into new
   senses and those merged as duplicates; kept senses renumbered and
   definitions changed; whether any sense or translation changed.

   It runs as the caller [security invoker]: row level security, the
   triggers' rules, the version of every row and the audit log apply as
   they do to single changes.
   ==================================================================== */

create function public.regroup_senses(p_lemma_id bigint, p_seen jsonb, p_groups jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
    c_max_senses constant integer := 100;
    v_temp_base  integer;
    v_lemma      public.lemmas%rowtype;
    v_senses     jsonb;
    v_glosses    jsonb;
    v_group      record;
    v_row        record;
    v_id         bigint;
    v_version    integer;
    v_ids        bigint[];
    v_sense_ids  bigint[];
    v_kept_ids   bigint[] := '{}';
    v_kept_of    bigint[] := '{}';
    v_defs       text[] := '{}';
    v_has_def    boolean[] := '{}';
    v_sense      jsonb;
    v_def        text;
    v_number     integer;
    v_new_sense  bigint;
    v_status     public.review_status;
    v_count      integer;
    v_kept       integer := 0;
    v_created    integer := 0;
    v_deleted    integer := 0;
    v_moved      integer := 0;
    v_merged     integer := 0;
    v_renumbered integer := 0;
    v_defined    integer := 0;
    v_reviewed   timestamptz;
    k            integer;
begin
    if private.is_anonymous_client() or (auth.uid() is not null and not private.is_staff()) then
        raise exception 'only reviewers and admins may regroup senses' using errcode = '42501';
    end if;

    /* The shape of the request, before anything is read. */
    if p_seen is null or jsonb_typeof(p_seen) <> 'object'
       or exists (select 1 from jsonb_object_keys(p_seen) as sk(name)
                  where sk.name not in ('lemma', 'senses', 'glosses'))
       or jsonb_typeof(p_seen -> 'lemma') is distinct from 'object'
       or jsonb_typeof(p_seen -> 'senses') is distinct from 'array'
       or jsonb_typeof(p_seen -> 'glosses') is distinct from 'array'
       or exists (
           select 1
           from jsonb_array_elements(jsonb_build_array(p_seen -> 'lemma')
                                     || (p_seen -> 'senses') || (p_seen -> 'glosses')) as e(item)
           where jsonb_typeof(e.item) <> 'object'
              or jsonb_typeof(e.item -> 'id') is distinct from 'number'
              or jsonb_typeof(e.item -> 'version') is distinct from 'number'
              or (e.item ->> 'id') !~ '^[0-9]{1,18}$'
              or (e.item ->> 'version') !~ '^[0-9]{1,9}$')
       or (select count(*) <> count(distinct e.item ->> 'id')
           from jsonb_array_elements(p_seen -> 'senses') as e(item))
       or (select count(*) <> count(distinct e.item ->> 'id')
           from jsonb_array_elements(p_seen -> 'glosses') as e(item))
       or (p_seen -> 'lemma' ->> 'id')::bigint is distinct from p_lemma_id then
        raise exception 'what was seen must name this lemma, and list its senses and glosses once each, '
                        'all with whole numbers for id and version'
            using errcode = '22023';
    end if;

    if p_groups is null or jsonb_typeof(p_groups) <> 'array'
       or jsonb_array_length(p_groups) > c_max_senses then
        raise exception 'the groups must be a JSON array of at most % senses', c_max_senses
            using errcode = '22023';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(p_groups) as e(item)
        where jsonb_typeof(e.item) <> 'object'
           or exists (select 1 from jsonb_object_keys(e.item) as jk(name)
                      where jk.name not in ('glosses', 'definition_it'))
           or jsonb_typeof(e.item -> 'glosses') is distinct from 'array'
           or jsonb_array_length(e.item -> 'glosses') = 0
           or jsonb_typeof(e.item -> 'definition_it') not in ('string', 'null')
           or exists (select 1 from jsonb_array_elements(e.item -> 'glosses') as g(id)
                      where jsonb_typeof(g.id) <> 'number' or g.id::text !~ '^[0-9]{1,18}$')) then
        raise exception 'every group needs a non empty list of gloss ids, and at most a definition_it'
            using errcode = '22023';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(p_groups) as e(item)
        where length(regexp_replace(coalesce(e.item ->> 'definition_it', ''), '^\s+|\s+$', '', 'g')) > 1000) then
        raise exception 'a definition may hold at most 1000 characters' using errcode = '22023';
    end if;

    /* The lemma, locked until the end, then its live senses and their
       live translations, locked too, in that order: a second regrouping
       of the same lemma waits, then finds what the first changed, and a
       translation deleted or edited meanwhile is either seen before the
       check below or waits for this call to end. The translations are
       found by an array of sense ids, which row level security lets the
       index serve. */
    select * into v_lemma from public.lemmas where id = p_lemma_id for update;
    if v_lemma.id is null or v_lemma.deleted_at is not null then
        raise exception 'lemma % does not exist or is deleted', p_lemma_id using errcode = 'P0002';
    end if;
    perform 1 from public.senses where lemma_id = p_lemma_id and deleted_at is null for update;
    v_sense_ids := array(select id from public.senses where lemma_id = p_lemma_id and deleted_at is null);
    perform 1 from public.glosses where sense_id = any(v_sense_ids) and deleted_at is null for update;

    select coalesce(jsonb_agg(jsonb_build_object(
               'id', s.id, 'version', s.version, 'number', s.sense_number,
               'status', s.status, 'definition_it', s.definition_it)
           order by s.sense_number), '[]'::jsonb)
    into v_senses
    from public.senses as s
    where s.lemma_id = p_lemma_id and s.deleted_at is null;

    select coalesce(jsonb_agg(jsonb_build_object(
               'id', g.id, 'version', g.version, 'sense_id', g.sense_id,
               'language', g.language, 'gloss', g.gloss, 'status', g.status)
           order by s.sense_number, g.id), '[]'::jsonb)
    into v_glosses
    from public.glosses as g
    join public.senses as s on s.id = g.sense_id
    where g.sense_id = any(v_sense_ids) and s.deleted_at is null and g.deleted_at is null;

    /* What the reviewer saw must be exactly what is live now, before any
       other check of the lemma, so that a change made meanwhile is always
       reported as one. */
    if (p_seen -> 'lemma' ->> 'version')::integer <> v_lemma.version
       or (select coalesce(array_agg(x order by x), '{}')
        from (select (e.item ->> 'id') || ':' || (e.item ->> 'version') as x
              from jsonb_array_elements(p_seen -> 'senses') as e(item)) as t)
       is distinct from
       (select coalesce(array_agg(x order by x), '{}')
        from (select (e.item ->> 'id') || ':' || (e.item ->> 'version') as x
              from jsonb_array_elements(v_senses) as e(item)) as t)
       or
       (select coalesce(array_agg(x order by x), '{}')
        from (select (e.item ->> 'id') || ':' || (e.item ->> 'version') as x
              from jsonb_array_elements(p_seen -> 'glosses') as e(item)) as t)
       is distinct from
       (select coalesce(array_agg(x order by x), '{}')
        from (select (e.item ->> 'id') || ':' || (e.item ->> 'version') as x
              from jsonb_array_elements(v_glosses) as e(item)) as t) then
        raise exception 'the senses of lemma % changed since they were shown; reload and try again', p_lemma_id
            using errcode = '40001';
    end if;

    if jsonb_array_length(v_senses) > c_max_senses then
        raise exception 'lemma % has more than % live senses', p_lemma_id, c_max_senses
            using errcode = '22023';
    end if;

    select (s.item ->> 'number')::integer into v_number
    from jsonb_array_elements(v_senses) as s(item)
    where not exists (select 1 from jsonb_array_elements(v_glosses) as g(item)
                      where g.item -> 'sense_id' = s.item -> 'id')
    order by (s.item ->> 'number')::integer
    limit 1;
    if v_number is not null then
        raise exception 'sense % of lemma % has no translation; give it one or remove it first', v_number, p_lemma_id
            using errcode = '22023';
    end if;

    /* Every live translation in exactly one group, and nothing else. */
    if (select coalesce(array_agg((g.id)::text::bigint order by (g.id)::text::bigint), '{}')
        from jsonb_array_elements(p_groups) as e(item),
             jsonb_array_elements(e.item -> 'glosses') as g(id))
       is distinct from
       (select coalesce(array_agg((g.item ->> 'id')::bigint order by (g.item ->> 'id')::bigint), '{}')
        from jsonb_array_elements(v_glosses) as g(item)) then
        raise exception 'every translation of lemma % must be in exactly one group, and only its own', p_lemma_id
            using errcode = '22023';
    end if;

    /* The plan: for each group, in order, the sense it keeps [0: none,
       a new sense], its definition, and whether one was given. */
    for v_group in
        select e.item, e.position::integer as position
        from jsonb_array_elements(p_groups) with ordinality as e(item, position)
        order by e.position
    loop
        v_ids := array(select (g.id)::text::bigint
                       from jsonb_array_elements(v_group.item -> 'glosses') as g(id));
        v_kept_of := array_append(v_kept_of, coalesce((
            select (s.item ->> 'id')::bigint
            from jsonb_array_elements(v_senses) as s(item)
            where (select array_agg((g.item ->> 'id')::bigint order by (g.item ->> 'id')::bigint)
                   from jsonb_array_elements(v_glosses) as g(item)
                   where g.item -> 'sense_id' = s.item -> 'id')
                  = (select array_agg(x order by x) from unnest(v_ids) as x)
            limit 1), 0));
        v_has_def := array_append(v_has_def, v_group.item ? 'definition_it');
        v_defs := array_append(v_defs, nullif(regexp_replace(coalesce(v_group.item ->> 'definition_it', ''),
                                                             '^\s+|\s+$', '', 'g'), ''));
    end loop;
    v_kept_ids := array(select x from unnest(v_kept_of) as x where x <> 0);

    /* Temporary numbers start above every number in use and every final
       number [at most 100]. */
    v_temp_base := greatest(c_max_senses,
                            coalesce((select max((s.item ->> 'number')::integer)
                                      from jsonb_array_elements(v_senses) as s(item)), 0));

    perform set_config('ligurian.regrouping', 'on', true);

    /* 1. The translations of the senses that are not kept: soft deleted,
          at the version seen. Their copies come in step 4. One row at a
          time, by id: a join with the JSON list would keep row level
          security from the index and check every translation of the
          dictionary [measured: minutes at its live size]. */
    for v_row in
        select (g.item ->> 'id')::bigint as id, (g.item ->> 'version')::integer as version
        from jsonb_array_elements(v_glosses) as g(item)
        where not ((g.item ->> 'sense_id')::bigint = any(v_kept_ids))
    loop
        v_id := v_row.id;
        v_version := v_row.version;
        update public.glosses
        set deleted_at = now()
        where id = v_id and version = v_version and deleted_at is null;
        get diagnostics v_count = row_count;
        if v_count <> 1 then
            raise exception 'translation % changed while it was regrouped', v_id
                using errcode = '40001';
        end if;
    end loop;

    /* 2. The senses not kept: soft deleted, freeing their numbers. */
    for v_row in
        select (s.item ->> 'id')::bigint as id, (s.item ->> 'version')::integer as version
        from jsonb_array_elements(v_senses) as s(item)
        where not ((s.item ->> 'id')::bigint = any(v_kept_ids))
    loop
        v_id := v_row.id;
        v_version := v_row.version;
        update public.senses
        set deleted_at = now()
        where id = v_id and version = v_version and deleted_at is null;
        get diagnostics v_count = row_count;
        if v_count <> 1 then
            raise exception 'sense % changed while it was regrouped', v_id
                using errcode = '40001';
        end if;
        v_deleted := v_deleted + 1;
    end loop;

    /* 3. The kept senses: a new definition if one was given, and a
          temporary number above every number in use when their number
          changes. */
    for k in 1 .. coalesce(array_length(v_kept_of, 1), 0) loop
        if v_kept_of[k] <> 0 then
            v_kept := v_kept + 1;
            select s.item into v_sense
            from jsonb_array_elements(v_senses) as s(item)
            where (s.item ->> 'id')::bigint = v_kept_of[k];
            v_def := case when v_has_def[k] then v_defs[k] else v_sense ->> 'definition_it' end;
            v_id := v_kept_of[k];
            v_version := (v_sense ->> 'version')::integer;
            if (v_sense ->> 'number')::integer <> k or v_def is distinct from (v_sense ->> 'definition_it') then
                update public.senses
                set sense_number = case when sense_number <> k then v_temp_base + k else sense_number end,
                    definition_it = v_def
                where id = v_id and version = v_version and deleted_at is null;
                get diagnostics v_count = row_count;
                if v_count <> 1 then
                    raise exception 'sense % changed while it was regrouped', v_kept_of[k]
                        using errcode = '40001';
                end if;
                if (v_sense ->> 'number')::integer <> k then
                    v_renumbered := v_renumbered + 1;
                end if;
                if v_def is distinct from (v_sense ->> 'definition_it') then
                    v_defined := v_defined + 1;
                end if;
            end if;
        end if;
    end loop;

    /* 4. The new senses, at their final numbers, each with copies of its
          translations, one per language and text, in the order given. */
    for v_group in
        select e.item, e.position::integer as position
        from jsonb_array_elements(p_groups) with ordinality as e(item, position)
        order by e.position
    loop
        k := v_group.position;
        if v_kept_of[k] = 0 then
            select case when bool_and(s.item ->> 'status' = 'approved') then 'approved' else 'pending' end
            into v_status
            from jsonb_array_elements(v_group.item -> 'glosses') as gid(id)
            join jsonb_array_elements(v_glosses) as g(item) on (g.item ->> 'id')::bigint = (gid.id)::text::bigint
            join jsonb_array_elements(v_senses) as s(item) on s.item -> 'id' = g.item -> 'sense_id';

            insert into public.senses (lemma_id, sense_number, definition_it, status)
            values (p_lemma_id, k, v_defs[k], v_status)
            returning id into v_new_sense;
            v_created := v_created + 1;
            if v_defs[k] is not null then
                v_defined := v_defined + 1;
            end if;

            insert into public.glosses (sense_id, language, gloss, status)
            select v_new_sense, d.language, d.gloss, d.status
            from (
                select distinct on (g.item ->> 'language', g.item ->> 'gloss')
                       g.item ->> 'language' as language,
                       g.item ->> 'gloss' as gloss,
                       (g.item ->> 'status')::public.review_status as status,
                       gid.position
                from jsonb_array_elements(v_group.item -> 'glosses') with ordinality as gid(id, position)
                join jsonb_array_elements(v_glosses) as g(item) on (g.item ->> 'id')::bigint = (gid.id)::text::bigint
                order by g.item ->> 'language', g.item ->> 'gloss',
                         case g.item ->> 'status' when 'approved' then 0 when 'pending' then 1 else 2 end,
                         gid.position
            ) as d
            order by d.position;
            get diagnostics v_count = row_count;
            v_moved := v_moved + v_count;
            v_merged := v_merged + jsonb_array_length(v_group.item -> 'glosses') - v_count;
        end if;
    end loop;

    /* 5. The kept senses parked above every number take their final ones. */
    for k in 1 .. coalesce(array_length(v_kept_of, 1), 0) loop
        if v_kept_of[k] <> 0 then
            v_id := v_kept_of[k];
            v_number := v_temp_base + k;
            update public.senses
            set sense_number = k
            where id = v_id and sense_number = v_number;
        end if;
    end loop;

    perform set_config('ligurian.regrouping', 'off', true);

    /* 6. The lemma: reviewed, by the database's clock. */
    update public.lemmas
    set senses_reviewed_at = now()
    where id = p_lemma_id
    returning senses_reviewed_at into v_reviewed;

    return jsonb_build_object(
        'kept',               v_kept,
        'created',            v_created,
        'deleted',            v_deleted,
        'moved',              v_moved,
        'merged_duplicates',  v_merged,
        'renumbered',         v_renumbered,
        'definitions',        v_defined,
        'changed',            v_created + v_deleted + v_renumbered + v_defined > 0,
        'senses_reviewed_at', v_reviewed
    );
end;
$$;

/* ====================================================================
   split_semicolon_glosses: translations holding ";" split into one row
   each, in the same sense, with the same language and status; the
   original is soft deleted. Pieces are trimmed; empty pieces and pieces
   repeated within the translation are dropped; a piece the sense already
   holds in that language is not added again.

   p_apply false [the default] is a dry run: it lists every such
   translation and its pieces, counts what would be added, and changes
   nothing. true applies it. Pieces are normalized as the lexicon
   manager's own field does: NFC, every kind of space, the no-break space
   included, collapsed to one and trimmed.

   A translation of a lemma still on the list of senses to review is
   split like any other: the lemma stays on the list, and its reviewer
   then sees the pieces as translations of one sense.

   Returns {"applied", "split", "skipped", "inserted", "already_present",
   "glosses": [{"gloss_id", "lemma_id", "public_id", "headword",
   "sense_number", "language", "gloss", "status", "pieces", "action",
   "reason"}]}, action being "split" or "skip".

   Admins and the trusted backend only. It runs with its owner's rights
   and checks the caller itself; the triggers still credit the admin and
   write the history.
   ==================================================================== */

create function public.split_semicolon_glosses(p_apply boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_row      record;
    v_pieces   text[];
    v_piece    text;
    v_action   text;
    v_reason   text;
    v_count    integer;
    v_split    integer := 0;
    v_skipped  integer := 0;
    v_inserted integer := 0;
    v_present  integer := 0;
    v_report   jsonb := '[]'::jsonb;
    v_added    text[] := '{}';
    v_key      text;
begin
    if private.is_anonymous_client()
       or (auth.uid() is not null and private.user_role() is distinct from 'admin') then
        raise exception 'only admins may split translations' using errcode = '42501';
    end if;

    for v_row in
        select g.id, g.version, g.sense_id, g.language, g.gloss, g.status,
               s.sense_number, l.id as lemma_id, l.public_id, l.headword::text as headword
        from public.glosses as g
        join public.senses as s on s.id = g.sense_id and s.deleted_at is null
        join public.lemmas as l on l.id = s.lemma_id and l.deleted_at is null
        where g.deleted_at is null and strpos(g.gloss, ';') > 0
        order by l.headword_key collate "C", l.id, s.sense_number, g.id
    loop
        v_pieces := array(
            select t.piece
            from (select regexp_replace(regexp_replace(normalize(u.part, NFC), '[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+', ' ', 'g'),
                                        '^ | $', '', 'g') as piece,
                         min(u.position) as first
                  from unnest(string_to_array(v_row.gloss, ';')) with ordinality as u(part, position)
                  group by 1) as t
            where t.piece <> ''
            order by t.first);
        v_reason := null;
        if coalesce(array_length(v_pieces, 1), 0) = 0 then
            v_action := 'skip';
            v_reason := 'nothing but separators';
        else
            v_action := 'split';
        end if;

        if v_action = 'split' then
            v_split := v_split + 1;
            foreach v_piece in array v_pieces loop
                /* A piece this run already added counts as there in a dry
                   run too, so that both count the same. */
                v_key := v_row.sense_id || '|' || v_row.language || '|' || v_piece;
                if v_key = any(v_added)
                   or exists (select 1 from public.glosses as o
                              where o.sense_id = v_row.sense_id and o.language = v_row.language
                                and o.gloss = v_piece and o.deleted_at is null) then
                    v_present := v_present + 1;
                else
                    v_added := array_append(v_added, v_key);
                    if p_apply then
                        insert into public.glosses (sense_id, language, gloss, status)
                        values (v_row.sense_id, v_row.language, v_piece, v_row.status);
                    end if;
                    v_inserted := v_inserted + 1;
                end if;
            end loop;
            if p_apply then
                update public.glosses
                set deleted_at = now()
                where id = v_row.id and version = v_row.version and deleted_at is null;
                get diagnostics v_count = row_count;
                if v_count <> 1 then
                    raise exception 'translation % changed while it was split', v_row.id
                        using errcode = '40001';
                end if;
            end if;
        else
            v_skipped := v_skipped + 1;
        end if;

        v_report := v_report || jsonb_build_object(
            'gloss_id', v_row.id, 'lemma_id', v_row.lemma_id, 'public_id', v_row.public_id,
            'headword', v_row.headword, 'sense_number', v_row.sense_number,
            'language', v_row.language, 'gloss', v_row.gloss, 'status', v_row.status,
            'pieces', to_jsonb(v_pieces), 'action', v_action, 'reason', v_reason);
    end loop;

    return jsonb_build_object(
        'applied',         p_apply,
        'split',           v_split,
        'skipped',         v_skipped,
        'inserted',        v_inserted,
        'already_present', v_present,
        'glosses',         v_report
    );
end;
$$;

/* ====================================================================
   restore_backup, as in 0006, now restoring senses_review_needed and
   senses_reviewed_at too. A backup made before 0.15.0 has neither
   field: its lemmas restore never reviewed, and its list is drawn from
   the restored entries' shape by mark_split_lemmas[], as this migration
   drew the live one, without a version raised or a line of history.
   Replacing the function clears 0008's time limit, which is set again
   below.
   ==================================================================== */

create or replace function public.restore_backup(p_backup jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_uid              uuid := auth.uid();
    v_tables           jsonb := p_backup -> 'tables';
    v_profiles_skipped integer;
    v_authors_unknown  integer := 0;
    v_count            integer;
    v_restored         jsonb := '{}'::jsonb;
    v_has_list         boolean;
begin
    if private.is_anonymous_client()
       or (v_uid is not null and private.user_role() is distinct from 'admin') then
        raise exception 'only admins may restore a backup' using errcode = '42501';
    end if;

    if p_backup ->> 'format' is distinct from 'ligurian-keyboard-backup'
       or jsonb_typeof(p_backup -> 'format_version') is distinct from 'number'
       or p_backup ->> 'format_version' is distinct from '1'
       or jsonb_typeof(v_tables) is distinct from 'object'
       or exists (
           select 1
           from unnest(array['varieties', 'orthographies', 'gloss_languages', 'profiles',
                             'lemmas', 'wordforms', 'senses', 'glosses', 'audit_log']) as k(name)
           where jsonb_typeof(v_tables -> k.name) is distinct from 'array'
       ) then
        raise exception 'not a complete ligurian-keyboard backup of format version 1'
            using errcode = '22023';
    end if;

    if exists (select 1 from public.lemmas) or exists (select 1 from public.wordforms)
       or exists (select 1 from public.senses) or exists (select 1 from public.glosses)
       or exists (select 1 from public.audit_log) then
        raise exception 'a backup is restored only into an empty dictionary; this one already has entries or history'
            using errcode = '55000';
    end if;

    perform set_config('ligurian.restoring', 'on', true);

    /* Reference lists: the migrations create them; a backup may add rows. */
    insert into public.varieties (code, name)
    select code, name from jsonb_populate_recordset(null::public.varieties, coalesce(v_tables -> 'varieties', '[]'))
    on conflict (code) do nothing;
    insert into public.orthographies (code, name)
    select code, name from jsonb_populate_recordset(null::public.orthographies, coalesce(v_tables -> 'orthographies', '[]'))
    on conflict (code) do nothing;
    insert into public.gloss_languages (code, name)
    select code, name from jsonb_populate_recordset(null::public.gloss_languages, coalesce(v_tables -> 'gloss_languages', '[]'))
    on conflict (code) do nothing;

    /* Profiles whose account exists here get their name back, and their
       role, except the person restoring and anyone who is an admin here
       already: a restore never demotes an admin, the last one included. */
    update public.profiles as p
    set display_name = b.display_name
    from jsonb_populate_recordset(null::public.profiles, coalesce(v_tables -> 'profiles', '[]')) as b
    where p.user_id = b.user_id;
    update public.profiles as p
    set role = b.role
    from jsonb_populate_recordset(null::public.profiles, coalesce(v_tables -> 'profiles', '[]')) as b
    where p.user_id = b.user_id and p.user_id is distinct from v_uid and p.role <> 'admin';

    select count(*) into v_profiles_skipped
    from jsonb_populate_recordset(null::public.profiles, coalesce(v_tables -> 'profiles', '[]')) as b
    where not exists (select 1 from auth.users as u where u.id = b.user_id);

    /* Authors with no account here. */
    select count(*) into v_authors_unknown
    from (
        select b.created_by from jsonb_populate_recordset(null::public.lemmas,    coalesce(v_tables -> 'lemmas', '[]')) as b
        union all
        select b.created_by from jsonb_populate_recordset(null::public.wordforms, coalesce(v_tables -> 'wordforms', '[]')) as b
        union all
        select b.created_by from jsonb_populate_recordset(null::public.senses,    coalesce(v_tables -> 'senses', '[]')) as b
        union all
        select b.created_by from jsonb_populate_recordset(null::public.glosses,   coalesce(v_tables -> 'glosses', '[]')) as b
    ) as a
    where a.created_by is not null
      and not exists (select 1 from auth.users as u where u.id = a.created_by);

    insert into public.lemmas (id, public_id, headword, variety, orthography, part_of_speech, note,
                               status, version, created_by, created_at, updated_at, deleted_at,
                               senses_review_needed, senses_reviewed_at)
    overriding system value
    select b.id, b.public_id, b.headword, b.variety, b.orthography, b.part_of_speech, b.note,
           b.status, b.version,
           (select u.id from auth.users as u where u.id = b.created_by),
           b.created_at, b.updated_at, b.deleted_at,
           coalesce(b.senses_review_needed, false), b.senses_reviewed_at
    from jsonb_populate_recordset(null::public.lemmas, coalesce(v_tables -> 'lemmas', '[]')) as b
    order by b.id;
    get diagnostics v_count = row_count;
    v_restored := v_restored || jsonb_build_object('lemmas', v_count);

    insert into public.wordforms (id, public_id, lemma_id, form, is_base, grammatical_tag, freq,
                                  status, version, created_by, created_at, updated_at, deleted_at)
    overriding system value
    select b.id, b.public_id, b.lemma_id, b.form, b.is_base, b.grammatical_tag, b.freq,
           b.status, b.version,
           (select u.id from auth.users as u where u.id = b.created_by),
           b.created_at, b.updated_at, b.deleted_at
    from jsonb_populate_recordset(null::public.wordforms, coalesce(v_tables -> 'wordforms', '[]')) as b
    order by b.id;
    get diagnostics v_count = row_count;
    v_restored := v_restored || jsonb_build_object('wordforms', v_count);

    insert into public.senses (id, lemma_id, sense_number, definition_it,
                               status, version, created_by, created_at, updated_at, deleted_at)
    overriding system value
    select b.id, b.lemma_id, b.sense_number, b.definition_it,
           b.status, b.version,
           (select u.id from auth.users as u where u.id = b.created_by),
           b.created_at, b.updated_at, b.deleted_at
    from jsonb_populate_recordset(null::public.senses, coalesce(v_tables -> 'senses', '[]')) as b
    order by b.id;
    get diagnostics v_count = row_count;
    v_restored := v_restored || jsonb_build_object('senses', v_count);

    insert into public.glosses (id, sense_id, language, gloss,
                                status, version, created_by, created_at, updated_at, deleted_at)
    overriding system value
    select b.id, b.sense_id, b.language, b.gloss,
           b.status, b.version,
           (select u.id from auth.users as u where u.id = b.created_by),
           b.created_at, b.updated_at, b.deleted_at
    from jsonb_populate_recordset(null::public.glosses, coalesce(v_tables -> 'glosses', '[]')) as b
    order by b.id;
    get diagnostics v_count = row_count;
    v_restored := v_restored || jsonb_build_object('glosses', v_count);

    insert into public.audit_log (id, table_name, row_id, action, actor, at, old_row, new_row)
    overriding system value
    select b.id, b.table_name, b.row_id, b.action, b.actor, b.at, b.old_row, b.new_row
    from jsonb_populate_recordset(null::public.audit_log, coalesce(v_tables -> 'audit_log', '[]')) as b
    order by b.id;
    get diagnostics v_count = row_count;
    v_restored := v_restored || jsonb_build_object('audit_log', v_count);

    /* A backup made before 0.15.0: its list drawn from its entries. */
    v_has_list := exists (select 1 from jsonb_array_elements(coalesce(v_tables -> 'lemmas', '[]')) as e(item)
                          where e.item ? 'senses_review_needed');
    if not v_has_list then
        perform private.mark_split_lemmas();
    end if;

    /* The identity counters continue after the highest restored id. */
    perform setval(pg_get_serial_sequence('public.lemmas', 'id'),
                   coalesce((select max(id) from public.lemmas), 1),
                   exists (select 1 from public.lemmas));
    perform setval(pg_get_serial_sequence('public.wordforms', 'id'),
                   coalesce((select max(id) from public.wordforms), 1),
                   exists (select 1 from public.wordforms));
    perform setval(pg_get_serial_sequence('public.senses', 'id'),
                   coalesce((select max(id) from public.senses), 1),
                   exists (select 1 from public.senses));
    perform setval(pg_get_serial_sequence('public.glosses', 'id'),
                   coalesce((select max(id) from public.glosses), 1),
                   exists (select 1 from public.glosses));
    perform setval(pg_get_serial_sequence('public.audit_log', 'id'),
                   coalesce((select max(id) from public.audit_log), 1),
                   exists (select 1 from public.audit_log));

    perform set_config('ligurian.restoring', 'off', true);

    return jsonb_build_object(
        'restored',         v_restored,
        'profiles_skipped', v_profiles_skipped,
        'authors_unknown',  v_authors_unknown
    );
end;
$$;

alter function public.restore_backup(jsonb) set statement_timeout = '60s';

/* ====================================================================
   0006's insert trigger, unchanged but for the locks on the parents it
   checks, a translation's lemma first, then its sense. Without them, a
   translation added at the moment its sense was soft deleted, by a
   regrouping or by an admin, could stay live under a deleted sense: the
   check read the sense before the deletion was committed. In the other
   order, an insert and a regrouping could wait for each other until
   PostgreSQL stopped one of them.
   ==================================================================== */

create or replace function private.lexicon_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_uid    uuid := auth.uid();
    v_role   public.app_role := private.user_role();
    v_lemma  public.lemmas%rowtype;
    v_sense  public.senses%rowtype;
begin
    /* A restore inserts rows exactly as the backup holds them. */
    if private.restoring() then
        return new;
    end if;

    new.version    := 1;
    new.created_at := now();
    new.updated_at := now();

    if v_uid is not null then
        if v_role is null or v_role = 'member' then
            raise exception 'role % may not propose entries', coalesce(v_role::text, 'none')
                using errcode = '42501';
        end if;

        new.created_by := v_uid;
        new.deleted_at := null;

        if v_role = 'contributor' then
            new.status := 'pending';
        end if;
    end if;

    /* The parent must exist and be live, whoever inserts. It is locked
       until the end of the transaction: a parent being deleted at the
       same moment is waited for, then seen deleted. A translation locks
       its lemma first, then its sense, the order regroup_senses[] takes
       them in, so that the two never wait for each other; a sense's
       lemma never changes [0002], so it is read without a lock. */
    if tg_table_name in ('wordforms', 'senses') then
        select * into v_lemma from public.lemmas where id = new.lemma_id for share;
        if v_lemma.id is null or v_lemma.deleted_at is not null then
            raise exception 'lemma % does not exist or is deleted', new.lemma_id
                using errcode = '23503';
        end if;
    elsif tg_table_name = 'glosses' then
        select * into v_lemma from public.lemmas
        where id = (select s.lemma_id from public.senses as s where s.id = new.sense_id)
        for share;
        select * into v_sense from public.senses where id = new.sense_id for share;
        if v_sense.id is null or v_sense.deleted_at is not null
           or v_lemma.deleted_at is not null then
            raise exception 'sense % does not exist or is deleted', new.sense_id
                using errcode = '23503';
        end if;
    end if;

    /* Only the lemma trigger may create a base form. */
    if tg_table_name = 'wordforms' and pg_trigger_depth() = 1 then
        new.is_base := false;
    end if;

    /* Senses are numbered 1, 2, 3 ... per lemma unless a number is given.
       Nested ifs, not "and": plpgsql resolves every field named in a
       condition, and only senses have a sense_number field. */
    if tg_table_name = 'senses' then
        if new.sense_number is null then
            select coalesce(max(s.sense_number), 0) + 1 into new.sense_number
            from public.senses as s
            where s.lemma_id = new.lemma_id and s.deleted_at is null;
        end if;
    end if;

    return new;
end;
$$;

/* ====================================================================
   Privileges. The internal functions are reachable only through the
   triggers and the public functions above.
   ==================================================================== */

revoke all on function private.regrouping() from public, anon, authenticated;
revoke all on function private.lemma_senses_reviewed_guard() from public, anon, authenticated;
revoke all on function private.sense_review_candidates() from public, anon, authenticated;
revoke all on function private.mark_split_lemmas() from public, anon, authenticated;
revoke all on function public.sense_review_queue(integer, text, bigint, integer) from public, anon, authenticated;
revoke all on function public.regroup_senses(bigint, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.split_semicolon_glosses(boolean) from public, anon, authenticated;
grant execute on function public.sense_review_queue(integer, text, bigint, integer) to authenticated;
grant execute on function public.regroup_senses(bigint, jsonb, jsonb) to authenticated;
grant execute on function public.split_semicolon_glosses(boolean) to authenticated;
