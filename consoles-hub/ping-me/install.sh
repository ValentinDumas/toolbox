#!/usr/bin/env bash
# install.sh — set up ping-me: config + symlink in ~/.local/bin.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_SRC="$HERE/bin/ping-me"
BIN_DST="$HOME/.local/bin/ping-me"
CONFIG_DIR="$HOME/.config/ping-me"
CONFIG="$CONFIG_DIR/config"

chmod +x "$HERE/bin/ping-me" "$HERE/hooks/claude-stop.sh"

mkdir -p "$HOME/.local/bin" "$CONFIG_DIR"

if [ -e "$BIN_DST" ] && [ ! -L "$BIN_DST" ]; then
  echo "Refusing to overwrite non-symlink $BIN_DST" >&2
  exit 1
fi
ln -sf "$BIN_SRC" "$BIN_DST"
echo "✓ symlinked $BIN_DST -> $BIN_SRC"

if [ ! -f "$CONFIG" ]; then
  cp "$HERE/config.example" "$CONFIG"
  # generate a long unguessable topic
  TOPIC="ping-me-$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 32)"
  # portable in-place edit (BSD + GNU sed)
  sed -i.bak "s|^NTFY_TOPIC=.*|NTFY_TOPIC=\"$TOPIC\"|" "$CONFIG"
  rm -f "$CONFIG.bak"
  echo "✓ created $CONFIG"
  echo
  echo "Subscribe on iOS:"
  echo "  1. Install 'ntfy' from the App Store."
  echo "  2. Add subscription, topic: $TOPIC"
  echo "  3. Server: https://ntfy.sh (default)"
  echo
  echo "Test:  ping-me \"hello from your mac\""
else
  echo "✓ config already exists at $CONFIG (left untouched)"
fi

case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) echo "⚠  $HOME/.local/bin is not on PATH. Add it to your shell rc." >&2 ;;
esac
