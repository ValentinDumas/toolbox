# consoles-hub iOS app (mobile/)

SwiftUI client for the consoles-hub agent. Slices A and B of v1 — Setup,
sectioned Pane list, and a live WebSocket-backed detail view with text
input. Named-key row + biometric gate + settings polish (slice C) and
icon / TestFlight prep (slice D) come later.

See [`docs/specs/2026-05-12-mobile-ui-design.md`](../docs/specs/2026-05-12-mobile-ui-design.md)
for the full design.

## Build

Requires Xcode 15+ and [xcodegen](https://github.com/yonaskolb/XcodeGen).

```sh
brew install xcodegen     # one-time
cd mobile
xcodegen                  # regenerates ConsolesHub.xcodeproj
open ConsolesHub.xcodeproj
```

`*.xcodeproj` is gitignored — always regenerate from `project.yml`.

## First-run flow

1. Launch on simulator (or device once signing is configured).
2. Paste the tailnet host (`mac.tail-xxxx.ts.net`) and the bearer token
   (`cat ~/.config/consoles-hub/token` on the Mac, ⇧⌘C, paste).
3. Validate → app probes `/healthz` (no auth) then `/consoles` (bearer).
4. On success the token lands in Keychain with
   `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` (never iCloud, never
   readable while locked) and the host in `UserDefaults`.

## Project layout

```
mobile/
├── project.yml               # xcodegen source of truth
├── ConsolesHub/
│   ├── Info.plist            # ATS exception for *.ts.net only
│   ├── Assets.xcassets/      # placeholder app icon + accent
│   └── Sources/
│       ├── ConsolesHubApp.swift
│       ├── State/AppState.swift
│       ├── Models/{Pane,APIError,StreamMessage}.swift
│       ├── Services/{Keychain,AgentClient,PaneStream}.swift
│       └── Views/{Root,Setup,PaneList,PaneRow,PaneDetail,ErrorBanner}.swift
└── README.md (this file)
```

## Live stream (slice B)

Tap a pane in the list to open the detail view. A single
`URLSessionWebSocketTask` opens against `GET /consoles/{id}/stream` with
the bearer token on the upgrade request, decodes `snapshot` frames into
the buffer and appends `delta` frames as they arrive.

- **Input:** type a command, press Return on the on-screen keyboard, the
  frame goes out as `{"type":"send","text":"<line>","enter":true}` and
  the field clears.
- **Raw send:** long-press the paperplane button to fire one frame with
  `"enter": false` — useful for a `y` confirmation that mustn't carry a
  newline.
- **Scroll:** the buffer pins to the bottom on new content. Scrolling up
  freezes auto-scroll and reveals a "jump to bottom" pill; tap to resume.
- **Reconnect:** on a dropped socket the view tries again after `1 s`,
  `3 s`, then `7 s`. After three failures it stops and shows
  `Disconnected — Retry` inline. Backgrounding the app closes the socket;
  foregrounding reopens it with a fresh attempt counter.
- **Terminal errors:** `401`, `404`, agent `1011`, `1008 policy_violation`
  do not retry — the view surfaces the spec §9 copy and waits for Retry.

What slice B intentionally does **not** ship: the named-key row (Enter /
Tab / Esc / Ctrl-C / arrows) lands in slice C, alongside the biometric
gate and the token-rotation flow.

## Testing

There is no XCTest target yet — the verification path is the simulator.
Build for the booted iPhone simulator and exercise the spec §5.3 / §6 / §7
flows by hand (tap a pane, run a command on the Mac, send input from the
phone, watch the reconnect behavior when the agent is stopped).

## Notes

- **ATS:** only `*.ts.net` and link-local are allowed over insecure HTTP.
  Raw Tailscale IPs (`100.x.y.z`) won't work — use the MagicDNS name.
- **Distribution:** TestFlight internal track (paid Apple Developer
  Program). Free-Apple-ID sideload is documented in the spec and
  intentionally not used.
