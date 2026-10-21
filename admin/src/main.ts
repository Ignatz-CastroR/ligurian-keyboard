/*
 * main.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 20:19:30, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/17, 07:28:26: language menu [Italian, English,
 *           Spanish]; CSV download next to the TSV one.
 * Updated:  2026/10/18, 09:20:37: downloadText[] moved to ui.ts, where
 *           the backup download uses it too.
 * Updated:  2026/10/18, 12:34:52: the TSV and CSV downloads are named by
 *           the local date and time of the click [decision 0025].
 * Updated:  2026/10/18, 18:41:15: a link to the dictionary for readers.
 * Updated:  2026/10/20, 02:14:40: the site's bar of five sections on
 *           top; below it, the manager's own tabs, the current one
 *           marked: Search, New lemma, To review and, for admins,
 *           Backups, moved here from the users page. Profiles and people
 *           moved to the site's Users section, /utenti/, where the old
 *           address #/users now leads [decision 0035].
 * Updated:  2026/10/20, 23:49:12: the repairs of the senses: the tab
 *           Significati da rivedere, for reviewers and admins, and the
 *           repair page of one lemma [decision 0038].
 * Purpose:  Start the lexicon manager: connect to Supabase, follow the
 *           session, draw the header and send each address to its view.
 * Routes:   #/search/<query>   search [everyone]
 *           #/entry/<id>       one entry [everyone, as far as visible]
 *           #/new              propose a lemma [contributors and up]
 *           #/review           review queue [signed in]
 *           #/senses           the senses to review [reviewers and admins]
 *           #/repair/<id>      the senses of one lemma [reviewers and admins]
 *           #/backups          backup and restore [admins]
 *           #/signin           sign in
 *           #/users            moved: opens ../utenti/
 * Decision: docs/decisions/0035-site-in-five-sections.md
 */

import "./style.css";
import type { Session } from "@supabase/supabase-js";
import type { Context, View } from "./context.ts";
import type { Lang } from "./messages.ts";
import { isLang, LANGUAGES, messagesFor } from "./messages.ts";
import type { Profile, ReferenceData } from "./types.ts";
import { connect, currentSession, exportTsv, myProfile, onSessionChange, referenceData, signOut } from "./db.ts";
import { tsvToCsv } from "./export.ts";
import { lexiconFileName } from "./file-names.ts";
import { canBackup, canPropose, isStaff } from "./permissions.ts";
import { loadStats, mountSiteBar } from "../../site/bar.ts";
import {
  attachMessageBar, clear, describeError, downloadText, h, hideMessage, roleLabel, runAction, showError, showInfo,
} from "./ui.ts";
import { renderSearch } from "./views/search.ts";
import { renderEntry } from "./views/entry.ts";
import { renderNewLemma } from "./views/new-lemma.ts";
import { renderReview } from "./views/review.ts";
import { renderSenseQueue } from "./views/sense-queue.ts";
import { renderRepair } from "./views/repair.ts";
import { renderBackups } from "./views/backups.ts";
import { renderSignIn } from "./views/sign-in.ts";

const LANG_KEY: string = "ligurian-keyboard.lang";

const ROUTES: Readonly<Record<string, View>> = {
  search: renderSearch,
  entry: renderEntry,
  new: renderNewLemma,
  review: renderReview,
  senses: renderSenseQueue,
  repair: renderRepair,
  backups: renderBackups,
  signin: renderSignIn,
};

interface State {
  lang: Lang;
  session: Session | null;
  profile: Profile | null;
  refs: ReferenceData;
  pendingNotice: string | null;
}

const header: HTMLElement = document.querySelector("#header") ?? document.body;
const main: HTMLElement = document.querySelector("#main") ?? document.body;
const messageBar: HTMLElement | null = document.querySelector("#message");

/* Browser storage can be missing or throw [private windows, blocked
   site data]; the language then simply falls back to Italian. The key
   is shared with the web editor, which offers the same three
   languages, so a choice made on one page holds on the other. */
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

// Addresses that moved to another section of the site.
const MOVED: Readonly<Record<string, string>> = { users: "../utenti/" };

function parseRoute(hash: string): { name: string; param: string } {
  const parts: string[] = hash.replace(/^#\/?/, "").split("/");
  const name: string = parts[0] ?? "";
  const param: string = decodeURIComponent(parts.slice(1).join("/"));
  return name in ROUTES ? { name, param } : { name: "search", param: "" };
}

function makeContext(state: State): Context {
  const userId: string | null = state.session?.user.id ?? null;
  return {
    t: messagesFor(state.lang),
    lang: state.lang,
    userId,
    role: userId === null ? null : state.profile?.role ?? null,
    profile: state.profile,
    refs: state.refs,
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
  const link = (href: string, label: string): HTMLElement => h("a", { href, class: "nav-link" }, label);

  const tsvButton: HTMLButtonElement = h("button", { type: "button", class: "small" }, t.exportTsv);
  tsvButton.addEventListener("click", () => void runAction(t, tsvButton, async () => {
    downloadText(lexiconFileName("tsv", new Date()), await exportTsv(), "text/tab-separated-values;charset=utf-8");
  }));

  const csvButton: HTMLButtonElement = h("button", { type: "button", class: "small" }, t.exportCsv);
  csvButton.addEventListener("click", () => void runAction(t, csvButton, async () => {
    downloadText(lexiconFileName("csv", new Date()), tsvToCsv(await exportTsv()), "text/csv;charset=utf-8");
  }));

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
    account = link("#/signin", t.signIn);
  } else {
    const outButton: HTMLButtonElement = h("button", { type: "button", class: "small" }, t.signOut);
    outButton.addEventListener("click", () => void signOut());
    const who: string = state.profile?.display_name || state.session?.user.email || "";
    // The profile lives in the Users section.
    account = h("span", { class: "account" },
      h("a", { href: "../utenti/", class: "nav-link", title: t.navAccount }, who),
      ctx.role !== null && h("span", { class: "tag" }, roleLabel(t, ctx.role)),
      outButton,
    );
  }

  // The manager's own tabs, the current one marked.
  const current: string = parseRoute(window.location.hash).name;
  const tab = (href: string, label: string, names: readonly string[]): HTMLElement => {
    const link: HTMLElement = h("a", { href, class: "tab" }, label);
    link.dataset["routes"] = names.join(" ");
    return link;
  };

  mountSiteBar("manager", state.lang, loadStats(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY));
  header.replaceChildren(
    h("div", { class: "brand" },
      h("a", { href: "#/search/", class: "brand-title" }, t.appTitle),
      h("span", { class: "muted" }, t.appSubtitle)),
    h("div", { class: "tools" }, tsvButton, csvButton, langMenu, account),
    h("nav", { class: "tabs", "aria-label": t.tabsLabel },
      tab("#/search/", t.navSearch, ["search", "entry"]),
      canPropose(ctx.role) && tab("#/new", t.navNew, ["new"]),
      ctx.userId !== null && tab("#/review", t.navReview, ["review"]),
      isStaff(ctx.role) && tab("#/senses", t.navRepair, ["senses", "repair"]),
      canBackup(ctx.role) && tab("#/backups", t.navBackups, ["backups"]),
    ),
  );
  markTab(current);
}

// Mark the tab of the current page, without redrawing the header, so
// that the link just followed keeps the keyboard's focus.
function markTab(route: string): void {
  for (const link of header.querySelectorAll<HTMLElement>(".tabs .tab")) {
    const on: boolean = (link.dataset["routes"] ?? "").split(" ").includes(route);
    link.classList.toggle("current", on);
    if (on) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

let renderTicket: number = 0;

async function render(state: State): Promise<void> {
  const ticket: number = ++renderTicket;
  const moved: string | undefined = MOVED[window.location.hash.replace(/^#\/?/u, "").split("/")[0] ?? ""];
  if (moved !== undefined) {
    window.location.replace(moved);
    return;
  }
  const ctx: Context = makeContext(state);
  const route = parseRoute(window.location.hash);
  markTab(route.name);
  const view: View = ROUTES[route.name] ?? renderSearch;
  const page: HTMLElement = h("div", { class: "page" });

  hideMessage();
  clear(main);
  main.append(page);
  document.title = ctx.t.appTitle;
  try {
    await view(ctx, page, route.param);
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
    const state: State = {
      lang,
      session: await currentSession(),
      profile: null,
      refs: { varieties: [], orthographies: [], languages: [] },
      pendingNotice: null,
    };
    try {
      state.refs = await referenceData();
      await refreshProfile(state);
    } catch (error: unknown) {
      showError(describeError(messagesFor(lang), error));
    }

    // Supabase calls this on sign in, sign out and token refresh. Work
    // is deferred with setTimeout, as Supabase advises, so that no
    // database call runs inside its own callback.
    onSessionChange((session: Session | null) => {
      const changedUser: boolean = (session?.user.id ?? null) !== (state.session?.user.id ?? null);
      state.session = session;
      if (changedUser) {
        window.setTimeout(() => {
          void refreshProfile(state)
            .catch(() => { state.profile = null; })
            .then(() => {
              drawHeader(state);
              if (session === null && parseRoute(window.location.hash).name !== "search") {
                window.location.hash = "#/search/";
              } else {
                void render(state);
              }
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
