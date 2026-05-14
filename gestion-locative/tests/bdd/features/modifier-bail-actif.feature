@D-73 @phase2
Feature: Modification d'un Bail actif (D-73)

  @D-73
  Scenario: Modification d'un Bail actif — régénération des échéances futures non payées
    Given un bail activé avec une échéance en attente de 700 euros
    When le bailleur navigue vers GET /baux/:bailId/modifier-actif
    Then la page affiche "Modifier le bail actif"
    And la page affiche "échéances futures non payées"
    When le bailleur confirme la modification avec loyer 750 euros via POST /baux/:bailId/modifier-actif
    Then la bannière indique la modification réussie
    And le bail a bien le nouveau loyer en base
