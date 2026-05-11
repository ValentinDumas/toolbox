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
