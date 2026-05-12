# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project vision — TOP PRIORITY, read before any change

@VISION.md

## Code of conduct — read first, every session

@BEHAVIOR.md

## Software craftsmanship — TOP PRIORITY

These practices **override** all rules below when in conflict. Apply them to **every file** (Python, Jinja, JS, SQL, Go) and to **every change**, before considering language-specific or framework conventions.

@DDD_PRACTICES.md
@CLEAN_CODE.md

## Python coding rules

Subordinate to the practices above. Apply when the project is Python and there is no conflict with DDD / Clean Code.

@GOOD_PRACTICES.md
@ARCHITECTURE_PYTHON.md

## UI / UX / Accessibility rules

Apply the following practices to **all dashboard, mobile, or frontend code written or modified in this repo**:

@UI_DESIGN.md
@UX_DESIGN.md
@ACCESSIBILITY.md

## Security skill — load on demand

Load the `owasp-security` skill (installed under `~/.claude/skills/owasp-security/`) **before designing or implementing** a change that touches any of:

- a new HTTP route, form field, or file upload path
- file I/O serving paths from user input (path traversal surface)
- a `subprocess` / shell call
- raw SQL or any query built from user input
- authentication, session, or permission logic
- a new external dependency, or a bumped one with known CVEs

The skill is NOT auto-imported here — load it only when relevant, to keep the prompt cache stable for non-security work. Run `/security-check` or `/security-review` before merging any branch that touched the above.

## QA pass skill — load on demand

Load the `qa-pass` skill (installed under `~/.claude/skills/qa-pass/`) **before** any task that asks to:

- test the app / UI end-to-end
- "find bugs", "QA the app", "check workflows", or any variant of UI regression hunting
- drive Playwright across multiple flows and file GitHub issues for findings

The skill codifies sanity checks (`lsof -p <pid> | grep cwd`, no `SELECT *` on tables with blob columns), token discipline (one snapshot per page then `browser_evaluate`), state-rollback SQL, and the issue-template format. Not auto-imported — keeps the prompt cache stable for non-QA work.

---

## Language-specific rules

The agent will be written in **Go**. Go coding rules will be added here once
agent implementation starts. The Python files imported above (`GOOD_PRACTICES.md`,
`ARCHITECTURE_PYTHON.md`) are retained for reference and any auxiliary Python
tooling.

## Project orientation

`consoles-hub` lets the user manage tmux-backed consoles on their Mac from
their iOS phone over a Tailscale network. See `docs/specs/` for the design.

| Subsystem | Spec |
|---|---|
| Console model | `docs/specs/2026-05-12-console-model-design.md` |
| Agent + transport | `docs/specs/2026-05-12-agent-transport-design.md` |
| Install / launchd | `install.sh` (root of repo) + `com.vdumas.consoles-hub.agent.plist.tmpl` |
| Mobile UI | `docs/specs/2026-05-12-mobile-ui-design.md` + `mobile/` (SwiftUI app) |

The `ping-me/` subdirectory contains the iOS push notifier (bash, free,
ntfy.sh-backed). It is also usable standalone.

## Documentation hygiene

Always update `README.md` and any associated documentation (specs under
`docs/specs/`, install/usage notes, subdirectory READMEs) when a change
alters behavior, configuration, commands, or interfaces. Docs land in the
same commit as the code change — never deferred.
