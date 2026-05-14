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

  @enc-04
  Scenario: Page Impayés vide — tous les loyers sont à jour
    Given l'application est prête pour les tests ENC-04 avec clock au 2026-05-15
    And un bail activé avec 12 échéances entièrement payées par encaissements exacts
    When le bailleur navigue vers GET /impayes
    Then la page impayés affiche l'empty state "Tous les loyers sont à jour"

  @enc-04
  Scenario: Liste impayés mixte — partial + en attente
    Given l'application est prête pour les tests ENC-04 avec clock au 2026-05-15
    And un bail activé avec 12 échéances dont la première payée la deuxième partielle et les autres en attente
    When le bailleur navigue vers GET /impayes
    Then la page impayés affiche au moins 1 ligne impayée
    And la page impayés affiche le total global impayé

  @enc-04
  Scenario: Filtre locataire — seules les échéances du locataire filtré
    Given l'application est prête pour les tests ENC-04 avec clock au 2026-05-15
    And deux baux activés avec des impayés pour des locataires différents
    When le bailleur navigue vers GET /impayes avec filtre sur le premier locataire
    Then la page impayés n'affiche que les échéances du premier locataire

  @enc-04
  Scenario: Tri par ancienneté — plus ancienne échéance en premier
    Given l'application est prête pour les tests ENC-04 avec clock au 2026-05-15
    And plusieurs échéances impayées à des dates différentes
    When le bailleur navigue vers GET /impayes
    Then la page impayés affiche les échéances triées de la plus ancienne à la plus récente
