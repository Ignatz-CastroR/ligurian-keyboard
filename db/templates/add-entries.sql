/*
 * add-entries.sql
 * Author:    Eng. José Ignacio Castro de R. and contributors
 * Date:      2026/10/19, 23:33:10, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:   2026/10/20, 00:17:06: a person is always required; unknown
 *            or repeated keys are refused; errors name the form or the
 *            translation; the examples are no longer live; the helpers
 *            are removed at the end of the run.
 * Updated:   2026/10/21, 12:22:52: grammar [migration 0013]: on the
 *            lemma "gender", "number", "person", "verb_form",
 *            "invariable", and for verbs "conjugation", "auxiliary" and
 *            "pronominal"; on each form "gender", "number", "person" and
 *            "verb_form"; a value not in its list is refused with the
 *            list.
 * Updated:   2026/10/21, 14:29:33: on each form "readings", a list of
 *            readings, instead of the four keys; a form spelled as the
 *            headword adds its readings to the base form; the codes of a
 *            list named in quotes.
 * Purpose:   Add whole entries from the Supabase SQL Editor in the right
 *            shape: a lemma, its inflected forms, and its senses, each
 *            sense with ALL its translations, in Italian, Spanish and
 *            English, every translation its own row with its own
 *            language. Until 0.17.0 brings import_entries[], this is
 *            the way to load words by SQL.
 * Usage:     1. Copy this whole file into a new query of the SQL Editor.
 *            2. In step 1 below, replace the zeros with the user id of
 *               the person whose words these are: Authentication, Users,
 *               their row, "User UID". The history then credits them,
 *               and their role's rules apply: a contributor's entries
 *               arrive pending.
 *            3. In step 3, write one line per entry, as in the examples.
 *            4. Press Run, with nothing selected.
 * Contract:  The whole run is one transaction: if any entry is refused,
 *            NOTHING is written, and the error names the headword and
 *            the form or translation at fault. Fix that line and run
 *            again. Entries are pending unless the entry says "status":
 *            "approved" and its author is a reviewer or an admin.
 *            Refused: a run without a person in step 1; a key the
 *            format does not know [a misspelt "definition", "pos"...]; a
 *            key written twice in one object; a translation holding ";".
 *            The helpers are removed at the end of the run [step 4], so
 *            nothing is added to the database's structure.
 * Format:    One JSON object per entry:
 *              {
 *                "headword": "pénna",               required
 *                "part_of_speech": "noun",           optional
 *                "variety": "zeneize",               optional
 *                "orthography": "ofiçiâ",            optional
 *                "note": "...",                      optional
 *                "status": "pending",                optional
 *                "gender": "f", "number": "sg",      optional, the
 *                "person": "3", "verb_form": "inf",  headword's own
 *                "invariable": false,                optional
 *                "conjugation": "-â", "auxiliary": "avéi",
 *                "pronominal": false,                verbs only
 *                "forms": [ {"form": "pénne", "tag": "pl.", "readings":
 *                            [{"gender": "f", "number": "pl"}]} ],
 *                "senses": [
 *                  { "definition_it": "...",          optional
 *                    "translations": {"it": [...], "es": [...], "en": [...]} }
 *                ]
 *              }
 *            Several translations of one sense in one language go in one
 *            list, ["penna", "stilografica"]; a different meaning is a
 *            different sense. A form may stand for several readings:
 *            "parla" is {"verb_form": "ind_pres", "person": "3",
 *            "number": "sg"} and {"verb_form": "imp", "person": "2",
 *            "number": "sg"}; the base form's first reading is the
 *            lemma's, given on the lemma, and a form spelled as the
 *            headword adds its readings to the base form's [an invariable
 *            noun's plural]. Grammar values are codes from
 *            their lists, the tables grammar_genders [m, f, mf],
 *            grammar_numbers [sg, pl], grammar_persons [1, 2, 3],
 *            verb_forms [inf, ptcp_pres, ptcp_past, ger, ind_pres,
 *            ind_impf, ind_past, ind_fut, cond, subj_pres, subj_impf,
 *            imp], conjugation_classes and auxiliaries; "invariable" and
 *            "pronominal" are true or false. The same format will be
 *            read by import_entries[] in 0.17.0.
 */

/* Step 1: whose words these are. */
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000000", "role": "authenticated"}', true);

/* Step 2: the helpers, for this run only. */

/* The first key written twice in an object, at any depth; null if none.
   JSON as text keeps repeated keys, which jsonb would merge silently. */
create or replace function pg_temp.duplicate_key(p_value json)
returns text
language plpgsql
as $$
declare
    v_found  text;
    v_child  json;
begin
    if json_typeof(p_value) = 'object' then
        select k into v_found
        from json_object_keys(p_value) as k
        group by k having count(*) > 1
        limit 1;
        if v_found is null then
            for v_child in select value from json_each(p_value) loop
                v_found := pg_temp.duplicate_key(v_child);
                exit when v_found is not null;
            end loop;
        end if;
    elsif json_typeof(p_value) = 'array' then
        for v_child in select value from json_array_elements(p_value) loop
            v_found := pg_temp.duplicate_key(v_child);
            exit when v_found is not null;
        end loop;
    end if;
    return v_found;
end;
$$;

/* A grammar value: null when absent, or the code itself when its list
   holds it; anything else is refused with the codes the list holds,
   each in quotes, since a code is text: "3", not 3. */
create or replace function pg_temp.grammar_code(p_list text, p_key text, p_value jsonb)
returns text
language plpgsql
as $$
declare
    v_found  boolean;
    v_codes  text;
begin
    if p_value is null or jsonb_typeof(p_value) = 'null' then
        return null;
    end if;
    if jsonb_typeof(p_value) = 'string' then
        execute format('select exists (select 1 from public.%I where code = $1)', p_list)
            into v_found using normalize(p_value #>> '{}', NFC);
        if v_found then
            return normalize(p_value #>> '{}', NFC);
        end if;
    end if;
    execute format('select string_agg(''"'' || code || ''"'', '', '' order by position) from public.%I', p_list) into v_codes;
    raise exception '"%" must be one of: %', p_key, v_codes using errcode = '22023';
end;
$$;

/* A form's readings: a list of objects, each with some of "gender",
   "number", "person" and "verb_form", each value a code of its list;
   absent means none. The database checks them again. */
create or replace function pg_temp.form_readings(p_value jsonb)
returns jsonb
language plpgsql
as $$
declare
    v_out    jsonb := '[]'::jsonb;
    v_item   jsonb;
    v_place  integer := 0;
    v_bad    text;
begin
    if p_value is null or jsonb_typeof(p_value) = 'null' then
        return '[]'::jsonb;
    end if;
    if jsonb_typeof(p_value) <> 'array' then
        raise exception '"readings" must be a list, such as [{"gender": "f", "number": "pl"}]' using errcode = '22023';
    end if;
    for v_item in select value from jsonb_array_elements(p_value) loop
        v_place := v_place + 1;
        if jsonb_typeof(v_item) <> 'object' then
            raise exception 'reading %: it must be an object such as {"gender": "f", "number": "pl"}', v_place
                using errcode = '22023';
        end if;
        select string_agg(k, ', ') into v_bad from jsonb_object_keys(v_item) as k
        where k not in ('gender', 'number', 'person', 'verb_form');
        if v_bad is not null then
            raise exception 'reading %: unknown key: %', v_place, v_bad using errcode = '22023';
        end if;
        begin
            v_out := v_out || jsonb_build_array(jsonb_build_object(
                'gender',    pg_temp.grammar_code('grammar_genders', 'gender', v_item -> 'gender'),
                'number',    pg_temp.grammar_code('grammar_numbers', 'number', v_item -> 'number'),
                'person',    pg_temp.grammar_code('grammar_persons', 'person', v_item -> 'person'),
                'verb_form', pg_temp.grammar_code('verb_forms', 'verb_form', v_item -> 'verb_form')));
        exception when others then
            raise exception 'reading %: %', v_place, sqlerrm using errcode = sqlstate;
        end;
    end loop;
    return v_out;
end;
$$;

/* true or false; absent means false. */
create or replace function pg_temp.flag(p_key text, p_value jsonb)
returns boolean
language plpgsql
as $$
begin
    if p_value is null or jsonb_typeof(p_value) = 'null' then
        return false;
    end if;
    if jsonb_typeof(p_value) <> 'boolean' then
        raise exception '"%" must be true or false', p_key using errcode = '22023';
    end if;
    return p_value::text::boolean;
end;
$$;

create or replace function pg_temp.add_entry(p_text text)
returns bigint
language plpgsql
as $$
declare
    v_entry     jsonb;
    v_headword  text := '?';
    v_where     text := 'the lemma';
    v_status    public.review_status;
    v_lemma     bigint;
    v_sense     bigint;
    v_number    integer := 0;
    v_form      jsonb;
    v_def       jsonb;
    v_language  text;
    v_list      jsonb;
    v_item      jsonb;
    v_bad       text;
    v_detail    text;
begin
    begin
        if auth.uid() is null or auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid then
            raise exception 'step 1 names nobody: put the user id of the person whose words these are'
                using errcode = '22023';
        end if;

        v_entry := p_text::jsonb;
        if jsonb_typeof(v_entry) <> 'object' then
            raise exception 'an entry must be a JSON object' using errcode = '22023';
        end if;
        v_headword := coalesce(nullif(btrim(coalesce(v_entry ->> 'headword', '')), ''), '?');
        v_bad := pg_temp.duplicate_key(p_text::json);
        if v_bad is not null then
            raise exception 'the key "%" is written twice in one object', v_bad using errcode = '22023';
        end if;
        select string_agg(k, ', ') into v_bad from jsonb_object_keys(v_entry) as k
        where k not in ('headword', 'part_of_speech', 'variety', 'orthography', 'note', 'status', 'forms', 'senses',
                        'gender', 'number', 'person', 'verb_form', 'invariable', 'conjugation', 'auxiliary', 'pronominal');
        if v_bad is not null then
            raise exception 'unknown key: %', v_bad using errcode = '22023';
        end if;
        if v_headword = '?' then
            raise exception 'the entry has no headword' using errcode = '22023';
        end if;
        if jsonb_typeof(coalesce(v_entry -> 'forms', '[]')) <> 'array'
           or jsonb_typeof(coalesce(v_entry -> 'senses', '[]')) <> 'array' then
            raise exception '"forms" and "senses" must be lists' using errcode = '22023';
        end if;

        v_status := coalesce(v_entry ->> 'status', 'pending')::public.review_status;
        insert into public.lemmas (headword, part_of_speech, variety, orthography, note, status,
                                   gender, number, person, verb_form, invariable,
                                   conjugation, auxiliary, pronominal)
        values (v_headword,
                v_entry ->> 'part_of_speech',
                coalesce(v_entry ->> 'variety', 'zeneize'),
                coalesce(v_entry ->> 'orthography', 'ofiçiâ'),
                v_entry ->> 'note',
                v_status,
                pg_temp.grammar_code('grammar_genders', 'gender', v_entry -> 'gender'),
                pg_temp.grammar_code('grammar_numbers', 'number', v_entry -> 'number'),
                pg_temp.grammar_code('grammar_persons', 'person', v_entry -> 'person'),
                pg_temp.grammar_code('verb_forms', 'verb_form', v_entry -> 'verb_form'),
                pg_temp.flag('invariable', v_entry -> 'invariable'),
                pg_temp.grammar_code('conjugation_classes', 'conjugation', v_entry -> 'conjugation'),
                pg_temp.grammar_code('auxiliaries', 'auxiliary', v_entry -> 'auxiliary'),
                pg_temp.flag('pronominal', v_entry -> 'pronominal'))
        returning id into v_lemma;

        for v_form in select value from jsonb_array_elements(coalesce(v_entry -> 'forms', '[]')) loop
            v_where := format('the form %s', v_form);
            if jsonb_typeof(v_form) <> 'object' then
                raise exception 'a form must be an object such as {"form": "pénne", "tag": "pl."}' using errcode = '22023';
            end if;
            select string_agg(k, ', ') into v_bad from jsonb_object_keys(v_form) as k
            where k not in ('form', 'tag', 'readings');
            if v_bad is not null then
                raise exception 'unknown key: %', v_bad using errcode = '22023';
            end if;
            v_where := format('the form "%s"', v_form ->> 'form');
            if btrim(v_form ->> 'form') = v_headword then
                /* The headword's own spelling is the base form, made with
                   the lemma: its readings follow the lemma's, any already
                   there skipped; its tag is set if one is given. */
                update public.wordforms as w
                set readings = w.readings || coalesce((
                        select jsonb_agg(r.value order by r.ordinality)
                        from jsonb_array_elements(pg_temp.form_readings(v_form -> 'readings')) with ordinality as r
                        where not w.readings @> jsonb_build_array(r.value)), '[]'::jsonb),
                    grammatical_tag = coalesce(v_form ->> 'tag', w.grammatical_tag)
                where w.lemma_id = v_lemma and w.is_base and w.deleted_at is null;
            else
                insert into public.wordforms (lemma_id, form, grammatical_tag, status, readings)
                values (v_lemma, btrim(v_form ->> 'form'), v_form ->> 'tag', v_status,
                        pg_temp.form_readings(v_form -> 'readings'));
            end if;
        end loop;

        for v_def in select value from jsonb_array_elements(coalesce(v_entry -> 'senses', '[]')) loop
            v_number := v_number + 1;
            v_where := format('sense %s', v_number);
            if jsonb_typeof(v_def) <> 'object' then
                raise exception 'a sense must be an object such as {"definition_it": "...", "translations": {...}}'
                    using errcode = '22023';
            end if;
            select string_agg(k, ', ') into v_bad from jsonb_object_keys(v_def) as k where k not in ('definition_it', 'translations');
            if v_bad is not null then
                raise exception 'unknown key: %', v_bad using errcode = '22023';
            end if;
            if jsonb_typeof(coalesce(v_def -> 'translations', '{}')) <> 'object' then
                raise exception '"translations" must be an object such as {"it": ["casa"]}' using errcode = '22023';
            end if;
            insert into public.senses (lemma_id, definition_it, status)
            values (v_lemma, nullif(btrim(coalesce(v_def ->> 'definition_it', '')), ''), v_status)
            returning id into v_sense;

            for v_language, v_list in select key, value from jsonb_each(coalesce(v_def -> 'translations', '{}')) loop
                v_where := format('the "%s" translations of sense %s', v_language, v_number);
                if not exists (select 1 from public.gloss_languages where code = v_language) then
                    raise exception 'unknown translation language "%"; use it, es or en', v_language using errcode = '22023';
                end if;
                if jsonb_typeof(v_list) <> 'array' then
                    raise exception 'they must be a list, such as ["penna", "stilografica"]' using errcode = '22023';
                end if;
                for v_item in select value from jsonb_array_elements(v_list) loop
                    if jsonb_typeof(v_item) <> 'string' or btrim(v_item #>> '{}') = '' then
                        raise exception 'an empty or malformed translation' using errcode = '22023';
                    end if;
                    v_where := format('the %s translation "%s" of sense %s', v_language, v_item #>> '{}', v_number);
                    if position(';' in v_item #>> '{}') > 0 then
                        raise exception 'it holds a ";": write each translation as its own item of the list'
                            using errcode = '22023';
                    end if;
                    insert into public.glosses (sense_id, language, gloss, status)
                    values (v_sense, v_language, btrim(v_item #>> '{}'), v_status);
                end loop;
            end loop;
        end loop;
    exception when others then
        get stacked diagnostics v_detail = pg_exception_detail;
        raise exception 'entry "%", %: %', v_headword, v_where, sqlerrm
            using errcode = sqlstate, detail = coalesce(v_detail, '');
    end;

    return v_lemma;
end;
$$;

/* Step 3: one line per entry, below the examples. The examples are
   comments and write nothing; copy their shape.

select pg_temp.add_entry($entry$
{ "headword": "pénna", "part_of_speech": "noun", "gender": "f", "number": "sg",
  "forms": [ {"form": "pénne", "tag": "pl.", "readings": [{"gender": "f", "number": "pl"}]} ],
  "senses": [
    { "definition_it": "strumento per scrivere",
      "translations": {"it": ["penna", "stilografica"], "es": ["pluma"], "en": ["pen"]} },
    { "translations": {"it": ["piuma"], "es": ["pluma"], "en": ["feather"]} }
  ] }
$entry$);

select pg_temp.add_entry($entry$
{ "headword": "çê", "part_of_speech": "noun",
  "senses": [ { "definition_it": "cielo", "translations": {"it": ["cielo"], "es": ["cielo"], "en": ["sky"]} } ] }
$entry$);

*/


/* Step 4: remove the helpers. Keep these lines at the very end. */
drop function pg_temp.add_entry(text);
drop function pg_temp.flag(text, jsonb);
drop function pg_temp.form_readings(jsonb);
drop function pg_temp.grammar_code(text, text, jsonb);
drop function pg_temp.duplicate_key(json);
