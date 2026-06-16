---
phase: 09-finition-qualit-cl-ture-uat-r-conciliation-des-statuts
plan: 01
subsystem: testing
tags: [uat, playwright, liasse, cfe, ejs, fastify-view, regression]

requires:
  - phase: 06-liasse-2031-cfe
    provides: "Vues brouillon liasse (réel/micro/rectificative), exports PDF/CSV, déclarations CFE + banner J-30"
provides:
  - "Exécution des 10 scénarios UAT liasse/CFE mécaniquement vérifiables (1-7, 10-12)"
  - "Correctif bloquant : wizard de clôture (includes EJS) + test de régression de rendu"
affects: [09-03]

tech-stack:
  added: []
  patterns:
    - "Test de rendu de route via creerApp + app.inject (route-cloture-wizard.test.ts)"

key-files:
  created:
    - tests/integration/web/route-cloture-wizard.test.ts
  modified:
    - src/web/views/pages/fiscalite/wizard-cloture/etape-1.ejs
    - src/web/views/pages/fiscalite/wizard-cloture/etape-2.ejs
    - src/web/views/pages/fiscalite/wizard-cloture/etape-3.ejs
    - src/web/views/pages/fiscalite/wizard-cloture/etape-4.ejs
    - src/web/views/pages/fiscalite/wizard-cloture/etape-5.ejs
    - .planning/phases/06-liasse-2031-cfe/06-UAT.md

key-decisions:
  - "Exécution inline (session principale) plutôt que sous-agents gsd-executor : seuls Playwright MCP + le serveur live + node_modules sont disponibles dans la session principale."
  - "Setup des déclarations liasse par seed direct (repos), CFE créée via l'UI live. Mapping liasse 2026-only + UNIQUE(bailleur,exercice) ⇒ sc.4 micro vérifié via test d'intégration équivalent."
  - "Cold start (sc.1) testé sur DB neuve (HOME temp, port 7879) pour ne perturber ni le serveur ni la DB de l'utilisateur."

patterns-established:
  - "Régression de rendu EJS : un test app.inject par famille de vues non couverte par les tests use-case."

requirements-completed: [QUA-01]

duration: ~75min
completed: 2026-06-16
---

# Phase 9 — Plan 09-01 Summary

**Les 10 scénarios UAT liasse/CFE mécaniquement vérifiables sont exécutés et au vert ; un crash bloquant du wizard de clôture (jamais couvert par les tests) a été découvert, corrigé et verrouillé par un test de régression.**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-06-16T10:03 CEST
- **Completed:** 2026-06-16T10:30 CEST
- **Tasks:** 2/2
- **Files modified:** 6 (+1 créé)

## Accomplishments

### Task 1 — Exécution Playwright des scénarios liasse (sc.1-9 partie auto)
- **sc.1 Cold start** (pass) — DB neuve, boot sans erreur, migration 0023 appliquée, /fiscalite 200.
- **sc.2 Bloc Brouillons de liasse** (pass) — réel + micro listés avec suffixe, liens /liasse.
- **sc.3 Brouillon réel 5 annexes** (pass) — bandeau S1, H1 millésime+bailleur, 2031-SD/2033-A/B/C/D, toutes les cases (numéro+libellé+€), bandeau S3. Cohérence fiscale FC−FK−FY = GA/CB (6 700 €).
- **sc.4 Micro-BIC 5NI** (pass-with-note) — vérifié via `route-liasse.test.ts` (2042-C-PRO + 5NI + recettes brutes), live impossible (mapping 2026-only + UNIQUE).
- **sc.5 Drill-down sources** (pass) — `<details>` natif, liens internes FC/FK, `—` sinon.
- **sc.6 Réconciliation snapshot ≠ vivant** (pass-with-note) — bandeau rouge + compteur, pas de « Re-calculer ».
- **sc.8 Export PDF** (pending) — déclenchement OK (200, application/pdf, filename, %PDF) ; lisibilité → 09-03.
- **sc.9 Export CSV** (pending) — BOM + `;` + colonnes + 0 injection (28 lignes) ; accents Excel → 09-03.

### Task 2 — CFE (sc.10-12) + correction des écarts bloquants
- **sc.7 Liasse rectificative** (pass) — bandeau S6 + lien originale ; originale sans S6.
- **sc.10 Création + édition CFE** (pass) — création + édition persistées via l'UI live.
- **sc.11 Carte + badge CFE** (pass) — badge FR officiel évolutif, millésime/échéance/montant.
- **sc.12 Banner J-30** (pass) — variante warning live (fiche bien + /fiscalite), lien impots.gouv.fr `target=_blank rel=noopener noreferrer`, suppression si `payee` ; variantes forte/destructive via tests.

## Deviations

- **Écart bloquant (D-04) découvert et corrigé** : `wizard-cloture/etape-*.ejs` (5 fichiers) incluaient leurs partials avec `../../../../partials/` (4 niveaux au lieu de 3) → ENOENT `…/toolbox/partials/layout-debut.ejs` → page 500 sur tout `/fiscalite/cloturer/:exercice/etape/{1..5}`. Bug présent depuis la création (commit 18fcf49) ; les tests de clôture exercent le use-case en mémoire et ne rendaient jamais ces vues. Corrigé commit `bd175e5` (profondeur 4→3) + `route-cloture-wizard.test.ts` (rend les 5 étapes via app.inject, exige 200).
- Setup des déclarations liasse par seed temporaire (repos) car la création via le wizard exige tout le chaînage de prérequis (recettes/amortissement) ; CFE en revanche créée 100 % via l'UI live.

## Self-Check: PASSED

- `grep -c 'result: \[pending\]' 06-UAT.md` = 2 (sc.8, sc.9 uniquement). ✓
- 0 `result: issue` bloquant non résolu. ✓
- `pnpm test` (vitest run) : 156 fichiers, 1096 tests verts (dont le nouveau test de régression). ✓
- `## Summary` cohérent : 10 passed, 0 issues, 2 pending, 0 skipped. ✓

## Données de test laissées dans la DB live

Seed UAT ajouté dans `~/Library/Application Support/gestion-locative/db.sqlite` :
- DeclarationAnnuelle réel 2026 (`35bbda02…`) + micro-BIC 2024 (`7e855a96…`)
- DeclarationCorrigee de la réel 2026 (`d53bfe18…`)
- DeclarationCfe 2026 sur le bien `cf36efa7…` (statut final `payee`)

À purger si un état vierge est souhaité (non fait automatiquement — suppression sur DB live nécessite un accord explicite).
