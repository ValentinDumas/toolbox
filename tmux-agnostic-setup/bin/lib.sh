# tmux-agnostic-setup — helpers shared by proj.sh and grid.sh. POSIX sh.

TMUX_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/tmux"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}"
BOOT_SESSION="_tas_boot"

# Path to a tmux-resurrect script, as published by resurrect.tmux when TPM
# loads it. Resolving it this way keeps every plugin location out of our code —
# the mismatch between ~/.tmux/plugins and <config>/plugins is what silently
# disabled save/restore before.
resurrect_script() {
    _p=$(tmux show-option -gqv "@resurrect-$1-script-path" 2>/dev/null)
    [ -n "$_p" ] && [ -x "$_p" ] || return 1
    printf '%s\n' "$_p"
}

plugins_loaded() {
    resurrect_script save >/dev/null 2>&1
}

# tmux.conf pins @resurrect-dir; the fallback matches resurrect's own default.
resurrect_dir() {
    _d=$(tmux show-option -gqv @resurrect-dir 2>/dev/null)
    [ -z "$_d" ] && _d="${XDG_DATA_HOME:-$HOME/.local/share}/tmux/resurrect"
    _d=${_d%/}
    case "$_d" in
        "~"/*) _d="$HOME/${_d#\~/}" ;;
    esac
    printf '%s\n' "$_d"
}

# tmux-resurrect is not concurrency-safe: two saves racing leave `last` pointing
# at a file the other run never finished writing. Hooks can fire in bursts, so
# serialise on an atomic mkdir lock and skip saves closer than SAVE_MIN_INTERVAL
# seconds apart. Pass "force" to bypass the interval (manual prefix + C-s).
SAVE_MIN_INTERVAL=10

# Guard held while a cold start is bootstrapping. The save hooks in tmux.conf
# fire as soon as the boot session appears, and without this they overwrite the
# very snapshot ensure_server is about to restore — with a snapshot of nothing.
# Created before the server exists, so no hook can slip in ahead of it.
boot_guard() { printf '%s\n' "$STATE_DIR/tmux-restore-in-progress"; }

boot_guard_held() {
    _g=$(boot_guard)
    [ -f "$_g" ] || return 1
    # A script killed mid-restore must not wedge saving forever.
    if [ -n "$(find "$_g" -mmin +1 2>/dev/null)" ]; then
        rm -f "$_g"
        return 1
    fi
    return 0
}

resurrect_save() {
    boot_guard_held && return 0
    # Nothing but the boot scratch session means there is no state worth
    # keeping — and writing it would bury the snapshot we still need.
    tmux list-sessions -F '#S' 2>/dev/null | grep -qvx "$BOOT_SESSION" || return 0
    _s=$(resurrect_script save) || return 1
    _lock="$STATE_DIR/tmux-resurrect-save.lock"
    _stamp="$STATE_DIR/tmux-resurrect-save.stamp"
    mkdir -p "$STATE_DIR"

    mkdir "$_lock" 2>/dev/null || return 0
    trap 'rmdir "$_lock" 2>/dev/null' EXIT INT TERM

    if [ "$1" != "force" ] && [ -f "$_stamp" ]; then
        _now=$(date +%s)
        _prev=$(cat "$_stamp" 2>/dev/null || echo 0)
        if [ $((_now - _prev)) -lt "$SAVE_MIN_INTERVAL" ]; then
            rmdir "$_lock" 2>/dev/null
            trap - EXIT INT TERM
            return 0
        fi
    fi

    _dir=$(resurrect_dir)
    _prev=$(readlink "$_dir/last" 2>/dev/null || true)

    run_in_tmux "$_s"

    # A save that races a server teardown writes a snapshot with no windows in
    # it, and resurrect points `last` at it regardless — that is how a good
    # snapshot gets replaced by an empty one between two restarts. Keep the
    # previous snapshot when the fresh one recorded nothing.
    _new=$(readlink "$_dir/last" 2>/dev/null || true)
    if [ -n "$_new" ] && [ "$_new" != "$_prev" ] \
       && [ "$(snapshot_windows "$_dir/$_new")" -eq 0 ] \
       && [ -n "$_prev" ] && [ "$(snapshot_windows "$_dir/$_prev")" -gt 0 ]; then
        ln -sf "$_prev" "$_dir/last"
        rm -f "$_dir/$_new"
    else
        date +%s > "$_stamp"
    fi

    rmdir "$_lock" 2>/dev/null
    trap - EXIT INT TERM
}

# Windows recorded in a snapshot, ignoring the boot scratch session — a
# snapshot holding only _tas_boot is as worthless as an empty one.
snapshot_windows() {
    awk -F'\t' -v boot="$BOOT_SESSION" \
        '$1 == "window" && $2 != boot { n++ } END { print n + 0 }' "$1" 2>/dev/null \
        || echo 0
}

resurrect_restore() {
    _s=$(resurrect_script restore) || return 1
    run_in_tmux "$_s"
}

# resurrect's scripts derive the socket from $TMUX (`tmux -S "$(tmux_socket)"`).
# Run from a plain shell that expands to `tmux -S ""` and every command fails
# with "error creating  (No such file or directory)" — so hand the script to the
# server instead. run-shell without -b also blocks, which is the synchronous
# restore ensure_server needs.
run_in_tmux() {
    if [ -n "$TMUX" ]; then
        "$1" >/dev/null 2>&1
    else
        tmux run-shell "$1" >/dev/null 2>&1
    fi
}

# tmux.conf is loaded asynchronously relative to the command that starts the
# server, so wait for a positive witness that the plugins published themselves.
wait_for_plugins() {
    _i=0
    while [ "$_i" -lt 50 ]; do
        plugins_loaded && return 0
        sleep 0.1
        _i=$((_i + 1))
    done
    return 1
}

warn_no_plugins() {
    printf '%s\n' "tmux-agnostic-setup: tmux-resurrect not loaded — run install.sh" >&2
}

# Guarantee a running server. On cold start the last snapshot is restored
# *synchronously*, so callers never create a session that races a background
# restore (or get their restored windows killed by one).
# Sets COLD_START=1 when this call brought the server up.
ensure_server() {
    COLD_START=0
    tmux list-sessions >/dev/null 2>&1 && return 0

    COLD_START=1
    mkdir -p "$STATE_DIR"
    : > "$(boot_guard)"

    tmux new-session -d -s "$BOOT_SESSION" >/dev/null 2>&1 || true

    if ! wait_for_plugins; then
        rm -f "$(boot_guard)"
        warn_no_plugins
        return 0
    fi

    [ -e "$(resurrect_dir)/last" ] && resurrect_restore

    rm -f "$(boot_guard)"
    drop_boot_session
    return 0
}

# The scratch session that holds the server up while the config loads. Killing
# it before a real session exists would take the server down with it, so this is
# a no-op until the caller has created or restored something.
drop_boot_session() {
    tmux has-session -t "$BOOT_SESSION" 2>/dev/null || return 0
    tmux list-sessions -F '#S' 2>/dev/null | grep -qvx "$BOOT_SESSION" || return 0
    tmux kill-session -t "$BOOT_SESSION" 2>/dev/null || true
}

attach_or_switch() {
    if [ -n "$TMUX" ]; then
        tmux switch-client -t "$1"
    else
        tmux attach-session -t "$1"
    fi
}

notify() {
    _msg="$1"
    case "$(uname -s)" in
        Darwin)
            osascript -e "display notification \"$_msg\" with title \"tmux\"" >/dev/null 2>&1
            ;;
        Linux)
            if grep -qi microsoft /proc/version 2>/dev/null; then
                powershell.exe -NoProfile -Command \
                    "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('$_msg','tmux')" \
                    >/dev/null 2>&1
            else
                notify-send -t 3000 "tmux" "$_msg" >/dev/null 2>&1
            fi
            ;;
    esac
}
