# consoles-hub

Personal mission control: manage tmux-backed consoles on your Mac from your
iOS phone, from anywhere on the internet.

**Status:** design phase. First spec written; no agent code yet.

## Layout

| Path | Role |
|---|---|
| `docs/specs/` | Design specs, one per subsystem |
| `ping-me/` | iOS push CLI (notification path). Usable standalone. |

## Subsystems & spec status

| Subsystem | Spec |
|---|---|
| Console model (what a console *is*) | [2026-05-12](docs/specs/2026-05-12-console-model-design.md) ✅ |
| Mac-side agent + transport | next |
| Mobile UI | future |
| `ping-me` integration | future |
