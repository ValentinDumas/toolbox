"""Tests BDD — services/comptabilite.py.

Specification exécutable : un type de pièce → un sens comptable PCG.
Convention : charges au débit, produits au crédit, avoirs en contre-passation.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.comptabilite import (
    SENS_CREDIT,
    SENS_DEBIT,
    SENS_NONE,
    is_off_ledger,
    sens_comptable,
    split_debit_credit,
    to_journal_row,
)


class TestSensComptable:
    def test_facture_recue_se_lit_au_debit(self):
        # Given une facture reçue d'un fournisseur (charge)
        # When je demande son sens comptable
        # Then elle se lit au débit (PCG : charges au débit)
        assert sens_comptable("facture_reçue") == SENS_DEBIT

    def test_recu_se_lit_au_debit(self):
        assert sens_comptable("reçu") == SENS_DEBIT

    def test_note_de_frais_se_lit_au_debit(self):
        assert sens_comptable("note_de_frais") == SENS_DEBIT

    def test_facture_emise_se_lit_au_credit(self):
        # Given une facture émise à un client (produit)
        # When je demande son sens comptable
        # Then elle se lit au crédit (PCG : produits au crédit)
        assert sens_comptable("facture_émise") == SENS_CREDIT

    def test_avoir_recu_contre_passe_une_charge_au_credit(self):
        # Given un avoir reçu d'un fournisseur (annule une charge)
        # When je demande son sens comptable
        # Then il se lit au crédit (contre-passation)
        assert sens_comptable("avoir_reçu") == SENS_CREDIT

    def test_avoir_emis_contre_passe_un_produit_au_debit(self):
        # Given un avoir émis à un client (annule un produit)
        # When je demande son sens comptable
        # Then il se lit au débit (contre-passation)
        assert sens_comptable("avoir_émis") == SENS_DEBIT

    def test_releve_bancaire_est_off_ledger(self):
        assert sens_comptable("relevé_bancaire") == SENS_NONE
        assert is_off_ledger("relevé_bancaire") is True

    def test_devis_est_off_ledger(self):
        assert sens_comptable("devis") == SENS_NONE
        assert is_off_ledger("devis") is True

    def test_type_inconnu_est_off_ledger(self):
        assert sens_comptable("type_imaginaire") == SENS_NONE
        assert sens_comptable(None) == SENS_NONE


class TestSplitDebitCredit:
    def test_montant_debit_va_dans_colonne_debit(self):
        assert split_debit_credit(100.0, SENS_DEBIT) == (100.0, None)

    def test_montant_credit_va_dans_colonne_credit(self):
        assert split_debit_credit(100.0, SENS_CREDIT) == (None, 100.0)

    def test_montant_none_donne_deux_cellules_vides(self):
        # Pas de zéro parasite : un montant absent reste absent dans l'export.
        assert split_debit_credit(None, SENS_DEBIT) == (None, None)
        assert split_debit_credit(None, SENS_CREDIT) == (None, None)

    def test_off_ledger_donne_deux_cellules_vides(self):
        assert split_debit_credit(100.0, SENS_NONE) == (None, None)


class TestToJournalRow:
    def test_facture_recue_remplit_les_colonnes_debit(self):
        row = {
            "type_document": "facture_reçue",
            "montant_ht": 100.0,
            "montant_tva": 20.0,
            "montant_ttc": 120.0,
            "date_document": "2025-03-01",
            "numéro_facture": "F-001",
            "émetteur_nom": "OVH",
        }
        jr = to_journal_row(row)
        assert jr["débit_ht"] == 100.0
        assert jr["débit_tva"] == 20.0
        assert jr["débit_ttc"] == 120.0
        assert jr["crédit_ht"] is None
        assert jr["crédit_tva"] is None
        assert jr["crédit_ttc"] is None
        assert jr["sens"] == SENS_DEBIT

    def test_facture_emise_remplit_les_colonnes_credit(self):
        row = {
            "type_document": "facture_émise",
            "montant_ht": 1000.0,
            "montant_tva": 200.0,
            "montant_ttc": 1200.0,
        }
        jr = to_journal_row(row)
        assert jr["crédit_ht"] == 1000.0
        assert jr["crédit_tva"] == 200.0
        assert jr["crédit_ttc"] == 1200.0
        assert jr["débit_ht"] is None

    def test_libelle_fallback_sur_categorie_si_pas_de_description(self):
        row = {"type_document": "facture_reçue", "montant_ht": 50, "catégorie": "hébergement"}
        jr = to_journal_row(row)
        assert jr["libellé"] == "hébergement"

    def test_libelle_prefere_description_a_categorie(self):
        row = {
            "type_document": "facture_reçue",
            "montant_ht": 50,
            "description_prestation": "Serveur dédié",
            "catégorie": "hébergement",
        }
        jr = to_journal_row(row)
        assert jr["libellé"] == "Serveur dédié"
