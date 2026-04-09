# MoneyTrees Repo Communication Guide

This repository is the shared communication and handoff space for the MoneyTrees teams.

Its purpose is to keep team communication, Codex handoff work, and memo discovery organized, traceable, and easy to access without depending on GitHub search.

---

## What this repo is for

This repo has two main jobs:

1. **Team communication**
2. **Codex handoff work**

---

## 1) Team communication

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
└── reporting/
```

If a team needs to send a memo, update, directive, status note, or handoff to another team, the file should be placed in the correct folder under `team-memos`.

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
```

Each team’s `index.md` acts as that team’s memo lookup file.

Its purpose is to let that team quickly open its own folder, see the latest memo(s) sent to it, and jump directly to the correct file without relying on GitHub search.

---

## Team index update rules

Whenever a new memo is added, the receiving team’s `index.md` must also be updated.

Rules:
- if a memo is sent to one team, update that team’s `index.md`
- if a memo is sent to multiple teams, update each receiving team’s `index.md`
- if a memo is sent to **all teams**, update the `index.md` files for:
  - `atlas`
  - `overview`
  - `bills`
  - `reporting`

If the director also wants to track that same memo inside `team-memos/director/`, then `team-memos/director/index.md` may also be updated.

Minimum requirement:
- every receiving team must have that memo reflected in its own local index

This rule exists so each team can rely on its own folder and its own index to find the latest memo sent to it.

---

## What each index should contain

At minimum, each team index should clearly show the latest memo by including:
- file path
- date
- topic

Recommended example:

```md
# Bills Memos Index

## Latest Memo
- File: team-memos/director/FROM_director_TO_bills_2026-04-09_cleanup-directive.txt
- Date: 2026-04-09
- Topic: Cleanup Directive
```

Recommended practice:
- keep the newest memo at the top
- optionally include a short history section below it
- update the index at the same time the memo is added
- treat the index as part of the communication workflow, not an optional extra

---

## 2) Codex handoff work

This repo is also used to pass instructions, briefs, specs, and related working files to Codex.

Those files go in:

```text
codex-instructions/
```

Structure:

```text
codex-instructions/
├── input/
│   ├── atlas/
│   ├── reporting/
│   ├── overview/
│   └── bills/
└── output/
    ├── atlas/
    ├── reporting/
    ├── overview/
    └── bills/
```

### How it works

- teams place source files for Codex in:
  - `codex-instructions/input/[team]/`
- Codex reads from the input folder
- Codex writes result files to:
  - `codex-instructions/output/[team]/`

The director is **not** currently included in the `codex-instructions` folder structure unless that workflow changes later.

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
```

For files returned by Codex:

```text
FROM_CODEX_TO_[team]_YYYY-MM-DD_[short-topic].txt
```

Examples:

```text
FROM_CODEX_TO_overview_2026-04-09_revised-operating-rules.txt
FROM_CODEX_TO_reporting_2026-04-09_section-audit.txt
```

---

## Repo rules

- keep naming consistent
- use clear dates in `YYYY-MM-DD` format
- keep topic labels short and specific
- do not use vague file names
- prefer creating new dated files over overwriting older ones
- treat the repo as the written source of truth for memos and Codex handoffs
- keep each team’s `index.md` updated when new memos are received
- do not rely on GitHub search alone to find the latest memo

---

## Quick summary

- `team-memos/` = team-to-team communication
- each team folder under `team-memos/` keeps its own `index.md`
- each team uses its own `index.md` to find the latest memo sent to it
- when a memo is sent to a team, that team’s index must be updated
- when a memo is sent to multiple teams, each receiving team’s index must be updated
- when a memo is sent to all teams, all receiving team indexes must be updated
- `codex-instructions/input/[team]/` = files going to Codex
- `codex-instructions/output/[team]/` = files returned by Codex
