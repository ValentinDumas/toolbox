# Feature — Brouillon liasse fiscale régime micro-BIC (Phase 6 / FIS-05 / Plan 06-02)
#
# Le use case `genererBrouillonLiasse` produit, depuis un snapshot
# `DeclarationAnnuelle.regimeApplique='micro_bic'` :
# un `BrouillonLiasseDto` minimaliste — une seule section 2042-C-PRO avec
# la case 5NI portant les recettes BRUTES (D-L6.2, R4.3 — l'abattement 50%
# est appliqué côté impots.gouv.fr, pas côté app).
#
# Tags : @phase6 @fis-05 @phase6-liasse-micro

@phase6 @fis-05 @phase6-liasse-micro
Feature: Brouillon liasse fiscale régime micro-BIC (FIS-05 / D-L6.2)

  @phase6-liasse-micro-01
  Scenario: Recettes brutes reportées sur la case "5NI" du 2042-C-PRO
    Given une DeclarationAnnuelle clôturée en régime micro-BIC avec recettes 18000 €
    When on génère le brouillon liasse pour cette déclaration
    Then le brouillon contient une section "2042-C-PRO — Report micro-BIC"
    And une case "5NI" porte la valeur "18 000,00 €"
    And le brouillon NE contient PAS de section "2031-SD — Déclaration de résultats BIC"
    And le brouillon NE contient PAS de section "2033-A — Bilan simplifié"

  @phase6-liasse-micro-02
  Scenario: Le brouillon micro n'applique PAS l'abattement 50 % (pédagogie R4.3)
    Given une DeclarationAnnuelle clôturée en régime micro-BIC avec recettes 18000 €
    When on génère le brouillon liasse pour cette déclaration
    Then la case "5NI" ne porte PAS la valeur "9 000,00 €"
