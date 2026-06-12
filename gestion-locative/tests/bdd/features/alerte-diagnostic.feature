# Feature — Alertes diagnostics techniques immobiliers (Phase 7 / DAS-02 / D-AL-02)
#
# Couverture juridique obligatoire :
#   D-77 / D-SRC-03 — ERP (validité illimitée, dateExpiration null) ne produit jamais d'alerte.
#   D-SRC-04 — granularité 1 alerte par diagnostic actif par type (DPE / gaz / élec).
#   D-79 — seul le diagnostic actif (le plus récent par dateEmission) est considéré.
#   D-80 — un diagnostic déjà expiré (jusqu'à J-30) reste visible (miroir).
#   Fenêtre [-30, +30] — hors fenêtre = pas d'alerte.
#
# Tags : @phase7 @phase7-alerte-diagnostic

@phase7 @phase7-alerte-diagnostic
Feature: Alertes diagnostics techniques immobiliers

  Background:
    Given un Bien avec un seul diagnostic

  @phase7-alerte-diagnostic-01
  Scenario: ERP exclu — validité illimitée D-77
    Given un Bien avec un diagnostic ERP
    When je calcule les alertes diagnostic
    Then aucune alerte diagnostic n'est retournée

  @phase7-alerte-diagnostic-02
  Scenario: DPE dans la fenêtre J-15 — alerte avec joursRestants = 15
    Given un Bien avec un DPE expirant dans 15 jours
    When je calcule les alertes diagnostic
    Then 1 alerte diagnostic est retournée
    And l'alerte diagnostic a le type "dpe"
    And l'alerte diagnostic a joursRestants égal à 15

  @phase7-alerte-diagnostic-03
  Scenario: Granularité D-SRC-04 — Bien avec DPE, gaz et élec dans la fenêtre
    Given un Bien avec DPE, gaz et élec actifs expirant dans la fenêtre
    When je calcule les alertes diagnostic
    Then 3 alertes diagnostic sont retournées

  @phase7-alerte-diagnostic-04
  Scenario: Déjà expiré reste visible D-80 — gaz expiré depuis 10 jours
    Given un Bien avec un gaz expiré depuis 10 jours
    When je calcule les alertes diagnostic
    Then 1 alerte diagnostic est retournée
    And l'alerte diagnostic a le type "gaz"
    And l'alerte diagnostic a joursRestants égal à -10

  @phase7-alerte-diagnostic-05
  Scenario: Hors fenêtre haute — élec expirant dans 45 jours
    Given un Bien avec un élec expirant dans 45 jours
    When je calcule les alertes diagnostic
    Then aucune alerte diagnostic n'est retournée
