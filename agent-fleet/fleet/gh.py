"""
Thin wrapper around the `gh` CLI. All GitHub I/O goes through here.
No PyGitHub dependency — keeps the tool portable and offline-first.
"""

import json
import re
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


@dataclass
class PR:
    number: int
    title: str
    body: str
    head_ref: str       # branch name
    labels: list[str]
    url: str
    linked_issue: int | None  # parsed from body "Closes #N"


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


def list_open_prs(repo: str, label: str) -> list[PR]:
    result = _run([
        "pr", "list",
        "--repo", repo,
        "--label", label,
        "--state", "open",
        "--json", "number,title,body,headRefName,labels,url",
        "--limit", "50",
    ])
    prs = json.loads(result.stdout)
    out = []
    for p in prs:
        labels = [la["name"] for la in p["labels"]]
        body = p["body"] or ""
        m = re.search(r"Closes #(\d+)", body)
        linked = int(m.group(1)) if m else None
        out.append(PR(
            number=p["number"],
            title=p["title"],
            body=body,
            head_ref=p["headRefName"],
            labels=labels,
            url=p["url"],
            linked_issue=linked,
        ))
    return out


def get_pr_review_comments(repo: str, pr_number: int) -> list[dict]:
    """Return all review comments on a PR (both inline and review-level)."""
    result = _run([
        "pr", "view", str(pr_number),
        "--repo", repo,
        "--json", "reviews,comments",
    ])
    data = json.loads(result.stdout)
    comments = []
    for r in data.get("reviews", []):
        if r.get("body"):
            comments.append({"author": r.get("author", {}).get("login", ""), "body": r["body"], "state": r.get("state", "")})
    for c in data.get("comments", []):
        if c.get("body"):
            comments.append({"author": c.get("author", {}).get("login", ""), "body": c["body"], "state": ""})
    return comments


def get_pr_ci_status(repo: str, pr_number: int) -> str:
    """Return 'success', 'failure', or 'pending'."""
    result = _run([
        "pr", "checks", str(pr_number),
        "--repo", repo,
        "--json", "name,state,conclusion",
    ], check=False)
    if result.returncode != 0 or not result.stdout.strip():
        return "pending"
    checks = json.loads(result.stdout)
    if not checks:
        return "pending"
    conclusions = {c.get("conclusion", c.get("state", "")) for c in checks}
    if "failure" in conclusions or "error" in conclusions:
        return "failure"
    if "pending" in conclusions or "in_progress" in conclusions or "" in conclusions:
        return "pending"
    return "success"


def get_issue_risk(repo: str, issue_number: int) -> str:
    """Return 'low', 'medium', or 'high' from the issue body."""
    result = _run([
        "issue", "view", str(issue_number),
        "--repo", repo,
        "--json", "body",
    ])
    body = json.loads(result.stdout).get("body", "")
    m = re.search(r"###\s*Risk level\s*\n(\w+)", body)
    return m.group(1).strip().lower() if m else "medium"


def merge_pr(repo: str, pr_number: int) -> None:
    _run(["pr", "merge", str(pr_number), "--repo", repo, "--squash", "--delete-branch"])


def add_pr_label(repo: str, pr_number: int, label: str) -> None:
    _run(["pr", "edit", str(pr_number), "--repo", repo, "--add-label", label])


def remove_pr_label(repo: str, pr_number: int, label: str) -> None:
    _run(["pr", "edit", str(pr_number), "--repo", repo, "--remove-label", label], check=False)


def post_pr_comment(repo: str, pr_number: int, body: str) -> None:
    _run(["pr", "comment", str(pr_number), "--repo", repo, "--body", body])


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
