"""
blueprints/parametres.py — Contexte paramétrage : profil, enseignes connues, OCR.

Routes RESTful : /parametres pour l'index, sous-ressources pour profil/enseignes/ocr.
"""
import base64
import io
import re
import sqlite3

from flask import (
    Blueprint, jsonify, redirect, render_template, request, url_for,
)

from config import CADENCE_OPTIONS
from constants import FISCAL_RULES
from context_helpers import active_db
from db import get_extraction_cfg, get_user_profile, open_db

bp_parametres = Blueprint("parametres", __name__)

# ── Anti-corruption layer : validation des champs profil ──────────────────────

# Profils fiscaux acceptés : clés de FISCAL_RULES (source de vérité métier).
FISCAL_PROFILES_VALIDES = frozenset(FISCAL_RULES.keys())
# Cadences acceptées : union des cadences valides tous profils confondus.
CADENCES_VALIDES = frozenset(c for opts in CADENCE_OPTIONS.values() for c in opts)

# SIREN : 9 chiffres exactement (espaces tolérés à l'entrée).
_SIREN_REGEX = re.compile(r"^\d{9}$")
# TVA intracom : 2 lettres pays + 2 à 12 caractères alphanumériques (loose EU pattern).
_TVA_INTRACOM_REGEX = re.compile(r"^[A-Z]{2}[0-9A-Z]{2,12}$")

# Limites de longueur pour les enseignes connues (issue #99).
ENSEIGNE_KEYWORD_MAX = 64
ENSEIGNE_NOM_MAX = 120

# Catégorie : slug en minuscules (lettres + accents français), 1 à 64 caractères.
CATEGORIE_MAX = 64
_CATEGORIE_REGEX = re.compile(r"^[a-zàâäçéèêëîïôöùûüÿñæœ \-]{1,%d}$" % CATEGORIE_MAX)

# Messages d'erreur en français — affichés via la query-string `error=<code>`.
_ERROR_MESSAGES: dict[str, str] = {
    "siren_invalide": "SIREN invalide : 9 chiffres attendus.",
    "fiscal_profile_invalide": "Profil fiscal invalide.",
    "tva_intracom_invalide": "Numéro de TVA intracommunautaire invalide.",
    "cadence_invalide": "Cadence de déclaration invalide.",
    "enseigne_keyword_trop_long": (
        f"Le mot-clé d'enseigne dépasse {ENSEIGNE_KEYWORD_MAX} caractères."
    ),
    "enseigne_nom_trop_long": (
        f"Le nom d'enseigne dépasse {ENSEIGNE_NOM_MAX} caractères."
    ),
    "categorie_invalide": (
        "Catégorie invalide : minuscules, lettres et tirets uniquement "
        f"(max {CATEGORIE_MAX} caractères)."
    ),
    "taux_tva_invalide": (
        "Taux de TVA invalide : fraction entre 0 et 1 attendue (ex. 0.20 pour 20 %)."
    ),
}


def _valider_profil(form) -> tuple[dict, str | None]:
    """Convertit le formulaire HTTP en champs domaine et valide chaque champ.

    Retourne (champs_propres, code_erreur). Le code d'erreur est un slug
    court repris dans l'URL de redirection — voir settings.html pour
    l'affichage côté UI.
    """
    nom = form.get("nom", "").strip()
    siren = form.get("siren", "").strip().replace(" ", "")
    tva_intracom = form.get("tva_intracom", "").strip().upper().replace(" ", "")
    fiscal_profile = form.get("fiscal_profile", "").strip()
    cadence = form.get("cadence", "").strip()

    if siren and not _SIREN_REGEX.match(siren):
        return {}, "siren_invalide"
    if fiscal_profile and fiscal_profile not in FISCAL_PROFILES_VALIDES:
        return {}, "fiscal_profile_invalide"
    if tva_intracom and not _TVA_INTRACOM_REGEX.match(tva_intracom):
        return {}, "tva_intracom_invalide"
    if cadence and cadence not in CADENCES_VALIDES:
        return {}, "cadence_invalide"

    return {
        "nom": nom,
        "siren": siren,
        "tva_intracom": tva_intracom,
        "fiscal_profile": fiscal_profile,
        "cadence": cadence,
    }, None


def _valider_enseigne(form) -> tuple[dict, str | None]:
    """Valide les champs d'une enseigne connue (issue #99 : cap de longueur)."""
    keyword = form.get("keyword", "").strip()
    nom = form.get("nom", "").strip()
    if len(keyword) > ENSEIGNE_KEYWORD_MAX:
        return {}, "enseigne_keyword_trop_long"
    if len(nom) > ENSEIGNE_NOM_MAX:
        return {}, "enseigne_nom_trop_long"
    return {"keyword": keyword, "nom": nom}, None


def _valider_taux_categorie(form) -> tuple[dict, str | None]:
    """Valide un couple (catégorie, taux_tva).

    - Catégorie normalisée en minuscules (invariant DB).
    - Taux exprimé en fraction 0..1 (cf. migration v6).
    """
    categorie = form.get("catégorie", "").strip().lower()
    taux_raw = form.get("taux_tva", "").strip().replace(",", ".")
    if not categorie or not _CATEGORIE_REGEX.match(categorie):
        return {}, "categorie_invalide"
    try:
        taux = float(taux_raw)
    except ValueError:
        return {}, "taux_tva_invalide"
    if not (0.0 <= taux <= 1.0):
        return {}, "taux_tva_invalide"
    return {"catégorie": categorie, "taux_tva": round(taux, 4)}, None


@bp_parametres.route("/parametres")
def parametres_index():
    """GET /parametres — Affiche la page de paramètres."""
    conn = open_db(active_db())
    profile = get_user_profile(conn)
    emitters = conn.execute("SELECT * FROM known_emitters ORDER BY keyword").fetchall()
    categories_tva = conn.execute(
        "SELECT id, catégorie, taux_tva FROM category_tva_rates ORDER BY catégorie"
    ).fetchall()
    extraction_cfg = get_extraction_cfg(conn)
    conn.close()
    section = request.args.get("section", "profil")
    saved = request.args.get("saved") == "1"
    error = request.args.get("error") or None
    from config import CADENCE_DEFAULTS, CADENCE_OPTIONS
    return render_template(
        "settings.html",
        profile=profile,
        emitters=emitters,
        categories_tva=categories_tva,
        section=section,
        saved=saved,
        error=error,
        error_message=_ERROR_MESSAGES.get(error) if error else None,
        cadence_defaults=CADENCE_DEFAULTS,
        cadence_options=CADENCE_OPTIONS,
        extraction_cfg=extraction_cfg,
    )


@bp_parametres.route("/parametres/profil", methods=["POST"])
def parametres_profil_sauver():
    """POST /parametres/profil — Sauvegarde le profil utilisateur (nom, SIREN, TVA, fiscal, cadence)."""
    data, error = _valider_profil(request.form)
    if error:
        return redirect(url_for(
            "parametres.parametres_index", section="profil", error=error,
        ))
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
    fields, error = _valider_enseigne(request.form)
    if error:
        return redirect(url_for(
            "parametres.parametres_index", section="enseignes", error=error,
        ))
    keyword, nom = fields["keyword"], fields["nom"]
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


@bp_parametres.route("/parametres/categories-tva", methods=["POST"])
def parametres_categories_tva_ajouter():
    """POST /parametres/categories-tva — Crée ou met à jour un taux par catégorie."""
    fields, error = _valider_taux_categorie(request.form)
    if error:
        return redirect(url_for(
            "parametres.parametres_index", section="categories", error=error,
        ))
    conn = open_db(active_db())
    # UPSERT : si la catégorie existe déjà, on met à jour son taux. La table
    # impose UNIQUE(catégorie) ; l'UPSERT remplace donc un éventuel doublon
    # silencieusement plutôt que de lever IntegrityError.
    conn.execute(
        "INSERT INTO category_tva_rates (catégorie, taux_tva) VALUES (?, ?) "
        "ON CONFLICT(catégorie) DO UPDATE SET taux_tva = excluded.taux_tva",
        (fields["catégorie"], fields["taux_tva"]),
    )
    conn.commit()
    conn.close()
    return redirect(url_for("parametres.parametres_index", section="categories"))


@bp_parametres.route("/parametres/categories-tva/<int:rate_id>", methods=["DELETE", "POST"])
def parametres_categories_tva_supprimer(rate_id):
    """DELETE /parametres/categories-tva/<id> — Supprime un taux par catégorie."""
    conn = open_db(active_db())
    conn.execute("DELETE FROM category_tva_rates WHERE id=?", (rate_id,))
    conn.commit()
    conn.close()
    if request.method == "DELETE":
        return jsonify({"ok": True})
    return redirect(url_for("parametres.parametres_index", section="categories"))


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
