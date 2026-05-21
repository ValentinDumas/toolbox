---
phase: 05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement
plan: "05"
subsystem: fiscalite
tags: [fiscalite, lmnp, lmp-detection, fis-01, verdict-tri-etat, revenus-foyer, cgi-155-iv, bdd, tdd]

requires:
  - phase: 05-01
    provides: "Bailleur.revenusActifsAnnuelsCourant + fiscalitePremierAcces + REGLES_2026.SEUIL_LMP_RECETTES + BailleurAbsent"
  - phase: 05-02
    provides: "RecettesRepository.sommeRecettesAnnuelles + BailleurRepository"

provides:
  - "detecterBasculeLmp : fonction pure VerdictLmp tri-état (CGI art. 155 IV)"
  - "LABELS_VERDICT_LMP : labels français pour affichage S7"
  - "saisirRevenusFoyer : use case enregistre revenusActifsAnnuelsCourant + trace fiscalitePremierAcces"
  - "GET/POST /fiscalite/revenus-foyer : formulaire G3.1 avec tooltip BOFIP-BIC-CHAMP-40-20"
  - "GET /fiscalite/verdict?annee={N} : pré-affichage verdict (Plan 06 inclura via partial)"
  - "partial-verdict-fiscal.ejs : bandeau S7 tri-état WCAG 1.4.1 (couleur+icône+texte)"
  - "BDD @fis-01 : 9 scénarios verts (5 cas limites CONTEXT.md L245-247 + 3 anti-sticky LMP)"

affects:
  - "05-06 (clôture DeclarationAnnuelle) — detecterBasculeLmp consommé par cloturerExercice"
  - "05-07 (dashboard) — partial-verdict-fiscal.ejs inclus dans récap annuel"

tech-stack:
  added: []
  patterns:
    - "Use case pur sans état (anti-sticky LMP) — fonction pure réutilisable sans repo"
    - "Verdict tri-état exporté via TypeScript union type + LABELS map"
    - "BDD @fis-01 : step regex /on évalue le verdict LMNP\\/LMP pour exercice (\\d+)/ pour échapper le slash"
    - "Partial EJS avec config JS object pour mappage statut → bg/fg/icône/role (pattern badge-dpe)"

key-files:
  created:
    - "src/application/fiscalite/detecter-bascule-lmp.ts"
    - "src/application/fiscalite/saisir-revenus-foyer.ts"
    - "src/web/routes/fiscalite/revenus-foyer.ts"
    - "src/web/views/pages/fiscalite/revenus-foyer.ejs"
    - "src/web/views/pages/fiscalite/verdict-preview.ejs"
    - "src/web/views/partials/partial-verdict-fiscal.ejs"
    - "tests/unit/fiscalite/detecter-bascule-lmp.test.ts"
    - "tests/unit/fiscalite/saisir-revenus-foyer.test.ts"
    - "tests/bdd/features/fiscalite-lmp-detection.feature"
    - "tests/bdd/step_definitions/fiscalite-lmp.steps.ts"
  modified:
    - "src/web/schemas/fiscalite-schemas.ts — ajout saisirRevenusFoyerSchema"
    - "src/main.ts — wiring registerFiscaliteRevenusFoyerRoutes"

key-decisions:
  - "detecterBasculeLmp est une fonction PURE sans état — pas de repo, anti-sticky D-FIS-G3.4 garanti par design"
  - "VerdictLmp union type avec 3 valeurs exactes (CONTEXT.md) : lmnp_confirme / lmp_probable / indetermine_revenus_foyer_manquants"
  - "BDD anti-sticky modélisé en 3 scénarios indépendants (pas multi-exercice en séquence) pour lisibilité Cucumber"
  - "Step regex /...LMNP\\/LMP.../ nécessaire pour échapper le / en Cucumber (step string littéral ambiguë)"
  - "saisirRevenusFoyer appelle bailleurRepo.enregistrer (pas mettreAJour) — pattern existant bailleur.ts"

patterns-established:
  - "Fonction pure fiscale avec type VerdictLmp exporté : réutilisé par cloturerExercice (Plan 06)"
  - "Partial EJS verdict-fiscal : variable config JS → mapping statut → rendu (pas de conditions if/else imbriquées)"

requirements-completed:
  - FIS-01

duration: 22min
completed: 2026-05-21
---

# Phase 5 Plan 05 : Détection bascule LMNP → LMP — CGI art. 155 IV

**Verdict tri-état LMNP/Indéterminé/LMP (CGI 155 IV) via fonction pure anti-sticky, formulaire G3.1 revenus foyer avec tooltip BOFIP-BIC-CHAMP-40-20, et partial bandeau S7 WCAG.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-05-21T02:18:41Z
- **Completed:** 2026-05-21T02:40:53Z
- **Tasks:** 2/2
- **Files modified:** 12 (10 créés, 2 modifiés)

## Accomplishments

- Use case pur `detecterBasculeLmp` : 100 % couverture cas limites CONTEXT.md L245-247 (11 assertions TDD RED→GREEN)
- Anti-sticky LMP D-FIS-G3.4 vérifié : fonction pure sans état, 3 verdicts indépendants en BDD
- `saisirRevenusFoyer` : enregistre revenusActifsAnnuelsCourant + trace `fiscalitePremierAcces` (D-FIS-G5.4, premier accès uniquement)
- GET/POST `/fiscalite/revenus-foyer` fonctionnel avec tooltip BOFIP-BIC-CHAMP-40-20 exhaustif
- `partial-verdict-fiscal.ejs` : bandeau tri-état WCAG 1.4.1 (couleur + icône aria-hidden + texte adjacent, role=alert pour LMP probable)
- BDD @fis-01 : 9 scénarios verts (140 total — 0 régression)

## Task Commits

1. **Task 1: Use case detecter-bascule-lmp TDD + saisir-revenus-foyer** — `9354905` (feat)
2. **Task 2: Route revenus-foyer + partial verdict S7 + BDD @fis-01** — `0e16138` (feat)

## Files Created/Modified

- `src/application/fiscalite/detecter-bascule-lmp.ts` — Fonction pure VerdictLmp + LABELS_VERDICT_LMP (CGI art. 155 IV)
- `src/application/fiscalite/saisir-revenus-foyer.ts` — Use case impure enregistre revenus + trace premier accès
- `src/web/routes/fiscalite/revenus-foyer.ts` — GET/POST /fiscalite/revenus-foyer + GET /fiscalite/verdict
- `src/web/views/pages/fiscalite/revenus-foyer.ejs` — Formulaire G3.1 avec `<details>` tooltip BOFIP-BIC-CHAMP-40-20
- `src/web/views/pages/fiscalite/verdict-preview.ejs` — Page pré-affichage verdict (pour GET /fiscalite/verdict)
- `src/web/views/partials/partial-verdict-fiscal.ejs` — Bandeau tri-état S7 WCAG (consommé Plan 06+07)
- `src/web/schemas/fiscalite-schemas.ts` — Ajout saisirRevenusFoyerSchema (Zod min(0))
- `src/main.ts` — Wiring registerFiscaliteRevenusFoyerRoutes
- `tests/unit/fiscalite/detecter-bascule-lmp.test.ts` — 11 tests TDD cas limites + anti-sticky
- `tests/unit/fiscalite/saisir-revenus-foyer.test.ts` — 3 tests use case impure
- `tests/bdd/features/fiscalite-lmp-detection.feature` — 9 scénarios @fis-01 @phase5
- `tests/bdd/step_definitions/fiscalite-lmp.steps.ts` — Steps Given/When/Then détection LMP

## Decisions Made

- **detecterBasculeLmp pur** : fonction sans état, pas de repo — anti-sticky D-FIS-G3.4 garanti par design (impossible d'introduire sticky accidentellement)
- **VerdictLmp tri-état littéral** : union type exactement 3 valeurs du plan (pas d'enum) — compatible JSON, consommable directement par EJS
- **BDD anti-sticky en 3 scénarios indépendants** : scénario séquentiel multi-exercice trop complexe à modéliser en Cucumber français ; 3 scénarios indépendants couvrent la même exigence D-FIS-G3.4 avec plus de lisibilité
- **Step regex pour LMNP/LMP** : le `/` dans "LMNP/LMP" est ambigu dans les step strings Cucumber → regex `/^on évalue le verdict LMNP\/LMP pour exercice (\d+)$/` nécessaire

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Issues Encountered

- Duplicate `When` step déclenché lors de la première implémentation (même pattern enregistré 2 fois) → supprimé la duplication.
- Step string `'on évalue le verdict LMNP/LMP pour exercice {int}'` non reconnu par Cucumber (slash) → remplacé par regex `/^on évalue le verdict LMNP\/LMP pour exercice (\d+)$/`.
- Erreur TypeScript `Conversion of type 'null' to type 'Bailleur'` dans le test → remplacé `as Bailleur` par `!` (non-null assertion) sur variable locale trackée par `not.toBeNull()`.

## Known Stubs

Aucun stub — les données viennent des repos injectés. Le GET /fiscalite/verdict affiche les données courantes (non clôturées) et est explicitement documenté comme "pré-affichage" avant clôture Plan 06.

## Next Phase Readiness

- `detecterBasculeLmp` prêt à être appelé par `cloturerExercice` (Plan 06) avec le snapshot revenusFoyer figé
- `partial-verdict-fiscal.ejs` prêt à être inclus dans le récap annuel Plan 06 et le dashboard Plan 07
- Formulaire G3.1 `/fiscalite/revenus-foyer` opérationnel pour saisie utilisateur pré-clôture

---
*Phase: 05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement*
*Completed: 2026-05-21*
