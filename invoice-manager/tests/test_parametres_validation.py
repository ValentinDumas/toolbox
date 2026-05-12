"""Tests de validation des paramètres (issues #98 et #99).

Vérifie l'anti-corruption layer de `blueprints.parametres` : SIREN, profil
fiscal, TVA intracom, cadence, et longueurs maximales des enseignes.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from blueprints.parametres import (
    ENSEIGNE_KEYWORD_MAX,
    ENSEIGNE_NOM_MAX,
    _valider_enseigne,
    _valider_profil,
    _valider_taux_categorie,
)


# ── SIREN ─────────────────────────────────────────────────────────────────────

def test_siren_vide_accepte():
    fields, err = _valider_profil({"siren": ""})
    assert err is None
    assert fields["siren"] == ""


def test_siren_valide_9_chiffres():
    fields, err = _valider_profil({"siren": "123456789"})
    assert err is None
    assert fields["siren"] == "123456789"


def test_siren_avec_espaces_normalise():
    fields, err = _valider_profil({"siren": "123 456 789"})
    assert err is None
    assert fields["siren"] == "123456789"


def test_siren_trop_court_rejete():
    _, err = _valider_profil({"siren": "12345"})
    assert err == "siren_invalide"


def test_siren_non_numerique_rejete():
    _, err = _valider_profil({"siren": "ABC456789"})
    assert err == "siren_invalide"


def test_siren_trop_long_rejete():
    _, err = _valider_profil({"siren": "1234567890"})
    assert err == "siren_invalide"


# ── Profil fiscal ─────────────────────────────────────────────────────────────

def test_fiscal_profile_vide_accepte():
    fields, err = _valider_profil({"fiscal_profile": ""})
    assert err is None
    assert fields["fiscal_profile"] == ""


@pytest.mark.parametrize("p", ["auto-entrepreneur", "SASU", "SARL", "salarié"])
def test_fiscal_profile_valeurs_acceptees(p):
    fields, err = _valider_profil({"fiscal_profile": p})
    assert err is None
    assert fields["fiscal_profile"] == p


def test_fiscal_profile_inconnu_rejete():
    _, err = _valider_profil({"fiscal_profile": "EURL"})
    assert err == "fiscal_profile_invalide"


def test_fiscal_profile_casse_differente_rejete():
    _, err = _valider_profil({"fiscal_profile": "sasu"})
    assert err == "fiscal_profile_invalide"


# ── TVA intracommunautaire ────────────────────────────────────────────────────

def test_tva_intracom_vide_accepte():
    fields, err = _valider_profil({"tva_intracom": ""})
    assert err is None


def test_tva_intracom_valide_fr():
    fields, err = _valider_profil({"tva_intracom": "FR22424761419"})
    assert err is None
    assert fields["tva_intracom"] == "FR22424761419"


def test_tva_intracom_normalisee_majuscules():
    fields, err = _valider_profil({"tva_intracom": "fr22424761419"})
    assert err is None
    assert fields["tva_intracom"] == "FR22424761419"


def test_tva_intracom_sans_prefixe_rejetee():
    _, err = _valider_profil({"tva_intracom": "424761419"})
    assert err == "tva_intracom_invalide"


def test_tva_intracom_caracteres_speciaux_rejetee():
    _, err = _valider_profil({"tva_intracom": "FR-22-424761"})
    assert err == "tva_intracom_invalide"


# ── Cadence ───────────────────────────────────────────────────────────────────

def test_cadence_vide_acceptee():
    _, err = _valider_profil({"cadence": ""})
    assert err is None


@pytest.mark.parametrize("c", ["mensuelle", "trimestrielle", "annuelle"])
def test_cadence_valeurs_acceptees(c):
    _, err = _valider_profil({"cadence": c})
    assert err is None


def test_cadence_inconnue_rejetee():
    _, err = _valider_profil({"cadence": "hebdomadaire"})
    assert err == "cadence_invalide"


# ── Enseigne (issue #99) ──────────────────────────────────────────────────────

def test_enseigne_courte_acceptee():
    fields, err = _valider_enseigne({"keyword": "ovh", "nom": "OVH SAS"})
    assert err is None
    assert fields == {"keyword": "ovh", "nom": "OVH SAS"}


def test_enseigne_keyword_a_la_limite_acceptee():
    fields, err = _valider_enseigne({
        "keyword": "k" * ENSEIGNE_KEYWORD_MAX,
        "nom": "n",
    })
    assert err is None


def test_enseigne_keyword_trop_long_rejete():
    _, err = _valider_enseigne({
        "keyword": "k" * (ENSEIGNE_KEYWORD_MAX + 1),
        "nom": "ok",
    })
    assert err == "enseigne_keyword_trop_long"


def test_enseigne_nom_a_la_limite_accepte():
    fields, err = _valider_enseigne({
        "keyword": "ok",
        "nom": "n" * ENSEIGNE_NOM_MAX,
    })
    assert err is None


def test_enseigne_nom_trop_long_rejete():
    _, err = _valider_enseigne({
        "keyword": "ok",
        "nom": "n" * (ENSEIGNE_NOM_MAX + 1),
    })
    assert err == "enseigne_nom_trop_long"


def test_enseigne_5000_chars_rejete():
    """Régression issue #99 : 5000 caractères ne doivent plus être insérés."""
    _, err = _valider_enseigne({"keyword": "x" * 5000, "nom": "ok"})
    assert err == "enseigne_keyword_trop_long"


# ── Catégories TVA ────────────────────────────────────────────────────────────

class TestValiderTauxCategorie:
    def test_categorie_valide_taux_fraction(self):
        fields, err = _valider_taux_categorie({"catégorie": "transport", "taux_tva": "0.20"})
        assert err is None
        assert fields == {"catégorie": "transport", "taux_tva": 0.20}

    def test_categorie_uppercase_est_minusculisée(self):
        fields, err = _valider_taux_categorie({"catégorie": "TRANSPORT", "taux_tva": "0.10"})
        assert err is None
        assert fields["catégorie"] == "transport"

    def test_categorie_avec_accent_acceptée(self):
        fields, err = _valider_taux_categorie({"catégorie": "hébergement", "taux_tva": "0.20"})
        assert err is None
        assert fields["catégorie"] == "hébergement"

    def test_virgule_decimale_acceptée(self):
        fields, err = _valider_taux_categorie({"catégorie": "repas", "taux_tva": "0,10"})
        assert err is None
        assert fields["taux_tva"] == 0.10

    def test_categorie_vide_rejetée(self):
        _, err = _valider_taux_categorie({"catégorie": "", "taux_tva": "0.20"})
        assert err == "categorie_invalide"

    def test_categorie_avec_chiffres_rejetée(self):
        _, err = _valider_taux_categorie({"catégorie": "cat123", "taux_tva": "0.20"})
        assert err == "categorie_invalide"

    def test_taux_hors_intervalle_rejeté(self):
        _, err = _valider_taux_categorie({"catégorie": "transport", "taux_tva": "1.5"})
        assert err == "taux_tva_invalide"

    def test_taux_negatif_rejeté(self):
        _, err = _valider_taux_categorie({"catégorie": "transport", "taux_tva": "-0.1"})
        assert err == "taux_tva_invalide"

    def test_taux_non_numerique_rejeté(self):
        _, err = _valider_taux_categorie({"catégorie": "transport", "taux_tva": "vingt"})
        assert err == "taux_tva_invalide"
