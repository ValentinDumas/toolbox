"""Spécification métier du helper de dérivation des montants au rendu."""
from services.montants import derive_amounts


class TestDeriveAmounts:
    def test_trois_valeurs_presentes_aucune_derivation(self):
        ht, tva, ttc, derived = derive_amounts(100.0, 20.0, 120.0)
        assert ht == 100.0
        assert tva == 20.0
        assert ttc == 120.0
        assert derived == set()

    def test_ht_manquant_derive_depuis_ttc_et_tva(self):
        ht, tva, ttc, derived = derive_amounts(None, 20.0, 120.0)
        assert ht == 100.0
        assert tva == 20.0
        assert ttc == 120.0
        assert derived == {"ht"}

    def test_tva_manquante_derivee_depuis_ht_et_ttc(self):
        ht, tva, ttc, derived = derive_amounts(100.0, None, 120.0)
        assert ht == 100.0
        assert tva == 20.0
        assert ttc == 120.0
        assert derived == {"tva"}

    def test_ttc_manquant_derive_depuis_ht_et_tva(self):
        ht, tva, ttc, derived = derive_amounts(100.0, 20.0, None)
        assert ht == 100.0
        assert tva == 20.0
        assert ttc == 120.0
        assert derived == {"ttc"}

    def test_ttc_seul_aucune_derivation_possible(self):
        ht, tva, ttc, derived = derive_amounts(None, None, 50.0)
        assert ht is None
        assert tva is None
        assert ttc == 50.0
        assert derived == set()

    def test_aucune_valeur_renvoie_tout_a_none(self):
        ht, tva, ttc, derived = derive_amounts(None, None, None)
        assert ht is None
        assert tva is None
        assert ttc is None
        assert derived == set()
