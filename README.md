# MoneyTrees Repo Communication Guide

This repository is the shared communication and handoff space for the MoneyTrees teams.

Its purpose is to keep team communication, Codex handoff work, and memo discovery organized, traceable, and easy to access without depending on GitHub search.

---

## What this repo is for

This repo has two main jobs:

1. **Team communication**
2. **Codex handoff work**

---

# 1) Team communication

All teams communicate with each other through this repo.

Team memos go in:

```text
team-memos/
```

That folder contains sub-folders for each team:

```text
team-memos/
├── atlas/
├── overview/
├── director/
├── bills/
├── reporting/
└── debt/
```

## Team memo workflow

When one team needs to send a memo to another team:

1. The sending team writes the memo file
2. The memo is placed in the **recipient team’s folder**
3. The memo follows the required naming format
4. GitHub Actions automatically updates the recipient team’s `index.md`
5. The recipient team opens its own `index.md` to see the latest memo and then opens the referenced file

### Example

If Atlas sends a memo to Overview, the memo should be placed in:

```text
team-memos/overview/
```

The file should be named something like:

```text
FROM_atlas_TO_overview_2026-04-12_topic-name.txt
```

This means each team folder acts like that team’s **inbox**.

---

## Memo naming format

Use:

```text
FROM_[sender]_TO_[recipient]_YYYY-MM-DD_[short-topic].txt
```

Examples:

```text
FROM_director_TO_atlas_2026-04-09_operating-rules.txt
FROM_reporting_TO_director_2026-04-09_status-update.txt
FROM_bills_TO_overview_2026-04-09_dependency-note.txt
FROM_debt_TO_reporting_2026-04-09_balance-review.txt
```

If a file is revised on the same day and same topic, append a revision tag:

```text
FROM_atlas_TO_director_2026-04-09_operating-rules-rev-b.txt
```

Rules:
- use lowercase team names
- use `YYYY-MM-DD` format
- keep topic labels short and specific
- do not use vague names like `notes.txt` or `update.txt`

---

## Team index file requirement

Each team folder under `team-memos/` must maintain its own local `index.md` file.

Required index files:

```text
team-memos/atlas/index.md
team-memos/overview/index.md
team-memos/bills/index.md
team-memos/reporting/index.md
team-memos/director/index.md
team-memos/debt/index.md
```

Each team’s `index.md` acts as that team’s local memo lookup file.

Its purpose is to let that team quickly open its own folder, see the latest memo(s) sent to it, and jump directly to the correct file without relying on GitHub search.

---

## Team index update rules

The receiving team’s `index.md` is updated automatically by GitHub Actions whenever a new memo is added to that team’s folder.

Rules:
- if a memo is sent to one team, update that team’s `index.md`
- if a memo is sent to multiple teams, each receiving team’s `index.md` must be updated
- if a memo is sent to **all teams**, update the `index.md` files for:
  - `atlas`
  - `overview`
  - `bills`
  - `reporting`
  - `debt`

If the director also wants to track that same memo inside `team-memos/director/`, then `team-memos/director/index.md` may also be updated.

Minimum requirement:
- every receiving team must have that memo reflected in its own local index

This rule exists so each team can rely on its own folder and its own index to find the latest memo sent to it.

---

## What each team index should contain

At minimum, each team index should clearly show the latest memo by including:
- file path
- date
- topic

Recommended example:

```md
# Bills Memos Index

## Latest Memo
- File: team-memos/bills/FROM_director_TO_bills_2026-04-09_cleanup-directive.txt
- Date: 2026-04-09
- Topic: Cleanup Directive
```

Recommended practice:
- keep the newest memo at the top
- optionally include a short history section below it
- treat the index as part of the communication workflow, not an optional extra

---

# 2) Codex handoff work

This repo is also used to pass instructions, briefs, specs, and related working files to Codex.

Those files go in:

```text
codex-instructions/
```

Structure:

```text
codex-instructions/
├── input/
│   ├── index.md
│   ├── atlas/
│   ├── reporting/
│   ├── overview/
│   ├── bills/
│   └── debt/
└── output/
    ├── atlas/
    │   └── index.md
    ├── reporting/
    │   └── index.md
    ├── overview/
    │   └── index.md
    ├── bills/
    │   └── index.md
    └── debt/
        └── index.md
```

The director is **not** currently included in the `codex-instructions` folder structure unless that workflow changes later.

---

## Codex handoff workflow

When a team needs to send work to Codex:

1. The team writes the instruction file
2. The file is placed in the correct team folder under:

```text
codex-instructions/input/[team]/
```

3. The file follows the required naming format
4. GitHub Actions automatically updates:

```text
codex-instructions/input/index.md
```

5. Codex monitors that root input index to detect new incoming work and review prior requests

When Codex completes the work:

1. Codex writes the result file into:

```text
codex-instructions/output/[team]/
```

2. GitHub Actions automatically updates that team’s output index file
3. The team opens its output folder, checks the latest entry in its `index.md`, and opens the referenced result file

This keeps Codex intake and Codex output clearly separated:
- `input/` = requests going to Codex
- `output/` = results coming back from Codex

---

## Codex file naming format

For files sent to Codex:

```text
TO_CODEX_FROM_[team]_YYYY-MM-DD_[short-topic].txt
```

Examples:

```text
TO_CODEX_FROM_atlas_2026-04-09_advisor-operating-rules.txt
TO_CODEX_FROM_bills_2026-04-09_cleanup-brief.txt
TO_CODEX_FROM_debt_2026-04-09_ar-aging-review.txt
```

For files returned by Codex:

```text
FROM_CODEX_TO_[team]_YYYY-MM-DD_[short-topic].txt
```

Examples:

```text
FROM_CODEX_TO_overview_2026-04-09_revised-operating-rules.txt
FROM_CODEX_TO_reporting_2026-04-09_section-audit.txt
FROM_CODEX_TO_debt_2026-04-09_ar-aging-review.txt
```

Rules:
- use lowercase team names
- use `YYYY-MM-DD` format
- keep topic labels short and specific
- do not use vague file names

---

## Codex input index requirement

The root input folder must contain:

```text
codex-instructions/input/index.md
```

This file acts as Codex’s intake log.

Its purpose is to show:
- the latest instruction(s) sent to Codex
- the exact file path
- the date
- the topic
- optionally, the originating team

Whenever a new file is added under `codex-instructions/input/[team]/`, GitHub Actions should update the root input index automatically.

Recommended example:

```md
# Codex Input Index

## Latest Instruction
- File: codex-instructions/input/overview/TO_CODEX_FROM_overview_2026-04-12_policy-summary.txt
- Date: 2026-04-12
- Team: Overview
- Topic: Policy Summary
```

Recommended practice:
- keep newest entries at the top
- optionally include prior requests below
- treat the input index as Codex’s main lookup file for incoming work

---

## Codex output index requirement

Each team folder under `codex-instructions/output/` must maintain its own local `index.md`.

Required output index files:

```text
codex-instructions/output/atlas/index.md
codex-instructions/output/reporting/index.md
codex-instructions/output/overview/index.md
codex-instructions/output/bills/index.md
codex-instructions/output/debt/index.md
```

Each team’s output `index.md` acts as that team’s Codex results lookup file.

Its purpose is to let the team quickly open its folder, see the latest result returned by Codex, and jump directly to the correct file without relying on GitHub search.

Whenever a new Codex result file is added to a team’s output folder, GitHub Actions should update that team’s output index automatically.

Recommended example:

```md
# Overview Codex Output Index

## Latest Result
- File: codex-instructions/output/overview/FROM_CODEX_TO_overview_2026-04-12_policy-summary.txt
- Date: 2026-04-12
- Topic: Policy Summary
```

Recommended practice:
- keep the newest result at the top
- optionally include prior returned files below
- treat the output index as part of the delivery workflow, not an optional extra

---

## Repo rules

- keep naming consistent
- use clear dates in `YYYY-MM-DD` format
- keep topic labels short and specific
- do not use vague file names
- prefer creating new dated files over overwriting older ones
- treat the repo as the written source of truth for memos and Codex handoffs
- do not rely on GitHub search alone to find the latest memo or latest Codex file
- use recipient team folders as inboxes for team memos
- use `codex-instructions/input/index.md` as Codex’s intake log
- use each team’s `codex-instructions/output/[team]/index.md` as that team’s Codex results log

---

## Quick summary

- `team-memos/[team]/` = that team’s inbox for inbound team memos
- each team folder under `team-memos/` keeps its own `index.md`
- sender writes memos into the recipient team’s folder
- GitHub Actions updates the recipient team’s index automatically
- `codex-instructions/input/[team]/` = files going to Codex
- `codex-instructions/input/index.md` = Codex’s master intake log
- Codex monitors the root input index for new work
- `codex-instructions/output/[team]/` = files returned by Codex
- each output team folder keeps its own `index.md`
- GitHub Actions updates the team’s output index automatically
- teams use their output index to find the latest Codex result sent back to them
