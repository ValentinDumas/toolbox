# Feature — Clôture annuelle exercice fiscal LMNP (Plan 06)
#
# Couverture obligatoire CONTEXT.md L249-252 :
#   L249 — ARD cross-exercice CGI 39 B
#   L250 — UNIQUE (bailleur_id, exercice) : double clôture interdite
#   L251 — Snapshot immuable post soft-delete encaissement
#   L252 — Anti-sticky LMP : 3 exercices évalués indépendamment
#
# Tags : @phase5 @fis-06 @fis-cloture

@phase5 @fis-06 @fis-cloture
Feature: Clôture annuelle de l'exercice fiscal LMNP

  Background:
    Given un bailleur singleton enregistré avec revenus foyer à null
    And un bien immobilier enregistré
    And le système est prêt pour la clôture fiscale

  @fis-cloture-01
  Scenario: Clôture micro-BIC sans charges — déclaration persistée
    Given des recettes de 20 000 € pour l'exercice 2026
    When le bailleur clôture l'exercice 2026
    Then la déclaration 2026 a regime_applique "micro_bic"
    And la déclaration 2026 a des recettes_totales de 2 000 000 centimes
    And la déclaration 2026 a un statut lmnp_lmp parmi "lmnp_confirme", "indetermine_revenus_foyer_manquants"

  @fis-cloture-02
  Scenario: Clôture régime réel avec composant — tableau d'amortissement enregistré
    Given un bailleur avec des revenus actifs annuels de 150 000 €
    And un composant gros_oeuvre de 200 000 € acquis en 2026
    And une valorisation fiscale activée pour ce bien
    And des recettes de 60 000 € pour l'exercice 2026
    When le bailleur clôture l'exercice 2026 en régime "reel"
    Then la déclaration 2026 a regime_applique "reel"
    And le tableau d'amortissement 2026 contient au moins une ligne

  @fis-cloture-03
  Scenario: Prérequis bloquant — justificatifs non qualifiés → clôture refusée
    Given des recettes de 20 000 € pour l'exercice 2026
    And 2 justificatifs non qualifiés pour l'exercice 2026
    When le bailleur tente de clôturer l'exercice 2026
    Then la clôture est refusée pour prérequis non satisfaits

  @fis-cloture-04
  Scenario: Snapshot immuable après soft-delete encaissement post-clôture (CONTEXT.md L251)
    Given un bailleur avec des revenus actifs annuels de 60 000 €
    And des recettes de 50 000 € pour l'exercice 2026
    When le bailleur clôture l'exercice 2026
    Then la déclaration 2026 a des recettes_totales de 5 000 000 centimes
    When un encaissement de l'exercice 2026 est annulé post-clôture
    Then la déclaration 2026 a toujours des recettes_totales de 5 000 000 centimes

  @fis-cloture-05
  Scenario: Double clôture interdite — DeclarationDejaExiste (CONTEXT.md L250)
    Given des recettes de 20 000 € pour l'exercice 2026
    When le bailleur clôture l'exercice 2026
    Then la déclaration 2026 est créée
    When le bailleur tente de clôturer l'exercice 2026 une deuxième fois
    Then la deuxième clôture lance DeclarationDejaExiste

  @fis-cloture-06
  Scenario: Anti-sticky LMP — 3 exercices évalués indépendamment (CONTEXT.md L252)
    # N : LMNP confirmé (recettes 24k / foyer 30k)
    Given un bailleur avec des revenus actifs annuels de 30 000 €
    And des recettes de 24 000 € pour l'exercice 2026
    When le bailleur clôture l'exercice 2026
    Then la déclaration 2026 a statut lmnp_lmp "lmnp_confirme"

    # N+1 : LMP probable (recettes 24k / foyer 20k)
    Given un bailleur avec des revenus actifs annuels de 20 000 €
    And des recettes de 24 000 € pour l'exercice 2027
    When le bailleur clôture l'exercice 2027
    Then la déclaration 2027 a statut lmnp_lmp "lmp_probable"

    # N+2 : LMNP confirmé (recettes 24k / foyer 25k)
    Given un bailleur avec des revenus actifs annuels de 25 000 €
    And des recettes de 24 000 € pour l'exercice 2028
    When le bailleur clôture l'exercice 2028
    Then la déclaration 2028 a statut lmnp_lmp "lmnp_confirme"

  @fis-cloture-07
  Scenario: Régime réel forcé si recettes > seuil micro-BIC
    Given un bailleur avec des revenus actifs annuels de 150 000 €
    And un composant gros_oeuvre de 200 000 € acquis en 2026
    And une valorisation fiscale activée pour ce bien
    And des recettes de 90 000 € pour l'exercice 2026
    When le bailleur clôture l'exercice 2026 en régime "micro_bic"
    Then la déclaration 2026 a regime_applique "reel"

  @fis-cloture-08
  Scenario: Figée check — qualification justificatif post-clôture refusée (D-FIS-G2.5)
    Given des recettes de 20 000 € pour l'exercice 2026
    When le bailleur clôture l'exercice 2026
    And un justificatif de l'exercice 2026 est créé post-clôture
    When le bailleur tente de qualifier ce justificatif
    Then la qualification est refusée pour DeclarationFigeeException
