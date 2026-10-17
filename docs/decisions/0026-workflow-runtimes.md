# 0026: Workflow runners and runtimes

* **Status:** accepted
* **Date:** 2026/10/17
* **Decided by:** Eng. José Ignacio Castro de R.
* **Refines:** [0019](0019-editor-dictionary-snapshot.md) and [0021](0021-keyman-scope-and-toolchain.md), on the machines that build and publish the site and the packages

## Context

Both workflows, `pages.yml` and `release-assets.yml`, ran on `ubuntu-latest` with GitHub's actions at versions made for Node.js 20. Two changes by GitHub, checked on 2026/10/17, affect them:

1. **Node.js 20 is gone from the runners.** Since 2026/09/23 every JavaScript action runs on Node.js 24, whatever runtime it declares, and the way to ask for Node.js 20 no longer works. The old versions still run, but on a runtime they were not written for, and each run shows deprecation notices.
2. **`ubuntu-latest` moves from Ubuntu 24.04 to Ubuntu 26.04,** gradually, between 2026/10/19 and 2026/11/19. GitHub warns that builds depending on tools changed between the two images may break. Ubuntu 26.04 is generally available under its own label, `ubuntu-26.04`, since 2026/09/17.

## Decision

* **Every job runs on `ubuntu-26.04`, named explicitly.** The move happens now, in a commit of its own, instead of on a day GitHub chooses between 2026/10/19 and 2026/11/19; and the next change of `ubuntu-latest` cannot alter a build unannounced. The image provides everything the jobs use: `setup-node` installs Node.js, and the GitHub CLI used to attach the packages is part of it.
* **GitHub's actions at their current major versions, all on Node.js 24:** `checkout` v7, `setup-node` v7, `upload-artifact` v7, `download-artifact` v8, `upload-pages-artifact` v5, `deploy-pages` v5. Their breaking changes were read and none affects these workflows. They are referenced by major version, which GitHub's security guidance accepts for actions from a creator one already trusts, here GitHub itself, so that fixes within a major version arrive by themselves; pinning each one to a commit would freeze them until someone updates the pin by hand.
* **The project is built on Node.js 24,** the current long term support version, **and also checked on Node.js 22,** the oldest version it promises to run on [`package.json`, `engines`: 22.18 or newer]. In `pages.yml` a separate job runs every test on Node.js 22; nothing is published unless both pass.
* **The checkout keeps no credentials** in either workflow [`persist-credentials: false`]: no job pushes to the repository.

## Consequences

* The deprecation notices disappear from the runs.
* The first runs after this change are the test of Ubuntu 26.04. If one fails, nothing is published, the site keeps its last good version, and going back is a one-line change per job, to `ubuntu-24.04`.
* When GitHub retires a major version of an action, or announces the image after Ubuntu 26.04, this record is the place to update.

## Sources

* GitHub Changelog, "Ubuntu 26 generally available and latest migration", 2026/09/17: <https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration/>
* On Node.js 20: GitHub's runner changelog as summarized in "GitHub Actions Removed Node 20", DEV Community, read on 2026/10/17: <https://dev.to/devopsdaily/github-actions-removed-node-20-find-every-node20-action-you-still-run-1eai>. The runs of this repository until 0.6.0 agree: actions declaring Node.js 20 kept working.
* The `action.yml` of each action at its latest release, read on 2026/10/17: all declare `node24`, `upload-pages-artifact` through `upload-artifact` v7.
* The Ubuntu 26.04 image's list of software, `images/ubuntu/Ubuntu2604-Readme.md` in `actions/runner-images`, image 20261012: GitHub CLI 2.102.0, Node.js 24.21.0.
