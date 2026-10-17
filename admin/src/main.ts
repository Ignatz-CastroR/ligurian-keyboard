/*
 * main.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/11, 20:19:30, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Start the lexicon manager: connect to Supabase, follow the
 *           session, draw the header and send each address to its view.
 * Routes:   #/search/<query>   search [everyone]
 *           #/entry/<id>       one entry [everyone, as far as visible]
 *           #/new              propose a lemma [contributors and up]
 *           #/review           review queue [signed in]
 *           #/users            own profile; people and roles [staff]
 *           #/signin           sign in
 */

import "./style.css";
import type { Session } from "@supabase/supabase-js";
import type { Context, View } from "./context.ts";
import type { Lang } from "./messages.ts";
import { messagesFor } from "./messages.ts";
import type { Profile, ReferenceData } from "./types.ts";
import { connect, currentSession, exportTsv, myProfile, onSessionChange, referenceData, signOut } from "./db.ts";
import { canPropose } from "./permissions.ts";
import { attachMessageBar, clear, describeError, h, hideMessage, roleLabel, runAction, showError, showInfo } from "./ui.ts";
import { renderSearch } from "./views/search.ts";
import { renderEntry } from "./views/entry.ts";
import { renderNewLemma } from "./views/new-lemma.ts";
import { renderReview } from "./views/review.ts";
import { renderUsers } from "./views/users.ts";
import { renderSignIn } from "./views/sign-in.ts";

const LANG_KEY: string = "ligurian-keyboard.lang";

const ROUTES: Readonly<Record<string, View>> = {
  search: renderSearch,
  entry: renderEntry,
  new: renderNewLemma,
  review: renderReview,
  users: renderUsers,
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
   site data]; the language then simply falls back to Italian. */
function loadLang(): Lang {
  let lang: Lang = "it";
  try {
    lang = window.localStorage.getItem(LANG_KEY) === "en" ? "en" : "it";
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

  const exportButton: HTMLButtonElement = h("button", { type: "button", class: "small" }, t.exportTsv);
  exportButton.addEventListener("click", () => void runAction(t, exportButton, async () => {
    downloadText("ligurian-lexicon.tsv", await exportTsv());
  }));

  const langButton: HTMLButtonElement = h("button", { type: "button", class: "small" }, t.switchLang);
  langButton.addEventListener("click", () => {
    state.lang = state.lang === "it" ? "en" : "it";
    saveLang(state.lang);
    document.documentElement.lang = state.lang;
    drawHeader(state);
    void render(state);
  });

  let account: HTMLElement;
  if (ctx.userId === null) {
    account = link("#/signin", t.signIn);
  } else {
    const outButton: HTMLButtonElement = h("button", { type: "button", class: "small" }, t.signOut);
    outButton.addEventListener("click", () => void signOut());
    const who: string = state.profile?.display_name || state.session?.user.email || "";
    account = h("span", { class: "account" },
      h("a", { href: "#/users", class: "nav-link" }, who),
      ctx.role !== null && h("span", { class: "tag" }, roleLabel(t, ctx.role)),
      outButton,
    );
  }

  header.replaceChildren(
    h("div", { class: "brand" },
      h("a", { href: "#/search/", class: "brand-title" }, t.appTitle),
      h("span", { class: "muted" }, t.appSubtitle)),
    h("nav", {},
      link("#/search/", t.navSearch),
      canPropose(ctx.role) && link("#/new", t.navNew),
      ctx.userId !== null && link("#/review", t.navReview),
      ctx.userId !== null && link("#/users", ctx.role === "reviewer" || ctx.role === "admin" ? t.navUsers : t.navAccount),
    ),
    h("div", { class: "tools" }, exportButton, langButton, account),
  );
}

function downloadText(fileName: string, text: string): void {
  const url: string = URL.createObjectURL(new Blob([text], { type: "text/tab-separated-values;charset=utf-8" }));
  const anchor: HTMLAnchorElement = h("a", { href: url, download: fileName });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

let renderTicket: number = 0;

async function render(state: State): Promise<void> {
  const ticket: number = ++renderTicket;
  const ctx: Context = makeContext(state);
  const route = parseRoute(window.location.hash);
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
