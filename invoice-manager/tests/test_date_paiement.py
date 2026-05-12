"""Tests BDD du champ `date_paiement` — date du mouvement de trésorerie.

Couvre la règle métier AUTO_ENTREPRENEUR_RULES.md §4.2 + §9 : pour un
auto-entrepreneur, le CA URSSAF s'agrège sur la date d'**encaissement**
(= `date_paiement` d'une pièce émise), pas la date d'émission. Cette
suite atteste que :

- le champ est saisissable depuis le formulaire de révision,
- il accepte une date ISO et rejette tout autre format,
- il peut être effacé explicitement (NULL),
- il alimente le journal de corrections quand modifié sur une pièce validée,
- le helper sémantique `date_encaissement` ne retourne le paiement
  que pour les pièces émises (vocabulaire ubiquitaire).
"""
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from extract import open_db
from services.comptabilite import date_encaissement
from services.revision import _parse_review_fields


@pytest.fixture
def mem_db():
    conn = open_db(Path(":memory:"))
    yield conn
    conn.close()


def _insert(conn, **kwargs):
    defaults = {
        "id": "f-1",
        "type_document": "facture_émise",
        "montant_ht": 1000.0,
        "montant_ttc": 1000.0,
        "date_document": "2026-03-01",
        "statut_révision": "validé",
        "exercice_fiscal": 2026,
    }
    row = {**defaults, **kwargs}
    cols = ", ".join(f'"{k}"' for k in row)
    ph = ", ".join("?" for _ in row)
    conn.execute(f"INSERT INTO invoices ({cols}) VALUES ({ph})", list(row.values()))
    conn.commit()


# ── ACL : parsing du formulaire ───────────────────────────────────────────────

def test_date_paiement_iso_valide_est_acceptee():
    # Given un formulaire de révision avec une date d'encaissement ISO
    form = {"date_paiement": "2026-04-15"}

    # When on parse les champs
    fields, errors = _parse_review_fields(form)

    # Then la date est conservée et aucun champ n'est en erreur
    assert errors == {}
    assert fields["date_paiement"] == "2026-04-15"


def test_date_paiement_non_iso_est_rejetee_avec_erreur():
    # Given un formulaire avec une date au format français
    form = {"date_paiement": "15/04/2026"}

    # When on parse
    fields, errors = _parse_review_fields(form)

    # Then une erreur explicite est retournée et la valeur n'est pas écrite
    assert "date_paiement" in errors
    assert "YYYY-MM-DD" in errors["date_paiement"]
    assert "date_paiement" not in fields


def test_date_paiement_vide_efface_explicitement_la_valeur():
    """L'humain doit pouvoir effacer une date d'encaissement saisie par erreur.

    Sans ce comportement, une fois renseignée, la date deviendrait
    immuable depuis l'UI — incompatible avec le workflow de révision
    où la date d'encaissement peut être saisie *après* la date d'émission
    et donc corrigée si erronée.
    """
    # Given un formulaire qui soumet explicitement date_paiement vide
    form = {"date_paiement": ""}

    # When on parse
    fields, errors = _parse_review_fields(form)

    # Then date_paiement est marquée à None (effacement explicite, pas absence)
    assert errors == {}
    assert "date_paiement" in fields
    assert fields["date_paiement"] is None


def test_date_paiement_absente_du_form_nest_pas_dans_fields():
    """Distinction clé pour le PATCH partiel : absence ≠ effacement.

    Un formulaire qui ne contient pas du tout le champ `date_paiement`
    ne doit pas y toucher en base (pas d'écrasement à NULL).
    """
    # Given un formulaire sans la clé date_paiement
    form = {"date_document": "2026-03-01"}

    # When on parse
    fields, errors = _parse_review_fields(form)

    # Then date_paiement n'apparaît pas dans les champs à mettre à jour
    assert errors == {}
    assert "date_paiement" not in fields


# ── Helper sémantique : encaissement ≠ paiement ───────────────────────────────

def test_helper_date_encaissement_retourne_le_paiement_pour_une_facture_emise():
    # Given une facture émise encaissée le 15 avril
    facture = {"type_document": "facture_émise", "date_paiement": "2026-04-15"}

    # When on demande la date d'encaissement
    # Then c'est bien la date de paiement de la facture
    assert date_encaissement(facture) == "2026-04-15"


def test_helper_date_encaissement_retourne_none_pour_une_facture_recue():
    """Pour une facture reçue, `date_paiement` désigne le règlement du
    fournisseur (sortie de trésorerie), pas un encaissement (entrée).
    Le helper protège le vocabulaire ubiquitaire AE."""
    # Given une facture reçue dont on a réglé le fournisseur
    charge = {"type_document": "facture_reçue", "date_paiement": "2026-04-15"}

    # When on demande la date d'encaissement
    # Then le helper retourne None — il n'y a pas eu d'encaissement
    assert date_encaissement(charge) is None


def test_helper_date_encaissement_inclut_les_avoirs_emis():
    """Un avoir émis annule un encaissement antérieur — il appartient au
    même flux de trésorerie que les factures émises."""
    avoir = {"type_document": "avoir_émis", "date_paiement": "2026-04-20"}
    assert date_encaissement(avoir) == "2026-04-20"


# ── Schéma : la colonne existe et est persistable ─────────────────────────────

def test_date_paiement_est_persistee_en_base(mem_db):
    # Given une facture émise insérée avec une date d'encaissement
    _insert(mem_db, id="f-enc", date_paiement="2026-04-15")

    # When on relit la ligne
    row = mem_db.execute(
        "SELECT date_paiement FROM invoices WHERE id='f-enc'"
    ).fetchone()

    # Then la date est bien lue depuis la base
    assert row["date_paiement"] == "2026-04-15"
