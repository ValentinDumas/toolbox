"""Tests BDD du calcul du CA encaissé pour une période (#131).

Règle AUTO_ENTREPRENEUR_RULES.md §4.2 + §8 : pour la déclaration URSSAF
d'un auto-entrepreneur, le CA agrégé sur la période s'appuie sur la
**date d'encaissement** des factures émises, pas sur la date d'émission.
Les avoirs émis (remboursements client) sont déduits du CA.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from extract import open_db
from queries import query_ca_encaisse


@pytest.fixture
def mem_db():
    conn = open_db(Path(":memory:"))
    yield conn
    conn.close()


def _insert(conn, **kwargs):
    defaults = {
        "id": "f-1",
        "type_document": "facture_émise",
        "montant_ttc": 1000.0,
        "date_document": "2026-03-01",
        "date_paiement": "2026-03-15",
        "statut_révision": "validé",
        "exercice_fiscal": 2026,
    }
    row = {**defaults, **kwargs}
    cols = ", ".join(f'"{k}"' for k in row)
    ph = ", ".join("?" for _ in row)
    conn.execute(f"INSERT INTO invoices ({cols}) VALUES ({ph})", list(row.values()))
    conn.commit()


def test_ca_encaisse_agrege_les_factures_emises_payees_dans_la_periode(mem_db):
    # Given trois factures émises encaissées en mars 2026
    _insert(mem_db, id="a", montant_ttc=1000.0, date_paiement="2026-03-05")
    _insert(mem_db, id="b", montant_ttc=500.0, date_paiement="2026-03-15")
    _insert(mem_db, id="c", montant_ttc=300.0, date_paiement="2026-03-31")

    # When on agrège le CA encaissé du mois de mars 2026
    result = query_ca_encaisse(mem_db, "2026-03-01", "2026-03-31")

    # Then le CA = somme des trois TTC et le décompte de pièces est exact
    assert result["ca_ttc"] == 1800.0
    assert result["count"] == 3
    assert set(result["facture_ids"]) == {"a", "b", "c"}


def test_ca_encaisse_exclut_les_factures_emises_apres_la_periode(mem_db):
    """Une facture émise en mars mais encaissée en avril n'entre que dans
    l'agrégat d'avril — c'est précisément l'enjeu du champ date_paiement."""
    # Given une facture émise le 25 mars, payée le 5 avril
    _insert(mem_db, id="late", date_document="2026-03-25", date_paiement="2026-04-05")

    # When on demande le CA de mars 2026
    result = query_ca_encaisse(mem_db, "2026-03-01", "2026-03-31")

    # Then la facture est exclue
    assert result["ca_ttc"] == 0.0
    assert result["count"] == 0


def test_ca_encaisse_exclut_les_pieces_a_reviser(mem_db):
    """Tant qu'une pièce est en révision son montant n'est pas fiable —
    le CA déclaratif doit s'appuyer sur des montants attestés par un
    humain (cohérent avec query_fiscal_summary)."""
    _insert(mem_db, id="ok", montant_ttc=400.0, statut_révision="validé")
    _insert(mem_db, id="ko", montant_ttc=999.0, statut_révision="à_réviser")

    result = query_ca_encaisse(mem_db, "2026-03-01", "2026-03-31")

    assert result["ca_ttc"] == 400.0
    assert result["count"] == 1


def test_ca_encaisse_deduit_les_avoirs_emis(mem_db):
    """Un avoir émis annule un encaissement antérieur — il réduit le CA
    de la période (art. 271 CGI)."""
    _insert(mem_db, id="vente", type_document="facture_émise", montant_ttc=1000.0)
    _insert(mem_db, id="remb",  type_document="avoir_émis",    montant_ttc=200.0)

    result = query_ca_encaisse(mem_db, "2026-03-01", "2026-03-31")

    assert result["ca_ttc"] == 800.0
    assert result["count"] == 2


def test_ca_encaisse_ignore_les_factures_recues(mem_db):
    """Le CA URSSAF n'agrège que les pièces émises — les charges, mêmes
    payées dans la période, ne rentrent jamais dans cet indicateur."""
    _insert(mem_db, id="charge", type_document="facture_reçue", montant_ttc=500.0)

    result = query_ca_encaisse(mem_db, "2026-03-01", "2026-03-31")

    assert result["ca_ttc"] == 0.0
    assert result["count"] == 0


def test_ca_encaisse_ignore_les_factures_sans_date_paiement(mem_db):
    """Tant que l'humain n'a pas saisi la date d'encaissement, la facture
    n'est ni datée ni datable pour URSSAF — elle reste hors agrégat."""
    _insert(mem_db, id="non-pay", date_paiement=None)

    result = query_ca_encaisse(mem_db, "2026-03-01", "2026-03-31")

    assert result["ca_ttc"] == 0.0


def test_ca_encaisse_ignore_les_pieces_corbeille(mem_db):
    """Une facture mise à la corbeille (soft-delete) ne doit jamais
    influencer une déclaration fiscale."""
    _insert(mem_db, id="del", montant_ttc=999.0, deleted_at="2026-04-01T10:00",
            deleted_by="user")

    result = query_ca_encaisse(mem_db, "2026-03-01", "2026-03-31")

    assert result["ca_ttc"] == 0.0
