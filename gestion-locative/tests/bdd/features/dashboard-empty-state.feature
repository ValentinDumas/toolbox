# Feature — État vide (zen) du dashboard (Phase 7 / DAS-01 / D-DASH-01)
# Couverture : bandeau succès global, 4 sections non rendues
# Tags : @phase7 @phase7-dashboard

@phase7 @phase7-dashboard
Feature: Dashboard — état vide

  Background:
    Given le wizard est complété avec un bien et un bail actif

  @phase7-dashboard-empty-01
  Scenario: Bandeau "Vous êtes à jour" affiché quand toutes les sections sont vides
    Given aucun impayé, alerte ni échéance à venir n'existe
    When je visite "/"
    Then la réponse a un statut 200
    And la page contient "Vous êtes à jour"
    And la page ne contient pas "titre-alertes-critiques"
    And la page ne contient pas "titre-impayes"
    And la page ne contient pas "titre-actions-jour"
    And la page ne contient pas "titre-echeances-venir"
