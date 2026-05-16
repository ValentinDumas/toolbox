@phase2
Feature: Gaps G6 et G7 — Vue globale /echeances et CTA /quittances

  @gap-G6 @phase2
  Scenario: GET /echeances liste toutes les échéances tous baux confondus (sans filtre)
    Given un bail activé "B1" avec 3 échéances en_attente
    And un bail activé "B2" avec 2 échéances payee
    When le bailleur navigue vers GET /echeances
    Then la page affiche 5 lignes d'échéances
    And la page affiche un select "Bail" avec 2 options de baux
    And la page affiche un select "Statut" avec 4 options de statuts

  @gap-G6 @phase2
  Scenario: GET /echeances?statut=payee filtre par statut
    Given un bail activé "B1" avec 3 échéances en_attente
    And un bail activé "B2" avec 2 échéances payee
    When le bailleur navigue vers GET /echeances?statut=payee
    Then la page affiche 2 lignes d'échéances

  @gap-G6 @phase2
  Scenario: GET /echeances?bail=B1 filtre par bail
    Given un bail activé "B1" avec 3 échéances en_attente
    And un bail activé "B2" avec 2 échéances payee
    When le bailleur navigue vers GET /echeances?bail=B1
    Then la page affiche 3 lignes d'échéances

  @gap-G6 @phase2
  Scenario: GET /echeances filtres combinés bail+statut
    Given un bail activé "B1" avec 3 échéances en_attente
    And un bail activé "B2" avec 2 échéances payee
    When le bailleur navigue vers GET /echeances?bail=B1&statut=en_attente
    Then la page affiche 3 lignes d'échéances

  @gap-G7 @phase2
  Scenario: Page /quittances expose un CTA "Émettre une quittance" quand la liste est vide
    Given aucune quittance émise en base
    When le bailleur navigue vers GET /quittances
    Then la page contient un lien "Émettre une quittance"
    And ce lien pointe vers "/echeances?statut=payee"

  @gap-G7 @phase2
  Scenario: Page /quittances expose un CTA "Émettre une quittance" quand la liste contient des quittances
    Given une quittance émise en base
    When le bailleur navigue vers GET /quittances
    Then la page contient un lien "Émettre une quittance"
    And ce lien pointe vers "/echeances?statut=payee"
