/*
 * 0006_public_ids_and_backups.sql
 * Author:    Eng. José Ignacio Castro de R. and contributors
 * Date:      2026/10/18, 08:27:53, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:   Two things, released together as 0.10.0:
 *            1. A public identifier for every lemma and every wordform,
 *               such as LIJ-7K3Q9MDXK: "LIJ-", eight characters of
 *               Crockford's base 32, and Crockford's check symbol. It is
 *               assigned by the database, never changes, is never given
 *               to two entries and is never reused [decision 0030].
 *            2. Backups: export_backup[] writes every table an admin
 *               needs to rebuild the dictionary as one JSON document;
 *               restore_backup[] loads such a document into an empty,
 *               freshly migrated database, identifiers and history
 *               included [decision 0031].
 * Contract:  Run once, after 0001 to 0005, BEFORE pushing the code of
 *            0.10.0: the lexicon manager of 0.10.0 reads public_id.
 *            Existing lemmas and wordforms receive their identifier
 *            here. Each assignment is an ordinary update: it raises the
 *            row's version by one and writes one row of history, so the
 *            audit log records when every identifier was given.
 *            Run the whole file at once, as the SQL Editor does: it is
 *            then one transaction, and a failure leaves nothing behind.
 *            Login accounts live in Supabase's auth schema and are NOT
 *            part of a backup; on a restore, a profile whose account
 *            does not exist is skipped.
 * Decision:  docs/decisions/0030-public-identifiers.md and
 *            docs/decisions/0031-backups.md
 */

/* ====================================================================
   Crockford's base 32: digits and letters without I, L, O and U, so a
   code can be read aloud and typed without confusing 1 with I or L,
   or 0 with O. The check symbol is the code's value modulo 37, written
   with the same 32 symbols plus * ~ $ = U.
   ==================================================================== */

create function private.crockford_encode(p_value bigint, p_width integer)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
    v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    v_value    bigint := p_value;
    v_result   text := '';
begin
    if p_value < 0 then
        raise exception 'cannot encode a negative number' using errcode = '22023';
    end if;
    for i in 1 .. p_width loop
        v_result := substr(v_alphabet, (v_value % 32)::integer + 1, 1) || v_result;
        v_value := v_value / 32;
    end loop;
    if v_value <> 0 then
        raise exception '% does not fit in % symbols', p_value, p_width using errcode = '22023';
    end if;
    return v_result;
end;
$$;

create function private.crockford_decode(p_symbols text)
returns bigint
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
    v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    v_value    bigint := 0;
    v_digit    integer;
begin
    for i in 1 .. length(p_symbols) loop
        v_digit := strpos(v_alphabet, substr(p_symbols, i, 1)) - 1;
        if v_digit < 0 then
            raise exception '% is not a Crockford base 32 symbol', substr(p_symbols, i, 1)
                using errcode = '22P02';
        end if;
        v_value := v_value * 32 + v_digit;
    end loop;
    return v_value;
end;
$$;

-- The check symbol of the eight symbols of a code's body.
create function private.public_id_check_symbol(p_body text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
    select substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ*~$=U',
                  (private.crockford_decode(p_body) % 37)::integer + 1, 1);
$$;

/* True for a well formed code whose check symbol matches its body.
   CASE, not AND, so that a malformed code is never decoded. */
create function private.public_id_is_valid(p_code text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
    select case
        when p_code ~ '^LIJ-[0-9A-HJKMNP-TV-Z]{8}[0-9A-HJKMNP-TV-Z*~$=U]$'
            then substr(p_code, 13, 1) = private.public_id_check_symbol(substr(p_code, 5, 8))
        else false
    end;
$$;

/* ====================================================================
   Every code ever given, whatever entry received it. Codes are unique
   across lemmas AND wordforms, and a code is never given again, even
   to restore an entry: this table remembers them all. Nothing deletes
   from it; it lives in the private schema, out of the API's reach.
   ==================================================================== */

create table private.issued_public_ids (
    code       text primary key check (private.public_id_is_valid(code)),
    issued_at  timestamptz not null default now()
);

/* A new, never issued code. 40 random bits [five bytes of a version 4
   UUID, all random] make the eight symbols; a collision with an
   earlier code, rare but possible, simply draws again. */
create function private.new_public_id()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
    v_bytes bytea;
    v_value bigint;
    v_body  text;
    v_code  text;
begin
    loop
        v_bytes := uuid_send(gen_random_uuid());
        v_value := (get_byte(v_bytes, 0)::bigint << 32)
                 | (get_byte(v_bytes, 1)::bigint << 24)
                 | (get_byte(v_bytes, 2)::bigint << 16)
                 | (get_byte(v_bytes, 3)::bigint << 8)
                 |  get_byte(v_bytes, 4)::bigint;
        v_body := private.crockford_encode(v_value, 8);
        v_code := 'LIJ-' || v_body || private.public_id_check_symbol(v_body);
        begin
            insert into private.issued_public_ids (code) values (v_code);
            return v_code;
        exception when unique_violation then
            null; -- already issued: draw again
        end;
    end loop;
end;
$$;

/* True only inside restore_backup[], which sets this flag for its own
   transaction. No API request can set it: the API exposes no function
   that calls set_config[] or runs SQL. As a second guard, the flag
   counts only for the trusted backend or an admin, so a session that
   somehow set it as anyone else still meets every rule of 0002. */
create function private.restoring()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(current_setting('ligurian.restoring', true), '') = 'on'
       and (auth.uid() is null or private.user_role() = 'admin');
$$;

/* A session that claims to be a client but carries no user id: a token
   with the role anon or authenticated and no subject. It must never be
   taken for the trusted backend. */
create function private.is_anonymous_client()
returns boolean
language sql
stable
set search_path = ''
as $$
    select auth.uid() is null
       and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
           in ('anon', 'authenticated');
$$;

/* ====================================================================
   The identifiers of the entries that already exist. Ordinary updates,
   on purpose: each one raises the version and writes its history.
   ==================================================================== */

alter table public.lemmas    add column public_id text;
alter table public.wordforms add column public_id text;

update public.lemmas    set public_id = private.new_public_id() where public_id is null;
update public.wordforms set public_id = private.new_public_id() where public_id is null;

alter table public.lemmas    alter column public_id set not null;
alter table public.wordforms alter column public_id set not null;

alter table public.lemmas
    add constraint lemmas_public_id_valid check (private.public_id_is_valid(public_id));
alter table public.wordforms
    add constraint wordforms_public_id_valid check (private.public_id_is_valid(public_id));

create unique index lemmas_public_id    on public.lemmas (public_id);
create unique index wordforms_public_id on public.wordforms (public_id);

/* ====================================================================
   From now on the database gives every new entry its code and keeps
   it: a value sent by a client is overwritten, like id or version.
   Only a restore keeps the code a backup carries, and registers it so
   that it can never be drawn again.
   ==================================================================== */

create function private.assign_public_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        if private.restoring() then
            if new.public_id is null or not private.public_id_is_valid(new.public_id) then
                raise exception 'invalid public identifier % in the backup', coalesce(new.public_id, 'null')
                    using errcode = '23514';
            end if;
            /* Unique across both tables, as when the database draws it. */
            if exists (select 1 from public.lemmas where public_id = new.public_id)
               or exists (select 1 from public.wordforms where public_id = new.public_id) then
                raise exception 'public identifier % appears twice in the backup', new.public_id
                    using errcode = '23505';
            end if;
            /* Already registered after a restore into the same project. */
            insert into private.issued_public_ids (code) values (new.public_id)
            on conflict (code) do nothing;
        else
            new.public_id := private.new_public_id();
        end if;
    else
        new.public_id := old.public_id;
    end if;
    return new;
end;
$$;

create trigger lemmas_public_id    before insert or update on public.lemmas
    for each row execute function private.assign_public_id();
create trigger wordforms_public_id before insert or update on public.wordforms
    for each row execute function private.assign_public_id();

/* ====================================================================
   The triggers of 0002 that a restore must not run: it brings its own
   bookkeeping, its own base forms and its own history. Each function
   is 0002's, unchanged, plus the first statement of its body.
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

    /* The parent must exist and be live, whoever inserts. */
    if tg_table_name in ('wordforms', 'senses') then
        select * into v_lemma from public.lemmas where id = new.lemma_id;
        if v_lemma.id is null or v_lemma.deleted_at is not null then
            raise exception 'lemma % does not exist or is deleted', new.lemma_id
                using errcode = '23503';
        end if;
    elsif tg_table_name = 'glosses' then
        select * into v_sense from public.senses where id = new.sense_id;
        if v_sense.id is not null then
            select * into v_lemma from public.lemmas where id = v_sense.lemma_id;
        end if;
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

create or replace function private.lemma_sync_base_form()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    /* A restore brings the base forms with the other wordforms. */
    if private.restoring() then
        return null;
    end if;

    if tg_op = 'INSERT' then
        insert into public.wordforms (lemma_id, form, is_base, status)
        values (new.id, new.headword, true, new.status);
    elsif new.headword is distinct from old.headword
          or new.status is distinct from old.status then
        if new.headword is distinct from old.headword and exists (
            select 1 from public.wordforms
            where lemma_id = new.id and form = new.headword
              and not is_base and deleted_at is null
        ) then
            raise exception 'lemma % already has a wordform spelled %; delete it before renaming the headword',
                new.id, new.headword
                using errcode = '23505';
        end if;
        update public.wordforms
        set form = new.headword, status = new.status
        where lemma_id = new.id and is_base and deleted_at is null;
    end if;
    return null;
end;
$$;

create or replace function private.lexicon_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_action text;
begin
    /* A restore copies the history itself, row by row. */
    if private.restoring() then
        return null;
    end if;

    if tg_op = 'INSERT' then
        v_action := 'insert';
    elsif old.deleted_at is null and new.deleted_at is not null then
        v_action := 'soft_delete';
    elsif old.deleted_at is not null and new.deleted_at is null then
        v_action := 'restore';
    else
        v_action := 'update';
    end if;

    insert into public.audit_log (table_name, row_id, action, actor, old_row, new_row)
    values (
        tg_table_name,
        new.id,
        v_action,
        auth.uid(),
        case when tg_op = 'UPDATE' then to_jsonb(old) end,
        to_jsonb(new)
    );

    return null;
end;
$$;

/* ====================================================================
   Backup: one JSON document with every table needed to rebuild the
   dictionary. Security invoker: an admin already sees every row of
   these tables, so the function needs no privilege of its own.
   ==================================================================== */

create function public.export_backup()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
    v_tables jsonb;
begin
    if private.is_anonymous_client()
       or (auth.uid() is not null and private.user_role() is distinct from 'admin') then
        raise exception 'only admins may download a backup' using errcode = '42501';
    end if;

    v_tables := jsonb_build_object(
        'varieties',       (select coalesce(jsonb_agg(to_jsonb(t) order by t.code), '[]') from public.varieties as t),
        'orthographies',   (select coalesce(jsonb_agg(to_jsonb(t) order by t.code), '[]') from public.orthographies as t),
        'gloss_languages', (select coalesce(jsonb_agg(to_jsonb(t) order by t.code), '[]') from public.gloss_languages as t),
        'profiles',        (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.user_id), '[]') from public.profiles as t),
        'lemmas',          (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') from public.lemmas as t),
        'wordforms',       (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') from public.wordforms as t),
        'senses',          (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') from public.senses as t),
        'glosses',         (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') from public.glosses as t),
        'audit_log',       (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') from public.audit_log as t)
    );

    return jsonb_build_object(
        'format',         'ligurian-keyboard-backup',
        'format_version', 1,
        'created_at',     now(),
        'license',        'Lexicon data: CC BY-SA 4.0. Profiles and history: private to the project.',
        'counts',         (select jsonb_object_agg(key, jsonb_array_length(value)) from jsonb_each(v_tables)),
        'tables',         v_tables
    );
end;
$$;

revoke all on function public.export_backup() from public, anon, authenticated;
grant execute on function public.export_backup() to authenticated;

/* ====================================================================
   Restore: only into a database with no lexicon rows and no history at
   all, deleted ones included, so that it can never overwrite or mix
   with live data. Ids, codes, versions, dates, authors and history are
   kept exactly as backed up; the identity counters then continue after
   the highest id restored.
   An author whose account does not exist here is replaced by null and
   counted; the history still names them by id, and the backup still
   holds their profile. The person restoring keeps their own role.
   Through the API, Supabase stops any statement after a few seconds:
   a large backup is restored from the SQL Editor instead.
   ==================================================================== */

create function public.restore_backup(p_backup jsonb)
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
                               status, version, created_by, created_at, updated_at, deleted_at)
    overriding system value
    select b.id, b.public_id, b.headword, b.variety, b.orthography, b.part_of_speech, b.note,
           b.status, b.version,
           (select u.id from auth.users as u where u.id = b.created_by),
           b.created_at, b.updated_at, b.deleted_at
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

revoke all on function public.restore_backup(jsonb) from public, anon, authenticated;
grant execute on function public.restore_backup(jsonb) to authenticated;

/* ====================================================================
   Privileges of the new private functions. The pure Crockford helpers
   are harmless and serve the check constraints, which run as whoever
   inserts; the rest is reachable only through the functions above.
   ==================================================================== */

revoke all on function private.crockford_encode(bigint, integer) from public, anon, authenticated;
revoke all on function private.crockford_decode(text) from public, anon, authenticated;
revoke all on function private.public_id_check_symbol(text) from public, anon, authenticated;
revoke all on function private.public_id_is_valid(text) from public, anon, authenticated;
revoke all on function private.new_public_id() from public, anon, authenticated;
revoke all on function private.restoring() from public, anon, authenticated;
revoke all on function private.is_anonymous_client() from public, anon, authenticated;
revoke all on function private.assign_public_id() from public, anon, authenticated;
revoke all on table private.issued_public_ids from public, anon, authenticated;

grant execute on function private.crockford_decode(text) to anon, authenticated;
grant execute on function private.public_id_check_symbol(text) to anon, authenticated;
grant execute on function private.public_id_is_valid(text) to anon, authenticated;
-- export_backup[] runs as the admin who calls it, and asks this first.
grant execute on function private.is_anonymous_client() to authenticated;
