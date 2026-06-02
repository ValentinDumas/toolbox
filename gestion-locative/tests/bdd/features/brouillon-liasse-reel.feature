# Feature — Brouillon liasse fiscale régime réel (Phase 6 / FIS-05 / Plan 06-01 Task 2)
#
# Le use case `genererBrouillonLiasse` produit, depuis un snapshot
# `DeclarationAnnuelle.regimeApplique='reel'` cloture en Phase 5 :
# un `BrouillonLiasseDto` couvrant 2031-SD + 2033-A/B/C/D, avec les valeurs
# du snapshot uniquement (D-T6.4) et le bandeau "postes manuels" sur 2033-A
# (D-A6.2).
#
# Scope Wave 1 :
#  - 4 scenarios Task 2 (recettes / dotation bénéfice / déficit / postes manuels)
#  - Plans 03/05 ajouteront les 4 autres (traçabilité, réconciliation,
#    rectificative, export PDF/CSV).
#
# Tags : @phase6 @fis-05 @phase6-liasse-reel

@phase6 @fis-05 @phase6-liasse-reel
Feature: Brouillon liasse fiscale régime réel (FIS-05 / D-A6.1 / D-A6.3)

  @phase6-liasse-reel-01
  Scenario: Une recette nette se reporte sur la case "FC" de la 2033-B
    Given une DeclarationAnnuelle clôturée en régime réel avec recettes 12000 €
    When on génère le brouillon liasse pour cette déclaration
    Then le brouillon contient une section "2033-B — Compte de résultat"
    And une case "FC" porte la valeur "12 000,00 €"

  @phase6-liasse-reel-02
  Scenario: Bénéfice fiscal — la case dotation reflète exactement le snapshot
    Given une DeclarationAnnuelle clôturée en régime réel avec dotation amortissement 3500 € et bénéfice
    When on génère le brouillon
    Then la case dotation amortissement vaut "3 500,00 €"
    And la case 2031-SD bénéfice fiscal est non vide
    And la case 2031-SD déficit fiscal est vide

  @phase6-liasse-reel-03
  Scenario: Déficit fiscal — la case déficit porte la valeur absolue, bénéfice vide
    Given une DeclarationAnnuelle réel avec déficit fiscal
    When on génère le brouillon
    Then la case 2031-SD bénéfice fiscal est vide
    And la case 2031-SD déficit fiscal porte la valeur absolue du déficit

  @phase6-liasse-reel-04
  Scenario: 2033-A — bandeau "postes manuels" + mention sur les cases non calculables
    Given une DeclarationAnnuelle réel
    When on génère le brouillon
    Then la section "2033-A — Bilan simplifié" affiche un bandeau "postes à compléter manuellement"
    And certaines cases "2033-A" portent la mention "à compléter manuellement"
