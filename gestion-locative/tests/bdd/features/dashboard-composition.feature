# Feature — Composition du dashboard 4 sections (Phase 7 / DAS-01 / D-DASH-02)
# Couverture : présence des 4 sections ARIA, top 5 alertes critiques, tri ASC urgence
# Tags : @phase7 @phase7-dashboard

@phase7 @phase7-dashboard
Feature: Dashboard — composition 4 sections

  Background:
    Given le wizard est complété avec un bien et un bail actif

  @phase7-dashboard-01
  Scenario: Les 4 sections sont présentes quand des données existent
    Given une alerte critique existe (joursRestants 3)
    When je visite "/"
    Then la réponse a un statut 200
    And la page contient "Alertes critiques"
    And la page contient "Impayés"
    And la page contient "Actions du jour"
    And la page contient "Échéances loyer à venir"
    And la page contient 'aria-labelledby="titre-alertes-critiques"'
    And la page contient 'aria-labelledby="titre-impayes"'
    And la page contient 'aria-labelledby="titre-actions-jour"'
    And la page contient 'aria-labelledby="titre-echeances-venir"'

  @phase7-dashboard-02
  Scenario: Top 5 affiché et lien Voir tout présent si plus de 5 alertes critiques
    Given 6 alertes critiques existent (joursRestants 1..6)
    When je visite "/"
    Then la réponse a un statut 200
    And la page contient au plus 5 bannières d'alerte
    And la page contient "Voir tout (6)"

  @phase7-dashboard-03
  Scenario: Les alertes critiques sont triées par urgence croissante
    Given des alertes critiques de joursRestants variés (5, 1, 3)
    When je visite "/"
    Then la réponse a un statut 200
    And la première bannière d'alerte rendue est la plus urgente
