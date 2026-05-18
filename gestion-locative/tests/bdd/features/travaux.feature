@phase4 @inc-01
Feature: Tickets travaux (INC-01)

  Background:
    Given l'application Phase 4 est prête avec clock fixe "2026-05-18"
    And un Bien Phase 4 existe à l'adresse "1 rue des Travaux, 75001 Paris"

  @phase4 @inc-01
  Scenario: T1 — Créer un ticket de travaux (happy path)
    When le bailleur soumet POST /biens/:id/travaux avec titre "Remplacement chauffe-eau" description "Fuite à réparer" dateOuverture "2026-05-18" coutEstimeTtcEuros "1200"
    Then la réponse a le statut 302
    And la redirection cible /travaux/:id
    And la session porte la bannière "Ticket créé."
    And la table tickets_travaux contient 1 ligne avec statut "ouvert"
    And la table tickets_travaux contient 1 ligne avec cout_estime_ttc_centimes 120000

  @phase4 @inc-01
  Scenario: T2 — Refus création si titre vide
    When le bailleur soumet POST /biens/:id/travaux avec titre "" description "Description valide" dateOuverture "2026-05-18"
    Then la réponse a le statut 400
    And la page affiche "Le titre du ticket est obligatoire."
    And la table tickets_travaux contient 0 ligne

  @phase4 @inc-01
  Scenario: T3 — Refus création si description vide
    When le bailleur soumet POST /biens/:id/travaux avec titre "Titre valide" description "" dateOuverture "2026-05-18"
    Then la réponse a le statut 400
    And la page affiche "La description est obligatoire."
    And la table tickets_travaux contient 0 ligne

  @phase4 @inc-01
  Scenario: T4 — Refus création si dateOuverture future
    When le bailleur soumet POST /biens/:id/travaux avec titre "Titre" description "Description" dateOuverture "2026-12-31"
    Then la réponse a le statut 400
    And la page affiche "La date d'ouverture ne peut pas être dans le futur."
    And la table tickets_travaux contient 0 ligne

  @phase4 @inc-01
  Scenario: T5 — Refus création si bienId inexistant
    When le bailleur soumet POST /biens/uuid-inconnu/travaux avec titre "T" description "D" dateOuverture "2026-05-18"
    Then la réponse a le statut 404
    And la page affiche "Bien introuvable."

  @phase4 @inc-01
  Scenario: T6 — Ajouter une pièce jointe via upload nouveau Justificatif
    Given un ticket de travaux existe rattaché au Bien
    When le bailleur soumet POST /travaux/:id/justificatifs avec multipart PDF "Devis chauffe-eau"
    Then la réponse a le statut 302
    And la session porte la bannière "Pièce jointe ajoutée au ticket."
    And la table ticket_justificatifs contient 1 ligne pour le ticket
    And la table justificatifs contient 1 ligne rattachée au Bien du ticket

  @phase4 @inc-01
  Scenario: T7 — Ajouter une pièce jointe via attach Justificatif existant
    Given un ticket de travaux existe rattaché au Bien
    And un justificatif existe rattaché au Bien
    When le bailleur soumet POST /travaux/:id/justificatifs avec query justificatifId
    Then la réponse a le statut 302
    And la session porte la bannière "Pièce jointe ajoutée au ticket."
    And la table ticket_justificatifs contient 1 ligne pour le ticket

  @phase4 @inc-01
  Scenario: T8 — Refus attach PJ si Justificatif rattaché à autre Bien
    Given un ticket de travaux existe rattaché au Bien
    And un justificatif existe rattaché à un autre Bien
    When le bailleur soumet POST /travaux/:id/justificatifs avec query justificatifId
    Then la session porte la bannière "Pièce jointe doit être rattachée au même bien que le ticket."
    And la table ticket_justificatifs contient 0 ligne pour le ticket

  @phase4 @inc-01
  Scenario: T9 — Délier une pièce jointe
    Given un ticket de travaux existe rattaché au Bien
    And un justificatif existe rattaché au Bien et lié au ticket
    When le bailleur soumet POST /travaux/:id/justificatifs/:jid/delier
    Then la réponse a le statut 302
    And la session porte la bannière "Pièce jointe retirée du ticket."
    And la table ticket_justificatifs contient 0 ligne pour le ticket
    And la table justificatifs contient toujours 1 ligne

  @phase4 @inc-01
  Scenario: T10 — Clôture happy path
    Given un ticket de travaux existe rattaché au Bien
    When le bailleur soumet POST /travaux/:id/clore avec dateCloture "2026-06-01" coutReelTtcEuros "1250"
    Then la réponse a le statut 302
    And la session porte la bannière "Ticket clôturé."
    And la table tickets_travaux contient 1 ligne avec statut "clos"
    And la table tickets_travaux contient 1 ligne avec cout_reel_ttc_centimes 125000

  @phase4 @inc-01
  Scenario: T11 — Refus clôture sans coût réel
    Given un ticket de travaux existe rattaché au Bien
    When le bailleur soumet POST /travaux/:id/clore avec dateCloture "2026-06-01" sans coutReel
    Then la réponse a le statut 400
    And la page affiche "Le coût réel TTC est obligatoire pour clore le ticket."
    And la table tickets_travaux contient 1 ligne avec statut "ouvert"

  @phase4 @inc-01
  Scenario: T12 — Annuler un ticket
    Given un ticket de travaux existe rattaché au Bien
    When le bailleur soumet POST /travaux/:id/annuler avec raison "Plus pertinent"
    Then la réponse a le statut 302
    And la session porte la bannière "Ticket annulé."
    And la table tickets_travaux contient 1 ligne avec statut "annule"
    And la table tickets_travaux contient 1 ligne avec raison_annulation "Plus pertinent"

  @phase4 @inc-01
  Scenario: T13 — Cascade asymétrique D-113
    Given un ticket de travaux existe rattaché au Bien avec 2 pièces jointes
    When on supprime directement le ticket en base via SQL
    Then la table ticket_justificatifs contient 0 ligne pour le ticket
    And la table justificatifs contient 2 lignes

  @phase4 @inc-01
  Scenario: T14 — Section Travaux fiche Bien (UI-5.4)
    Given le Bien possède 1 ticket ouvert, 1 ticket en_cours et 1 ticket clos
    When le bailleur navigue vers GET /biens/:bienId
    Then la page affiche "Voir tous les tickets (3)"
    And la page affiche "Nouveau ticket"

  @phase4 @inc-01
  Scenario: T15 — Empty state tickets vides (D-119 verbatim)
    When le bailleur navigue vers GET /biens/:bienId
    Then la page affiche "Aucun ticket pour ce Bien"
    And la page affiche "Le premier ticket sert souvent à tracer la mise en service du logement."
    And la page affiche "Nouveau ticket"

  @gap-04 @inc-01
  Scenario: T16 — Une PJ mise en corbeille n'apparaît plus sur la fiche du ticket (CR-03)
    Given un ticket de travaux existe rattaché au Bien
    And un justificatif "facture-chaudiere.pdf" rattaché au ticket et mis en corbeille
    When le bailleur navigue vers GET /travaux/:ticketId
    Then la fiche du ticket ne liste aucune pièce jointe
