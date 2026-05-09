# Dashboard local — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer les données SQLite d'invoice-manager dans un dashboard Flask local sur le port 7800 avec synthèse fiscale, ledger paginé et vue de santé.

**Architecture:** `dashboard.py` est un serveur Flask autonome avec une factory `create_app(cfg, db_path)`. Les données sont lues directement depuis SQLite via `extract.open_db`. Le template Jinja2 (`templates/dashboard.html`) embarque tout le CSS ProLedger inline.

**Tech Stack:** Python 3.11+, Flask, SQLite3, Jinja2, vanilla JS (spinner uniquement).

---

## File map

| Fichier | Action | Rôle |
|---|---|---|
| `invoice-manager/dashboard.py` | Créer | App Flask, routes, queries, argparse |
| `invoice-manager/templates/dashboard.html` | Créer | Template Jinja2 tout-en-un |
| `invoice-manager/tests/test_dashboard.py` | Créer | Tests client Flask |

Fichiers lus mais non modifiés : `config.py` (`load_config`), `extract.py` (`open_db`, `SCHEMA`).

---

## Task 1 — Fonctions de données

**Files:**
- Create: `invoice-manager/dashboard.py` (fonctions de requêtes uniquement)
- Test: `invoice-manager/tests/test_dashboard.py`

### Contexte schéma SQLite

Colonnes utilisées depuis `invoices` :

| Colonne | Type | Valeurs typiques |
|---|---|---|
| `type_document` | TEXT | `facture_émise`, `facture_reçue`, `reçu`, `note_de_frais` |
| `montant_ht` | REAL | montant hors taxes |
| `montant_tva` | REAL | montant de TVA |
| `exercice_fiscal` | INTEGER | ex. `2025` |
| `statut_révision` | TEXT | `auto_validé`, `validé`, `à_réviser`, `erreur` |
| `émetteur_nom` | TEXT | nom du fournisseur |
| `destinataire_nom` | TEXT | nom du client |
| `date_document` | TEXT | ISO 8601 ou `DD/MM/YYYY` |

- **Factures émises** (revenus) : `type_document = 'facture_émise'`
- **Dépenses** (charges) : `type_document IN ('facture_reçue', 'reçu', 'note_de_frais')`

- [ ] **Step 1.1 — Écrire les tests des fonctions de données**

```python
# invoice-manager/tests/test_dashboard.py
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from extract import open_db


def _insert_invoice(conn, **kwargs):
    defaults = {
        "id": "test-id",
        "type_document": "facture_reçue",
        "montant_ht": 100.0,
        "montant_tva": 20.0,
        "montant_ttc": 120.0,
        "exercice_fiscal": 2025,
        "statut_révision": "auto_validé",
        "émetteur_nom": "OVH SAS",
        "destinataire_nom": "Jean Dupont",
        "date_document": "2025-03-01",
    }
    row = {**defaults, **kwargs}
    cols = ", ".join(f'"{k}"' for k in row)
    placeholders = ", ".join("?" for _ in row)
    conn.execute(f"INSERT INTO invoices ({cols}) VALUES ({placeholders})", list(row.values()))
    conn.commit()


@pytest.fixture
def mem_db():
    conn = open_db(Path(":memory:"))
    yield conn
    conn.close()


def test_fiscal_summary_empty(mem_db):
    from dashboard import query_fiscal_summary
    s = query_fiscal_summary(mem_db, 2025)
    assert s["ca_ht"] == 0.0
    assert s["tva_collectee"] == 0.0
    assert s["tva_deductible"] == 0.0
    assert s["tva_a_reverser"] == 0.0
    assert s["total_charges"] == 0.0


def test_fiscal_summary_populated(mem_db):
    from dashboard import query_fiscal_summary
    _insert_invoice(mem_db, id="e1", type_document="facture_émise",
                    montant_ht=1000.0, montant_tva=200.0, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="r1", type_document="facture_reçue",
                    montant_ht=400.0, montant_tva=80.0, exercice_fiscal=2025)
    s = query_fiscal_summary(mem_db, 2025)
    assert s["ca_ht"] == 1000.0
    assert s["tva_collectee"] == 200.0
    assert s["tva_deductible"] == 80.0
    assert abs(s["tva_a_reverser"] - 120.0) < 0.01
    assert s["total_charges"] == 400.0


def test_fiscal_summary_year_filter(mem_db):
    from dashboard import query_fiscal_summary
    _insert_invoice(mem_db, id="e2025", type_document="facture_émise",
                    montant_ht=500.0, montant_tva=100.0, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="e2024", type_document="facture_émise",
                    montant_ht=200.0, montant_tva=40.0, exercice_fiscal=2024)
    s = query_fiscal_summary(mem_db, 2025)
    assert s["ca_ht"] == 500.0


def test_ledger_pagination(mem_db):
    from dashboard import query_ledger
    for i in range(55):
        _insert_invoice(mem_db, id=f"row-{i}", type_document="facture_reçue",
                        montant_ht=10.0, montant_tva=2.0, exercice_fiscal=2025)
    page1 = query_ledger(mem_db, 2025, page=1)
    assert len(page1["rows"]) == 50
    assert page1["total_count"] == 55
    assert page1["total_pages"] == 2
    page2 = query_ledger(mem_db, 2025, page=2)
    assert len(page2["rows"]) == 5


def test_ledger_totals(mem_db):
    from dashboard import query_ledger
    _insert_invoice(mem_db, id="inc", type_document="facture_émise",
                    montant_ht=300.0, montant_tva=60.0, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="exp", type_document="facture_reçue",
                    montant_ht=150.0, montant_tva=30.0, exercice_fiscal=2025)
    result = query_ledger(mem_db, 2025)
    assert result["total_credit"] == 300.0
    assert result["total_debit"] == 150.0


def test_health_counts(mem_db, tmp_path):
    from dashboard import query_health
    (tmp_path / "input").mkdir()
    (tmp_path / "errors").mkdir()
    (tmp_path / "input" / "facture.pdf").touch()
    (tmp_path / "errors" / "broken.pdf").touch()
    _insert_invoice(mem_db, id="rev", statut_révision="à_réviser", exercice_fiscal=2025)
    cfg = {"paths": {"input": str(tmp_path / "input"), "errors": str(tmp_path / "errors")}}
    h = query_health(mem_db, cfg)
    assert h["pending_files"] == 1
    assert h["items_a_reviser"] == 1
    assert h["error_files"] == 1
```

- [ ] **Step 1.2 — Vérifier que les tests échouent**

```bash
cd invoice-manager && python -m pytest tests/test_dashboard.py -v 2>&1 | head -20
```
Attendu : `ImportError: cannot import name 'query_fiscal_summary' from 'dashboard'`

- [ ] **Step 1.3 — Implémenter les fonctions de données dans `dashboard.py`**

```python
# invoice-manager/dashboard.py
"""
dashboard.py — Dashboard web local pour invoice-manager.
Usage: python dashboard.py [--config FILE] [--port PORT]
"""
import argparse
import platform
import sqlite3
import subprocess
import sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

from config import load_config
from extract import open_db

# Types de documents classés par sens comptable
INCOME_TYPES = ("facture_émise",)
EXPENSE_TYPES = ("facture_reçue", "reçu", "note_de_frais")


def query_fiscal_summary(conn: sqlite3.Connection, year: int) -> dict:
    """Retourne les KPI fiscaux pour une année."""
    def scalar(sql, *args):
        return conn.execute(sql, args).fetchone()[0] or 0.0

    ca_ht = scalar(
        "SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document=?",
        year, "facture_émise",
    )
    tva_collectee = scalar(
        "SELECT COALESCE(SUM(montant_tva),0) FROM invoices WHERE exercice_fiscal=? AND type_document=?",
        year, "facture_émise",
    )
    ph = ",".join("?" * len(EXPENSE_TYPES))
    tva_deductible = conn.execute(
        f"SELECT COALESCE(SUM(montant_tva),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph})",
        (year, *EXPENSE_TYPES),
    ).fetchone()[0] or 0.0
    total_charges = conn.execute(
        f"SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph})",
        (year, *EXPENSE_TYPES),
    ).fetchone()[0] or 0.0

    return {
        "ca_ht": ca_ht,
        "tva_collectee": tva_collectee,
        "tva_deductible": tva_deductible,
        "tva_a_reverser": round(tva_collectee - tva_deductible, 2),
        "total_charges": total_charges,
    }


def query_ledger(conn: sqlite3.Connection, year: int, page: int = 1, per_page: int = 50) -> dict:
    """Retourne une page du ledger pour une année."""
    offset = (page - 1) * per_page
    rows = conn.execute(
        "SELECT * FROM invoices WHERE exercice_fiscal=? ORDER BY date_document DESC LIMIT ? OFFSET ?",
        (year, per_page, offset),
    ).fetchall()
    total_count = conn.execute(
        "SELECT COUNT(*) FROM invoices WHERE exercice_fiscal=?", (year,)
    ).fetchone()[0]

    ph_in = ",".join("?" * len(INCOME_TYPES))
    ph_ex = ",".join("?" * len(EXPENSE_TYPES))
    total_credit = conn.execute(
        f"SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph_in})",
        (year, *INCOME_TYPES),
    ).fetchone()[0] or 0.0
    total_debit = conn.execute(
        f"SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph_ex})",
        (year, *EXPENSE_TYPES),
    ).fetchone()[0] or 0.0

    return {
        "rows": [dict(r) for r in rows],
        "total_count": total_count,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total_count + per_page - 1) // per_page),
        "total_credit": total_credit,
        "total_debit": total_debit,
    }


def query_health(conn: sqlite3.Connection, cfg: dict) -> dict:
    """Retourne les indicateurs de santé du workspace."""
    def count_files(key):
        p = Path(cfg["paths"][key])
        if not p.exists():
            return 0
        return sum(1 for f in p.iterdir() if f.is_file())

    items_a_reviser = conn.execute(
        "SELECT COUNT(*) FROM invoices WHERE statut_révision='à_réviser'"
    ).fetchone()[0]

    return {
        "pending_files": count_files("input"),
        "items_a_reviser": items_a_reviser,
        "error_files": count_files("errors"),
    }
```

- [ ] **Step 1.4 — Vérifier que les tests passent**

```bash
cd invoice-manager && python -m pytest tests/test_dashboard.py::test_fiscal_summary_empty tests/test_dashboard.py::test_fiscal_summary_populated tests/test_dashboard.py::test_fiscal_summary_year_filter tests/test_dashboard.py::test_ledger_pagination tests/test_dashboard.py::test_ledger_totals tests/test_dashboard.py::test_health_counts -v
```
Attendu : `6 passed`

- [ ] **Step 1.5 — Commit**

```bash
git add invoice-manager/dashboard.py invoice-manager/tests/test_dashboard.py
git commit -m "feat(dashboard): add data query functions with tests"
```

---

## Task 2 — Flask app factory + routes GET

**Files:**
- Modify: `invoice-manager/dashboard.py` (ajouter `create_app`, filtre Jinja2, `main`)
- Create: `invoice-manager/templates/dashboard.html` (placeholder minimal pour ce task)
- Test: `invoice-manager/tests/test_dashboard.py`

- [ ] **Step 2.1 — Écrire les tests des routes GET**

Ajouter à `tests/test_dashboard.py` :

```python
def _make_app(mem_db, tmp_path, monkeypatch):
    """Helper : crée une app Flask avec une DB en mémoire."""
    from dashboard import create_app

    # Patch open_db pour retourner notre connexion en mémoire
    import dashboard as dash_mod
    monkeypatch.setattr(dash_mod, "open_db", lambda path: mem_db)

    (tmp_path / "input").mkdir(exist_ok=True)
    (tmp_path / "errors").mkdir(exist_ok=True)
    (tmp_path / "review").mkdir(exist_ok=True)

    cfg = {
        "paths": {
            "input": str(tmp_path / "input"),
            "errors": str(tmp_path / "errors"),
            "review": str(tmp_path / "review"),
            "db": str(tmp_path / "data" / "invoices.db"),
        }
    }
    app = create_app(cfg, tmp_path / "data" / "invoices.db")
    app.config["TESTING"] = True
    return app


def test_get_root_empty_db(mem_db, tmp_path, monkeypatch):
    app = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/")
    assert resp.status_code == 200
    assert b"ProLedger" in resp.data


def test_get_root_populated(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="e1", type_document="facture_émise",
                    montant_ht=1000.0, montant_tva=200.0, exercice_fiscal=2025)
    app = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/?year=2025")
    assert resp.status_code == 200
    # CA HT "1 000,00 €" apparaît dans le HTML
    assert "1" in resp.data.decode()


def test_year_filter(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="e2025", type_document="facture_émise",
                    montant_ht=500.0, montant_tva=100.0, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="e2024", type_document="facture_émise",
                    montant_ht=999.0, montant_tva=199.0, exercice_fiscal=2024)
    app = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/?year=2025")
    # "999" ne doit PAS apparaître (appartient à 2024)
    assert b"999" not in resp.data
```

- [ ] **Step 2.2 — Vérifier que les tests échouent**

```bash
cd invoice-manager && python -m pytest tests/test_dashboard.py::test_get_root_empty_db -v 2>&1 | head -10
```
Attendu : `ImportError: cannot import name 'create_app' from 'dashboard'`

- [ ] **Step 2.3 — Implémenter `create_app`, le filtre `fr_currency` et `main` dans `dashboard.py`**

Ajouter à la fin de `dashboard.py`, après les fonctions de données :

```python
def _fr_currency(value) -> str:
    """Formate un float en monnaie française : 1 234,56 €. Négatif → (1 234,56 €)."""
    if value is None:
        value = 0.0
    neg = value < 0
    s = f"{abs(value):,.2f}"                  # "1,234.56"
    s = s.replace(",", "X").replace(".", ",").replace("X", " ")  # "1 234,56"
    s += " €"
    return f"({s})" if neg else s


def create_app(cfg: dict, db_path: Path) -> "Flask":
    from urllib.parse import quote

    from flask import Flask, redirect, render_template, render_template_string, request

    app = Flask(__name__, template_folder=str(HERE / "templates"))
    app.jinja_env.filters["fr_currency"] = _fr_currency

    @app.route("/")
    def index():
        year = request.args.get("year", datetime.now().year, type=int)
        page = request.args.get("page", 1, type=int)
        run_error = request.args.get("run_error")
        try:
            conn = open_db(db_path)
            summary = query_fiscal_summary(conn, year)
            ledger = query_ledger(conn, year, page=page)
            health = query_health(conn, cfg)
            years = [r[0] for r in conn.execute(
                "SELECT DISTINCT exercice_fiscal FROM invoices ORDER BY exercice_fiscal DESC"
            ).fetchall()] or [datetime.now().year]
            conn.close()
        except sqlite3.DatabaseError as exc:
            return render_template_string(
                _ERROR_TMPL, message=str(exc), hint="python run.py"
            ), 500

        return render_template(
            "dashboard.html",
            year=year,
            years=years,
            summary=summary,
            ledger=ledger,
            health=health,
            run_error=run_error,
            expense_types=EXPENSE_TYPES,
        )

    @app.route("/run", methods=["POST"])
    def run_pipeline():
        result = subprocess.run(
            [sys.executable, str(HERE / "run.py")],
            capture_output=True,
            text=True,
            cwd=str(HERE),
        )
        if result.returncode != 0:
            error_snippet = result.stderr[-500:] if result.stderr else "Erreur inconnue"
            return redirect(f"/?run_error={quote(error_snippet)}")
        return redirect("/")

    @app.route("/open-review", methods=["POST"])
    def open_review():
        try:
            conn = open_db(db_path)
            n = conn.execute(
                "SELECT COUNT(*) FROM invoices WHERE statut_révision='à_réviser'"
            ).fetchone()[0]
            conn.close()
        except sqlite3.DatabaseError:
            return redirect("/")

        if n == 0:
            return redirect("/")

        review_csv = Path(cfg["paths"]["review"]) / "review.csv"
        cmd = "open" if platform.system() == "Darwin" else "xdg-open"
        subprocess.Popen([cmd, str(review_csv)])
        return redirect("/")

    return app


_ERROR_TMPL = """<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Erreur — ProLedger</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:80px auto;padding:0 24px;color:#0F172A}
h1{color:#B91C1C}code{background:#F1F5F9;padding:2px 6px;border-radius:4px;font-size:14px}</style>
</head><body>
<h1>Erreur base de données</h1>
<p>{{ message }}</p>
<p>Relancer le pipeline pour initialiser la base :</p>
<pre><code>{{ hint }}</code></pre>
</body></html>"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Dashboard local invoice-manager")
    parser.add_argument("--config", type=Path, default=Path("config.toml"))
    parser.add_argument("--port", type=int, default=7800)
    args = parser.parse_args()

    if not args.config.exists():
        print(f"  [info] {args.config} introuvable — valeurs par défaut utilisées.")

    cfg = load_config(args.config)
    db_path = Path(cfg["paths"]["db"])

    app = create_app(cfg, db_path)
    print(f"  Dashboard : http://localhost:{args.port}")
    print("  Ctrl+C pour arrêter.")
    app.run(port=args.port, debug=False)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2.4 — Créer un template minimal pour que les routes passent**

```bash
mkdir -p invoice-manager/templates
```

Créer `invoice-manager/templates/dashboard.html` avec ce contenu minimal :

```html
<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><title>ProLedger — {{ year }}</title></head>
<body>
<h1>ProLedger</h1>
<p>{{ year }}</p>
</body>
</html>
```

- [ ] **Step 2.5 — Installer Flask si absent**

```bash
pip install flask
```

- [ ] **Step 2.6 — Vérifier que les tests GET passent**

```bash
cd invoice-manager && python -m pytest tests/test_dashboard.py::test_get_root_empty_db tests/test_dashboard.py::test_get_root_populated tests/test_dashboard.py::test_year_filter -v
```
Attendu : `3 passed`

- [ ] **Step 2.7 — Commit**

```bash
git add invoice-manager/dashboard.py invoice-manager/templates/dashboard.html invoice-manager/tests/test_dashboard.py
git commit -m "feat(dashboard): add Flask app factory and GET routes"
```

---

## Task 3 — Routes POST + tests

**Files:**
- Test: `invoice-manager/tests/test_dashboard.py`

- [ ] **Step 3.1 — Écrire les tests des routes POST**

Ajouter à `tests/test_dashboard.py` :

```python
from unittest.mock import patch, MagicMock


def test_post_run_calls_subprocess(mem_db, tmp_path, monkeypatch):
    app = _make_app(mem_db, tmp_path, monkeypatch)
    with patch("dashboard.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stderr="")
        with app.test_client() as client:
            resp = client.post("/run")
    assert resp.status_code in (302, 200)
    mock_run.assert_called_once()
    called_cmd = mock_run.call_args[0][0]
    assert "run.py" in called_cmd[-1]


def test_post_run_error_shows_in_redirect(mem_db, tmp_path, monkeypatch):
    app = _make_app(mem_db, tmp_path, monkeypatch)
    with patch("dashboard.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=1, stderr="ERREUR GRAVE")
        with app.test_client() as client:
            resp = client.post("/run")
    assert resp.status_code == 302
    assert "run_error" in resp.headers["Location"]


def test_post_open_review_no_items_redirects(mem_db, tmp_path, monkeypatch):
    app = _make_app(mem_db, tmp_path, monkeypatch)
    with patch("dashboard.subprocess.Popen") as mock_popen:
        with app.test_client() as client:
            resp = client.post("/open-review")
    assert resp.status_code == 302
    mock_popen.assert_not_called()


def test_post_open_review_with_items_opens_file(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="rev1", statut_révision="à_réviser", exercice_fiscal=2025)
    (tmp_path / "review" / "review.csv").touch()
    app = _make_app(mem_db, tmp_path, monkeypatch)
    with patch("dashboard.subprocess.Popen") as mock_popen:
        with app.test_client() as client:
            resp = client.post("/open-review")
    assert resp.status_code == 302
    mock_popen.assert_called_once()
```

- [ ] **Step 3.2 — Vérifier que les tests échouent correctement**

```bash
cd invoice-manager && python -m pytest tests/test_dashboard.py::test_post_run_calls_subprocess tests/test_dashboard.py::test_post_open_review_no_items_redirects -v 2>&1 | head -20
```
Attendu : les tests passent (les routes sont déjà implémentées en Task 2). Si erreur, déboguer `create_app`.

- [ ] **Step 3.3 — Lancer la suite complète des tests**

```bash
cd invoice-manager && python -m pytest tests/test_dashboard.py -v
```
Attendu : `10 passed`

- [ ] **Step 3.4 — Commit**

```bash
git add invoice-manager/tests/test_dashboard.py
git commit -m "test(dashboard): add POST route tests"
```

---

## Task 4 — Template HTML complet (ProLedger)

**Files:**
- Modify: `invoice-manager/templates/dashboard.html` (remplacer le placeholder)

> Pas de test automatisé pour le rendu visuel — vérification manuelle en lançant le serveur avec les données de démo.

- [ ] **Step 4.1 — Remplacer `templates/dashboard.html` par le template complet**

Écraser `invoice-manager/templates/dashboard.html` avec :

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ProLedger — {{ year }}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #1C4ED8;
      --secondary: #475569;
      --surface: #F8FAFC;
      --surface-variant: #F1F5F9;
      --on-surface: #0F172A;
      --on-surface-muted: #64748B;
      --positive: #059669;
      --negative: #DC2626;
      --warning: #D97706;
      --error: #B91C1C;
      --border: #E2E8F0;
      --radius: 6px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 15px;
      font-weight: 400;
      color: var(--on-surface);
      background: var(--surface);
      line-height: 1.5;
    }
    .sr-only {
      position: absolute; width: 1px; height: 1px;
      padding: 0; margin: -1px; overflow: hidden;
      clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }
    /* Layout */
    .page { max-width: 1280px; margin: 0 auto; padding: 28px 32px; }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 32px;
    }
    h1 { font-size: 22px; font-weight: 600; }
    .page-period { font-size: 13px; color: var(--on-surface-muted); margin-top: 2px; }
    /* Year filter */
    .year-form { display: flex; align-items: center; gap: 8px; }
    .year-label { font-size: 13px; color: var(--on-surface-muted); }
    .year-select {
      font-family: inherit;
      font-size: 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 6px 10px;
      background: white;
      color: var(--on-surface);
      cursor: pointer;
    }
    .year-select:focus { outline: 2px solid var(--primary); outline-offset: 1px; }
    /* Section */
    section { margin-bottom: 40px; }
    .section-label {
      font-size: 13px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--secondary);
      margin-bottom: 16px;
    }
    /* KPI cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
    }
    .kpi-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px 24px;
    }
    .kpi-value {
      font-size: 28px;
      font-weight: 700;
      font-variant-numeric: tabular-nums lining-nums;
      line-height: 1.2;
      margin-bottom: 6px;
      word-break: break-all;
    }
    .kpi-label {
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--on-surface-muted);
    }
    .color-positive { color: var(--positive); }
    .color-negative { color: var(--negative); }
    .color-neutral  { color: var(--on-surface); }
    /* Table */
    .table-wrapper {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: white;
      font-size: 13px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--secondary);
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    tbody tr:nth-child(odd)  { background: var(--surface); }
    tbody tr:nth-child(even) { background: var(--surface-variant); }
    tbody tr:hover    { background: var(--surface-variant); }
    tbody tr:focus    { outline: 2px solid var(--primary); outline-offset: -2px; }
    tbody tr.selected { border-left: 2px solid var(--primary); }
    td {
      padding: 12px 16px;
      font-size: 14px;
      vertical-align: middle;
      border-bottom: none;
    }
    .text-right  { text-align: right; }
    .text-center { text-align: center; }
    .text-muted  { color: var(--on-surface-muted); }
    .amount {
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    tfoot tr { background: white !important; }
    tfoot td {
      font-weight: 600;
      border-top: 2px solid var(--border);
      padding: 12px 16px;
      font-variant-numeric: tabular-nums lining-nums;
    }
    .empty-row td {
      text-align: center;
      color: var(--on-surface-muted);
      padding: 40px 16px;
    }
    /* Badges */
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
    }
    .badge-paid    { background: #DCFCE7; color: #166534; }
    .badge-pending { background: #FEF3C7; color: #92400E; }
    .badge-overdue { background: #FEE2E2; color: #991B1B; }
    .badge-draft   { background: #F1F5F9; color: #475569; }
    /* Pagination */
    .pagination {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      align-items: center;
      margin-top: 12px;
      font-size: 13px;
      color: var(--on-surface-muted);
    }
    .pagination a {
      color: var(--primary);
      text-decoration: none;
      padding: 4px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: white;
    }
    .pagination a:hover { background: var(--surface-variant); }
    .pagination a:focus { outline: 2px solid var(--primary); outline-offset: 1px; }
    /* Health */
    .health-grid { display: flex; gap: 16px; flex-wrap: wrap; }
    .health-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 200px;
    }
    .health-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dot-ok      { background: var(--positive); }
    .dot-warning { background: var(--warning); }
    .dot-error   { background: var(--negative); }
    .health-info { display: flex; flex-direction: column; gap: 2px; }
    .health-count {
      font-weight: 600;
      font-size: 20px;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    .health-label { font-size: 13px; color: var(--on-surface-muted); }
    .health-sublabel { font-size: 12px; color: var(--warning); }
    .health-sublabel-error { font-size: 12px; color: var(--negative); }
    /* Error banner */
    .error-banner {
      background: #FEE2E2;
      border: 1px solid #FECACA;
      border-radius: var(--radius);
      padding: 12px 16px;
      margin-bottom: 24px;
      font-size: 14px;
      color: var(--error);
    }
    /* Actions */
    .actions { display: flex; gap: 12px; margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--border); }
    .btn-primary {
      background: var(--primary);
      color: white;
      border: none;
      border-radius: var(--radius);
      padding: 10px 20px;
      font-family: inherit;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: none;
    }
    .btn-primary:hover:not(:disabled) { background: #1e40af; }
    .btn-primary:focus { outline: 2px solid var(--primary); outline-offset: 2px; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary {
      background: white;
      color: var(--on-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 20px;
      font-family: inherit;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-secondary:hover { background: var(--surface-variant); }
    .btn-secondary:focus { outline: 2px solid var(--primary); outline-offset: 2px; }
    /* Responsive */
    @media (max-width: 768px) {
      .page { padding: 16px; }
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .health-grid { flex-direction: column; }
      .actions { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="page">

    <header>
      <div>
        <h1>ProLedger</h1>
        <p class="page-period">Exercice fiscal {{ year }}</p>
      </div>
      <form method="get" action="/" class="year-form" role="search" aria-label="Filtre par année">
        <label for="year-select" class="year-label">Année</label>
        <select id="year-select" name="year" class="year-select"
                onchange="this.form.submit()"
                aria-label="Sélectionner l'année fiscale">
          {% for y in years %}
            <option value="{{ y }}"{% if y == year %} selected{% endif %}>{{ y }}</option>
          {% endfor %}
        </select>
      </form>
    </header>

    {% if run_error %}
    <div class="error-banner" role="alert" aria-live="assertive">
      <strong>Erreur pipeline :</strong> {{ run_error }}
    </div>
    {% endif %}

    <main>

      {# ── Bloc 1 : Synthèse fiscale ────────────────────────────────────── #}
      <section aria-label="Synthèse fiscale {{ year }}">
        <p class="section-label">Synthèse fiscale</p>
        <div class="kpi-grid">

          <div class="kpi-card">
            <div class="kpi-value color-positive">{{ summary.ca_ht | fr_currency }}</div>
            <div class="kpi-label">CA HT</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-value {% if summary.tva_collectee > 0 %}color-positive{% else %}color-neutral{% endif %}">
              {{ summary.tva_collectee | fr_currency }}
            </div>
            <div class="kpi-label">TVA collectée</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-value color-neutral">{{ summary.tva_deductible | fr_currency }}</div>
            <div class="kpi-label">TVA déductible</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-value {% if summary.tva_a_reverser > 0 %}color-positive{% elif summary.tva_a_reverser < 0 %}color-negative{% else %}color-neutral{% endif %}">
              {{ summary.tva_a_reverser | fr_currency }}
            </div>
            <div class="kpi-label">TVA à reverser</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-value color-negative">{{ summary.total_charges | fr_currency }}</div>
            <div class="kpi-label">Total charges</div>
          </div>

        </div>
      </section>

      {# ── Bloc 2 : Ledger ──────────────────────────────────────────────── #}
      <section aria-label="Ledger {{ year }}">
        <p class="section-label">Ledger — {{ ledger.total_count }} entrée{{ 's' if ledger.total_count != 1 }}</p>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Fournisseur / Client</th>
                <th scope="col" class="text-right">Débit HT</th>
                <th scope="col" class="text-right">Crédit HT</th>
                <th scope="col" class="text-right">TVA</th>
                <th scope="col" class="text-center">Statut</th>
                <th scope="col" class="text-center">Type</th>
              </tr>
            </thead>
            <tbody>
              {% for row in ledger.rows %}
              {% set is_expense = row.type_document in expense_types %}
              {% set party = row.émetteur_nom if is_expense else row.destinataire_nom %}
              <tr tabindex="0">
                <td>{{ row.date_document or '—' }}</td>
                <td>{{ party or '—' }}</td>
                <td class="text-right amount{% if is_expense and row.montant_ht %} color-negative{% endif %}">
                  {%- if is_expense and row.montant_ht -%}{{ row.montant_ht | fr_currency }}{%- else -%}—{%- endif -%}
                </td>
                <td class="text-right amount{% if not is_expense and row.montant_ht %} color-positive{% endif %}">
                  {%- if not is_expense and row.montant_ht -%}{{ row.montant_ht | fr_currency }}{%- else -%}—{%- endif -%}
                </td>
                <td class="text-right amount">{{ (row.montant_tva or 0) | fr_currency }}</td>
                <td class="text-center">
                  {% set s = row.statut_révision %}
                  {% if s in ('validé', 'auto_validé') %}
                    <span class="badge badge-paid">Validé</span>
                  {% elif s == 'à_réviser' %}
                    <span class="badge badge-pending">À réviser</span>
                  {% elif s == 'erreur' %}
                    <span class="badge badge-overdue">Erreur</span>
                  {% else %}
                    <span class="badge badge-draft">{{ s }}</span>
                  {% endif %}
                </td>
                <td class="text-center text-muted">{{ row.type_document or '—' }}</td>
              </tr>
              {% else %}
              <tr class="empty-row">
                <td colspan="7">Aucune facture pour {{ year }}.</td>
              </tr>
              {% endfor %}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2"><strong>Total {{ year }}</strong></td>
                <td class="text-right amount color-negative">{{ ledger.total_debit | fr_currency }}</td>
                <td class="text-right amount color-positive">{{ ledger.total_credit | fr_currency }}</td>
                <td colspan="3"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {% if ledger.total_pages > 1 %}
        <nav class="pagination" aria-label="Pagination du ledger">
          {% if ledger.page > 1 %}
            <a href="/?year={{ year }}&page={{ ledger.page - 1 }}" aria-label="Page précédente">‹ Préc.</a>
          {% endif %}
          <span>Page {{ ledger.page }} / {{ ledger.total_pages }}</span>
          {% if ledger.page < ledger.total_pages %}
            <a href="/?year={{ year }}&page={{ ledger.page + 1 }}" aria-label="Page suivante">Suiv. ›</a>
          {% endif %}
        </nav>
        {% endif %}
      </section>

      {# ── Bloc 3 : Santé ───────────────────────────────────────────────── #}
      <section aria-label="Vue de santé du workspace">
        <p class="section-label">Santé</p>
        <div class="health-grid">

          <div class="health-card">
            <div class="health-dot {{ 'dot-error' if health.pending_files > 0 else 'dot-ok' }}"
                 aria-hidden="true"></div>
            <div class="health-info">
              <div class="health-count">{{ health.pending_files }}</div>
              <div class="health-label">Fichier{{ 's' if health.pending_files != 1 }} en attente</div>
              {% if health.pending_files > 0 %}
              <div class="health-sublabel-error">À traiter — lancer le pipeline</div>
              {% endif %}
            </div>
          </div>

          <div class="health-card">
            <div class="health-dot {{ 'dot-warning' if health.items_a_reviser > 0 else 'dot-ok' }}"
                 aria-hidden="true"></div>
            <div class="health-info">
              <div class="health-count">{{ health.items_a_reviser }}</div>
              <div class="health-label">Item{{ 's' if health.items_a_reviser != 1 }} à réviser</div>
              {% if health.items_a_reviser > 0 %}
              <div class="health-sublabel">Action requise</div>
              {% endif %}
            </div>
          </div>

          <div class="health-card">
            <div class="health-dot {{ 'dot-error' if health.error_files > 0 else 'dot-ok' }}"
                 aria-hidden="true"></div>
            <div class="health-info">
              <div class="health-count">{{ health.error_files }}</div>
              <div class="health-label">Fichier{{ 's' if health.error_files != 1 }} en erreur</div>
              {% if health.error_files > 0 %}
              <div class="health-sublabel-error">Vérifier errors/</div>
              {% endif %}
            </div>
          </div>

        </div>
      </section>

    </main>

    {# ── Actions ──────────────────────────────────────────────────────────── #}
    <div class="actions">
      <form method="post" action="/run" id="run-form">
        <button type="submit" class="btn-primary" id="run-btn"
                aria-label="Lancer le pipeline de traitement des factures">
          Lancer le pipeline
        </button>
      </form>
      {% if health.items_a_reviser > 0 %}
      <form method="post" action="/open-review">
        <button type="submit" class="btn-secondary"
                aria-label="Ouvrir le fichier review.csv pour révision manuelle">
          Ouvrir review.csv
        </button>
      </form>
      {% endif %}
    </div>

  </div>

  <script>
    // Spinner sur le bouton pipeline — pas d'animation sur les données financières
    document.getElementById('run-form').addEventListener('submit', function () {
      var btn = document.getElementById('run-btn');
      btn.disabled = true;
      btn.textContent = 'Pipeline en cours…';
    });

    // Navigation clavier sur les lignes de la table
    document.querySelectorAll('tbody tr[tabindex]').forEach(function (row) {
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { row.classList.toggle('selected'); }
        if (e.key === 'Escape') { row.classList.remove('selected'); }
      });
    });
  </script>
</body>
</html>
```

- [ ] **Step 4.2 — Tester visuellement avec les données de démo**

```bash
cd invoice-manager && python demo/run_all.py   # génère des données de test
python dashboard.py --port 7800
```

Ouvrir http://localhost:7800 et vérifier :
- [ ] 5 KPI cards visibles avec montants formatés `x xxx,xx €`
- [ ] Table avec zebra striping, header sticky, badges colorés
- [ ] Pied de table avec totaux débit / crédit
- [ ] Bloc santé avec 3 indicateurs (dot vert / orange / rouge + label texte)
- [ ] Bouton "Lancer le pipeline" en bleu primary
- [ ] Responsive : réduire la fenêtre < 768px → grid 2 colonnes

- [ ] **Step 4.3 — Relancer la suite de tests**

```bash
cd invoice-manager && python -m pytest tests/test_dashboard.py -v
```
Attendu : `10 passed` (les tests GET vérifient maintenant le vrai template)

- [ ] **Step 4.4 — Commit**

```bash
git add invoice-manager/templates/dashboard.html
git commit -m "feat(dashboard): implement full ProLedger HTML template"
```

---

## Task 5 — Mise à jour README + commit final

**Files:**
- Modify: `invoice-manager/README.md`

- [ ] **Step 5.1 — Ajouter la section Dashboard dans le README**

Trouver la section `## Roadmap` dans `invoice-manager/README.md` et insérer **avant** cette section :

```markdown
## Dashboard local

Lance un serveur web local pour visualiser les données en temps réel.

```bash
# Depuis ton dossier de travail (même que pour run.py)
python /chemin/vers/dashboard.py
# → http://localhost:7800
```

Options :

```bash
python dashboard.py --port 8080              # changer le port
python dashboard.py --config ~/compta/config.toml
```

Le dashboard affiche :
- **Synthèse fiscale** : CA HT, TVA collectée/déductible/à reverser, total charges
- **Ledger** : toutes les factures de l'année, paginées (50 / page)
- **Santé** : fichiers en attente, items à réviser, erreurs

Actions disponibles : lancer le pipeline, ouvrir `review.csv`.

Prérequis : `pip install flask`

```

- [ ] **Step 5.2 — Mettre à jour la ligne Phase 1C dans la Roadmap**

Localiser dans `README.md` :
```
- **Phase 1C** — Watcher automatique (surveille `input/` en continu) + dashboard web local
```

Remplacer par :
```
- **Phase 1C** — ✅ Dashboard web local (`python dashboard.py` → http://localhost:7800)
- **Phase 1D** — Watcher automatique (surveille `input/` en continu, thread `watchdog` dans `dashboard.py`)
- **Phase 1E** — Actions complètes : révision inline dans le dashboard (sans passer par `review.csv`)
```

- [ ] **Step 5.3 — Vérifier la suite de tests complète**

```bash
cd invoice-manager && python -m pytest tests/ -v
```
Attendu : tous les tests passent (dont les tests existants extract, review, export, config).

- [ ] **Step 5.4 — Commit final**

```bash
git add invoice-manager/README.md invoice-manager/dashboard.py invoice-manager/templates/ invoice-manager/tests/test_dashboard.py
git commit -m "feat(invoice-manager): Phase 1C dashboard web local

- Flask app on port 7800 with fiscal summary, paginated ledger, health view
- ProLedger design system applied (Inter, tabular-nums, badge variants)
- Basic actions: run pipeline, open review.csv
- 10 tests covering data queries and all routes
- README updated with usage and roadmap"
git push
```
