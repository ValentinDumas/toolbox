# tmux-agnostic-setup

Opinionated tmux setup for persistent, multi-project terminal workflows — named sessions per project, one-command switching, and instant pane management from any shell.

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
| Multiple projects mixed in one flat pane grid | Named sessions per project — `proj` switches between them instantly |
| Setting up pane layouts per project is slow | `g`, `g+`, `g-` — one keystroke to add, kill, or restore panes in any session |
| Config is fragile and hard to reproduce | Every file and setting is documented here, copy-pasteable |
| `proj` fails if no tmux server is running | `proj` starts the server and waits for the socket — safe from a cold shell |

---

## What

| Component | Role |
|---|---|
| tmux | Terminal multiplexer — sessions, windows, panes |
| TPM | Plugin manager for tmux |
| tmux-resurrect | Manual session save/restore (`prefix + Ctrl-s` / `Ctrl-r`) |
| tmux-continuum | Auto-saves every 5 min, auto-restores on tmux start |
| `proj.sh` | Session switcher/creator — the `proj` command |
| `grid.sh` | Pane count manager for the focused session — the `g` command |
| `statusbar.sh` | Right-side status bar: current dir · git branch + diff · battery · time |

---

## Core Workflow

The mental model is: **one session per project, `proj` to move between them, `g` to manage panes inside.**

```
proj work       → switch to your "work" session (create it if first time)
proj invoice    → switch to "invoice" (create it if first time)
proj            → open session picker (all running sessions)

g 4             → set current session to 4 panes
g+              → add one pane
g-              → remove focused pane
```

Sessions are isolated — `g 4` in `work` does not affect `invoice`. Each session tracks its own pane count independently.

### Starting fresh on a new project

```sh
proj myproject          # creates a bare session named "myproject", switches you in
g 3                     # set up 3 panes however you need
```

### Optional: scripted project layouts

If you want a session to auto-configure on first run (specific windows, startup commands), create `~/.config/tmux/projects/myproject.sh`. The next time you run `proj myproject`, it runs the script instead of creating a bare session. See the [full guide](tmux-agnostic-setup.md#project-scripts-optional) for an example.

> Always pass the session name explicitly to `grid.sh` inside a project script — omitting it picks up the *caller's* session, not the one being launched. See the [full guide](tmux-agnostic-setup.md#project-scripts-optional) for the pattern.

### The `grid` session

`grid` is the default scratch session — it's where you land on cold start if you don't specify a project. Use it for one-off work that doesn't belong to a named project.

---

## How — Quick Start

**1. Install tmux**
Follow the platform-specific install in the [full guide](tmux-agnostic-setup.md#installation) (macOS / Linux / Windows WSL2).

**2. Drop config files in place**
Copy `tmux.conf`, `statusbar.sh`, `grid.sh`, and `proj.sh` to `~/.config/tmux/` as described in the [configuration section](tmux-agnostic-setup.md#tmux-configuration).

**3. Wire up `g` and `proj`**
Add aliases to your shell or symlink both scripts into `~/.local/bin/` — see the [aliases section](tmux-agnostic-setup.md#aliases) and [PATH setup](tmux-agnostic-setup.md#path-setup-localbin).

**4. (Optional) Install fzf**
`proj` with no args uses fzf for a styled session picker with a `(default)` label on `grid`. Falls back to tmux's native `choose-tree` if fzf is absent.
```sh
brew install fzf   # macOS
```

---

## Key Commands

| Command | Action |
|---|---|
| `proj` | Session picker (fzf or native `choose-tree`) |
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
docs/specs/                design documents
```

---

> [!NOTE]
> Linux and Windows sections in the full guide are best-effort. They follow standard conventions but have not been tested end-to-end. If you verify or fix them on your system, the guide is the right place to update.

[Full guide →](tmux-agnostic-setup.md)
