# 0018: Design of the lexicon manager

* **Status:** accepted
* **Date:** 2026/10/11
* **Decided by:** Iosef Tesla R. [Ignatz-CastroR]

## Context

Decision [0016](0016-database-first-then-interface.md) set the purpose of the lexicon manager. This record fixes how it is built.

## Decision

* **Plain TypeScript, no framework.** The page is built with the DOM API and one small helper, `h()`. Contributors who know TypeScript can read every line; there is no framework to learn, upgrade or keep secure.
* **Vite** turns the TypeScript into static files [`npm run admin:build`]. The result runs on any static host; the planned host is **GitHub Pages**, built by a GitHub Actions workflow.
* **Supabase JS client**, talking directly to the database. Every rule is enforced by the database [[0011](0011-roles-and-review-workflow.md)], so the page holds no secret and needs no server of its own.
* **The publishable key is public by design.** It sits in the built page; row level security decides what each person may do. The secret key never reaches the manager.
* **No self sign up.** Accounts are created by an admin in the Supabase dashboard and start as `member`; the admin then promotes trusted people. This avoids spam accounts and the email confirmation service, whose free quota is tiny.
* **Interface in Italian by default, English available.** Most contributors are Genoese; every text lives in `admin/src/messages.ts`, and the compiler refuses a message missing from either language.
* **Signed out visitors can search** the published dictionary, read only. Published data is open [[0003](0003-open-data-and-licenses.md)].
* **Cosmetic permissions mirror the database.** `admin/src/permissions.ts` decides which buttons to show; `admin/test/permissions.test.ts` checks every answer against real update attempts on an embedded PostgreSQL. The interface is deliberately stricter in one case: a deleted row must be restored before its status can change.
* **The whole entry reloads after every change,** so the page never shows a state that was not stored. A version conflict [[0012](0012-never-hard-delete.md)] reloads too, then explains.
* **Text is inserted with `textContent`, never `innerHTML`,** so nothing a contributor types can inject markup or script into another person's page.

## Consequences

* Realtime updates [seeing another reviewer's change without reloading] are not in this version. Optimistic locking already prevents lost updates; realtime can be added later.
* A contributor who forgets their password needs an admin, until password reset email is configured.
