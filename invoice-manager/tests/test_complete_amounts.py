"""
Spec exécutable de `services.montants.complete_amounts` — règles comptables
de complétion HT / TVA / TTC et de normalisation du taux de TVA.

Style BDD : un test = une règle métier, structure Given / When / Then.
"""
import pytest

from services.montants import (
    Amounts,
    WARN_RATE_UNUSUAL,
    WARN_TVA_MISMATCH,
    complete_amounts,
    derive_amounts,
)


# ── Complétion d'un montant manquant à partir des deux autres ─────────────────

class TestComplétionDeuxMontantsConnus:
    def test_ht_et_tva_connus_donnent_ttc(self):
        # Given une facture où HT et TVA sont lus sur le document
        # When on demande la complétion
        result = complete_amounts(ht=100.00, tva=20.00, ttc=None)

        # Then TTC vaut HT + TVA et est marqué comme calculé
        assert result.ttc == 120.00
        assert "ttc" in result.derived
        assert result.warnings == ()

    def test_ht_et_ttc_connus_donnent_tva(self):
        # Given une facture où HT et TTC sont lus
        result = complete_amounts(ht=100.00, tva=None, ttc=120.00)

        # Then TVA vaut TTC − HT
        assert result.tva == 20.00
        assert "tva" in result.derived

    def test_tva_et_ttc_connus_donnent_ht(self):
        # Given une facture où TVA et TTC sont lus
        result = complete_amounts(ht=None, tva=20.00, ttc=120.00)

        # Then HT vaut TTC − TVA
        assert result.ht == 100.00
        assert "ht" in result.derived


# ── Inférence depuis le taux (mode édition uniquement) ────────────────────────

class TestInférenceDepuisLeTaux:
    def test_facture_avec_ht_et_taux_complète_tva_et_ttc_en_mode_édition(self):
        # Given un humain qui saisit HT et choisit un taux de 20 %
        # When la sauvegarde recalcule en mode édition
        result = complete_amounts(
            ht=100.00, tva=None, ttc=None, taux=0.20,
            infer_from_rate=True,
        )

        # Then TVA et TTC sont calculés depuis HT × taux
        assert result.tva == 20.00
        assert result.ttc == 120.00
        assert {"tva", "ttc"}.issubset(result.derived)

    def test_facture_avec_ttc_et_taux_complète_ht_et_tva_en_mode_édition(self):
        # Given un humain qui saisit TTC et choisit un taux de 20 %
        result = complete_amounts(
            ht=None, tva=None, ttc=120.00, taux=0.20,
            infer_from_rate=True,
        )

        # Then HT et TVA sont calculés ; HT = TTC / (1 + taux)
        assert result.ht == 100.00
        assert result.tva == 20.00

    def test_extraction_ne_devine_jamais_un_montant_depuis_le_taux(self):
        # Given une extraction OCR qui n'a trouvé que HT sur le document
        # When on appelle la complétion en mode extraction
        result = complete_amounts(
            ht=100.00, tva=None, ttc=None, taux=0.20,
            infer_from_rate=False,
        )

        # Then aucun montant n'est inventé — la traçabilité document/DB est préservée
        assert result.tva is None
        assert result.ttc is None
        assert "tva" not in result.derived
        assert "ttc" not in result.derived


# ── Cohérence des trois montants ──────────────────────────────────────────────

class TestCohérenceTroisMontants:
    def test_trois_montants_cohérents_à_un_centime_près_passent(self):
        # Given trois montants imprimés sur la facture, écart ≤ 1 c
        result = complete_amounts(ht=100.00, tva=20.00, ttc=120.00)

        # Then aucun avertissement, aucun champ calculé
        assert result.warnings == ()
        assert result.derived == frozenset({"taux"}) or "taux" in result.derived

    def test_trois_montants_avec_arrondi_multi_lignes_passent(self):
        # Given une facture multi-lignes avec HT+TVA = TTC ± 0.01
        result = complete_amounts(ht=100.00, tva=20.00, ttc=119.99)

        # Then la tolérance d'1 centime accepte l'écart
        assert WARN_TVA_MISMATCH not in result.warnings

    def test_trois_montants_incohérents_émettent_un_avertissement_sans_écraser(self):
        # Given un humain qui sauvegarde HT=100, TVA=15, TTC=120 (incohérent)
        result = complete_amounts(ht=100.00, tva=15.00, ttc=120.00)

        # Then les valeurs sont conservées telles quelles, warning émis
        assert result.ht == 100.00
        assert result.tva == 15.00
        assert result.ttc == 120.00
        assert WARN_TVA_MISMATCH in result.warnings


# ── Normalisation du taux ─────────────────────────────────────────────────────

class TestNormalisationDuTaux:
    @pytest.mark.parametrize("legal_rate", [0.0, 0.021, 0.055, 0.10, 0.20])
    def test_taux_proche_d_un_taux_légal_est_snappé(self, legal_rate):
        # Given HT et TVA cohérents avec un taux légal à 0,1 % près
        ht = 100.00
        tva = round(ht * legal_rate, 2)

        # When on déduit le taux
        result = complete_amounts(ht=ht, tva=tva, ttc=None)

        # Then le taux est exactement le taux légal (lossless via 4 décimales)
        assert result.taux == legal_rate

    def test_taux_distant_des_taux_légaux_est_conservé_avec_avertissement(self):
        # Given un taux exotique (7 %) qu'aucun taux légal ne couvre
        result = complete_amounts(ht=100.00, tva=7.00, ttc=None)

        # Then le taux brut est conservé et signalé
        assert result.taux == 0.07
        assert WARN_RATE_UNUSUAL in result.warnings

    def test_taux_2_1_pourcent_reste_lossless_en_fraction_4_décimales(self):
        # Given HT=100, TVA=2.10 (taux super-réduit)
        result = complete_amounts(ht=100.00, tva=2.10, ttc=None)

        # Then le taux stocké est 0.021 — ni 0.02 ni 0.021000001
        assert result.taux == 0.021

    def test_taux_5_5_pourcent_reste_lossless(self):
        # Given une facture restaurant à 5,5 %
        result = complete_amounts(ht=100.00, tva=5.50, ttc=None)

        # Then le taux stocké est 0.055
        assert result.taux == 0.055


# ── Cas limites ───────────────────────────────────────────────────────────────

class TestCasLimites:
    def test_ht_nul_ne_provoque_pas_de_division_par_zéro(self):
        # Given un ticket exonéré de TVA (HT=0)
        # When on demande la complétion
        result = complete_amounts(ht=0.00, tva=0.00, ttc=0.00)

        # Then le calcul aboutit sans exception, taux reste None
        assert result.warnings == ()
        assert result.taux is None

    def test_aucune_valeur_connue_retourne_tout_à_none(self):
        # Given une facture où rien n'a été extrait
        result = complete_amounts(ht=None, tva=None, ttc=None)

        # Then le résultat est vide, sans warning
        assert result == Amounts(
            ht=None, tva=None, ttc=None, taux=None,
            derived=frozenset(), warnings=(),
        )

    def test_arrondi_commercial_demi_au_dessus_sur_le_centime(self):
        # Given un calcul produisant 0.005 au demi-centime
        # When on quantize à 2 décimales (HALF_UP)
        result = complete_amounts(ht=10.005, tva=2.001, ttc=None)

        # Then 0.005 → 0.01 (HALF_UP), pas 0.00 (HALF_EVEN)
        assert result.ht == 10.01
        assert result.tva == 2.00


# ── Façade historique `derive_amounts` ────────────────────────────────────────

class TestFaçadeDeriveAmounts:
    def test_signature_historique_inchangée(self):
        # Given le contrat existant (ht, tva, ttc) → (ht, tva, ttc, set)
        ht, tva, ttc, derived = derive_amounts(100.0, 20.0, None)

        # Then TTC est calculé et le set ne contient que des noms de montants
        assert (ht, tva, ttc) == (100.0, 20.0, 120.0)
        assert derived == {"ttc"}

    def test_facade_n_infère_pas_depuis_le_taux(self):
        # Given un seul montant connu (le rendu ne doit jamais inventer)
        ht, tva, ttc, derived = derive_amounts(100.0, None, None)

        # Then aucun champ n'est dérivé
        assert (tva, ttc) == (None, None)
        assert derived == set()
