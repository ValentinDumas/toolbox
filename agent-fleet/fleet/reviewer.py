"""
Reviewer: processes open PRs labeled needs-review.

For each PR:
1. Read review comments left by humans.
2. If comments exist → run claude in the branch worktree to address them → push.
3. Check CI status + risk level.
4. Auto-merge if: CI green + risk=low + no blocking comment keywords.
   Otherwise leave for human.

Blocking keywords that suppress auto-merge: fix, wrong, incorrect, broken,
revert, don't, shouldn't, rewrite, remove, bad.
"""

import subprocess
import time
from pathlib import Path

from . import gh, worker

_BLOCKING_KEYWORDS = {
    "fix", "wrong", "incorrect", "broken", "revert",
    "don't", "shouldn't", "rewrite", "remove", "bad",
}

REVIEW_PROMPT_TEMPLATE = """\
You are fixing code review feedback on a pull request.

## PR: {title}

## Review comments left by humans
{comments}

## Instructions
- Address every comment above.
- Read the relevant files first, then make the minimal change that satisfies each comment.
- Do not commit or push. Only edit files.
- Run the test suite: python -m pytest tests/ -v
- All existing tests must pass.
"""


def _has_blocking_comment(comments: list[dict]) -> bool:
    for c in comments:
        text = c["body"].lower()
        if any(kw in text for kw in _BLOCKING_KEYWORDS):
            return True
    return False


def _git(args: list[str], cwd: Path, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git"] + args,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        check=check,
    )


def _checkout_branch(repo_path: Path, branch: str) -> Path:
    """Create a worktree for an existing remote branch."""
    from .dispatcher import _git_root, _worktree_path
    git_root = _git_root(repo_path)
    subdir = repo_path.relative_to(git_root)
    wt = _worktree_path(repo_path, f"review-{branch.replace('/', '-')}")
    wt.parent.mkdir(exist_ok=True)
    # Fetch branch, clean up any stale worktree
    _git(["fetch", "origin", branch], cwd=git_root)
    import shutil
    if wt.exists():
        shutil.rmtree(wt, ignore_errors=True)
    _git(["worktree", "prune"], cwd=git_root, check=False)
    _git(["worktree", "add", str(wt), f"origin/{branch}", "--detach"], cwd=git_root)
    # Create a local tracking branch so we can push
    _git(["checkout", "-B", branch], cwd=wt)
    return wt, wt / subdir


def _remove_worktree(git_root: Path, wt: Path) -> None:
    import shutil
    shutil.rmtree(wt, ignore_errors=True)
    _git(["worktree", "prune"], cwd=git_root, check=False)


def _commit_and_push(wt: Path, branch: str) -> bool:
    _git(["add", "-A"], cwd=wt)
    result = _git(["diff", "--cached", "--quiet"], cwd=wt, check=False)
    if result.returncode == 0:
        return False
    _git(["commit", "-m", "fix: address review comments"], cwd=wt)
    _git(["push", "--force-with-lease", "origin", branch], cwd=wt)
    return True


def process_pr(pr: gh.PR, repo: str, repo_path: Path) -> None:
    from .dispatcher import _git_root
    git_root = _git_root(repo_path)

    print(f"\n[PR #{pr.number}] {pr.title}", flush=True)

    comments = gh.get_pr_review_comments(repo, pr.number)
    human_comments = [c for c in comments if c["author"] not in ("", "github-actions[bot]")]

    wt = None
    try:
        if human_comments:
            print(f"  → {len(human_comments)} review comment(s) found. Running claude...", flush=True)
            wt, project_cwd = _checkout_branch(repo_path, pr.head_ref)

            formatted = "\n\n".join(
                f"**{c['author']}**: {c['body']}" for c in human_comments
            )
            prompt = REVIEW_PROMPT_TEMPLATE.format(title=pr.title, comments=formatted)

            # Reuse worker's claude invocation pattern
            import sys as _sys
            result = subprocess.run(
                ["claude", "--dangerously-skip-permissions", "--print", prompt],
                cwd=str(project_cwd),
                capture_output=True,
                text=True,
                timeout=600,
            )
            if result.returncode != 0:
                gh.post_pr_comment(repo, pr.number, f"❌ Agent failed to address comments.\n```\n{result.stderr[-2000:]}\n```")
                return

            # Verify tests
            test_result = subprocess.run(
                [_sys.executable, "-m", "pytest", "tests/", "-q", "--tb=short"],
                cwd=str(project_cwd),
                capture_output=True,
                text=True,
                timeout=120,
            )
            if test_result.returncode != 0:
                gh.post_pr_comment(repo, pr.number, f"❌ Tests failed after addressing comments.\n```\n{test_result.stdout[-2000:]}\n```")
                return

            pushed = _commit_and_push(wt, pr.head_ref)
            if pushed:
                gh.post_pr_comment(repo, pr.number, "✅ Review comments addressed. Pushed fix.")
                print(f"  ✅ Fix pushed for PR #{pr.number}", flush=True)
            else:
                gh.post_pr_comment(repo, pr.number, "ℹ️ No file changes needed to address comments.")

        # Auto-merge decision
        risk = gh.get_issue_risk(repo, pr.linked_issue) if pr.linked_issue else "medium"
        ci = gh.get_pr_ci_status(repo, pr.number)
        blocking = _has_blocking_comment(human_comments)

        print(f"  → CI: {ci} | risk: {risk} | blocking comments: {blocking}", flush=True)

        if ci == "success" and risk == "low" and not blocking:
            gh.merge_pr(repo, pr.number)
            print(f"  ✅ Auto-merged PR #{pr.number} (low risk, CI green)", flush=True)
        elif ci == "failure":
            gh.post_pr_comment(repo, pr.number, "⚠️ CI is failing. Fix required before merge.")
        elif risk != "low":
            print(f"  ⏭  Skipping auto-merge (risk={risk}) — human review required", flush=True)
        elif blocking:
            print(f"  ⏭  Skipping auto-merge — blocking review keywords detected", flush=True)
        else:
            print(f"  ⏭  CI not ready yet (status={ci})", flush=True)

    except Exception as e:
        gh.post_pr_comment(repo, pr.number, f"❌ Reviewer error: {e}")
        print(f"  ❌ Error processing PR #{pr.number}: {e}", flush=True)
    finally:
        if wt:
            _remove_worktree(git_root, wt)


def run_once(repo: str, repo_path: Path) -> int:
    prs = gh.list_open_prs(repo, label="needs-review")
    if not prs:
        print("No PRs awaiting review.", flush=True)
        return 0
    for pr in prs:
        process_pr(pr, repo, repo_path)
    return len(prs)


def run_loop(repo: str, repo_path: Path, poll_interval: int) -> None:
    print(f"Reviewer started. Polling every {poll_interval}s. Ctrl+C to stop.", flush=True)
    while True:
        try:
            run_once(repo, repo_path)
        except KeyboardInterrupt:
            print("\nReviewer stopped.", flush=True)
            break
        except Exception as e:
            print(f"[error] {e}", flush=True)
        time.sleep(poll_interval)
