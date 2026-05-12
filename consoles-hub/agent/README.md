# consoles-hub agent

HTTP API over tmux, bound to **loopback + tailnet only**, gated by a
bearer token. Implements `docs/specs/2026-05-12-agent-transport-design.md` §8
minus the WebSocket stream.

## Build & run

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
rm ~/.config/consoles-hub/token
# restart the agent — it regenerates a fresh 256-bit token
```

A first-class `install.sh --rotate-token` is a later slice.

## Known v0 limits

- `send` text is **literal UTF-8 only** (`tmux send-keys -l`). Named keys
  (`C-c`, `Up`, `Escape`) are not interpreted — coming in v1.
- `waiting_for_input` is always `false`. Wiring to `ping-me --hook` is its
  own spec slice.
- No WebSocket stream yet; only HTTP poll for buffer.
