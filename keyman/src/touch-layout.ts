/*
 * touch-layout.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/17, 04:04:24, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The on-screen layout of the Ligurian Keyman keyboard, built
 *           from a short description instead of written by hand: an
 *           Italian QWERTY phone keyboard whose vowels and c hold every
 *           Ligurian letter on long press.
 * Returns:  touchLayout[] gives the object Keyman reads from
 *           ligurian_keyboard.keyman-touch-layout; renderTouchLayout[]
 *           gives that file's exact text.
 * Contract: The committed .keyman-touch-layout file is always
 *           renderTouchLayout[]; tools/write-touch-layout.ts writes it
 *           and a test fails when the two differ, so the file is never
 *           edited by hand. Every key that types a character uses a
 *           U_XXXX id, which Keyman types as that exact character on
 *           any layer, with no rule and no modifier involved.
 * Decision: docs/decisions/0022-keyman-keyboard-design.md
 */

export interface TouchSubKey {
  id: string;
  text: string;
  sp?: number;
  nextlayer?: string;
}

export interface TouchKey {
  id: string;
  text: string;
  width?: number;
  pad?: number;
  sp?: number;
  nextlayer?: string;
  sk?: TouchSubKey[];
  multitap?: TouchSubKey[];
}

export interface TouchRow {
  id: number;
  key: TouchKey[];
}

export interface TouchLayer {
  id: string;
  row: TouchRow[];
}

export interface TouchPlatform {
  displayUnderlying: boolean;
  defaultHint: "dot";
  layer: TouchLayer[];
}

export interface TouchLayout {
  phone: TouchPlatform;
  tablet: TouchPlatform;
}

// Keyman key types ["sp"]: an ordinary key, a frame key [Shift, Enter,
// Backspace], a frame key shown as active, and an invisible spacer.
//
// Widths, in Keyman's units: a key is 100 wide unless it says otherwise,
// and Keyman puts a gap of KEYMAN_DEFAULT_PAD before every key that has
// no larger "pad" [an explicit 0 counts as missing]. Keyman stretches the
// last key of any row narrower than the widest one, so every row here
// adds up to exactly ROW_WIDTH: ten letter keys, 10 x [15 + 100].
const SP_FRAME: number = 1;
const SP_ACTIVE: number = 2;
const SP_SPACER: number = 10;

export const KEYMAN_DEFAULT_PAD: number = 15;
export const ROW_WIDTH: number = 1150;

// The letters every Ligurian spelling may need beyond plain ASCII, on
// long press of their base letter. Order inside each list: grave, acute,
// circumflex, diaeresis, as in the Académia's Arfabêto; æ comes after
// the accented a's. These are exactly the non-ASCII letters folded by
// engine/src/skeleton.ts, which a test checks.
export const LONG_PRESS: Readonly<Record<string, readonly string[]>> = {
  a: ["à", "á", "â", "ä", "æ"],
  e: ["è", "é", "ê", "ë"],
  i: ["ì", "í", "î", "ï"],
  o: ["ò", "ó", "ô", "ö"],
  u: ["ù", "ú", "û", "ü"],
  c: ["ç"],
};

const LETTER_ROWS: readonly string[] = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

// The id Keyman uses to type one character: U_ plus its code point.
export function charKeyId(ch: string): string {
  const code: number | undefined = ch.codePointAt(0);
  if (code === undefined || [...ch].length !== 1) {
    throw new Error(`charKeyId needs exactly one character, got "${ch}"`);
  }
  return `U_${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

function sub(ch: string): TouchSubKey {
  return { id: charKeyId(ch), text: ch };
}

function charKey(ch: string, longPress: readonly string[] = [], extra: Partial<TouchKey> = {}): TouchKey {
  const key: TouchKey = { id: charKeyId(ch), text: ch, ...extra };
  if (longPress.length > 0) {
    key.sk = longPress.map(sub);
  }
  return key;
}

function letterKey(letter: string, upper: boolean, extra: Partial<TouchKey> = {}): TouchKey {
  const accents: readonly string[] = LONG_PRESS[letter] ?? [];
  const shown: string = upper ? letter.toUpperCase() : letter;
  return charKey(shown, accents.map((a) => (upper ? a.toUpperCase() : a)), extra);
}

function spacer(layerId: string, rowId: number, width: number): TouchKey {
  return { id: `T_SPACER_${layerId.toUpperCase()}_${rowId}`, text: "", width, sp: SP_SPACER };
}

// Shift on each letter layer. One tap on the default layer gives one
// capital; a double tap [Keyman's multitap] locks capitals; on the
// locked layer, Shift returns to lower case.
function shiftKey(layerId: string): TouchKey {
  const toCaps: TouchSubKey = { id: "T_CAPS", text: "*ShiftLock*", sp: SP_FRAME, nextlayer: "caps" };
  let key: TouchKey;
  if (layerId === "default") {
    key = { id: "K_SHIFT", text: "*Shift*", width: 158, sp: SP_FRAME, nextlayer: "shift", multitap: [toCaps] };
  } else if (layerId === "shift") {
    key = { id: "K_SHIFT", text: "*Shifted*", width: 158, sp: SP_ACTIVE, nextlayer: "default", multitap: [toCaps] };
  } else {
    key = { id: "K_SHIFT", text: "*ShiftedLock*", width: 158, sp: SP_ACTIVE, nextlayer: "default" };
  }
  return key;
}

const BACKSPACE: TouchKey = { id: "K_BKSP", text: "*BkSp*", width: 157, sp: SP_FRAME };
const GLOBE: TouchKey = { id: "K_LOPT", text: "*Menu*", width: 100, sp: SP_FRAME };
const ENTER: TouchKey = { id: "K_ENTER", text: "*Enter*", width: 140, sp: SP_FRAME };

function space(width: number): TouchKey {
  return { id: "K_SPACE", text: "", width };
}

// The bottom row of the three letter layers. The apostrophe has its own
// key, because Ligurian elides constantly: l', d', s', ch'.
function letterBottomRow(): TouchRow {
  return {
    id: 4,
    key: [
      { id: "K_NUMLOCK", text: "*123*", width: 140, sp: SP_FRAME, nextlayer: "numeric" },
      GLOBE,
      charKey(",", [";", ":"]),
      space(365),
      charKey("'", ["’", "\"", "«", "»"]),
      charKey(".", ["!", "?", "…"]),
      ENTER,
    ],
  };
}

function letterLayer(layerId: "default" | "shift" | "caps"): TouchLayer {
  const upper: boolean = layerId !== "default";
  const [top, middle, bottom] = LETTER_ROWS;
  const middleKeys: TouchKey[] = [...(middle ?? "")].map((l, i) => letterKey(l, upper, i === 0 ? { pad: 65 } : {}));
  return {
    id: layerId,
    row: [
      { id: 1, key: [...(top ?? "")].map((l) => letterKey(l, upper)) },
      // Nine keys, centered: 65 before a, 15 + 50 after l.
      { id: 2, key: [...middleKeys, spacer(layerId, 2, 50)] },
      { id: 3, key: [shiftKey(layerId), ...[...(bottom ?? "")].map((l) => letterKey(l, upper)), BACKSPACE] },
      letterBottomRow(),
    ],
  };
}

function numericLayer(): TouchLayer {
  return {
    id: "numeric",
    row: [
      { id: 1, key: [..."1234567890"].map((d) => charKey(d)) },
      {
        id: 2,
        key: [
          charKey("@"),
          charKey("#"),
          charKey("€", ["$", "£"]),
          charKey("&", ["~", "^"]),
          charKey("_"),
          charKey("-", ["–", "—"]),
          charKey("+", ["=", "±"]),
          charKey("(", ["[", "{", "<"]),
          charKey(")", ["]", "}", ">"]),
          charKey("/", ["\\", "|"]),
        ],
      },
      {
        id: 3,
        key: [
          charKey("%", ["‰"], { pad: 73 }),
          charKey("*", ["°", "§"]),
          charKey("\"", ["«", "»", "“", "”"]),
          charKey("'", ["’", "‘"]),
          charKey(":"),
          charKey(";"),
          charKey("!", ["¡"]),
          charKey("?", ["¿"]),
          BACKSPACE,
        ],
      },
      {
        id: 4,
        key: [
          { id: "K_LOWER", text: "*abc*", width: 140, sp: SP_FRAME, nextlayer: "default" },
          GLOBE,
          charKey(","),
          space(480),
          charKey("."),
          ENTER,
        ],
      },
    ],
  };
}

function platform(): TouchPlatform {
  return {
    displayUnderlying: false,
    defaultHint: "dot",
    layer: [letterLayer("default"), letterLayer("shift"), letterLayer("caps"), numericLayer()],
  };
}

// Phones and tablets get the same layout; Keyman scales it to the screen.
export function touchLayout(): TouchLayout {
  return { phone: platform(), tablet: platform() };
}

// The file's exact text: two-space JSON, characters written as
// themselves, one final newline.
export function renderTouchLayout(): string {
  return `${JSON.stringify(touchLayout(), null, 2)}\n`;
}
