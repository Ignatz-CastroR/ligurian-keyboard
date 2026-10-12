# 0003: Open data and licenses

* **Status:** accepted
* **Date:** 2026/10/10
* **Decided by:** Iosef Tesla R. [Ignatz-CastroR]

## Context

The first idea was to keep the dictionaries accessible only to privileged users. But a keyboard that converts words offline must carry the word list on every user's device, where anyone can extract it. Keeping it secret would require a server lookup for every word typed: slower, dependent on internet access, and costly. Above all, a closed lexicon works against the goal of the project, which is to help revitalize Ligurian.

## Decision

* The **published** lexicon is public: anyone may read it, anonymous visitors included.
* Privileges control only **who may edit**: see [0011](0011-roles-and-review-workflow.md).
* **Code: MIT license** [`LICENSE`].
* **Lexicon data: CC BY-SA 4.0** [`data/LICENSE.md`], the license used by Ligurian Wikipedia.

## Consequences

* Associations, researchers and other projects may reuse and improve the lexicon, provided they credit it and share alike.
* Pending, rejected and deleted entries stay private to contributors and staff.
