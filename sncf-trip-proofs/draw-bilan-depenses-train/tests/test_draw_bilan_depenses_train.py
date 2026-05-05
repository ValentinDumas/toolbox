"""
Tests métier — draw-bilan-depenses-train

Approche : tests unitaires sur les fonctions de parsing et de génération du bilan.
Aucun vrai PDF requis — les noms de fichiers renommés sont passés directement.
"""
import importlib.util
from pathlib import Path

import pytest

_spec = importlib.util.spec_from_file_location(
    "draw_bilan_depenses_train",
    Path(__file__).parent.parent / "draw-bilan-depenses-train.py",
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

Trip = _mod.Trip
ErrorEntry = _mod.ErrorEntry
parse_renamed_filename = _mod.parse_renamed_filename
parse_date_str = _mod.parse_date_str
extract_ref_base = _mod.extract_ref_base
fmt_eur = _mod.fmt_eur
generate_report = _mod.generate_report


# ── 1. Reconnaissance des noms de fichiers ────────────────────────────────────

class TestParseRenamedFilename:
    def test_achat_simple(self):
        r = parse_renamed_filename("justificatif-achat-20260402-18-50ttc-2668453920-20260330.pdf")
        assert r is not None
        date_part, amount, ref = r
        assert date_part == "20260402"
        assert amount == 18.50
        assert ref == "2668453920-20260330"

    def test_achat_multi_dates_utilise_premiere_date(self):
        r = parse_renamed_filename("justificatif-achat-20260423-20260424-57-00ttc-1480540391-20260504.pdf")
        assert r is not None
        date_part, amount, _ = r
        assert date_part[:8] == "20260423"
        assert amount == 57.00

    def test_voyage_sans_tcn(self):
        r = parse_renamed_filename("justificatif-voyage-20260316-15-60ttc-d56qej.pdf")
        assert r is not None
        date_part, amount, ref = r
        assert date_part == "20260316"
        assert amount == 15.60
        assert ref == "d56qej"

    def test_voyage_avec_tcn(self):
        r = parse_renamed_filename("justificatif-voyage-20260326-10-00ttc-m56qd3-016404373.pdf")
        assert r is not None
        _, amount, _ = r
        assert amount == 10.00

    def test_voyage_avec_suffixe_conflit(self):
        r = parse_renamed_filename("justificatif-voyage-20260416-18-50ttc-n4m4xx-016733616-1.pdf")
        assert r is not None
        date_part, amount, _ = r
        assert date_part == "20260416"
        assert amount == 18.50

    def test_nom_non_reconnu(self):
        assert parse_renamed_filename("facture-sncf.pdf") is None

    def test_nom_vide(self):
        assert parse_renamed_filename("") is None


# ── 2. Validation de date ─────────────────────────────────────────────────────

class TestParseDateStr:
    def test_date_valide(self):
        assert parse_date_str("20260402") == (2026, 4, 2)

    def test_mois_invalide(self):
        assert parse_date_str("20261302") is None

    def test_jour_zero(self):
        assert parse_date_str("20260400") is None

    def test_annee_trop_ancienne(self):
        assert parse_date_str("19991231") is None

    def test_format_trop_court(self):
        assert parse_date_str("2026042") is None

    def test_format_non_numerique(self):
        assert parse_date_str("2026040X") is None

    def test_premier_jour_du_mois(self):
        assert parse_date_str("20260101") == (2026, 1, 1)

    def test_dernier_mois(self):
        assert parse_date_str("20261231") == (2026, 12, 31)


# ── 3. Extraction de la référence de base ─────────────────────────────────────

class TestExtractRefBase:
    def test_format_achat_avec_date(self):
        assert extract_ref_base("2668453920-20260330") == "2668453920"

    def test_reference_courte_voyage(self):
        assert extract_ref_base("D56QEJ") == "D56QEJ"

    def test_reference_inchangee_si_pas_de_tiret_date(self):
        assert extract_ref_base("M56QD3") == "M56QD3"


# ── 4. Formatage des montants ─────────────────────────────────────────────────

class TestFmtEur:
    def test_montant_entier(self):
        assert fmt_eur(57.0) == "57,00 €"

    def test_montant_decimal(self):
        assert fmt_eur(15.6) == "15,60 €"

    def test_montant_superieur_mille(self):
        assert fmt_eur(1234.56) == "1 234,56 €"

    def test_zero(self):
        assert fmt_eur(0.0) == "0,00 €"


# ── 5. Génération du bilan ────────────────────────────────────────────────────

class TestGenerateReport:
    def _make_trip(self, year=2026, month=4, day=2, amount=18.50):
        return Trip(filename="test.pdf", amount=amount, year=year, month=month, day=day)

    def test_bilan_contient_titre_annee(self):
        trips = [self._make_trip()]
        report = generate_report(trips, [], 2026, 1)
        assert "# Bilan dépenses train — 2026" in report

    def test_bilan_contient_total_correct(self):
        trips = [self._make_trip(amount=18.50), self._make_trip(amount=15.60)]
        report = generate_report(trips, [], 2026, 2)
        assert "34,10 €" in report

    def test_total_annuel_egal_somme_mensuels(self):
        trips = [
            self._make_trip(month=3, amount=15.60),
            self._make_trip(month=4, amount=18.50),
            self._make_trip(month=4, amount=10.00),
        ]
        report = generate_report(trips, [], 2026, 3)
        assert "44,10 €" in report   # total annuel
        assert "15,60 €" in report   # mars
        assert "28,50 €" in report   # avril

    def test_bilan_avec_erreur_affiche_section(self):
        trips = [self._make_trip()]
        errors = [ErrorEntry(filename="inconnu.pdf", reason="Nom non reconnu")]
        report = generate_report(trips, errors, 2026, 1)
        assert "Fichiers non traités" in report
        assert "inconnu.pdf" in report

    def test_bilan_sans_erreur_pas_de_section_erreurs(self):
        trips = [self._make_trip()]
        report = generate_report(trips, [], 2026, 1)
        assert "Fichiers non traités" not in report

    def test_bilan_contient_detail_par_mois(self):
        trips = [self._make_trip(month=4)]
        report = generate_report(trips, [], 2026, 1)
        assert "Avril 2026" in report

    def test_bilan_plusieurs_mois_tries(self):
        trips = [
            self._make_trip(month=4, day=1),
            self._make_trip(month=3, day=15),
        ]
        report = generate_report(trips, [], 2026, 2)
        pos_mars = report.index("Mars 2026")
        pos_avril = report.index("Avril 2026")
        assert pos_mars < pos_avril
