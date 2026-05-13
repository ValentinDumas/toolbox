# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project vision — TOP PRIORITY, read before any change

@VISION.md

## Code of conduct — read first, every session

@BEHAVIOR.md

## Software craftsmanship — TOP PRIORITY

These practices **override** all rules below when in conflict. Apply them to **every file** (Python, Jinja, JS, SQL, Go) and to **every change**, before considering language-specific or framework conventions.

@BDD_PRACTICES.md
@DDD_PRACTICES.md
@CLEAN_CODE.md

**Test priority order:** BDD functional tests (Given/When/Then in ubiquitous language) come **first** — they act as the executable specification of the domain and attest the design. Unit / technical tests come **second**, never as a substitute.

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
- the optional Claude Vision backend (outbound data egress)
- any item from `VISION.md > Security` (phases 1–5)

The skill is NOT auto-imported here — load it only when relevant, to keep the prompt cache stable for non-security work. Run `/security-check` or `/security-review` before merging any branch that touched the above.

## QA pass skill — load on demand

Load the `qa-pass` skill (installed under `~/.claude/skills/qa-pass/`) **before** any task that asks to:

- test the app / UI end-to-end
- "find bugs", "QA the app", "check workflows", or any variant of UI regression hunting
- drive Playwright across multiple flows and file GitHub issues for findings

The skill codifies sanity checks (`lsof -p <pid> | grep cwd`, no `SELECT *` on tables with blob columns), token discipline (one snapshot per page then `browser_evaluate`), state-rollback SQL, and the issue-template format. Not auto-imported — keeps the prompt cache stable for non-QA work.

---

## Commands

```bash
# Full pipeline (dedup → extract → export)
python3 run.py
python3 run.py --year 2025
python3 run.py --config custom.toml

# Dashboard (web UI)
python3 dashboard.py                # http://localhost:7800
pkill -f "dashboard.py" && python3 dashboard.py  # restart

# Tests
python3 -m pytest tests/ -v
python3 -m pytest tests/test_extract.py -v  # single file
python3 -m pytest tests/ -k "test_parse_date"  # single test

# Individual scripts
python3 extract.py
python3 export.py --year 2025
python3 review.py --import
```

## Architecture

Data flow: `input/` → `extract.py` → `invoices.db` → `export.py` → `output/`

| File | Role |
|------|------|
| `run.py` | Orchestrator — chains dedup, extract, export |
| `extract.py` | Reads files (PDF/image), OCR, regex parsing, inserts into DB |
| `export.py` | Generates `ledger-YYYY.csv` + XLSX (4 sheets) from DB. Helpers `csv_text()` / `xlsx_bytes()` exposent les mêmes données en flux mémoire pour le téléchargement depuis le dashboard (`blueprints/export.py`). |
| `blueprints/export.py` | Routes GET `/export/ledger.xlsx` / `/export/ledger.csv` — téléchargement depuis le dashboard, en lecture seule, sans écriture disque. |
| `review.py` | Batch validation: exports low-confidence items to CSV, imports corrections |
| `dashboard.py` | Flask web UI — views ledger, inline editing, soft-delete |
| `config.py` | Pure Python constants partagées (cadences de déclaration par profil fiscal) |

**Key design rules:**
- SQLite (`data/profiles/<slug>/invoices.db`) is the single source of truth — never write to it outside of `extract.py`, `review.py`, ou les routes de `blueprints/*.py`
- All deletes are soft (`deleted_at` / `deleted_by`) — no hard deletes from UI
- All field edits are logged in `corrections_log` (JSON) with timestamp + user
- Items with `confiance < 0.8` → `statut_révision = 'à_réviser'` for human review
- Deductibility rules are applied at export time (not at extraction), based on `user_profile.fiscal_profile`

## Parsing (extract.py)

Extraction is **regex-only** — no ML. Key parsers:
- `_parse_date(text)` — handles YYYY-MM-DD, DD-MM-YYYY, French long dates; auto-corrects OCR year drift
- `_parse_amounts(text)` → `(ht, tva, ttc, taux_tva)` — derives missing value when two are present
- `_guess_doc_type(text, siren, known_emitters)` — classifies by SIREN ownership + keywords

## Config

Toutes les données utilisateur (identité, profil fiscal, OCR, enseignes,
catégories TVA) vivent dans la DB SQLite du profil (`user_profile`,
`known_emitters`, `category_tva_rates`). Configuration via le wizard de
setup (`/configuration`) au premier lancement, puis via **Paramètres**
(`/parametres`). Plus de fichier `config.toml`.

Critères-clés en DB :

- `user_profile.siren` (9 chiffres) — détection facture_émise vs reçue
- `user_profile.ocr_backend` — `local` (offline) | `claude` (Vision API)
- `user_profile.ocr_confidence_threshold` — défaut `0.8`, sous lequel item → `à_réviser`
- `user_profile.fiscal_profile` — `auto-entrepreneur` | `SASU` | `SARL` | `salarié`

## Tests

101 tests across 5 files in `tests/`. Shared fixtures in `conftest.py`:
- `tmp_project` — isolated temp dir with full workspace structure
- `tmp_db` — in-memory SQLite connection
- `make_pdf(text, path)` — creates a real PDF for parsing tests

## Fiscal profiles

Supported: `auto-entrepreneur`, `SASU`, `SARL`, `salarié`. Each has different:
- TVA deductibility rules (in `export.py`)
- Default declaration cadence (in `config.py::CADENCE_DEFAULTS`)

## Documentation hygiene

Always update `README.md` and any associated documentation (specs under
`docs/specs/`, install/usage notes, subdirectory READMEs) when a change
alters behavior, configuration, commands, or interfaces. Docs land in the
same commit as the code change — never deferred.
