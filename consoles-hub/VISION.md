# VISION

## Goal

Give a single developer the ability to drive every long-running terminal session on their Mac — builds, REPLs, agents, watchers, SSH tunnels — from their iPhone over their own private Tailscale network, with the same fidelity as sitting in front of the laptop.

The single success metric: from the iPhone, the user can list their tmux-backed consoles, attach to any one of them, read its scrollback, send input, and get notified when a console is **waiting for input** — without ever exposing a port to the public internet and without trusting a third-party relay.

---

## Why

A developer's laptop is the trust anchor of their work: it holds SSH keys, cloud credentials, signed commits, project source, and live agent sessions. Existing "remote terminal" products solve mobility at the cost of:

- Relaying terminal I/O through a vendor's servers (keystrokes, output, secrets in transit)
- Requiring an account, a subscription, and a vendor lock-in for what is fundamentally a thin shim over `tmux`
- Opening an inbound port or a cloud tunnel that anyone on the internet can probe
- Bundling proprietary agents whose code the user cannot audit

`consoles-hub` exists because **a developer should be able to reach their own machine from their own phone without renting a third party's trust**. The agent is small, written in Go, runs entirely on the user's Mac, and is only reachable from devices the user has explicitly admitted to their tailnet.

---

## How

**Tailnet-only by construction.** The agent binds to `127.0.0.1` and the tailnet IP only — never `0.0.0.0`. There is no public listener, no STUN/TURN relay, no reverse proxy in the default configuration. If Tailscale is down, the agent is unreachable; that is the correct failure mode.

**tmux as single source of truth.** Console state lives in `tmux` panes, not in a sidecar database. The agent is a thin RPC layer over `tmux` commands; killing the agent loses no work, restarting it re-attaches to live panes.

**Bearer token over Tailscale ACL.** Two independent gates: the tailnet ACL decides *which device* can reach the agent, the bearer token decides *which client* is authorized. Either alone is insufficient.

**Push, not poll.** The phone never polls the agent for `waiting_for_input`. The agent emits a notification via `ping-me` (ntfy.sh) when a pane goes idle waiting for human input. The phone wakes, the user answers, the session continues.

**Go + stdlib first.** The agent is one binary, no runtime dependencies, no plugin system, no embedded scripting. A reader can clone the repo and audit the entire trust boundary in an afternoon.

**Specs before code.** Every subsystem has a dated design doc in `docs/specs/` that is updated *before* the code changes, not after.

---

## What

A Go agent on the Mac plus a thin iOS client, sharing one HTTP/WebSocket protocol over Tailscale.

| Surface | Entry | Purpose |
|---|---|---|
| Mac-side agent | `cmd/agent` (Go) | Exposes `tmux` panes over HTTP/WS, bound to loopback + tailnet only |
| iOS client | (future, SwiftUI) | List, attach, read, send-input, receive push notifications |
| Push notifier | `ping-me/` | Bash + `ntfy.sh` bridge that fires the `waiting_for_input` signal |
| Install / token bootstrap | `install.sh` | Generates the bearer token, writes the launchd plist, configures Tailscale binding |

The protocol is documented in `docs/specs/2026-05-12-agent-transport-design.md`; the console model in `docs/specs/2026-05-12-console-model-design.md`.

---

## Security — non-negotiable, end-to-end

Security is **not a phase** of this project. It is a constraint that shapes every decision from the first sketch to the last test. The threat model assumes: the user's laptop can be stolen, Tailscale ACLs can be misconfigured, a dependency can be malicious, the iPhone can be lost, the bearer token can leak in a screenshot. The codebase must remain safe under each of those assumptions.

### 1. Idea / planning phase

Before any new feature is sketched, ask:

- **Does it introduce a new trust boundary?** (new network listener, new device class, new outbound call, new dependency)
- **Does it expand the agent's authority over the Mac?** Any new shell escape, file write outside the agent's working dir, or process-spawning surface must be justified in writing and reviewed twice.
- **Does it open a path outside the tailnet?** If yes: it must be off by default, gated behind an explicit `--public` flag in `install.sh`, and documented in `README.md > Sécurité`. The default install must never bind `0.0.0.0`.
- **Does it weaken the bearer-token requirement?** Token is mandatory on every mutating call. "Convenience" exemptions (CLI, local dashboard, dev mode) are not accepted.
- **Does it require a new external dependency?** Justify it. Prefer Go stdlib. Pin the module version with a hash. Read the source if it touches I/O, parsing, or process spawning.

A feature that fails any of the above does not enter `writing-plans` — it goes back to brainstorming.

### 2. Design phase

- **Least privilege per layer.** The agent runs as the user, never as root. It cannot `sudo`, cannot write outside its config dir, cannot spawn arbitrary binaries — only the `tmux` paths declared in the spec.
- **No secrets in code, no secrets in git.** The bearer token lives in `~/.config/consoles-hub/token` with `0600` permissions. `.env.example` documents required variables; the real token file never lands in the repo.
- **Bind discipline.** The agent binds to `127.0.0.1` and the resolved tailnet IP only. Binding to `0.0.0.0` is a bug, not a configuration option.
- **Auth on every mutating route.** `Authorization: Bearer <token>` is checked before any action. WebSocket upgrades verify the token at handshake; tokens are not accepted in query strings (they end up in logs).
- **No shell interpolation.** All `tmux` and OS calls go through `exec.Command([...])` with list args. Pane IDs, session names, and user input are passed as discrete arguments, never spliced into a shell string.
- **Input validation at the boundary.** HTTP payloads are decoded into typed Go structs before any business logic runs. Invalid input returns a structured domain error, never a raw stack trace or Go panic dump.
- **CSRF / origin checks.** Even though the dashboard is local, mutating routes require POST/PATCH/DELETE and check the `Origin` header against the tailnet host list.

### 3. Implementation phase

- **`exec.Command` with list args only.** Never `sh -c`, never `fmt.Sprintf` into a command line. Pane IDs and user-supplied strings are arguments, not template substitutions.
- **Path resolution via `filepath.Clean` + prefix check.** Any path the agent reads or writes is resolved and verified to live under the agreed config dir. Symlinks that escape are rejected.
- **File-type and size limits on every upload-shaped surface.** If a future feature accepts a blob (config import, scrollback dump replay), it caps size, checks magic bytes, and refuses anything that smells executable.
- **No `eval`-equivalent on user input.** The agent never feeds incoming bytes into a templating engine, a Lua/JS runtime, or `tmux` commands that interpret keystrokes as commands without explicit user confirmation.
- **Token comparison via `subtle.ConstantTimeCompare`.** Bearer-token checks never short-circuit on the first mismatched byte.
- **Structured logs, no secrets.** Token values, full request bodies, and pane contents are never logged. The agent logs the request method, path, pane ID, and outcome — nothing more.
- **WebSocket frame limits.** Inbound frames are size-capped to prevent an attacker on the tailnet from OOM-ing the agent with a single huge message.
- **Soft-stop, not kill -9.** The agent's "close console" path detaches the tmux client; it never destroys a pane unless the user explicitly confirms. tmux state is the source of truth and must survive an agent restart.
- **Outbound calls (push notifications) are opt-in** and clearly labeled in `install.sh`. When active, every outbound URL is logged so the user can audit egress.

### 4. Verification / testing phase

- **Unit tests** assert the protocol rules — auth required on mutating routes, list args for every `exec`, structured errors on bad input.
- **Bind tests** confirm the agent never listens on `0.0.0.0` in default mode and refuses to start if the tailnet IP cannot be resolved.
- **Auth tests** cover: missing header, malformed header, wrong token, expired token, token-in-query-string (must be rejected).
- **Injection tests** for every route that takes a pane ID, session name, or input payload — quotes, semicolons, backticks, newlines, NUL bytes.
- **`/security-check` and `/security-review` skills** are run before any branch is merged. The OWASP Top 10 is the minimum bar; the LLM Top 10 applies if/when an AI-driven console is added.
- **Dependency review.** Before adding a Go module, check maintenance, license, and supply-chain signals (stars, last release, open CVEs, `govulncheck`). Prefer modules already in `go.mod`.
- **Manual review checklist** before merging any agent-touching code:
  - [ ] No new public listener (or one explicitly opt-in, off by default, documented)
  - [ ] No new shell-string command construction
  - [ ] All routes covered by an auth test
  - [ ] All paths sandboxed to the config dir
  - [ ] All outbound network calls logged
  - [ ] No secrets, no fixtures with real tokens or tailnet IPs in git history

### 5. Operational hygiene (delivered to the user via README)

- FileVault on the host disk → at-rest encryption for the token file and tmux scrollback
- Tailscale ACLs reviewed at install time → only the user's own devices reach the agent
- `git status` discipline → token files, launchd plists with secrets, and local config must never appear in commits
- Rotate the bearer token after lending the laptop, losing a phone, or any suspected leak — `install.sh --rotate-token` regenerates it
- Keep `ping-me` topic names unguessable; ntfy.sh is a public relay and topic names are the only access control

---

## Non-goals

- Multi-user collaboration, SSO, shared sessions — out of scope. This is a single-user, single-machine tool.
- A public-internet listener, a cloud relay, or a "share link" feature — explicitly refused. If you need that, you need a different product.
- Replacing tmux as the session manager — the agent is a thin layer over tmux, not a competing protocol.
- A general-purpose remote-shell product — the agent only speaks to the documented iOS client and CLI.
