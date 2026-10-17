/*
 * supabase-shim.sql
 * Author:    Eng. José Ignacio Castro de R. and contributors
 * Date:      2026/10/10
 * Purpose:   The minimum of Supabase that the migrations depend on, so
 *            the tests run on a bare PostgreSQL [PGlite] with no server.
 * Contract:  TEST ONLY. Never run this on a real Supabase project, which
 *            already has all of it. auth.uid[] reads the user id from
 *            request.jwt.claims exactly as Supabase's own function does.
 */

create role anon nologin;
create role authenticated nologin;

create schema auth;
grant usage on schema auth to anon, authenticated;

create table auth.users (
    id                  uuid primary key,
    email               text,
    raw_user_meta_data  jsonb not null default '{}'::jsonb
);

create function auth.uid()
returns uuid
language sql
stable
as $$
    select nullif(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
        ''
    )::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated;
