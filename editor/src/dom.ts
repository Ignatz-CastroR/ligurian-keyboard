/*
 * dom.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/17, 02:12:54, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The one page building helper of the web editor, the same
 *           shape as h[] in the lexicon manager.
 * Contract: Text is inserted with textContent semantics [append of a
 *           string], never innerHTML: dictionary words cannot inject
 *           markup into the page.
 */

type Child = Node | string | null | undefined | false;
type AttrValue = string | number | boolean | undefined;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, AttrValue> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element: HTMLElementTagNameMap[K] = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (typeof value === "boolean") {
      element.toggleAttribute(name, value);
    } else if (value !== undefined) {
      element.setAttribute(name, String(value));
    }
  }
  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) {
      element.append(child);
    }
  }
  return element;
}
