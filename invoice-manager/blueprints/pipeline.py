"""
blueprints/pipeline.py — Contexte ingestion : upload, exécution pipeline, fichiers.

Routes RESTful : /pipeline/* pour les actions, /fichiers/* et /apercu/* pour le service de fichiers.
"""
import io
import shutil
import subprocess
import sys
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from flask import (
    Blueprint, Response, abort, jsonify, redirect, render_template, request,
    send_file,
)

from constants import IMPORT_EN_ATTENTE, IMPORT_STATUTS_TERMINAUX
from context_helpers import active_paths, active_slug
from db import open_db
from profiles import resolve_paths
from queries import query_fiscal_summary, query_health

PROJECT_ROOT = Path(__file__).resolve().parent.parent

bp_pipeline = Blueprint("pipeline", __name__)


def _trigger_pipeline(slug: str, job_id: str | None = None) -> None:
    """Lance le pipeline d'extraction en arrière-plan pour un profil donné.
    Si job_id est fourni, extract.py mettra à jour import_jobs ligne par ligne."""
    cmd = [sys.executable, str(PROJECT_ROOT / "run.py"), "--profile", slug]
    if job_id:
        cmd += ["--job-id", job_id]
    threading.Thread(
        target=lambda: subprocess.run(
            cmd, cwd=str(PROJECT_ROOT), capture_output=True,
        ),
        daemon=True,
    ).start()


def _enregistrer_job(db_path: Path, job_id: str, filenames: list[str]) -> None:
    """Crée une ligne `en_attente` par fichier dans import_jobs."""
    now = datetime.now(timezone.utc).isoformat()
    conn = open_db(db_path)
    conn.executemany(
        "INSERT INTO import_jobs "
        "(job_id, filename, statut, créé_le, mis_à_jour_le) "
        "VALUES (?, ?, ?, ?, ?)",
        [(job_id, name, IMPORT_EN_ATTENTE, now, now) for name in filenames],
    )
    conn.commit()
    conn.close()


def _lire_job(db_path: Path, job_id: str) -> dict:
    """Retourne l'état courant d'un job (fichiers + résumé + drapeau de fin)."""
    conn = open_db(db_path)
    rows = conn.execute(
        "SELECT filename, statut, invoice_id, message_erreur "
        "FROM import_jobs WHERE job_id=? ORDER BY créé_le, filename",
        (job_id,),
    ).fetchall()
    conn.close()
    files = [
        {
            "filename": r["filename"],
            "statut": r["statut"],
            "invoice_id": r["invoice_id"],
            "message_erreur": r["message_erreur"],
        }
        for r in rows
    ]
    summary = {"total": len(files)}
    for s in ("en_attente", "en_extraction", "terminé", "erreur", "doublon"):
        summary[s] = sum(1 for f in files if f["statut"] == s)
    finished = bool(files) and all(
        f["statut"] in IMPORT_STATUTS_TERMINAUX for f in files
    )
    return {"job_id": job_id, "files": files, "summary": summary,
            "finished": finished}


def _find_file(paths: dict, filename: str):
    """Cherche un fichier dans les sous-répertoires processed/errors/input."""
    basename = Path(filename).name
    for subdir in ("processed", "errors", "input"):
        candidate = paths.get(subdir, PROJECT_ROOT / subdir) / basename
        if candidate.is_file():
            return candidate
    return None


@bp_pipeline.route("/pipeline/lancer", methods=["POST"])
def pipeline_lancer():
    """POST /pipeline/lancer — Exécute le pipeline d'extraction (synchrone)."""
    year = request.form.get("year", datetime.now().year)
    slug = active_slug()
    result = subprocess.run(
        [sys.executable, str(PROJECT_ROOT / "run.py"), "--profile", slug],
        capture_output=True,
        text=True,
        cwd=str(PROJECT_ROOT),
        stdin=subprocess.DEVNULL,
    )
    if result.returncode != 0:
        error_snippet = result.stderr[-500:] if result.stderr else "Erreur inconnue"
        return redirect(f"/?year={year}&run_error={quote(error_snippet)}")
    return redirect(f"/?year={year}")


@bp_pipeline.route("/pipeline/depot", methods=["POST"])
def pipeline_depot():
    """POST /pipeline/depot — Téléverse des fichiers et déclenche le pipeline.
    Crée un job_id, écrit une ligne `en_attente` par fichier dans import_jobs,
    et retourne le job_id au client (qui pourra suivre l'avancement)."""
    slug = active_slug()
    if not slug:
        return jsonify({"ok": False, "error": "Aucun profil actif"}), 400
    paths = resolve_paths(slug)
    input_dir = paths["input"]
    input_dir.mkdir(parents=True, exist_ok=True)

    files = request.files.getlist("files")
    if not files or all(not f.filename for f in files):
        return jsonify({"ok": False, "error": "Aucun fichier reçu"}), 400

    saved: list[str] = []
    failed: list[dict] = []
    for f in files:
        if not f.filename:
            continue
        basename = Path(f.filename).name
        try:
            f.save(input_dir / basename)
        except OSError as exc:
            failed.append({"name": f.filename, "error": str(exc)})
            continue
        saved.append(basename)

    if not saved:
        return jsonify({
            "ok": False,
            "error": "Aucun fichier n'a pu être enregistré.",
            "failed": failed,
        }), 500

    job_id = uuid.uuid4().hex
    _enregistrer_job(paths["db"], job_id, saved)
    _trigger_pipeline(slug, job_id=job_id)
    return jsonify({
        "ok": True,
        "job_id": job_id,
        "files": saved,
        "count": len(saved),
        "failed": failed,
    })


@bp_pipeline.route("/pipeline/jobs/<job_id>")
def pipeline_job_statut(job_id):
    """GET /pipeline/jobs/<job_id> — État d'un job d'import (JSON)."""
    paths = active_paths()
    if not paths:
        return jsonify({"ok": False, "error": "Aucun profil actif"}), 400
    return jsonify(_lire_job(paths["db"], job_id))


@bp_pipeline.route("/fragments/synthese-fiscale")
def fragment_synthese_fiscale():
    """GET /fragments/synthese-fiscale?year=YYYY — Cartes CA / TVA / résultat (HTML partiel)."""
    year = request.args.get("year", datetime.now().year, type=int)
    conn = open_db(active_paths()["db"])
    summary = query_fiscal_summary(conn, year)
    conn.close()
    return render_template("fragments/synthese_fiscale.html",
                           summary=summary, year=year)


@bp_pipeline.route("/fragments/sante")
def fragment_sante():
    """GET /fragments/sante — Carte santé du workspace (HTML partiel)."""
    year = request.args.get("year", datetime.now().year, type=int)
    paths = active_paths()
    conn = open_db(paths["db"])
    health = query_health(conn, paths)
    conn.close()
    return render_template("fragments/sante.html", health=health, year=year)


@bp_pipeline.route("/pipeline/erreurs/<filename>/reessayer", methods=["POST"])
def pipeline_erreur_reessayer(filename):
    """POST /pipeline/erreurs/<fn>/reessayer — Réessaie un fichier en erreur."""
    slug = active_slug()
    if not slug:
        return jsonify({"ok": False, "error": "Aucun profil actif"}), 400
    paths = resolve_paths(slug)
    src = paths["errors"] / Path(filename).name
    if not src.is_file():
        return jsonify({"ok": False, "error": "Fichier introuvable"}), 404
    dest = paths["input"] / src.name
    shutil.move(str(src), dest)

    _trigger_pipeline(slug)
    return jsonify({"ok": True})


@bp_pipeline.route("/pipeline/erreurs/<filename>", methods=["DELETE", "POST"])
def pipeline_erreur_supprimer(filename):
    """DELETE /pipeline/erreurs/<fn> — Supprime un fichier en erreur."""
    slug = active_slug()
    if not slug:
        return jsonify({"ok": False, "error": "Aucun profil actif"}), 400
    year = request.form.get("year", datetime.now().year)
    paths = resolve_paths(slug)
    target = paths["errors"] / Path(filename).name
    if not target.is_file():
        return jsonify({"ok": False, "error": "Fichier introuvable"}), 404
    target.unlink()
    if request.method == "DELETE":
        return jsonify({"ok": True})
    return redirect(f"/?year={year}")


@bp_pipeline.route("/pipeline/purger-liens-morts", methods=["POST"])
def pipeline_purger_liens_morts():
    """POST /pipeline/purger-liens-morts — Nettoie les références aux fichiers disparus."""
    slug = active_slug()
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


@bp_pipeline.route("/fichiers/<path:filename>")
def servir_fichier(filename):
    """GET /fichiers/<path> — Sert un fichier brut (PDF, image…)."""
    candidate = _find_file(active_paths() or {}, filename)
    if candidate is None:
        abort(404)
    suffix = candidate.suffix.lower()
    mime = "application/pdf" if suffix == ".pdf" else None
    return send_file(candidate, mimetype=mime, as_attachment=False)


@bp_pipeline.route("/apercu/<path:filename>")
def apercu_fichier(filename):
    """GET /apercu/<path> — Sert un aperçu (conversion HEIC → JPEG si nécessaire)."""
    candidate = _find_file(active_paths() or {}, filename)
    if candidate is None:
        abort(404)
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
