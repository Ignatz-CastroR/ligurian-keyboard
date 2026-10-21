# users: the Users section

The site's section for the people of the shared dictionary, published at <https://ignatz-castror.github.io/ligurian-keyboard/utenti/>: each person's profile and complete history and, for reviewers and admins, everyone's. Plain TypeScript, built with [Vite](https://vite.dev) from the lexicon manager's own modules, so the two share one sign-in and name every role and status alike. Design: decision [0035](../docs/decisions/0035-site-in-five-sections.md).

The interface is in **Italian**, the default, **English** and **Spanish**, and shares its language choice with every other section.

## Views

At the top, the site's bar of five sections with the dictionary's size [`site/`].

| Address | View |
|---|---|
| `#/` | Signed out: an invitation to sign in. Signed in: one's own profile, where the display name is changed, and a link to one's own complete history. For reviewers and admins, also every person with their role, how many changes they made, when the last one was and a link to their history; anyone in the history without a profile [an account deleted since]; and "SQL Editor [no person]", the changes written from Supabase's SQL Editor without naming a person. Admins rename people and change roles here |
| `#/persona/<user id>` | One person's complete history: a summary of their changes by kind, with the first and last time, then every change, newest first, a hundred at a time until the first: its date and time to the second, what it was [created, edited, approved, rejected, sent back to review, deleted, restored; for a lemma also senses reviewed, senses sent back to review, put on the senses to review], the kind of row [lemma, form, sense, translation], the entry it belongs to, linked to the lexicon manager, the status it left and, for an edit, the fields it changed |
| `#/persona/sql` | The same for the changes written from the SQL Editor |
| `#/accedi` | Sign in, the manager's own form |

## Who sees what

The database decides, through the three functions of migration 0011; the page only shows its answer.

| Person | Sees |
|---|---|
| visitor without an account | nothing but the invitation to sign in |
| member, contributor | their own profile and their own complete history |
| reviewer | also every person and anyone's complete history, the SQL Editor's included |
| admin | as a reviewer; also renames people and changes roles |

The database still refuses self promotion and the demotion of the last admin [migration 0002].

## Data

| Function | Answers |
|---|---|
| `people_activity()` | Every person with at least one change, and the SQL Editor's changes, with how many and the time of the last |
| `user_history(user, before, limit)` | One page of a person's changes, newest first; `before` is the id of the last change shown. For an update, the fields it changed and, since migration 0013, those it set to null, so that a review date cleared reads as the senses sent back to review |
| `user_summary(user)` | A person's changes counted by table and action |

Profiles are read and changed through the `profiles` table, as the manager did. Contracts: `db/migrations/0011_site_sections.sql` and `db/README.md`.

## Files

| File | Contents |
|---|---|
| `index.html` | The page shell |
| `src/main.ts` | Start up, session, the site's bar, header, routing |
| `src/model.ts` | The addresses of the views; what each change was, an approval read as "approved" rather than "edited: status"; the link to an entry; pure functions |
| `src/messages.ts` | The texts the manager does not already have, in Italian, English and Spanish |
| `src/views/people.ts` | The first page: profile, people, activity |
| `src/views/person.ts` | One person's history |
| `src/env.d.ts` | The two build settings, as the manager's |
| `test/users.test.ts` | 5 tests: addresses, what each change was, on rows from the real database too, a review date set and then cleared among them, and the three languages |
| `vite.config.ts` | Build settings; the `.env` file is read from the repository root |

Its look is the manager's stylesheet, `admin/src/style.css`.

## Running it on your computer

With the same `.env` as the lexicon manager [its README, "Running it on your computer"]:

```
npm run users:dev
```

The site build, `npm run site:build`, puts it under `_site/utenti/`.
