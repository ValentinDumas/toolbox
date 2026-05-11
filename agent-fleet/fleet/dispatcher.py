"""
Dispatcher: polls GitHub Issues and dispatches a worker for each claimed issue.
Coordination via GitHub labels — no custom lock database needed.

Label flow:
  agent:code  →  (dispatcher claims)  →  agent:in-progress
  agent:in-progress  →  (worker done)  →  agent:done + needs-review (PR created)
  agent:in-progress  →  (worker failed)  →  agent:code (released back)
"""

import subprocess
import time
from pathlib import Path

from . import gh, worker


def _git(args: list[str], cwd: Path, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git"] + args,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        check=check,
    )


def _worktree_path(repo_path: Path, issue_number: int) -> Path:
    return repo_path / ".worktrees" / f"issue-{issue_number}"


def _create_worktree(repo_path: Path, issue_number: int, branch: str) -> Path:
    wt = _worktree_path(repo_path, issue_number)
    wt.parent.mkdir(exist_ok=True)
    _git(["worktree", "add", str(wt), "-b", branch], cwd=repo_path)
    return wt


def _remove_worktree(repo_path: Path, issue_number: int) -> None:
    wt = _worktree_path(repo_path, issue_number)
    _git(["worktree", "remove", str(wt), "--force"], cwd=repo_path, check=False)


def _commit_and_push(worktree: Path, branch: str, message: str) -> bool:
    _git(["add", "-A"], cwd=worktree)
    result = _git(["diff", "--cached", "--quiet"], cwd=worktree, check=False)
    if result.returncode == 0:
        return False  # nothing to commit
    _git(["commit", "-m", message], cwd=worktree)
    _git(["push", "origin", branch], cwd=worktree)
    return True


def process_issue(issue: gh.Issue, repo: str, repo_path: Path) -> None:
    number = issue.number
    branch = f"fix/issue-{number}"
    print(f"\n[issue #{number}] {issue.title}", flush=True)

    # Claim the issue
    gh.add_label(repo, number, "agent:in-progress")
    gh.post_comment(repo, number, f"🤖 Agent picking up this issue. Branch: `{branch}`")

    worktree = None
    try:
        worktree = _create_worktree(repo_path, number, branch)
        success, log = worker.run(worktree, issue, repo_path)

        if success:
            committed = _commit_and_push(
                worktree, branch,
                f"fix: resolve issue #{number} — {issue.title}\n\nCloses #{number}"
            )
            if not committed:
                gh.post_comment(repo, number, "⚠️ Agent ran but made no file changes. Manual review needed.")
                gh.remove_label(repo, number, "agent:in-progress")
                return

            pr_body = (
                f"## Summary\nAutonomous agent fix for issue #{number}.\n\n"
                f"## Issue\nCloses #{number}\n\n"
                f"## Test plan\n- [x] `python -m pytest tests/ -v` passes\n"
            )
            pr_url = gh.create_pr(repo, branch, f"fix: {issue.title}", pr_body)
            gh.add_label(repo, number, "needs-review")
            gh.add_label(repo, number, "agent:done")
            gh.remove_label(repo, number, "agent:in-progress")
            gh.post_comment(repo, number, f"✅ PR created: {pr_url}")
            print(f"  ✅ PR created: {pr_url}", flush=True)
        else:
            gh.post_comment(repo, number, f"❌ Agent failed.\n\n```\n{log[-3000:]}\n```")
            gh.remove_label(repo, number, "agent:in-progress")
            print(f"  ❌ Worker failed for issue #{number}", flush=True)

    except Exception as e:
        gh.post_comment(repo, number, f"❌ Dispatcher error: {e}")
        gh.remove_label(repo, number, "agent:in-progress")
        raise
    finally:
        if worktree:
            _remove_worktree(repo_path, number)


def run_once(repo: str, repo_path: Path) -> int:
    """Process all currently claimable issues. Returns number of issues processed."""
    issues = gh.list_open_issues(repo, label="agent:code", exclude_label="agent:in-progress")
    if not issues:
        print("No claimable issues found.", flush=True)
        return 0
    for issue in issues:
        process_issue(issue, repo, repo_path)
    return len(issues)


def run_loop(repo: str, repo_path: Path, poll_interval: int) -> None:
    """Continuous polling loop."""
    print(f"Dispatcher started. Polling every {poll_interval}s. Ctrl+C to stop.", flush=True)
    while True:
        try:
            run_once(repo, repo_path)
        except KeyboardInterrupt:
            print("\nDispatcher stopped.", flush=True)
            break
        except Exception as e:
            print(f"[error] {e}", flush=True)
        time.sleep(poll_interval)
