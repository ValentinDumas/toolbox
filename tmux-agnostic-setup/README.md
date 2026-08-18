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
| Config is fragile and hard to reproduce | Every file lives in this repo; `install.sh` symlinks it into place |
| Sessions silently stop being saved | Saving is driven by explicit tmux hooks, not by tmux-continuum's fragile status-bar interpolation |
| `proj` fails if no tmux server is running | `proj` boots the server, restores the last snapshot synchronously, then switches |

---

## What

| Component | Role |
|---|---|
| tmux | Terminal multiplexer — sessions, windows, panes |
| TPM | Plugin manager for tmux |
| tmux-resurrect | Serialises and restores sessions, windows, panes, working directories |
| `bin/proj.sh` | Session switcher/creator — the `proj` command |
| `bin/grid.sh` | Pane count manager for the focused session — the `g` command |
| `bin/lib.sh` | Shared helpers: server bootstrap, save/restore, notifications |
| `config/statusbar.sh` | Right-side status bar: current dir · git branch + diff · battery · time |
| `install.sh` | Symlinks the checkout into place and installs the plugins |

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

If you want a session to auto-configure on first run (specific windows, startup commands), copy `projects/example.sh.tmpl` to `projects/myproject.sh`. `proj myproject` runs it **only when the session does not exist**, so a restored session is never clobbered. `projects/*.sh` is gitignored — those files hold personal paths.

> Always pass the session name explicitly to `grid.sh` inside a project script — omitting it picks up the *caller's* session, not the one being launched. See the [full guide](tmux-agnostic-setup.md#project-scripts-optional) for the pattern.

### The `grid` session

`grid` is the default scratch session — it's where you land on cold start if you don't specify a project. Use it for one-off work that doesn't belong to a named project.

---

## How — Quick Start

```sh
git clone https://github.com/ValentinDumas/toolbox.git
cd toolbox/tmux-agnostic-setup
./install.sh
exec $SHELL -l
tmux kill-server && proj grid
```

`install.sh` is idempotent — re-run it after moving the checkout or on a new machine. It symlinks every file into `~/.config/tmux/` and `~/.local/bin/`, backing up anything real it finds to `<file>.bak`; clones TPM and installs tmux-resurrect; and adds one guarded block to `~/.zshrc` / `~/.bashrc` that sources the aliases and puts `~/.local/bin` on `PATH`. `./install.sh --uninstall` reverses it.

Install tmux first (`brew install tmux`, `apt install tmux`, …) and optionally fzf — `proj` with no argument uses it for a styled session picker, falling back to tmux's `choose-tree`.

Full install notes, platform caveats and iTerm2 configuration: [full guide](tmux-agnostic-setup.md).

---

## Save & Restore

Snapshots land in `~/.local/share/tmux/resurrect/`. A snapshot is written when you switch project with `proj`, detach a client, create or destroy a window, or press `prefix + Ctrl-s`. Restoring happens on cold start, before any session is created and synchronously, so nothing races it.

tmux-continuum is deliberately not used: it disables its own auto-save whenever it counts more than one `tmux` process at server start — which these wrapper scripts trigger every time — and does so silently. Four `set-hook` lines replace it, identically on every platform. Details and the guards involved: [full guide](tmux-agnostic-setup.md#save--restore).

---

## Key Commands

| Command | Action |
|---|---|
| `proj` | Session picker (fzf or native `choose-tree`) |
| `proj <name>` | Switch to named session (create if missing) |
| `g` | Restore pane count in focused session |
| `g N` | Set focused session to exactly N panes |
| `g+` / `g-` | Add / remove one pane in focused session |
| `prefix Ctrl-s` | Save session snapshot (forced, with notification) |
| `prefix Ctrl-r` | Restore the last snapshot |
| `Shift+Arrow` | Navigate between panes (no prefix needed) |

> In zsh, `g+` and `g-` (no space) work via aliases. In bash/fish or via the `g` symlink, use `g +` and `g -` with a space.

---

## Files

```
README.md                  this file
tmux-agnostic-setup.md     full install + config guide (platform notes, iTerm2, save/restore internals)
install.sh                 symlink installer
bin/                       proj.sh, grid.sh, lib.sh
config/                    tmux.conf, statusbar.sh
shell/aliases.sh           g, g+, g-, proj
projects/                  per-project session scripts (gitignored) + template
docs/specs/                design documents
```

---

> [!NOTE]
> Linux and Windows sections in the full guide are best-effort. They follow standard conventions but have not been tested end-to-end. If you verify or fix them on your system, the guide is the right place to update.

[Full guide →](tmux-agnostic-setup.md)
