/*
 * 0005_letter_enye.sql
 * Author:    Eng. José Ignacio Castro de R. and contributors
 * Date:      2026/10/17, 07:50:33, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:   2026/10/18, 07:01:56: the author's full name, as in every
 *            file written after 0.5.1; comment only, nothing to run again.
 * Purpose:   Accept the letter ñ [and Ñ] in Ligurian spellings, for the
 *            spelling systems that write it, and give it the search key
 *            n, so that typing luna finds a spelling written with ñ.
 * Contract:  Run once, after 0001 to 0004. Safe on a database that
 *            already holds words: the new letter list is a superset of
 *            the old one, and no stored word can contain ñ yet, so no
 *            stored search key changes.
 *            private.skeleton[] MUST still return the same result as
 *            skeleton[] in engine/src/skeleton.ts for every valid
 *            Ligurian form; db/test/search-keys.test.ts checks this on
 *            every letter the domain below accepts.
 * Decision:  docs/decisions/0024-letter-enye.md
 */

/* ====================================================================
   The letters a spelling may contain: 0001's list plus ñ and Ñ
   ==================================================================== */

/* 0001 declared the check without a name, so PostgreSQL named it
   ligurian_form_check. It is replaced, under the same name. */
alter domain public.ligurian_form drop constraint ligurian_form_check;

alter domain public.ligurian_form add constraint ligurian_form_check
    check (
        value is nfc normalized
        and value ~ '^[a-zA-ZàáâäèéêëìíîïòóôöùúûüæçñÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÆÇÑ''-]+$'
        and length(value) <= 64
    );

/* ====================================================================
   The folding function, mirror of engine/src/skeleton.ts: 0004's
   version plus ñ and Ñ, both folded to n
   ==================================================================== */

/* Same name, arguments and result type as in 0004, so the generated
   key columns keep using it and its privileges are kept. */
create or replace function private.skeleton(p_word text)
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
                'àáâäèéêëìíîïòóôöùúûüçñÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÇÑ’‘ʼÆ-‐‑',
                'aaaaeeeeiiiioooouuuucnaaaaeeeeiiiioooouuuucn''''''æ'
            )
        ),
        'æ', 'ae'
    );
$$;
