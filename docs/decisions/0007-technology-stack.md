# 0007: Technology stack

* **Status:** accepted
* **Date:** 2026/10/10, completed 2026/10/11
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refined by:** [0021](0021-keyman-scope-and-toolchain.md), on what Keyman can do on each system

## Context

The same conversion code must run in three places: in web browsers [the editor and the lexicon manager], inside Keyman's predictive text models, and in Node.js for tests and tools. The shared dictionary needs a database with logins and permissions that every contributor can reach from a browser, at no cost at this scale.

## Decision

* **TypeScript** for the engine, the editor and the lexicon manager.
  * The only language browsers run natively is JavaScript, and Keyman's predictive models are written in TypeScript. One `skeleton()` therefore runs everywhere, and the folding can never differ between the keyboard, the editor and the database export.
  * The type checker catches errors before the code runs, which matters more as contributors join.
  * Node.js 22.18 or newer runs `.ts` files directly; `tsc --noEmit` only checks types.
* **PostgreSQL** for the database, hosted by **Supabase**, which adds logins, permissions and an HTTP API.
  * Everything is plain PostgreSQL SQL, apart from `auth.users` and `auth.uid()`. The database can move to any PostgreSQL server.
  * Project region: **Central EU [Frankfurt]**, the closest to Genoa. Free plan.
* **Keyman** [SIL International, free and open source] for keyboards on Windows, macOS, Linux, Android, iOS and the web, instead of writing an input method for each system.
* **Web apps** for the editor and the lexicon manager: nothing to install, any device.
* **Tests:** Node's built-in test runner. The database is tested on **PGlite**, a real PostgreSQL compiled to WebAssembly, so the tests need no server and no PostgreSQL installation.
* Rejected: Python and Go [they cannot run in the browser without heavy toolchains]; plain JavaScript [no type checking]; COBOL, Fortran and Rust [wrong tools for browser and keyboard code].

## Consequences

* A Python tool remains a fit for one future job: counting word frequencies in a text corpus [see [0009](0009-data-sources.md)].
