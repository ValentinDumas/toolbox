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

  @fis-04 @gap-CR-03 @fis-ard-cross-multi-bien
  Scenario: CR-03 — Multi-bien — l'ARD est reporté à l'exercice N+1 sans doublon
    # Régression 05-VERIFICATION.md gap 2 (BLOCKER) : cloturer-exercice créait N lignes
    # SYNTHESE_BIEN portant chacune l'ardCumuleEnSortie global → dernierArdCumuleBailleur
    # multipliait l'ARD par le nombre de biens à l'exercice N+1.
    # En V1 D-LOCK-2 mono-bailleur, l'ARD est bailleur-level (pas bien-level) : une
    # seule SYNTHESE_BIEN par exercice, portée par biensIds[0] comme bien sentinelle.
    #
    # Setup : le Background ajoute déjà 1 bien (gros_oeuvre 200k acquis 2026-01-01).
    # On ajoute 2 biens supplémentaires A et B → total 3 biens actifs pour exercice 2026.
    # Pré-fix : 3 lignes SYNTHESE_BIEN seraient insérées en 2026 → ARD × 3 en 2027.
    # Post-fix : 1 seule ligne SYNTHESE_BIEN portée par biensIds[0] → ARD correct en 2027.
    And un deuxième bien immobilier avec un composant gros_oeuvre de 100 000 €
    And un troisième bien immobilier avec un composant gros_oeuvre de 100 000 €
    And l'exercice 2026 avec des recettes de 5 000 € et des charges de 0 €
    When je clôture l'exercice 2026 en régime réel
    Then la table amortissement_exercice contient exactement 1 ligne SYNTHESE_BIEN pour l'exercice 2026
    And l'ARD propagé pour l'exercice 2027 est exactement égal à l'ardCumuleEnSortie de 2026
    Given l'exercice 2027 avec des recettes de 5 000 €
    When je clôture l'exercice 2027 en régime réel
    Then la table amortissement_exercice contient exactement 1 ligne SYNTHESE_BIEN pour l'exercice 2027
