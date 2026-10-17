/*
 * 0002_rules_and_history.sql
 * Author:    Ignatz-CastroR and contributors
 * Date:      2026/10/10, 19:25:13, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:   Triggers that enforce the editing rules no client can be
 *            trusted to respect, and that write the audit history.
 * Contract:  A session without a user id [auth.uid[] is null] is a
 *            trusted backend: the Supabase service role, the SQL editor,
 *            a migration or a test fixture. Rules about roles apply only
 *            to sessions that carry a user id.
 *            Row level security [0003] decides WHICH rows a user may
 *            touch; these triggers decide WHAT a user may change in them.
 */

/* ====================================================================
   Role lookup
   ==================================================================== */

/* SECURITY DEFINER so that policies on profiles can call it without
   recursing into the policies of profiles itself. Returns null for a
   session without a user, or for a user who has no profile. */
create function private.user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
    select p.role
    from public.profiles as p
    where p.user_id = auth.uid();
$$;

/* True for reviewer and admin: the people who see and judge everything. */
create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(private.user_role() in ('reviewer', 'admin'), false);
$$;

/* ====================================================================
   Lexicon tables: lemmas, wordforms, senses, glosses
   ==================================================================== */

/* Shared by the four lexicon tables; tg_table_name tells them apart.
   pg_trigger_depth[] is 1 for a statement sent by a client and 2 or
   more for a statement issued by another trigger, which is how the
   automatic base form [see lemma_sync_base_form] is recognized. */
create function private.lexicon_before_insert()
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

create function private.lexicon_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_uid  uuid := auth.uid();
    v_role public.app_role := private.user_role();
begin
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
            if new.deleted_at is distinct from old.deleted_at then
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

/* Every lemma owns exactly one base wordform, spelled like its headword
   and sharing its review status, so that approving a lemma makes its
   own spelling suggestable at once. Created on insert; kept in step
   when the headword or the status changes. */
create function private.lemma_sync_base_form()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

create function private.forbid_hard_delete()
returns trigger
language plpgsql
as $$
begin
    raise exception 'hard deletes are disabled on %; set deleted_at instead', tg_table_name
        using errcode = '42501';
end;
$$;

/* One history row per change, whoever made it, trusted backend included. */
create function private.lexicon_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_action text;
begin
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

create trigger lemmas_before_insert    before insert on public.lemmas
    for each row execute function private.lexicon_before_insert();
create trigger lemmas_before_update    before update on public.lemmas
    for each row execute function private.lexicon_before_update();
create trigger lemmas_no_delete        before delete on public.lemmas
    for each row execute function private.forbid_hard_delete();
create trigger lemmas_audit            after insert or update on public.lemmas
    for each row execute function private.lexicon_audit();
create trigger lemmas_base_form        after insert or update on public.lemmas
    for each row execute function private.lemma_sync_base_form();

create trigger wordforms_before_insert before insert on public.wordforms
    for each row execute function private.lexicon_before_insert();
create trigger wordforms_before_update before update on public.wordforms
    for each row execute function private.lexicon_before_update();
create trigger wordforms_no_delete     before delete on public.wordforms
    for each row execute function private.forbid_hard_delete();
create trigger wordforms_audit         after insert or update on public.wordforms
    for each row execute function private.lexicon_audit();

create trigger senses_before_insert    before insert on public.senses
    for each row execute function private.lexicon_before_insert();
create trigger senses_before_update    before update on public.senses
    for each row execute function private.lexicon_before_update();
create trigger senses_no_delete        before delete on public.senses
    for each row execute function private.forbid_hard_delete();
create trigger senses_audit            after insert or update on public.senses
    for each row execute function private.lexicon_audit();

create trigger glosses_before_insert   before insert on public.glosses
    for each row execute function private.lexicon_before_insert();
create trigger glosses_before_update   before update on public.glosses
    for each row execute function private.lexicon_before_update();
create trigger glosses_no_delete       before delete on public.glosses
    for each row execute function private.forbid_hard_delete();
create trigger glosses_audit           after insert or update on public.glosses
    for each row execute function private.lexicon_audit();

/* The history itself is append only, even for the trusted backend. */
create function private.forbid_audit_change()
returns trigger
language plpgsql
as $$
begin
    raise exception 'audit_log is append only' using errcode = '42501';
end;
$$;

create trigger audit_log_append_only before update or delete on public.audit_log
    for each row execute function private.forbid_audit_change();

/* ====================================================================
   Profiles
   ==================================================================== */

/* Every new Supabase user gets a profile with the lowest role. An admin
   promotes trusted people; nobody can promote themselves. */
create function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (user_id, display_name)
    values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80));
    return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
    for each row execute function private.create_profile_for_new_user();

create function private.profiles_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.user_id    := old.user_id;
    new.created_at := old.created_at;
    new.updated_at := now();

    if new.role is distinct from old.role then
        if auth.uid() is not null and private.user_role() is distinct from 'admin' then
            raise exception 'only admins may change roles' using errcode = '42501';
        end if;
        if old.role = 'admin' and not exists (
            select 1 from public.profiles
            where role = 'admin' and user_id <> old.user_id
        ) then
            raise exception 'the last admin cannot be demoted' using errcode = '42501';
        end if;
    end if;

    return new;
end;
$$;

create trigger profiles_before_update before update on public.profiles
    for each row execute function private.profiles_before_update();
