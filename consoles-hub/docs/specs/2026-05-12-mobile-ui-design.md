# Mobile UI — design spec

**Project:** consoles-hub
**Status:** draft v1
**Date:** 2026-05-12
**Companion specs:**
- [`2026-05-12-console-model-design.md`](2026-05-12-console-model-design.md)
- [`2026-05-12-agent-transport-design.md`](2026-05-12-agent-transport-design.md)

---

## 1. Context

`consoles-hub` lets the user drive every long-running tmux pane on their
Mac from their iPhone over Tailscale. The two server-side specs define
*what* is exposed (`Pane` record, REST + WebSocket endpoints, bearer
auth, signal-channel `waiting_for_input`). This spec defines the **client
that consumes them**.

Why a phone-first client at all: the user already lives on their laptop
when they're in front of it. The value of `consoles-hub` is reaching the
laptop **from elsewhere** — bus, kitchen, bed, doctor's waiting room.
Anything that doesn't fit one-handed on a phone misses the point.

Why iOS first: it's the user's only target device. Android, watchOS,
iPadOS-specific work are explicitly out of scope (§13).

Why **native SwiftUI** (not a PWA, not React Native, not Capacitor):
- VISION names SwiftUI: locked in.
- Keychain + biometric gating are first-class on iOS via system APIs
  (`Security.framework`, `LocalAuthentication`). A PWA cannot hold a
  token at rest with comparable safety; the user's "lost phone"
  scenario relies on the iOS lockscreen as a trust gate.
- `URLSessionWebSocketTask` exists in stdlib. No third-party WS layer
  needed for v1 — same "stdlib first" rule that VISION imposes on the
  Go agent.
- A native app gets background-refresh and proper foreground lifecycle
  hooks. A PWA on iOS would silently drop the socket on app switch.

The client is **single-user, single-machine** (§4) — same scope as the
agent. Anything that implies multi-user or multi-Mac is rejected here
before it leaks into code (§13).

---

## 2. Trust model

The threat model inherits from VISION §Security; the client carries its
share of the burden because it holds the only piece of data Tailscale
ACLs cannot protect against: the bearer token.

| Threat | Mitigation in the client |
|---|---|
| Phone lost or stolen | Token stored in Keychain with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`. Token is unreadable while device is locked and never syncs to iCloud Keychain. Optional biometric (FaceID/TouchID) gate on app foreground (§3). |
| Screenshot of the app | Token is **never** rendered in plaintext after first save. Setup view masks input by default. iOS screen-recording overlay cannot expose what was never on screen. |
| Screen recording in background | Pane buffers are session-only and held in memory (§10); on app background we close the socket and clear the in-memory buffer for the last-viewed pane after a short grace period. |
| Apple ID compromise (iCloud Keychain attacker) | Token is **device-only** in Keychain; iCloud Keychain compromise does not reach it. |
| Token leak via TestFlight feedback / crash log | Crash logs are scrubbed to never include the Keychain-stored token (covered by Apple platform automatically — `Security.framework`-managed items are never serialized into crash reports). The app must additionally **never** log the token to `os_log` / `print`. |
| Network observer (open Wi-Fi) | All traffic is WireGuard-encrypted by Tailscale; the app refuses to connect to anything that isn't the configured tailnet host (§4). No "convenience" fallback to a public host. |
| User shares device with someone briefly | Biometric gate on foreground (§3) blocks casual access. Tap-to-reveal scrollback is the only path to seeing buffer contents — sensitive content does not draw itself the moment the app opens. |

The client adds **no** new trust boundary the agent doesn't already
recognise. There is no cloud sync, no server-side state, no shared
account. If the user uninstalls the app, the token is gone with it.

---

## 3. Auth UX

### First launch

1. App opens to the **Setup view** (§5). Two fields:
   - **Tailnet host** — free text, default placeholder `mac.tail-xxxx.ts.net`. Saved in `UserDefaults` (non-secret).
   - **Bearer token** — secure-text-entry, paste-friendly. Saved in Keychain on success.
2. A **Validate** button issues `GET /healthz` against the host. If the
   call returns 200 the next call is `GET /consoles` with the pasted
   token. If both succeed → save → navigate to the Pane list. If
   either fails → show the matching offline/error state (§9). No data
   is ever saved on failure.
3. After save, the token is **never displayed again** by the app. The
   Settings view (§5) offers "Rotate token" which re-opens the Setup
   view in token-only mode.

### Biometric gate

- On app foreground (cold or warm), `LocalAuthentication` requests
  FaceID/TouchID with reason "Unlock consoles-hub".
- Failure-modes: user cancels → app shows the Setup view's "Validate"
  step with the existing token kept in Keychain (no re-paste); five
  failed biometrics → fall back to device passcode; passcode failure
  → token wiped from Keychain (rare, deliberate; user re-pastes).
- The gate is **opt-in**, set in Settings, defaulted **on** at first
  successful Setup. Reasoning: with the gate off, a child grabbing the
  phone can drive the laptop. The default must be the safer one.

### Token rotation

- Settings → "Rotate token" → Setup view in token-only mode →
  validate → overwrite Keychain entry. Old token is overwritten in
  place; no plaintext copy is held anywhere.
- The agent's own rotation path (`./install.sh rotate-token`) is the
  authoritative source — the app never *generates* a token, only
  consumes one.

---

## 4. Connection model

### Single-agent v1

The app stores exactly one `(host, token)` pair. Multi-agent (one phone
driving panes on several Macs) is a deliberate v2 — it would require a
chooser screen, per-agent Keychain entries, and per-agent reconnection
state, none of which serve the daily-use path of a single-developer
single-laptop tool.

### Host resolution

Tailscale's MagicDNS gives the Mac a stable name like `mac.tail-xxxx.ts.net`.
The app prefers the user-typed hostname. IP addresses are accepted but
discouraged in the Setup copy ("Tailscale magic-DNS name preferred,
because IP can rotate.").

### Failure modes (handed to §9)

- **Tailnet unreachable** — phone off-Tailscale. Distinct copy from
  "agent down" because the user fix is "open Tailscale app".
- **Agent down** — Tailscale reaches the host but TCP refused.
- **Wrong token** — REST `401`.
- **Hostile origin** — should never happen from this client (it has
  no `Origin` header); if it does (proxy in the way) the app says so.
- **Stale port** — covered by "agent down" copy.
- **TLS issues** — N/A; agent is plain HTTP over Tailscale (§5 of
  transport spec).

### Connection lifecycle

- REST is request-scoped (`URLSession.shared`), 5-second timeout.
- WebSocket is per-detail-view (§6) — one socket per pane open.
- Backoff: `URLSession`'s native reconnect is not used; the app
  manages its own. After three consecutive failed reconnects → stop
  retrying, surface error state with manual retry. No silent infinite
  reconnect — that drains battery and hides bugs.

---

## 5. Information architecture

Four screens. No bottom-tab bar (the screens are a depth stack, not
parallel sections).

### 5.1 Setup view

- Used at first launch and from Settings.
- Two fields (host, token), one button (Validate).
- On success, navigate to the **Pane list view**.

### 5.2 Pane list view

- Top: a status bar showing `connected / disconnected / refreshing` and
  a manual refresh button.
- Body: three sections, in this order:
  1. **Waiting for you** — every pane where `waiting_for_input == true`.
     Distinct background tint, badge "needs you".
  2. **Active** — panes whose `last_activity` is within the last 60s
     (when the agent exposes it) **or** whose `cmd` is non-null and not
     a shell name (`zsh`/`bash`/`fish`).
  3. **Idle** — everything else.
- Each row: pane label (`session:window.pane`), `cmd ?? "(shell)"`,
  cwd folder name (the basename, not the full path — width is precious),
  and a relative-time hint when available.
- Pull-to-refresh issues `GET /consoles`. No auto-poll in this view —
  the network drain isn't worth it; the user explicitly refreshes or
  navigates into a pane to get live stream.
- Empty state (zero panes): "No tmux panes on your Mac. Start a tmux
  session and pull to refresh." (References the agent's `/healthz`
  state so the user knows the connection is healthy.)
- Tap a row → **Pane detail view**.

### 5.3 Pane detail view

- Top bar: pane label + a `back` button.
- Middle (most of the screen): the **buffer text** in a monospace,
  selectable, scrollable view. Auto-scrolls to bottom on new content;
  manual scroll up disables auto-scroll until the user taps "scroll to
  bottom".
- Below the buffer: the **input bar** — a one-line text field +
  "Send" button.
- Bottom: the **named-key row** — single-tap buttons for Enter, Tab,
  Esc, Ctrl-C, Up, Down, Left, Right. Each sends one frame
  (`{"type":"send","text":"…","enter":false}` with the appropriate
  encoded byte or escape sequence; `Enter` is the only one that maps
  to `{"text":"","enter":true}`).
- The WebSocket opens on appear, closes on disappear or background.

### 5.4 Settings view

- Tailnet host (read-only, with "Edit" → Setup in host-only mode).
- "Rotate token" (→ Setup in token-only mode).
- "Lock with FaceID" toggle (default on, §3).
- App version, build number.
- Link to the GitHub repo (read-only — the app does no in-app
  documentation; it points at the README that ships with the agent).

---

## 6. Streaming UX

- **One WebSocket per pane detail view.** Opens in `onAppear` of the
  detail view; closes in `onDisappear` and on
  `UIApplication.willResignActiveNotification`.
- Inbound frames are merged into the in-memory buffer:
  - `snapshot` → replace the buffer entirely.
  - `delta` → append to the buffer.
- The agent already coalesces at 100 ms (transport-design §9); the
  client renders every frame, no further throttling.
- Reconnection policy: on WS error or close before user-initiated
  disconnect, retry after `1s`, then `3s`, then `7s` (exponential-ish
  with jitter). After the third failure: stop, show "Disconnected —
  tap to retry" inline above the buffer. No silent retries beyond that.
- On foreground after background-close: reconnect immediately
  (counter resets); user expects "the moment I look at it again, it
  resumes".

---

## 7. Input UX

Two input surfaces feed the same `{"type":"send",…}` frame.

### Text field

- Behavior is **send-on-newline by default** — tapping the iOS Return
  key fires `{"text":"<typed-line>", "enter":true}` and clears the
  field. The user sees their command appear in the buffer on the next
  delta.
- A small "raw" toggle (long-press the Send button) flips into
  send-without-newline mode for one frame. Useful for typing `y` at a
  confirmation prompt without an extra Enter.
- The text field's content is **never** persisted; switching panes or
  backgrounding the app drops it.

### Named-key row

- Eight buttons: `↵` (Enter), `Tab`, `Esc`, `^C`, `↑`, `↓`, `←`, `→`.
- Each fires exactly one frame:
  - `↵` → `{"text":"","enter":true}`
  - `Tab` → `{"text":"\t","enter":false}`
  - `Esc` → `{"text":"","enter":false}`
  - `^C` → `{"text":"","enter":false}`
  - Arrows → `{"text":"[A"…"[D","enter":false}` (CSI sequences).
- v1 does not interpret these on the server side; the server already
  sends literal UTF-8 to `tmux send-keys -l`. The escape bytes go through
  as text and tmux interprets them as keypresses.

### No ANSI rendering in v1

The buffer is displayed as plain UTF-8 (ANSI escape codes are visible).
This is a deliberate scoping choice (§13) — getting cursor-positioning
and color escapes right on a small screen is a v2-level project. v1
just shows what the agent's `capture-pane -p` returns (which already
*lacks* SGR codes by default).

---

## 8. Notifications

The consoles-hub iOS app **does not implement push** in v1.

- Push is the `ntfy` iOS app's job (see `ping-me/README.md`). The
  notification fires from the ntfy server; the user sees it on their
  lockscreen via the ntfy app.
- The user then opens consoles-hub manually (or via a future
  deep-link, see §14 open question) and the **Waiting for you** section
  of the Pane list view shows the relevant pane.
- Reasoning: APNs requires Apple Developer membership, a server
  endpoint that holds device tokens, and a way to deliver push without
  the user's data leaving the tailnet — none of which match the
  "personal tool, no third-party trust" stance from VISION. ntfy.sh
  is already trusted enough for the ping-me path; we don't add a
  second push system.

If/when a deep-link is added, ntfy's "click action" can point at
`consoleshub://pane/<id>` — but that's a v1 nice-to-have, not a v1
commitment (§14).

---

## 9. Offline / error matrix

Every realistic failure has a named screen state. The implementation
phase reads from this table; it does not invent strings at compile
time.

| Source | Code | Title | Body copy | Actions |
|---|---|---|---|---|
| `URLError` | offline | "You're offline" | "consoles-hub needs Tailscale to reach your Mac." | Retry |
| `URLError` | timeout | "Mac is unreachable" | "We can reach Tailscale but not the agent on `<host>`. Is the Mac asleep?" | Retry / Settings |
| HTTP | 401 | "Token rejected" | "The Mac doesn't recognize this token. Rotate it on the Mac and paste the new one." | Rotate token |
| HTTP | 403 | "Origin blocked" | "The Mac refused this device's origin. Update the agent or open an issue." | (none) |
| HTTP | 404 (pane) | "Pane is gone" | "That pane closed on the Mac. Back to the list." | Back |
| API err | `tmux_unavailable` | "tmux is down" | "The agent is running but tmux isn't. Start tmux on the Mac." | Retry |
| WS close | `1008 policy_violation` | "Bad frame" | "The app sent the agent a frame it rejected. This is a bug — please file." | (none) |
| WS close | `1011 internal_error` | "Agent error" | "The agent hit an internal error. Try again." | Retry |
| WS close | `1006 abnormal` | "Disconnected" | "Lost the live connection." | Retry |

Copy is intentionally short and points at a concrete fix. No "Oops" or
"Something went wrong"; every message names the layer that broke.

---

## 10. State on device

| What | Where | Lifetime |
|---|---|---|
| Bearer token | Keychain (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`) | Until rotation or app uninstall |
| Tailnet host | `UserDefaults` | Same |
| "Last-viewed pane id" | `UserDefaults` | Optional convenience; helps "resume where I left off". Wiped on Settings → Reset. |
| "FaceID on foreground" toggle | `UserDefaults` | Default true |
| In-memory pane buffers | RAM | Session-only; dropped on app termination and on disappear of the detail view |
| Typed-but-not-sent input | RAM, view-scoped | Dropped on screen change |
| Notifications | (none — handled by ntfy app) | n/a |

The client persists **no** pane content. Scrollback is sensitive (may
contain shell history, paths, secrets) and not worth caching for the
UX win of "scrollback survives app relaunch". A user who wants
scrollback opens the pane and the live stream replays a snapshot in
under a second.

---

## 11. Accessibility

Same WCAG-AA bar the agent README's UI rules already impose on this
project.

- **VoiceOver** — every pane row has an accessibility label combining
  pane label, command, and the waiting state ("Pane 0.1, running build,
  waiting for you"). Named-key buttons announce themselves
  ("Send Control-C").
- **Dynamic Type** — buffer text respects the user's preferred body
  size (within a sensible monospace range; absurdly large sizes
  truncate gracefully). Single-line UI chrome (titles, badges) scales
  fully.
- **Contrast** — palette designed for ≥ 4.5:1 body / ≥ 3:1 chrome,
  light and dark. The "waiting" badge does not rely on color alone
  (icon + text).
- **Reduce motion** — no parallax, no slide-in animations beyond
  iOS's native navigation push. Auto-scroll on new buffer content
  respects `UIAccessibility.isReduceMotionEnabled` by jumping instantly
  rather than animating.
- **Keyboard** — the input field supports an external Bluetooth
  keyboard's Return key identically to the on-screen one; arrow keys
  on the external keyboard map to the same CSI sequences as the
  named-key row.

---

## 12. Build & ship

### Targets and tools

- SwiftUI app, single iOS target.
- Deployment target: **iOS 17.0** (Observable macro, native
  `URLSessionWebSocketTask` improvements, `.scrollPosition` modifier).
  Covers >95% of in-the-wild devices; cuts a layer of compat code.
- Build tool: Xcode 15 or later. No CocoaPods, no Carthage; Swift
  Package Manager only for any third-party dep (none anticipated in
  v1 — see §14 open question on Starscream).

### Distribution

The app ships **only** to the project author's device.

- Free Apple ID + 7-day sideload is technically possible but
  incompatible with even the most basic background lifecycle and any
  future push integration. Documented and **rejected** for v1.
- Paid Apple Developer Program (USD 99/yr) + TestFlight internal
  testing track. One-tester build, no App Store review, weekly rebuild
  of the build expiration. This is the v1 commitment.
- App Store submission is **not** a v1 commitment; the app is
  personal and may never be public.

### Bundle ID

Reserved as `com.vdumas.consoleshub` (matching the agent's launchd
label `com.vdumas.consoles-hub.agent`). Exact spelling locked at the
moment of Xcode project creation.

---

## 13. Out of scope (v1)

- Android client
- watchOS / iPadOS-specific layouts
- Scrollback search / regex search
- Multi-agent (one phone, multiple Macs)
- In-app theme customization (use system light/dark only)
- ANSI rendering (color, cursor positioning)
- "Share this pane" link to another user
- In-app QR code or NFC token transfer
- Direct APNs push integration (ntfy handles push)
- Cross-pane "send to all" command
- Configurable named-key set

These are deliberate v1 omissions, not oversights. Most map to a
known feature in the agent backlog (e.g. agent-side multi-user) that
isn't a v1 commitment either — the spec lists them so future-reader
can see they were considered.

---

## 14. Open questions

1. **Repo layout.** ~~Two options: `mobile/` subdir vs sibling
   `consoles-hub-ios` repo.~~ **Resolved (slice A, 2026-05-12):**
   `mobile/` subdir of `consoles-hub`. xcodegen reconstructs
   `*.xcodeproj` from `project.yml`, and the project file is gitignored
   so the Swift dir does not conflict with `go vet` or other Go-side
   tools. Single repo, single CI surface.

2. **WS library.** ~~`URLSessionWebSocketTask` (stdlib) versus
   `Starscream` (third party).~~ **Resolved (slice B, 2026-05-12):**
   stdlib `URLSessionWebSocketTask`. Reconnect + send + close-code
   mapping live in `Sources/Services/PaneStream.swift`. No third-party
   dep added. Revisit only if a real-world tailnet flap reveals a gap
   the stdlib doesn't cover.

3. **ntfy → deep-link.** Does the ntfy iOS app reliably fire
   "click actions" from a backgrounded notification, on iOS 17+, when
   the receiver app uses a custom URL scheme? Verify via a manual test
   before committing the §8 "nice to have" to a v1.5 milestone.

4. **TestFlight onboarding for a single user.** Apple's current
   internal-testers rules — does an internal-only build require
   metadata (screenshots, description) that a personal-use app
   doesn't realistically have? Confirm before paying the USD 99.

5. **Background fetch.** Should the app implement
   `BGAppRefreshTask` to pre-fetch the `waiting_for_input` list so
   the "Waiting for you" section is already populated on cold open?
   v1 says no (battery, complexity); revisit if cold-open latency
   feels bad on day-one usage.
