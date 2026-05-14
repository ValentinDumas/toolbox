@bailleur @phase2
Feature: Profil bailleur

  Scenario: Premier renseignement du profil bailleur
    Given l'application est prête pour la phase 2
    When le bailleur visite GET /bailleur
    Then le formulaire profil bailleur est vide
    When le bailleur soumet le formulaire profil avec nomComplet "Jean Dupont", rue "12 rue de la Paix", codePostal "75002", ville "Paris"
    Then il est redirigé vers "/bailleur"
    And la page affiche "Profil bailleur enregistré"
    When le bailleur visite GET /bailleur
    Then le formulaire est pré-rempli avec "Jean Dupont"

  Scenario: Mise à jour du profil bailleur existant
    Given l'application est prête pour la phase 2
    And un profil bailleur existe avec nomComplet "Jean Dupont"
    When le bailleur soumet le formulaire profil avec nomComplet "Marie Martin", rue "5 avenue de l'Opéra", codePostal "75001", ville "Paris"
    Then il est redirigé vers "/bailleur"
    And la table SQLite bailleur contient exactement 1 ligne

  Scenario: Protection singleton — un 2e bailleur direct en DB est rejeté
    Given l'application est prête pour la phase 2
    And un profil bailleur existe avec nomComplet "Jean Dupont"
    When on tente d'insérer un 2e bailleur directement en base
    Then l'insertion est rejetée avec une erreur UNIQUE constraint
