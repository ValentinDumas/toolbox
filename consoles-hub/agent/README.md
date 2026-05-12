# consoles-hub agent — v0 slice

Localhost-only HTTP API over tmux. No auth, no WS, no Tailscale yet.
Implements `docs/specs/2026-05-12-agent-transport-design.md` §8 minus auth and
the `waiting_for_input` field.

## Build & run

```sh
cd agent
go build ./...
./agent                       # binds 127.0.0.1:7820
./agent -addr 127.0.0.1:9000  # custom port
```

## Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET`  | `/healthz` | reports tmux reachability |
| `GET`  | `/consoles` | list every pane |
| `GET`  | `/consoles/{id}` | one pane (`{id}` is URL-encoded `%pane_id`, e.g. `%2523`) |
| `GET`  | `/consoles/{id}/buffer?scrollback=N` | `N` clamped to 5000 |
| `POST` | `/consoles/{id}/send` | body: `{"text":"…","enter":true}` |

## Curl smoke

```sh
curl -s localhost:7820/healthz
curl -s localhost:7820/consoles | jq .
curl -s 'localhost:7820/consoles/%2523/buffer?scrollback=100' | jq -r .text
curl -s -XPOST localhost:7820/consoles/%2523/send \
  -H 'content-type: application/json' \
  -d '{"text":"echo hi","enter":true}'
```

## Known v0 limits

- `send` text is **literal UTF-8 only** (`tmux send-keys -l`). Named keys
  (`C-c`, `Up`, `Escape`) are not interpreted — coming in v1.
- `waiting_for_input` is always `false`. Wiring to `ping-me --hook` is its
  own spec slice.
- No auth. Anyone with loopback access can drive your tmux. Single-user Mac
  assumption holds for v0.
