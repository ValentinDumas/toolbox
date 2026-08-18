# Repo-owned configuration + save/restore repair

**Date:** 2026-08-18
**Status:** Implemented

## Problem

Two unrelated complaints, one of which turned out to have four causes.

1. `proj <name>` did not save or restore sessions across close/reopen.
2. Every file the setup needs lived only in `~/.config/tmux/` — nothing versioned,
   nothing reproducible on a second machine.

## Diagnosis

Measured on the live machine before any change:

```
$ tmux show-option -gqv @resurrect-save-script-path   → (empty)
$ tmux list-keys | grep -c resurrect                  → 1   (the hand-written bind, not resurrect's)
$ ls ~/.config/tmux/plugins                           → No such file or directory
$ ls ~/.tmux/plugins                                  → tpm  tmux-resurrect  tmux-continuum
$ readlink ~/.local/share/tmux/resurrect/last         → tmux_resurrect_20260513T123624.txt
```

**Cause 1 — TPM loaded nothing.** `tpm`'s `set_default_tpm_path` switches
`TMUX_PLUGIN_MANAGER_PATH` to `<dir of tmux.conf>/plugins` as soon as an XDG
`tmux.conf` exists. The plugins were installed in `~/.tmux/plugins`. Neither
tmux-resurrect nor tmux-continuum was ever sourced. No auto-save, no auto-restore,
`prefix + Ctrl-r` not even bound. The only snapshot on disk came from the
hand-written `bind C-s` that hardcodes `~/.tmux/plugins/...`.

**Cause 2 — continuum's multi-server guard.** Even with plugins loading, continuum
skips `add_resurrect_save_interpolation` when `another_tmux_server_running` counts
more than one `tmux` process at server start. Its counter matches any command
starting with `tmux`, clients included — and `proj.sh` (`tmux start-server`, a
`tmux list-sessions` poll loop) and `grid.sh` (`tmux info`, a `_boot` session,
`restore.sh`) run several concurrently while the config loads. Reproduced on a
throwaway socket: no interpolation in `status-right`, `@continuum-save-last-timestamp`
never set. The failure is silent.

**Cause 3 — restore ran outside tmux.** `restore.sh` builds every command as
`tmux -S "$(tmux_socket)"`, where `tmux_socket` reads `$TMUX`. Invoked from a plain
shell it expands to `tmux -S ""`:

```
error creating  (No such file or directory)
can't find session: alpha
```

**Cause 4 — saves destroying the snapshot they were about to restore.** Save hooks
fire the instant the bootstrap session appears, so a cold start overwrote `last`
with a snapshot of the scratch session, then restored that. Concurrent saves also
left `last` pointing at a file the other run had not finished writing.

## Changes

### Everything moves into the repository

```
bin/proj.sh  bin/grid.sh  bin/lib.sh
config/tmux.conf  config/statusbar.sh
shell/aliases.sh
projects/<name>.sh  (gitignored)  projects/example.sh.tmpl
install.sh
```

`install.sh` symlinks them into `~/.config/tmux/` and `~/.local/bin/`, backs up
anything real to `<file>.bak`, clones TPM into `~/.config/tmux/plugins`, installs
the plugins, and appends one guarded block to the shell rc that sources
`aliases.sh` and adds `~/.local/bin` to `PATH`. `--uninstall` reverses it, keeping
plugins and snapshots. It aborts when `$XDG_CONFIG_HOME` is not `~/.config`,
because `config/tmux.conf` spells the plugin path out in full.

`bin/lib.sh` is not symlinked: `proj.sh` and `grid.sh` resolve their own symlink
chain and source it from the checkout.

### Plugin path pinned

`config/tmux.conf` sets `TMUX_PLUGIN_MANAGER_PATH` explicitly and runs
`~/.config/tmux/plugins/tpm/tpm`. No script hardcodes a plugin path any more —
`bin/lib.sh` reads `@resurrect-save-script-path` / `@resurrect-restore-script-path`,
which resurrect publishes itself.

### tmux-continuum dropped

Replaced by four hooks in `config/tmux.conf`:

```
set-hook -g client-detached 'run-shell -b "~/.config/tmux/proj.sh --save"'
set-hook -g window-linked   'run-shell -b "~/.config/tmux/proj.sh --save"'
set-hook -g window-unlinked 'run-shell -b "~/.config/tmux/proj.sh --save"'
```

plus an explicit save in `proj.sh` before every switch. There is deliberately no
`session-closed` hook: it fires while the server tears down, and the snapshot it
produces is missing the sessions worth restoring.

### Cold start made deterministic

`ensure_server()` in `bin/lib.sh`:

1. creates `~/.local/state/tmux-restore-in-progress` **before** the server exists;
2. starts a `_tas_boot` scratch session;
3. waits for a positive witness that the plugins published themselves
   (`@resurrect-save-script-path` readable and executable), bounded to 5 s;
4. restores the last snapshot **synchronously**, via `tmux run-shell`;
5. removes the guard and kills `_tas_boot` once a real session exists.

### Save guards

| Guard | Prevents |
|---|---|
| `tmux-restore-in-progress` (expires after 1 min) | hook saves overwriting the snapshot being restored |
| refusing to save a server holding only `_tas_boot` | a bootstrap snapshot burying a good one |
| discarding a fresh snapshot with no non-boot windows, restoring the previous `last` | a save racing a teardown replacing a good snapshot with an empty one |
| `mkdir` lock + 10 s debounce (`force` bypasses the interval, never the lock) | concurrent saves leaving `last` dangling |

### Project scripts run only when the session is missing

Previously `proj <name>` ran `projects/<name>.sh` unconditionally, which could
rebuild a session resurrect had just restored.

### Portability

`statusbar.sh` reads the battery from `pmset` on macOS and
`/sys/class/power_supply/BAT*` on Linux, and omits it elsewhere. Clipboard binding
picks `pbcopy`, `wl-copy` or `xclip` by availability. All scripts are POSIX `sh`
with `#!/usr/bin/env sh`, so the `~/.local/bin` symlinks are directly executable.

## Verification

On an isolated socket (`TMUX_TMPDIR`), against the installed symlinks:

| Check | Result |
|---|---|
| plugins load (`@resurrect-save-script-path`) | `~/.config/tmux/plugins/tmux-resurrect/scripts/save.sh` |
| build `alpha` (3 panes) + `beta` (2 panes), save, `tmux kill-server`, `proj alpha` | both sessions back, 3 and 2 panes |
| pane working directory after restore | preserved |
| `_tas_boot` after cold start | gone |
| new project created after a restore | `alpha beta gamma` |
| `g +`, `g -`, per-session state file | 3 panes then 2, `tmux-grid-gamma-last` = 3 |
| two saves back to back | second debounced, `last` unchanged |
| snapshot after `tmux kill-server` | still the pre-kill snapshot, not a degenerate one |
| project script on an existing session | not re-run |

## Migration

The old `~/.config/tmux/*` files are kept as `<file>.bak`. The old
`~/.tmux/plugins/` tree is unused and can be deleted. Snapshots older than 30 days
were pruned by resurrect's own retention on the first successful save.
