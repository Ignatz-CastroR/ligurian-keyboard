/*
 * 0007_batch_review.sql
 * Author:    Eng. José Ignacio Castro de R. and contributors
 * Date:      2026/10/18, 12:44:26, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:   Batch review, released as 0.11.0 [decision 0033]:
 *            1. review_queue gains the columns the lexicon manager needs
 *               to group the queue by entry and to label every row
 *               without guessing: each row's version, its lemma's
 *               headword, status and public identifier, and, for senses
 *               and translations, the sense's id, number and Italian
 *               definition, the translation's language and text. It no
 *               longer lists a row whose lemma or sense is deleted.
 *            2. review_batch[] approves or rejects many pending queue
 *               rows in one call. Each row is changed on its own, in its
 *               own subtransaction: a row that fails [changed by someone
 *               else since the queue was read, gone, deleted with its
 *               parent, or refused by a rule] is reported with its
 *               reason, and every other row is still changed.
 * Contract:  Run once, after 0001 to 0006, BEFORE pushing the code of
 *            0.11.0: its lexicon manager reads the new columns and calls
 *            review_batch[]. Nothing in the existing data changes.
 *            Run the whole file at once, as the SQL Editor does: it is
 *            then one transaction, and a failure leaves nothing behind.
 *            review_batch[] runs as the caller [security invoker]: row
 *            level security, the role rules of the triggers, the
 *            automatic base form and the audit log apply to every row
 *            exactly as they apply to a single update. It changes only
 *            the rows it is given, at the version it is given, while
 *            they are pending and live; it never reaches a row the
 *            reviewer did not see, except a lemma's base form, which
 *            follows its lemma as it always has.
 * Decision:  docs/decisions/0033-batch-review.md
 */

/* ====================================================================
   Is a parent live? SECURITY DEFINER, like lemma_is_published[] in
   0003, so that the queue and review_batch[] can see a parent the
   caller's row level security hides: a contributor's translation on
   another contributor's pending sense still belongs to its lemma.
   They return a yes or no, or a lemma's id, never a row's text.
   ==================================================================== */

create function private.lemma_is_live(p_lemma_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.lemmas
        where id = p_lemma_id and deleted_at is null
    );
$$;

/* A sense is live when it and its lemma both are. */
create function private.sense_is_live(p_sense_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.senses as s
        join public.lemmas as l on l.id = s.lemma_id
        where s.id = p_sense_id
          and s.deleted_at is null and l.deleted_at is null
    );
$$;

/* The lemma a sense belongs to, whoever may read the sense itself. */
create function private.sense_lemma_id(p_sense_id bigint)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
    select s.lemma_id from public.senses as s where s.id = p_sense_id;
$$;

revoke all on function private.lemma_is_live(bigint) from public, anon, authenticated;
revoke all on function private.sense_is_live(bigint) from public, anon, authenticated;
revoke all on function private.sense_lemma_id(bigint) from public, anon, authenticated;
grant execute on function private.lemma_is_live(bigint) to authenticated;
grant execute on function private.sense_is_live(bigint) to authenticated;
grant execute on function private.sense_lemma_id(bigint) to authenticated;

/* ====================================================================
   The review queue, with the columns needed to group and label it.
   The six original columns keep their names, types and order, so that
   a page cached from 0.10.0 keeps working; the new ones follow them.
   Left joins: a row whose lemma or sense the reader cannot see still
   appears, with nulls where the parent's columns would be. A row whose
   lemma or sense is deleted no longer appears at all: it could not be
   published, and approving it would only hide it again.
   ==================================================================== */

create or replace view public.review_queue
with (security_invoker = true)
as
select 'lemma'::text as kind, l.id, l.id as lemma_id, l.headword as text,
       l.created_by, l.created_at,
       l.version,
       l.headword::text as lemma_headword,
       l.status as lemma_status,
       l.public_id as lemma_public_id,
       null::bigint as sense_id,
       null::integer as sense_number,
       null::text as definition_it,
       null::text as language,
       null::text as gloss
from public.lemmas as l
where l.status = 'pending' and l.deleted_at is null
union all
select 'wordform', w.id, w.lemma_id, w.form, w.created_by, w.created_at,
       w.version,
       l.headword::text, l.status, l.public_id,
       null, null, null, null, null
from public.wordforms as w
left join public.lemmas as l on l.id = w.lemma_id
where w.status = 'pending' and w.deleted_at is null and not w.is_base
  and private.lemma_is_live(w.lemma_id)
union all
select 'sense', s.id, s.lemma_id,
       s.sense_number || '. ' || coalesce(s.definition_it, ''), s.created_by, s.created_at,
       s.version,
       l.headword::text, l.status, l.public_id,
       s.id, s.sense_number, s.definition_it, null, null
from public.senses as s
left join public.lemmas as l on l.id = s.lemma_id
where s.status = 'pending' and s.deleted_at is null
  and private.lemma_is_live(s.lemma_id)
union all
select 'gloss', g.id, private.sense_lemma_id(g.sense_id), g.language || ': ' || g.gloss,
       g.created_by, g.created_at,
       g.version,
       l.headword::text, l.status, l.public_id,
       g.sense_id, s.sense_number, s.definition_it, g.language, g.gloss
from public.glosses as g
left join public.senses as s on s.id = g.sense_id
left join public.lemmas as l on l.id = s.lemma_id
where g.status = 'pending' and g.deleted_at is null
  and private.sense_is_live(g.sense_id)
order by created_at, kind, id;

grant select on public.review_queue to authenticated;

/* ====================================================================
   review_batch: approve or reject many pending queue rows in one call.

   p_items:  a JSON array of objects {"kind", "id", "version"}, kind
             being lemma, wordform, sense or gloss, as in review_queue.
             At most 500 objects; an item named twice is changed once.
   p_status: 'approved' or 'rejected'. A batch never sets 'pending'.

   Returns {"updated": n, "failed": [...]}, one failure per row not
   changed, in the order given: {"kind", "id", "reason", "sqlstate",
   "message"}, reason being
     conflict   the row exists but its version is no longer the one
                given: someone changed it after the queue was read;
     notfound   the row does not exist, is deleted, belongs to a
                deleted lemma or sense, or the caller cannot see it;
     error      the row is no longer pending [22023], or a rule
                refused the change; sqlstate says which, with the same
                codes as a single update [42501 permission, 23505
                duplicate, ...].
   An id must be a whole number of at most 18 digits and a version of
   at most 9, so that neither can overflow its column.

   Only pending, live rows are changed: a batch reviews the queue, and
   the queue lists nothing else. A deleted row, or one whose lemma or
   sense is deleted, is never changed, not even by an admin, whose row
   level security would otherwise allow it.

   Only reviewers, admins and the trusted backend may call it; anyone
   else, a client token without a user included, is refused before any
   row is touched. A malformed request, an unknown kind or a missing
   number, refuses the whole call [22023]: that is a fault of the
   client, not of a row.
   ==================================================================== */

create function public.review_batch(p_items jsonb, p_status public.review_status)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
    c_max_items constant integer := 500;
    v_tables    constant jsonb := jsonb_build_object(
        'lemma', 'lemmas', 'wordform', 'wordforms', 'sense', 'senses', 'gloss', 'glosses');
    /* For each kind, the test that its parents are live. */
    v_parents   constant jsonb := jsonb_build_object(
        'lemma', 'true',
        'wordform', 'private.lemma_is_live(lemma_id)',
        'sense', 'private.lemma_is_live(lemma_id)',
        'gloss', 'private.sense_is_live(sense_id)');
    v_item      record;
    v_table     text;
    v_parent    text;
    v_count     integer;
    v_current   integer;
    v_deleted   timestamptz;
    v_pending   boolean;
    v_live      boolean;
    v_reason    text;
    v_sqlstate  text;
    v_updated   integer := 0;
    v_failed    jsonb := '[]'::jsonb;
    v_state     text;
    v_message   text;
begin
    if private.is_anonymous_client() or (auth.uid() is not null and not private.is_staff()) then
        raise exception 'only reviewers and admins may review entries'
            using errcode = '42501';
    end if;

    if p_status is null or p_status = 'pending' then
        raise exception 'a batch approves or rejects; it cannot set %', coalesce(p_status::text, 'null')
            using errcode = '22023';
    end if;

    if p_items is null or jsonb_typeof(p_items) <> 'array' then
        raise exception 'the items must be a JSON array' using errcode = '22023';
    end if;

    if jsonb_array_length(p_items) > c_max_items then
        raise exception 'at most % items per batch, % given', c_max_items, jsonb_array_length(p_items)
            using errcode = '22023';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(p_items) as e(item)
        where jsonb_typeof(e.item) <> 'object'
           or not (v_tables ? coalesce(e.item ->> 'kind', ''))
           or jsonb_typeof(e.item -> 'id') is distinct from 'number'
           or jsonb_typeof(e.item -> 'version') is distinct from 'number'
           or (e.item ->> 'id') !~ '^[0-9]{1,18}$'
           or (e.item ->> 'version') !~ '^[0-9]{1,9}$'
    ) then
        raise exception 'every item needs a known kind and whole numbers for id and version'
            using errcode = '22023';
    end if;

    /* One pass per distinct row, in the order first given. */
    for v_item in
        select d.kind, d.id, d.version
        from (
            select distinct on (e.item ->> 'kind', (e.item ->> 'id')::bigint)
                   e.item ->> 'kind' as kind,
                   (e.item ->> 'id')::bigint as id,
                   (e.item ->> 'version')::integer as version,
                   e.position
            from jsonb_array_elements(p_items) with ordinality as e(item, position)
            order by e.item ->> 'kind', (e.item ->> 'id')::bigint, e.position
        ) as d
        order by d.position
    loop
        v_table := v_tables ->> v_item.kind;
        v_parent := v_parents ->> v_item.kind;
        begin
            execute format(
                'update public.%I set status = $1
                  where id = $2 and version = $3 and status = ''pending''
                    and deleted_at is null and %s',
                v_table, v_parent)
                using p_status, v_item.id, v_item.version;
            get diagnostics v_count = row_count;

            if v_count = 1 then
                v_updated := v_updated + 1;
            else
                /* Why nothing changed, read as the caller: staff see every
                   row, deleted ones included. */
                v_current := null;
                v_deleted := null;
                v_pending := null;
                v_live := null;
                v_sqlstate := null;
                execute format(
                    'select version, deleted_at, status = ''pending'', %s from public.%I where id = $1',
                    v_parent, v_table)
                    into v_current, v_deleted, v_pending, v_live
                    using v_item.id;
                if v_current is null then
                    v_reason := 'notfound';
                    v_message := format('%s %s does not exist', v_table, v_item.id);
                elsif v_deleted is not null then
                    v_reason := 'notfound';
                    v_message := format('%s %s is deleted', v_table, v_item.id);
                elsif not v_live then
                    v_reason := 'notfound';
                    v_message := format('%s %s belongs to a deleted %s', v_table, v_item.id,
                                        case when v_item.kind = 'gloss' then 'sense or lemma' else 'lemma' end);
                elsif v_current <> v_item.version then
                    v_reason := 'conflict';
                    v_message := format('%s %s is at version %s, not %s',
                                        v_table, v_item.id, v_current, v_item.version);
                elsif not v_pending then
                    v_reason := 'error';
                    v_sqlstate := '22023';
                    v_message := format('%s %s is not pending', v_table, v_item.id);
                else
                    /* Defensive: visible, live, pending, at the right
                       version, and still not updated, which only an
                       update policy stricter than its select policy
                       could cause. None does today. */
                    v_reason := 'error';
                    v_sqlstate := '42501';
                    v_message := format('%s %s could not be updated by this user', v_table, v_item.id);
                end if;
                v_failed := v_failed || jsonb_build_object(
                    'kind', v_item.kind,
                    'id', v_item.id,
                    'reason', v_reason,
                    'sqlstate', v_sqlstate,
                    'message', v_message);
            end if;
        exception when others then
            get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
            v_failed := v_failed || jsonb_build_object(
                'kind', v_item.kind,
                'id', v_item.id,
                'reason', 'error',
                'sqlstate', v_state,
                'message', v_message);
        end;
    end loop;

    return jsonb_build_object('updated', v_updated, 'failed', v_failed);
end;
$$;

revoke all on function public.review_batch(jsonb, public.review_status) from public, anon, authenticated;
grant execute on function public.review_batch(jsonb, public.review_status) to authenticated;
