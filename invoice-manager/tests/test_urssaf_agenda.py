"""Tests BDD de l'agenda des déclarations URSSAF (#133).

Couvre AUTO_ENTREPRENEUR_RULES.md §4.2 :
- 12 périodes mensuelles ou 4 périodes trimestrielles selon la cadence
- échéances : dernier jour du mois suivant (mensuel) ; 30/04, 31/07,
  31/10, 31/01 N+1 (trimestriel)
- transition d'état : à_déclarer ↔ déclarée, append-only, traçable
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from extract import open_db
from services.urssaf import (
    CADENCE_MENSUELLE,
    CADENCE_TRIMESTRIELLE,
    generate_periods,
    get_declared_periods,
    mark_period_declared,
    unmark_period_declared,
)


@pytest.fixture
def mem_db():
    conn = open_db(Path(":memory:"))
    yield conn
    conn.close()


# ── Génération des périodes ───────────────────────────────────────────────────

def test_cadence_mensuelle_genere_12_periodes_pour_l_annee():
    # Given un AE en cadence mensuelle pour 2026
    # When on génère les périodes
    periods = generate_periods(2026, CADENCE_MENSUELLE)

    # Then il y a 12 périodes, une par mois, dans l'ordre chronologique
    assert len(periods) == 12
    assert periods[0]["period_key"] == "2026-M01"
    assert periods[0]["start"] == "2026-01-01"
    assert periods[0]["end"] == "2026-01-31"
    assert periods[-1]["period_key"] == "2026-M12"
    assert periods[-1]["end"] == "2026-12-31"


def test_echeance_mensuelle_est_le_dernier_jour_du_mois_suivant():
    """Règle §4.2 : déclaration et paiement = dernier jour du mois
    suivant le mois d'encaissement (CA janvier → échéance 28 février)."""
    # Given les 12 périodes mensuelles de 2026
    periods = generate_periods(2026, CADENCE_MENSUELLE)

    # When on lit l'échéance de chaque période
    # Then janvier échoit fin février, décembre échoit fin janvier N+1
    assert periods[0]["deadline"] == "2026-02-28"
    assert periods[-1]["deadline"] == "2027-01-31"


def test_cadence_trimestrielle_genere_4_periodes_avec_echeances_fixes():
    # Given un AE en cadence trimestrielle pour 2026
    periods = generate_periods(2026, CADENCE_TRIMESTRIELLE)

    # Then il y a 4 trimestres avec les échéances réglementaires §4.2
    assert len(periods) == 4
    deadlines = [p["deadline"] for p in periods]
    assert deadlines == ["2026-04-30", "2026-07-31", "2026-10-31", "2027-01-31"]
    # T1 = jan-fév-mars
    assert periods[0]["start"] == "2026-01-01"
    assert periods[0]["end"] == "2026-03-31"


def test_cadence_inconnue_leve_erreur():
    """ACL : la cadence doit avoir été validée en amont (paramètres profil)."""
    with pytest.raises(ValueError):
        generate_periods(2026, "annuelle")


# ── Transition d'état : marquer déclarée ──────────────────────────────────────

def test_marquer_une_periode_la_fait_passer_a_declaree(mem_db):
    # Given une période non déclarée
    assert "2026-M03" not in get_declared_periods(mem_db)

    # When un humain la marque déclarée
    mark_period_declared(mem_db, "2026-M03", actor="user")

    # Then elle apparaît dans la liste des périodes déclarées avec un horodatage
    declared = get_declared_periods(mem_db)
    assert "2026-M03" in declared
    assert declared["2026-M03"]  # marked_at non vide


def test_annuler_une_declaration_la_retire_de_la_liste(mem_db):
    """Correction d'erreur de saisie (cliqué par mégarde) : on doit pouvoir
    revenir à `à_déclarer` sans manipulation manuelle de la base."""
    # Given une période déclarée
    mark_period_declared(mem_db, "2026-M03")
    assert "2026-M03" in get_declared_periods(mem_db)

    # When on annule la déclaration
    unmark_period_declared(mem_db, "2026-M03")

    # Then la période n'est plus marquée déclarée
    assert "2026-M03" not in get_declared_periods(mem_db)


def test_marquer_deux_fois_la_meme_periode_reste_idempotent(mem_db):
    """Garde-fou anti double-clic UI : marquer une période déjà déclarée
    ne lève pas et ne crée pas de doublon (PRIMARY KEY + REPLACE)."""
    mark_period_declared(mem_db, "2026-M03")
    mark_period_declared(mem_db, "2026-M03")
    declared = get_declared_periods(mem_db)
    assert list(declared.keys()).count("2026-M03") == 1
