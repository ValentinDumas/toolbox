#!/usr/bin/env sh
# tmux-agnostic-setup — right-hand status bar: dir · git branch + diff · battery.
PANE_PATH="${1:-$HOME}"

BRANCH=$(git -C "$PANE_PATH" branch --show-current 2>/dev/null)
if [ -n "$BRANCH" ]; then
    DIFFSTAT=$(git -C "$PANE_PATH" diff --numstat 2>/dev/null \
        | awk '{add+=$1; del+=$2} END {if (add+del>0) printf "+%d -%d", add, del}')
    if [ -n "$DIFFSTAT" ]; then
        GIT=" $BRANCH $DIFFSTAT"
    else
        GIT=" $BRANCH"
    fi
fi

case "$(uname -s)" in
    Darwin)
        BATT=$(pmset -g batt 2>/dev/null)
        BAT=$(printf '%s' "$BATT" | grep -o '[0-9]*%' | head -1)
        if [ -n "$BAT" ] && printf '%s' "$BATT" | grep -q 'AC Power'; then
            BAT="⚡$BAT"
        fi
        ;;
    Linux)
        for _b in /sys/class/power_supply/BAT*; do
            [ -r "$_b/capacity" ] || continue
            BAT="$(cat "$_b/capacity")%"
            [ "$(cat "$_b/status" 2>/dev/null)" = "Charging" ] && BAT="⚡$BAT"
            break
        done
        ;;
esac

OUT=$(basename "$PANE_PATH")
[ -n "$GIT" ] && OUT="$OUT  $GIT"
[ -n "$BAT" ] && OUT="$OUT  $BAT"
echo "$OUT"
