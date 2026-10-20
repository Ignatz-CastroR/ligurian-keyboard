/*
 * db.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 18:12:15, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/20, 01:36:40: a fifth question, dictionary_lookup[]
 *           of migration 0011, Ligurian words by their spelling.
 * Purpose:  The dictionary page's five questions to the database, the
 *           functions of migrations 0009 and 0011, asked as an anonymous
 *           visitor.
 * Contract: The client never uses a stored session, not even that of a
 *           reviewer signed in to the lexicon manager on the same site:
 *           the dictionary shows what every visitor sees. The functions
 *           filter published rows themselves as well.
 * Decision: docs/decisions/0034-dictionary-for-readers.md
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Entry, IndexEntry, LookupRow, SearchRow } from "./model.ts";

export const PAGE: number = 100;
export const SEARCH_LIMIT: number = 200;
export const LOOKUP_LIMIT: number = 50;

let client: SupabaseClient | null = null;

export function connect(url: string, publishableKey: string): void {
  client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function db(): SupabaseClient {
  if (client === null) {
    throw new Error("database not connected");
  }
  return client;
}

async function call<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc(name, args);
  if (error !== null) {
    throw new Error(error.message);
  }
  return data as T;
}

export async function letters(): Promise<{ initial: string; entries: number }[]> {
  const rows = await call<{ initial: string; entries: number | string }[]>("dictionary_letters");
  return rows.map((r) => ({ initial: r.initial, entries: Number(r.entries) }));
}

// One page of an initial; `after` is the last entry of the page before.
export function indexPage(initial: string, after: IndexEntry | null): Promise<IndexEntry[]> {
  return call<IndexEntry[]>("dictionary_index", {
    p_initial: initial,
    p_after_key: after?.headword_key ?? null,
    p_after_id: after?.id ?? null,
    p_limit: PAGE,
  });
}

export function search(query: string, language: string | null): Promise<SearchRow[]> {
  return call<SearchRow[]>("dictionary_search", { p_query: query, p_language: language, p_limit: SEARCH_LIMIT });
}

export function entry(code: string): Promise<Entry | null> {
  return call<Entry | null>("dictionary_entry", { p_public_id: code });
}

// Published entries whose headword or a form begins with the query,
// typed with or without accents; the best matches first.
export function lookup(query: string): Promise<LookupRow[]> {
  return call<LookupRow[]>("dictionary_lookup", { p_query: query, p_limit: LOOKUP_LIMIT });
}
