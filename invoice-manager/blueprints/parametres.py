"""
blueprints/parametres.py — Contexte paramétrage : profil, enseignes connues, OCR.

Routes RESTful : /parametres pour l'index, sous-ressources pour profil/enseignes/ocr.
"""
import base64
import io
import sqlite3

from flask import (
    Blueprint, jsonify, redirect, render_template, request, url_for,
)

from context_helpers import active_db
from db import get_extraction_cfg, get_user_profile, open_db

bp_parametres = Blueprint("parametres", __name__)


@bp_parametres.route("/parametres")
def parametres_index():
    """GET /parametres — Affiche la page de paramètres."""
    conn = open_db(active_db())
    profile = get_user_profile(conn)
    emitters = conn.execute("SELECT * FROM known_emitters ORDER BY keyword").fetchall()
    extraction_cfg = get_extraction_cfg(conn)
    conn.close()
    section = request.args.get("section", "profil")
    saved = request.args.get("saved") == "1"
    from config import CADENCE_DEFAULTS, CADENCE_OPTIONS
    return render_template(
        "settings.html",
        profile=profile,
        emitters=emitters,
        section=section,
        saved=saved,
        cadence_defaults=CADENCE_DEFAULTS,
        cadence_options=CADENCE_OPTIONS,
        extraction_cfg=extraction_cfg,
    )


@bp_parametres.route("/parametres/profil", methods=["POST"])
def parametres_profil_sauver():
    """POST /parametres/profil — Sauvegarde le profil utilisateur (nom, SIREN, TVA, fiscal, cadence)."""
    data = {
        "nom":            request.form.get("nom", "").strip(),
        "siren":          request.form.get("siren", "").strip().replace(" ", ""),
        "tva_intracom":   request.form.get("tva_intracom", "").strip(),
        "fiscal_profile": request.form.get("fiscal_profile", "").strip(),
        "cadence":        request.form.get("cadence", "").strip(),
    }
    conn = open_db(active_db())
    conn.execute(
        "INSERT INTO user_profile (id, nom, siren, tva_intracom, fiscal_profile, cadence, setup_complete) "
        "VALUES (1, :nom, :siren, :tva_intracom, :fiscal_profile, :cadence, 1) "
        "ON CONFLICT(id) DO UPDATE SET "
        "nom=excluded.nom, siren=excluded.siren, tva_intracom=excluded.tva_intracom, "
        "fiscal_profile=excluded.fiscal_profile, cadence=excluded.cadence",
        data,
    )
    avatar_file = request.files.get("avatar")
    if avatar_file and avatar_file.filename:
        from PIL import Image
        img = Image.open(avatar_file.stream).convert("RGB")
        img.thumbnail((256, 256))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        avatar_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
        conn.execute("UPDATE user_profile SET avatar_data=? WHERE id=1", (avatar_b64,))
    if request.form.get("remove_avatar"):
        conn.execute("UPDATE user_profile SET avatar_data=NULL WHERE id=1")
    conn.commit()
    conn.close()
    return redirect(url_for("parametres.parametres_index", section="profil", saved="1"))


@bp_parametres.route("/parametres/enseignes", methods=["POST"])
def parametres_enseignes_ajouter():
    """POST /parametres/enseignes — Ajoute une enseigne connue."""
    keyword = request.form.get("keyword", "").strip()
    nom = request.form.get("nom", "").strip()
    if keyword and nom:
        conn = open_db(active_db())
        try:
            conn.execute("INSERT INTO known_emitters (keyword, nom) VALUES (?, ?)", (keyword, nom))
            conn.commit()
        except sqlite3.IntegrityError:
            pass
        conn.close()
    return redirect(url_for("parametres.parametres_index", section="enseignes"))


@bp_parametres.route("/parametres/enseignes/<int:emitter_id>", methods=["DELETE", "POST"])
def parametres_enseignes_supprimer(emitter_id):
    """DELETE /parametres/enseignes/<id> — Supprime une enseigne connue."""
    conn = open_db(active_db())
    conn.execute("DELETE FROM known_emitters WHERE id=?", (emitter_id,))
    conn.commit()
    conn.close()
    if request.method == "DELETE":
        return jsonify({"ok": True})
    return redirect(url_for("parametres.parametres_index", section="enseignes"))


@bp_parametres.route("/parametres/ocr", methods=["POST"])
def parametres_ocr_sauver():
    """POST /parametres/ocr — Sauvegarde la configuration OCR."""
    def _bool(key): return 1 if request.form.get(key) else 0
    def _float(key, default):
        try: return float(request.form.get(key, default))
        except ValueError: return default
    def _int(key, default):
        try: return int(request.form.get(key, default))
        except ValueError: return default

    conn = open_db(active_db())
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
    return redirect(url_for("parametres.parametres_index", section="app", saved="1"))
