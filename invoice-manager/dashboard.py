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


def _fr_currency(value) -> str:
    """Formate un float en monnaie française : 1 234,56 €. Négatif → (1 234,56 €)."""
    if value is None:
        value = 0.0
    neg = value < 0
    s = f"{abs(value):,.2f}"                                        # "1,234.56"
    s = s.replace(",", "X").replace(".", ",").replace("X", " ")  # "1 234,56"
    s += " €"
    return f"({s})" if neg else s


_ERROR_TMPL = """<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Erreur — ProLedger</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:80px auto;padding:0 24px;color:#0F172A}
h1{color:#B91C1C}pre{background:#F1F5F9;padding:12px;border-radius:6px;font-size:14px}</style>
</head><body>
<h1>Erreur base de données</h1>
<p>{{ message }}</p>
<p>Relancer le pipeline pour initialiser la base :</p>
<pre>{{ hint }}</pre>
</body></html>"""


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
            return render_template_string(_ERROR_TMPL, message=str(exc), hint="python run.py"), 500

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
