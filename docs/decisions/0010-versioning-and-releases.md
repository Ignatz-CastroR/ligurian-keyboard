# 0010: Versioning and releases

* **Status:** accepted
* **Date:** 2026/10/10
* **Decided by:** Iosef Tesla R. [Ignatz-CastroR]

## Decision

* Versions follow **Semantic Versioning**: `MAJOR.MINOR.PATCH`.
  * While MAJOR is 0, the project is in early development and anything may change.
  * **MINOR** rises for new features: `0.2.0` added the dictionary database.
  * **PATCH** rises for fixes: `0.2.1`.
* Every release is an **annotated git tag** [`v0.1.0`, `v0.2.0`] with a descriptive message, published as a GitHub release, marked as pre-release while MAJOR is 0.
* `CHANGELOG.md` records every change of every version; `README.md` summarizes the latest one.
* Important decisions are recorded in `docs/decisions/`.
