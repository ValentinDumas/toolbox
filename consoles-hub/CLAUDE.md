# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Code of conduct — read first, every session

@BEHAVIOR.md

## Software craftsmanship — TOP PRIORITY

These practices **override** all rules below when in conflict. Apply them to
**every file** and **every change**, before considering language-specific or
framework conventions.

@DDD_PRACTICES.md
@CLEAN_CODE.md

## Language-specific rules

The agent will be written in **Go**. Go coding rules will be added here once
agent implementation starts. The following Python files are retained for
reference (and to inform any auxiliary Python tooling) but are **not**
imported by default:

- `GOOD_PRACTICES.md` — Python algorithmics & naming
- `ARCHITECTURE_PYTHON.md` — Python project layout

## UI / UX / Accessibility rules

Apply the following practices to **all mobile or web client code written or
modified in this repo** (the iOS app, any companion web UI, etc.):

@UI_DESIGN.md
@UX_DESIGN.md
@ACCESSIBILITY.md

---

## Project orientation

`consoles-hub` lets the user manage tmux-backed consoles on their Mac from
their iOS phone over a Tailscale network. See `docs/specs/` for the design.

| Subsystem | Spec |
|---|---|
| Console model | `docs/specs/2026-05-12-console-model-design.md` |
| Agent + transport | `docs/specs/2026-05-12-agent-transport-design.md` |
| Mobile UI | (future) |

The `ping-me/` subdirectory contains the iOS push notifier (bash, free,
ntfy.sh-backed). It is also usable standalone.
