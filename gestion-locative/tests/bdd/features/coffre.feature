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

  # ─── Wave 2 : @doc-02 (recherche facettée) ──────────────────────────────────

  @phase4 @doc-02
  Scenario: T9 — Recherche LIKE sur titre
    Given 3 justificatifs existent avec titres "Facture peinture salon" "Bail signé locataire X" "Diagnostic gaz"
    When le bailleur navigue vers GET /coffre avec query "search=peinture"
    Then la réponse a le statut 200
    And la page coffre affiche 1 ligne de justificatif

  @phase4 @doc-02
  Scenario: T10 — Recherche LIKE sur notes
    Given un justificatif existe avec notes "Travaux d'urgence à programmer"
    When le bailleur navigue vers GET /coffre avec query "search=urgence"
    Then la page coffre affiche 1 ligne de justificatif

  @phase4 @doc-02
  Scenario: T11 — Recherche LIKE sur nom de fichier
    Given un justificatif existe avec nomFichierOriginal "facture-2026-04-15.pdf"
    When le bailleur navigue vers GET /coffre avec query "search=2026-04"
    Then la page coffre affiche 1 ligne de justificatif

  @phase4 @doc-02
  Scenario: T12 — Filtre facetté annee_fiscale
    Given 3 justificatifs existent avec dates "2025-12-31" "2026-01-01" "2026-12-31"
    When le bailleur navigue vers GET /coffre avec query "annee=2026"
    Then la page coffre affiche 2 lignes de justificatif

  @phase4 @doc-02
  Scenario: T13 — Pagination 20 par page sur 25 justificatifs
    Given 25 justificatifs existent rattachés au Bien
    When le bailleur navigue vers GET /coffre avec query "page=1"
    Then la page coffre affiche 20 lignes de justificatif
    And la page affiche "25 documents"

  @phase4 @doc-02
  Scenario: T14 — Empty state filtré
    Given un justificatif existe rattaché au Bien
    When le bailleur navigue vers GET /coffre avec query "type=ticket_caisse"
    Then la page affiche "Aucun document ne correspond à ces filtres"
    And la page affiche "Effacer les filtres"

  @phase4 @doc-02
  Scenario: T15 — Section Documents sur fiche Bien (UI-5.4)
    Given 7 justificatifs existent rattachés au Bien
    When le bailleur navigue vers la fiche du Bien
    Then la page affiche "Voir tous les documents de ce Bien (7)"

  @phase4 @doc-02
  Scenario: T16 — Section Documents fiche Locataire filtrée par type D-120
    Given un Locataire existe
    And 5 justificatifs existent rattachés au Locataire avec types "facture" "piece_locataire" "releve_bancaire" "attestation" "autre"
    When le bailleur navigue vers la fiche du Locataire
    Then la page affiche "piece_locataire"
    And la page n'affiche pas "facture"

  # ─── Wave 2 : @doc-03 extras (corbeille + purge UX) ─────────────────────────

  @phase4 @doc-03
  Scenario: T17 — Affichage corbeille avec date de purge possible
    Given un justificatif existe rattaché au Bien et soft-deleted
    When le bailleur navigue vers GET /coffre/corbeille
    Then la réponse a le statut 200
    And la page affiche "18/05/2036"

  @phase4 @doc-03
  Scenario: T18 — Purge bloquée avant 10 ans (D-109 verbatim UI-6.2)
    Given un justificatif existe rattaché au Bien et soft-deleted avec creeLe "2026-05-18"
    When le bailleur soumet POST /justificatifs/:id/purger
    Then la session porte la bannière "Conservation légale obligatoire jusqu'au 18/05/2036. Vous pourrez purger ce document à partir de cette date."
    And la table justificatifs contient toujours 1 ligne avec corbeille_le non null

  @phase4 @doc-03
  Scenario: T19 — Purge autorisée à 10 ans pile (D-109)
    Given l'application Phase 4 est prête avec clock fixe "2036-05-18"
    And un Bien Phase 4 existe à l'adresse "1 rue du Coffre, 75001 Paris"
    And un justificatif existe rattaché au Bien et soft-deleted avec creeLe "2026-05-18"
    When le bailleur soumet POST /justificatifs/:id/purger
    Then la réponse a le statut 302
    And la session porte la bannière "Document supprimé définitivement."
    And la table justificatifs contient 0 ligne

  @phase4 @doc-03
  Scenario: T20 — Restauration depuis la corbeille
    Given un justificatif existe rattaché au Bien et soft-deleted
    When le bailleur soumet POST /justificatifs/:id/restaurer
    Then la réponse a le statut 302
    And la session porte la bannière "Document restauré."
    And le justificatif a corbeille_le NULL en base

  @phase4 @doc-03
  Scenario: T21 — Modifier metadata sans toucher au fichier (UI-4.4)
    Given un justificatif existe rattaché au Bien
    When le bailleur soumet POST /justificatifs/:id/modifier avec titre="Nouveau titre" et notes="Nouvelles notes"
    Then la réponse a le statut 302
    And la session porte la bannière "Document mis à jour."
    And le justificatif a titre "Nouveau titre" et notes "Nouvelles notes" en base
    And le justificatif a chemin_fichier mime_type taille_octets nom_fichier_original cree_le inchangés en base

  @phase4 @doc-03
  Scenario: T22 — Bouton purger disabled avec aria-disabled avant 10 ans
    Given un justificatif existe rattaché au Bien et soft-deleted avec creeLe "2026-05-18"
    When le bailleur navigue vers GET /coffre/corbeille
    Then la page affiche "aria-disabled=\"true\""
    And la page affiche "title=\"Disponible le 18/05/2036\""
