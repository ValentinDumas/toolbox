#!/usr/bin/env sh
# tmux-agnostic-setup — pane count manager for the focused session (`g`).
#
#   g            restore the session's remembered pane count
#   g N          set the session to exactly N panes
#   g + / g -    add / remove one pane
#
# Second argument pins the target session. Always pass it from a project
# script — omitting it picks up the *caller's* session, not the one launched.
set -e

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

ensure_server

SESSION=${2:-$(tmux display-message -p '#S' 2>/dev/null || echo 'grid')}
STATE_FILE="$STATE_DIR/tmux-grid-${SESSION}-last"
CMD=${1:-$(cat "$STATE_FILE" 2>/dev/null || echo 1)}

pane_count() {
    tmux list-panes -s -t "$SESSION" 2>/dev/null | wc -l | tr -d ' '
}

# tmux needs the layout applied twice to settle pane sizes after a split.
after_resize() {
    tmux select-layout -t "$SESSION" tiled
    tmux select-layout -t "$SESSION" tiled
}

remember() {
    mkdir -p "$STATE_DIR"
    pane_count > "$STATE_FILE"
}

ensure_session() {
    tmux has-session -t "$SESSION" 2>/dev/null || tmux new-session -d -s "$SESSION"
}

case "$CMD" in
    +)
        ensure_session
        tmux split-window -t "$SESSION"
        after_resize
        remember
        exit 0
        ;;
    -)
        ensure_session
        tmux kill-pane -t "$SESSION"
        after_resize
        remember
        exit 0
        ;;
esac

if [ -z "$1" ]; then
    ensure_session
    remember
    drop_boot_session
    attach_or_switch "$SESSION"
    exit 0
fi

N=$CMD
ensure_session

while [ "$(pane_count)" -gt "$N" ]; do
    last=$(( $(pane_count) - 1 ))
    tmux kill-pane -t "$SESSION:0.$last"
done

while [ "$(pane_count)" -lt "$N" ]; do
    tmux split-window -t "$SESSION"
    tmux select-layout -t "$SESSION" tiled
done

remember
after_resize
tmux select-pane -t "$SESSION:0.0"
drop_boot_session
attach_or_switch "$SESSION"
