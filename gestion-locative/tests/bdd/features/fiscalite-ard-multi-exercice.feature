# Feature — Propagation ARD cross-exercice (CGI art. 39 B sans limite)
#
# L'Amortissement Réputé Différé (ARD) est reportable sans limite de durée.
# Exercice N : ARD généré si dotation théorique > résultat avant amortissement.
# Exercice N+1 : ARD N consommé prioritairement avant la dotation de l'exercice.
#
# Références : CGI art. 39 B, CONTEXT.md L249, D-FIS-G4.2 SYNTHESE_BIEN.
# Tags : @phase5 @fis-06 @fis-ard-cross

@phase5 @fis-06 @fis-ard-cross
Feature: Propagation ARD cross-exercice (CGI art. 39 B)

  Background:
    Given un bailleur avec des revenus actifs annuels de 150 000 €
    And un bien immobilier avec un composant gros_oeuvre de 200 000 €
    And une valorisation fiscale activée pour ce bien

  @fis-ard-cross-01
  Scenario: ARD reporté de N consommé prioritairement en N+1 (CGI 39 B)
    # Exercice N : recettes 50k, charges 48k → résultat avant amort = 2k
    # Dotation théorique = 5k > résultat 2k → ARD généré = 3k
    Given l'exercice 2026 avec des recettes de 50 000 € et des charges de 48 000 €
    When je clôture l'exercice 2026 en régime réel
    Then la déclaration 2026 a un ARD généré supérieur à 0 €
    And le tableau d'amortissement 2026 enregistre un SYNTHESE_BIEN avec l'ARD disponible

    # Exercice N+1 : recettes 60k → résultat avant amort élevé → ARD N consommé en priorité
    Given l'exercice 2027 avec des recettes de 60 000 €
    When je clôture l'exercice 2027 en régime réel
    Then la déclaration 2027 a un ardConsomme égal à l'ARD généré en 2026
    And la propagation cross-exercice confirme CGI art. 39 B sans limite

  @fis-ard-cross-02
  Scenario: ARD cumulé inchangé après soft-delete encaissement post-clôture N (CONTEXT.md L251)
    # Vérifie que le snapshot DeclarationAnnuelle est immuable.
    # Même après annulation d'un encaissement post-clôture,
    # l'ardGenere enregistré en N reste intact.
    Given l'exercice 2026 avec des recettes de 50 000 € et des charges de 48 000 €
    When je clôture l'exercice 2026 en régime réel
    Then la déclaration 2026 a un ARD généré supérieur à 0 €
    When un encaissement de l'exercice 2026 est annulé post-clôture
    Then la déclaration 2026 a le même ardGenere qu'avant l'annulation
    And le tableau SYNTHESE_BIEN 2026 reste inchangé
