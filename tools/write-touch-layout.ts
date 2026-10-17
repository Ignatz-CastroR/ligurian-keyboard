/*
 * write-touch-layout.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 03:59:06, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Write the Keyman keyboard's on-screen layout file from its
 *           description in keyman/src/touch-layout.ts.
 * Usage:    npm run keyman:layout, after any change to touch-layout.ts;
 *           then commit both files together.
 * Contract: The only way the .keyman-touch-layout file changes. A test
 *           fails when the committed file differs from what this writes.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderTouchLayout } from "../keyman/src/touch-layout.ts";

const TARGET: string = fileURLToPath(
  new URL("../keyman/ligurian_keyboard/source/ligurian_keyboard.keyman-touch-layout", import.meta.url),
);

writeFileSync(TARGET, renderTouchLayout(), "utf8");
console.log(`Touch layout written to ${TARGET}`);
