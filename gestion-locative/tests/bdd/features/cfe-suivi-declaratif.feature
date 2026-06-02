# Feature — Suivi déclaratif CFE 1447-C-SD (Phase 6 / Plan 06-06 / FIS-06)
#
# Couverture obligatoire 06-VALIDATION.md :
#   D-CFE6.1 — suivi déclaratif (pas de reproduction 1447-C-SD).
#   D-CFE6.2 — agrégat racine DeclarationCfe (référence BienId par identifiant).
#   D-CFE6.3 — 5 statuts + invariants dépôt/montant.
#   D-CFE6.4 — exonération première année (CGI art. 1478) sans calcul base imposable.
#
# Tags : @phase6 @phase6-cfe-suivi

@phase6 @phase6-cfe-suivi
Feature: Suivi déclaratif CFE 1447-C-SD

  Background:
    Given un bien immobilier enregistré pour la CFE

  @phase6-cfe-suivi-01
  Scenario: Enregistrer une déclaration CFE non déposée pour le millésime 2026
    When j'enregistre une déclaration CFE millésime 2026 statut "non_deposee" échéance "2026-12-15"
    Then la liste des déclarations CFE du bien contient 1 entrée
    And la première déclaration CFE a le statut "non_deposee"
    And la première déclaration CFE a le millésime 2026

  @phase6-cfe-suivi-02
  Scenario: Transition d'une déclaration CFE de "non_deposee" vers "deposee"
    Given une déclaration CFE millésime 2026 statut "non_deposee" échéance "2026-12-15"
    When je modifie la déclaration CFE en statut "deposee" avec date de dépôt "2026-12-10"
    Then la déclaration CFE a le statut "deposee"
    And la déclaration CFE a une date de dépôt "2026-12-10"

  @phase6-cfe-suivi-03
  Scenario: Invariant D-CFE6.3 — statut "deposee" exige dateDepotDeclaration
    Given une déclaration CFE millésime 2026 statut "non_deposee" échéance "2026-12-15"
    When je tente de modifier la déclaration CFE en statut "deposee" sans date de dépôt
    Then une erreur InvariantViolated est levée citant "dateDepotDeclaration"

  @phase6-cfe-suivi-04
  Scenario: Invariant D-CFE6.3 — statut "payee" exige date de dépôt et montant d'avis
    Given une déclaration CFE millésime 2026 statut "non_deposee" échéance "2026-12-15"
    When je tente de modifier la déclaration CFE en statut "payee" sans date de dépôt ni montant d'avis
    Then une erreur InvariantViolated est levée citant "dateDepotDeclaration"

  @phase6-cfe-suivi-05
  Scenario: Exonération première année — D-CFE6.4 (CGI art. 1478) sans calcul de base imposable
    When j'enregistre une déclaration CFE millésime 2026 statut "exoneree_premiere_annee" échéance "2026-12-15"
    Then la liste des déclarations CFE du bien contient 1 entrée
    And la première déclaration CFE a le statut "exoneree_premiere_annee"
    And la première déclaration CFE a une date de dépôt nulle
    And la première déclaration CFE a un montant d'avis nul

  @phase6-cfe-suivi-06
  Scenario: Copy-on-write — modifier la date d'échéance ne touche pas le statut, la date de dépôt ni le montant
    Given une déclaration CFE millésime 2026 statut "payee" date de dépôt "2026-12-10" montant d'avis 320 € échéance "2026-12-15"
    When je modifie la déclaration CFE échéance "2026-12-20"
    Then la déclaration CFE a le statut "payee"
    And la déclaration CFE a une date de dépôt "2026-12-10"
    And la déclaration CFE a un montant d'avis de 320 €
    And la déclaration CFE a une date d'échéance "2026-12-20"
