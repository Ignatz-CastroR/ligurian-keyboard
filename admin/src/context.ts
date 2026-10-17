/*
 * context.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 20:18:21, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  What every view needs to know about the session and the
 *           page, passed explicitly instead of through global variables.
 */

import type { Lang, Messages } from "./messages.ts";
import type { Profile, ReferenceData, Role } from "./types.ts";

export interface Context {
  t: Messages;
  lang: Lang;
  userId: string | null;     // null when signed out
  role: Role | null;         // null when signed out
  profile: Profile | null;
  refs: ReferenceData;
  navigate: (hash: string, notice?: string) => void;   // notice: shown after the new page
  reloadProfile: () => Promise<void>;
}

export type View = (ctx: Context, root: HTMLElement, param: string) => Promise<void>;
