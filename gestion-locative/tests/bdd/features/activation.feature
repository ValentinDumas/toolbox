Feature: Activation

  Scenario: Création Bien minimal au premier lancement
    Given l'application est lancée pour la première fois
    When le bailleur soumet le formulaire Bien avec l'adresse "12 rue des Lilas", code postal "75020", ville "Paris", surface 45, type "appartement", année 1985, lot désignation "Appartement principal", type lot "appartement"
    Then le Bien est visible dans la liste GET /biens
    And la liste contient "12 rue des Lilas"
    And la table SQLite bien contient 1 ligne et lot contient 1 ligne

  Scenario: L'utilisateur traverse le wizard complet en une session
    Given l'application est lancée pour la première fois
    When le bailleur visite "/"
    Then il est redirigé vers "/wizard/bien"
    And la page affiche "Créer votre premier bien"
    And la page affiche "Étape 1 sur 3"
    When le bailleur soumet le formulaire wizard bien avec l'adresse "12 rue des Lilas", code postal "75020", ville "Paris", surface 45, type "appartement", année 1985, lot désignation "Appartement principal", type lot "appartement"
    Then il est redirigé vers "/wizard/locataire"
    And la page affiche "Créer le locataire"
    And la page affiche "Étape 2 sur 3"
    And la table SQLite bien contient 1 ligne
    When le bailleur soumet le formulaire wizard locataire avec nom "Dupont", prénom "Marie", email "marie@example.fr", date de naissance "1985-06-15", commune "Paris", pays "France", nationalité "française", téléphone "0102030405", rue "12 rue des Lilas", code postal "75020", ville "Paris"
    Then il est redirigé vers "/wizard/bail"
    And la page affiche "Créer le bail"
    And la page affiche "Étape 3 sur 3"
    And la table SQLite locataire contient 1 ligne
    When le bailleur soumet le formulaire wizard bail avec loyer 800, charges 50, mode "forfait", dépôt 800, IRL trimestre "2026-T1", IRL valeur "145.47", date début "2026-06-01", durée 12
    Then il est redirigé vers "/biens"
    And la page affiche "Bail enregistré avec succès"
    And la table SQLite bail contient 1 ligne
    And la table SQLite bail_lots contient 1 ligne
    And la table SQLite meta contient wizard_complete

  Scenario: Au second lancement, le wizard n'est plus affiché
    Given l'application a déjà complété le wizard
    When le bailleur visite "/"
    Then il est redirigé vers "/biens"

  @gap-closure
  Scenario: Bug G1 — submission wizard sans surface re-render avec erreur inline (pas de JSON 500)
    Given l'application est lancée pour la première fois
    When le bailleur soumet POST /wizard/bien avec lot type appartement et surface vide
    Then la réponse a un statusCode 200
    And la réponse contient le header Content-Type "text/html"
    And la page ne contient pas '"statusCode":500'
    And la page contient "obligatoire"
    And la table SQLite bien contient 0 lignes

  @gap-closure
  Scenario: Wizard skippable — l'utilisateur termine après l'étape Bien seul
    Given l'application est lancée pour la première fois
    When le bailleur soumet POST /wizard/bien?terminer=1 avec un bien valide
    Then il est redirigé vers "/biens"
    And la page affiche "Bien enregistré"
    And la table SQLite bien contient 1 ligne
    And la table SQLite locataire contient 0 lignes
    And la table SQLite bail contient 0 lignes
    And la table SQLite meta contient wizard_complete=1

  @gap-closure
  Scenario: Wizard skippable — l'utilisateur termine après l'étape Locataire (sans Bail)
    Given l'application est lancée pour la première fois
    When le bailleur soumet le formulaire wizard bien avec l'adresse "12 rue des Lilas", code postal "75020", ville "Paris", surface 45, type "appartement", année 1985, lot désignation "Appartement principal", type lot "appartement"
    And le bailleur soumet POST /wizard/locataire?terminer=1 avec un locataire valide
    Then il est redirigé vers "/biens"
    And la page affiche "Locataire enregistré"
    And la table SQLite bien contient 1 ligne
    And la table SQLite locataire contient 1 ligne
    And la table SQLite bail contient 0 lignes
    And la table SQLite meta contient wizard_complete=1
