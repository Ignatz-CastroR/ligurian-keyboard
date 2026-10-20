/*
 * main.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 02:10:30, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The Users section of the site, published under /utenti/:
 *           each person's profile, the people of the dictionary with
 *           their changes, and each person's complete history. Built
 *           from the lexicon manager's own modules [database calls,
 *           texts, page pieces, sign-in], so the two sections share one
 *           sign-in and never disagree.
 * Routes:   #/                      own profile; everyone [staff]
 *           #/persona/<user id>     one person's history
 *           #/persona/sql           the SQL Editor's changes [staff]
 *           #/accedi                sign in
 * Contract: Same origin as the lexicon manager, so a session started in
 *           either holds in both. Text is inserted with textContent
 *           only [h[] of the manager].
 * Decision: docs/decisions/0035-site-in-five-sections.md
 */

import "../../admin/src/style.css";
import type { Session } from "@supabase/supabase-js";
import type { Context } from "../../admin/src/context.ts";
import { LANGUAGES, isLang, messagesFor, type Lang } from "../../admin/src/messages.ts";
import type { Profile } from "../../admin/src/types.ts";
import { connect, currentSession, myProfile, onSessionChange, signOut } from "../../admin/src/db.ts";
import { attachMessageBar, clear, describeError, h, hideMessage, roleLabel, showError, showInfo } from "../../admin/src/ui.ts";
import { renderSignIn } from "../../admin/src/views/sign-in.ts";
import { loadStats, mountSiteBar } from "../../site/bar.ts";
import { userMessagesFor } from "./messages.ts";
import { parseRoute, routeHash, type Route } from "./model.ts";
import { renderPeople } from "./views/people.ts";
import { renderPerson } from "./views/person.ts";

// Same key as every other section: one language for the whole site.
const LANG_KEY: string = "ligurian-keyboard.lang";

interface State {
  lang: Lang;
  session: Session | null;
  profile: Profile | null;
  pendingNotice: string | null;
}

const header: HTMLElement = document.querySelector("#header") ?? document.body;
const main: HTMLElement = document.querySelector("#main") ?? document.body;
const messageBar: HTMLElement | null = document.querySelector("#message");

function loadLang(): Lang {
  let lang: Lang = "it";
  try {
    const stored: string | null = window.localStorage.getItem(LANG_KEY);
    lang = isLang(stored) ? stored : "it";
  } catch {
    lang = "it";
  }
  return lang;
}

function saveLang(lang: Lang): void {
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Not remembered; harmless.
  }
}

function makeContext(state: State): Context {
  const userId: string | null = state.session?.user.id ?? null;
  return {
    t: messagesFor(state.lang),
    lang: state.lang,
    userId,
    role: userId === null ? null : state.profile?.role ?? null,
    profile: state.profile,
    refs: { varieties: [], orthographies: [], languages: [] },
    navigate: (hash: string, notice?: string): void => {
      state.pendingNotice = notice ?? null;
      if (window.location.hash === hash) {
        void render(state);
      } else {
        window.location.hash = hash;
      }
    },
    reloadProfile: async (): Promise<void> => {
      await refreshProfile(state);
      drawHeader(state);
    },
  };
}

async function refreshProfile(state: State): Promise<void> {
  const userId: string | undefined = state.session?.user.id;
  state.profile = userId === undefined ? null : await myProfile(userId);
}

function drawHeader(state: State): void {
  const ctx: Context = makeContext(state);
  const { t } = ctx;
  const u = userMessagesFor(state.lang);
  mountSiteBar("users", state.lang, loadStats(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY));

  const langMenu: HTMLSelectElement = h("select", { class: "small", "aria-label": t.langLabel, title: t.langLabel });
  for (const language of LANGUAGES) {
    langMenu.append(h("option", { value: language.code, lang: language.code, selected: language.code === state.lang },
      language.name));
  }
  langMenu.addEventListener("change", () => {
    if (isLang(langMenu.value)) {
      state.lang = langMenu.value;
      saveLang(state.lang);
      document.documentElement.lang = state.lang;
      drawHeader(state);
      void render(state);
    }
  });

  let account: HTMLElement;
  if (ctx.userId === null) {
    account = h("a", { href: routeHash({ view: "signin" }), class: "nav-link" }, t.signIn);
  } else {
    const outButton: HTMLButtonElement = h("button", { type: "button", class: "small" }, t.signOut);
    outButton.addEventListener("click", () => void signOut());
    account = h("span", { class: "account" },
      h("a", { href: routeHash({ view: "people" }), class: "nav-link" }, state.profile?.display_name || state.session?.user.email || ""),
      ctx.role !== null && h("span", { class: "tag" }, roleLabel(t, ctx.role)),
      outButton);
  }

  header.replaceChildren(
    h("div", { class: "brand" },
      h("a", { href: routeHash({ view: "people" }), class: "brand-title" }, u.appTitle),
      h("span", { class: "muted" }, u.appSubtitle)),
    h("div", { class: "tools" }, langMenu, account),
  );
}

let renderTicket: number = 0;

async function render(state: State): Promise<void> {
  const ticket: number = ++renderTicket;
  const ctx: Context = makeContext(state);
  const u = userMessagesFor(state.lang);
  const route: Route = parseRoute(window.location.hash);
  const page: HTMLElement = h("div", { class: "page" });

  hideMessage();
  clear(main);
  main.append(page);
  document.title = u.appTitle;
  try {
    if (route.view === "person") {
      await renderPerson(ctx, u, page, route.userId);
    } else if (route.view === "signin") {
      await renderSignIn(ctx, page);
    } else {
      await renderPeople(ctx, u, page);
    }
  } catch (error: unknown) {
    showError(describeError(ctx.t, error));
  }
  if (ticket === renderTicket && state.pendingNotice !== null) {
    showInfo(state.pendingNotice);
    state.pendingNotice = null;
  }
}

async function start(): Promise<void> {
  if (messageBar !== null) {
    attachMessageBar(messageBar);
  }
  const lang: Lang = loadLang();
  document.documentElement.lang = lang;
  const url: string | undefined = import.meta.env.VITE_SUPABASE_URL;
  const key: string | undefined = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (url === undefined || url === "" || key === undefined || key === "") {
    main.replaceChildren(h("p", { class: "error-text" }, messagesFor(lang).errNotConfigured));
  } else {
    connect(url, key);
    const state: State = { lang, session: await currentSession(), profile: null, pendingNotice: null };
    try {
      await refreshProfile(state);
    } catch (error: unknown) {
      showError(describeError(messagesFor(lang), error));
    }

    // As in the lexicon manager: work is deferred out of Supabase's own
    // callback, and only a change of person redraws the page.
    onSessionChange((session: Session | null) => {
      const changedUser: boolean = (session?.user.id ?? null) !== (state.session?.user.id ?? null);
      state.session = session;
      if (changedUser) {
        window.setTimeout(() => {
          void refreshProfile(state)
            .catch(() => { state.profile = null; })
            .then(() => {
              drawHeader(state);
              void render(state);
            });
        }, 0);
      }
    });

    window.addEventListener("hashchange", () => void render(state));
    drawHeader(state);
    await render(state);
  }
}

void start();
