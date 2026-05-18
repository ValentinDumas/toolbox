@phase4 @doc-01 @doc-03
Feature: Coffre documentaire (DOC-01 + DOC-03)

  Background:
    Given l'application Phase 4 est prête avec clock fixe "2026-05-18"
    And un Bien Phase 4 existe à l'adresse "1 rue du Coffre, 75001 Paris"

  @phase4 @doc-01
  Scenario: T1 — Upload PDF facture rattaché à un Bien
    When le bailleur téléverse une facture PDF "Facture EDF mai" rattachée au Bien
    Then la réponse a le statut 302
    And la redirection cible /justificatifs/:id
    And la session porte la bannière "Document ajouté."
    And la table justificatifs contient 1 ligne de type "facture" rattachée au Bien
    And un fichier physique existe sous documents/justificatifs/2026/

  @phase4 @doc-01
  Scenario: T2 — Upload rejeté sans rattachement (D-103)
    When le bailleur téléverse une facture PDF "Facture sans rattachement" sans rattachement
    Then la réponse a le statut 400
    And la page affiche "Le type de rattachement est obligatoire."
    And la table justificatifs contient 0 ligne

  @phase4 @doc-01
  Scenario: T3 — Upload rejeté MIME header ≠ magic bytes (D-118)
    When le bailleur téléverse un fichier JPEG renommé en .pdf rattaché au Bien
    Then la réponse a le statut 422
    And la page affiche "Le fichier ne correspond pas au format annoncé."
    And la table justificatifs contient 0 ligne

  @phase4 @doc-01
  Scenario: T5 — Upload HEIC converti en JPEG (D-105)
    When le bailleur téléverse une image HEIC "Photo travaux" rattachée au Bien
    Then la réponse a le statut 302
    And la table justificatifs contient 1 ligne avec mime_type=image/jpeg
    And le chemin du fichier se termine par .jpg

  @phase4 @doc-03
  Scenario: T6 — Soft-delete réversible (D-109)
    Given un justificatif existe rattaché au Bien
    When le bailleur soumet POST /justificatifs/:id/corbeille
    Then la réponse a le statut 302
    And la session porte la bannière "Document déplacé vers la corbeille."
    And la table justificatifs contient toujours 1 ligne avec corbeille_le non null

  @phase4 @doc-03
  Scenario: T7 — peutEtrePurge retourne false avant 10 ans
    Given un justificatif existe avec creeLe=2020-05-18 et today=2026-05-18
    Then peutEtrePurge retourne false

  @phase4 @doc-01
  Scenario: T8 — Empty state initial
    When le bailleur navigue vers GET /coffre
    Then la réponse a le statut 200
    And la page affiche "Aucun justificatif pour le moment"
