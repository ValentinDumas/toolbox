# Per-Project Session Manager + Session-Aware Pane Management

**Date:** 2026-05-11
**Status:** Implemented

## Problem

The flat `grid` session mixes all projects in one pane grid. Switching between projects requires manually navigating a "messy melting pot" — no separation, no visual cues, time lost on navigation.

## Solution

Per-project tmux sessions with zero-friction switching via `proj`. Existing `g`/`g+`/`g-` aliases are unchanged and now work correctly in any session.

---

## Changes

### `~/.config/tmux/layouts/grid.sh`

Two lines changed — session-awareness + per-session state:

```sh
# Before
SESSION=${2:-grid}
STATE_FILE="${XDG_STATE_HOME:-$HOME/.local/state}/tmux-grid-last"

# After
SESSION=${2:-$(tmux display-message -p '#S' 2>/dev/null || echo 'grid')}
STATE_FILE="${XDG_STATE_HOME:-$HOME/.local/state}/tmux-grid-${SESSION}-last"
```

`g N`, `g+`, `g-` now operate on the focused session. State files are per-session (`tmux-grid-<name>-last`). Cold-start fallback to `grid` is unchanged.

Note: `g+`/`g-` aliases already pass the session via `$2` — they were already session-aware. This change covers `g` and `g N` (no explicit session arg).

### `~/.config/tmux/proj.sh` *(new)*

Session switcher/creator:

| Command | Action |
|---|---|
| `proj` | fzf picker (or `tmux choose-tree -Zs` if fzf absent), `grid` labeled `(default)` |
| `proj <name>` | switch to session (create if missing) |
| `proj <name>` | if `~/.config/tmux/projects/<name>.sh` exists, run it instead |

Install fzf for the enhanced picker: `brew install fzf`

### `~/.config/tmux/tmux.conf`

Three lines added:

```sh
set -g monitor-activity on   # flag windows with new output
set -g visual-activity off   # suppress noise message
set -g automatic-rename on   # windows auto-name to running command
```

### Aliases (`~/.zshrc`)

One line added:
```sh
alias proj='~/.config/tmux/proj.sh'
```

---

## Optional: Project Scripts

`~/.config/tmux/projects/<name>.sh` — create per project, opt-in. If present, `proj <name>` runs it instead of a bare session.

Example:
```sh
#!/usr/bin/env sh
SESSION=invoice

tmux has-session -t "$SESSION" 2>/dev/null && \
    tmux switch-client -t "$SESSION" && exit 0

tmux new-session -d -s "$SESSION" -n server
tmux send-keys -t "$SESSION:server" "cd ~/Projects/invoice-manager && flask run" Enter
tmux new-window -t "$SESSION" -n agents
~/.config/tmux/layouts/grid.sh 4 "$SESSION"
tmux select-window -t "$SESSION:server"
tmux switch-client -t "$SESSION"
```

---

## File Layout

```
~/.config/tmux/
  tmux.conf                  # +5 lines
  proj.sh                    # new
  layouts/
    grid.sh                  # 2 lines changed
  projects/                  # new dir — optional project scripts

~/.local/bin/
  proj -> ~/.config/tmux/proj.sh   # new symlink

~/.local/state/
  tmux-grid-grid-last        # replaces tmux-grid-last
  tmux-grid-<session>-last   # one per session, auto-created
```

The old `tmux-grid-last` is orphaned — safe to delete or ignore.
