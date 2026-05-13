"""Tests de sécurité : path traversal sur les routes de service de fichiers.

VISION.md §4 (« Verification / testing phase ») exige des sondes de path
traversal sur **chaque route servant un fichier**. Ce module identifie
dynamiquement ces routes via `app.url_map` et probe :

- payload légitime (fichier réel dans `processed/`) → succès
- traversal relatif (`../../etc/passwd`)
- chemin absolu (`/etc/passwd`)
- traversal URL-encodé (`..%2F..%2Fetc%2Fpasswd`)
- nom valide mais fichier hors du profil actif (placé dans `/tmp` réel)

Les routes testées sont celles dont l'endpoint contient « fichier » ou
« apercu » (cf. `blueprints/pipeline.py`).
"""
from __future__ import annotations

import sqlite3 as _sq
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from extract import open_db


# ── Helpers (copie minimaliste de tests/test_dashboard.py::_make_app) ────────

def _make_app(tmp_path, monkeypatch):
    """Crée une app Flask isolée pointant vers un profil temporaire."""
    import app as _app
    import context_helpers as _ctx
    import blueprints.pipeline as _bp_pipeline
    import blueprints.profils as _bp_profils

    slug = "test-profile"
    profile_dir = tmp_path / "data" / "profiles" / slug
    db_file = profile_dir / "invoices.db"
    for d in ("input", "processed", "errors", "output", "review"):
        (profile_dir / d).mkdir(parents=True, exist_ok=True)

    mem = open_db(Path(":memory:"))
    file_conn = _sq.connect(str(db_file))
    mem.backup(file_conn)
    file_conn.execute(
        "INSERT OR REPLACE INTO user_profile "
        "(id, siren, fiscal_profile, setup_complete) "
        "VALUES (1, '123456789', 'auto-entrepreneur', 1)"
    )
    file_conn.commit()
    file_conn.close()
    mem.close()

    test_profiles = [{"slug": slug, "name": "Test",
                      "created_at": "2025-01-01T00:00:00+00:00"}]
    test_paths = {
        "db":        db_file,
        "input":     profile_dir / "input",
        "processed": profile_dir / "processed",
        "errors":    profile_dir / "errors",
        "output":    profile_dir / "output",
        "review":    profile_dir / "review",
    }

    monkeypatch.setattr(_app, "load_profiles", lambda: test_profiles)
    monkeypatch.setattr(_app, "get_profile_meta",
                        lambda s: test_profiles[0] if s == slug else None)
    monkeypatch.setattr(_ctx, "resolve_paths", lambda s: test_paths)
    monkeypatch.setattr(_ctx, "get_profile_meta",
                        lambda s: test_profiles[0] if s == slug else None)
    monkeypatch.setattr(_bp_pipeline, "resolve_paths", lambda s: test_paths)
    monkeypatch.setattr(_bp_profils, "get_profile_meta",
                        lambda s: test_profiles[0] if s == slug else None)

    from app import create_app
    app = create_app()
    app.config["TESTING"] = True

    def _inject_session():
        from flask import session
        session["active_profile"] = slug

    app.before_request_funcs.setdefault(None, []).insert(0, _inject_session)
    return app, test_paths


def _file_serving_endpoints(app):
    """Retourne les règles Flask qui servent un fichier (endpoint « fichier »
    ou « apercu »). Aligné sur la nomenclature de blueprints/pipeline.py."""
    rules = []
    for rule in app.url_map.iter_rules():
        endpoint = rule.endpoint.lower()
        if "fichier" in endpoint or "apercu" in endpoint or "preview" in endpoint:
            if "GET" in (rule.methods or set()):
                rules.append(rule)
    return rules


def test_routes_de_service_de_fichiers_sont_découvertes(tmp_path, monkeypatch):
    # Given l'application Flask complète
    app, _ = _make_app(tmp_path, monkeypatch)

    # When on inspecte la table de routage
    rules = _file_serving_endpoints(app)
    endpoints = {r.endpoint for r in rules}

    # Then les deux routes documentées dans pipeline.py sont présentes
    # (garde-fou : ce test casse si quelqu'un les renomme sans MAJ ici)
    assert "pipeline.servir_fichier" in endpoints
    assert "pipeline.apercu_fichier" in endpoints


# Payloads malveillants probés sur chaque route file-serving.
TRAVERSAL_PAYLOADS = [
    "../../../etc/passwd",
    "/etc/passwd",
    "..%2F..%2F..%2Fetc%2Fpasswd",
]


@pytest.mark.parametrize("endpoint_path", [
    "/fichiers/{payload}",
    "/apercu/{payload}",
])
@pytest.mark.parametrize("payload", TRAVERSAL_PAYLOADS)
def test_route_de_service_de_fichiers_refuse_un_payload_de_traversal(
    endpoint_path, payload, tmp_path, monkeypatch
):
    # Given une app pointant vers un profil isolé (sans aucun fichier)
    app, _ = _make_app(tmp_path, monkeypatch)

    # When on tente de récupérer un fichier via un chemin de traversal
    # (follow_redirects : Flask normalise les double slashes via un 308,
    # on suit la chaîne jusqu'à la réponse finale du handler)
    with app.test_client() as client:
        resp = client.get(
            endpoint_path.format(payload=payload),
            follow_redirects=True,
        )

    # Then la route doit refuser (4xx) — jamais servir /etc/passwd
    assert resp.status_code >= 400, (
        f"{endpoint_path} a accepté {payload!r} (status={resp.status_code}) — "
        "vuln potentielle de path traversal"
    )
    # Et le contenu d'/etc/passwd ne doit jamais transiter dans la réponse
    body = resp.get_data(as_text=False)
    assert b"root:x:" not in body
    assert b"/bin/" not in body[:512]


def test_servir_fichier_sert_un_fichier_légitime_du_profil(tmp_path, monkeypatch):
    # Given un fichier réel dans le répertoire processed/ du profil actif
    app, paths = _make_app(tmp_path, monkeypatch)
    target = paths["processed"] / "facture-legitime.pdf"
    target.write_bytes(b"%PDF-1.4\n%fake content\n")

    # When on demande ce fichier par son basename
    with app.test_client() as client:
        resp = client.get("/fichiers/facture-legitime.pdf")

    # Then la route le sert (statut 200) — atteste que la route fonctionne
    # pour le cas nominal, donc les refus ci-dessus ne sont pas de faux négatifs
    assert resp.status_code == 200
    assert b"%PDF" in resp.data


def test_servir_fichier_refuse_un_fichier_hors_du_profil_actif(tmp_path, monkeypatch):
    # Given un fichier placé hors du profil (simule un fichier d'un autre
    # utilisateur ou du système). On le pose dans un répertoire temporaire
    # séparé puis on demande son basename via la route.
    app, _ = _make_app(tmp_path, monkeypatch)
    with tempfile.NamedTemporaryFile(
        suffix=".pdf", delete=False, dir=tempfile.gettempdir()
    ) as fh:
        fh.write(b"%PDF-1.4\nhors profil\n")
        external = Path(fh.name)

    try:
        # When on demande le basename de ce fichier externe
        with app.test_client() as client:
            resp = client.get(f"/fichiers/{external.name}")

        # Then la route refuse — le fichier n'est pas dans le sandbox du profil
        assert resp.status_code == 404
        assert b"hors profil" not in resp.data
    finally:
        external.unlink(missing_ok=True)
