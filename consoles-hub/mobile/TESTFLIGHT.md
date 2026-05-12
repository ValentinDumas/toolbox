# TestFlight upload notes

End-to-end notes for putting the consoles-hub iOS app on the project
author's iPhone via TestFlight internal testing. The whole goal: get the
build off the simulator and onto a real device, without going through
App Store review.

This is a personal-use track. Public distribution is explicitly out of
scope (mobile-UI spec §12 / §13).

---

## 1. Pre-flight

- **Apple Developer Program enrollment** is required (USD 99/year).
  A free Apple ID + Personal Team can run the app on a connected
  device for 7 days, but cannot upload to TestFlight at all.
- The bundle ID `com.vdumas.consoleshub` was reserved during slice A
  via Personal Team. After enrollment, claim it in
  [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list)
  → Identifiers → "+" → App IDs → App → `com.vdumas.consoleshub` →
  no special capabilities needed (no Push, no iCloud, no Sign in
  with Apple — `LocalAuthentication` does not require a capability).
- Create the app shell in
  [App Store Connect](https://appstoreconnect.apple.com/) → My Apps
  → "+" → New App → Platform iOS → Name `consoles-hub` → Primary
  Language English (or French, both work) → Bundle ID picks the one
  above → SKU is free-form (e.g. `consoleshub-001`). Do NOT submit
  for review — we only need the record to exist so TestFlight can
  attach builds.

## 2. Signing & provisioning

- Open `mobile/ConsolesHub.xcodeproj` in Xcode.
- Target `ConsolesHub` → Signing & Capabilities → tick
  "Automatically manage signing" → Team → select the paid Apple
  Developer team (NOT the Personal Team).
- Xcode will fetch / create the development + distribution
  provisioning profiles on first archive. If it doesn't,
  [developer.apple.com](https://developer.apple.com/account/resources/profiles/list)
  is the recovery path.
- The first archive after enrolling may ask you to accept a new
  Program License Agreement at developer.apple.com before Xcode
  will sign anything.

## 3. Archive

From Xcode:

- Set the active scheme run destination to `Any iOS Device (arm64)`.
- Product → Archive. Xcode creates a `.xcarchive` under
  `~/Library/Developer/Xcode/Archives/<date>/`.

Or from the command line:

```bash
cd mobile
xcodegen
xcodebuild \
  -project ConsolesHub.xcodeproj \
  -scheme ConsolesHub \
  -configuration Release \
  -archivePath build/ConsolesHub.xcarchive \
  -destination 'generic/platform=iOS' \
  archive
```

**Before every archive**: bump `CURRENT_PROJECT_VERSION` in
`mobile/project.yml` (the build number), then re-run `xcodegen`.
App Store Connect rejects duplicate build numbers for the same
marketing version.

## 4. Upload

Xcode Organizer path (easiest):

- Window → Organizer → Archives → select the new archive.
- Distribute App → TestFlight & App Store → Next → defaults are
  fine → Upload.
- Apple's pipeline takes 5–15 min to "process" the build. While
  it's processing, the build is visible in App Store Connect →
  TestFlight tab → iOS Builds but greyed out.
- When processing finishes, you receive a "Build is ready to
  test" email (sometimes a "Missing compliance" prompt — answer
  No, we don't use restricted crypto beyond Apple-provided TLS).

`xcrun altool` path (scripted, slightly more setup):

```bash
# 1. Export the .ipa from the archive
xcodebuild -exportArchive \
  -archivePath build/ConsolesHub.xcarchive \
  -exportOptionsPlist mobile/ExportOptions.plist \
  -exportPath build/

# 2. Store an app-specific password from appleid.apple.com in Keychain once:
# xcrun altool --store-password-in-keychain-item AC_PASSWORD \
#   -u you@example.com -p <app-specific-password>

xcrun altool --upload-app \
  -f build/ConsolesHub.ipa \
  -t ios \
  -u you@example.com \
  -p @keychain:AC_PASSWORD
```

`mobile/ExportOptions.plist` is committed (slice E). Open it once
and replace `REPLACE_WITH_TEAM_ID` with the 10-character team ID
from developer.apple.com → Membership. The rest of the keys
(`method = app-store-connect`, `signingStyle = automatic`,
`uploadBitcode = false`, `uploadSymbols = true`) are correct as-is.

## 5. Internal testers

- App Store Connect → Apps → ConsolesHub → TestFlight tab →
  Internal Testing → "+" → enter the personal Apple ID (the
  account also enrolled in the dev program is automatic).
- Up to 100 internal testers, no Apple review required for
  internal-only builds.
- The tester receives a TestFlight invite email → installs the
  TestFlight iOS app → accepts → installs the build.
- Each build expires **90 days** after upload. Re-upload before
  the deadline if the build is still in active use.

## 6. Version cadence

- `MARKETING_VERSION` in `mobile/project.yml` is the user-facing
  semver (e.g. `0.1.0`). Bump on user-visible changes.
- `CURRENT_PROJECT_VERSION` is the build number, monotonic. Bump
  on every upload, even when the marketing version stays the same.
  App Store Connect rejects an upload if (marketing × build) has
  been used before.
- Re-archive + upload from a clean working tree (no uncommitted
  changes) so the commit hash in the build matches what's on
  `main`.

## 7. Troubleshooting

- **`ITMS-90165` Provisioning profile doesn't include …** —
  re-export the profile in Xcode (Preferences → Accounts →
  Download Manual Profiles), then re-archive.
- **`ITMS-90683` Missing Purpose String** — slice E added
  `NSFaceIDUsageDescription` to `Info.plist` via `project.yml`
  because LocalAuthentication actually *does* need it (the
  "auto-supplied by Xcode" claim was wrong). If you ever remove
  LocalAuthentication, drop the key too — the validator complains
  about unused privacy strings.
- **"Build expired"** — bump `CURRENT_PROJECT_VERSION`, archive,
  upload.
- **"Account not in Apple Developer Program"** — you're signed in
  with the wrong Apple ID in Xcode's Accounts preferences. The
  paid program account must be the active one for signing.
- **`xcodebuild: error: code signing identity not found`** —
  Xcode hasn't fetched the distribution cert yet. Open the
  project in Xcode UI once, let "Automatically manage signing"
  refresh, then retry the CLI archive.

---

## What slice D shipped towards TestFlight

- App icon (`Assets.xcassets/AppIcon.appiconset/AppIcon.png`) so
  the build doesn't ship the generic blue placeholder. Replace
  with a designed PNG when ready; no other code touches the icon
  path.
- VoiceOver labels on every interactive element + a buffer
  description so TestFlight reviewers (and the user themselves)
  can navigate with the screen reader.
- Dynamic Type capped at A11y3 in the monospace buffer per spec
  §11 "within a sensible monospace range".
- This document.

## What slice E shipped (TestFlight pre-flight)

- `NSFaceIDUsageDescription` added to `Info.plist` via
  `project.yml`. Required for LocalAuthentication-linked apps;
  ITMS-90683 otherwise.
- `ITSAppUsesNonExemptEncryption = false` added. We use Apple's
  TLS + LocalAuthentication + Keychain only, no custom crypto.
  This skips the export-compliance question on every upload.
- `mobile/ConsolesHub/PrivacyInfo.xcprivacy` declares the
  required-reason API we touch (`UserDefaults` with reason
  `CA92.1` — "Access info from same app, per documentation").
  No tracking, no collected data. Apple emits a warning per
  upload without this; rejection is not, in practice, automatic
  but the warning is loud.
- `mobile/ExportOptions.plist` committed with placeholder
  `REPLACE_WITH_TEAM_ID`. Fill once.
- Release build for `generic/platform=iOS` verified to compile
  end-to-end (`xcodebuild -configuration Release
  CODE_SIGNING_ALLOWED=NO build`). Archive itself is post-
  enrollment.

After enrollment, walk this document from section 1 — every
code-side gap is closed.
