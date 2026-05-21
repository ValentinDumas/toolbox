# Feature — Déclaration corrigée post-clôture LMNP (Plan 06)
#
# Couverture D-FIS-G4.4 : append-only strict
#   — originale reste intacte après correction
#   — motif requis pour l'audit
#
# Tags : @phase5 @fis-06 @fis-declaration-corrigee

@phase5 @fis-06 @fis-declaration-corrigee
Feature: Création d'une déclaration corrigée post-clôture

  Background:
    Given un bailleur singleton enregistré avec revenus foyer à null
    And un bien immobilier enregistré
    And le système est prêt pour la clôture fiscale

  @fis-declaration-corrigee-01
  Scenario: Correction de recettes — originale intacte (D-FIS-G4.4)
    Given des recettes de 20 000 € pour l'exercice 2026
    When le bailleur clôture l'exercice 2026
    Then la déclaration 2026 a des recettes_totales de 2 000 000 centimes
    When une correction est créée sur la déclaration 2026 avec recettes 18 000 €
    Then la déclaration 2026 a toujours des recettes_totales de 2 000 000 centimes
    And la correction a des recettes_totales de 1 800 000 centimes

  @fis-declaration-corrigee-02
  Scenario: Correction sans motif — refusée (invariant domaine)
    Given des recettes de 20 000 € pour l'exercice 2026
    When le bailleur clôture l'exercice 2026
    When une correction sans motif est tentée sur la déclaration 2026
    Then la correction est refusée pour motif manquant
