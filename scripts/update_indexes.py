from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

TEAM_MEMOS = ROOT / "team-memos"
CODEX_INPUT = ROOT / "codex-instructions" / "input"
CODEX_OUTPUT = ROOT / "codex-instructions" / "output"

TEAM_FOLDERS = ("atlas", "overview", "bills", "reporting", "director", "debt")
RECEIVING_TEAMS = ("atlas", "overview", "bills", "reporting", "debt")
CODEX_TEAMS = ("atlas", "overview", "bills", "reporting", "debt")

TEAM_MEMO_RE = re.compile(
    r"^FROM_(?P<sender>[a-z]+)_TO_(?P<recipient>[a-z]+|all)_(?P<date>\d{4}-\d{2}-\d{2})_(?P<topic>.+)\.txt$"
)

CODEX_INPUT_RE = re.compile(
    r"^TO_CODEX_FROM_(?P<team>[a-z]+)_(?P<date>\d{4}-\d{2}-\d{2})_(?P<topic>.+)\.txt$"
)

CODEX_OUTPUT_RE = re.compile(
    r"^FROM_CODEX_TO_(?P<team>[a-z]+)_(?P<date>\d{4}-\d{2}-\d{2})_(?P<topic>.+)\.txt$"
)


def title_case_topic(slug: str) -> str:
    return slug.replace("-", " ").replace("_", " ").title()


def sort_records(records: list[dict]) -> list[dict]:
    return sorted(records, key=lambda x: (x["date"], x["path"].name), reverse=True)


def parse_team_memo(path: Path) -> dict | None:
    match = TEAM_MEMO_RE.match(path.name)
    if not match:
        return None

    data = match.groupdict()
    recipient = data["recipient"]
    recipients = set(RECEIVING_TEAMS) if recipient == "all" else {recipient}

    return {
        "path": path,
        "sender": data["sender"],
        "recipient": recipient,
        "recipients": recipients,
        "date": data["date"],
        "topic": data["topic"],
        "topic_title": title_case_topic(data["topic"]),
    }


def parse_codex_input(path: Path) -> dict | None:
    match = CODEX_INPUT_RE.match(path.name)
    if not match:
        return None

    data = match.groupdict()
    return {
        "path": path,
        "team": data["team"],
        "date": data["date"],
        "topic": data["topic"],
        "topic_title": title_case_topic(data["topic"]),
    }


def parse_codex_output(path: Path) -> dict | None:
    match = CODEX_OUTPUT_RE.match(path.name)
    if not match:
        return None

    data = match.groupdict()
    return {
        "path": path,
        "team": data["team"],
        "date": data["date"],
        "topic": data["topic"],
        "topic_title": title_case_topic(data["topic"]),
    }


def collect_team_memos() -> list[dict]:
    memos: list[dict] = []

    for team in TEAM_FOLDERS:
        folder = TEAM_MEMOS / team
        if not folder.exists():
            continue

        for file in folder.glob("*.txt"):
            parsed = parse_team_memo(file)
            if parsed:
                memos.append(parsed)

    return sort_records(memos)


def collect_codex_inputs() -> list[dict]:
    records: list[dict] = []

    for team in CODEX_TEAMS:
        folder = CODEX_INPUT / team
        if not folder.exists():
            continue

        for file in folder.glob("*.txt"):
            parsed = parse_codex_input(file)
            if parsed:
                records.append(parsed)

    return sort_records(records)


def collect_codex_outputs() -> list[dict]:
    records: list[dict] = []

    for team in CODEX_TEAMS:
        folder = CODEX_OUTPUT / team
        if not folder.exists():
            continue

        for file in folder.glob("*.txt"):
            parsed = parse_codex_output(file)
            if parsed:
                records.append(parsed)

    return sort_records(records)


def build_team_index(team: str, memos: list[dict]) -> str:
    inbound = [m for m in memos if team in m["recipients"]]
    latest = inbound[0] if inbound else None

    lines = [f"# {team.capitalize()} Memos Index", ""]

    if latest:
        lines += [
            "## Latest Memo",
            f"- File: {latest['path'].relative_to(ROOT).as_posix()}",
            f"- Date: {latest['date']}",
            f"- Topic: {latest['topic_title']}",
            "",
            "---",
            "",
        ]
    else:
        lines += [
            "## Latest Memo",
            "- No memos found.",
            "",
            "---",
            "",
        ]

    if len(inbound) > 1:
        lines += ["## Previous Inbound Memos"]
        for memo in inbound[1:11]:
            lines += [
                f"- File: {memo['path'].relative_to(ROOT).as_posix()}",
                f"  - Date: {memo['date']}",
                f"  - Topic: {memo['topic_title']}",
            ]
        lines += ["", "---", ""]

    lines += [
        "## Notes",
        f"- This file is {team.capitalize()} team's local memo lookup file.",
        f"- Update it whenever a new memo is sent to {team.capitalize()}.",
        "- Keep the newest memo at the top.",
        "",
    ]

    return "\n".join(lines)


def build_codex_input_index(records: list[dict]) -> str:
    latest = records[0] if records else None

    lines = ["# Codex Input Index", ""]

    if latest:
        lines += [
            "## Latest Instruction",
            f"- File: {latest['path'].relative_to(ROOT).as_posix()}",
            f"- Date: {latest['date']}",
            f"- Team: {latest['team'].capitalize()}",
            f"- Topic: {latest['topic_title']}",
            "",
            "---",
            "",
        ]
    else:
        lines += [
            "## Latest Instruction",
            "- No instructions found.",
            "",
            "---",
            "",
        ]

    if len(records) > 1:
        lines += ["## Previous Instructions"]
        for record in records[1:16]:
            lines += [
                f"- File: {record['path'].relative_to(ROOT).as_posix()}",
                f"  - Date: {record['date']}",
                f"  - Team: {record['team'].capitalize()}",
                f"  - Topic: {record['topic_title']}",
            ]
        lines += ["", "---", ""]

    lines += [
        "## Notes",
        "- This file is Codex's intake log.",
        "- Update it whenever a new instruction file is added under codex-instructions/input/[team]/.",
        "- Keep the newest instruction at the top.",
        "",
    ]

    return "\n".join(lines)


def build_codex_output_index(team: str, records: list[dict]) -> str:
    latest = records[0] if records else None

    lines = [f"# {team.capitalize()} Codex Output Index", ""]

    if latest:
        lines += [
            "## Latest Result",
            f"- File: {latest['path'].relative_to(ROOT).as_posix()}",
            f"- Date: {latest['date']}",
            f"- Topic: {latest['topic_title']}",
            "",
            "---",
            "",
        ]
    else:
        lines += [
            "## Latest Result",
            "- No Codex results found.",
            "",
            "---",
            "",
        ]

    if len(records) > 1:
        lines += ["## Previous Results"]
        for record in records[1:16]:
            lines += [
                f"- File: {record['path'].relative_to(ROOT).as_posix()}",
                f"  - Date: {record['date']}",
                f"  - Topic: {record['topic_title']}",
            ]
        lines += ["", "---", ""]

    lines += [
        "## Notes",
        f"- This file is {team.capitalize()}'s Codex results lookup file.",
        f"- Update it whenever a new Codex result is added under codex-instructions/output/{team}/.",
        "- Keep the newest result at the top.",
        "",
    ]

    return "\n".join(lines)


def ensure_directories() -> None:
    TEAM_MEMOS.mkdir(exist_ok=True)
    for team in TEAM_FOLDERS:
        (TEAM_MEMOS / team).mkdir(parents=True, exist_ok=True)

    CODEX_INPUT.mkdir(parents=True, exist_ok=True)
    CODEX_OUTPUT.mkdir(parents=True, exist_ok=True)

    for team in CODEX_TEAMS:
        (CODEX_INPUT / team).mkdir(parents=True, exist_ok=True)
        (CODEX_OUTPUT / team).mkdir(parents=True, exist_ok=True)


def main() -> None:
    ensure_directories()

    # Team memo indexes
    memos = collect_team_memos()
    for team in TEAM_FOLDERS:
        index_path = TEAM_MEMOS / team / "index.md"
        index_path.write_text(build_team_index(team, memos), encoding="utf-8")

    # Codex input index
    codex_inputs = collect_codex_inputs()
    (CODEX_INPUT / "index.md").write_text(
        build_codex_input_index(codex_inputs),
        encoding="utf-8",
    )

    # Codex output indexes
    codex_outputs = collect_codex_outputs()
    for team in CODEX_TEAMS:
        team_records = [record for record in codex_outputs if record["team"] == team]
        index_path = CODEX_OUTPUT / team / "index.md"
        index_path.write_text(build_codex_output_index(team, team_records), encoding="utf-8")


if __name__ == "__main__":
    main()