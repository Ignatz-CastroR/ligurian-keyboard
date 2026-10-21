/*
 * 0013_grammar.sql
 * Author:    Eng. José Ignacio Castro de R. and contributors
 * Date:      2026/10/21, 12:22:52, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:   Grammar in structured fields, released as 0.16.0 [decision
 *            0039]:
 *              the lists of values, as tables: genders, numbers,
 *              persons, verb forms, conjugation classes, auxiliaries;
 *              another value is one insert, never a change of code;
 *              on every lemma: the headword's own gender, number, person
 *              and verb form; invariable; and for verbs, conjugation
 *              class, auxiliary and pronominal;
 *              on every form: a list of readings, each a gender, number,
 *              person and verb form, since one spelling may stand for
 *              several [parla: present indicative and imperative]; the
 *              base form's first reading is its lemma's, kept in step as
 *              its spelling and status are, and more may follow;
 *              the part of speech "determiner".
 *            And two repairs of 0.15.0's documented limits [decision
 *            0040]:
 *              user_history[] names the fields an update set to null, so
 *              that a review date cleared no longer reads as a review;
 *              two live senses of a lemma may not share a number, as
 *              before, but the rule is checked at the end of each
 *              statement, and inside a regrouping at its end, so a kept
 *              sense moves straight to its final number, with one line
 *              of history.
 *            Replaced to carry the new columns: the base form's sync and
 *            guard, the review queue's rows, backup and restore.
 * Contract:  Run once, after 0001 to 0012, BEFORE pushing the code of
 *            0.16.0: its lexicon manager reads and writes the new
 *            columns. Download a backup first. Nothing in the existing
 *            data changes: every new column starts empty or false.
 *            Run the whole file at once, as the SQL Editor does: it is
 *            then one transaction, and a failure leaves nothing behind.
 * Decision:  docs/decisions/0039-grammar-in-structured-fields.md and
 *            docs/decisions/0040-two-limits-of-the-sense-review-lifted.md
 */

/* ====================================================================
   The lists of values. Each is a small table, readable by everyone, as
   the varieties and spelling systems are: code, name and position in
   menus. The general categories [gender, number, person, verb form]
   are named in the lexicon manager's three languages; the codes of the
   others [conjugation classes, auxiliaries] are Ligurian and are shown
   as they are. Values come from a speaker, never from a guess
   [decision 0039]; a value is added by an insert from the SQL Editor.
   ==================================================================== */

create table public.grammar_genders (
    code     text primary key check (code is nfc normalized and length(code) between 1 and 20),
    name     text not null check (length(name) between 1 and 80),
    position integer not null unique
);

create table public.grammar_numbers (like public.grammar_genders including all);
create table public.grammar_persons (like public.grammar_genders including all);
create table public.verb_forms (like public.grammar_genders including all);
create table public.conjugation_classes (like public.grammar_genders including all);
create table public.auxiliaries (like public.grammar_genders including all);

insert into public.grammar_genders (code, name, position) values
    ('m',  'maschile', 1),
    ('f',  'femminile', 2),
    ('mf', 'maschile e femminile', 3);

insert into public.grammar_numbers (code, name, position) values
    ('sg', 'singolare', 1),
    ('pl', 'plurale', 2);

insert into public.grammar_persons (code, name, position) values
    ('1', 'prima', 1),
    ('2', 'seconda', 2),
    ('3', 'terza', 3);

/* The simple forms only: a compound tense follows from the auxiliary
   and the past participle, and is never stored. "ind_past" is the past
   historic, the simple past [Italian passato remoto]. */
insert into public.verb_forms (code, name, position) values
    ('inf',       'infinito', 1),
    ('ptcp_pres', 'participio presente', 2),
    ('ptcp_past', 'participio passato', 3),
    ('ger',       'gerundio', 4),
    ('ind_pres',  'indicativo presente', 5),
    ('ind_impf',  'indicativo imperfetto', 6),
    ('ind_past',  'passato remoto', 7),
    ('ind_fut',   'indicativo futuro', 8),
    ('cond',      'condizionale', 9),
    ('subj_pres', 'congiuntivo presente', 10),
    ('subj_impf', 'congiuntivo imperfetto', 11),
    ('imp',       'imperativo', 12);

insert into public.conjugation_classes (code, name, position) values
    ('-â',  '-â', 1),
    ('-ê',  '-ê', 2),
    ('-î',  '-î', 3),
    ('-éi', '-éi', 4);

insert into public.auxiliaries (code, name, position) values
    ('avéi', 'avéi', 1),
    ('êse',  'êse', 2);

alter table public.grammar_genders     enable row level security;
alter table public.grammar_numbers     enable row level security;
alter table public.grammar_persons     enable row level security;
alter table public.verb_forms          enable row level security;
alter table public.conjugation_classes enable row level security;
alter table public.auxiliaries         enable row level security;

create policy grammar_genders_read on public.grammar_genders
    for select to anon, authenticated using (true);
create policy grammar_numbers_read on public.grammar_numbers
    for select to anon, authenticated using (true);
create policy grammar_persons_read on public.grammar_persons
    for select to anon, authenticated using (true);
create policy verb_forms_read on public.verb_forms
    for select to anon, authenticated using (true);
create policy conjugation_classes_read on public.conjugation_classes
    for select to anon, authenticated using (true);
create policy auxiliaries_read on public.auxiliaries
    for select to anon, authenticated using (true);

/* Supabase grants every new table to its API roles; these are read
   only, as the other lists are. */
revoke all on public.grammar_genders, public.grammar_numbers, public.grammar_persons,
              public.verb_forms, public.conjugation_classes, public.auxiliaries
    from anon, authenticated;
grant select on public.grammar_genders, public.grammar_numbers, public.grammar_persons,
                public.verb_forms, public.conjugation_classes, public.auxiliaries
    to anon, authenticated;

/* ====================================================================
   The columns. All optional: no loaded entry has any grammar yet.
   A lemma's gender, number, person and verb form are its headword's,
   its own reading, which its base form carries first; conjugation
   class, auxiliary and pronominal belong to verbs only.
   ==================================================================== */

alter table public.lemmas
    add column gender      text references public.grammar_genders (code),
    add column number      text references public.grammar_numbers (code),
    add column person      text references public.grammar_persons (code),
    add column verb_form   text references public.verb_forms (code),
    add column invariable  boolean not null default false,
    add column conjugation text references public.conjugation_classes (code),
    add column auxiliary   text references public.auxiliaries (code),
    add column pronominal  boolean not null default false;

/* coalesce, since a check that comes out null passes: a lemma with no
   part of speech must not carry a verb's properties either. */
alter table public.lemmas
    add constraint lemmas_verb_grammar
    check (coalesce(part_of_speech, '') = 'verb'
           or (conjugation is null and auxiliary is null and not pronominal));

/* ====================================================================
   A form's readings. One spelling may stand for several sets of
   values: "parla" is the present indicative, third person singular,
   and the imperative, second person singular. So a form holds a list,
   in the order given, each reading an object with the four keys:

     [{"gender": null, "number": "sg", "person": "3", "verb_form": "ind_pres"},
      {"gender": null, "number": "sg", "person": "2", "verb_form": "imp"}]

   The list belongs to its form: reviewed, versioned and kept in the
   history with it, never a row of its own [decision 0039]. Every code
   is checked against its list when written, and a code a reading uses
   may not leave its list.
   ==================================================================== */

alter table public.wordforms
    add column readings jsonb not null default '[]'::jsonb;

/* One reading, in its stored shape: the four keys, null where no value
   is given; null when no value is given at all. */
create function private.reading_of(p_gender text, p_number text, p_person text, p_verb_form text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
    select case when coalesce(p_gender, p_number, p_person, p_verb_form) is null then null
                else jsonb_build_object('gender', p_gender, 'number', p_number,
                                        'person', p_person, 'verb_form', p_verb_form)
           end;
$$;

/* A list of readings as written, checked and put in its stored shape:
   null is an empty list; each reading an object with no key but the
   four, each value null or a code of its list [NFC], at least one value
   given, no reading twice, at most 32. Any fault is refused, naming the
   reading by its place. */
create function private.canonical_readings(p_readings jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
    v_out     jsonb := '[]'::jsonb;
    v_item    jsonb;
    v_place   integer := 0;
    v_bad     text;
    v_key     text;
    v_list    text;
    v_code    text;
    v_found   boolean;
    v_codes   jsonb;
    v_reading jsonb;
begin
    if p_readings is null or jsonb_typeof(p_readings) = 'null' then
        return '[]'::jsonb;
    end if;
    if jsonb_typeof(p_readings) <> 'array' then
        raise exception 'the readings of a form must be a JSON list' using errcode = '22023';
    end if;
    if jsonb_array_length(p_readings) > 32 then
        raise exception 'a form has at most 32 readings' using errcode = '22023';
    end if;

    for v_item in select value from jsonb_array_elements(p_readings) loop
        v_place := v_place + 1;
        if jsonb_typeof(v_item) <> 'object' then
            raise exception 'reading %: it must be an object such as {"gender": "f", "number": "pl"}', v_place
                using errcode = '22023';
        end if;
        select string_agg(k, ', ' order by k) into v_bad
        from jsonb_object_keys(v_item) as k
        where k not in ('gender', 'number', 'person', 'verb_form');
        if v_bad is not null then
            raise exception 'reading %: unknown key: %', v_place, v_bad using errcode = '22023';
        end if;

        v_codes := '{}'::jsonb;
        for v_key, v_list in
            select t.k, t.l
            from (values ('gender', 'grammar_genders'), ('number', 'grammar_numbers'),
                         ('person', 'grammar_persons'), ('verb_form', 'verb_forms')) as t(k, l)
        loop
            if coalesce(jsonb_typeof(v_item -> v_key), 'null') <> 'null' then
                if jsonb_typeof(v_item -> v_key) <> 'string' then
                    raise exception 'reading %: "%" must be a code, written in quotes', v_place, v_key
                        using errcode = '22023';
                end if;
                v_code := normalize(v_item ->> v_key, NFC);
                execute format('select exists (select 1 from public.%I where code = $1)', v_list)
                    into v_found using v_code;
                if not v_found then
                    raise exception 'reading %: "%" is not a value of %', v_place, v_code, v_list
                        using errcode = '22023';
                end if;
                v_codes := v_codes || jsonb_build_object(v_key, v_code);
            end if;
        end loop;

        v_reading := private.reading_of(v_codes ->> 'gender', v_codes ->> 'number',
                                        v_codes ->> 'person', v_codes ->> 'verb_form');
        if v_reading is null then
            raise exception 'reading %: it gives no value', v_place using errcode = '22023';
        end if;
        if exists (select 1 from jsonb_array_elements(v_out) as e(r) where e.r = v_reading) then
            raise exception 'reading %: the same reading is given twice', v_place using errcode = '22023';
        end if;
        v_out := v_out || jsonb_build_array(v_reading);
    end loop;

    return v_out;
end;
$$;

/* Every form's readings, checked and stored in their shape. */
create function private.wordform_readings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.readings := private.canonical_readings(new.readings);
    return new;
end;
$$;

create trigger wordforms_readings before insert or update of readings on public.wordforms
    for each row execute function private.wordform_readings();

/* A code a form's reading uses may not leave its list, nor change: the
   lemmas' columns have foreign keys for that; the readings, a list
   inside the form, have this. TG_ARGV[0] is the reading's key. */
create function private.grammar_code_in_use()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if (tg_op = 'DELETE' or new.code is distinct from old.code)
       and exists (select 1 from public.wordforms as w
                   where w.readings @> jsonb_build_array(jsonb_build_object(tg_argv[0], old.code))) then
        raise exception 'the value % is used by the readings of forms; it may not be removed or renamed', old.code
            using errcode = '23503';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger grammar_genders_in_use before update or delete on public.grammar_genders
    for each row execute function private.grammar_code_in_use('gender');
create trigger grammar_numbers_in_use before update or delete on public.grammar_numbers
    for each row execute function private.grammar_code_in_use('number');
create trigger grammar_persons_in_use before update or delete on public.grammar_persons
    for each row execute function private.grammar_code_in_use('person');
create trigger verb_forms_in_use before update or delete on public.verb_forms
    for each row execute function private.grammar_code_in_use('verb_form');

revoke all on function private.reading_of(text, text, text, text) from public, anon, authenticated;
revoke all on function private.canonical_readings(jsonb) from public, anon, authenticated;
revoke all on function private.wordform_readings() from public, anon, authenticated;
revoke all on function private.grammar_code_in_use() from public, anon, authenticated;

/* The part of speech "determiner": demonstratives, possessives and the
   like, which take person, gender and number. */
alter table public.lemmas drop constraint lemmas_part_of_speech_check;
alter table public.lemmas
    add constraint lemmas_part_of_speech_check
    check (part_of_speech in
           ('noun', 'verb', 'adjective', 'adverb', 'pronoun', 'determiner',
            'article', 'preposition', 'conjunction',
            'interjection', 'numeral', 'proper_noun', 'other'));

/* ====================================================================
   Sense numbers: one live sense per number in a lemma, as 0001's
   unique index said, now as a constraint that a transaction may check
   at its end. By default it is checked at the end of each statement,
   where the index checked each row: one statement that swaps two
   numbers is now accepted, since the rule holds when it ends. Only
   regroup_senses[] defers it to later, while senses move, and checks
   it before it returns. Breaking it is SQLSTATE 23P01.
   ==================================================================== */

drop index public.senses_unique_live;
alter table public.senses
    add constraint senses_one_live_number
    exclude using btree (lemma_id with =, sense_number with =)
    where (deleted_at is null)
    deferrable initially immediate;

/* ====================================================================
   0012's update trigger, unchanged but for the base form's guard: the
   base form's first reading follows its lemma like its spelling and
   status, so only the lemma trigger changes it.
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
    v_head jsonb;
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

    /* The base form follows its lemma; only the lemma trigger moves it.
       Its first reading is its lemma's, when the lemma has one: the
       readings after it may change, that one only with the lemma. */
    if tg_table_name = 'wordforms' then
        new.is_base := old.is_base;
        if old.is_base and pg_trigger_depth() = 1 and (
               new.form is distinct from old.form
            or new.status is distinct from old.status
            or new.deleted_at is distinct from old.deleted_at) then
            raise exception 'the base form follows its lemma; edit the lemma instead'
                using errcode = '42501';
        end if;
        if old.is_base and pg_trigger_depth() = 1 and new.readings is distinct from old.readings then
            select private.reading_of(l.gender, l.number, l.person, l.verb_form) into v_head
            from public.lemmas as l
            where l.id = old.lemma_id;
            /* A conflict: most often the page was read before the
               lemma changed; reloading shows the lemma's reading. */
            if v_head is not null and (private.canonical_readings(new.readings) -> 0) is distinct from v_head then
                raise exception 'the first reading of a base form is its lemma''s; reload, or edit the lemma instead'
                    using errcode = '40001';
            end if;
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
   0006's base form sync, unchanged but for the grammar: the base form
   is created with its lemma's reading as its first, and when that
   reading changes, its first reading changes with it. Its other
   readings stay. When the lemma's new reading is already one of them,
   the two change places, the old one staying among the others, so that
   a change and its undo lose nothing; otherwise the old one is
   replaced, as a correction is.
   ==================================================================== */

/* A base form's readings when its lemma's reading goes from p_old to
   p_new [either may be null]. The old one leaves the head of the list;
   the new one, if any, takes it. If the new one was already among the
   others, the old one takes its place there: the two change places. A
   reading is never kept twice. */
create function private.base_readings(p_readings jsonb, p_old jsonb, p_new jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
    v_head  boolean := p_old is not null and (p_readings -> 0) = p_old;
    v_rest  jsonb := '[]'::jsonb;
    v_item  jsonb;
    v_place integer := 0;
    v_swap  boolean;
begin
    for v_item in select value from jsonb_array_elements(coalesce(p_readings, '[]'::jsonb)) loop
        v_place := v_place + 1;
        if not (v_place = 1 and v_head) then
            v_rest := v_rest || jsonb_build_array(v_item);
        end if;
    end loop;
    if p_new is null then
        return v_rest;
    end if;
    v_swap := v_head and exists (select 1 from jsonb_array_elements(v_rest) as e(r) where e.r = p_new);
    return jsonb_build_array(p_new)
           || coalesce((select jsonb_agg(case when e.r = p_new then p_old else e.r end order by e.i)
                        from jsonb_array_elements(v_rest) with ordinality as e(r, i)
                        where v_swap or e.r <> p_new), '[]'::jsonb);
end;
$$;

revoke all on function private.base_readings(jsonb, jsonb, jsonb) from public, anon, authenticated;

create or replace function private.lemma_sync_base_form()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_old jsonb;
    v_new jsonb := private.reading_of(new.gender, new.number, new.person, new.verb_form);
begin
    /* A restore brings the base forms with the other wordforms. */
    if private.restoring() then
        return null;
    end if;

    if tg_op = 'INSERT' then
        insert into public.wordforms (lemma_id, form, is_base, status, readings)
        values (new.id, new.headword, true, new.status,
                case when v_new is null then '[]'::jsonb else jsonb_build_array(v_new) end);
    else
        v_old := private.reading_of(old.gender, old.number, old.person, old.verb_form);
        if new.headword is distinct from old.headword
           or new.status is distinct from old.status
           or v_new is distinct from v_old then
            if new.headword is distinct from old.headword and exists (
                select 1 from public.wordforms
                where lemma_id = new.id and form = new.headword
                  and not is_base and deleted_at is null
            ) then
                raise exception 'lemma % already has a wordform spelled %; delete it before renaming the headword',
                    new.id, new.headword
                    using errcode = '23505';
            end if;
            update public.wordforms as w
            set form = new.headword, status = new.status,
                readings = case when v_new is not distinct from v_old then w.readings
                                else private.base_readings(w.readings, v_old, v_new) end
            where w.lemma_id = new.id and w.is_base and w.deleted_at is null;
        end if;
    end if;
    return null;
end;
$$;

/* ====================================================================
   regroup_senses, as in 0012, but for the numbers: each kept sense goes
   straight to its final number, with one line of history, under the
   sense number constraint deferred until the senses have moved; it is
   checked before the function returns. No temporary number is used.
   ==================================================================== */

create or replace function public.regroup_senses(p_lemma_id bigint, p_seen jsonb, p_groups jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
    c_max_senses constant integer := 100;
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

    perform set_config('ligurian.regrouping', 'on', true);

    /* Two live senses of a lemma may share a number while the senses
       move, and must not once they have moved: the check waits for the
       end of this call [below], so that each kept sense goes straight to
       its final number, with one line of history. */
    set constraints public.senses_one_live_number deferred;

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

    /* 3. The kept senses: their final number, and a new definition if one
          was given. */
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
                set sense_number = k,
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

    /* 5. No two live senses share a number now: checked here, at once.
          The rule is then checked at once for the rest of the
          transaction, whatever a caller of the SQL Editor had set. */
    set constraints public.senses_one_live_number immediate;

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
   The review queue's rows, as in 0010, with the grammar of lemmas and
   forms [a lemma's whole grammar and its base form's readings, which
   are approved with it; a form's readings; nulls elsewhere], so that a
   reviewer sees what is approved. Dropped and
   created again, since its columns change; review_queue_page[] reads it
   by name and returns each row whole, the new columns included.
   ==================================================================== */

drop function private.review_pending();

create function private.review_pending()
returns table (
    kind text, id bigint, lemma_id bigint, text text, created_by uuid, created_at timestamptz,
    version integer, lemma_headword text, lemma_status public.review_status, lemma_public_id text,
    sense_id bigint, sense_number integer, definition_it text, language text, gloss text,
    gender text, number text, person text, verb_form text,
    invariable boolean, conjugation text, auxiliary text, pronominal boolean, readings jsonb)
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
               null::text as language, null::text as gloss,
               l.gender, l.number, l.person, l.verb_form,
               l.invariable, l.conjugation, l.auxiliary, l.pronominal,
               (select w.readings from public.wordforms as w
                where w.lemma_id = l.id and w.is_base and w.deleted_at is null
                limit 1) as readings
        from public.lemmas as l
        where l.status = 'pending' and l.deleted_at is null
        union all
        select 'wordform', w.id, w.lemma_id, w.form::text, w.created_by, w.created_at, w.version,
               l.headword::text, l.status, l.public_id,
               l.status = 'approved' or l.created_by = (select uid from viewer),
               null, null, null, false, null, null,
               null, null, null, null,
               null, null, null, null, w.readings
        from public.wordforms as w
        join public.lemmas as l on l.id = w.lemma_id and l.deleted_at is null
        where w.status = 'pending' and w.deleted_at is null and not w.is_base
        union all
        select 'sense', s.id, s.lemma_id, s.sense_number || '. ' || coalesce(s.definition_it, ''),
               s.created_by, s.created_at, s.version,
               l.headword::text, l.status, l.public_id,
               l.status = 'approved' or l.created_by = (select uid from viewer),
               s.id, s.sense_number, s.definition_it, true, null, null,
               null, null, null, null,
               null, null, null, null, null
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
               g.language, g.gloss,
               null, null, null, null,
               null, null, null, null, null
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
           r.language, r.gloss,
           r.gender, r.number, r.person, r.verb_form,
           r.invariable, r.conjugation, r.auxiliary, r.pronominal, r.readings
    from rows as r, viewer as v
    where not v.anonymous
      and (v.everything or (v.uid is not null and r.created_by = v.uid));
$$;

revoke all on function private.review_pending() from public, anon, authenticated;

/* ====================================================================
   user_history, as in 0011, with "cleared": the fields an update set
   to null, so that a page can tell a value set from a value removed,
   such as a review date set and one cleared. Dropped and created again,
   since its columns change.
   ==================================================================== */

drop function public.user_history(uuid, bigint, integer);

create function public.user_history(p_user uuid, p_before bigint default null, p_limit integer default 100)
returns table (
    id bigint, table_name text, row_id bigint, action text, at timestamptz,
    label text, status text, lemma_id bigint, changed text[], cleared text[])
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
               end,
               case when a.action = 'update' then
                   array(select k from jsonb_object_keys(a.new_row) as k
                         where a.new_row -> k is distinct from a.old_row -> k
                           and a.new_row -> k = 'null'::jsonb
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

revoke all on function public.user_history(uuid, bigint, integer) from public, anon, authenticated;
grant execute on function public.user_history(uuid, bigint, integer) to authenticated;

/* ====================================================================
   Backup and restore, as before, with the grammar: the six lists in the
   file, and the new columns of lemmas and forms. A backup made before
   0.16.0 has neither: its lists are those this migration wrote, and
   its entries restore with no grammar. Replacing a function clears its
   time limit, which is set again.
   ==================================================================== */

create or replace function public.export_backup()
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
        'grammar_genders', (select coalesce(jsonb_agg(to_jsonb(t) order by t.code), '[]') from public.grammar_genders as t),
        'grammar_numbers', (select coalesce(jsonb_agg(to_jsonb(t) order by t.code), '[]') from public.grammar_numbers as t),
        'grammar_persons', (select coalesce(jsonb_agg(to_jsonb(t) order by t.code), '[]') from public.grammar_persons as t),
        'verb_forms',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.code), '[]') from public.verb_forms as t),
        'conjugation_classes', (select coalesce(jsonb_agg(to_jsonb(t) order by t.code), '[]') from public.conjugation_classes as t),
        'auxiliaries',     (select coalesce(jsonb_agg(to_jsonb(t) order by t.code), '[]') from public.auxiliaries as t),
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
    v_list             text;
    v_bad_form         text;
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
       )
       -- The grammar's lists may be missing [a backup made before 0.16.0],
       -- but a list given must be a list.
       or exists (
           select 1
           from unnest(array['grammar_genders', 'grammar_numbers', 'grammar_persons',
                             'verb_forms', 'conjugation_classes', 'auxiliaries']) as k(name)
           where v_tables ? k.name and jsonb_typeof(v_tables -> k.name) is distinct from 'array'
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
    /* The grammar's lists [0.16.0]; a backup made before has none. A code
       already here keeps its name and place; a code missing here is
       added after the last value, in the backup's order, since its
       place in the backup may be taken here by another value. */
    foreach v_list in array array['grammar_genders', 'grammar_numbers', 'grammar_persons',
                                  'verb_forms', 'conjugation_classes', 'auxiliaries'] loop
        execute format(
            'insert into public.%1$I (code, name, position)
             select b.code, b.name,
                    (select coalesce(max(t.position), 0) from public.%1$I as t)
                    + row_number() over (order by b.position, b.code)
             from jsonb_populate_recordset(null::public.%1$I, $1) as b
             where not exists (select 1 from public.%1$I as t where t.code = b.code)',
            v_list)
        using coalesce(v_tables -> v_list, '[]'::jsonb);
    end loop;

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
                               senses_review_needed, senses_reviewed_at,
                               gender, number, person, verb_form, invariable, conjugation, auxiliary, pronominal)
    overriding system value
    select b.id, b.public_id, b.headword, b.variety, b.orthography, b.part_of_speech, b.note,
           b.status, b.version,
           (select u.id from auth.users as u where u.id = b.created_by),
           b.created_at, b.updated_at, b.deleted_at,
           coalesce(b.senses_review_needed, false), b.senses_reviewed_at,
           b.gender, b.number, b.person, b.verb_form, coalesce(b.invariable, false),
           b.conjugation, b.auxiliary, coalesce(b.pronominal, false)
    from jsonb_populate_recordset(null::public.lemmas, coalesce(v_tables -> 'lemmas', '[]')) as b
    order by b.id;
    get diagnostics v_count = row_count;
    v_restored := v_restored || jsonb_build_object('lemmas', v_count);

    insert into public.wordforms (id, public_id, lemma_id, form, is_base, grammatical_tag, freq,
                                  status, version, created_by, created_at, updated_at, deleted_at,
                                  readings)
    overriding system value
    select b.id, b.public_id, b.lemma_id, b.form, b.is_base, b.grammatical_tag, b.freq,
           b.status, b.version,
           (select u.id from auth.users as u where u.id = b.created_by),
           b.created_at, b.updated_at, b.deleted_at,
           coalesce(b.readings, '[]'::jsonb)
    from jsonb_populate_recordset(null::public.wordforms, coalesce(v_tables -> 'wordforms', '[]')) as b
    order by b.id;
    get diagnostics v_count = row_count;
    v_restored := v_restored || jsonb_build_object('wordforms', v_count);

    /* A live base form begins with its lemma's reading, when the lemma
       has one: a backup that says otherwise was not written by
       export_backup[] and is refused. */
    select w.public_id into v_bad_form
    from public.wordforms as w
    join public.lemmas as l on l.id = w.lemma_id
    where w.is_base and w.deleted_at is null
      and private.reading_of(l.gender, l.number, l.person, l.verb_form) is not null
      and (w.readings -> 0) is distinct from private.reading_of(l.gender, l.number, l.person, l.verb_form)
    limit 1;
    if v_bad_form is not null then
        raise exception 'the base form % does not begin with its lemma''s reading', v_bad_form
            using errcode = '22023';
    end if;

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

alter function public.export_backup() set statement_timeout = '60s';
alter function public.restore_backup(jsonb) set statement_timeout = '60s';
