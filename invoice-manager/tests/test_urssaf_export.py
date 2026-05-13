"""Tests BDD de l'export récapitulatif URSSAF (#134)."""
import csv
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from extract import open_db
from services.urssaf import generate_periods, CADENCE_MENSUELLE
from services.urssaf_export import export_declaration_csv


@pytest.fixture
def mem_db(tmp_path):
    conn = open_db(Path(":memory:"))
    yield conn
    conn.close()


def _insert(conn, **kw):
    defaults = {
        "id": "f-x",
        "type_document": "facture_émise",
        "montant_ttc": 1000.0,
        "date_document": "2026-03-15",
        "date_paiement": "2026-03-20",
        "statut_révision": "validé",
        "exercice_fiscal": 2026,
        "numéro_facture": "F-001",
        "destinataire_nom": "Client SARL",
    }
    row = {**defaults, **kw}
    cols = ", ".join(f'"{k}"' for k in row)
    ph = ", ".join("?" for _ in row)
    conn.execute(f"INSERT INTO invoices ({cols}) VALUES ({ph})", list(row.values()))
    conn.commit()


def _read(path: Path):
    with path.open(encoding="utf-8-sig") as f:
        return list(csv.reader(f, delimiter=";"))


def test_export_genere_un_fichier_csv_nomme_avec_la_periode(mem_db, tmp_path):
    # Given une période mensuelle et un AE service BIC
    period = generate_periods(2026, CADENCE_MENSUELLE)[2]  # mars 2026
    profile = {"nom": "Jean Dupont", "siren": "123456789",
               "activite_principale": "service_bic"}

    # When on génère le récap
    path = export_declaration_csv(mem_db, profile, period, tmp_path)

    # Then le fichier existe et est nommé selon la période
    assert path.exists()
    assert path.name == "urssaf-2026-M03.csv"


def test_export_recense_les_factures_encaissees_sur_la_periode(mem_db, tmp_path):
    # Given deux factures encaissées en mars 2026
    _insert(mem_db, id="a", montant_ttc=500.0, date_paiement="2026-03-10",
            numéro_facture="F-1", destinataire_nom="Client A")
    _insert(mem_db, id="b", montant_ttc=300.0, date_paiement="2026-03-25",
            numéro_facture="F-2", destinataire_nom="Client B")
    period = generate_periods(2026, CADENCE_MENSUELLE)[2]
    profile = {"nom": "Test", "siren": "123456789",
               "activite_principale": "service_bic"}

    # When on exporte le récap
    path = export_declaration_csv(mem_db, profile, period, tmp_path)
    rows = _read(path)
    flat = ["|".join(r) for r in rows]

    # Then le CSV contient le CA encaissé, les cotisations et les deux pièces
    assert any(len(r) >= 2 and "CA encaissé sur la période" in r[0] and r[1] == "800,00" for r in rows)
    assert any(r and "Cotisations sociales" in r[0] for r in rows)
    assert any("Client A" in row and "F-1" in row for row in flat)
    assert any("Client B" in row and "F-2" in row for row in flat)


def test_export_avec_ca_nul_signale_la_declaration_obligatoire(mem_db, tmp_path):
    """§4.4 : la déclaration est obligatoire même à 0 €. Le récap doit
    expliciter ce cas pour ne pas laisser l'utilisateur croire à un bug."""
    period = generate_periods(2026, CADENCE_MENSUELLE)[2]
    profile = {"nom": "Test", "siren": "123456789",
               "activite_principale": "service_bic"}

    path = export_declaration_csv(mem_db, profile, period, tmp_path)
    rows = _read(path)

    assert any("§4.4" in r[1] for r in rows if len(r) > 1)


def test_export_inclut_la_base_ir_quand_profil_ae_sans_vfl(mem_db, tmp_path):
    """§3.1 : pour un AE sans VFL, le récap doit afficher l'abattement
    forfaitaire et le bénéfice imposable IR (assiette 2042-C-PRO)."""
    # Given un AE service BIC sans VFL, 10 000 € encaissés sur la période
    _insert(mem_db, id="a", montant_ttc=10000.0, date_paiement="2026-03-10")
    period = generate_periods(2026, CADENCE_MENSUELLE)[2]
    profile = {"nom": "Test", "siren": "123456789",
               "activite_principale": "service_bic", "versement_liberatoire": 0}

    # When on exporte le récap
    path = export_declaration_csv(mem_db, profile, period, tmp_path)
    rows = _read(path)

    # Then la section base IR est présente avec abattement = bénéfice = 5000,00
    assert any(r and "Base IR — 2042-C-PRO" in r[0] for r in rows)
    assert any(
        len(r) >= 2 and "Abattement forfaitaire" in r[0] and r[1] == "5000,00"
        for r in rows
    )
    assert any(
        len(r) >= 2 and r[0] == "Bénéfice imposable IR" and r[1] == "5000,00"
        for r in rows
    )


def test_export_omet_la_base_ir_quand_profil_ae_avec_vfl(mem_db, tmp_path):
    """§3.2 : avec le VFL, l'IR est libéré à la source — la base 2042-C-PRO
    ne doit pas apparaître dans le récap pour éviter une double imposition
    affichée."""
    _insert(mem_db, id="a", montant_ttc=10000.0, date_paiement="2026-03-10")
    period = generate_periods(2026, CADENCE_MENSUELLE)[2]
    profile = {"nom": "Test", "siren": "123456789",
               "activite_principale": "service_bic", "versement_liberatoire": 1}

    path = export_declaration_csv(mem_db, profile, period, tmp_path)
    rows = _read(path)

    assert not any(r and "Base IR — 2042-C-PRO" in r[0] for r in rows)
    assert not any(r and "Bénéfice imposable IR" in r[0] for r in rows)


def test_export_omet_cotisations_si_activite_non_renseignee(mem_db, tmp_path):
    """Tant que l'AE n'a pas choisi son activité, on ne peut pas calculer
    les cotisations — on l'invite à compléter le profil au lieu de
    deviner."""
    _insert(mem_db, id="a", montant_ttc=500.0, date_paiement="2026-03-10")
    period = generate_periods(2026, CADENCE_MENSUELLE)[2]
    profile = {"nom": "Test", "siren": "123456789", "activite_principale": None}

    path = export_declaration_csv(mem_db, profile, period, tmp_path)
    rows = _read(path)

    assert any(r and "non calculées" in r[0] for r in rows)
    assert any(len(r) > 1 and "Activité principale" in r[1] for r in rows)
