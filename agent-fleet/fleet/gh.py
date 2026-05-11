"""
Thin wrapper around the `gh` CLI. All GitHub I/O goes through here.
No PyGitHub dependency — keeps the tool portable and offline-first.
"""

import json
import subprocess
import sys
from dataclasses import dataclass


@dataclass
class Issue:
    number: int
    title: str
    body: str
    labels: list[str]
    url: str


def _run(args: list[str], check: bool = True) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(
            ["gh"] + args,
            capture_output=True,
            text=True,
            check=check,
        )
    except FileNotFoundError:
        print("ERROR: `gh` CLI not found. Install it: brew install gh && gh auth login", file=sys.stderr)
        raise


def list_open_issues(repo: str, label: str, exclude_label: str | None = None) -> list[Issue]:
    result = _run([
        "issue", "list",
        "--repo", repo,
        "--label", label,
        "--state", "open",
        "--json", "number,title,body,labels,url",
        "--limit", "50",
    ])
    issues = json.loads(result.stdout)
    out = []
    for i in issues:
        labels = [la["name"] for la in i["labels"]]
        if exclude_label and exclude_label in labels:
            continue
        out.append(Issue(
            number=i["number"],
            title=i["title"],
            body=i["body"] or "",
            labels=labels,
            url=i["url"],
        ))
    return out


def add_label(repo: str, issue_number: int, label: str) -> None:
    _run(["issue", "edit", str(issue_number), "--repo", repo, "--add-label", label])


def remove_label(repo: str, issue_number: int, label: str) -> None:
    _run(["issue", "edit", str(issue_number), "--repo", repo, "--remove-label", label], check=False)


def post_comment(repo: str, issue_number: int, body: str) -> None:
    _run(["issue", "comment", str(issue_number), "--repo", repo, "--body", body])


def create_pr(repo: str, branch: str, title: str, body: str, draft: bool = False) -> str:
    args = [
        "pr", "create",
        "--repo", repo,
        "--head", branch,
        "--title", title,
        "--body", body,
    ]
    if draft:
        args.append("--draft")
    result = _run(args)
    return result.stdout.strip()


def create_issue(repo: str, title: str, body: str, labels: list[str]) -> int:
    label_args = []
    for label in labels:
        label_args += ["--label", label]
    result = _run([
        "issue", "create",
        "--repo", repo,
        "--title", title,
        "--body", body,
    ] + label_args)
    # gh outputs the issue URL; extract number from it
    url = result.stdout.strip()
    return int(url.rstrip("/").split("/")[-1])


def ensure_labels(repo: str) -> None:
    """Create the required fleet labels if they don't exist."""
    labels = [
        ("agent:code", "0075ca", "Issue ready for code quality agent"),
        ("agent:in-progress", "e4a11b", "Agent currently working on this issue"),
        ("agent:done", "0e8a16", "Agent completed — PR created"),
        ("needs-review", "d93f0b", "Human review required before merge"),
        ("auto-merge", "6f42c1", "Auto-merge when CI passes"),
    ]
    for name, color, description in labels:
        _run(
            ["label", "create", name, "--repo", repo, "--color", color, "--description", description, "--force"],
            check=False,
        )
