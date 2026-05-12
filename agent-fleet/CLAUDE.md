# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code of conduct — read first, every session

@BEHAVIOR.md

## Software craftsmanship — TOP PRIORITY

These practices **override** all rules below when in conflict. Apply them to **every file** (Python, Jinja, JS, SQL, Go) and to **every change**, before considering language-specific or framework conventions.

@DDD_PRACTICES.md
@CLEAN_CODE.md

## Python coding rules

Subordinate to the practices above. Apply when the project is Python and there is no conflict with DDD / Clean Code.

@GOOD_PRACTICES.md
@ARCHITECTURE_PYTHON.md

## UI / UX / Accessibility rules

Apply the following practices to **all dashboard, mobile, or frontend code written or modified in this repo**:

@UI_DESIGN.md
@UX_DESIGN.md
@ACCESSIBILITY.md

## Security skill — load on demand

Load the `owasp-security` skill (installed under `~/.claude/skills/owasp-security/`) **before designing or implementing** a change that touches any of:

- a new HTTP route, form field, or file upload path
- file I/O serving paths from user input (path traversal surface)
- a `subprocess` / shell call
- raw SQL or any query built from user input
- authentication, session, or permission logic
- a new external dependency, or a bumped one with known CVEs

The skill is NOT auto-imported here — load it only when relevant, to keep the prompt cache stable for non-security work. Run `/security-check` or `/security-review` before merging any branch that touched the above.

## QA pass skill — load on demand

Load the `qa-pass` skill (installed under `~/.claude/skills/qa-pass/`) **before** any task that asks to:

- test the app / UI end-to-end
- "find bugs", "QA the app", "check workflows", or any variant of UI regression hunting
- drive Playwright across multiple flows and file GitHub issues for findings

The skill codifies sanity checks (`lsof -p <pid> | grep cwd`, no `SELECT *` on tables with blob columns), token discipline (one snapshot per page then `browser_evaluate`), state-rollback SQL, and the issue-template format. Not auto-imported — keeps the prompt cache stable for non-QA work.

---

# agent-fleet

Autonomous agent fleet driven by GitHub Issues. Platform-agnostic, free, runs locally.

## Architecture

```
run.py                    CLI entry point
fleet/
  gh.py                   GitHub CLI wrapper (all I/O through here)
  dispatcher.py           Polling loop — claims issues, creates worktrees, calls worker, opens PRs
  worker.py               claude --print invocation + pytest verification
  inspector/
    code.py               Code quality analysis → creates GitHub Issues
config.toml               Local config (gitignored — copy from config.toml.example)
```

## Setup

```bash
cd ~/Projects/toolbox/agent-fleet
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Prerequisites (must be installed and authenticated)
brew install gh
gh auth login

cp config.toml.example config.toml
# edit config.toml: set target_repo and target_path
```

## Tests

```bash
python3 -m pytest tests/ -v
```

12 tests across 2 files:
- `tests/test_worker.py` — `_extract_acceptance` (acceptance criteria parsing)
- `tests/test_inspector_code.py` — `_collect_source` (file collection + truncation) + JSON fence-stripping logic

## Linting

```bash
ruff check .
mypy fleet/
```

## End-to-end workflow

### Step 1 — First-time setup (run once)

```bash
python run.py setup-labels   # create agent:* labels on the target repo
```

### Step 2 — Inspect: find issues

```bash
python run.py inspect code          # analyze repo, create GitHub issues (label: agent:code)
python run.py inspect code --dry    # preview without creating
```

### Step 3 — Dispatch: fix issues

```bash
python run.py dispatch --once   # process all agent:code issues, open PRs, exit
python run.py dispatch          # continuous loop (polls every poll_interval_seconds)
python run.py status            # check what's in-progress / queued
```

### Step 4 — Review: merge PRs

```bash
python run.py review            # address review comments + auto-merge low-risk PRs
python run.py review --loop     # continuous loop
```

Repeat steps 2–4 periodically to keep the codebase clean.

## Commands reference

```bash
python run.py setup-labels          # create labels (once per repo)
python run.py inspect code          # find issues → GitHub Issues
python run.py inspect code --dry    # preview issues without creating
python run.py dispatch              # fix issues → PRs (continuous)
python run.py dispatch --once       # fix issues → PRs (one shot)
python run.py review                # address comments + auto-merge (one shot)
python run.py review --loop         # address comments + auto-merge (continuous)
python run.py status                # show active agents + queued issues
```

## Label flow

```
agent:code → (dispatcher claims) → agent:in-progress
agent:in-progress → (success) → agent:done + needs-review + PR created
agent:in-progress → (failure) → agent:code (released back to queue)
needs-review + CI green + risk=low → (reviewer) → auto-merged
needs-review + risk=medium/high → (reviewer) → push fixes, leave for human
```

## Reviewing PRs

After a dispatch run, each completed issue has a PR labeled `needs-review`.

```bash
# Let the agent process all needs-review PRs:
# - addresses review comments via claude
# - auto-merges PRs that are risk=low + CI green + no blocking comments
python run.py review

# Poll continuously (same logic, runs every poll_interval_seconds)
python run.py review --loop

# Inspect a specific PR manually
gh pr list --repo ValentinDumas/toolbox --label needs-review
gh pr view <number> --repo ValentinDumas/toolbox
gh pr diff <number> --repo ValentinDumas/toolbox

# Merge manually when satisfied (CI must be green)
gh pr merge <number> --repo ValentinDumas/toolbox --squash --delete-branch

# Close without merging and re-queue for a new agent attempt
gh pr close <number> --repo ValentinDumas/toolbox
gh issue edit <number> --repo ValentinDumas/toolbox --remove-label agent:done --add-label agent:code
```

### Auto-merge rules

`python run.py review` auto-merges a PR when **all three** are true:
1. CI is green (`pytest` passes)
2. Risk level is `low` (set by the Code Inspector in the original issue)
3. No human review comment contains a blocking keyword: `fix, wrong, incorrect, broken, revert, don't, shouldn't, rewrite, remove, bad`

Medium/high risk PRs are never auto-merged — the agent addresses comments and pushes, but leaves the merge to you.

CI (`ci.yml`) runs `pytest` automatically on every push — wait for the green check before merging manually.

## Rules for agents working in this repo

- All GitHub I/O goes through `fleet/gh.py`. Never call `gh` directly from other modules.
- `dispatcher.py` owns git operations (worktree, commit, push). `worker.py` only edits files.
- `worker.py` must not commit or push. That is the dispatcher's responsibility.
- No new dependencies without updating `pyproject.toml`.
- Config lives in `config.toml` (gitignored). The example is committed as `config.toml.example`.
- Module-level constants in uppercase (e.g. `MAX_SOURCE_CHARS`). No magic numbers in function signatures.

## Documentation hygiene

Always update `README.md` and any associated documentation (specs under
`docs/specs/`, install/usage notes, subdirectory READMEs) when a change
alters behavior, configuration, commands, or interfaces. Docs land in the
same commit as the code change — never deferred.
