# tmux-agnostic-setup

Opinionated tmux setup for persistent, multi-pane terminal workflows — with a one-command pane manager (`g`) available from any shell.

| Platform | Status |
|---|---|
| macOS (iTerm2) | Tested — daily driver |
| Linux | Untested — instructions included, unverified |
| Windows (WSL2) | Untested — instructions included, unverified |

---

## Why

| Problem | Solution |
|---|---|
| Terminal sessions die on restart | tmux-resurrect + tmux-continuum keep sessions alive across reboots |
| Multi-agent / multi-worktree work needs many parallel terminals | tmux windows and panes, one per worktree |
| Pane management is too slow | `g`, `g+`, `g-` — one keystroke to add, kill, or restore a pane layout |
| Config is fragile and hard to reproduce | Every file and setting is documented here, copy-pasteable |

---

## What

| Component | Role |
|---|---|
| tmux | Terminal multiplexer — sessions, windows, panes |
| TPM | Plugin manager for tmux |
| tmux-resurrect | Manual session save/restore (`prefix + Ctrl-s` / `Ctrl-r`) |
| tmux-continuum | Auto-saves every 5 min, auto-restores on tmux start |
| `grid.sh` | Pane count manager for the focused session — the `g` command |
| `proj.sh` | Session switcher/creator — the `proj` command |
| `statusbar.sh` | Right-side status bar: current dir · git branch + diff · battery · time |

---

## How — Quick Start

**1. Install tmux**
Follow the platform-specific install in the [full guide](tmux-agnostic-setup.md#installation) (macOS / Linux / Windows WSL2).

**2. Drop config files in place**
Copy `tmux.conf`, `statusbar.sh`, and `grid.sh` to `~/.config/tmux/` as described in the [configuration section](tmux-agnostic-setup.md#tmux-configuration).

**3. Wire up the `g` command**
Add aliases to your shell or symlink `grid.sh` into `~/.local/bin/g` — see the [aliases section](tmux-agnostic-setup.md#aliases) and [PATH setup](tmux-agnostic-setup.md#path-setup-localbin).

---

## Key Commands

| Command | Action |
|---|---|
| `proj` | Session picker — switch between projects |
| `proj <name>` | Switch to named session (create if missing) |
| `g` | Restore pane count in focused session |
| `g N` | Set focused session to exactly N panes |
| `g+` / `g-` | Add / remove one pane in focused session |
| `prefix Ctrl-s` | Save session snapshot |
| `prefix Ctrl-r` | Restore session snapshot |
| `Shift+Arrow` | Navigate between panes (no prefix needed) |

> In zsh, `g+` and `g-` (no space) work via aliases. In bash/fish or via the `g` symlink, use `g +` and `g -` with a space.

---

## Files

```
README.md                  this file
tmux-agnostic-setup.md     full install + config guide (scripts, aliases, platform notes)
```

---

> [!NOTE]
> Linux and Windows sections in the full guide are best-effort. They follow standard conventions but have not been tested end-to-end. If you verify or fix them on your system, the guide is the right place to update.

[Full guide →](tmux-agnostic-setup.md)
