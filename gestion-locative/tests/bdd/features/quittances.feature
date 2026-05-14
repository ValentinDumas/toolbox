@enc-01 @phase2
Feature: Quittancement ENC-01 — Émission et gestion des quittances de loyer

  @enc-01
  Scenario: Émission quittance période entièrement payée
    Given un bail activé avec une échéance payée exactement (700 euros)
    When le bailleur génère la quittance via POST /quittances
    Then il est redirigé vers la fiche de la quittance
    And la page affiche "Quittance n° 2026-001 générée avec succès"
    And la base contient 1 quittance avec numéro "2026-001"
    And le fichier PDF de la quittance existe sur disque

  @enc-01
  Scenario: Génération refusée si période non entièrement payée
    Given un bail activé avec une échéance partiellement payée (300 euros sur 700)
    When le bailleur tente de générer la quittance via POST /quittances
    Then la réponse est un statut 400 ou une redirection avec erreur
    And la page affiche "Cette période n'est pas entièrement réglée"
    And aucune quittance n'est créée en base

  @enc-01
  Scenario: Bailleur absent redirige vers profil
    Given un bail activé avec une échéance payée (aucun profil bailleur configuré)
    When le bailleur génère la quittance via POST /quittances
    Then il est redirigé vers la page bailleur
    And aucune quittance n'est créée en base

  @enc-01
  Scenario: Numérotation séquentielle dans la même année
    Given un bail activé avec deux échéances payées en 2026
    When le bailleur génère la quittance pour la première échéance
    And le bailleur génère la quittance pour la deuxième échéance
    Then les numéros respectifs sont "2026-001" et "2026-002"

  @enc-01
  Scenario: Quittance invalidée après annulation Encaissement (D-65)
    Given un bail activé avec une échéance payée et une quittance émise
    When le bailleur annule l'encaissement lié à cette échéance
    Then le statut de l'échéance redevient "en_attente"
    And GET /quittances/:id affiche le warning quittance invalide

  @enc-01
  Scenario: Téléchargement PDF quittance
    Given un bail activé avec une quittance générée
    When le bailleur demande GET /quittances/:id/pdf
    Then la réponse est Content-Type application/pdf
    And le corps commence par le magic bytes PDF
