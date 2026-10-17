/*
 * 0004_search_keys.sql
 * Author:    Ignatz-CastroR and contributors
 * Date:      2026/10/11, 20:10:51, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:   ASCII search keys for lemmas and wordforms, so that people
 *            can search the dictionary by typing plain ASCII [zena finds
 *            Zêna], exactly as they type with the keyboard itself.
 * Contract:  private.skeleton[] MUST return the same result as
 *            skeleton[] in engine/src/skeleton.ts for every valid
 *            Ligurian form. db/test/search-keys.test.ts checks this on
 *            every fixture form and on every letter of the alphabet;
 *            change both together or the test fails.
 *            Upper case letters are folded explicitly instead of
 *            trusting lower[], which does not fold accented letters
 *            under a C locale.
 * Decision:  docs/decisions/0017-ascii-search-keys-in-the-database.md
 */

/* ====================================================================
   The folding function, mirror of engine/src/skeleton.ts
   ==================================================================== */

/* translate[] maps each character of its second argument to the
   character at the same position in its third; characters beyond the
   end of the third argument are deleted. Here that deletes the three
   hyphens. æ becomes two letters, so it needs replace[] afterwards. */
create function private.skeleton(p_word text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
    select replace(
        lower(
            translate(
                normalize(p_word, NFC),
                'àáâäèéêëìíîïòóôöùúûüçÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÇ’‘ʼÆ-‐‑',
                'aaaaeeeeiiiioooouuuucaaaaeeeeiiiioooouuuuc''''''æ'
            )
        ),
        'æ', 'ae'
    );
$$;

revoke all on function private.skeleton(text) from public;
grant execute on function private.skeleton(text) to anon, authenticated;

/* ====================================================================
   Generated key columns: computed by the database, never sent by a
   client, recomputed automatically whenever the spelling changes.
   ==================================================================== */

alter table public.lemmas
    add column headword_key text
    generated always as (private.skeleton(headword)) stored;

alter table public.wordforms
    add column form_key text
    generated always as (private.skeleton(form)) stored;

create index lemmas_headword_key   on public.lemmas (headword_key text_pattern_ops);
create index wordforms_form_key    on public.wordforms (form_key text_pattern_ops);
