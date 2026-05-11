# Per-Project Start Directory

**Date:** 2026-05-11
**Status:** Implemented

## Problem

`proj <name>` creates bare sessions with no working directory. Every new pane lands wherever the shell happened to be. Switching projects means manually navigating to the right folder each time.

## Solution

Persist a directory mapping per project in `~/.config/tmux/project-dirs`. `proj set <name>` registers `$PWD` for a project. `proj <name>` uses it when creating sessions (via `-c`) and when switching to existing sessions (via `send-keys cd`).

---

## Commands

| Command | Action |
|---|---|
| `proj set <name>` | Save `$PWD` as start dir for `<name>`. Upserts on repeat. |
| `proj <name>` (new session) | Create session with `-c /registered/path`. All new panes inherit it. |
| `proj <name>` (existing session) | Switch to session. If shell is focused → `cd /registered/path`. If process running → switch anyway, print warning. |
| `proj <name>` (project script exists) | Unchanged — script handles its own `cd`. Dir mapping ignored. |
| `proj` (picker) | Unchanged. |

## Storage

File: `~/.config/tmux/project-dirs`
Format: one `name=/abs/path` entry per line.

```
invoice=/Users/user/Projects/invoice-manager
work=/Users/user/Projects/work
```

Created automatically by `proj set`. Safe to inspect, do not edit manually.

## Shell Detection (existing session)

Before sending `cd`, check the focused pane's current command:
- Shell (`zsh`, `bash`, `sh`, `fish`) → safe to `cd`
- Anything else → skip `cd`, print: `warn: pane running '<cmd>' — skipping cd to /path. Run manually.`

---

## File Layout

```
~/.config/tmux/
  proj.sh                    # updated
  project-dirs               # new — name=path registry
```
