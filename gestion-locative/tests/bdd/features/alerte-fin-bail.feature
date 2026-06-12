# Feature — Alertes fin de bail (Phase 7 / DAS-02 / D-SRC-05 / D-FB-01..03)
#
# Couverture :
#   D-SRC-03 — filtre bail actif (actifDepuis !== null).
#   D-SRC-05 / D-FB-03 — fenêtre 30j avant à 60j après la fin.
#   D-FB-01 / D-FB-04 — aucune mutation du Bail.
#
# Tags : @phase7 @phase7-alerte-fin-bail

@phase7 @phase7-alerte-fin-bail
Feature: Alertes fin de bail

  Background:
    Given un bail actif dont la fin est calculée à partir de dateDebut + dureeMois

  @phase7-alerte-fin-bail-01
  Scenario: Alerte fin de bail active — bail dont la fin est dans 30 jours
    Given la fin du bail est dans 30 jours
    When je calcule les alertes fin de bail
    Then 1 alerte fin de bail est retournée
    And l'alerte fin de bail a joursRestants égal à 30

  @phase7-alerte-fin-bail-02
  Scenario: Pas d'alerte — bail non activé (actifDepuis null)
    Given un bail non activé dont la fin serait dans 15 jours
    When je calcule les alertes fin de bail avec le bail non activé
    Then 0 alertes fin de bail sont retournées

  @phase7-alerte-fin-bail-03
  Scenario: Limite fenêtre — fin J+60 incluse (D-SRC-05)
    Given la fin du bail était il y a 60 jours
    When je calcule les alertes fin de bail
    Then 1 alerte fin de bail est retournée

  @phase7-alerte-fin-bail-04
  Scenario: Limite fenêtre — fin J+61 exclue (D-SRC-05)
    Given la fin du bail était il y a 61 jours
    When je calcule les alertes fin de bail
    Then 0 alertes fin de bail sont retournées
