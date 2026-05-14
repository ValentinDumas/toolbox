@enc-02 @phase2
Feature: Activation bail et génération d'échéances (ENC-02)

  Background:
    Given l'application est prête pour ENC-02 avec clock fixe "2026-05-01"
    And un bail brouillon ENC-02 existe avec loyer 620, charges 80, durée 12

  Scenario: Activation d'un bail brouillon génère les échéances (ENC-02)
    When le bailleur active le bail avec actif_depuis "2026-05-01" et jour_echeance 5
    Then 12 EcheanceLoyer existent en base pour ce bail
    And la page GET baux echeances liste 12 lignes

  Scenario: Téléchargement de l'avis d'échéance PDF (ENC-02)
    Given le bail est activé avec actif_depuis "2026-05-01" et jour_echeance 5
    And un profil bailleur est renseigné
    When le bailleur télécharge GET echeances avis-pdf pour la 1ère échéance
    Then la réponse a statut 200
    And le Content-Type est "application/pdf"
    And le Content-Disposition contient "attachment; filename="
    And le corps du PDF commence par les bytes PDF

  Scenario: Activation rétroactive > 2 ans affiche warning (ENC-02 D-72)
    When le bailleur active le bail avec actif_depuis "2023-01-01" et jour_echeance 1
    Then 12 EcheanceLoyer existent en base pour ce bail
    And la page de redirection affiche "Activation rétrospective"

  @D-56
  Scenario: Prorata 1ère échéance milieu de mois (ENC-02)
    When le bailleur active le bail avec actif_depuis "2026-05-15" et jour_echeance 5
    Then la 1ère EcheanceLoyer a un loyer prorata pour 17 jours sur 31

  @D-56
  Scenario: Prorata dernière échéance (ENC-02 D-56)
    Given un bail brouillon ENC-02 existe avec date_debut "2026-02-15", dureeMois 12, loyer 700, charges 80, jourEcheance 1
    When le bailleur active le bail avec actif_depuis "2026-02-15" et jour_echeance 1
    Then 12 EcheanceLoyer sont générées
    And la première échéance a un loyer prorata pour 14 jours sur 28
    And la 12e échéance a un loyer prorata pour 14 jours sur 28
    And la somme des 12 loyerHc égale 700 * 11 à 1 centime près
    And la somme des 12 montantCharges égale 80 * 11 à 1 centime près
