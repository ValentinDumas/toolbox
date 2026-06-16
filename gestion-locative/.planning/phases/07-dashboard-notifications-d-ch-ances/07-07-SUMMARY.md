---
phase: 07-dashboard-notifications-d-ch-ances
plan: 07
subsystem: ui
tags: [dashboard, alertes, ejs, ddd, bdd, wcag]

# Dependency graph
requires:
  - phase: 07-dashboard-notifications-d-ch-ances
    provides: dashboard 4 sections, alertes unifiées (Alerte read-model), helpers EJS, calculateurs domaine IRL/fin-bail/CFE/diagnostic
provides:
  - libelleTypeAlerte rend "Électricité" pour typeDiagnostic 'elec' (WR-02 fermé)
  - calculerAlertesIrl + calculerAlertesFinBail émettent extra.nomLocataire (WR-03 fermé)
  - dashboard sans ancre morte ; "Voir tout" actions du jour → /baux/indexations (WR-01 fermé)
  - docs juridiques fin-bail [-30,+60] et IRL forward-only [0,+30] réconciliées et verrouillées par BDD (WR-04/WR-05)
affects: [verification-phase-7, dashboard, alertes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Map<BailId, string> nomLocataireParBail résolue dans le use case, jamais un repo dans le domaine"
    - "Paramètre domaine optionnel rétrocompatible (5e arg IRL, 3e arg fin-bail)"

key-files:
  created:
    - tests/unit/web/alerte-helpers.test.ts
  modified:
    - src/web/helpers/alerte-helpers.ts
    - src/domain/locatif/alerte-irl.ts
    - src/domain/locatif/alerte-fin-bail.ts
    - src/application/dashboard/calculer-toutes-alertes.ts
    - src/web/routes/racine.ts
    - src/web/views/pages/dashboard/accueil.ejs
    - tests/unit/locatif/alerte-irl.test.ts
    - tests/unit/locatif/alerte-fin-bail.test.ts
    - tests/bdd/features/alerte-irl.feature
    - tests/bdd/features/alerte-fin-bail.feature
    - tests/bdd/features/dashboard-composition.feature
    - tests/unit/dashboard/calculer-toutes-alertes.test.ts
    - tests/bdd/step_definitions/alerte-agregation.steps.ts

key-decisions:
  - "WR-02 : libelleTypeAlerte compare === 'elec' (la seule valeur TypeDiagnostic pour l'électricité), jamais 'electricite'."
  - "WR-01 S2 : aucun lien 'Voir tout' alertes critiques en V1 (aucune page dédiée n'existe) — le top 5 reste affiché, les alertes par domaine restent atteignables via leurs pages respectives."
  - "WR-01 S4 : 'Voir tout' actions du jour pointe vers /baux/indexations (page transversale réelle 07-06)."
  - "WR-03 : nomLocataire résolu dans le use case via locataireRepo et injecté en Map ; le domaine reste pur."
  - "WR-04 : fenêtre fin-bail RÉELLE = j <= 30 && j >= -60 (J-30 avant la fin à J+60 après) ; doc alignée, code inchangé."
  - "WR-05 : fenêtre IRL forward-only [0,+30] (dateAnniversaireProchaine toujours future) ; borne basse -30 conservée mais documentée défensive/inatteignable."

patterns-established:
  - "Pattern résolution nom : use case construit Map<BailId, string> et la passe en argument optionnel au calculateur domaine pur."
  - "Pattern verrouillage juridique : scénario BDD nommant explicitement la fenêtre (D-SRC-XX) pour empêcher une 'correction' inverse du code."

requirements-completed: [DAS-01, DAS-02]

# Metrics
duration: ~50min
completed: 2026-06-16
---

# Phase 7 Plan 07: Gap-closure dashboard alertes (WR-01..05) Summary

**Fermeture des 5 gaps de 07-VERIFICATION (libellé élec, identification locataire, ancres mortes, docs juridiques) pour prouver TRUE les truths #3 et #4 de la Phase 7.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 4 (3 implémentation TDD/auto + 1 checkpoint human-verify approuvé)
- **Files modified:** 13 (1 créé, 12 modifiés)

## Accomplishments

- **WR-02 (BLOCKER) fermé** : `libelleTypeAlerte` rend désormais « Électricité » pour `typeDiagnostic === 'elec'` (au lieu du fallback « Diagnostic »), avec aria-label correct. Helper couvert par un test unitaire dédié (trou Nyquist comblé).
- **WR-03 (contrat rompu) fermé** : `calculerAlertesIrl` et `calculerAlertesFinBail` émettent `extra.nomLocataire`, résolu dans le use case via `locataireRepo` (Map `nomLocataireParBail`), le domaine restant pur. Les actions IRL (S4) et bandeaux fin de bail (S2) identifient le locataire par son nom.
- **WR-01 (BLOCKER) fermé** : ancre morte `#toutes-alertes-critiques` supprimée de S2 (aucune page V1), ancre morte `#toutes-actions-jour` remplacée par `/baux/indexations` en S4.
- **WR-04 / WR-05 (warnings juridiques) verrouillés** : docs fin-bail (`[-30,+60]`) et IRL (forward-only `[0,+30]`) réconciliées avec le code, figées par scénarios BDD nommant explicitement les fenêtres.

## Task Commits

1. **Task 1 (TDD) : corriger le littéral 'elec' dans libelleTypeAlerte + créer son test** - `0ba60c3` (test → fix combiné RED/GREEN)
2. **Task 2 (TDD) : produire extra.nomLocataire (IRL + fin-bail) + réconcilier docs WR-04/WR-05** - `6bed765` (feat)
3. **Task 3 : câbler nomLocataireParBail (use case + route) + corriger ancres mortes** - `653abf5` (feat)
4. **Task 4 (checkpoint human-verify) : APPROUVÉ** par l'utilisateur — 5 points visuels confirmés (rendu élec, hiérarchie warning-fort vs warning, lien externe CFE nouvel onglet, identification locataire, ancres « Voir tout » corrigées).

## Files Created/Modified

- `tests/unit/web/alerte-helpers.test.ts` - **Créé** : couverture complète de `libelleTypeAlerte`, `formaterAlerteUrgence`, `iconeTypeAlerte`.
- `src/web/helpers/alerte-helpers.ts` - Comparaison corrigée `=== 'elec'` (WR-02).
- `src/domain/locatif/alerte-irl.ts` - 5e param optionnel `nomLocataireParBail`, `extra.nomLocataire` émis, doc fenêtre forward-only `[0,+30]` (WR-05).
- `src/domain/locatif/alerte-fin-bail.ts` - 3e param optionnel `nomLocataireParBail`, `source.extra.nomLocataire` émis, JSDoc fenêtre `[-30,+60]` corrigée (WR-04).
- `src/application/dashboard/calculer-toutes-alertes.ts` - `locataireRepo` ajouté aux deps, construction `Map nomLocataireParBail`, passage aux 2 calculateurs.
- `src/web/routes/racine.ts` - `locataireRepo` passé à `calculerToutesAlertes`.
- `src/web/views/pages/dashboard/accueil.ejs` - Ancres mortes corrigées (S2 supprimée, S4 → /baux/indexations).
- `tests/unit/locatif/alerte-irl.test.ts` - Tests 10/11 nomLocataire + régression adresseBien.
- `tests/unit/locatif/alerte-fin-bail.test.ts` - Tests 8/9 nomLocataire + rétrocompatibilité.
- `tests/bdd/features/alerte-irl.feature` - 3 scénarios verrouillage WR-05 (forward-only).
- `tests/bdd/features/alerte-fin-bail.feature` - 3 scénarios verrouillage WR-04 (`[-30,+60]`).
- `tests/bdd/features/dashboard-composition.feature` - Scénario dashboard-02 mis à jour (plus de lien « Voir tout » S2 en V1).
- `tests/unit/dashboard/calculer-toutes-alertes.test.ts` + `tests/bdd/step_definitions/alerte-agregation.steps.ts` - Stub `locataireRepo` ajouté aux doubles.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mise à jour des doubles de test consommant calculerToutesAlertes**
- **Found during:** Task 3
- **Issue:** L'ajout de `locataireRepo` à `CalculerToutesAlertesDeps` cassait la compilation TypeScript de 2 fichiers de test existants (`calculer-toutes-alertes.test.ts`, `alerte-agregation.steps.ts`) qui construisaient le deps sans ce champ.
- **Fix:** Ajout d'un stub `locataireRepo` (`listerTous` → `[]`) dans les deux `buildDeps`/`makeDeps`.
- **Files modified:** tests/unit/dashboard/calculer-toutes-alertes.test.ts, tests/bdd/step_definitions/alerte-agregation.steps.ts
- **Commit:** 653abf5

**2. [Rule 1 - Bug] Scénario BDD dashboard-02 obsolète après suppression du lien S2**
- **Found during:** Task 3
- **Issue:** Le scénario `@phase7-dashboard-02` asserait la présence de « Voir tout (6) » pour les alertes critiques — comportement explicitement supprimé par le plan (WR-01, action S2).
- **Fix:** Scénario mis à jour pour ne plus exiger le lien (le top 5 reste asserté).
- **Files modified:** tests/bdd/features/dashboard-composition.feature
- **Commit:** 653abf5

## Threat Surface

Aucune nouvelle surface d'attaque introduite. Conformément au threat model du plan :
- T-07-07-01 (XSS) : `nomLocataire` et `libelleTypeAlerte` rendus via `<%= %>` (EJS échappe par défaut) — aucun `<%- %>` introduit pour ces champs.
- T-07-07-03 : href `/baux/indexations` est une URL statique en dur, aucune interpolation de donnée utilisateur.

## Checkpoint

**Task 4 (human-verify, gate=blocking) : APPROVED** par l'utilisateur. Les 5 points de vérification visuelle (rendu « Électricité », hiérarchie warning-fort vs warning + role="alert", lien externe CFE nouvel onglet `target="_blank" rel="noopener noreferrer"`, identification locataire S2/S4, ancres « Voir tout » corrigées) ont été inspectés en navigateur et confirmés conformes.

## Verification Results

- `pnpm vitest run` : **1089 passed, 0 failed**.
- `pnpm exec cucumber-js --tags "@phase7"` : **34 scenarios passed, 175 steps passed**.
- `pnpm tsc --noEmit` : **0 erreur**.
- Grep gates des `<acceptance_criteria>` : tous satisfaits (`=== 'elec'` x1, `=== 'electricite'` x0, `nomLocataire` présent dans les 2 calculateurs, `adresseBien` préservé, ancres mortes absentes, `/baux/indexations` présent, ancien texte WR-04/WR-05 supprimé).

## Self-Check: PASSED

- tests/unit/web/alerte-helpers.test.ts — FOUND
- 07-07-SUMMARY.md — FOUND
- Commits 0ba60c3, 6bed765, 653abf5 — FOUND
