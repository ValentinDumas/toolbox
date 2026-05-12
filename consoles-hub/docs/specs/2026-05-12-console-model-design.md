# Console model — design spec

**Project:** consoles-hub
**Status:** draft v1
**Date:** 2026-05-12
**Companion projects:** [`ping-me`](../../../ping-me) (push notification path)

---

## 1. Context

`consoles-hub` is a personal "mission control" that lets the user manage
running terminal consoles from their iOS phone, from anywhere on the internet.
The full system has several independent subsystems:

| Subsystem | Status |
|---|---|
| **Console model** (what a console *is*) | **this spec** |
| Mac-side agent (process model, JSON API) | future spec |
| Transport + auth (Tailscale, tokens) | future spec |
| Mobile UI (iOS native or PWA) | future spec |
| `ping-me` integration (notification reply path) | future spec |

This spec defines only the **console abstraction** — the data shape, the
operations on it, and how those operations map onto the underlying terminal
multiplexer. Everything else is intentionally deferred.

## 2. Out of scope

The following are explicitly **not** addressed here:

- Transport (HTTP/WebSocket/gRPC), auth, encryption, network exposure.
- The agent's process model (daemon vs on-demand, language, packaging).
- Mobile UI design.
- `ping-me` wiring beyond the abstract signal it provides.
- Console **creation, kill, rename**. Read + send-keys only in v1.
- Multi-host: a single Mac is assumed. Multiple machines is a future concern.

If a question doesn't touch the abstraction itself, it belongs to a later spec.

## 3. What is a console?

> **A console is one tmux pane.**

A pane is the right grain because:

- It is the unit the user already works in. Sessions are too coarse, processes
  too fine.
- tmux gives us persistence, scrollback, attach/detach, and input replay for
  free.
- Anything you can run in a terminal (Claude Code, vim, builds, REPLs) runs in
  a pane with no per-tool integration.

There is no opt-in or registry. **Every pane in every session** is a console.
Filtering and grouping happen in the mobile UI, not in the agent.

## 4. Identity

| Concept | Value | Source |
|---|---|---|
| **Canonical key** | tmux `%pane_id` (e.g. `%23`) | `#{pane_id}` |
| **Display label** | `session:window.pane` (e.g. `dev:0.1`) | `#{session_name}:#{window_index}.#{pane_index}` |

`%pane_id` is stable for the life of the pane and survives renames /
reorderings. The display label is derived for humans and may change without
the identity changing.

A pane's death (kill, server restart) ends the identity. No resurrection.

## 5. Console record

The agent exposes each console as a JSON object:

```json
{
  "id": "%23",
  "label": "dev:0.1",
  "cwd": "/Users/v/Projects/toolbox/invoice-manager",
  "cmd": "claude",
  "last_activity": "2026-05-12T10:21:03Z",
  "waiting_for_input": true
}
```

Field contracts:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Canonical key. Opaque to the client. |
| `label` | string | yes | Human-readable; never used as a key. |
| `cwd` | string \| null | yes | May be null if tmux can't resolve it. |
| `cmd` | string \| null | yes | The foreground command, e.g. `claude`, `vim`, `zsh`. |
| `last_activity` | RFC 3339 timestamp | yes | UTC. |
| `waiting_for_input` | boolean | yes | See §7. |

No other fields are exposed in v1. Adding fields is backward-compatible;
removing or renaming is not.

## 6. Discovery

Discovery is a single tmux command:

```sh
tmux list-panes -a -F '#{pane_id}|#{session_name}:#{window_index}.#{pane_index}|#{pane_current_path}|#{pane_current_command}|#{pane_activity}'
```

| Output column | Maps to | Notes |
|---|---|---|
| `#{pane_id}` | `id` | |
| `#{session_name}:#{window_index}.#{pane_index}` | `label` | |
| `#{pane_current_path}` | `cwd` | Empty string → `null`. |
| `#{pane_current_command}` | `cmd` | Empty string → `null`. |
| `#{pane_activity}` | `last_activity` | tmux returns a Unix timestamp; agent converts to RFC 3339 UTC. |

The agent re-runs `list-panes` on a short interval (suggested: 2 s) and on
tmux's built-in hooks (`session-created`, `window-linked`, `pane-died`,
`pane-set-clock`) when available. The exact cadence is the agent spec's
concern; the contract here is only that the record reflects tmux truth.

## 7. `waiting_for_input` semantics

`waiting_for_input` is the only interpreted field. Its rule:

> **It is `true` from the moment a `ping-me --hook` signal fires for the pane,
> and becomes `false` the next time the pane produces output.**

No prompt-pattern heuristic, no idle-time threshold. The signal is honest:
something explicitly asked for the user's attention.

### How the agent knows

- **Setting it true** — `ping-me --hook` is invoked from the pane (e.g. Claude
  Code's Stop hook running inside that pane). The hook writes
  `{pane_id, timestamp}` to a small state file the agent watches. Resolving
  "which pane invoked me" is the hook's responsibility: it reads
  `$TMUX_PANE` (tmux sets this in every shell child) and forwards it.
- **Clearing it false** — the agent polls `#{pane_activity}` (or hashes
  `capture-pane -p` output) and clears the flag when the value changes after
  the trigger timestamp.

Panes that never receive a ping-me signal stay `false` forever. That is the
intended behavior in v1.

## 8. Reading a console

Two read operations, both backed by `tmux capture-pane`:

| Operation | tmux call | Purpose |
|---|---|---|
| **Visible buffer** | `tmux capture-pane -p -t <id>` | What's on screen right now. |
| **Scrollback** | `tmux capture-pane -p -S -1000 -t <id>` | Up to 1000 lines of history. |

Both return UTF-8 plain text. ANSI styling is **stripped** by default
(`capture-pane` without `-e`); a future version may add a `?ansi=1` flag
once the mobile UI knows what to do with it.

The agent does not maintain its own buffer or diff stream in v1. The mobile
UI polls or streams via mechanisms defined in the transport spec.

## 9. Writing to a console

One write operation:

```
send_keys(pane_id: string, text: string, enter: bool) -> ok | error
```

Backed by `tmux send-keys -t <pane_id> -- <text>` followed optionally by
`tmux send-keys -t <pane_id> Enter`.

Notes:

- `text` is a single UTF-8 string. Multi-key sequences (Ctrl-C, arrows) are
  encoded as their tmux key names (e.g. `"C-c"`, `"Up"`) and the agent uses
  the `-l`/literal flag accordingly. Exact encoding rules belong to the
  agent API spec.
- The `enter` flag is separate so the phone UI can decide based on context
  (chat-like "send" vs raw typing).
- No batching, no scripting. One call per logical action.

## 10. Lifecycle

The only mutations in v1 are `send_keys`. Pane creation, killing, renaming,
and window/session management are **out of scope**. Users do those on the
Mac as today.

This is a deliberate restriction: every additional verb is a vector for
fat-fingered loss on a phone. We add them when there's a real need and a
sane UI for confirmation.

## 11. Open questions

None blocking v1. Items to revisit in later specs:

- Whether `cmd` should fall back to a shallower heuristic (e.g. show
  `claude` instead of `node` when Claude is running under node).
- Whether to expose tmux client info (attached/detached).
- Whether multiple Macs warrant a `host` prefix on `id`.

## 12. Glossary

- **tmux server** — long-lived process on the Mac that owns sessions and panes.
- **session** — a named group of windows.
- **window** — a named group of panes within a session (like a browser tab).
- **pane** — one terminal split inside a window. **Our "console".**
- **`%pane_id`** — tmux's stable, opaque ID for a pane (e.g. `%23`).
- **`$TMUX_PANE`** — environment variable tmux sets in every shell child,
  containing that shell's `%pane_id`. Used by `ping-me` hooks to identify
  themselves.
