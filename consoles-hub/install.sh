#!/usr/bin/env bash
# consoles-hub installer — launchd user agent, never root, never sudo.
# Subcommands: install (default) | uninstall | rotate-token | status
set -euo pipefail

# --- paths (all under $HOME — no /usr/local, no sudo) -----------------------
LABEL="com.vdumas.consoles-hub.agent"
APP_DIR="${HOME}/Library/Application Support/consoles-hub"
BIN="${APP_DIR}/bin/consoles-hub-agent"
LOG_DIR="${HOME}/Library/Logs/consoles-hub"
LOG_OUT="${LOG_DIR}/agent.out.log"
LOG_ERR="${LOG_DIR}/agent.err.log"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
TOKEN_FILE="${HOME}/.config/consoles-hub/token"

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
AGENT_SRC="${REPO_ROOT}/agent"
PLIST_TMPL="${REPO_ROOT}/${LABEL}.plist.tmpl"

# --- helpers ---------------------------------------------------------------
say()  { printf '\033[1m==>\033[0m %s\n' "$*"; }
die()  { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }

domain_target() { echo "gui/$(id -u)/${LABEL}"; }

probe_health() {
    local port="$1"
    for _ in $(seq 1 20); do
        if curl -sf -o /dev/null "http://127.0.0.1:${port}/healthz"; then
            return 0
        fi
        sleep 0.5
    done
    return 1
}

# --- install ---------------------------------------------------------------
do_install() {
    local port="7820"
    local local_only=0
    while [ $# -gt 0 ]; do
        case "$1" in
            --port)
                shift
                [[ "${1:-}" =~ ^[0-9]+$ ]] || die "port must be an integer (got: ${1:-<empty>})"
                port="$1"
                ;;
            --local-only) local_only=1 ;;
            *) die "unknown flag: $1" ;;
        esac
        shift
    done

    command -v go >/dev/null || die "go not found in PATH — install Go first (https://go.dev/dl/)"
    [ -f "$PLIST_TMPL" ] || die "plist template missing: $PLIST_TMPL"

    say "building agent"
    mkdir -p "$(dirname "$BIN")"
    chmod 700 "$APP_DIR"
    (cd "$AGENT_SRC" && go build -o "$BIN" .)

    say "preparing log dir"
    mkdir -p "$LOG_DIR"
    chmod 700 "$LOG_DIR"

    say "rendering plist → $PLIST"
    mkdir -p "$(dirname "$PLIST")"
    local extra_args=""
    if [ "$local_only" -eq 1 ]; then
        extra_args=$'        <string>--local-only</string>'
    fi
    # Use awk to inject extra_args literally; sed for the simple scalars.
    awk -v extra="$extra_args" '{ gsub(/__EXTRA_ARGS__/, extra); print }' "$PLIST_TMPL" \
        | sed \
            -e "s|__BIN__|${BIN}|g" \
            -e "s|__PORT__|${port}|g" \
            -e "s|__LOG_OUT__|${LOG_OUT}|g" \
            -e "s|__LOG_ERR__|${LOG_ERR}|g" \
            -e "s|__HOME__|${HOME}|g" \
        > "$PLIST"
    chmod 600 "$PLIST"

    say "reloading launchd"
    launchctl bootout "$(domain_target)" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
    launchctl kickstart -k "$(domain_target)" >/dev/null 2>&1 || true

    say "probing /healthz on 127.0.0.1:${port}"
    if probe_health "$port"; then
        say "agent is up. token: ${TOKEN_FILE}"
        say "  test with: curl -H \"Authorization: Bearer \$(cat ${TOKEN_FILE})\" 127.0.0.1:${port}/consoles"
    else
        say "agent did not respond — check ${LOG_ERR}"
        exit 1
    fi
}

# --- uninstall -------------------------------------------------------------
do_uninstall() {
    say "stopping agent"
    launchctl bootout "$(domain_target)" 2>/dev/null || true
    say "removing plist, binary, logs (keeping token at ${TOKEN_FILE})"
    rm -f "$PLIST" "$BIN" "$LOG_OUT" "$LOG_ERR"
    rmdir "$(dirname "$BIN")" "$APP_DIR" "$LOG_DIR" 2>/dev/null || true
    say "done. To wipe the token too: rm ${TOKEN_FILE}"
}

# --- rotate-token ----------------------------------------------------------
do_rotate() {
    [ -f "$PLIST" ] || die "agent not installed — run ./install.sh install first"
    say "stopping agent"
    launchctl bootout "$(domain_target)" 2>/dev/null || true
    say "removing old token (agent will regenerate on next boot)"
    rm -f "$TOKEN_FILE"
    say "restarting"
    launchctl bootstrap "gui/$(id -u)" "$PLIST"

    # Pull port from plist for the probe.
    local port
    port="$(awk '/<key>ProgramArguments/,/<\/array>/' "$PLIST" \
        | grep -A1 -- '--port' | tail -1 | sed 's|.*<string>\(.*\)</string>.*|\1|')"
    if probe_health "${port:-7820}"; then
        say "rotated. new token at ${TOKEN_FILE}"
    else
        die "agent did not come back up — check ${LOG_ERR}"
    fi
}

# --- status ----------------------------------------------------------------
do_status() {
    local rc=0
    if [ -f "$PLIST" ]; then
        say "plist: $PLIST"
    else
        say "plist: MISSING"; rc=1
    fi
    if launchctl print "$(domain_target)" >/dev/null 2>&1; then
        say "launchctl: loaded"
        launchctl print "$(domain_target)" | grep -E '^\s*(state|pid|last exit code)' | sed 's/^/    /'
    else
        say "launchctl: not loaded"; rc=1
    fi
    local port
    port="$(awk '/<key>ProgramArguments/,/<\/array>/' "$PLIST" 2>/dev/null \
        | grep -A1 -- '--port' | tail -1 | sed 's|.*<string>\(.*\)</string>.*|\1|' || true)"
    port="${port:-7820}"
    if curl -sf "http://127.0.0.1:${port}/healthz" >/dev/null; then
        say "healthz: 200 on 127.0.0.1:${port}"
    else
        say "healthz: FAIL on 127.0.0.1:${port}"; rc=1
    fi
    if [ -f "$TOKEN_FILE" ]; then
        say "token: $(ls -la "$TOKEN_FILE")"
    else
        say "token: MISSING (${TOKEN_FILE})"
    fi
    if [ -f "$LOG_ERR" ]; then
        say "last 5 stderr lines:"
        tail -5 "$LOG_ERR" | sed 's/^/    /'
    fi
    exit $rc
}

# --- dispatch --------------------------------------------------------------
cmd="${1:-install}"
shift || true
case "$cmd" in
    install)      do_install "$@" ;;
    uninstall)    do_uninstall ;;
    rotate-token) do_rotate ;;
    status)       do_status ;;
    -h|--help|help)
        cat <<EOF
consoles-hub installer

Usage:
  ./install.sh                         install (default)
  ./install.sh install [--port N] [--local-only]
  ./install.sh uninstall               stop, remove plist+binary+logs (keep token)
  ./install.sh rotate-token            regenerate the bearer token
  ./install.sh status                  is it loaded? listening? token? log tail
EOF
        ;;
    *) die "unknown subcommand: $cmd (try ./install.sh help)" ;;
esac
