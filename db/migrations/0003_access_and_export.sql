/*
 * 0003_access_and_export.sql
 * Author:    Ignatz-CastroR and contributors
 * Date:      2026/10/10, 20:10:11, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:   Row level security, table privileges, the reviewers' queue,
 *            the public dictionary view and the export that produces the
 *            engine's TSV.
 * Contract:  Supabase grants every privilege on new public tables to its
 *            anon and authenticated roles by default. This file revokes
 *            all of them first and grants back only what is listed here;
 *            row level security then filters the rows.
 *            Published means: approved, not deleted, and belonging to a
 *            published parent: wordforms and senses to a published lemma,
 *            glosses to a published sense.
 *            Published rows are public, as the lexicon is CC BY-SA 4.0.
 */

/* ====================================================================
   Privileges
   ==================================================================== */

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema private from public;

grant usage on schema private to anon, authenticated;
grant execute on function private.user_role() to anon, authenticated;
grant execute on function private.is_staff()  to anon, authenticated;

grant select on public.varieties, public.orthographies, public.gloss_languages to anon, authenticated;

grant select on public.lemmas, public.wordforms, public.senses, public.glosses to anon, authenticated;
grant insert, update on public.lemmas, public.wordforms, public.senses, public.glosses to authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, role) on public.profiles to authenticated;

grant select on public.audit_log to authenticated;

/* ====================================================================
   Row level security
   ==================================================================== */

alter table public.varieties       enable row level security;
alter table public.orthographies   enable row level security;
alter table public.gloss_languages enable row level security;
alter table public.profiles        enable row level security;
alter table public.lemmas          enable row level security;
alter table public.wordforms       enable row level security;
alter table public.senses          enable row level security;
alter table public.glosses         enable row level security;
alter table public.audit_log       enable row level security;

create policy varieties_read on public.varieties
    for select to anon, authenticated using (true);
create policy orthographies_read on public.orthographies
    for select to anon, authenticated using (true);
create policy gloss_languages_read on public.gloss_languages
    for select to anon, authenticated using (true);

/* Profiles: you see yourself; staff see everyone, to know who proposed
   what. You edit your own name; admins edit anyone [role changes are
   further guarded by profiles_before_update]. */
create policy profiles_read on public.profiles
    for select to authenticated
    using (user_id = auth.uid() or private.is_staff());
create policy profiles_update on public.profiles
    for update to authenticated
    using (user_id = auth.uid() or private.user_role() = 'admin')
    with check (user_id = auth.uid() or private.user_role() = 'admin');

/* Is this lemma visible to the public? Used by the policies of its
   wordforms and senses. SECURITY DEFINER to read lemmas unfiltered. */
create function private.lemma_is_published(p_lemma_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.lemmas
        where id = p_lemma_id and status = 'approved' and deleted_at is null
    );
$$;

revoke all on function private.lemma_is_published(bigint) from public;
grant execute on function private.lemma_is_published(bigint) to anon, authenticated;

/* Is this sense visible to the public? Used by the policy of its glosses. */
create function private.sense_is_published(p_sense_id bigint)
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
          and s.status = 'approved' and s.deleted_at is null
          and l.status = 'approved' and l.deleted_at is null
    );
$$;

revoke all on function private.sense_is_published(bigint) from public;
grant execute on function private.sense_is_published(bigint) to anon, authenticated;

/* ---------- lemmas ---------- */

create policy lemmas_read on public.lemmas
    for select to anon, authenticated
    using (
        (status = 'approved' and deleted_at is null)
        or (deleted_at is null and created_by = auth.uid())
        or private.is_staff()
    );

create policy lemmas_insert on public.lemmas
    for insert to authenticated
    with check (private.user_role() in ('contributor', 'reviewer', 'admin'));

/* Contributors edit only their own pending rows; reviewers any live
   row; admins any row, deleted ones included [to restore them]. */
create policy lemmas_update on public.lemmas
    for update to authenticated
    using (
        private.user_role() = 'admin'
        or (private.user_role() = 'reviewer' and deleted_at is null)
        or (private.user_role() = 'contributor' and created_by = auth.uid()
            and status = 'pending' and deleted_at is null)
    )
    with check (
        private.user_role() in ('reviewer', 'admin')
        or (created_by = auth.uid() and status = 'pending')
    );

/* ---------- wordforms ---------- */

create policy wordforms_read on public.wordforms
    for select to anon, authenticated
    using (
        (status = 'approved' and deleted_at is null and private.lemma_is_published(lemma_id))
        or (deleted_at is null and created_by = auth.uid())
        or private.is_staff()
    );

create policy wordforms_insert on public.wordforms
    for insert to authenticated
    with check (private.user_role() in ('contributor', 'reviewer', 'admin'));

create policy wordforms_update on public.wordforms
    for update to authenticated
    using (
        private.user_role() = 'admin'
        or (private.user_role() = 'reviewer' and deleted_at is null)
        or (private.user_role() = 'contributor' and created_by = auth.uid()
            and status = 'pending' and deleted_at is null)
    )
    with check (
        private.user_role() in ('reviewer', 'admin')
        or (created_by = auth.uid() and status = 'pending')
    );

/* ---------- senses ---------- */

create policy senses_read on public.senses
    for select to anon, authenticated
    using (
        (status = 'approved' and deleted_at is null and private.lemma_is_published(lemma_id))
        or (deleted_at is null and created_by = auth.uid())
        or private.is_staff()
    );

create policy senses_insert on public.senses
    for insert to authenticated
    with check (private.user_role() in ('contributor', 'reviewer', 'admin'));

create policy senses_update on public.senses
    for update to authenticated
    using (
        private.user_role() = 'admin'
        or (private.user_role() = 'reviewer' and deleted_at is null)
        or (private.user_role() = 'contributor' and created_by = auth.uid()
            and status = 'pending' and deleted_at is null)
    )
    with check (
        private.user_role() in ('reviewer', 'admin')
        or (created_by = auth.uid() and status = 'pending')
    );

/* ---------- glosses ---------- */

create policy glosses_read on public.glosses
    for select to anon, authenticated
    using (
        (status = 'approved' and deleted_at is null and private.sense_is_published(sense_id))
        or (deleted_at is null and created_by = auth.uid())
        or private.is_staff()
    );

create policy glosses_insert on public.glosses
    for insert to authenticated
    with check (private.user_role() in ('contributor', 'reviewer', 'admin'));

create policy glosses_update on public.glosses
    for update to authenticated
    using (
        private.user_role() = 'admin'
        or (private.user_role() = 'reviewer' and deleted_at is null)
        or (private.user_role() = 'contributor' and created_by = auth.uid()
            and status = 'pending' and deleted_at is null)
    )
    with check (
        private.user_role() in ('reviewer', 'admin')
        or (created_by = auth.uid() and status = 'pending')
    );

/* ---------- audit log ---------- */

create policy audit_log_read on public.audit_log
    for select to authenticated using (private.is_staff());

/* ====================================================================
   Views. security_invoker makes each view obey the row level security
   of the person querying it, instead of its owner's.
   ==================================================================== */

/* What the input method may suggest: one row per distinct spelling. A
   form shared by two published lemmas [homographs] appears once, with
   the higher frequency. */
create view public.published_wordforms
with (security_invoker = true)
as
select w.form, l.variety, l.orthography, max(w.freq) as freq
from public.wordforms as w
join public.lemmas as l on l.id = w.lemma_id
where w.status = 'approved' and w.deleted_at is null
  and l.status = 'approved' and l.deleted_at is null
group by w.form, l.variety, l.orthography;

/* Everything waiting for a reviewer, oldest first. Non staff see only
   their own pending rows, through the table policies. Base forms are
   left out: they are approved together with their lemma. */
create view public.review_queue
with (security_invoker = true)
as
select 'lemma'::text as kind, id, id as lemma_id, headword as text,
       created_by, created_at
from public.lemmas
where status = 'pending' and deleted_at is null
union all
select 'wordform', id, lemma_id, form, created_by, created_at
from public.wordforms
where status = 'pending' and deleted_at is null and not is_base
union all
select 'sense', id, lemma_id,
       sense_number || '. ' || coalesce(definition_it, ''), created_by, created_at
from public.senses
where status = 'pending' and deleted_at is null
union all
select 'gloss', g.id, s.lemma_id, g.language || ': ' || g.gloss, g.created_by, g.created_at
from public.glosses as g
join public.senses as s on s.id = g.sense_id
where g.status = 'pending' and g.deleted_at is null
order by created_at, kind, id;

/* The published dictionary, one row per gloss: headword, numbered
   sense, optional Italian definition, and translation. A published sense with
   no translation yet still appears, with null language and gloss.
   Lemmas with no senses at all are spelling only entries and are
   listed by published_wordforms instead. */
create view public.published_dictionary
with (security_invoker = true)
as
select l.id as lemma_id, l.headword, l.variety, l.orthography, l.part_of_speech,
       s.id as sense_id, s.sense_number, s.definition_it,
       g.language, g.gloss
from public.lemmas as l
join public.senses as s
  on s.lemma_id = l.id and s.status = 'approved' and s.deleted_at is null
left join public.glosses as g
  on g.sense_id = s.id and g.status = 'approved' and g.deleted_at is null
where l.status = 'approved' and l.deleted_at is null;

grant select on public.published_wordforms, public.published_dictionary to anon, authenticated;
grant select on public.review_queue to authenticated;

/* ====================================================================
   Export: the exact file format engine/src/lexicon.ts reads, as
   documented in docs/lexicon-format.md. Sorted for stable diffs.
   ==================================================================== */

create function public.export_lexicon_tsv()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
    select '# Exported from the ligurian-keyboard lexicon database.' || E'\n'
        || '# License: CC BY-SA 4.0. Generated file: do not edit by hand.' || E'\n'
        || 'form' || E'\t' || 'freq' || E'\t' || 'variety' || E'\t'
        || 'orthography' || E'\t' || 'status' || E'\n'
        || coalesce(
               string_agg(
                   p.form || E'\t' || p.freq || E'\t' || p.variety || E'\t'
                       || p.orthography || E'\t' || 'approved' || E'\n',
                   ''
                   order by p.form collate "C", p.variety, p.orthography
               ),
               ''
           )
    from public.published_wordforms as p;
$$;

revoke all on function public.export_lexicon_tsv() from public;
grant execute on function public.export_lexicon_tsv() to anon, authenticated;
