# consoles-hub iOS app (mobile/)

SwiftUI client for the consoles-hub agent. Slice A of v1 — Setup + sectioned
Pane list backed by the REST endpoints. WebSocket detail view (slice B),
named-key row + biometric gate + settings polish (slice C) come later.

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
│       ├── Models/{Pane,APIError}.swift
│       ├── Services/{Keychain,AgentClient}.swift
│       └── Views/{Root,Setup,PaneList,PaneRow,ErrorBanner}.swift
└── README.md (this file)
```

## Notes

- **ATS:** only `*.ts.net` and link-local are allowed over insecure HTTP.
  Raw Tailscale IPs (`100.x.y.z`) won't work — use the MagicDNS name.
- **Distribution:** TestFlight internal track (paid Apple Developer
  Program). Free-Apple-ID sideload is documented in the spec and
  intentionally not used.
