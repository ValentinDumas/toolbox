# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project vision — read first, every session

@VISION.md

## Code of conduct — read first, every session

@BEHAVIOR.md

## Software craftsmanship — TOP PRIORITY

These practices **override** all rules below when in conflict. Apply them to **every file** (Python, Jinja, JS, SQL) and to **every change**, before considering language-specific or framework conventions.

@DDD_PRACTICES.md
@CLEAN_CODE.md

## Python coding rules

Subordinate to the practices above. Apply when there is no conflict with DDD / Clean Code.

@GOOD_PRACTICES.md
@ARCHITECTURE_PYTHON.md

## UI / UX / Accessibility rules

Apply the following practices to **all dashboard or frontend code written or modified in this repo**:

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
| `export.py` | Generates `ledger-YYYY.csv` + XLSX (4 sheets) from DB |
| `review.py` | Batch validation: exports low-confidence items to CSV, imports corrections |
| `dashboard.py` | Flask web UI — views ledger, inline editing, soft-delete |
| `config.py` | Config loading with layered fallback: CLI > config.toml > DEFAULT_CONFIG |

**Key design rules:**
- SQLite (`data/invoices.db`) is the single source of truth — never write to it outside of `extract.py`, `review.py`, or `dashboard.py` routes
- All deletes are soft (`deleted_at` / `deleted_by`) — no hard deletes from UI
- All field edits are logged in `corrections_log` (JSON) with timestamp + user
- Items with `confiance < 0.8` → `statut_révision = 'à_réviser'` for human review
- Deductibility rules are applied at export time (not at extraction), based on `fiscal.default_profile`

## Parsing (extract.py)

Extraction is **regex-only** — no ML. Key parsers:
- `_parse_date(text)` — handles YYYY-MM-DD, DD-MM-YYYY, French long dates; auto-corrects OCR year drift
- `_parse_amounts(text)` → `(ht, tva, ttc, taux_tva)` — derives missing value when two are present
- `_guess_doc_type(text, siren, known_emitters)` — classifies by SIREN ownership + keywords

## Config

Copy `config.toml.example` → `config.toml`. Critical keys:

```toml
[identity]
siren = "123456789"           # Used for doc type detection (facture_émise vs reçue)

[extraction]
backend = "local"             # "claude" enables Vision API
confidence_threshold = 0.8    # Below this → à_réviser

[fiscal]
default_profile = "SASU"      # Affects deductibility rules at export
```

## Tests

101 tests across 5 files in `tests/`. Shared fixtures in `conftest.py`:
- `tmp_project` — isolated temp dir with full workspace structure
- `tmp_db` — in-memory SQLite connection
- `make_pdf(text, path)` — creates a real PDF for parsing tests

## Fiscal profiles

Supported: `auto-entrepreneur`, `SASU`, `SARL`, `salarié`. Each has different:
- TVA deductibility rules (in `export.py`)
- Default declaration cadence (in `config.py::CADENCE_DEFAULTS`)
