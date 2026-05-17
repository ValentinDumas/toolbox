# Feature LOC-03 — État des lieux contradictoire avec inventaire mobilier
# Loi 89 art. 3-2 + Décret 2015-981

@loc-03 @phase3
Feature: État des lieux (EDL)

  Background:
    Given l'application est prête pour LOC-03 avec clock fixe "2026-05-16"

  @loc-03
  Scenario: T46 — EDL entrée + sortie sans warning delta (inventaires identiques)
    Given un Bail Phase 3 activé avec date_debut=2025-06-01 et duree_mois=12
    When le bailleur enregistre un EDL d'entrée avec 12 items bons et contradictoire=true
    And le bailleur enregistre un EDL de sortie avec 12 items bons et contradictoire=false
    Then la table etat_des_lieux contient 2 lignes pour ce bail
    And la page GET /baux/:id/edl/sortie n'affiche aucun warning delta

  @loc-03
  Scenario: T47 — Invariant ≤1 EDL d'entrée par bail
    Given un Bail Phase 3 activé avec date_debut=2025-06-01 et duree_mois=12
    And un EDL d'entrée est déjà enregistré pour ce bail
    When le bailleur tente d'enregistrer un second EDL d'entrée
    Then la réponse indique qu'un EDL d'entrée existe déjà
    And la table etat_des_lieux ne contient qu'un seul EDL d'entrée actif pour ce bail

  @loc-03
  Scenario: T48 — EDL de sortie sans EDL d'entrée → warning non bloquant
    Given un Bail Phase 3 activé avec date_debut=2025-06-01 et duree_mois=12
    When le bailleur enregistre un EDL de sortie sans EDL d'entrée préalable
    Then la page /baux/:id/edl/sortie affiche un warning sur l'absence d'EDL d'entrée
    And la table etat_des_lieux contient 1 ligne pour ce bail

  @loc-03
  Scenario: T49 — Delta inventaire — items disparu + dégradé
    Given un Bail Phase 3 activé avec date_debut=2025-06-01 et duree_mois=12
    And un EDL d'entrée avec 12 items bons est enregistré
    When le bailleur enregistre un EDL de sortie avec literie absente et plaques_cuisson dégradées
    Then la page GET /baux/:id/edl/sortie contient un warning pour literie disparue
    And la page GET /baux/:id/edl/sortie contient un warning pour plaques_cuisson dégradées

  @loc-03
  Scenario: T50 — Soft-delete EDL d'entrée + ré-enregistrement
    Given un Bail Phase 3 activé avec date_debut=2025-06-01 et duree_mois=12
    And un EDL d'entrée est déjà enregistré pour ce bail
    When le bailleur annule l'EDL d'entrée avec raison "Erreur de date"
    And le bailleur enregistre un nouvel EDL d'entrée
    Then la table etat_des_lieux contient 2 lignes pour ce bail dont 1 annulé
    And trouverActifParBailEtType retourne le nouveau EDL
