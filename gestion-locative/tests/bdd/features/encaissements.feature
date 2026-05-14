@enc-03 @phase2
Feature: Encaissements ENC-03

  @enc-03 @M1
  Scenario: Empty state encaissement quand toutes echéances sont payées
    Given un bail activé avec 12 échéances toutes payées par encaissements
    When le bailleur navigue vers GET /encaissements/nouveau
    Then la page affiche "Aucune échéance en attente"

  @enc-03
  Scenario: Paiement partiel ne quittance pas
    Given un bail activé avec une échéance en attente de 700 euros
    When le bailleur saisit un encaissement de 300 euros sur cette échéance
    Then le statut de l'échéance est "partiellement_payee"
    And la page échéances n'affiche pas le bouton "Générer quittance" pour cette échéance

  @enc-03
  Scenario: Paiement exact donne statut payee
    Given un bail activé avec une échéance en attente de 700 euros
    When le bailleur saisit un encaissement de 700 euros sur cette échéance
    Then le statut de l'échéance est "payee"
    And la page échéances affiche le bouton "Générer quittance" pour cette échéance

  @enc-03
  Scenario: Sur-paiement affiche warning trop-perçu
    Given un bail activé avec une échéance en attente de 700 euros
    When le bailleur saisit un encaissement de 800 euros sur cette échéance
    Then la page affiche "Trop-perçu"
    And le statut de l'échéance est "payee"

  @enc-03
  Scenario: Annulation soft-delete recalcule le statut
    Given un bail activé avec une échéance en attente de 700 euros
    And le bailleur saisit un encaissement de 400 euros sur cette échéance
    And le bailleur saisit un encaissement de 300 euros sur cette échéance
    When le bailleur annule le premier encaissement avec raison "Erreur saisie"
    Then l'encaissement annulé a un annule_le non null en base
    And le statut de l'échéance est "partiellement_payee"
