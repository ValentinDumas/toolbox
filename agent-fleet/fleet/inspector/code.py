"""
Code Quality Inspector: analyzes the target repo via `claude --print`,
then creates GitHub Issues for each problem found.

Uses Claude Code CLI auth (no separate API key or billing needed).
"""

import json
import subprocess
import sys
from pathlib import Path

from .. import gh

MAX_SOURCE_CHARS = 60_000

PROMPT_TEMPLATE = """\
You are a senior Python engineer performing a code quality audit.
Analyze the provided codebase and identify concrete, actionable issues.

Focus on:
- Dead code (unreachable functions, unused imports, unused variables)
- Code duplication (copy-paste patterns that should be extracted)
- Anti-patterns (mutable default args, bare excepts, god functions > 100 lines)
- Missing or inadequate test coverage (critical paths with no tests)
- Module boundary violations (circular imports, wrong layer dependencies)
- Deprecated or unsafe patterns

Output ONLY a JSON array (no markdown, no explanation). Each issue:
{{
  "title": "short imperative title (< 72 chars)",
  "description": "exact problem with file references when possible",
  "acceptance_criteria": "how to verify the fix is correct",
  "risk": "low|medium|high",
  "files": ["list", "of", "affected", "files"]
}}

Rules:
- Maximum 10 issues (prioritize by impact).
- Skip style-only issues (formatting, naming conventions).
- Each issue must be self-contained and actionable by an autonomous agent.
- Do not invent issues. Only report what you can see in the code.

Codebase to analyze:
{source}
"""


def _collect_source(repo_path: Path, max_chars: int = MAX_SOURCE_CHARS) -> str:
    """Read Python source files, truncated to fit context."""
    parts = []
    total = 0
    for py_file in sorted(repo_path.rglob("*.py")):
        if any(p in py_file.parts for p in [".venv", "__pycache__", ".git", "demo"]):
            continue
        content = py_file.read_text(errors="replace")
        header = f"\n\n### {py_file.relative_to(repo_path)}\n"
        chunk = header + content
        if total + len(chunk) > max_chars:
            break
        parts.append(chunk)
        total += len(chunk)
    return "".join(parts)


def run(repo: str, repo_path: Path, dry_run: bool = False) -> list[dict]:
    """
    Analyze repo_path via claude --print, create GitHub issues for each finding.
    Returns list of issue dicts. With dry_run=True, prints but does not create issues.
    """
    print(f"Collecting source from {repo_path}...", flush=True)
    source = _collect_source(repo_path)
    prompt = PROMPT_TEMPLATE.format(source=source)

    print("Running Code Inspector via claude...", flush=True)
    try:
        result = subprocess.run(
            ["claude", "--print", prompt],
            capture_output=True,
            text=True,
            timeout=300,
        )
    except FileNotFoundError:
        print("ERROR: `claude` CLI not found. Install Claude Code.", file=sys.stderr)
        sys.exit(1)
    except subprocess.TimeoutExpired:
        print("ERROR: Inspector timed out after 5 minutes.", file=sys.stderr)
        sys.exit(1)

    if result.returncode != 0:
        print(f"ERROR: claude exited {result.returncode}\n{result.stderr}", file=sys.stderr)
        sys.exit(1)

    raw = result.stdout.strip()
    # claude sometimes wraps JSON in code fences or leading prose
    if "```" in raw:
        raw = raw.split("```", 1)[1]
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0]
    elif "[" in raw:
        raw = raw[raw.index("["):]

    try:
        issues = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"ERROR: Could not parse JSON from claude output: {e}\n\nRaw output:\n{raw}", file=sys.stderr)
        sys.exit(1)

    for issue in issues:
        files_note = ""
        if issue.get("files"):
            files_note = "\n\n**Files concerned:** " + ", ".join(f"`{f}`" for f in issue["files"])

        body = (
            f"### Problem\n{issue['description']}{files_note}\n\n"
            f"### Acceptance criteria\n{issue['acceptance_criteria']}\n\n"
            f"### Risk level\n{issue['risk']}\n\n"
            f"---\n*Created automatically by the Code Quality Inspector.*"
        )

        if dry_run:
            print(f"\n[DRY RUN] {issue['title']}")
            print(f"  Risk: {issue['risk']}")
            print(f"  Files: {issue.get('files', [])}")
        else:
            number = gh.create_issue(repo, issue["title"], body, labels=["agent:code"])
            print(f"  Created issue #{number}: {issue['title']}", flush=True)

    return issues
