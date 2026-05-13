"""Tests BDD de l'émission de factures auto-entrepreneur (#140).

Couvre AUTO_ENTREPRENEUR_RULES.md §7.2 :
- numérotation séquentielle sans rupture
- mention « TVA non applicable, art. 293 B du CGI » en franchise
- insertion immédiate en DB comme facture_émise validée
- traçabilité (fichier source HTML, log)
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from extract import open_db
from services.facturation_emise import (
    creer_facture_emise,
    next_numero_facture,
    render_facture_html,
)


@pytest.fixture
def mem_db():
    conn = open_db(Path(":memory:"))
    yield conn
    conn.close()


PROFIL_AE = {
    "nom": "Jean Dupont",
    "siren": "123456789",
    "code_ape": "62.01Z",
    "adresse": "10 rue de la Paix, 75002 Paris",
    "fiscal_profile": "auto-entrepreneur",
}


def _insert_facture(conn, num):
    conn.execute(
        "INSERT INTO invoices (id, type_document, numéro_facture) VALUES (?, ?, ?)",
        (num, "facture_émise", num),
    )
    conn.commit()


# ── Numérotation séquentielle ─────────────────────────────────────────────────

def test_premiere_facture_de_l_annee_commence_a_0001(mem_db):
    # Given aucune facture émise pour 2026
    # When on demande le prochain numéro
    # Then on obtient "2026-0001"
    assert next_numero_facture(mem_db, 2026) == "2026-0001"


def test_numero_facture_suit_le_max_de_la_meme_annee(mem_db):
    # Given deux factures émises en 2026
    _insert_facture(mem_db, "2026-0001")
    _insert_facture(mem_db, "2026-0002")

    # When on demande le prochain
    # Then on obtient "2026-0003" (pas de réutilisation, pas de trou)
    assert next_numero_facture(mem_db, 2026) == "2026-0003"


def test_numero_facture_reset_par_annee(mem_db):
    """§7.2 : la séquentialité est continue par année, pas globalement.
    Une facture 2026-0099 ne fait pas commencer 2027 à 100."""
    _insert_facture(mem_db, "2026-0099")
    assert next_numero_facture(mem_db, 2027) == "2027-0001"


def test_numero_facture_ne_reutilise_pas_un_numero_supprime(mem_db):
    """Soft-delete = la facture reste en DB avec son numéro, donc le
    prochain numéro suit le max. C'est l'invariant légal §7.2."""
    _insert_facture(mem_db, "2026-0001")
    _insert_facture(mem_db, "2026-0002")
    mem_db.execute(
        "UPDATE invoices SET deleted_at='2026-04-01T10:00' WHERE id='2026-0002'"
    )
    mem_db.commit()
    assert next_numero_facture(mem_db, 2026) == "2026-0003"


# ── Mentions obligatoires §7.2 ────────────────────────────────────────────────

def test_facture_en_franchise_contient_la_mention_art_293_b():
    facture = {
        "numero_facture": "2026-0001", "date_emission": "2026-03-15",
        "date_prestation": "2026-03-10", "client_nom": "Client SARL",
        "client_adresse": "", "lignes": [{"désignation": "Dev", "quantite": 1,
                                          "prix_unitaire_ht": 100.0}],
        "montant_ht": 100.0, "montant_tva": 0.0, "montant_ttc": 100.0,
        "en_franchise": True,
    }
    html = render_facture_html(PROFIL_AE, facture)
    assert "TVA non applicable, art. 293 B du CGI" in html


def test_facture_hors_franchise_n_a_pas_la_mention_art_293_b():
    facture = {
        "numero_facture": "2026-0001", "date_emission": "2026-03-15",
        "date_prestation": "2026-03-10", "client_nom": "Client",
        "client_adresse": "", "lignes": [{"désignation": "Dev", "quantite": 1,
                                          "prix_unitaire_ht": 100.0}],
        "montant_ht": 100.0, "montant_tva": 20.0, "montant_ttc": 120.0,
        "en_franchise": False,
    }
    html = render_facture_html(PROFIL_AE, facture)
    assert "art. 293 B" not in html


def test_facture_mentionne_siren_et_code_ape_et_dates():
    facture = {
        "numero_facture": "2026-0042", "date_emission": "2026-03-15",
        "date_prestation": "2026-03-10", "client_nom": "Client",
        "client_adresse": "", "lignes": [{"désignation": "x", "quantite": 1,
                                          "prix_unitaire_ht": 1.0}],
        "montant_ht": 1.0, "montant_tva": 0.0, "montant_ttc": 1.0,
        "en_franchise": True,
    }
    html = render_facture_html(PROFIL_AE, facture)
    assert "123456789" in html
    assert "62.01Z" in html
    assert "2026-03-15" in html
    assert "2026-03-10" in html
    assert "2026-0042" in html


# ── Insertion en DB ───────────────────────────────────────────────────────────

def test_creer_facture_emise_insere_une_ligne_validee(mem_db, tmp_path):
    # Given un AE en franchise + un client
    data = {
        "client_nom": "Client SARL",
        "client_adresse": "20 rue X, Paris",
        "lignes": [{"désignation": "Audit", "quantite": 2, "prix_unitaire_ht": 500.0}],
    }

    # When on crée la facture
    facture = creer_facture_emise(mem_db, PROFIL_AE, data, tmp_path,
                                  year=2026, en_franchise=True)

    # Then la facture est en DB, validée, avec le bon montant et un fichier source
    assert facture["numero_facture"] == "2026-0001"
    assert facture["montant_ttc"] == 1000.0
    assert facture["fichier"].exists()

    row = mem_db.execute(
        "SELECT type_document, statut_révision, montant_ttc, montant_tva, "
        "       émetteur_siren, destinataire_nom, fichier_source "
        "FROM invoices WHERE id = ?", (facture["id"],),
    ).fetchone()
    assert row["type_document"] == "facture_émise"
    assert row["statut_révision"] == "validé"
    assert row["montant_ttc"] == 1000.0
    assert row["montant_tva"] == 0.0  # franchise
    assert row["émetteur_siren"] == "123456789"
    assert row["destinataire_nom"] == "Client SARL"
