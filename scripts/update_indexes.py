from __future__ import annotations

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

TEAM_MEMOS = ROOT / "team-memos"
CODEX_INPUT = ROOT / "codex-instructions" / "input"
CODEX_OUTPUT = ROOT / "codex-instructions" / "output"

TEAM_MEMO_RE = re.compile(
    r"^FROM_(?P<sender>[a-z0-9_-]+)_TO_(?P<recipient>[a-z0-9_-]+|all)_(?P<date>\d{4}-\d{2}-\d{2})_(?P<topic>.+)\.txt$"
)

CODEX_INPUT_RE = re.compile(
    r"^TO_CODEX_FROM_(?P<team>[a-z0-9_-]+)_(?P<date>\d{4}-\d{2}-\d{2})_(?P<topic>.+)\.txt$"
    r"^TO_CODEX_FROM_(?P<team>[a-z0-9_-]+)_(?P<date>\d{4}-\d{2}-\d{2})_(?P<topic>.+)\.md$"
)

CODEX_OUTPUT_RE = re.compile(
    r"^FROM_CODEX_TO_(?P<team>[a-z0-9_-]+)_(?P<date>\d{4}-\d{2}-\d{2})_(?P<topic>.+)\.txt$"
)

IGNORED_TEAM_MEMO_FOLDERS = {".gitkeep", ".ds_store"}
IGNORED_CODEX_FOLDERS = {".gitkeep", ".ds_store"}

EXCLUDED_ALL_RECIPIENTS = {"director"}
EXCLUDED_CODEX_TEAMS = {"director"}


def title_case_topic(slug: str) -> str:
    return slug.replace("-", " ").replace("_", " ").title()


def display_name(name: str) -> str:
    return name.replace("-", " ").replace("_", " ").title()


def get_git_commit_timestamp(path: Path) -> int:
    """
    Returns the Unix timestamp of the latest Git commit that touched this file.

    Falls back to local file modified time if the file has not been committed yet
    or if Git cannot resolve the path.
    """
    try:
        relative_path = path.relative_to(ROOT).as_posix()

        result = subprocess.run(
            ["git", "log", "-1", "--format=%ct", "--", relative_path],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )

        output = result.stdout.strip()

        if output:
            return int(output)

    except Exception:
        pass

    try:
        return int(path.stat().st_mtime)
    except FileNotFoundError:
        return 0


def sort_records(records: list[dict]) -> list[dict]:
    for record in records:
        record["published_ts"] = get_git_commit_timestamp(record["path"])

    return sorted(
        records,
        key=lambda x: (x["published_ts"], x["date"], x["path"].name),
        reverse=True,
    )


def list_subfolders(parent: Path, ignored: set[str]) -> list[str]:
    if not parent.exists():
        return []

    return sorted(
        [
            child.name
            for child in parent.iterdir()
            if child.is_dir() and child.name.lower() not in ignored
        ]
    )


def discover_team_memo_folders() -> list[str]:
    return list_subfolders(TEAM_MEMOS, IGNORED_TEAM_MEMO_FOLDERS)


def discover_codex_teams() -> list[str]:
    teams = set()

    for folder in list_subfolders(CODEX_INPUT, IGNORED_CODEX_FOLDERS):
        if folder not in EXCLUDED_CODEX_TEAMS:
            teams.add(folder)

    for folder in list_subfolders(CODEX_OUTPUT, IGNORED_CODEX_FOLDERS):
        if folder not in EXCLUDED_CODEX_TEAMS:
            teams.add(folder)

    return sorted(teams)


def parse_team_memo(path: Path, all_recipients: set[str]) -> dict | None:
    match = TEAM_MEMO_RE.match(path.name)
    if not match:
        return None

    data = match.groupdict()
    recipient = data["recipient"]

    if recipient == "all":
        recipients = {
            team for team in all_recipients
            if team not in EXCLUDED_ALL_RECIPIENTS
        }
    else:
        recipients = {recipient}

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


def collect_team_memos(team_folders: list[str]) -> list[dict]:
    memos: list[dict] = []
    discovered_teams = set(team_folders)

    for team in team_folders:
        folder = TEAM_MEMOS / team
        if not folder.exists():
            continue

        for file in folder.glob("*.txt"):
            parsed = parse_team_memo(file, discovered_teams)
            if parsed:
                memos.append(parsed)

    return sort_records(memos)


def collect_codex_inputs(codex_teams: list[str]) -> list[dict]:
    records: list[dict] = []

    for team in codex_teams:
        folder = CODEX_INPUT / team
        if not folder.exists():
            continue

        for file in folder.glob("*.txt"):
            parsed = parse_codex_input(file)
            if parsed:
                records.append(parsed)

    return sort_records(records)


def collect_codex_outputs(codex_teams: list[str]) -> list[dict]:
    records: list[dict] = []

    for team in codex_teams:
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
    team_display = display_name(team)

    lines = [f"# {team_display} Memos Index", ""]

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
        f"- This file is {team_display}'s local memo lookup file.",
        f"- Update it whenever a new memo is sent to {team_display}.",
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
            f"- Team: {display_name(latest['team'])}",
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
                f"  - Team: {display_name(record['team'])}",
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
    team_display = display_name(team)

    lines = [f"# {team_display} Codex Output Index", ""]

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
        f"- This file is {team_display}'s Codex results lookup file.",
        f"- Update it whenever a new Codex result is added under codex-instructions/output/{team}/.",
        "- Keep the newest result at the top.",
        "",
    ]

    return "\n".join(lines)


def ensure_directories() -> None:
    TEAM_MEMOS.mkdir(exist_ok=True)
    CODEX_INPUT.mkdir(parents=True, exist_ok=True)
    CODEX_OUTPUT.mkdir(parents=True, exist_ok=True)

    for team in discover_team_memo_folders():
        (TEAM_MEMOS / team).mkdir(parents=True, exist_ok=True)

    for team in discover_codex_teams():
        (CODEX_INPUT / team).mkdir(parents=True, exist_ok=True)
        (CODEX_OUTPUT / team).mkdir(parents=True, exist_ok=True)


def main() -> None:
    ensure_directories()

    team_folders = discover_team_memo_folders()
    codex_teams = discover_codex_teams()

    memos = collect_team_memos(team_folders)

    for team in team_folders:
        index_path = TEAM_MEMOS / team / "index.md"
        index_path.write_text(build_team_index(team, memos), encoding="utf-8")

    codex_inputs = collect_codex_inputs(codex_teams)

    (CODEX_INPUT / "index.md").write_text(
        build_codex_input_index(codex_inputs),
        encoding="utf-8",
    )

    codex_outputs = collect_codex_outputs(codex_teams)

    for team in codex_teams:
        team_records = [
            record for record in codex_outputs
            if record["team"] == team
        ]

        index_path = CODEX_OUTPUT / team / "index.md"
        index_path.write_text(
            build_codex_output_index(team, team_records),
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
