"""
Worker: runs Claude Code in a git worktree to resolve a GitHub issue.
Returns success=True if claude exits 0 AND pytest passes.
"""

import subprocess
import sys
from pathlib import Path

from .gh import Issue


PROMPT_TEMPLATE = """\
Fix GitHub issue #{number}: {title}

## Issue description
{body}

## Instructions
- Work in the current directory (a git worktree isolated for this issue).
- Read the codebase to understand the context before making changes.
- Implement the fix described above.
- Run the test suite: python -m pytest tests/ -v
- All existing tests must pass. Add new tests if the acceptance criteria require it.
- Do not commit. Do not push. Only edit files.

## Acceptance criteria
{acceptance}
"""


def _extract_acceptance(body: str) -> str:
    """Extract acceptance criteria section from issue body (GitHub form format)."""
    marker = "### Acceptance criteria"
    if marker in body:
        after = body.split(marker, 1)[1].strip()
        # Stop at next section
        next_section = after.find("\n###")
        return after[:next_section].strip() if next_section != -1 else after.strip()
    return "(See issue body)"


def run(worktree_path: Path, project_cwd: Path, issue: Issue) -> tuple[bool, str]:
    """
    Invoke `claude --print` in project_cwd (the target project subdir inside the worktree).
    Returns (success, log).
    """
    acceptance = _extract_acceptance(issue.body)
    prompt = PROMPT_TEMPLATE.format(
        number=issue.number,
        title=issue.title,
        body=issue.body,
        acceptance=acceptance,
    )

    print(f"  → Running claude in {project_cwd}", flush=True)
    try:
        result = subprocess.run(
            ["claude", "--dangerously-skip-permissions", "--print", prompt],
            cwd=str(project_cwd),
            capture_output=True,
            text=True,
            timeout=600,  # 10 min max per issue
        )
    except FileNotFoundError:
        return False, "ERROR: `claude` CLI not found. Install Claude Code."
    except subprocess.TimeoutExpired:
        return False, "ERROR: claude timed out after 10 minutes."

    log = result.stdout + result.stderr

    if result.returncode != 0:
        return False, f"claude exited with code {result.returncode}\n{log}"

    # Verify tests still pass
    print("  → Running pytest to verify...", flush=True)
    test_result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/", "-v", "--tb=short", "-q"],
        cwd=str(project_cwd),
        capture_output=True,
        text=True,
        timeout=120,
    )
    log += "\n\n--- pytest ---\n" + test_result.stdout + test_result.stderr

    if test_result.returncode != 0:
        return False, f"Tests failed after agent changes:\n{log}"

    return True, log
