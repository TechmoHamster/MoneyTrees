from __future__ import annotations

import re
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
TEAM_MEMOS = ROOT / "team-memos"

TEAM_FOLDERS = {"atlas", "overview", "bills", "reporting", "director"}
ALL_TEAMS = {"atlas", "overview", "bills", "reporting"}

MEMO_RE = re.compile(
    r"^FROM_(?P<sender>[a-z]+)_TO_(?P<recipient>[a-z]+|all)_(?P<date>\d{4}-\d{2}-\d{2})_(?P<topic>.+)\.txt$"
)

def title_case_topic(slug: str) -> str:
    return slug.replace("-", " ").title()

def parse_memo(path: Path):
    m = MEMO_RE.match(path.name)
    if not m:
        return None
    data = m.groupdict()
    sender = data["sender"]
    recipient = data["recipient"]
    date = data["date"]
    topic = data["topic"]
    recipients = ALL_TEAMS if recipient == "all" else {recipient}
    return {
        "path": path,
        "sender": sender,
        "recipient": recipient,
        "recipients": recipients,
        "date": date,
        "topic": topic,
        "topic_title": title_case_topic(topic),
    }

def collect_memos():
    memos = []
    for folder in TEAM_MEMOS.iterdir():
        if not folder.is_dir():
            continue
        for file in folder.glob("*.txt"):
            parsed = parse_memo(file)
            if parsed:
                memos.append(parsed)
    memos.sort(key=lambda x: (x["date"], x["path"].name), reverse=True)
    return memos

def build_index(team: str, memos: list[dict]) -> str:
    relevant = [m for m in memos if team in m["recipients"] or m["sender"] == team]
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

    if len(inbound) > 1:
        lines += ["## Previous Inbound Memos"]
        for memo in inbound[1:6]:
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

def main():
    TEAM_MEMOS.mkdir(exist_ok=True)
    for team in TEAM_FOLDERS:
        (TEAM_MEMOS / team).mkdir(parents=True, exist_ok=True)

    memos = collect_memos()

    for team in TEAM_FOLDERS:
        index_path = TEAM_MEMOS / team / "index.md"
        content = build_index(team, memos)
        index_path.write_text(content, encoding="utf-8")

if __name__ == "__main__":
    main()
