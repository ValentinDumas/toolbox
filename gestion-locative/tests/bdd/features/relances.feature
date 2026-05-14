@enc-05 @phase2
Feature: Relances escaladées — ENC-05

  @enc-05
  Scenario: Niveau 1 disponible à J+10
    Given un bail activé avec un locataire et une échéance impayée depuis 15 jours (clock 2026-05-20)
    When le bailleur navigue vers GET /impayes
    Then la page impayés affiche le bouton "Lancer la relance amiable"
    When le bailleur soumet POST /relances avec niveau 1
    Then la relance niveau 1 est enregistrée en base
    And la réponse indique un succès ou affiche un mailto

  @enc-05
  Scenario: Niveau 2 attend niveau 1
    Given un bail activé avec relance niveau 1 envoyée et échéance toujours impayée à J+30
    When le bailleur navigue vers GET /impayes
    Then la page impayés affiche le bouton "Lancer la relance ferme"

  @enc-05
  Scenario: Chaînage strict - impossible de sauter au niveau 3
    Given un bail activé avec une échéance impayée depuis 71 jours sans aucune relance (clock 2026-07-15)
    When le bailleur navigue vers GET /impayes
    Then la page impayés affiche le bouton "Lancer la relance amiable"
    And la page impayés n'affiche pas le bouton niveau 3

  @enc-05 @D-69
  Scenario: Mise en demeure PDF
    Given un bail activé avec relances 1 et 2 envoyées et échéance impayée à J+60
    When le bailleur soumet POST /relances avec niveau 3
    Then la réponse est un PDF avec Content-Type application/pdf
    And le PDF contient "MISE EN DEMEURE"

  @enc-05
  Scenario: Page Relances vide — empty state
    Given un bail activé sans aucune relance envoyée
    When le bailleur navigue vers GET /relances
    Then la page relances affiche "Aucune relance envoyée"

  @enc-05
  Scenario: Suggestion désactivée après envoi
    Given un bail activé avec relance niveau 1 envoyée à J+10 (clock encore J+10)
    When le bailleur navigue vers GET /impayes
    Then la page impayés n'affiche pas le bouton relance niveau 1

  @enc-05 @D-69
  Scenario: Téléchargement PDF depuis fiche relance
    Given une Relance niveau 3 enregistrée pour une échéance impayée
    When le bailleur navigue vers GET /relances/:id/pdf
    Then la réponse est un PDF avec Content-Type application/pdf
    And le PDF contient "MISE EN DEMEURE"
    And aucune nouvelle relance n'est créée en base
