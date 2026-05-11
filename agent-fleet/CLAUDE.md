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

## Commands

```bash
# Create GitHub labels on the target repo (run once)
python run.py setup-labels

# Run Code Inspector: analyze repo, create issues with label agent:code
python run.py inspect code

# Dry run: see what issues would be created without creating them
python run.py inspect code --dry

# Start dispatcher loop (polls every poll_interval_seconds)
python run.py dispatch

# Process all claimable issues once and exit
python run.py dispatch --once

# Show fleet status: active agents + ready issues
python run.py status
```

## Label flow

```
agent:code → (dispatcher claims) → agent:in-progress
agent:in-progress → (success) → agent:done + needs-review + PR created
agent:in-progress → (failure) → agent:code (released back to queue)
```

## Rules for agents working in this repo

- All GitHub I/O goes through `fleet/gh.py`. Never call `gh` directly from other modules.
- `dispatcher.py` owns git operations (worktree, commit, push). `worker.py` only edits files.
- `worker.py` must not commit or push. That is the dispatcher's responsibility.
- No new dependencies without updating `pyproject.toml`.
- Config lives in `config.toml` (gitignored). The example is committed as `config.toml.example`.
- Module-level constants in uppercase (e.g. `MAX_SOURCE_CHARS`). No magic numbers in function signatures.
