# MoneyTrees Repo Communication Guide

This repository is being used as a shared communication and handoff space for the MoneyTrees teams.

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

### Memo naming format

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

### Team index file requirement

Each team folder under `team-memos/` must maintain an index file in Markdown format.

Required team index files:

```text
team-memos/atlas/index.md
team-memos/overview/index.md
team-memos/bills/index.md
team-memos/reporting/index.md
team-memos/director/index.md
```

Purpose of the index file:
- make the latest memo easy to find
- reduce reliance on GitHub search/indexing
- give each team a simple running reference point
- make memo discovery deterministic for both humans and tools

### Team index update rules

Whenever a new memo is added, the index file for the relevant receiving team must also be updated.

Rule:
- if a memo is sent to one team, update that team’s index file
- if a memo is sent to multiple teams, update each affected team’s index file
- if a memo is sent to **all teams**, update the index files for:
  - `atlas`
  - `overview`
  - `bills`
  - `reporting`

If the director team also wants to track that memo in its own folder, `team-memos/director/index.md` may also be updated, but the minimum requirement is that each receiving team’s index reflects the memo.

### What the index should contain

At minimum, each team index should clearly identify the latest memo by including:
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
- keep the latest memo at the top
- optionally include a short history section below it
- update the index file at the same time the memo is added

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

- Teams place source files for Codex in:
  - `codex-instructions/input/[team]/`
- Codex reads from the input folder
- Codex writes result files to:
  - `codex-instructions/output/[team]/`

The director is **not** currently included in the `codex-instructions` folder structure unless that workflow changes later.

### Codex file naming format

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

- Keep naming consistent
- Use clear dates in `YYYY-MM-DD` format
- Keep topic labels short and specific
- Do not use vague file names like `notes.txt` or `update.txt`
- Prefer creating new dated files over overwriting older ones
- Treat the repo as the written source of truth for memos and Codex handoffs
- Keep team index files updated whenever new memos are added
- Do not rely on GitHub search alone for finding the latest memo

---

## Quick summary

- `team-memos/` = team-to-team communication
- each team folder under `team-memos/` must maintain an `index.md`
- update the receiving team index whenever a memo is added
- if a memo goes to multiple teams, update each affected team index
- if a memo goes to all teams, update all affected team indexes
- `codex-instructions/input/[team]/` = files going to Codex
- `codex-instructions/output/[team]/` = files returned by Codex
