<!-- platform-status: macos=tested linux=untested windows=untested -->
<!-- WARNING: Linux and Windows sections have not been tested. Treat them as best-effort guides and verify each step on your system. -->

# tmux Setup (macOS · Linux · Windows)

## Why

tmux turns your terminal into a persistent, scriptable, multi-session workspace:
- Sessions survive terminal restarts and reboots (with plugins)
- Run 8+ parallel agents across worktrees, each in its own tab
- Close the terminal mid-task, reopen later — everything still running
- One script spawns a full multi-tab workspace from git worktrees

## What

| Component | Role |
|---|---|
| tmux | Terminal multiplexer — manages sessions, windows, panes |
| tmux -CC | iTerm2 native integration — maps tmux windows to real iTerm2 tabs (macOS only) |
| TPM | tmux Plugin Manager |
| tmux-resurrect | Manual save/restore of sessions (prefix + Ctrl-s / Ctrl-r) |
| tmux-continuum | Auto-saves every 5 min, restores on tmux start |
| tmux-worktrees | Custom script — one tab per git worktree |

| Platform | Status |
|---|---|
| macOS (iTerm2) | Tested |
| Linux | **Untested** — instructions provided but unverified |
| Windows (WSL2) | **Untested** — instructions provided but unverified |

## File Layout

All config lives under `~/.config/tmux/`. No external dependencies.

```
~/.tmux.conf                        # entry point — just sources ~/.config/tmux/tmux.conf
~/.config/tmux/
  tmux.conf                         # full config: plugins, keybindings, statusbar, resurrect
  statusbar.sh                      # right-side status: dir · git · battery
  layouts/
    grid.sh                         # grid session manager
    <session>.count                 # saved pane count per session (auto-managed)
```

---

## Installation

### macOS

```sh
brew install tmux
```

Install iTerm2 for native tab integration (optional but recommended):

```sh
brew install --cask iterm2
```

### Linux

> [!WARNING]
> **Untested.** The commands below are standard for each distro but have not been verified end-to-end with this setup. Adjust as needed and report issues.

```sh
# Debian / Ubuntu
sudo apt update && sudo apt install tmux

# Arch
sudo pacman -S tmux

# Fedora
sudo dnf install tmux
```

No iTerm2 equivalent exists on Linux. Use any terminal emulator (GNOME Terminal, Alacritty, Kitty, etc.). The `tmux -CC` attach command will not work — use plain `tmux attach` instead.

### Windows (WSL2)

> [!WARNING]
> **Untested.** tmux does not run natively on Windows. WSL2 is required. The steps below have not been verified end-to-end with this setup.

1. Enable WSL2 and install a distro (Ubuntu recommended):
   ```powershell
   wsl --install
   ```
2. Open the Ubuntu app from the Start menu, then install tmux:
   ```sh
   sudo apt update && sudo apt install tmux
   ```
3. Use Windows Terminal to access WSL2. The `tmux -CC` flag is iTerm2-only — omit it (use plain `tmux new` / `tmux attach`).

---

## TPM + Plugins

Run once after installing tmux (on any OS):

```sh
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

# Then inside a running tmux session:
~/.tmux/plugins/tpm/bin/install_plugins
```

If plugins are missing after first run: press `prefix + I` inside tmux to trigger installation.

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

Install from inside iTerm2:

```
iTerm2 menu → Install Shell Integration
```

Adds `iterm2_prompt_mark` to your shell prompt. Enables: jump between prompts (⌘↑/⌘↓), select output of last command, automatic profile switching per directory.

### Verify tmux Integration

```sh
tmux -CC new -s test    # opens session as real iTerm2 tabs
tmux -CC attach -t test # re-attach after closing iTerm2
```

Each tmux window = one iTerm2 tab. Closing a tab kills that tmux window (not the whole session).

---

## tmux Configuration

### `~/.tmux.conf`

Entry point only — sources the real config:

```sh
source-file ~/.config/tmux/tmux.conf
```

> tmux 3.1+ auto-loads `~/.config/tmux/tmux.conf` only when `~/.tmux.conf` is absent. Since both exist, the `source-file` line is required.

### `~/.config/tmux/tmux.conf`

Full config in one place:

```sh
# Plugins
set -g @plugin 'tmux-plugins/tpm'
set -g @plugin 'tmux-plugins/tmux-resurrect'
set -g @plugin 'tmux-plugins/tmux-continuum'

set -g @continuum-restore 'on'
set -g @continuum-save-interval '5'
set -g @resurrect-capture-pane-contents 'on'

set -g mouse on
set -g set-clipboard on
bind -T copy-mode MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "pbcopy"
bind -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "pbcopy"

set -g pane-border-lines heavy
set -g pane-active-border-style 'fg=#FF87AF'
set -g pane-border-style 'fg=colour238'
set -g window-style        'bg=colour234'
set -g window-active-style 'bg=colour236'

# Status bar
set -g status on
set -g status-interval 5
set -g status-position bottom
set -g status-left-length 40
set -g status-right-length 120
set -g status-left " #S #[fg=colour241]#I:#P "
set -g status-right "#(~/.config/tmux/statusbar.sh #{pane_current_path})  #[fg=colour241]%H:%M %d-%b-%Y "

# Pane navigation (no prefix)
bind -n S-Left  select-pane -L
bind -n S-Right select-pane -R
bind -n S-Up    select-pane -U
bind -n S-Down  select-pane -D

run '~/.tmux/plugins/tpm/tpm'
```

Reload after any change:

```sh
tmux source-file ~/.tmux.conf
```

---

## Script: statusbar.sh

Save to `~/.config/tmux/statusbar.sh` and make executable (`chmod +x`):

```sh
PANE_PATH="${1:-$HOME}"

BRANCH=$(git -C "$PANE_PATH" branch --show-current 2>/dev/null)
if [ -n "$BRANCH" ]; then
    DIFFSTAT=$(git -C "$PANE_PATH" diff --numstat 2>/dev/null | awk '{add+=$1; del+=$2} END {if (add+del>0) printf "+%d -%d", add, del}')
    if [ -n "$DIFFSTAT" ]; then
        GIT=" $BRANCH $DIFFSTAT"
    else
        GIT=" $BRANCH"
    fi
fi

BAT=$(pmset -g batt 2>/dev/null | grep -o '[0-9]*%' | head -1)
if [ -n "$BAT" ]; then
    CHARGING=$(pmset -g batt 2>/dev/null | grep -c 'AC Power')
    [ "$CHARGING" -gt 0 ] && BAT="⚡$BAT" || BAT="$BAT"
fi

DIR=$(basename "$PANE_PATH")

OUT="$DIR"
[ -n "$GIT" ] && OUT="$OUT  $GIT"
[ -n "$BAT" ] && OUT="$OUT  $BAT"
echo "$OUT"
```

> [!WARNING]
> **Linux/Windows (untested):** The battery section uses `pmset`, which is macOS-only. On Linux, replace the `BAT` block with `acpi -b 2>/dev/null | grep -o '[0-9]*%' | head -1` or remove it entirely if no battery is present. On WSL2, battery info is not reliably accessible from within WSL.

---

## Script: grid.sh

Save to `~/.config/tmux/layouts/grid.sh` and make executable (`chmod +x`):

```sh
set -e

SESSION=${2:-grid}
STATE_FILE="${XDG_STATE_HOME:-$HOME/.local/state}/tmux-grid-last"
CMD=${1:-$(cat "$STATE_FILE" 2>/dev/null || echo 1)}

pane_count() {
    tmux list-panes -s -t "$SESSION" 2>/dev/null | wc -l | tr -d ' '
}

after_resize() {
    tmux select-layout -t "$SESSION" tiled
    tmux select-layout -t "$SESSION" tiled
}

attach() {
    if [ -n "$TMUX" ]; then
        tmux switch-client -t "$SESSION"
    else
        tmux attach-session -t "$SESSION"
    fi
}

if ! tmux info &>/dev/null; then
    tmux new-session -d -s _boot &>/dev/null || true
    ~/.tmux/plugins/tmux-resurrect/scripts/restore.sh &>/dev/null || true
    tmux kill-session -t _boot &>/dev/null || true
    if ! tmux info &>/dev/null; then
        tmux new-session -d -s "$SESSION" &>/dev/null || true
    fi
    tmux list-windows -t "$SESSION" -F '#I' 2>/dev/null | sort -rn | while read -r win; do
        [ "$win" -eq 0 ] && break
        tmux kill-window -t "$SESSION:$win" 2>/dev/null || true
    done
    if [ -z "$1" ]; then
        mkdir -p "$(dirname "$STATE_FILE")"
        pane_count > "$STATE_FILE"
        CMD=$(cat "$STATE_FILE")
    fi
fi

if [ "$CMD" = "+" ]; then
    tmux split-window -t "$SESSION"
    after_resize
    mkdir -p "$(dirname "$STATE_FILE")"
    pane_count > "$STATE_FILE"
    exit 0
fi

if [ "$CMD" = "-" ]; then
    tmux kill-pane -t "$SESSION"
    after_resize
    mkdir -p "$(dirname "$STATE_FILE")"
    pane_count > "$STATE_FILE"
    exit 0
fi

N=$CMD

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux new-session -d -s "$SESSION"
fi

if [ -n "$1" ]; then
    while [ "$(pane_count)" -gt "$N" ]; do
        last=$(( $(pane_count) - 1 ))
        tmux kill-pane -t "$SESSION:0.$last"
    done

    while [ "$(pane_count)" -lt "$N" ]; do
        tmux split-window -t "$SESSION"
        tmux select-layout -t "$SESSION" tiled
    done
fi

mkdir -p "$(dirname "$STATE_FILE")"
pane_count > "$STATE_FILE"
after_resize
tmux select-pane -t "$SESSION:0.0"
attach
```

**How it works:**
- `SESSION` defaults to `grid` (override with second arg, e.g. `grid.sh 2 work`)
- State persists in `~/.local/state/tmux-grid-last`
- Cold-start: if no tmux server is running, a `_boot` session starts the server, tmux-resurrect restores your last saved sessions, then `_boot` is killed

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
| `prefix Ctrl-r` | Restore session (resurrect)   |

**Why Shift+Arrow:** no prefix needed, instant. `⌥Arrow` conflicts with macOS word-navigation, `Ctrl+Arrow` conflicts with some tools — Shift+Arrow does not.

---

## Status Bar

Refreshes every 5 seconds. Reflects the **active pane's** working directory.

| Zone | Content | Example |
|---|---|---|
| Left | Session name + window:pane | `dev 0:2` |
| Right | Dir · Git branch + diff · Battery · Time | `workflow   main +42 -15  ⚡63%  10:52 11-mai-2026` |

Script: `~/.config/tmux/statusbar.sh`

---

## Grid Sessions

| Command | Action |
|---------|--------|
| `g` | Restore/set grid to last saved pane count |
| `g N` | Set grid to exactly N panes (e.g. `g 2`, `g 4`) |
| `g+` | Add 1 pane to current session, rebalance ¹ |
| `g-` | Kill focused pane in current session, rebalance ¹ |

¹ `g+`/`g-` (no space) requires zsh aliases. In bash/fish or via symlink, use `g +` / `g -` with a space instead — both forms call the script with `+` or `-` as the first argument and behave identically.

Pane count persists in `~/.local/state/tmux-grid-last`. Updated automatically on every `g`, `g N`, `g+`, or `g-` call.

### Cold-start

**Cold-start (fresh terminal / tmux server was dead):**
1. A temporary `_boot` session starts the tmux server.
2. `tmux-resurrect` restores your last saved sessions (panes, paths, processes).
3. `_boot` is killed.
4. `STATE_FILE` is synced to the restored pane count — prevents a mismatch where `STATE_FILE` remembered a different count than what resurrect actually restored.

---

## Aliases

### zsh

Paste into `~/.zshrc`:

```sh
alias g='~/.config/tmux/layouts/grid.sh'
alias g+='~/.config/tmux/layouts/grid.sh +'
alias g-='~/.config/tmux/layouts/grid.sh -'
```

`g+` and `g-` are valid zsh alias names. Reload with `source ~/.zshrc`.

### bash

> [!WARNING]
> **Untested.** `+` and `-` are invalid in bash alias names — use shell functions instead.

Paste into `~/.bashrc`:

```sh
g() { ~/.config/tmux/layouts/grid.sh "$@"; }
```

Then use `g`, `g +`, `g -` (with a space before `+`/`-`). Reload with `source ~/.bashrc`.

### fish

> [!WARNING]
> **Untested.**

```fish
function g
    ~/.config/tmux/layouts/grid.sh $argv
end
funcsave g
```

Use `g`, `g +`, `g -` with a space.

---

## PATH Setup (`~/.local/bin`)

For shell-agnostic access — makes `g` available without sourcing any shell config (e.g. from scripts, SSH sessions, VS Code terminal):

```sh
mkdir -p ~/.local/bin
ln -sf ~/.config/tmux/layouts/grid.sh ~/.local/bin/g
```

Ensure `~/.local/bin` is in your PATH:

**zsh / bash** — add to `~/.zshrc` or `~/.bashrc`:
```sh
export PATH="$HOME/.local/bin:$PATH"
```

**fish** — run once:
```fish
fish_add_path ~/.local/bin
```

> [!WARNING]
> **Linux/Windows (untested):** `~/.local/bin` may already be in PATH on some distros (Ubuntu 20.04+). Run `echo $PATH` to check before adding the export.

With the symlink, always use `g +` and `g -` (space form). The `g+`/`g-` no-space form only works via zsh aliases, not via the `g` binary in PATH.

---

## Auto-Attach on Terminal Open

### macOS (iTerm2)

Add to `~/.zshrc`:

```sh
if [ -z "$TMUX" ] && [ "$TERM_PROGRAM" = "iTerm.app" ]; then
  tmux -CC new -s dev 2>/dev/null || tmux -CC attach -t dev
fi
```

### Linux

> [!WARNING]
> **Untested.** Behavior varies by terminal emulator. A generic guard that works in most terminals:

```sh
if [ -z "$TMUX" ] && [ -n "$DISPLAY" ]; then
  tmux new-session -s dev 2>/dev/null || tmux attach-session -t dev
fi
```

Remove the `$DISPLAY` check if running headless or over SSH.

### Windows Terminal (WSL2)

> [!WARNING]
> **Untested.** Windows Terminal sets `$WT_SESSION` when running inside WSL2:

```sh
if [ -z "$TMUX" ] && [ -n "$WT_SESSION" ]; then
  tmux new-session -s dev 2>/dev/null || tmux attach-session -t dev
fi
```

---

## Save Notification

`prefix + Ctrl-s` saves the session and fires a native OS notification:

- **macOS** — `osascript` system notification
- **Linux** — `notify-send` (requires `libnotify`)
- **WSL** — `powershell.exe` MessageBox (no extra install)

Config in `~/.config/tmux/tmux.conf`:

```sh
bind C-s run-shell "~/.tmux/plugins/tmux-resurrect/scripts/save.sh && \
  (case \"$(uname)\" in \
    Darwin) osascript -e 'display notification \"Session saved\" with title \"tmux\"' ;; \
    Linux) if grep -qi microsoft /proc/version 2>/dev/null; then \
             powershell.exe -Command '...' &>/dev/null; \
           else notify-send -t 3000 \"tmux\" \"Session saved\"; fi ;; \
  esac)"
```

---

## Verify Auto-Save

```sh
tmux show-option -gv @continuum-save-interval   # → 5
tmux show-option -gv @continuum-restore         # → on
ls -lt ~/.local/share/tmux/resurrect/ | head -5 # snapshots every ~5 min
```

If empty: run `prefix + I` inside tmux to reinstall plugins.

---

## Daily Reference

```sh
tmux ls                           # list sessions
tmux attach -t <name>             # attach (any OS)
tmux -CC attach -t <name>         # attach with iTerm2 integration (macOS only)
tmux source-file ~/.tmux.conf     # reload config
```

## Key Concepts

- **Session** — named workspace (e.g. `dev`, `work`)
- **Window** — one tab inside a session
- **Pane** — split within a window
- **prefix** — default `Ctrl-b`
