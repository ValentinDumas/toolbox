# BEHAVIOR.md — Code of conduct (per session)

These rules apply to **every session** in this repo. They optimize execution speed without degrading output quality. Read them before acting.

---

## Posture

Be sceptical, challenge with your vision and ideas.

---

## Speed levers (no quality loss)

1. **Parallel tool calls** — batch independent reads / greps / bash commands into a single assistant message. Sequence only when one call's output is needed to form the next call's arguments.

2. **Permission allowlist** — keep `.claude/settings.json` curated so common safe commands don't trigger an "Allow?" prompt. Run `/skill fewer-permission-prompts` periodically to refresh it from recent transcripts.

3. **`/fast` mode** — Opus 4.6 with faster output, same model class. Prefer it for transactional turns; switch back for deep reasoning.

4. **No agent for trivial work** — direct `Read` / `grep` / `Bash` beats spawning an Explore or general-purpose agent when the path or symbol is already known. Reserve agents for open-ended cross-codebase work.

5. **Tight prompts** — exact file path, exact symbol, exact constraint. "Fix `X` in `file.py:42` so Y" beats "look into the bug with X".

6. **Caveman mode for transactional turns** — short sentences, no filler. Revert to full prose only when reasoning needs nuance. (See `~/workflow/agent.md`.)

7. **Cache discipline** — `CLAUDE.md`, `BEHAVIOR.md`, `agent.md` and other static context must stay stable across a session. Editing them mid-session invalidates the 5-min prompt cache and forces a cold re-read on the next turn.

8. **No post-`Edit` re-read** — `Edit` errors if it didn't apply. Re-reading to "verify" is pure latency.

---

## Reminder

The global behavior rules in `~/workflow/BEHAVIOR.md` (think before coding, simplicity first, surgical changes, goal-driven execution) still apply. This file adds session-level speed discipline on top.
