"""Historique des corrections — viewer (alignement VISION : traçabilité)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from queries import parse_corrections_history


# ── Helper pur ────────────────────────────────────────────────────────────────

class TestParseCorrectionsHistory:
    def test_historique_vide_quand_log_absent(self):
        # Given une facture jamais corrigée (log None ou chaîne vide)
        # Then la fonction retourne une liste vide, sans lever
        assert parse_corrections_history(None) == []
        assert parse_corrections_history("") == []
        assert parse_corrections_history("[]") == []

    def test_historique_trie_du_plus_recent_au_plus_ancien(self):
        # Given un log JSON avec deux entrées dans l'ordre d'insertion
        log = json.dumps([
            {"ts": "2025-03-01T10:00:00+00:00", "champ": "montant_ht", "avant": 100.0, "après": 110.0},
            {"ts": "2025-04-15T09:30:00+00:00", "champ": "date_document", "avant": "2025-03-01", "après": "2025-03-02"},
        ])
        # When on parse l'historique
        history = parse_corrections_history(log)
        # Then la correction la plus récente arrive en tête
        assert len(history) == 2
        assert history[0]["champ"] == "date_document"
        assert history[1]["champ"] == "montant_ht"

    def test_historique_robuste_face_a_un_log_corrompu(self):
        # Un journal corrompu (JSON invalide, type inattendu, entrées sans ts)
        # ne doit jamais casser le rendu du dashboard.
        assert parse_corrections_history("{not-json}") == []
        assert parse_corrections_history('{"oops": "dict-not-list"}') == []
        assert parse_corrections_history('[{"sans_ts": true}, {"ts": "2025-01-01", "champ": "x"}]') == [
            {"ts": "2025-01-01", "champ": "x"},
        ]


# ── Rendu dans le dashboard ───────────────────────────────────────────────────

class TestHistoriqueAffichage:
    def _make_app(self, tmp_path, monkeypatch, corrections_log: str | None):
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
            "(id, nom, siren, fiscal_profile, cadence, setup_complete) "
            "VALUES (1, 'Test', '123456789', 'auto-entrepreneur', 'trimestrielle', 1)"
        )
        conn.execute(
            "INSERT INTO invoices (id, hash_fichier, type_document, "
            "montant_ht, montant_tva, montant_ttc, exercice_fiscal, "
            "statut_révision, émetteur_nom, date_document, corrections_log) "
            "VALUES ('hist-1', 'h', 'facture_reçue', 100.0, 20.0, 120.0, 2025, "
            "'validé', 'Brico', '2025-06-01', ?)",
            (corrections_log,),
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

    def test_dashboard_affiche_lhistorique_pour_une_facture_corrigee(self, tmp_path, monkeypatch):
        # Given une facture validée qui a déjà été corrigée
        log = json.dumps([
            {"ts": "2025-06-10T12:00:00+00:00", "champ": "montant_ht", "avant": 80.0, "après": 100.0},
        ])
        app = self._make_app(tmp_path, monkeypatch, corrections_log=log)
        # When on affiche le dashboard
        with app.test_client() as client:
            resp = client.get("/?year=2025")
        # Then la section historique apparaît avec le champ corrigé
        html = resp.data.decode()
        assert "Historique des corrections (1)" in html
        assert "montant_ht" in html
        assert "2025-06-10T12:00:00+00:00" in html

    def test_dashboard_ne_montre_pas_de_section_historique_si_aucune_correction(self, tmp_path, monkeypatch):
        # Given une facture validée sans correction
        app = self._make_app(tmp_path, monkeypatch, corrections_log=None)
        # When on affiche le dashboard
        with app.test_client() as client:
            resp = client.get("/?year=2025")
        # Then la zone historique (élément <details>) n'apparaît pas
        html = resp.data.decode()
        assert 'class="corrections-history"' not in html
