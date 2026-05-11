"""
Dispatcher: polls GitHub Issues and dispatches a worker for each claimed issue.
Coordination via GitHub labels — no custom lock database needed.

Label flow:
  agent:code  →  (dispatcher claims)  →  agent:in-progress
  agent:in-progress  →  (worker done)  →  agent:done + needs-review (PR created)
  agent:in-progress  →  (worker failed)  →  agent:code (released back)
"""

import shutil
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


def _git_root(repo_path: Path) -> Path:
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=str(repo_path), capture_output=True, text=True, check=True,
    )
    return Path(result.stdout.strip())


def _create_worktree(repo_path: Path, issue_number: int, branch: str) -> tuple[Path, Path]:
    """Returns (worktree_root, project_cwd) where project_cwd is the target subdir inside the worktree."""
    wt = _worktree_path(repo_path, issue_number)
    wt.parent.mkdir(exist_ok=True)
    git_root = _git_root(repo_path)
    subdir = repo_path.relative_to(git_root)  # e.g. "invoice-manager"
    # Clean up stale state from previous failed runs.
    # Order matters: rm dir first so git prune clears the registration,
    # then delete the branch (fails if checked out in a live worktree).
    if wt.exists():
        shutil.rmtree(wt, ignore_errors=True)
    _git(["worktree", "prune"], cwd=git_root, check=False)
    _git(["branch", "-D", branch], cwd=git_root, check=False)
    _git(["worktree", "add", str(wt), "-b", branch], cwd=git_root)
    project_cwd = wt / subdir
    return wt, project_cwd


def _remove_worktree(repo_path: Path, issue_number: int) -> None:
    wt = _worktree_path(repo_path, issue_number)
    git_root = _git_root(repo_path)
    shutil.rmtree(wt, ignore_errors=True)
    _git(["worktree", "prune"], cwd=git_root, check=False)


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
        worktree, project_cwd = _create_worktree(repo_path, number, branch)
        success, log = worker.run(worktree, project_cwd, issue)

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
            gh.remove_label(repo, number, "agent:code")
            gh.post_comment(repo, number, f"✅ PR created: {pr_url}")
            print(f"  ✅ PR created: {pr_url}", flush=True)
        else:
            gh.post_comment(repo, number, f"❌ Agent failed.\n\n```\n{log[-3000:]}\n```")
            gh.remove_label(repo, number, "agent:in-progress")
            print(f"  ❌ Worker failed for issue #{number}", flush=True)

    except Exception as e:
        gh.post_comment(repo, number, f"❌ Dispatcher error: {e}")
        gh.remove_label(repo, number, "agent:in-progress")
        print(f"  ❌ Dispatcher error for issue #{number}: {e}", flush=True)
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
