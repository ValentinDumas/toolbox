# consoles-hub agent

HTTP API over tmux, bound to **loopback + tailnet only**, gated by a
bearer token. Implements `docs/specs/2026-05-12-agent-transport-design.md` §8
minus the WebSocket stream.

## Install (supported)

From the repo root:

```sh
./install.sh                          # build + install launchd user agent, start it
./install.sh status                   # is it loaded? listening? token? log tail
./install.sh rotate-token             # regenerate the bearer token
./install.sh uninstall                # stop, remove binary+plist+logs (keep token)
./install.sh install --local-only     # loopback-only — offline dev, never ship
./install.sh install --port 9000      # custom port
```

The launchd plist lives at
`~/Library/LaunchAgents/com.vdumas.consoles-hub.agent.plist`; the binary at
`~/Library/Application Support/consoles-hub/bin/consoles-hub-agent`; logs at
`~/Library/Logs/consoles-hub/agent.{out,err}.log`. Never installed with
`sudo`; runs as the user.

## Dev build & run

```sh
cd agent
go build -o consoles-hub-agent .
./consoles-hub-agent                  # binds 127.0.0.1:7820 + <tailnet-ip>:7820
./consoles-hub-agent --port 9000      # custom port
./consoles-hub-agent --local-only     # loopback only — offline dev, never ship
```

On first run the agent generates a 256-bit token at
`~/.config/consoles-hub/token` with mode `0600`. The directory is `0700`.

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET`  | `/healthz` | — | reports tmux reachability (no secrets) |
| `GET`  | `/consoles` | bearer | list every pane |
| `GET`  | `/consoles/{id}` | bearer | one pane (`{id}` is URL-encoded `%pane_id`, e.g. `%2523`) |
| `GET`  | `/consoles/{id}/buffer?scrollback=N` | bearer | `N` clamped to 5000 |
| `POST` | `/consoles/{id}/send` | bearer | body: `{"text":"…","enter":true}` |
| `GET`  | `/consoles/{id}/stream` | bearer | WebSocket upgrade — live pane stream |

## Live stream

Connect to `ws://127.0.0.1:7820/consoles/<id>/stream` with
`Authorization: Bearer <token>`. The server pushes JSON text frames:

```json
{"type":"snapshot","text":"…","captured_at":"2026-05-12T12:50:00Z"}
{"type":"delta",   "text":"…","captured_at":"2026-05-12T12:50:00Z"}
```

A `snapshot` is sent on connect, then `delta` (suffix-only) or a fresh
`snapshot` (on clear/redraw) whenever `tmux capture-pane` changes. Cadence
is coalesced at 100 ms; idle panes emit nothing.

Clients can also type into the pane over the same socket:

```json
{"type":"send","text":"y","enter":true}
```

Inbound frame size is capped at 64 KiB. Origin allowlist is loopback plus
the resolved tailnet host (a browser at an unknown origin gets `403`).
Closing the socket has no side effect on the pane.

Smoke from CLI (`brew install websocat`):

```sh
TOKEN=$(cat ~/.config/consoles-hub/token)
websocat -t "ws://127.0.0.1:7820/consoles/%2523/stream" \
  -H "Authorization: Bearer $TOKEN"
```

## Curl smoke

```sh
TOKEN=$(cat ~/.config/consoles-hub/token)
curl -s 127.0.0.1:7820/healthz
curl -s -H "Authorization: Bearer $TOKEN" 127.0.0.1:7820/consoles | jq .
curl -s -H "Authorization: Bearer $TOKEN" \
  '127.0.0.1:7820/consoles/%2523/buffer?scrollback=100' | jq -r .text
curl -s -XPOST -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"text":"echo hi","enter":true}' \
  127.0.0.1:7820/consoles/%2523/send
```

## Security

- **Bind discipline.** The agent binds `127.0.0.1` and the IPv4 returned by
  `tailscale ip -4`. It refuses to start if Tailscale is missing, logged out,
  or resolves to a loopback/link-local/unspecified address. `--local-only`
  skips the tailnet bind for offline dev and **must not** be used on a
  shared/reachable machine.
- **Bearer token.** Required on every route except `/healthz`. Sent only in
  the `Authorization: Bearer …` header — tokens in `?token=…` query strings
  are rejected (400) because query strings end up in logs and shell history.
- **Constant-time compare.** Token comparison uses
  `crypto/subtle.ConstantTimeCompare`, with a constant-time length check.
- **File perms.** The agent refuses to read a token file with permissions
  wider than `0600`.
- **No shell interpolation.** Every `tmux` / `tailscale` call uses
  `exec.Command` with list args.
- **No token in logs.** Only the token file path is logged, never the value.

### Rotation

```sh
./install.sh rotate-token             # one-shot: stop, regenerate, restart
```

## Known v0 limits

- `send` text is **literal UTF-8 only** (`tmux send-keys -l`). Named keys
  (`C-c`, `Up`, `Escape`) are not interpreted — coming in v1.
- `waiting_for_input` is always `false`. Wiring to `ping-me --hook` is its
  own spec slice.
- No WebSocket stream yet; only HTTP poll for buffer.
