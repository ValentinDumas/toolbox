"""
dashboard.py — Dashboard web local pour invoice-manager.
Usage: python dashboard.py [--config FILE] [--port PORT]
"""
import argparse
import os
import platform
import shutil
import sqlite3
import subprocess
import sys
import threading
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

from constants import (
    CONFIDENCE_THRESHOLD, INCOME_TYPES, EXPENSE_TYPES,
    STATUT_A_REVISER, STATUT_VALIDE, STATUT_PRET, VALIDATED_STATUSES,
)
from db import get_extraction_cfg, get_known_emitters, get_user_profile, open_db
from profiles import (
    create_profile, get_profile_meta, load_profiles, maybe_migrate_legacy, resolve_paths,
)


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

    ph_v = ",".join("?" * len(VALIDATED_STATUSES))
    total_charges = conn.execute(
        f"SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph}) AND statut_révision IN ({ph_v}) AND deleted_at IS NULL",
        (year, *EXPENSE_TYPES, *VALIDATED_STATUSES),
    ).fetchone()[0] or 0.0
    row_revision = conn.execute(
        f"SELECT COUNT(*), COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph}) AND statut_révision=? AND deleted_at IS NULL",
        (year, *EXPENSE_TYPES, STATUT_A_REVISER),
    ).fetchone()
    nb_charges_revision = row_revision[0] or 0
    total_charges_revision = row_revision[1] or 0.0

    return {
        "ca_ht": ca_ht,
        "tva_collectee": tva_collectee,
        "tva_deductible": tva_deductible,
        "tva_a_reverser": round(tva_collectee - tva_deductible, 2),
        "total_charges": total_charges,
        "total_charges_revision": total_charges_revision,
        "nb_charges_revision": nb_charges_revision,
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


def query_health(conn: sqlite3.Connection, paths: dict) -> dict:
    """Retourne les indicateurs de santé du workspace."""
    def count_files(key):
        dir_path = paths[key]
        if not dir_path.exists():
            return 0
        return sum(1 for f in dir_path.iterdir() if f.is_file() and not f.name.startswith("."))

    items_a_reviser = conn.execute(
        "SELECT COUNT(*) FROM invoices WHERE statut_révision=? AND deleted_at IS NULL",
        (STATUT_A_REVISER,),
    ).fetchone()[0]
    validés_count = conn.execute(
        "SELECT COUNT(*) FROM invoices WHERE statut_révision=? AND deleted_at IS NULL",
        (STATUT_VALIDE,),
    ).fetchone()[0]

    return {
        "pending_files": count_files("input"),
        "items_a_reviser": items_a_reviser,
        "validés_count": validés_count,
        "error_files": count_files("errors"),
    }


def query_error_files(paths: dict) -> list[dict]:
    errors_dir = paths["errors"]
    if not errors_dir.exists():
        return []
    files = []
    for f in sorted(errors_dir.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file() and not f.name.startswith("."):
            stat = f.stat()
            files.append({
                "name": f.name,
                "size_kb": round(stat.st_size / 1024, 1),
                "mtime": datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m/%Y %H:%M"),
            })
    return files


def query_items_a_reviser(conn: sqlite3.Connection, year: int) -> list:
    """Retourne les items à réviser pour l'année donnée."""
    rows = conn.execute(
        "SELECT id, type_document, montant_ht, montant_tva, montant_ttc, "
        "date_document, émetteur_nom, numéro_facture, catégorie, notes_correction, "
        "confiance, fichier_source, texte_brut, statut_révision "
        "FROM invoices WHERE statut_révision=? AND deleted_at IS NULL "
        "AND exercice_fiscal=? "
        "ORDER BY date_document",
        (STATUT_A_REVISER, year),
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
    formatted = f"{abs(value):,.2f}"
    formatted = formatted.replace(",", "X").replace(".", ",").replace("X", " ")
    formatted += " €"
    return f"({formatted})" if neg else formatted


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


def create_app() -> "Flask":
    from urllib.parse import quote

    from flask import Flask, jsonify, redirect, render_template, render_template_string, request, session, url_for

    app = Flask(__name__, template_folder=str(HERE / "templates"))
    app.secret_key = os.environ.get("SECRET_KEY") or os.urandom(24)
    app.jinja_env.filters["fr_currency"] = _fr_currency
    app.jinja_env.filters["basename"] = lambda p: os.path.basename(p) if p else ""

    def _active_slug() -> str | None:
        return session.get("active_profile")

    def _active_paths() -> dict | None:
        slug = _active_slug()
        return resolve_paths(slug) if slug else None

    def _active_db() -> Path | None:
        paths = _active_paths()
        return paths["db"] if paths else None

    def _get_profile():
        db = _active_db()
        if db is None:
            return None
        conn = open_db(db)
        profile = get_user_profile(conn)
        conn.close()
        return profile

    @app.context_processor
    def inject_profile_context():
        return {
            "all_profiles": load_profiles(),
            "active_slug": _active_slug(),
        }

    _PROFILE_EXEMPT = {"setup", "static", "profiles_list", "profiles_create", "profiles_switch", "upload"}

    @app.before_request
    def require_setup():
        if request.endpoint in _PROFILE_EXEMPT:
            return
        profiles = load_profiles()
        if not profiles:
            return redirect(url_for("profiles_list"))
        if not _active_slug() or not get_profile_meta(_active_slug()):
            session["active_profile"] = profiles[0]["slug"]
        if _get_profile() is None:
            return redirect(url_for("setup"))

    # ── Gestion des profils ────────────────────────────────────────────────────

    _FIRST_PROFILE_PAGE = """<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Bienvenue — Invoice Manager</title>
<style>
body{font-family:system-ui,sans-serif;max-width:480px;margin:120px auto;padding:0 24px;color:#0F172A}
h1{font-size:22px;font-weight:600;margin-bottom:8px}
p{color:#64748B;margin-bottom:28px;line-height:1.5}
label{display:block;font-size:14px;font-weight:500;margin-bottom:6px}
input{width:100%;padding:10px 12px;border:1px solid #E2E8F0;border-radius:6px;font-size:15px;
      font-family:inherit;box-sizing:border-box}
input:focus{outline:2px solid #1C4ED8;outline-offset:1px}
button{width:100%;margin-top:16px;padding:10px;background:#1C4ED8;color:white;border:none;
       border-radius:6px;font-size:15px;font-weight:600;cursor:pointer}
button:hover{background:#1D4ED8cc}
</style></head><body>
<h1>Bienvenue dans Invoice Manager</h1>
<p>Commencez par nommer votre première entité légale (ex : SASU Dupont, Micro-entreprise...).</p>
<form method="post" action="/profiles/create">
  <label for="name">Nom de l'entité</label>
  <input type="text" id="name" name="name" required autofocus placeholder="Ex : SASU Dupont">
  <button type="submit">Créer et configurer →</button>
</form>
</body></html>"""

    @app.route("/profiles")
    def profiles_list():
        profiles = load_profiles()
        if profiles:
            if not _active_slug():
                session["active_profile"] = profiles[0]["slug"]
            return redirect(url_for("index"))
        return render_template_string(_FIRST_PROFILE_PAGE)

    @app.route("/profiles/create", methods=["POST"])
    def profiles_create():
        name = request.form.get("name", "").strip()
        if not name:
            return redirect(url_for("profiles_list"))
        entry = create_profile(name)
        session["active_profile"] = entry["slug"]
        return redirect(url_for("setup"))

    @app.route("/profiles/switch/<slug>", methods=["POST"])
    def profiles_switch(slug):
        if get_profile_meta(slug):
            session["active_profile"] = slug
        return redirect(url_for("index"))

    # ── Upload ─────────────────────────────────────────────────────────────────

    @app.route("/upload", methods=["POST"])
    def upload():
        slug = _active_slug()
        if not slug:
            return jsonify({"ok": False, "error": "Aucun profil actif"}), 400
        paths = resolve_paths(slug)
        input_dir = paths["input"]
        input_dir.mkdir(parents=True, exist_ok=True)

        files = request.files.getlist("files")
        if not files or all(not f.filename for f in files):
            return jsonify({"ok": False, "error": "Aucun fichier reçu"}), 400

        saved = []
        for f in files:
            if f.filename:
                dest = input_dir / Path(f.filename).name
                f.save(dest)
                saved.append(f.filename)

        def _run_extraction():
            subprocess.run(
                [sys.executable, str(HERE / "run.py"), "--profile", slug],
                cwd=str(HERE),
                capture_output=True,
            )

        threading.Thread(target=_run_extraction, daemon=True).start()
        return jsonify({"ok": True, "files": saved, "count": len(saved)})

    @app.route("/errors/<filename>/retry", methods=["POST"])
    def errors_retry(filename):
        slug = _active_slug()
        if not slug:
            return jsonify({"ok": False, "error": "Aucun profil actif"}), 400
        paths = resolve_paths(slug)
        src = paths["errors"] / Path(filename).name
        if not src.is_file():
            return jsonify({"ok": False, "error": "Fichier introuvable"}), 404
        dest = paths["input"] / src.name
        shutil.move(str(src), dest)

        def _run():
            subprocess.run(
                [sys.executable, str(HERE / "run.py"), "--profile", slug],
                cwd=str(HERE), capture_output=True,
            )

        threading.Thread(target=_run, daemon=True).start()
        return jsonify({"ok": True})

    @app.route("/errors/<filename>/delete", methods=["POST"])
    def errors_delete(filename):
        slug = _active_slug()
        if not slug:
            return jsonify({"ok": False, "error": "Aucun profil actif"}), 400
        year = request.form.get("year", datetime.now().year)
        paths = resolve_paths(slug)
        target = paths["errors"] / Path(filename).name
        if not target.is_file():
            return jsonify({"ok": False, "error": "Fichier introuvable"}), 404
        target.unlink()
        return redirect(f"/?year={year}")

    @app.route("/purge-dead-links", methods=["POST"])
    def purge_dead_links():
        slug = _active_slug()
        if not slug:
            return jsonify({"ok": False, "error": "Aucun profil actif"}), 400
        paths = resolve_paths(slug)
        conn = open_db(paths["db"])
        rows = conn.execute(
            "SELECT id, fichier_source FROM invoices WHERE fichier_source IS NOT NULL"
        ).fetchall()
        purged = 0
        for row in rows:
            basename = Path(row["fichier_source"]).name
            found = any(
                (paths[d] / basename).is_file()
                for d in ("processed", "errors", "input")
                if paths[d].exists()
            )
            if not found:
                conn.execute(
                    "UPDATE invoices SET fichier_source=NULL WHERE id=?", (row["id"],)
                )
                purged += 1
        conn.commit()
        conn.close()
        return jsonify({"ok": True, "purged": purged})

    @app.route("/setup", methods=["GET", "POST"])
    def setup():
        conn = open_db(_active_db())
        error = None
        step = request.args.get("step", "siren")

        if request.method == "POST":
            step = request.form.get("step", "siren")
            if step == "siren":
                siren = request.form.get("siren", "").strip().replace(" ", "")
                if not siren or not siren.isdigit() or len(siren) != 9:
                    error = "SIREN invalide — 9 chiffres requis."
                else:
                    conn.execute(
                        "INSERT INTO user_profile (id, siren) VALUES (1, ?) "
                        "ON CONFLICT(id) DO UPDATE SET siren=excluded.siren",
                        (siren,),
                    )
                    conn.commit()
                    conn.close()
                    return redirect(url_for("setup", step="fiscal"))
            elif step == "fiscal":
                fiscal = request.form.get("fiscal_profile", "").strip()
                valid = ("auto-entrepreneur", "SASU", "SARL", "salarié")
                if fiscal not in valid:
                    error = "Profil fiscal invalide."
                else:
                    conn.execute(
                        "INSERT INTO user_profile (id, fiscal_profile, setup_complete) VALUES (1, ?, 1) "
                        "ON CONFLICT(id) DO UPDATE SET fiscal_profile=excluded.fiscal_profile, setup_complete=1",
                        (fiscal,),
                    )
                    conn.commit()
                    conn.close()
                    return redirect(url_for("index"))

        existing = conn.execute("SELECT * FROM user_profile WHERE id=1").fetchone()
        conn.close()
        return render_template("setup.html", step=step, error=error, existing=existing)

    @app.route("/settings")
    def settings():
        conn = open_db(_active_db())
        profile = get_user_profile(conn)
        emitters = conn.execute("SELECT * FROM known_emitters ORDER BY keyword").fetchall()
        conn.close()
        section = request.args.get("section", "profil")
        conn2 = open_db(_active_db())
        extraction_cfg = get_extraction_cfg(conn2)
        conn2.close()
        from config import CADENCE_DEFAULTS
        return render_template(
            "settings.html",
            profile=profile,
            emitters=emitters,
            section=section,
            cadence_defaults=CADENCE_DEFAULTS,
            extraction_cfg=extraction_cfg,
        )

    @app.route("/settings/profil", methods=["POST"])
    def settings_profil_save():
        data = {
            "nom":            request.form.get("nom", "").strip(),
            "siren":          request.form.get("siren", "").strip().replace(" ", ""),
            "tva_intracom":   request.form.get("tva_intracom", "").strip(),
            "fiscal_profile": request.form.get("fiscal_profile", "").strip(),
            "cadence":        request.form.get("cadence", "").strip(),
        }
        conn = open_db(_active_db())
        conn.execute(
            "INSERT INTO user_profile (id, nom, siren, tva_intracom, fiscal_profile, cadence, setup_complete) "
            "VALUES (1, :nom, :siren, :tva_intracom, :fiscal_profile, :cadence, 1) "
            "ON CONFLICT(id) DO UPDATE SET "
            "nom=excluded.nom, siren=excluded.siren, tva_intracom=excluded.tva_intracom, "
            "fiscal_profile=excluded.fiscal_profile, cadence=excluded.cadence",
            data,
        )
        conn.commit()
        conn.close()
        return redirect(url_for("settings", section="profil"))

    @app.route("/settings/enseignes/add", methods=["POST"])
    def settings_enseignes_add():
        keyword = request.form.get("keyword", "").strip().lower()
        nom = request.form.get("nom", "").strip()
        if keyword and nom:
            conn = open_db(_active_db())
            try:
                conn.execute("INSERT INTO known_emitters (keyword, nom) VALUES (?, ?)", (keyword, nom))
                conn.commit()
            except Exception:
                pass
            conn.close()
        return redirect(url_for("settings", section="enseignes"))

    @app.route("/settings/enseignes/<int:emitter_id>/delete", methods=["POST"])
    def settings_enseignes_delete(emitter_id):
        conn = open_db(_active_db())
        conn.execute("DELETE FROM known_emitters WHERE id=?", (emitter_id,))
        conn.commit()
        conn.close()
        return redirect(url_for("settings", section="enseignes"))

    @app.route("/settings/app", methods=["POST"])
    def settings_app_save():
        def _bool(key): return 1 if request.form.get(key) else 0
        def _float(key, default):
            try: return float(request.form.get(key, default))
            except ValueError: return default
        def _int(key, default):
            try: return int(request.form.get(key, default))
            except ValueError: return default

        conn = open_db(_active_db())
        conn.execute(
            "INSERT INTO user_profile (id, ocr_backend, ocr_confidence_threshold, ocr_lang, "
            "ocr_dpi, ocr_preprocess, ocr_easyocr_fallback, ocr_easyocr_threshold, setup_complete) "
            "VALUES (1, ?, ?, ?, ?, ?, ?, ?, 1) "
            "ON CONFLICT(id) DO UPDATE SET "
            "ocr_backend=excluded.ocr_backend, "
            "ocr_confidence_threshold=excluded.ocr_confidence_threshold, "
            "ocr_lang=excluded.ocr_lang, ocr_dpi=excluded.ocr_dpi, "
            "ocr_preprocess=excluded.ocr_preprocess, "
            "ocr_easyocr_fallback=excluded.ocr_easyocr_fallback, "
            "ocr_easyocr_threshold=excluded.ocr_easyocr_threshold",
            (
                request.form.get("backend", "local"),
                _float("confidence_threshold", 0.8),
                request.form.get("ocr_lang", "fra+eng").strip(),
                _int("ocr_dpi", 300),
                _bool("ocr_preprocess"),
                _bool("ocr_easyocr_fallback"),
                _float("ocr_easyocr_threshold", 0.4),
            ),
        )
        conn.commit()
        conn.close()
        return redirect(url_for("settings", section="app"))

    @app.route("/")
    def index():
        year = request.args.get("year", datetime.now().year, type=int)
        page = request.args.get("page", 1, type=int)
        run_error = request.args.get("run_error")
        review_error = request.args.get("review_error")
        try:
            paths = _active_paths()
            conn = open_db(_active_db())
            summary = query_fiscal_summary(conn, year)
            ledger = query_ledger(conn, year, page=page)
            health = query_health(conn, paths)
            items_a_reviser_list = query_items_a_reviser(conn, year)
            corbeille_list = query_corbeille(conn, year)
            errors_list = query_error_files(paths)
            years = [r[0] for r in conn.execute(
                "SELECT DISTINCT exercice_fiscal FROM invoices ORDER BY exercice_fiscal DESC"
            ).fetchall()] or [datetime.now().year]
            profile = get_user_profile(conn) or {}
            conn.close()
        except sqlite3.DatabaseError as exc:
            return render_template_string(_ERROR_TMPL, message=str(exc), hint="python run.py"), 500

        profile_incomplete = not (profile.get("nom") and profile.get("tva_intracom"))

        return render_template(
            "dashboard.html",
            year=year,
            years=years,
            summary=summary,
            ledger=ledger,
            health=health,
            items_a_reviser_list=items_a_reviser_list,
            corbeille_list=corbeille_list,
            errors_list=errors_list,
            run_error=run_error,
            review_error=review_error,
            expense_types=EXPENSE_TYPES,
            doc_types=("facture_émise", "facture_reçue", "reçu", "note_de_frais", "avoir", "devis"),
            profile=profile,
            profile_incomplete=profile_incomplete,
        )

    @app.route("/run", methods=["POST"])
    def run_pipeline():
        year = request.form.get("year", datetime.now().year)
        slug = _active_slug()
        result = subprocess.run(
            [sys.executable, str(HERE / "run.py"), "--profile", slug],
            capture_output=True,
            text=True,
            cwd=str(HERE),
            stdin=subprocess.DEVNULL,
        )
        if result.returncode != 0:
            error_snippet = result.stderr[-500:] if result.stderr else "Erreur inconnue"
            return redirect(f"/?year={year}&run_error={quote(error_snippet)}")
        return redirect(f"/?year={year}")

    @app.route("/open-review", methods=["POST"])
    def open_review():
        year = request.form.get("year", datetime.now().year)
        try:
            conn = open_db(_active_db())
            count = conn.execute(
                "SELECT COUNT(*) FROM invoices WHERE statut_révision=?",
                (STATUT_A_REVISER,),
            ).fetchone()[0]
            conn.close()
        except sqlite3.DatabaseError:
            return redirect(f"/?year={year}")

        if count == 0:
            return redirect(f"/?year={year}")

        review_csv = _active_paths()["review"] / "review.csv"
        cmd = "open" if platform.system() == "Darwin" else "xdg-open"
        subprocess.Popen([cmd, str(review_csv)])
        return redirect(f"/?year={year}")

    @app.route("/review/<item_id>/save", methods=["POST"])
    def review_save(item_id):
        import json
        from datetime import timezone
        from parsers import _confidence_score

        now = datetime.now(timezone.utc).isoformat()
        try:
            conn = open_db(_active_db())
            current = conn.execute("SELECT * FROM invoices WHERE id=?", (item_id,)).fetchone()
            if not current:
                conn.close()
                return jsonify({"ok": False, "errors": {"_base": "Item introuvable."}})

            current = dict(current)
            already_validated = current["statut_révision"] == STATUT_VALIDE

            fields = {}
            for field in ("type_document", "émetteur_nom", "numéro_facture",
                          "catégorie", "date_document", "notes_correction"):
                val = request.form.get(field, "").strip()
                if val:
                    fields[field] = val

            errors = {}
            for field in ("montant_ht", "montant_tva", "montant_ttc"):
                val = request.form.get(field, "").strip()
                if val:
                    try:
                        fields[field] = float(val.replace(",", "."))
                    except ValueError:
                        errors[field] = f"Montant invalide : {val}"

            if errors:
                conn.close()
                return jsonify({"ok": False, "errors": errors})

            # Validation : date requise pour exercice_fiscal
            has_date = fields.get("date_document") or conn.execute(
                "SELECT date_document FROM invoices WHERE id=? AND date_document IS NOT NULL", (item_id,)
            ).fetchone()
            if not has_date:
                errors["date_document"] = "Date du document requise pour apparaître dans le ledger"

            # Validation : au moins un montant requis
            has_amount = fields.get("montant_ht") or fields.get("montant_ttc")
            if not has_amount and not current.get("montant_ht") and not current.get("montant_ttc"):
                errors["montant_ht"] = "Au moins un montant (HT ou TTC) est requis"

            if errors:
                conn.close()
                return jsonify({"ok": False, "errors": errors})

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

            # Recalcul de la confiance avec les valeurs résultantes (form + DB fallback)
            date_val   = fields.get("date_document")  or current.get("date_document")
            ttc_val    = fields.get("montant_ttc")    or current.get("montant_ttc")
            ht_val     = fields.get("montant_ht")     or current.get("montant_ht")
            num_val    = fields.get("numéro_facture") or current.get("numéro_facture")
            fiscal_val = current.get("émetteur_siren") or current.get("émetteur_tva_intracom")
            new_confidence = _confidence_score(date_val, ttc_val, ht_val, num_val, fiscal_val)
            fields["confiance"] = round(new_confidence, 2)

            # Rétrogradation si item validé et confiance trop basse après correction
            warning = None
            if already_validated and new_confidence < CONFIDENCE_THRESHOLD:
                fields["statut_révision"] = STATUT_A_REVISER
                pct = int(new_confidence * 100)
                warning = f"Confiance recalculée à {pct}% — item retourné en « À réviser »."

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
                fields["statut_révision"] = STATUT_VALIDE
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
        except sqlite3.DatabaseError as e:
            return jsonify({"ok": False, "errors": {"_base": f"Erreur base de données : {e}"}})
        return jsonify({"ok": True, "warning": warning})

    @app.route("/review/<item_id>/validate", methods=["POST"])
    def review_validate(item_id):
        from datetime import timezone
        now = datetime.now(timezone.utc).isoformat()
        year = request.form.get("year", datetime.now().year)
        try:
            conn = open_db(_active_db())
            conn.execute(
                "UPDATE invoices SET statut_révision=?, révisé_par='user', "
                "date_révision=?, validé_le=? WHERE id=? AND statut_révision IN (?, ?)",
                (STATUT_VALIDE, now, now, item_id, STATUT_PRET, STATUT_A_REVISER),
            )
            conn.commit()
            conn.close()
        except sqlite3.DatabaseError:
            pass
        return redirect(f"/?year={year}")

    @app.route("/review/<item_id>/delete", methods=["POST"])
    def review_delete(item_id):
        from datetime import timezone
        now = datetime.now(timezone.utc).isoformat()
        year = request.form.get("year", datetime.now().year)
        try:
            conn = open_db(_active_db())
            conn.execute(
                "UPDATE invoices SET deleted_at=?, deleted_by='user' WHERE id=?",
                (now, item_id),
            )
            conn.commit()
            conn.close()
        except sqlite3.DatabaseError:
            pass
        return redirect(f"/?year={year}")

    @app.route("/review/<item_id>/restore", methods=["POST"])
    def review_restore(item_id):
        year = request.form.get("year", datetime.now().year)
        try:
            conn = open_db(_active_db())
            conn.execute(
                "UPDATE invoices SET deleted_at=NULL, deleted_by=NULL, "
                "statut_révision=?, révisé_par=NULL, "
                "date_révision=NULL, validé_le=NULL WHERE id=?",
                (STATUT_A_REVISER, item_id),
            )
            conn.commit()
            conn.close()
        except sqlite3.DatabaseError:
            pass
        return redirect(f"/?year={year}")

    @app.route("/review/<item_id>/reset", methods=["POST"])
    def review_reset(item_id):
        year = request.form.get("year", datetime.now().year)
        conn = open_db(_active_db())
        conn.execute(
            "UPDATE invoices SET statut_révision=?, révisé_par=NULL, "
            "date_révision=NULL, validé_le=NULL "
            "WHERE id=?",
            (STATUT_A_REVISER, item_id),
        )
        conn.commit()
        conn.close()
        return redirect(f"/?year={year}")

    @app.route("/reset-revises", methods=["POST"])
    def reset_revises():
        year = request.form.get("year", datetime.now().year)
        conn = open_db(_active_db())
        conn.execute(
            "UPDATE invoices SET statut_révision=?, révisé_par=NULL, "
            "date_révision=NULL, validé_le=NULL "
            "WHERE statut_révision=?",
            (STATUT_A_REVISER, STATUT_VALIDE),
        )
        conn.commit()
        conn.close()
        return redirect(f"/?year={year}")

    @app.route("/files/<path:filename>")
    def serve_file(filename):
        from flask import abort, send_file
        paths = _active_paths() or {}
        basename = Path(filename).name
        for subdir in ("processed", "errors", "input"):
            candidate = paths.get(subdir, HERE / subdir) / basename
            if candidate.is_file():
                suffix = candidate.suffix.lower()
                mime = "application/pdf" if suffix == ".pdf" else None
                return send_file(candidate, mimetype=mime, as_attachment=False)
        abort(404)

    @app.route("/preview/<path:filename>")
    def preview_file(filename):
        import io
        from flask import abort, send_file, Response
        paths = _active_paths() or {}
        basename = Path(filename).name
        for subdir in ("processed", "errors", "input"):
            candidate = paths.get(subdir, HERE / subdir) / basename
            if candidate.is_file():
                suffix = candidate.suffix.lower()
                if suffix == ".pdf":
                    return send_file(candidate, mimetype="application/pdf", as_attachment=False)
                if suffix in (".heic", ".heif"):
                    import pillow_heif
                    from PIL import Image
                    pillow_heif.register_heif_opener()
                    img = Image.open(candidate)
                    buf = io.BytesIO()
                    img.save(buf, format="JPEG", quality=85)
                    buf.seek(0)
                    return send_file(buf, mimetype="image/jpeg", as_attachment=False)
                if suffix in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
                    return send_file(candidate, as_attachment=False)
                abort(415)
        abort(404)

    return app


def main() -> None:
    parser = argparse.ArgumentParser(description="Dashboard local invoice-manager")
    parser.add_argument("--port", type=int, default=7800)
    args = parser.parse_args()

    migrated = maybe_migrate_legacy()
    if migrated:
        print(f"  [migration] data/invoices.db → profil '{migrated}'")

    app = create_app()
    print(f"  Dashboard : http://localhost:{args.port}")
    print("  Ctrl+C pour arrêter.")
    app.run(port=args.port, debug=os.getenv("FLASK_DEBUG", "0") == "1")


if __name__ == "__main__":
    main()
