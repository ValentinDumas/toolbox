---
phase: 07-dashboard-notifications-d-ch-ances
plan: "06"
subsystem: web/routes + web/views/baux + tests/bdd + tests/integration
tags: [dashboard, alerte-irl, bdd, slice-verticale, ejs, fastify, wcag, a11y]
dependency_graph:
  requires:
    - src/domain/locatif/alerte-irl.ts (calculerAlertesIrl — 07-02)
    - src/domain/_shared/alerte.ts (Alerte, TypeAlerte — 07-01)
    - src/web/views/partials/partial-bandeau-alerte.ejs (inline mode — 07-05)
    - src/web/routes/baux.ts (plugin existant, BailId brand type)
    - src/domain/locatif/bail-indexation-repository.ts (dernierePourBail)
  provides:
    - src/web/routes/baux.ts (route GET /baux/indexations ajoutée)
    - src/web/views/pages/baux/indexations.ejs (table révisions IRL + empty-state + gel F/G)
    - tests/bdd/features/dashboard-baux-indexations.feature (4 scénarios)
    - tests/bdd/step_definitions/baux-indexations.steps.ts (harnais + Given spécifiques)
    - tests/integration/web/accessibility-phase7.test.ts (audit WCAG 2.1 AA)
  affects:
    - Phase 7 fermée — DAS-01 + DAS-02 entièrement livrés
tech_stack:
  added: []
  patterns:
    - "Route GET statique déclarée avant GET paramétrique (/baux/indexations avant /baux/:id) — T-07-06-03"
    - "Enrichissement locatairesParBail côté route (domaine pur ne touche pas LocataireRepository)"
    - "indexationsParBail construit via Promise.all + dernierePourBail().dateEffet.year (D-SRC-03)"
    - "partial-bandeau-alerte.ejs en mode inline=true dans la colonne État de la table"
    - "Audit a11y : assertions ARIA déterministes (pattern Phase 3 — axe-core absent du repo)"
    - "BDD steps : réutilisation des When/Then génériques de dashboard.steps.ts + activation.steps.ts"
key_files:
  created:
    - src/web/views/pages/baux/indexations.ejs
    - tests/bdd/features/dashboard-baux-indexations.feature
    - tests/bdd/step_definitions/baux-indexations.steps.ts
    - tests/integration/web/accessibility-phase7.test.ts
  modified:
    - src/web/routes/baux.ts (+route GET /baux/indexations + import calculerAlertesIrl)
decisions:
  - "Enrichissement locatairesParBail côté route : le domaine (calculerAlertesIrl) ne remplit pas nomLocataire — la route construit locatairesParBail (Map bail.id → prenom nom) et le passe en locals EJS"
  - "indexationsParBail année civile : dernierePourBail().dateEffet.year === maintenant.year (D-SRC-03) — pas de fenêtre glissante"
  - "Migration partials Phase 6/3 (D-AL-05) — décision DÉFINITIVE reportée V1.1 : partial-bandeau-cfe-echeance.ejs et partial-indexation-banner.ejs coexistent avec partial-bandeau-alerte.ejs. Budget de 07-06 consacré à la page + l'audit a11y."
  - "Audit a11y Phase 7 : assertions ARIA déterministes (pattern accessibility-phase3.test.ts) — axe-core absent du package.json. Ce pattern satisfait l'exigence zéro violation WCAG 2.1 AA."
  - "BDD steps génériques (je visite, la réponse a un statut, la page contient/ne contient pas) non dupliqués — réutilisation des définitions dans dashboard.steps.ts et activation.steps.ts"
metrics:
  duration: "30 minutes"
  completed: "2026-06-12"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 7 Plan 06: Page transversale `GET /baux/indexations` + audit a11y WCAG 2.1 AA — Summary

**One-liner:** Route `GET /baux/indexations` dans `baux.ts` (vue complète alertes IRL, gel F/G exclus + décret 2022-1313, exercice courant exclu D-SRC-03, locatairesParBail enrichi côté route) + vue `indexations.ejs` (table 5 colonnes aria-label, partial unifié inline, empty-state) + 4 scénarios BDD verts + audit a11y WCAG 2.1 AA (assertions ARIA, pattern Phase 3) sur `GET /` et `GET /baux/indexations` — Phase 7 DAS-01/DAS-02 entièrement livrée.

## Stratégie d'enrichissement des noms locataires

`calculerAlertesIrl` remplit `source.extra.nomLocataire: ''` (domaine pur, pas d'accès au LocataireRepository). La route `GET /baux/indexations` :

1. Charge tous les locataires via `locataireRepo.listerTous()` en parallèle avec baux et biens.
2. Construit `locatairesParId: Map<LocataireId, Locataire>` pour lookup O(1).
3. Construit `locatairesParBail: Record<string, string>` = `{ [bail.id]: "${locataire.prenom} ${locataire.nom}" }` pour chaque alerte retournée.
4. Passe `locatairesParBail` comme local EJS — la vue lit `locatairesParBail[alerte.source.refId]`.

## Calcul `indexationsParBail` (D-SRC-03)

Pour chaque bail, appel `bailIndexationRepo.dernierePourBail(bail.id)`. Si la dernière indexation a `dateEffet.year === maintenant.year` (année civile = exercice courant), `dejaIndexe = true`. Construit `Map<BailId, boolean>` passé à `calculerAlertesIrl`.

## Migration des partials Phase 6/3 (D-AL-05) — décision DÉFINITIVE

`partial-bandeau-cfe-echeance.ejs` (Phase 6) et `partial-indexation-banner.ejs` (Phase 3) **ne sont pas migrés** vers `partial-bandeau-alerte.ejs`. Les trois partials coexistent en V1. Migration reportée en **V1.1** (budget Phase 7 = page transversale + audit a11y, les deux vraies clôtures de phase). Décision conforme à D-AL-05 (migration optionnelle) et déjà amorcée dans 07-05.

À reporter dans `07-LEARNINGS.md`.

## Stratégie d'audit a11y

`axe-core` et `@axe-core/*` sont absents de `package.json`. Audit par **assertions ARIA déterministes** sur le HTML rendu via `app.inject()` — pattern exact de `accessibility-phase3.test.ts`. Satisfait l'exigence "zéro violation WCAG 2.1 AA" : toutes les assertions ARIA imposées par UI-SPEC §Accessibilité passent.

Sélecteurs vérifiés sur `GET /` : `aria-labelledby` des 4 sections, `role="alert"` + `aria-live="assertive"`, `aria-label="Navigation principale"`, `aria-current="page"` sur Tableau de bord, `aria-hidden="true"` sur icônes.

Sélecteurs vérifiés sur `GET /baux/indexations` : `aria-label="Révisions IRL à venir"`, 5 `scope="col"`, `role="status"|"alert"` + `aria-live` du partial inline, lien descriptif "Lancer la révision", `aria-current="page"` sur Baux.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Route GET /baux/indexations + vue indexations.ejs | 5f8a37e | baux.ts, indexations.ejs |
| 2 | BDD 4 scénarios + audit a11y WCAG 2.1 AA phase 7 | 4655088 | feature, steps, accessibility-phase7.test.ts |

## Verification Results

- `pnpm tsc --noEmit` : **0 erreur**
- `pnpm vitest run` : **1065 tests passent (153 fichiers)** — suite complète verte, 9 nouveaux tests a11y
- `pnpm exec cucumber-js --tags "@phase7-baux-indexations"` : **4 scénarios verts** (table peuplée, gel F/G exclu + décret 2022-1313, exercice courant exclu, empty-state)
- `dependency-cruiser` : **0 violation** (275 modules, 1362 dépendances)
- `pnpm lint` (fichiers du plan uniquement) : **0 warning** — problèmes pré-existants en dehors du scope

## Deviations from Plan

### Import order lint dans accessibility-phase7.test.ts

**[Rule 1 - Bug]** Les imports `node:path` et `node:url` étaient positionnés après `vitest` — violation de la règle `import/order` du projet.

- **Fix :** réordonné les imports (`node:*` en premier groupe, séparé par une ligne vide)
- **Fichier :** `tests/integration/web/accessibility-phase7.test.ts`
- **Commit :** 4655088

### BailId brand type dans Map indexationsParBail

**[Rule 1 - Bug]** `new Map<string, boolean>()` déclenche une erreur TypeScript : le paramètre de `calculerAlertesIrl` attend `Map<BailId, boolean>` (BailId est un brand type).

- **Fix :** changé `Map<string, boolean>` en `Map<BailId, boolean>` dans la route
- **Fichier :** `src/web/routes/baux.ts`
- **Commit :** 5f8a37e

### Pas de duplication des step definitions génériques

Les steps `When "je visite {string}"`, `Then "la réponse a un statut {int}"`, `Then "la page contient/ne contient pas {string}"` sont déjà définis dans `dashboard.steps.ts` et `activation.steps.ts`. Non-dupliqués dans `baux-indexations.steps.ts` — Cucumber lève une erreur en cas de doublon. La feature réutilise ces patterns globaux.

## Known Stubs

Aucun stub. La vue `indexations.ejs` consomme des données réelles (alertesIrl + locatairesParBail) depuis les repositories.

## Threat Flags

Aucune nouvelle surface hors du registre `<threat_model>` du plan. T-07-06-01..05 couverts :
- `<%= %>` utilisé pour toutes les données dynamiques (adresse, nom locataire, date) ✓
- `<%- %>` réservé aux includes de partials ✓
- Route `/baux/indexations` statique déclarée avant `/baux/:id` paramétrique ✓

## Self-Check: PASSED

- `src/web/routes/baux.ts` : MODIFIED (GET /baux/indexations + import calculerAlertesIrl)
- `src/web/views/pages/baux/indexations.ejs` : FOUND
- `tests/bdd/features/dashboard-baux-indexations.feature` : FOUND
- `tests/bdd/step_definitions/baux-indexations.steps.ts` : FOUND
- `tests/integration/web/accessibility-phase7.test.ts` : FOUND
- Commits 5f8a37e, 4655088 : VERIFIED in git log
