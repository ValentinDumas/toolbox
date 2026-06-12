# Feature — Redirection premier lancement (Phase 7 / DAS-01 / D-DASH-01)
# Couverture : KPI Activation Phase 1 préservé — GET / redirige vers /wizard/bien au premier lancement
# Tags : @phase7 @phase7-dashboard

@phase7 @phase7-dashboard
Feature: Dashboard — premier lancement

  @phase7-dashboard-premier-01
  Scenario: Redirection vers /wizard/bien au premier lancement
    Given l'application est dans un état de premier lancement (aucun bien)
    When je visite "/"
    Then la réponse est une redirection 302 vers "/wizard/bien"
