"""
dashboard.py — Dashboard web local pour invoice-manager.
Usage: python dashboard.py [--config FILE] [--port PORT]
"""
import argparse
import os
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
        "SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document=? AND deleted_at IS NULL",
        year, "facture_émise",
    )
    tva_collectee = scalar(
        "SELECT COALESCE(SUM(montant_tva),0) FROM invoices WHERE exercice_fiscal=? AND type_document=? AND deleted_at IS NULL",
        year, "facture_émise",
    )
    ph = ",".join("?" * len(EXPENSE_TYPES))
    tva_deductible = conn.execute(
        f"SELECT COALESCE(SUM(montant_tva),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph}) AND deleted_at IS NULL",
        (year, *EXPENSE_TYPES),
    ).fetchone()[0] or 0.0
    total_charges = conn.execute(
        f"SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph}) AND deleted_at IS NULL",
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
        "SELECT * FROM invoices WHERE exercice_fiscal=? AND deleted_at IS NULL ORDER BY date_document DESC LIMIT ? OFFSET ?",
        (year, per_page, offset),
    ).fetchall()
    total_count = conn.execute(
        "SELECT COUNT(*) FROM invoices WHERE exercice_fiscal=? AND deleted_at IS NULL", (year,)
    ).fetchone()[0]

    ph_in = ",".join("?" * len(INCOME_TYPES))
    ph_ex = ",".join("?" * len(EXPENSE_TYPES))
    total_credit = conn.execute(
        f"SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph_in}) AND deleted_at IS NULL",
        (year, *INCOME_TYPES),
    ).fetchone()[0] or 0.0
    total_debit = conn.execute(
        f"SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph_ex}) AND deleted_at IS NULL",
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
        return sum(1 for f in p.iterdir() if f.is_file() and not f.name.startswith("."))

    items_a_reviser = conn.execute(
        "SELECT COUNT(*) FROM invoices WHERE statut_révision='à_réviser' AND deleted_at IS NULL"
    ).fetchone()[0]
    auto_validés = conn.execute(
        "SELECT COUNT(*) FROM invoices WHERE statut_révision='auto_validé' AND deleted_at IS NULL"
    ).fetchone()[0]
    validés_count = conn.execute(
        "SELECT COUNT(*) FROM invoices WHERE statut_révision='validé' AND deleted_at IS NULL"
    ).fetchone()[0]

    return {
        "pending_files": count_files("input"),
        "items_a_reviser": items_a_reviser,
        "auto_validés": auto_validés,
        "validés_count": validés_count,
        "error_files": count_files("errors"),
    }


def query_items_a_reviser(conn: sqlite3.Connection, year: int) -> list:
    """Retourne les items non encore validés pour l'année donnée : à_réviser (prioritaires) puis auto_validé."""
    rows = conn.execute(
        "SELECT id, type_document, montant_ht, montant_tva, montant_ttc, "
        "date_document, émetteur_nom, numéro_facture, catégorie, notes_correction, "
        "confiance, fichier_source, texte_brut, statut_révision "
        "FROM invoices WHERE statut_révision IN ('à_réviser', 'auto_validé') AND deleted_at IS NULL "
        "AND exercice_fiscal=? "
        "ORDER BY CASE statut_révision WHEN 'à_réviser' THEN 0 ELSE 1 END, date_document",
        (year,),
    ).fetchall()
    return [dict(r) for r in rows]


def _query_validés(conn: sqlite3.Connection, year: int) -> list:
    """Retourne les items validés pour l'année donnée."""
    rows = conn.execute(
        "SELECT id, type_document, montant_ht, montant_tva, montant_ttc, "
        "date_document, émetteur_nom, numéro_facture, catégorie, notes_correction, "
        "confiance, fichier_source, texte_brut, statut_révision, corrections_log "
        "FROM invoices WHERE statut_révision='validé' AND deleted_at IS NULL "
        "AND exercice_fiscal=? ORDER BY date_document ASC",
        (year,),
    ).fetchall()
    return [dict(r) for r in rows]


def query_corbeille(conn: sqlite3.Connection, year: int) -> list:
    """Retourne les items soft-deleted pour l'année donnée."""
    rows = conn.execute(
        "SELECT id, fichier_source, émetteur_nom, montant_ttc, type_document, "
        "date_document, deleted_at "
        "FROM invoices WHERE deleted_at IS NOT NULL AND exercice_fiscal=? "
        "ORDER BY deleted_at DESC",
        (year,),
    ).fetchall()
    return [dict(r) for r in rows]


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

    import os

    app = Flask(__name__, template_folder=str(HERE / "templates"))
    app.jinja_env.filters["fr_currency"] = _fr_currency
    app.jinja_env.filters["basename"] = lambda p: os.path.basename(p) if p else ""

    @app.route("/")
    def index():
        year = request.args.get("year", datetime.now().year, type=int)
        page = request.args.get("page", 1, type=int)
        run_error = request.args.get("run_error")
        review_error = request.args.get("review_error")
        try:
            conn = open_db(db_path)
            summary = query_fiscal_summary(conn, year)
            ledger = query_ledger(conn, year, page=page)
            health = query_health(conn, cfg)
            items_a_reviser_list = query_items_a_reviser(conn, year)
            items_validés_list = _query_validés(conn, year)
            corbeille_list = query_corbeille(conn, year)
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
            items_a_reviser_list=items_a_reviser_list,
            items_validés_list=items_validés_list,
            corbeille_list=corbeille_list,
            run_error=run_error,
            review_error=review_error,
            expense_types=EXPENSE_TYPES,
            doc_types=("facture_émise", "facture_reçue", "reçu", "note_de_frais", "avoir", "devis"),
        )

    @app.route("/run", methods=["POST"])
    def run_pipeline():
        result = subprocess.run(
            [sys.executable, str(HERE / "run.py")],
            capture_output=True,
            text=True,
            cwd=str(HERE),
            stdin=subprocess.DEVNULL,
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

    @app.route("/review/<item_id>/save", methods=["POST"])
    def review_save(item_id):
        import json
        from datetime import timezone
        now = datetime.now(timezone.utc).isoformat()
        try:
            conn = open_db(db_path)
            current = conn.execute("SELECT * FROM invoices WHERE id=?", (item_id,)).fetchone()
            if not current:
                conn.close()
                return redirect("/")

            current = dict(current)
            already_validated = current["statut_révision"] == "validé"

            fields = {}
            for field in ("type_document", "émetteur_nom", "numéro_facture",
                          "catégorie", "date_document", "notes_correction"):
                val = request.form.get(field, "").strip()
                if val:
                    fields[field] = val

            for field in ("montant_ht", "montant_tva", "montant_ttc"):
                val = request.form.get(field, "").strip()
                if val:
                    try:
                        fields[field] = float(val.replace(",", "."))
                    except ValueError:
                        conn.close()
                        return redirect(f"/?review_error={quote('Montant invalide : ' + val)}")

            # Validation : date requise pour exercice_fiscal
            has_date = fields.get("date_document") or conn.execute(
                "SELECT date_document FROM invoices WHERE id=? AND date_document IS NOT NULL", (item_id,)
            ).fetchone()
            if not has_date:
                conn.close()
                return redirect(f"/?review_error={quote('Date du document requise pour apparaître dans le ledger')}")

            # Validation : au moins un montant requis
            has_amount = fields.get("montant_ht") or fields.get("montant_ttc")
            if not has_amount:
                if not current.get("montant_ht") and not current.get("montant_ttc"):
                    conn.close()
                    return redirect(f"/?review_error={quote('Au moins un montant (HT ou TTC) est requis')}")

            # Recompute exercice_fiscal
            date_doc = fields.get("date_document") or current.get("date_document")
            if date_doc:
                try:
                    fields["exercice_fiscal"] = int(str(date_doc)[:4])
                except (ValueError, IndexError):
                    pass

            # Sync montant_eur
            eur = fields.get("montant_ttc") or fields.get("montant_ht")
            if eur is not None:
                fields["montant_eur"] = eur

            if already_validated:
                # Post-validation correction — append diff to corrections_log
                log = json.loads(current.get("corrections_log") or "[]")
                for champ, new_val in fields.items():
                    old_val = current.get(champ)
                    if old_val != new_val:
                        log.append({"ts": now, "champ": champ, "avant": old_val, "après": new_val})
                fields["corrections_log"] = json.dumps(log, ensure_ascii=False)
                fields["date_révision"] = now
            else:
                fields["statut_révision"] = "validé"
                fields["révisé_par"] = "user"
                fields["date_révision"] = now
                fields["validé_le"] = now

            set_clause = ", ".join(f'"{k}" = ?' for k in fields)
            conn.execute(
                f"UPDATE invoices SET {set_clause} WHERE id = ?",
                list(fields.values()) + [item_id],
            )
            conn.commit()
            conn.close()
        except sqlite3.DatabaseError:
            pass
        return redirect("/")

    @app.route("/review/<item_id>/validate", methods=["POST"])
    def review_validate(item_id):
        from datetime import timezone
        now = datetime.now(timezone.utc).isoformat()
        try:
            conn = open_db(db_path)
            conn.execute(
                "UPDATE invoices SET statut_révision='validé', révisé_par='user', "
                "date_révision=?, validé_le=? WHERE id=? AND statut_révision IN ('prêt_à_valider', 'à_réviser')",
                (now, now, item_id),
            )
            conn.commit()
            conn.close()
        except sqlite3.DatabaseError:
            pass
        return redirect("/")

    @app.route("/review/<item_id>/delete", methods=["POST"])
    def review_delete(item_id):
        from datetime import timezone
        now = datetime.now(timezone.utc).isoformat()
        try:
            conn = open_db(db_path)
            conn.execute(
                "UPDATE invoices SET deleted_at=?, deleted_by='user' WHERE id=?",
                (now, item_id),
            )
            conn.commit()
            conn.close()
        except sqlite3.DatabaseError:
            pass
        return redirect("/")

    @app.route("/review/<item_id>/restore", methods=["POST"])
    def review_restore(item_id):
        try:
            conn = open_db(db_path)
            conn.execute(
                "UPDATE invoices SET deleted_at=NULL, deleted_by=NULL, "
                "statut_révision='à_réviser', révisé_par=NULL, "
                "date_révision=NULL, validé_le=NULL WHERE id=?",
                (item_id,),
            )
            conn.commit()
            conn.close()
        except sqlite3.DatabaseError:
            pass
        return redirect("/")

    @app.route("/review/<item_id>/reset", methods=["POST"])
    def review_reset(item_id):
        conn = open_db(db_path)
        conn.execute(
            "UPDATE invoices SET statut_révision='à_réviser', révisé_par=NULL, "
            "date_révision=NULL, validé_le=NULL "
            "WHERE id=?",
            (item_id,),
        )
        conn.commit()
        conn.close()
        return redirect("/")

    @app.route("/reset-revises", methods=["POST"])
    def reset_revises():
        conn = open_db(db_path)
        conn.execute(
            "UPDATE invoices SET statut_révision='à_réviser', révisé_par=NULL, "
            "date_révision=NULL, validé_le=NULL "
            "WHERE statut_révision='validé'"
        )
        conn.commit()
        conn.close()
        return redirect("/")

    @app.route("/files/<path:filename>")
    def serve_file(filename):
        from flask import abort, send_file
        basename = Path(filename).name
        for subdir in ("processed", "errors", "input"):
            candidate = HERE / subdir / basename
            if candidate.is_file():
                return send_file(candidate)
        abort(404)

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
    app.run(port=args.port, debug=os.getenv("FLASK_DEBUG", "0") == "1")


if __name__ == "__main__":
    main()
