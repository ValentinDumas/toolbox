"""Spécification métier du helper de visibilité TVA selon le profil fiscal."""
from services.profil import tva_visible_pour


class TestTvaVisiblePour:
    def test_auto_entrepreneur_n_affiche_pas_la_tva(self):
        # Given un profil auto-entrepreneur (franchise en base, art. 293 B CGI)
        profile = {"fiscal_profile": "auto-entrepreneur"}

        # When on demande la visibilité TVA
        visible = tva_visible_pour(profile)

        # Then la TVA est masquée
        assert visible is False

    def test_sasu_affiche_la_tva(self):
        # Given un profil SASU (régime réel, TVA déductible)
        profile = {"fiscal_profile": "SASU"}

        # When on demande la visibilité TVA
        visible = tva_visible_pour(profile)

        # Then la TVA est visible
        assert visible is True

    def test_sarl_affiche_la_tva(self):
        # Given un profil SARL (régime réel, TVA déductible)
        profile = {"fiscal_profile": "SARL"}

        # When on demande la visibilité TVA
        visible = tva_visible_pour(profile)

        # Then la TVA est visible
        assert visible is True

    def test_salarie_n_affiche_pas_la_tva(self):
        # Given un profil salarié (note de frais, pas de TVA déductible)
        profile = {"fiscal_profile": "salarié"}

        # When on demande la visibilité TVA
        visible = tva_visible_pour(profile)

        # Then la TVA est masquée
        assert visible is False

    def test_profil_inconnu_masque_la_tva_par_defaut(self):
        # Given un profil non répertorié dans FISCAL_RULES
        profile = {"fiscal_profile": "freelance"}

        # When on demande la visibilité TVA
        visible = tva_visible_pour(profile)

        # Then la TVA est masquée par défaut (fail-safe)
        assert visible is False

    def test_profil_none_masque_la_tva(self):
        # Given aucun profil (setup en cours)
        # When on demande la visibilité TVA
        visible = tva_visible_pour(None)

        # Then la TVA est masquée
        assert visible is False

    def test_profil_vide_masque_la_tva(self):
        # Given un profil vide (cas paranoïa)
        # When on demande la visibilité TVA
        visible = tva_visible_pour({})

        # Then la TVA est masquée
        assert visible is False
