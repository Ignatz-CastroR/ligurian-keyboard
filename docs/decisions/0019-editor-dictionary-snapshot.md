# 0019: The web editor reads a daily snapshot of the dictionary

* **Status:** accepted
* **Date:** 2026/10/17
* **Decided by:** Iosef Tesla R. [Ignatz-CastroR]

## Context

The web editor needs the published dictionary to convert words. It could ask the database for it on every visit, or read a copy taken when the site is built. Decision [0001](0001-input-method-not-editor.md) already foresaw that ordinary users need only a recent copy, not live data.

## Decision

* **A snapshot is taken at build time.** `tools/fetch-lexicon.ts` calls `export_lexicon_tsv()` with the publishable key, checks the result with the engine's own loader, stamps it with the time in UTC and writes `editor/public/lexicon.tsv`. Vite copies it into the site; the editor downloads it like any other file.
* **The workflow rebuilds the site every day** at 03:17 UTC, on every push to `main`, and on demand [Actions → Run workflow].
* **A bad snapshot is never published.** If the call fails, or the text has invalid rows, or no approved form at all, the script exits with an error, the build stops, and the site keeps its last good version.
* **The editor never talks to the database.** It holds no key and makes no request to Supabase.
* **The snapshot is generated, never committed.** It is listed in `.gitignore`; locally, `npm run lexicon:fixture` puts the test fixture in its place.

## Consequences

* **One code path.** The editor parses the same TSV with the same `Lexicon` class as the terminal demo and the tests.
* **Offline use.** A service worker keeps a copy of the page and of the snapshot after the first visit.
* **Ordinary visitors cost the database nothing;** only staff in the lexicon manager reach Supabase.
* **Newly approved words reach the editor up to a day later,** or at once when someone runs the workflow by hand.
* **GitHub disables scheduled workflows** in a repository with no activity for 60 days. If that happens, Actions shows a button to enable the workflow again; until then the editor keeps the last snapshot.
