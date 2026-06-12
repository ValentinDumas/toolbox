# Feature — Agrégation multi-source des alertes (Phase 7 / DAS-02 / D-AL-01 / D-AL-02 / D-AL-04)
#
# Couverture :
#   DAS-02 — use case calculerToutesAlertes fusionne les 4 sources (CFE, IRL, diagnostic, fin_bail).
#   D-AL-01 — read-model Alerte unifié, tri ASC par joursRestants GLOBALEMENT.
#   D-AL-02 — agrégateur en couche application, aucune persistance.
#   D-AL-04 — calcul à la demande, Clock-driven.
#   D-SRC-03 IRL — filtre exercice courant pré-calculé par le use case (Map<BailId, boolean>).
#
# Tags : @phase7 @phase7-alerte-agregation

@phase7 @phase7-alerte-agregation
Feature: Agrégation multi-source des alertes dashboard

  @phase7-alerte-agregation-01
  Scenario: Fusion multi-source — 1 alerte par type retournée
    Given des données produisant 1 alerte CFE, 1 alerte IRL, 1 alerte diagnostic et 1 alerte fin de bail
    When je calcule toutes les alertes
    Then 4 alertes sont retournées
    And les 4 types d'alerte sont présents (cfe, irl, diagnostic, fin_bail)

  @phase7-alerte-agregation-02
  Scenario: Tri ASC global — alerte la plus urgente en premier toutes sources confondues
    Given des alertes de sources différentes avec joursRestants 5, 10, 20 et 30
    When je calcule toutes les alertes
    Then les alertes sont triées par joursRestants croissant
    And la première alerte a joursRestants égal à 5
    And la dernière alerte a joursRestants égal à 30

  @phase7-alerte-agregation-03
  Scenario: Exclusion exercice courant — bail déjà indexé cette année exclut l'alerte IRL
    Given un bail dont une indexation a été enregistrée en 2026
    When je calcule toutes les alertes
    Then aucune alerte IRL n'est retournée pour ce bail

  @phase7-alerte-agregation-04
  Scenario: Aucune donnée — liste vide retournée
    Given aucun bien, bail ou déclaration CFE
    When je calcule toutes les alertes
    Then aucune alerte n'est retournée
