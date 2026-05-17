@pat-03 @phase3
Feature: Diagnostics techniques immobiliers (PAT-03)

  Background:
    Given l'application est prête pour PAT-03 avec clock fixe "2026-05-16"
    And un Bien Phase 3 existe à l'adresse "12 rue des Diagnostics, 75001 Paris"

  @pat-03
  Scenario: T24 — Ajout diagnostic DPE met à jour classeDpe
    When le bailleur soumet POST /biens/:id/diagnostics avec type=dpe date_emission=2025-01-15 classe_dpe=F
    Then il est redirigé vers la fiche du Bien
    And la page affiche "Diagnostic enregistré."
    And la colonne classe_dpe du Bien en base est "F"
    And la table diagnostics contient 1 ligne avec type=dpe date_emission=2025-01-15 date_expiration=2035-01-15

  @pat-03
  Scenario: T25 — Diagnostic ERP a date_expiration null
    When le bailleur soumet POST /biens/:id/diagnostics avec type=erp date_emission=2025-01-15
    Then il est redirigé vers la fiche du Bien
    And la table diagnostics contient 1 ligne avec type=erp date_expiration=NULL

  @pat-03
  Scenario: T26 — DPE sans classe rejeté avec message d'erreur
    When le bailleur soumet POST /biens/:id/diagnostics avec type=dpe date_emission=2025-01-15 sans classe_dpe
    Then la réponse a le statut 200
    And la page affiche "La classe DPE est obligatoire pour un diagnostic DPE."
    And aucun diagnostic n'est créé en base

  @pat-03
  Scenario: T27 — Diagnostic expiré affiche badge non bloquant
    Given un Bien Phase 3 avec un DPE expiré date_emission=2014-01-15 classe_dpe=D
    When le bailleur navigue vers GET /biens/:id
    Then la page affiche "Expiré le 15/01/2024"
    And la page contient un avertissement de diagnostic expiré
    And la page ne fait pas de redirection

  @pat-03
  Scenario: T28 — Historique complet préservé après remplacement DPE
    Given un Bien Phase 3 avec 2 DPE successifs date_emission=2024-01-01 classe=D et date_emission=2025-06-01 classe=C
    When le bailleur navigue vers GET /biens/:id
    Then la page contient 2 lignes de diagnostics
    And la classe DPE affichée est "C"
    And aucun diagnostic n'a été supprimé en base
