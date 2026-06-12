# Feature — Alertes révision IRL J-30 (Phase 7 / DAS-02 / D-SRC-03 / D-91 / D-92)
#
# Couverture obligatoire (logique juridique IRL — BDD_PRACTICES.md 100 %) :
#   D-SRC-03 — filtres bail actif + exercice courant + gel DPE F/G.
#   D-91     — dateAnniversaireProchaine source canonique IRL.
#   D-92     — gel Climat DPE F/G (filtre obligatoire).
#   D-SRC-02 — fenêtre J-30 incluse / J-31 exclue.
#
# Tags : @phase7 @phase7-alerte-irl

@phase7 @phase7-alerte-irl
Feature: Alertes révision IRL J-30/J-7

  Background:
    Given un bail actif sur un bien DPE classé C

  @phase7-alerte-irl-01
  Scenario: Alerte IRL active J-15 — bail sans indexation exercice courant
    Given la date du jour est à 15 jours avant l'anniversaire du bail
    And aucune indexation n'est enregistrée pour l'exercice courant
    When je calcule les alertes IRL
    Then 1 alerte IRL est retournée
    And l'alerte IRL a joursRestants égal à 15

  @phase7-alerte-irl-02
  Scenario: Pas d'alerte — bien classé DPE F (gel Climat D-92)
    Given la date du jour est à 15 jours avant l'anniversaire du bail
    And le bien est classé DPE F
    And aucune indexation n'est enregistrée pour l'exercice courant
    When je calcule les alertes IRL
    Then 0 alertes IRL sont retournées

  @phase7-alerte-irl-03
  Scenario: Pas d'alerte — indexation déjà enregistrée sur l'exercice courant (D-SRC-03)
    Given la date du jour est à 15 jours avant l'anniversaire du bail
    And une indexation est déjà enregistrée pour l'exercice courant
    When je calcule les alertes IRL
    Then 0 alertes IRL sont retournées

  @phase7-alerte-irl-04
  Scenario: Pas d'alerte — bail non activé (actifDepuis null)
    Given la date du jour est à 15 jours avant l'anniversaire d'un bail non activé
    And aucune indexation n'est enregistrée pour l'exercice courant
    When je calcule les alertes IRL avec le bail non activé
    Then 0 alertes IRL sont retournées

  @phase7-alerte-irl-05
  Scenario: Limite fenêtre — anniversaire J-30 inclus
    Given la date du jour est à 30 jours avant l'anniversaire du bail
    And aucune indexation n'est enregistrée pour l'exercice courant
    When je calcule les alertes IRL
    Then 1 alerte IRL est retournée
    And l'alerte IRL a joursRestants égal à 30

  @phase7-alerte-irl-06
  Scenario: Limite fenêtre — anniversaire J-31 exclu
    Given la date du jour est à 31 jours avant l'anniversaire du bail
    And aucune indexation n'est enregistrée pour l'exercice courant
    When je calcule les alertes IRL
    Then 0 alertes IRL sont retournées
