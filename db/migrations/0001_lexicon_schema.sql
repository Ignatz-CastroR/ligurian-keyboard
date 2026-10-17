/*
 * 0001_lexicon_schema.sql
 * Author:    Ignatz-CastroR and contributors
 * Date:      2026/10/10, 18:13:17, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:   Tables of the shared Ligurian dictionary: lemmas, their
 *            spelled wordforms, their numbered senses [meanings] and the
 *            optional Italian, Spanish and English glosses of each sense,
 *            plus the user profiles that carry each person's role.
 * Target:    PostgreSQL 15 or newer, as hosted by Supabase. Plain SQL
 *            except for auth.users and auth.uid[], which Supabase
 *            provides; db/test/supabase-shim.sql imitates both for tests.
 * Contract:  Nothing is ever hard deleted. Rows carry deleted_at for soft
 *            deletion and version for optimistic locking. Permissions,
 *            triggers and history live in 0002 and 0003.
 */

/* Helper functions that must not be reachable through the Supabase API
   live in their own schema, which is never exposed. */
create schema if not exists private;

/* ====================================================================
   Enumerations
   ==================================================================== */

/* member:      signed up; reads the published lexicon only.
   contributor: proposes entries; they enter as pending.
   reviewer:    approves, rejects and corrects any entry.
   admin:       reviewer powers, plus soft delete, restore and roles. */
create type public.app_role as enum ('member', 'contributor', 'reviewer', 'admin');

create type public.review_status as enum ('pending', 'approved', 'rejected');

/* ====================================================================
   Reference tables: a foreign key instead of free text makes a typo
   such as "zenieze" impossible.
   ==================================================================== */

create table public.varieties (
    code        text primary key check (code ~ '^[a-z]+$'),
    name        text not null
);

insert into public.varieties (code, name) values
    ('zeneize',   'Zenéize [Genova]'),
    ('savoneize', 'Savonéize [Savona]'),
    ('spezzin',   'Spezzin [La Spezia]'),
    ('tabarchin', 'Tabarchin [Carloforte e Calasetta]'),
    ('monegasco', 'Monegasco [Monaco]');

create table public.orthographies (
    code        text primary key,
    name        text not null
);

insert into public.orthographies (code, name) values
    ('ofiçiâ',  'Grafîa ofiçiâ [Académia Ligùstica do Brénno]'),
    ('unitäia', 'Grafia unitäia');

/* Languages a gloss may be written in. Adding one later is a single
   insert, with no schema change. */
create table public.gloss_languages (
    code        text primary key check (code ~ '^[a-z]{2}$'),
    name        text not null
);

insert into public.gloss_languages (code, name) values
    ('it', 'Italiano'),
    ('es', 'Español'),
    ('en', 'English');

/* ====================================================================
   Profiles: one row per Supabase user.
   ==================================================================== */

create table public.profiles (
    user_id       uuid primary key references auth.users (id) on delete cascade,
    display_name  text not null default '' check (length(display_name) <= 80),
    role          public.app_role not null default 'member',
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

/* ====================================================================
   Lexicon proper
   ==================================================================== */

/* The same letters the engine accepts [engine/src/lexicon.ts], with
   upper case spelled out because a C locale does not fold accented
   letters. The domain is used by both lemmas and wordforms. */
create domain public.ligurian_form as text
    check (
        value is nfc normalized
        and value ~ '^[a-zA-ZàáâäèéêëìíîïòóôöùúûüæçÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÆÇ''-]+$'
        and length(value) <= 64
    );

create table public.lemmas (
    id              bigint generated always as identity primary key,
    headword        public.ligurian_form not null,
    variety         text not null default 'zeneize' references public.varieties (code),
    orthography     text not null default 'ofiçiâ' references public.orthographies (code),
    part_of_speech  text check (part_of_speech in
                        ('noun', 'verb', 'adjective', 'adverb', 'pronoun',
                         'article', 'preposition', 'conjunction',
                         'interjection', 'numeral', 'proper_noun', 'other')),
    note            text check (length(note) <= 2000),
    status          public.review_status not null default 'pending',
    version         integer not null default 1,
    created_by      uuid references auth.users (id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    deleted_at      timestamptz
);

/* Homographs are legitimate [a noun and a verb spelled alike], so the
   headword alone is not unique; headword plus part of speech is. */
create unique index lemmas_unique_live
    on public.lemmas (headword, variety, orthography, coalesce(part_of_speech, ''))
    where deleted_at is null;

/* One row per spelled form: the base form AND every inflected form,
   as decided for version 0.x, which has no morphology generator.
   is_base marks the row the database creates automatically from the
   lemma's headword [0002]; it follows the lemma and is never edited
   directly. */
create table public.wordforms (
    id              bigint generated always as identity primary key,
    lemma_id        bigint not null references public.lemmas (id),
    form            public.ligurian_form not null,
    is_base         boolean not null default false,
    grammatical_tag text check (length(grammatical_tag) <= 40),
    freq            integer not null default 1 check (freq >= 0),
    status          public.review_status not null default 'pending',
    version         integer not null default 1,
    created_by      uuid references auth.users (id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    deleted_at      timestamptz
);

create unique index wordforms_unique_live
    on public.wordforms (lemma_id, form)
    where deleted_at is null;

/* At most one live base form per lemma. */
create unique index wordforms_one_base
    on public.wordforms (lemma_id)
    where is_base and deleted_at is null;

create index wordforms_lemma on public.wordforms (lemma_id);

/* Numbered meanings of a lemma: 1, 2, 3 ... as in a printed dictionary.
   Translations hang from a sense, never from the lemma, so that each
   Italian, Spanish and English gloss is tied to one precise meaning.
   A lemma may have no senses yet [a spelling only entry].
   Definitions are written in Italian, as decided in
   docs/decisions/0015-definitions-in-italian.md: typing correct
   Ligurian is still too hard for editors, which is the very problem
   this project solves. A Ligurian definition will be a second column,
   definition_lij, added once the input method is mature. */
create table public.senses (
    id              bigint generated always as identity primary key,
    lemma_id        bigint not null references public.lemmas (id),
    sense_number    integer not null check (sense_number > 0),
    definition_it   text check (length(definition_it) between 1 and 1000),
    status          public.review_status not null default 'pending',
    version         integer not null default 1,
    created_by      uuid references auth.users (id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    deleted_at      timestamptz
);

create unique index senses_unique_live
    on public.senses (lemma_id, sense_number)
    where deleted_at is null;

create index senses_lemma on public.senses (lemma_id);

/* Translations of one sense. All optional: a sense may have none, or
   several per language when they are synonyms of that same meaning
   [Italian "penna" and "stilografica" for sense 1]. */
create table public.glosses (
    id              bigint generated always as identity primary key,
    sense_id        bigint not null references public.senses (id),
    language        text not null references public.gloss_languages (code),
    gloss           text not null check (length(gloss) between 1 and 500),
    status          public.review_status not null default 'pending',
    version         integer not null default 1,
    created_by      uuid references auth.users (id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    deleted_at      timestamptz
);

create unique index glosses_unique_live
    on public.glosses (sense_id, language, gloss)
    where deleted_at is null;

create index glosses_sense on public.glosses (sense_id);

/* ====================================================================
   History: written only by triggers [0003], never by users.
   ==================================================================== */

create table public.audit_log (
    id          bigint generated always as identity primary key,
    table_name  text not null,
    row_id      bigint not null,
    action      text not null check (action in
                    ('insert', 'update', 'soft_delete', 'restore')),
    actor       uuid,
    at          timestamptz not null default now(),
    old_row     jsonb,
    new_row     jsonb
);

create index audit_log_row on public.audit_log (table_name, row_id);
