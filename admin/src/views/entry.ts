/*
 * entry.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 20:21:50, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  One dictionary entry: the lemma, its forms, its numbered
 *           senses with their translations, and its history. Every
 *           button shown is one the database will accept for this
 *           person [permissions.ts]; the database checks again.
 * Contract: After every change the whole entry is reloaded from the
 *           database, so the page never shows a state that was not
 *           stored. A version conflict reloads too, then explains.
 * Updated:  2026/10/17, 10:57:21: a warning, and a question before
 *           saving, when a form would have ñ under the grafîa ofiçiâ
 *           [decision 0028].
 * Updated:  2026/10/17, 12:40:02: also when a form joins an elided
 *           particle and a word [decision 0029].
 * Updated:  2026/10/18, 09:14:22: the public code of the lemma and of
 *           every form, and in each line of history [decision 0030].
 * Updated:  2026/10/20, 01:45:50: a link to the same entry in the
 *           dictionary for readers, or why it is not there yet; several
 *           translations added at once, separated by ";", each its own
 *           row, and a language always chosen, never assumed; an edited
 *           translation may not hold ";" [decision 0035].

 * Updated:  2026/10/20, 23:49:12: "[senza definizione]" instead of a dash
 *           for a sense with no definition; for reviewers and admins, a
 *           link to the repair page of the senses, and when they were
 *           last reviewed [decision 0038]. */

import type { Context } from "../context.ts";
import type { AuditEntry, Entry, Gloss, LexiconTable, Profile, Sense, Status, Tracked, Wordform } from "../types.ts";
import { PARTS_OF_SPEECH } from "../types.ts";
import {
  AppError, createGloss, createSense, createWordform, entryHistory, loadEntry, profiles,
  restore, setStatus, softDelete, updateRow,
} from "../db.ts";
import {
  canAddChild, canChangeStatus, canDeleteRow, canEdit, isStaff,
} from "../permissions.ts";
import { dictionaryLink } from "../links.ts";
import {
  MAX_TRANSLATION_LENGTH, changedFields, checkForm, checkFreq, cleanOptionalText, formatDateTime, shortId, splitTranslations,
} from "../forms.ts";
import {
  appendAll, clear, confirmForms, describeError, field, formWarning, h, letterPalette, posLabel, refItems,
  runAction, select, replaceAll, showError, showInfo, statusBadge,
} from "../ui.ts";

type Reload = () => Promise<void>;

export async function renderEntry(ctx: Context, root: HTMLElement, param: string): Promise<void> {
  const lemmaId: number = Number(param);
  const reload: Reload = async (): Promise<void> => {
    clear(root);
    await renderEntry(ctx, root, param);
  };

  let entry: Entry | null = null;
  try {
    entry = await loadEntry(lemmaId);
  } catch (error: unknown) {
    root.append(h("p", { class: "error-text" }, describeError(ctx.t, error)));
  }

  if (entry !== null) {
    appendAll(root,
      lemmaSection(ctx, entry, reload),
      formsSection(ctx, entry, reload),
      sensesSection(ctx, entry, reload),
      isStaff(ctx.role) && historySection(ctx, entry),
    );
  }
}

/* ====================================================================
   Shared pieces
   ==================================================================== */

// Do something, then reload the entry. A conflict reloads first, so
// the person sees the current state together with the explanation.
async function changeAndReload(ctx: Context, button: HTMLButtonElement | null, change: () => Promise<void>, reload: Reload): Promise<void> {
  await runAction(ctx.t, button, async () => {
    try {
      await change();
    } catch (error: unknown) {
      if (error instanceof AppError && error.kind === "conflict") {
        await reload();
      }
      throw error;
    }
    await reload();
    showInfo(ctx.t.saved);
  });
}

// Approve, reject, delete, restore and edit buttons for one row.
function rowActions(ctx: Context, table: LexiconTable, row: Tracked, isBase: boolean, reload: Reload, onEdit: (() => void) | null): HTMLElement {
  const { t } = ctx;
  const bar: HTMLElement = h("span", { class: "actions" });

  const button = (label: string, cls: string, change: () => Promise<void>): HTMLButtonElement => {
    const b: HTMLButtonElement = h("button", { type: "button", class: cls }, label);
    b.addEventListener("click", () => void changeAndReload(ctx, b, change, reload));
    return b;
  };

  if (onEdit !== null && canEdit(ctx.role, row, ctx.userId)) {
    bar.append(h("button", { type: "button", class: "small", onclick: onEdit }, t.edit));
  }
  if (canChangeStatus(ctx.role, table, row, isBase)) {
    if (row.status !== "approved") {
      bar.append(button(t.approve, "small ok", () => setStatus(table, row.id, row.version, "approved")));
    }
    if (row.status !== "rejected") {
      bar.append(button(t.reject, "small warn", () => setStatus(table, row.id, row.version, "rejected")));
    }
  }
  if (canDeleteRow(ctx.role, table, isBase)) {
    if (row.deleted_at === null) {
      bar.append(button(t.remove, "small danger", async () => {
        if (window.confirm(t.confirmDelete)) {
          await softDelete(table, row.id, row.version);
        }
      }));
    } else {
      bar.append(button(t.restore, "small", () => restore(table, row.id, row.version)));
    }
  }
  return bar;
}

// "Approve at once", offered to reviewers and admins only.
function approveNowBox(ctx: Context): HTMLInputElement | null {
  return isStaff(ctx.role) ? h("input", { type: "checkbox" }) : null;
}

function statusFrom(box: HTMLInputElement | null): Status {
  return box !== null && box.checked ? "approved" : "pending";
}

// Check a Ligurian spelling typed in an input; null and a message when bad.
function readForm(ctx: Context, input: HTMLInputElement): string | null {
  const check = checkForm(input.value);
  let value: string | null = null;
  if (check.ok) {
    value = check.value;
  } else if (check.reason === "empty") {
    showError(ctx.t.errFormEmpty);
  } else if (check.reason === "too_long") {
    showError(ctx.t.errFormTooLong);
  } else {
    showError(ctx.t.errFormInvalid(check.bad.join(" ")));
  }
  return value;
}

function readOptional(ctx: Context, input: HTMLInputElement | HTMLTextAreaElement, max: number): { ok: true; value: string | null } | { ok: false } {
  const result = cleanOptionalText(input.value, max);
  if (!result.ok) {
    showError(ctx.t.errTextTooLong(max));
  }
  return result;
}

function formRow(...children: (HTMLElement | null | false)[]): HTMLElement {
  return h("div", { class: "edit-form" }, ...children);
}

/* ====================================================================
   The lemma
   ==================================================================== */

// The same entry as readers see it, or why they cannot yet.
function inDictionary(ctx: Context, lemma: Entry["lemma"]): HTMLElement {
  const link = dictionaryLink(lemma);
  return link.kind === "published"
    ? h("p", { class: "to-dictionary" }, h("a", { href: link.href, class: "button-link" }, `${ctx.t.entryInDictionary} →`))
    : h("p", { class: "muted to-dictionary" }, {
      pending: ctx.t.entryNotInDictionaryPending,
      rejected: ctx.t.entryNotInDictionaryRejected,
      deleted: ctx.t.entryNotInDictionaryDeleted,
    }[link.reason]);
}

function lemmaSection(ctx: Context, entry: Entry, reload: Reload): HTMLElement {
  const { t } = ctx;
  const lemma = entry.lemma;
  const section: HTMLElement = h("section", { class: "card" });

  const show = (): void => {
    replaceAll(section,
      h("div", { class: "entry-head" },
        h("h2", { class: "headword big" }, lemma.headword),
        statusBadge(t, lemma),
        rowActions(ctx, "lemmas", lemma, false, reload, edit),
      ),
      h("p", { class: "muted" },
        `${posLabel(t, lemma.part_of_speech)} · ${lemma.variety} · ${lemma.orthography} · ${t.entryVersion(lemma.version)} · `,
        h("span", { class: "mono", title: t.publicIdNote }, `${t.fieldPublicId} ${lemma.public_id}`)),
      inDictionary(ctx, lemma),
      lemma.note !== null && h("p", { class: "note" }, lemma.note),
    );
  };

  const edit = (): void => {
    const headword: HTMLInputElement = h("input", { type: "text", value: lemma.headword, spellcheck: "false" });
    const pos: HTMLSelectElement = select(
      [{ value: "", label: t.posNone }, ...PARTS_OF_SPEECH.map((p) => ({ value: p, label: posLabel(t, p) }))],
      lemma.part_of_speech ?? "",
    );
    const variety: HTMLSelectElement = select(refItems(ctx.refs.varieties), lemma.variety);
    const orthography: HTMLSelectElement = select(refItems(ctx.refs.orthographies), lemma.orthography);
    const note: HTMLTextAreaElement = h("textarea", { rows: 3 });
    note.value = lemma.note ?? "";
    const saveButton: HTMLButtonElement = h("button", { type: "submit", class: "primary" }, t.save);
    // A change of spelling system concerns the inflected forms too.
    const otherForms: string[] = entry.wordforms
      .filter((w) => !w.is_base && w.deleted_at === null).map((w) => w.form);
    const warning = formWarning(t);
    const checkForms = (): void => warning.update([headword.value, ...otherForms], orthography.value, [headword.value]);
    headword.addEventListener("input", checkForms);
    orthography.addEventListener("change", checkForms);

    const form: HTMLFormElement = h("form", { class: "edit-form" },
      field(t.fieldHeadword, headword), letterPalette(t, headword),
      field(t.fieldPos, pos), field(t.fieldVariety, variety), field(t.fieldOrthography, orthography),
      warning.element,
      field(t.fieldNote, note),
      h("div", { class: "buttons" }, saveButton, h("button", { type: "button", onclick: show }, t.cancel)),
    );
    form.addEventListener("submit", (event: Event) => {
      event.preventDefault();
      const newHeadword: string | null = readForm(ctx, headword);
      const newNote = readOptional(ctx, note, 2000);
      if (newHeadword !== null && newNote.ok && confirmForms(t, [newHeadword, ...otherForms], orthography.value, [newHeadword])) {
        void changeAndReload(ctx, saveButton, () => updateRow("lemmas", lemma.id, lemma.version, {
          headword: newHeadword,
          part_of_speech: pos.value === "" ? null : pos.value,
          variety: variety.value,
          orthography: orthography.value,
          note: newNote.value,
        }), reload);
      }
    });
    section.replaceChildren(form);
    checkForms();
    headword.focus();
  };

  show();
  return section;
}

/* ====================================================================
   Forms: the automatic base form and the inflected forms
   ==================================================================== */

function formsSection(ctx: Context, entry: Entry, reload: Reload): HTMLElement {
  const { t } = ctx;
  const list: HTMLElement = h("ul", { class: "item-list" });
  for (const wordform of entry.wordforms) {
    list.append(wordformItem(ctx, wordform, entry.lemma.orthography, reload));
  }

  return h("section", { class: "card" },
    h("h3", {}, t.entryForms),
    entry.wordforms.length === 0 ? h("p", { class: "muted" }, t.nothing) : list,
    canAddChild(ctx.role, entry.lemma) && addWordformForm(ctx, entry, reload),
  );
}

function wordformItem(ctx: Context, wordform: Wordform, orthography: string, reload: Reload): HTMLElement {
  const { t } = ctx;
  const item: HTMLElement = h("li", {});

  const show = (): void => {
    replaceAll(item,
      h("span", { class: "headword" }, wordform.form),
      wordform.is_base && h("span", { class: "tag", title: t.entryBaseNote }, t.entryBase),
      wordform.grammatical_tag !== null && h("span", { class: "muted" }, ` ${wordform.grammatical_tag}`),
      h("span", { class: "muted" }, ` · ${t.fieldFreq.toLowerCase()} ${wordform.freq} · `),
      h("span", { class: "muted mono", title: t.publicIdNote }, `${wordform.public_id} `),
      statusBadge(t, wordform),
      rowActions(ctx, "wordforms", wordform, wordform.is_base, reload, edit),
    );
  };

  const edit = (): void => {
    const form: HTMLInputElement = h("input", { type: "text", value: wordform.form, spellcheck: "false", disabled: wordform.is_base });
    const tag: HTMLInputElement = h("input", { type: "text", value: wordform.grammatical_tag ?? "", maxlength: 40 });
    const freq: HTMLInputElement = h("input", { type: "number", min: 0, step: 1, value: wordform.freq });
    const saveButton: HTMLButtonElement = h("button", { type: "submit", class: "primary" }, t.save);
    const warning = formWarning(t);
    form.addEventListener("input", () => warning.update([form.value], orthography));
    const editor: HTMLFormElement = h("form", { class: "edit-form" },
      field(t.fieldForm, form), !wordform.is_base && letterPalette(t, form), !wordform.is_base && warning.element,
      wordform.is_base && h("p", { class: "muted" }, t.entryBaseNote),
      field(t.fieldTag, tag), field(t.fieldFreq, freq),
      h("div", { class: "buttons" }, saveButton, h("button", { type: "button", onclick: show }, t.cancel)),
    );
    editor.addEventListener("submit", (event: Event) => {
      event.preventDefault();
      const newForm: string | null = wordform.is_base ? wordform.form : readForm(ctx, form);
      const newTag = readOptional(ctx, tag, 40);
      const newFreq: number | null = checkFreq(freq.value);
      if (newFreq === null) {
        showError(t.errFreq);
      } else if (newForm !== null && newTag.ok && (wordform.is_base || confirmForms(t, [newForm], orthography))) {
        const patch: Record<string, unknown> = { grammatical_tag: newTag.value, freq: newFreq };
        if (!wordform.is_base) {
          patch["form"] = newForm;
        }
        void changeAndReload(ctx, saveButton, () => updateRow("wordforms", wordform.id, wordform.version, patch), reload);
      }
    });
    item.replaceChildren(editor);
  };

  show();
  return item;
}

function addWordformForm(ctx: Context, entry: Entry, reload: Reload): HTMLElement {
  const { t } = ctx;
  const form: HTMLInputElement = h("input", { type: "text", spellcheck: "false" });
  const tag: HTMLInputElement = h("input", { type: "text", maxlength: 40, placeholder: "pl., f. sg., 3 sg. pres." });
  const freq: HTMLInputElement = h("input", { type: "number", min: 0, step: 1, value: 1 });
  const approveNow: HTMLInputElement | null = approveNowBox(ctx);
  const addButton: HTMLButtonElement = h("button", { type: "submit" }, t.add);
  const warning = formWarning(t);
  form.addEventListener("input", () => warning.update([form.value], entry.lemma.orthography));

  const editor: HTMLFormElement = h("form", { class: "edit-form add-form" },
    h("h4", {}, t.entryAddForm),
    field(t.fieldForm, form), letterPalette(t, form), warning.element,
    field(t.fieldTag, tag), field(t.fieldFreq, freq),
    approveNow !== null && h("label", { class: "check" }, approveNow, t.approveNow),
    h("div", { class: "buttons" }, addButton),
  );
  editor.addEventListener("submit", (event: Event) => {
    event.preventDefault();
    const newForm: string | null = readForm(ctx, form);
    const newTag = readOptional(ctx, tag, 40);
    const newFreq: number | null = checkFreq(freq.value);
    if (newFreq === null) {
      showError(t.errFreq);
    } else if (newForm !== null && newTag.ok && confirmForms(t, [newForm], entry.lemma.orthography)) {
      void changeAndReload(ctx, addButton, async () => {
        await createWordform(entry.lemma.id, newForm, newTag.value, newFreq, statusFrom(approveNow));
      }, reload);
    }
  });
  return editor;
}

/* ====================================================================
   Senses and their translations
   ==================================================================== */

function sensesSection(ctx: Context, entry: Entry, reload: Reload): HTMLElement {
  const { t } = ctx;
  const list: HTMLElement = h("ol", { class: "sense-list" });
  for (const { sense, glosses } of entry.senses) {
    list.append(senseItem(ctx, sense, glosses, reload));
  }
  const live: boolean = entry.lemma.deleted_at === null;
  return h("section", { class: "card" },
    h("h3", {}, t.entrySenses),
    isStaff(ctx.role) && live && entry.senses.some((s) => s.sense.deleted_at === null) && h("p", { class: "small-text" },
      h("a", { href: `#/repair/${entry.lemma.id}` }, t.entryRepairLink),
      entry.lemma.senses_reviewed_at !== null
        && h("span", { class: "muted" }, ` · ${t.repairReviewedAt(formatDateTime(entry.lemma.senses_reviewed_at))}`)),
    entry.senses.length === 0 ? h("p", { class: "muted" }, t.entryNoSenses) : list,
    entry.lemma.status !== "approved" && entry.senses.length > 0 && h("p", { class: "muted" }, t.entryPublishedNote),
    canAddChild(ctx.role, entry.lemma) && addSenseForm(ctx, entry, reload),
  );
}

function senseItem(ctx: Context, sense: Sense, glosses: Gloss[], reload: Reload): HTMLElement {
  const { t } = ctx;
  const item: HTMLElement = h("li", { value: sense.sense_number });
  const head: HTMLElement = h("div", { class: "sense-head" });

  const show = (): void => {
    head.replaceChildren(
      h("span", { class: sense.definition_it === null ? "muted" : "" }, sense.definition_it ?? t.noDefinition),
      " ", statusBadge(t, sense),
      rowActions(ctx, "senses", sense, false, reload, edit),
    );
  };

  const edit = (): void => {
    const definition: HTMLTextAreaElement = h("textarea", { rows: 2 });
    definition.value = sense.definition_it ?? "";
    const saveButton: HTMLButtonElement = h("button", { type: "submit", class: "primary" }, t.save);
    const editor: HTMLFormElement = h("form", { class: "edit-form" },
      field(t.fieldDefinition, definition),
      h("div", { class: "buttons" }, saveButton, h("button", { type: "button", onclick: show }, t.cancel)),
    );
    editor.addEventListener("submit", (event: Event) => {
      event.preventDefault();
      const newDefinition = readOptional(ctx, definition, 1000);
      if (newDefinition.ok) {
        void changeAndReload(ctx, saveButton,
          () => updateRow("senses", sense.id, sense.version, { definition_it: newDefinition.value }), reload);
      }
    });
    head.replaceChildren(editor);
  };

  const glossList: HTMLElement = h("ul", { class: "gloss-list" });
  for (const gloss of glosses) {
    glossList.append(glossItem(ctx, gloss, reload));
  }

  show();
  appendAll(item,
    head,
    glosses.length === 0 ? h("p", { class: "muted small-text" }, t.entryNoGlosses) : glossList,
    canAddChild(ctx.role, sense) && addGlossForm(ctx, sense, reload),
  );
  return item;
}

function glossItem(ctx: Context, gloss: Gloss, reload: Reload): HTMLElement {
  const { t } = ctx;
  const item: HTMLElement = h("li", {});

  const show = (): void => {
    item.replaceChildren(
      h("span", { class: "lang" }, gloss.language), ` ${gloss.gloss} `,
      statusBadge(t, gloss),
      rowActions(ctx, "glosses", gloss, false, reload, edit),
    );
  };

  const edit = (): void => {
    const language: HTMLSelectElement = select(refItems(ctx.refs.languages), gloss.language);
    const text: HTMLInputElement = h("input", { type: "text", value: gloss.gloss, maxlength: 500 });
    const saveButton: HTMLButtonElement = h("button", { type: "submit", class: "primary" }, t.save);
    const editor: HTMLFormElement = h("form", { class: "edit-form inline" },
      field(t.fieldLanguage, language), field(t.fieldGloss, text),
      h("div", { class: "buttons" }, saveButton, h("button", { type: "button", onclick: show }, t.cancel)),
    );
    editor.addEventListener("submit", (event: Event) => {
      event.preventDefault();
      const newText = readOptional(ctx, text, MAX_TRANSLATION_LENGTH);
      if (newText.ok && newText.value === null) {
        showError(t.errFormEmpty);
      } else if (newText.ok && newText.value !== null && newText.value.includes(";")) {
        showError(t.errGlossSemicolon);
      } else if (newText.ok) {
        void changeAndReload(ctx, saveButton,
          () => updateRow("glosses", gloss.id, gloss.version, { language: language.value, gloss: newText.value }), reload);
      }
    });
    item.replaceChildren(editor);
  };

  show();
  return item;
}

function addSenseForm(ctx: Context, entry: Entry, reload: Reload): HTMLElement {
  const { t } = ctx;
  const definition: HTMLTextAreaElement = h("textarea", { rows: 2 });
  const approveNow: HTMLInputElement | null = approveNowBox(ctx);
  const addButton: HTMLButtonElement = h("button", { type: "submit" }, t.add);
  const editor: HTMLFormElement = h("form", { class: "edit-form add-form" },
    h("h4", {}, t.entryAddSense),
    field(t.fieldDefinition, definition),
    approveNow !== null && h("label", { class: "check" }, approveNow, t.approveNow),
    h("div", { class: "buttons" }, addButton),
  );
  editor.addEventListener("submit", (event: Event) => {
    event.preventDefault();
    const newDefinition = readOptional(ctx, definition, 1000);
    if (newDefinition.ok) {
      void changeAndReload(ctx, addButton, async () => {
        await createSense(entry.lemma.id, newDefinition.value, statusFrom(approveNow));
      }, reload);
    }
  });
  return editor;
}

/* Translations of one sense, one or several at once, separated by
   ";". The language starts unchosen and must be chosen: until 0.13.0 it
   started at Italian, and words loaded in a hurry kept it whatever
   their language was. */
function addGlossForm(ctx: Context, sense: Sense, reload: Reload): HTMLElement {
  const { t } = ctx;
  const language: HTMLSelectElement = select(
    [{ value: "", label: t.glossLanguageChoose }, ...refItems(ctx.refs.languages)], "");
  // Checked on submit with the manager's own message, in the page's
  // language, rather than by the browser's.
  language.setAttribute("aria-required", "true");
  const text: HTMLInputElement = h("input", { type: "text", maxlength: 2000, title: t.glossSplitNote });
  const preview: HTMLElement = h("p", { class: "muted small-text", "aria-live": "polite" }, t.glossSplitNote);
  const approveNow: HTMLInputElement | null = approveNowBox(ctx);
  const addButton: HTMLButtonElement = h("button", { type: "submit", class: "small" }, t.add);
  const editor: HTMLFormElement = h("form", { class: "edit-form inline add-form" },
    field(t.fieldLanguage, language), field(t.fieldGloss, text),
    approveNow !== null && h("label", { class: "check" }, approveNow, t.approveNow),
    h("div", { class: "buttons" }, addButton),
    preview,
  );
  editor.setAttribute("aria-label", t.entryAddGloss);
  text.addEventListener("input", () => {
    const split = splitTranslations(text.value);
    preview.textContent = split.ok && split.items.length > 1 ? t.glossPreview(split.items.join(" · ")) : t.glossSplitNote;
  });
  editor.addEventListener("submit", (event: Event) => {
    event.preventDefault();
    const split = splitTranslations(text.value);
    if (language.value === "") {
      showError(t.errGlossLanguage);
      language.focus();
    } else if (!split.ok) {
      showError(split.reason === "empty" ? t.errFormEmpty : t.errTextTooLong(MAX_TRANSLATION_LENGTH));
    } else {
      const chosen: string = language.value;
      // One row each, in the order typed. A refusal stops the rest; when
      // some were saved before it, the entry is reloaded first, so the
      // page shows which, and the error is reported over it.
      void changeAndReload(ctx, addButton, async () => {
        let saved: number = 0;
        try {
          for (const gloss of split.items) {
            await createGloss(sense.id, chosen, gloss, statusFrom(approveNow));
            saved += 1;
          }
        } catch (error: unknown) {
          if (saved > 0) {
            await reload();
          }
          throw error;
        }
      }, reload);
    }
  });
  return editor;
}

/* ====================================================================
   History, for reviewers and admins
   ==================================================================== */

function historySection(ctx: Context, entry: Entry): HTMLElement {
  const { t } = ctx;
  const body: HTMLElement = h("div", {});
  const toggle: HTMLButtonElement = h("button", { type: "button" }, t.history);
  let open: boolean = false;

  toggle.addEventListener("click", () => {
    open = !open;
    toggle.textContent = open ? t.hideHistory : t.history;
    if (open) {
      body.replaceChildren(h("p", { class: "muted" }, t.loading));
      void drawHistory(ctx, entry, body);
    } else {
      clear(body);
    }
  });

  return h("section", { class: "card" }, toggle, body);
}

async function drawHistory(ctx: Context, entry: Entry, body: HTMLElement): Promise<void> {
  const { t } = ctx;
  try {
    const [history, people] = await Promise.all([entryHistory(entry), profiles()]);
    const names: Map<string, string> = new Map(people.map((p: Profile) => [p.user_id, p.display_name]));
    const actionLabels: Record<AuditEntry["action"], string> = {
      insert: t.historyInsert, update: t.historyUpdate,
      soft_delete: t.historySoftDelete, restore: t.historyRestore,
    };
    const list: HTMLElement = h("ul", { class: "history" });
    for (const row of history) {
      const who: string = row.actor === null ? "SQL" : (names.get(row.actor) || shortId(row.actor));
      const fields: string[] = changedFields(row.old_row, row.new_row);
      const subject: unknown = row.new_row?.["headword"] ?? row.new_row?.["form"]
        ?? row.new_row?.["gloss"] ?? row.new_row?.["definition_it"] ?? row.row_id;
      // Lemmas and wordforms written before 0.10.0 have no code in their oldest lines.
      const code: unknown = row.new_row?.["public_id"];
      list.append(h("li", {},
        h("span", { class: "muted" }, formatDateTime(row.at)), " ",
        h("strong", {}, actionLabels[row.action]), ` ${row.table_name} «${String(subject)}» `,
        typeof code === "string" && h("span", { class: "mono" }, `${code} `),
        `· ${who}`,
        fields.length > 0 && h("span", { class: "muted" }, ` · ${t.historyChanged(fields.join(", "))}`),
      ));
    }
    body.replaceChildren(history.length === 0 ? h("p", { class: "muted" }, t.nothing) : list);
  } catch (error: unknown) {
    body.replaceChildren(h("p", { class: "error-text" }, describeError(t, error)));
  }
}
