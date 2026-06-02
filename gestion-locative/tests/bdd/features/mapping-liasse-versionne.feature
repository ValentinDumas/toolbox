# Feature — Mapping liasse versionné par millésime (Phase 6 / FIS-05 / D-L6.3)
#
# Le mapping case-par-case du cerfa 2031-SD + annexes 2033-A/B/C/D est versionné
# par millésime. Le port MappingLiasseProvider expose `pour(millesime)` et
# fail-fast `MappingLiasseAbsent` si le millésime n'est pas couvert.
#
# Pattern miroir RegleFiscaleProvider — voir 06-PATTERNS.md §Pattern critique 1.
# Sources juridiques : 2031-SD millésime 2026, R1.1 RISKS.md (revue annuelle post-LF).

@phase6 @fis-05 @phase6-mapping-versionne
Feature: Mapping liasse versionné par millésime (FIS-05 / D-L6.3)

  @phase6-mapping-versionne-01
  Scenario: Mapping disponible pour le millésime 2026
    Given le mapping fiscal pour le millésime 2026
    When on récupère le mapping
    Then le mapping est trouvé
    And la section 2031-SD contient la case du bénéfice fiscal

  @phase6-mapping-versionne-02
  Scenario: Fail-fast sur millésime non couvert (année future)
    Given un MappingLiasseProvider en mémoire couvrant 2026 uniquement
    When on récupère le mapping pour 2027
    Then une erreur MappingLiasseAbsent est levée
    And le message cite "millésime 2027 non couvert"

  @phase6-mapping-versionne-03
  Scenario: Fail-fast sur millésime non couvert (année antérieure pré-V1)
    Given un MappingLiasseProvider en mémoire couvrant 2026 uniquement
    When on récupère le mapping pour 2025
    Then une erreur MappingLiasseAbsent est levée
