@D-74 @phase2
Feature: Quittancement et gestion des baux

  Scenario: Suppression d'un Bail avec activité refusée (D-74)
    Given l'application est prête avec un détecteur d'activité qui signale toujours une activité
    And un bail est enregistré en base
    When le bailleur soumet POST supprimer sur ce bail
    Then il est redirigé vers la fiche du bail
    And la page affiche "Ce bail a déjà de l'activité"
    And le bail est toujours présent en base

  Scenario: Désactivation d'un Bail actif (D-74)
    Given l'application est prête pour la phase 2
    And un bail actif existe avec actif_depuis non null
    When le bailleur soumet POST desactiver sur ce bail
    Then le bail a actif_depuis null en base
    And la page affiche "Bail désactivé"

