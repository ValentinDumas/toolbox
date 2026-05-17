# Feature LOC-06 — Checklist mobilier obligatoire décret 2015-981
# Décret n° 2015-981 du 31/07/2015 — liste exhaustive des 12 items obligatoires

@loc-06 @phase3
Feature: Checklist mobilier obligatoire (LOC-06)

  Background:
    Given l'application est prête pour LOC-06 avec clock fixe "2026-05-16"

  @loc-06
  Scenario: T51 — Mobilier complet à la création Bail → 0 warning
    Given un Bien et un Locataire existent en base
    When le bailleur crée un Bail avec les 12 checkboxes mobilier cochées
    Then la base contient un bail avec 12 items mobilier présents
    And aucun warning de requalification n'est affiché

  @loc-06
  Scenario: T52 — Mobilier incomplet à la création Bail → warning non bloquant
    Given un Bien et un Locataire existent en base
    When le bailleur crée un Bail avec 11 checkboxes mobilier cochées (literie décochée)
    Then la base contient un bail créé avec literie absente
    And un warning de requalification est affiché mentionnant "1 élément(s) obligatoire(s)"

  @loc-06
  Scenario: T53 — Édition Bail — mise à jour du mobilier
    Given un Bail Phase 3 activé avec date_debut=2025-06-01 et duree_mois=12
    When le bailleur édite le bail avec 10 items cochés sur 12
    Then la base contient un bail avec 12 items mobilier dont 10 présents et 2 absents
    And un warning de requalification est affiché mentionnant "2 élément(s) obligatoire(s)"
