# 0001: An input method, not a standalone editor

* **Status:** accepted
* **Date:** 2026/10/10
* **Decided by:** Iosef Tesla R. [Ignatz-CastroR]

## Context

The first idea was a Ligurian text editor that converts plain ASCII typing into grafîa ofiçiâ. But people write Ligurian in WhatsApp, Facebook, Word and Gmail, mostly on phones; they will not move their writing into a separate editor. The model the project imitates, the Windows Japanese keyboard, is not an editor either: it is an **input method** that works in every application.

## Decision

* The core product is the **conversion engine** [`engine/`]: it turns a typed ASCII word into its grafîa ofiçiâ spelling, and offers a menu when several spellings match.
* The engine reaches users through **input methods**: a Keyman keyboard for every operating system [`keyman/`, planned].
* The **web editor** [`editor/`, planned] is one thin client of the same engine: a demonstration, and a tool for long texts. It is not the main product.

## Consequences

* All conversion logic lives in one place and is written once.
* Desktop and phone keyboards depend on Keyman's capabilities; see [0007](0007-technology-stack.md).
