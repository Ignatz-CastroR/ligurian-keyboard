/*
 * new-lemma.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/11, 20:21:50, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Propose a new lemma. While the headword is typed, existing
 *           lemmas with the same ASCII key are listed, so that nobody
 *           proposes a word that is already there by mistake.
 */

import type { Context } from "../context.ts";
import type { Lemma } from "../types.ts";
import { PARTS_OF_SPEECH } from "../types.ts";
import { createLemma, lemmasWithKey } from "../db.ts";
import { canPropose, isStaff } from "../permissions.ts";
import { checkForm, cleanOptionalText } from "../forms.ts";
import {
  field, h, letterPalette, posLabel, refItems, runAction, select, showError, statusBadge,
} from "../ui.ts";

const DEBOUNCE_MS: number = 300;

export async function renderNewLemma(ctx: Context, root: HTMLElement): Promise<void> {
  const { t } = ctx;
  if (!canPropose(ctx.role)) {
    root.append(h("p", { class: "error-text" }, t.errPermission));
  } else {
    const headword: HTMLInputElement = h("input", { type: "text", spellcheck: "false", autocomplete: "off" });
    const pos: HTMLSelectElement = select(
      [{ value: "", label: t.posNone }, ...PARTS_OF_SPEECH.map((p) => ({ value: p, label: posLabel(t, p) }))], "");
    const variety: HTMLSelectElement = select(refItems(ctx.refs.varieties), "zeneize");
    const orthography: HTMLSelectElement = select(refItems(ctx.refs.orthographies), "ofiçiâ");
    const note: HTMLTextAreaElement = h("textarea", { rows: 3 });
    const approveNow: HTMLInputElement | null = isStaff(ctx.role) ? h("input", { type: "checkbox" }) : null;
    const similar: HTMLElement = h("div", { class: "similar" });
    const createButton: HTMLButtonElement = h("button", { type: "submit", class: "primary" }, t.navNew);

    const form: HTMLFormElement = h("form", { class: "card edit-form" },
      h("h2", {}, t.newTitle),
      h("p", { class: "muted" }, t.newIntro),
      field(t.fieldHeadword, headword), letterPalette(t, headword), similar,
      field(t.fieldPos, pos), field(t.fieldVariety, variety), field(t.fieldOrthography, orthography),
      field(t.fieldNote, note),
      approveNow !== null && h("label", { class: "check" }, approveNow, t.approveNow),
      h("div", { class: "buttons" }, createButton),
    );

    let timer: number | undefined;
    headword.addEventListener("input", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void drawSimilar(ctx, headword.value, similar), DEBOUNCE_MS);
    });

    form.addEventListener("submit", (event: Event) => {
      event.preventDefault();
      const check = checkForm(headword.value);
      const cleanNote = cleanOptionalText(note.value, 2000);
      if (!check.ok) {
        showError(check.reason === "empty" ? t.errFormEmpty
          : check.reason === "too_long" ? t.errFormTooLong : t.errFormInvalid(check.bad.join(" ")));
      } else if (!cleanNote.ok) {
        showError(t.errTextTooLong(2000));
      } else {
        void runAction(t, createButton, async () => {
          const id: number = await createLemma({
            headword: check.value,
            variety: variety.value,
            orthography: orthography.value,
            part_of_speech: pos.value === "" ? null : pos.value,
            note: cleanNote.value,
            status: approveNow !== null && approveNow.checked ? "approved" : "pending",
          });
          ctx.navigate(`#/entry/${id}`, t.newCreated);
        });
      }
    });

    root.append(form);
    headword.focus();
  }
}

async function drawSimilar(ctx: Context, headword: string, target: HTMLElement): Promise<void> {
  const { t } = ctx;
  try {
    const lemmas: Lemma[] = await lemmasWithKey(headword);
    if (lemmas.length === 0) {
      target.replaceChildren();
    } else {
      const list: HTMLElement = h("ul", { class: "lemma-list" });
      for (const lemma of lemmas) {
        list.append(h("li", {},
          h("a", { href: `#/entry/${lemma.id}`, class: "headword" }, lemma.headword),
          h("span", { class: "muted" }, ` ${posLabel(t, lemma.part_of_speech)} · ${lemma.variety} `),
          statusBadge(t, lemma),
        ));
      }
      target.replaceChildren(h("p", { class: "warn-text" }, t.newSimilar), list);
    }
  } catch {
    target.replaceChildren();
  }
}
