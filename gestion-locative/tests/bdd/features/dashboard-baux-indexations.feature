# Feature — Page transversale révisions IRL /baux/indexations (Phase 7 / DAS-01 / D-DASH-04 / D-90)
# Couverture : table peuplée, exclusion gel DPE F/G (D-92), exclusion exercice courant (D-SRC-03), empty-state
# Tags : @phase7 @phase7-baux-indexations

@phase7 @phase7-baux-indexations
Feature: Page transversale révisions IRL à venir

  @phase7-baux-indexations-01
  Scenario: Table peuplée — bail actif IRL dû sur bien DPE C sans indexation cette année
    Given un bail actif IRL dû (anniversaire J-15) sur un bien DPE classé C sans indexation cette année
    When je visite "/baux/indexations"
    Then la réponse a un statut 200
    And la page contient 'aria-label="Révisions IRL à venir"'
    And la page contient l'adresse du bien dans la table IRL
    And la page contient le nom du locataire dans la table IRL
    And la page contient un lien d'action indexer IRL

  @phase7-baux-indexations-02
  Scenario: Exclusion gel DPE F — bail IRL dû sur bien classé F absent de la table + explication pédagogique
    Given un bail actif IRL dû sur un bien DPE classé F sans indexation cette année
    When je visite "/baux/indexations"
    Then la réponse a un statut 200
    And la page ne contient pas 'aria-label="Révisions IRL à venir"'
    And la page contient "décret n° 2022-1313"

  @phase7-baux-indexations-03
  Scenario: Exclusion exercice courant — bail IRL dû déjà indexé cette année absent de la table
    Given un bail actif IRL dû mais déjà indexé sur l'exercice courant
    When je visite "/baux/indexations"
    Then la réponse a un statut 200
    And la page ne contient pas 'aria-label="Révisions IRL à venir"'

  @phase7-baux-indexations-04
  Scenario: Empty state — aucun bail dont la révision IRL est due dans la fenêtre J-30
    Given aucun bail dont la révision IRL est due dans la fenêtre J-30
    When je visite "/baux/indexations"
    Then la réponse a un statut 200
    And la page contient "Aucune révision IRL en attente"
    And la page contient "/baux"
    And la page ne contient pas "<table"
