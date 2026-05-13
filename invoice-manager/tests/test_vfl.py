"""Tests BDD du versement libératoire IR (#137).

Couvre AUTO_ENTREPRENEUR_RULES.md §3.2 :
- taux par activité (1 % vente, 1,7 % service BIC, 2,2 % BNC)
- option exerçable uniquement si flag profil `versement_liberatoire`
- VFL prélevé en même temps que les cotisations (ligne distincte dans le récap)
"""
import csv
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from extract import open_db
from services.urssaf import CADENCE_MENSUELLE, compute_vfl, generate_periods
from services.urssaf_export import export_declaration_csv


@pytest.fixture
def mem_db():
    conn = open_db(Path(":memory:"))
    yield conn
    conn.close()


def _insert(conn, **kw):
    defaults = {
        "id": "f", "type_document": "facture_émise", "montant_ttc": 10_000.0,
        "date_paiement": "2026-03-15", "statut_révision": "validé",
    }
    row = {**defaults, **kw}
    cols = ", ".join(f'"{k}"' for k in row)
    ph = ", ".join("?" for _ in row)
    conn.execute(f"INSERT INTO invoices ({cols}) VALUES ({ph})", list(row.values()))
    conn.commit()


@pytest.mark.parametrize("activite, taux", [
    ("vente", 0.010),
    ("service_bic", 0.017),
    ("service_bnc_ssi", 0.022),
    ("service_bnc_cipav", 0.022),
])
def test_compute_vfl_applique_le_taux_par_activite(activite, taux):
    """Table d'exemples §3.2 : un taux distinct par activité."""
    # Given un CA encaissé de 10 000 €
    # When on calcule le VFL pour l'activité
    result = compute_vfl(10_000.0, activite)

    # Then le montant = CA × taux activité
    assert result["vfl"] == round(10_000.0 * taux, 2)
    assert result["taux_applique"] == taux


def test_vfl_apparait_dans_le_recap_si_option_activee(mem_db, tmp_path):
    """Le récap d'une période avec VFL doit montrer une ligne VFL distincte
    et l'inclure dans le total à payer."""
    # Given un AE service BIC avec VFL activé et 10 000 € encaissés
    _insert(mem_db, montant_ttc=10_000.0)
    profile = {
        "nom": "Test", "siren": "123456789",
        "activite_principale": "service_bic", "versement_liberatoire": 1,
    }
    period = generate_periods(2026, CADENCE_MENSUELLE)[2]

    # When on génère le récap
    path = export_declaration_csv(mem_db, profile, period, tmp_path)
    rows = [r for r in csv.reader(path.open(encoding="utf-8-sig"), delimiter=";") if r]

    # Then une ligne VFL apparaît (10 000 × 1,7 % = 170 €)
    vfl_rows = [r for r in rows if "Versement libératoire" in r[0]]
    assert vfl_rows, "Ligne VFL absente du récap alors que l'option est active"
    assert vfl_rows[0][1] == "170,00"


def test_vfl_absent_du_recap_si_option_desactivee(mem_db, tmp_path):
    """Sans l'option, aucune ligne VFL ne doit apparaître — on ne calcule
    pas un IR fictif pour un AE qui paie son IR au barème classique."""
    _insert(mem_db, montant_ttc=10_000.0)
    profile = {
        "nom": "Test", "siren": "123456789",
        "activite_principale": "service_bic", "versement_liberatoire": 0,
    }
    period = generate_periods(2026, CADENCE_MENSUELLE)[2]
    path = export_declaration_csv(mem_db, profile, period, tmp_path)
    rows = [r for r in csv.reader(path.open(encoding="utf-8-sig"), delimiter=";") if r]

    assert not [r for r in rows if "Versement libératoire" in r[0]]
