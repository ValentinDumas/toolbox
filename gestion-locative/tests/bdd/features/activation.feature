# language: fr
Feature: Activation

  Scenario: Création Bien minimal au premier lancement
    Given l'application est lancée pour la première fois
    When le bailleur soumet le formulaire Bien avec l'adresse "12 rue des Lilas", code postal "75020", ville "Paris", surface 45, type "appartement", année 1985, lot désignation "Appartement principal", type lot "appartement"
    Then le Bien est visible dans la liste GET /biens
    And la liste contient "12 rue des Lilas"
    And la table SQLite bien contient 1 ligne et lot contient 1 ligne
