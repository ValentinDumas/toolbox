#!/usr/bin/env sh
# tmux-agnostic-setup — link this checkout into place on a fresh machine.
#
#   ./install.sh              install (idempotent)
#   ./install.sh --uninstall  remove the symlinks and the shell source line
set -e

REPO=$(cd "$(dirname "$0")" && pwd)
CONFIG_HOME=${XDG_CONFIG_HOME:-$HOME/.config}
TMUX_DIR="$CONFIG_HOME/tmux"
BIN_DIR="$HOME/.local/bin"
PLUGIN_DIR="$TMUX_DIR/plugins"
MARK_BEGIN="# >>> tmux-agnostic-setup >>>"
MARK_END="# <<< tmux-agnostic-setup <<<"

info() { printf '  %s\n' "$*"; }
die() { printf 'install.sh: %s\n' "$*" >&2; exit 1; }

# tmux.conf cannot expand $XDG_CONFIG_HOME, so its plugin path is written out in
# full. Refuse to install rather than leave a config pointing somewhere we did
# not populate — that exact mismatch is what disabled save/restore before.
[ "$CONFIG_HOME" = "$HOME/.config" ] || \
    die "XDG_CONFIG_HOME is $CONFIG_HOME; config/tmux.conf hardcodes ~/.config/tmux/plugins. Adjust both or unset it."

link() {
    src="$REPO/$1"
    dst="$2"
    [ -e "$src" ] || die "missing $src"
    mkdir -p "$(dirname "$dst")"
    if [ -L "$dst" ]; then
        [ "$(readlink "$dst")" = "$src" ] && { info "ok       $dst"; return 0; }
        rm "$dst"
    elif [ -e "$dst" ]; then
        mv "$dst" "$dst.bak"
        info "backup   $dst -> $dst.bak"
    fi
    ln -s "$src" "$dst"
    info "link     $dst"
}

unlink_ours() {
    dst="$1"
    if [ -L "$dst" ] && case "$(readlink "$dst")" in "$REPO"/*) true ;; *) false ;; esac; then
        rm "$dst"
        info "removed  $dst"
    fi
}

targets() {
    # <repo path>|<destination>
    cat <<'MAP'
config/tmux.conf|TMUX_DIR/tmux.conf
config/statusbar.sh|TMUX_DIR/statusbar.sh
shell/aliases.sh|TMUX_DIR/aliases.sh
bin/proj.sh|TMUX_DIR/proj.sh
bin/grid.sh|TMUX_DIR/layouts/grid.sh
projects|TMUX_DIR/projects
bin/proj.sh|BIN_DIR/proj
bin/grid.sh|BIN_DIR/g
MAP
}

expand_dst() {
    printf '%s\n' "$1" | sed -e "s#^TMUX_DIR#$TMUX_DIR#" -e "s#^BIN_DIR#$BIN_DIR#"
}

shell_rc() {
    case "$(basename "${SHELL:-/bin/sh}")" in
        zsh)  printf '%s\n' "$HOME/.zshrc" ;;
        bash) printf '%s\n' "$HOME/.bashrc" ;;
        *)    printf '' ;;
    esac
}

remove_block() {
    rc="$1"
    [ -f "$rc" ] || return 0
    grep -qF "$MARK_BEGIN" "$rc" || return 0
    tmp="$rc.tas.tmp"
    sed "/^${MARK_BEGIN}\$/,/^${MARK_END}\$/d" "$rc" > "$tmp" && mv "$tmp" "$rc"
    info "cleaned  $rc"
}

install_shell_block() {
    rc=$(shell_rc)
    if [ -z "$rc" ]; then
        info "skip     unknown shell — source $TMUX_DIR/aliases.sh yourself"
        return 0
    fi
    remove_block "$rc"
    {
        printf '%s\n' "$MARK_BEGIN"
        printf '%s\n' "[ -f \"$TMUX_DIR/aliases.sh\" ] && . \"$TMUX_DIR/aliases.sh\""
        printf '%s\n' "case \":\$PATH:\" in *\":$BIN_DIR:\"*) ;; *) PATH=\"$BIN_DIR:\$PATH\" ;; esac"
        printf '%s\n' "$MARK_END"
    } >> "$rc"
    info "sourced  $rc"
}

install_plugins() {
    mkdir -p "$PLUGIN_DIR"
    if [ ! -d "$PLUGIN_DIR/tpm" ]; then
        command -v git >/dev/null 2>&1 || die "git is required to fetch TPM"
        git clone -q https://github.com/tmux-plugins/tpm "$PLUGIN_DIR/tpm"
        info "cloned   $PLUGIN_DIR/tpm"
    fi
    "$PLUGIN_DIR/tpm/bin/install_plugins" >/dev/null 2>&1 || true
    if [ -x "$PLUGIN_DIR/tmux-resurrect/scripts/save.sh" ]; then
        info "plugins  tmux-resurrect ready"
    else
        info "plugins  tmux-resurrect NOT installed — open tmux and press prefix + I"
    fi
}

case "$1" in
    --uninstall)
        printf 'Uninstalling tmux-agnostic-setup\n'
        targets | while IFS='|' read -r _src dst; do
            unlink_ours "$(expand_dst "$dst")"
        done
        remove_block "$(shell_rc)"
        info "kept     $PLUGIN_DIR and ~/.local/share/tmux/resurrect"
        exit 0
        ;;
    "") ;;
    *) die "unknown argument: $1" ;;
esac

command -v tmux >/dev/null 2>&1 || die "tmux is not installed"

printf 'Installing tmux-agnostic-setup from %s\n' "$REPO"
targets | while IFS='|' read -r src dst; do
    link "$src" "$(expand_dst "$dst")"
done
install_shell_block
install_plugins

printf '\nDone. Reload your shell, then: tmux kill-server 2>/dev/null; proj grid\n'
