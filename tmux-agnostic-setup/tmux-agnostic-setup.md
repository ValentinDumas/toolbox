<!-- platform-status: macos=tested linux=untested windows=untested -->
<!-- WARNING: Linux and Windows sections have not been tested. Treat them as best-effort guides and verify each step on your system. -->

# tmux Setup (macOS · Linux · Windows)

## Why

tmux turns your terminal into a persistent, scriptable, multi-session workspace:
- Sessions survive terminal restarts and reboots
- Run 8+ parallel agents across worktrees, each in its own tab
- Close the terminal mid-task, reopen later — everything still running
- One script spawns a full multi-tab workspace from git worktrees

## What

| Component | Role |
|---|---|
| tmux | Terminal multiplexer — manages sessions, windows, panes |
| tmux -CC | iTerm2 native integration — maps tmux windows to real iTerm2 tabs (macOS only) |
| TPM | tmux Plugin Manager |
| tmux-resurrect | Serialises and restores sessions, windows, panes, working directories |
| `bin/proj.sh` | Session switcher/creator — the `proj` command |
| `bin/grid.sh` | Pane count manager for the focused session — the `g` command |
| `bin/lib.sh` | Shared helpers: server bootstrap, save/restore, notifications |
| `config/statusbar.sh` | Right-side status bar: dir · git branch + diff · battery |
| `install.sh` | Symlinks the checkout into place and installs the plugins |

| Platform | Status |
|---|---|
| macOS (iTerm2) | Tested |
| Linux | **Untested** — instructions provided but unverified |
| Windows (WSL2) | **Untested** — instructions provided but unverified |

---

## File Layout

Every file that makes this setup work lives in this repository. `install.sh` symlinks
them where tmux and the shell expect them — nothing is copied, so editing the repo
edits the live config.

```
tmux-agnostic-setup/            ← the checkout
  install.sh
  bin/proj.sh                   session switcher/creator
  bin/grid.sh                   pane manager
  bin/lib.sh                    shared helpers (not symlinked; found next to the scripts)
  config/tmux.conf
  config/statusbar.sh
  shell/aliases.sh
  projects/<name>.sh            optional per-project session scripts (gitignored)
  projects/example.sh.tmpl      template

~/.config/tmux/
  tmux.conf        -> config/tmux.conf
  statusbar.sh     -> config/statusbar.sh
  aliases.sh       -> shell/aliases.sh
  proj.sh          -> bin/proj.sh
  layouts/grid.sh  -> bin/grid.sh
  projects         -> projects/
  plugins/         TPM + tmux-resurrect (installed, not symlinked)

~/.local/bin/
  proj             -> bin/proj.sh
  g                -> bin/grid.sh

~/.local/state/
  tmux-grid-<session>-last       pane count per session
  tmux-resurrect-save.stamp      save debounce timestamp
  tmux-restore-in-progress       cold-start guard (transient)

~/.local/share/tmux/resurrect/   session snapshots
```

---

## Installation

### 1. Install tmux

**macOS**

```sh
brew install tmux
brew install --cask iterm2   # optional, for native tab integration
```

**Linux**

> [!WARNING]
> **Untested.** The commands below are standard for each distro but have not been verified end-to-end with this setup.

```sh
sudo apt update && sudo apt install tmux   # Debian / Ubuntu
sudo pacman -S tmux                        # Arch
sudo dnf install tmux                      # Fedora
```

No iTerm2 equivalent exists on Linux. Use any terminal emulator. `tmux -CC` will not work — use plain `tmux attach`.

**Windows (WSL2)**

> [!WARNING]
> **Untested.** tmux does not run natively on Windows; WSL2 is required.

```powershell
wsl --install
```

Then inside the distro: `sudo apt update && sudo apt install tmux`. Use Windows Terminal, and omit `tmux -CC`.

### 2. Run the installer

```sh
git clone https://github.com/ValentinDumas/toolbox.git
cd toolbox/tmux-agnostic-setup
./install.sh
```

It is idempotent — re-run it after moving the checkout or on a new machine. It:

- symlinks every file listed above, backing up anything real it finds to `<file>.bak`
- clones TPM into `~/.config/tmux/plugins/` and installs tmux-resurrect
- appends one guarded block to `~/.zshrc` or `~/.bashrc` that sources `aliases.sh` and puts `~/.local/bin` on `PATH`

```sh
./install.sh --uninstall   # removes the symlinks and the shell block; keeps plugins and snapshots
```

The installer refuses to run when `$XDG_CONFIG_HOME` is not `~/.config`: `config/tmux.conf`
spells the plugin path out in full, and a config pointing at a directory the installer
never populated loads no plugins at all — silently.

### 3. Restart

```sh
exec $SHELL -l
tmux kill-server        # drop any server still running the old config
proj grid
```

---

## Save & Restore

Sessions, windows, panes and working directories are snapshotted by tmux-resurrect
into `~/.local/share/tmux/resurrect/`. Restoring is automatic: the first `proj` or `g`
after a reboot brings the whole workspace back.

**A snapshot is written when:**

| Trigger | Where |
|---|---|
| you switch project with `proj <name>` | `bin/proj.sh` |
| you detach a client (closing the terminal) | `client-detached` hook |
| a window is created or destroyed | `window-linked` / `window-unlinked` hooks |
| `prefix + Ctrl-s` | manual, forced, with a desktop notification |

**Restoring** happens in `ensure_server()` (`bin/lib.sh`) on cold start, *before* any
session is created, and synchronously — so nothing races it. `prefix + Ctrl-r` restores
on demand.

### Why not tmux-continuum

Continuum is not used, deliberately:

- It disables its own auto-save whenever it counts more than one `tmux` process at
  server start (`another_tmux_server_running`) — which the wrapper scripts here trigger
  every time. The failure is silent: no interpolation in `status-right`, no save, no message.
- Its auto-save rides on `status-right`, so it stops working if the status bar is off or overwritten.
- Its automatic-start support is a macOS launchd `.plist`.

The hooks above replace it in four lines of `tmux.conf` and behave identically on every platform.

### Guards worth knowing about

Three failure modes are handled explicitly, because each one silently destroys the snapshot
you are about to restore:

| Guard | Problem it prevents |
|---|---|
| `~/.local/state/tmux-restore-in-progress` | Save hooks fire the moment the bootstrap session appears and overwrite the snapshot being restored. The guard is created *before* the server exists; a stale one expires after a minute. |
| Boot-only snapshot rejection | A save catching a server that holds nothing but `_tas_boot`, or a snapshot with no real windows, is discarded and the previous `last` kept. |
| `mkdir` lock + 10 s debounce | Concurrent saves leave `last` pointing at a file the other run never finished writing. Manual saves bypass the debounce, never the lock. |

`resurrect`'s own scripts derive their socket from `$TMUX` (`tmux -S "$(tmux_socket)"`),
so they are always handed to the server via `tmux run-shell` — called from a plain shell
they expand to `tmux -S ""` and fail with `error creating  (No such file or directory)`.

---

## Sessions

`proj` is the entry point. One session per project.

| Command | Action |
|---|---|
| `proj` | Session picker — fzf if installed, else `tmux choose-tree -Zs` |
| `proj <name>` | Switch to `<name>`, creating it if missing |
| `proj --save` | Snapshot now (debounced) |
| `proj --save -n` | Snapshot now, forced, with notification |
| `proj --restore` | Restore the last snapshot |

Install fzf for the styled picker, which labels `grid` as `(default)`:

```sh
brew install fzf        # macOS
sudo apt install fzf    # Debian / Ubuntu
```

### The `grid` session

`grid` is the default scratch session — where you land on cold start without a project name.
Use it for one-off work.

---

## Grid — pane management

`g` manages pane count in the **focused session**.

| Command | Action |
|---|---|
| `g` | Restore the session's remembered pane count |
| `g N` | Set the focused session to exactly N panes |
| `g+` | Add 1 pane, rebalance ¹ |
| `g-` | Kill the focused pane, rebalance ¹ |

¹ `g+`/`g-` without a space needs the shell aliases. Via the `~/.local/bin/g` symlink use
`g +` / `g -` — both forms pass `+` or `-` as the first argument and behave identically.

Pane count persists per session in `~/.local/state/tmux-grid-<session>-last`. `g 4` in
`work` does not affect `invoice`.

---

## Project Scripts (optional)

Drop `<session-name>.sh` in `projects/` to give a project a scripted layout — specific
windows, startup commands, a pane count. `proj <name>` runs it **only when the session does
not exist**, so a restored session is never clobbered.

Start from `projects/example.sh.tmpl`. `projects/*.sh` is gitignored: those files hold
personal paths.

> Always pass the session name explicitly to `grid.sh` inside a project script —
> `~/.config/tmux/layouts/grid.sh 4 "$SESSION"`. Omitting it targets the *caller's*
> session, not the one being launched.

---

## Key Bindings

| Shortcut        | Action                        |
|-----------------|-------------------------------|
| `Shift+Left`    | Move to pane left             |
| `Shift+Right`   | Move to pane right            |
| `Shift+Up`      | Move to pane up               |
| `Shift+Down`    | Move to pane down             |
| `Ctrl-b s`      | Interactive session list      |
| `prefix Ctrl-s` | Save session + notification   |
| `prefix Ctrl-r` | Restore session + notification|
| `prefix g` then `g` | Retile the current window |
| `prefix g` then `+` / `-` | Grow / shrink the focused pane |

**Why Shift+Arrow:** no prefix needed, instant. `⌥Arrow` conflicts with macOS
word-navigation, `Ctrl+Arrow` conflicts with some tools — Shift+Arrow does not.

---

## Status Bar

Refreshes every 5 seconds. Reflects the **active pane's** working directory.

| Zone | Content | Example |
|---|---|---|
| Left | Session name + window:pane | `dev 0:2` |
| Right | Dir · Git branch + diff · Battery · Time | `workflow   main +42 -15  ⚡63%  10:52 11-mai-2026` |

Battery comes from `pmset` on macOS and `/sys/class/power_supply/BAT*` on Linux; it is
omitted where neither exists (most WSL2 setups).

Clipboard on mouse-drag routes to `pbcopy`, `wl-copy` or `xclip`, whichever is present.

---

## iTerm2 Setup (macOS only)

### Essential Preferences

**General → Closing**
- Uncheck "Confirm closing multiple sessions" — avoids confirmation dialogs on tmux tabs

**General → tmux**
- Check "Automatically hide the tmux client session after connecting" — closes the gateway window immediately after attaching

**Appearance → General**
- Theme: `Minimal` — removes chrome, more screen space

**Profiles → Text**
- Font: `JetBrains Mono` or any [Nerd Font](https://www.nerdfonts.com) at 13–14pt — required for statusbar icons
- Install: `brew install --cask font-jetbrains-mono-nerd-font`

**Profiles → Terminal**
- Check "Enable mouse reporting" — enables pane switching on click + per-pane scroll
- Trade-off: disables native iTerm2 text selection. Fix: tmux routes mouse-drag to `pbcopy`. `Option+drag` bypasses tmux for native selection.

**Profiles → Keys**
- Left Option key: `Esc+` — enables Option as Meta (used by many CLI tools and editors)

**Keys → Key Bindings**
- Presets → Natural Text Editing — Home/End/⌥←/⌥→/⌥⌫ work as expected in the shell
- If ⌥⌫ (delete word) stops working: verify `⌥⌫` → Send Hex Code `0x1b 0x7f`. Reapply Natural Text Editing preset if missing.

### Shell Integration

Install from inside iTerm2: **iTerm2 menu → Install Shell Integration**.

Adds `iterm2_prompt_mark` to your shell prompt. Enables: jump between prompts (⌘↑/⌘↓), select output of last command, automatic profile switching per directory.

### Verify tmux Integration

```sh
tmux -CC new -s test    # opens session as real iTerm2 tabs
tmux -CC attach -t test # re-attach after closing iTerm2
```

Each tmux window = one iTerm2 tab. Closing a tab kills that tmux window (not the whole session).

---

## Auto-Attach on Terminal Open

### macOS (iTerm2)

Add to `~/.zshrc`, after the installer's block:

```sh
if [ -z "$TMUX" ] && [ "$TERM_PROGRAM" = "iTerm.app" ]; then
  proj grid
fi
```

### Linux

> [!WARNING]
> **Untested.** Behavior varies by terminal emulator.

```sh
if [ -z "$TMUX" ] && [ -n "$DISPLAY" ]; then
  proj grid
fi
```

Remove the `$DISPLAY` check if running headless or over SSH.

### Windows Terminal (WSL2)

> [!WARNING]
> **Untested.** Windows Terminal sets `$WT_SESSION` when running inside WSL2.

```sh
if [ -z "$TMUX" ] && [ -n "$WT_SESSION" ]; then
  proj grid
fi
```

---

## Verify the setup

```sh
# plugins actually loaded — empty output means TPM found no plugins
tmux show-option -gqv @resurrect-save-script-path

# a snapshot exists and describes real windows
readlink ~/.local/share/tmux/resurrect/last
grep -c '^window' ~/.local/share/tmux/resurrect/$(readlink ~/.local/share/tmux/resurrect/last)
```

End-to-end: `proj demo`, `g 3`, `prefix + Ctrl-s`, `tmux kill-server`, then `proj demo` —
the three panes come back.

---

## Daily Reference

```sh
proj                              # session picker
proj <name>                       # switch to / create named session
g N                               # N panes in the focused session
tmux ls                           # list sessions
tmux attach -t <name>             # attach (any OS)
tmux -CC attach -t <name>         # attach with iTerm2 integration (macOS only)
tmux source-file ~/.config/tmux/tmux.conf   # reload config
```

## Key Concepts

- **Session** — named workspace (e.g. `dev`, `work`)
- **Window** — one tab inside a session
- **Pane** — split within a window
- **prefix** — default `Ctrl-b`
