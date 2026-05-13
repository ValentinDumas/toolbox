"""Badge OCR cloud actif — VISION §4 : « clearly labeled in the UI »."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def _make_app(tmp_path, monkeypatch, ocr_backend: str):
    import app as _app
    import context_helpers as _ctx
    import blueprints.pipeline as _bp_pipeline
    import blueprints.profils as _bp_profils
    from db import open_db

    slug = "test-profile"
    profile_dir = tmp_path / "data" / "profiles" / slug
    for d in ("input", "processed", "errors", "output", "review"):
        (profile_dir / d).mkdir(parents=True, exist_ok=True)
    db_file = profile_dir / "invoices.db"
    conn = open_db(db_file)
    conn.execute(
        "INSERT OR REPLACE INTO user_profile "
        "(id, nom, siren, fiscal_profile, cadence, setup_complete, ocr_backend) "
        "VALUES (1, 'Test', '123456789', 'auto-entrepreneur', 'trimestrielle', 1, ?)",
        (ocr_backend,),
    )
    conn.commit()
    conn.close()

    test_profiles = [{"slug": slug, "name": "Test", "created_at": "2025-01-01T00:00:00+00:00"}]
    test_paths = {
        "db":        db_file,
        "input":     profile_dir / "input",
        "processed": profile_dir / "processed",
        "errors":    profile_dir / "errors",
        "output":    profile_dir / "output",
        "review":    profile_dir / "review",
    }
    monkeypatch.setattr(_app, "load_profiles", lambda: test_profiles)
    monkeypatch.setattr(_app, "get_profile_meta", lambda s: test_profiles[0] if s == slug else None)
    monkeypatch.setattr(_ctx, "resolve_paths", lambda s: test_paths)
    monkeypatch.setattr(_ctx, "get_profile_meta", lambda s: test_profiles[0] if s == slug else None)
    monkeypatch.setattr(_bp_pipeline, "resolve_paths", lambda s: test_paths)
    monkeypatch.setattr(_bp_profils, "get_profile_meta", lambda s: test_profiles[0] if s == slug else None)

    from app import create_app
    app = create_app()
    app.config["TESTING"] = True

    def _inject_session():
        from flask import session
        session["active_profile"] = slug
    app.before_request_funcs.setdefault(None, []).insert(0, _inject_session)
    return app


def test_dashboard_affiche_le_badge_egress_quand_ocr_claude_actif(tmp_path, monkeypatch):
    # Given un profil dont l'OCR cloud Claude est activé
    app = _make_app(tmp_path, monkeypatch, ocr_backend="claude")
    # When on affiche le dashboard
    with app.test_client() as client:
        resp = client.get("/")
    # Then le badge « OCR cloud actif » est rendu dans le header
    html = resp.data.decode()
    assert 'class="ocr-egress-badge"' in html
    assert "OCR cloud actif" in html


def test_dashboard_n_affiche_pas_le_badge_quand_ocr_local(tmp_path, monkeypatch):
    # Given un profil sur le backend local (offline par défaut)
    app = _make_app(tmp_path, monkeypatch, ocr_backend="local")
    # When on affiche le dashboard
    with app.test_client() as client:
        resp = client.get("/")
    # Then l'élément badge n'est pas rendu (les définitions CSS restent inertes)
    html = resp.data.decode()
    assert 'class="ocr-egress-badge"' not in html
    assert "OCR cloud actif" not in html
