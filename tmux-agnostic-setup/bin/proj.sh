#!/usr/bin/env sh
# tmux-agnostic-setup — session switcher/creator (the `proj` command).
#
#   proj              session picker (fzf, else tmux choose-tree)
#   proj <name>       switch to <name>, creating it if missing
#   proj --save       snapshot every session (used by tmux hooks)
#   proj --save -n    snapshot + desktop notification
#   proj --restore    restore the last snapshot
set -e

# Resolve through the ~/.local/bin symlink so lib.sh is found next to us.
SELF=$0
while [ -L "$SELF" ]; do
    _link=$(readlink "$SELF")
    case "$_link" in
        /*) SELF=$_link ;;
        *) SELF=$(dirname "$SELF")/$_link ;;
    esac
done
BIN_DIR=$(cd "$(dirname "$SELF")" && pwd)
. "$BIN_DIR/lib.sh"

case "$1" in
    --save)
        plugins_loaded || { warn_no_plugins; exit 1; }
        if [ "$2" = "-n" ]; then
            resurrect_save force
            notify "Session saved"
        else
            resurrect_save
        fi
        exit 0
        ;;
    --restore)
        plugins_loaded || { warn_no_plugins; exit 1; }
        resurrect_restore
        [ "$2" = "-n" ] && notify "Session restored"
        exit 0
        ;;
esac

ensure_server
SESSION="$1"

if [ -z "$SESSION" ]; then
    if command -v fzf >/dev/null 2>&1; then
        SESSION=$(tmux list-sessions -F '#S' 2>/dev/null \
            | sed 's/^grid$/grid (default)/' \
            | fzf --prompt="session> " --height=10 --border \
            | sed 's/ (default)$//' || true)
        [ -z "$SESSION" ] && exit 0
    else
        tmux choose-tree -Zs
        exit 0
    fi
fi

# Snapshot before moving: leaving a project is the natural save point, and it
# is the only one that survives closing the terminal on the next breath.
if plugins_loaded; then resurrect_save force; fi

PROJECT_SCRIPT="$TMUX_CONFIG_DIR/projects/${SESSION}.sh"
if [ -f "$PROJECT_SCRIPT" ] && ! tmux has-session -t "$SESSION" 2>/dev/null; then
    sh "$PROJECT_SCRIPT"
    exit 0
fi

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux new-session -d -s "$SESSION"
fi

drop_boot_session
attach_or_switch "$SESSION"
