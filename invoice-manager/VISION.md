# VISION

## Goal

Provide French micro-entrepreneurs and small companies (auto-entrepreneur, SASU, SARL, salarié) with a fully **offline**, **local-first** invoice manager that turns a folder of PDFs, photos, and scans into a tax-ready ledger — without ever sending fiscal data to a third party.

The single success metric: a user can drop a year of documents into `input/`, run one command, and obtain a signed-off `ledger-YYYY.xlsx` they can hand to their accountant or use for a URSSAF/DGFiP declaration — with every value traceable to a source file and every correction logged.

---

## Why

French fiscal documents are sensitive: they expose SIREN, SIRET, intra-EU VAT numbers, customer/supplier identities, revenue, and personal addresses. Cloud accounting SaaS solve a real workflow problem but at the cost of:

- Transmitting bookkeeping data to third-party servers (GDPR exposure, vendor lock-in)
- Paying recurring fees for what is essentially regex + arithmetic
- Storing 10 years of legally-required archives (Article L123-22 Code de commerce) on infrastructure the user does not control
- Trusting an OCR/AI pipeline that the user cannot audit

The project exists because **a single individual should be able to manage their own books without renting a third party's trust**. The code is small, auditable, and runs entirely on the user's machine. The only network call is optional and explicitly opted-in.

---

## How

**Offline-first by construction.** The default `local` backend uses Tesseract + pdfplumber; no network call is made by the pipeline. The optional `claude` Vision backend is opt-in, gated in settings, and clearly labeled as "data leaves the machine".

**SQLite as single source of truth.** One DB per fiscal profile under `data/profiles/{slug}/invoices.db`. No duplication between CSV, cache, and DB — the ledger is always regenerated from the DB.

**Soft deletes only.** The Code de commerce requires 10 years of retention. The UI exposes no hard-delete path. Every mutation goes through `corrections_log` with timestamp + actor.

**DDD layering.** Blueprints (bounded contexts) never import each other. Read paths go through `queries.py` (read-only). Write paths go through `services/` (validated, logged). Routes are thin; domain logic is testable in isolation.

**Regex over ML for parsing.** Extraction is deterministic, inspectable, and reproducible. A user can read `parsers.py` and understand exactly why a value was extracted.

**Tests as executable specification.** 184 pytest tests describe the fiscal rules (deductibility per profile, confidence thresholds, status transitions) in domain language, not technical language.

---

## What

A Python application with two entry points sharing the same domain:

| Surface | Entry | Purpose |
|---|---|---|
| CLI pipeline | `run.py` | Dedup → extract → export, scriptable, idempotent |
| Web dashboard | `dashboard.py` | Local Flask app on `localhost:7800` for review, edition, multi-profile |

Both write through `services/`, read through `queries.py`, and persist to per-profile SQLite. The output is a 4-sheet XLSX (Journal, Récapitulatif, Déclaration, Statistiques) plus a CSV — ready for the user's accountant or fiscal declaration.

---

## Security — non-negotiable, end-to-end

Security is **not a phase** of this project. It is a constraint that shapes every decision from the first sketch to the last test. The threat model assumes: the user's laptop can be stolen, the user can mis-configure git, a dependency can be malicious, an OCR backend can be compromised. The codebase must remain safe under each of those assumptions.

### 1. Idea / planning phase

Before any new feature is sketched, ask:

- **Does it introduce a new trust boundary?** (file upload, network call, new dependency, new actor)
- **Does it touch fiscal data?** If yes: it must go through `services/`, be logged in `corrections_log`, and have a test asserting the log entry.
- **Does it add an opt-out path to local-only?** If yes: it must be off by default, surfaced explicitly in settings, and documented in `README.md > Sécurité`.
- **Does it add or relax a deletion path?** Soft-delete is the only allowed default. Hard delete requires explicit user-typed confirmation and a written justification in the PR.
- **Does it require a new external dependency?** Justify it. Prefer stdlib. Pin the version. Read the source if it touches I/O or parsing.

A feature that fails any of the above does not enter `writing-plans` — it goes back to brainstorming.

### 2. Design phase

- **Least privilege per layer.** Blueprints cannot reach the filesystem directly outside `pipeline.py`. `queries.py` is read-only. Write paths converge on `services/`.
- **No secrets in code, no secrets in git.** `config.toml` is gitignored. The `.env.example` documents required variables; the real `.env` never lands in the repo.
- **Path traversal hardening.** Every route that serves a file (`GET /fichiers/<path>`, `GET /apercu/<path>`) must resolve the path through the active profile's sandbox and reject anything escaping it.
- **No SQL string interpolation.** All queries use parameter binding. Reviewer must reject any `f"... {var} ..."` in SQL.
- **CSRF / same-origin.** The dashboard is local but still binds a TCP port. Mutating routes must require POST/PATCH/DELETE and reject GET. Future remote access must add CSRF tokens before being merged.
- **Input validation at the boundary.** `_parse_review_fields` is the ACL: HTTP strings become typed domain values *before* reaching `services/`. Invalid input returns a domain error, never an exception that leaks a stack trace.

### 3. Implementation phase

- **Parameterized queries only.** `conn.execute("... WHERE id = ?", (item_id,))` — never f-strings.
- **Path resolution via `pathlib.Path.resolve()` + `is_relative_to(profile_root)`.** Reject anything that escapes the profile's directory.
- **File-type checks via magic bytes**, not extensions. An attacker-supplied `.pdf` that is actually an executable must be detected before any subprocess touches it.
- **Subprocess hygiene.** Tesseract and Poppler are invoked via `subprocess.run([...])` with list args — never `shell=True`, never string interpolation.
- **HEIC / image parsing** runs through Pillow + pillow-heif with size limits. A 1 GB image must not OOM the dashboard.
- **No `eval`, no `exec`, no `pickle.loads`** on any user-supplied data. Period.
- **Soft-delete enforcement.** Every `DELETE` route in `blueprints/` writes `deleted_at` + `deleted_by`. There is no `DROP`, no unconditional `DELETE FROM`.
- **`corrections_log` is append-only.** No route updates or deletes entries.
- **Optional Claude backend is opt-in, never on by default**, and clearly labeled in the UI. When active, log every outbound call so the user can audit data egress.

### 4. Verification / testing phase

- **Unit tests** in `tests/` assert the domain rules — confidence demotion, status transitions, soft-delete behavior, log appending.
- **Path-traversal tests** for every file-serving route. Probes: `../`, absolute paths, symlinks pointing outside the profile root, URL-encoded traversal.
- **SQL-injection tests** for every route that accepts user input ending up in a query.
- **Migration safety tests** (`test_db.py`) guarantee migrations are idempotent and never silently drop columns.
- **`/security-check` and `/security-review` skills** are run before any branch is merged. The OWASP Top 10 is the minimum bar.
- **Dependency review.** Before pinning a new library, check its maintenance status, license, and supply-chain signals (downloads, last release, open CVEs). Prefer libraries already in `requirements.txt`.
- **Manual review checklist** before merging fiscal-data-touching code:
  - [ ] No new outbound network call (or one explicitly opt-in, off by default, documented)
  - [ ] No new hard-delete path
  - [ ] All file paths sandboxed to active profile
  - [ ] All SQL parameterized
  - [ ] All mutations logged in `corrections_log`
  - [ ] All new routes have tests for the unhappy path (auth, traversal, malformed input)
  - [ ] No secrets, no fixtures with real SIREN/SIRET in git history

### 5. Operational hygiene (delivered to the user via README)

- FileVault on the host disk → at-rest encryption
- Time Machine or encrypted backup of `data/` → recovery
- `git status` discipline → `input/`, `data/`, `processed/` must never appear
- Avoid syncing `data/` through unencrypted cloud folders (iCloud, Dropbox) without an extra encryption layer
- Keep the Claude backend disabled unless the user has consciously decided to accept that egress

---

## Non-goals

- Cloud sync, multi-user collaboration, SSO — out of scope. This is a single-user, single-machine tool.
- Replacing an accountant for legally-binding declarations — the tool produces evidence, the human signs.
- ML-based extraction — deterministic regex parsing is a feature, not a limitation.
- Real-time bank reconciliation — bank statements are tracked as `relevé_bancaire` but reconciliation is outside the ledger.
