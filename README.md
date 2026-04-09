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

---

## Quick summary

- `team-memos/` = team-to-team communication
- `codex-instructions/input/[team]/` = files going to Codex
- `codex-instructions/output/[team]/` = files returned by Codex
