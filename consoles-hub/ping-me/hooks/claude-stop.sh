#!/usr/bin/env bash
# Claude Code Stop hook — forwards to ping-me for iOS push.
exec "${PING_ME_BIN:-$HOME/.local/bin/ping-me}" --hook
