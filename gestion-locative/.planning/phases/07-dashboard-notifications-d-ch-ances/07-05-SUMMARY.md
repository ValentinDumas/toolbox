---
phase: 07-dashboard-notifications-d-ch-ances
plan: "05"
subsystem: web/routes + web/views/dashboard
tags: [dashboard, alerte, bdd, slice-verticale, ejs, fastify, wcag]
dependency_graph:
  requires:
    - src/application/dashboard/calculer-toutes-alertes.ts (CalculerToutesAlertesDeps — 07-04)
    - src/domain/_shared/alerte.ts (Alerte, TypeAlerte — 07-01)
    - src/domain/encaissements/impaye.ts (listerImpayes, Impaye DTO)
    - src/application/encaissements/calculer-relance-disponible.ts (calculerRelanceDisponible)
    - src/domain/encaissements/echeance-loyer-repository.ts (listerNonPayees)
    - src/domain/encaissements/relance-repository.ts (listerParEcheance)
    - src/infrastructure/lifecycle/premier-lancement.ts (estPremierLancement)
  provides:
    - src/web/routes/racine.ts (GET / → dashboard, branche premier lancement préservée)
    - src/web/views/pages/dashboard/accueil.ejs (4 sections ARIA + état zen)
    - src/web/views/partials/partial-bandeau-alerte.ejs (polymorphe D-AL-05, inline support)
    - src/web/helpers/alerte-helpers.ts (formaterAlerteUrgence, iconeTypeAlerte, libelleTypeAlerte)
    - src/web/views/partials/sidebar-nav.ejs (entrée Tableau de bord en 1ère position)
  affects:
    - 07-06 (page /baux/indexations consomme partial-bandeau-alerte.ejs avec inline=true)
tech_stack:
  added: []
  patterns:
    - "Slice verticale HTTP : racine.ts étendu avec 8 locals de composition, pattern miroir impayes.ts"
    - "Helpers EJS purs injectés via preHandler global — aucun import infra dans alerte-helpers.ts"
    - "Partial unifié polymorphe : partial-bandeau-alerte.ejs reproduit à l'identique partial-bandeau-cfe-echeance.ejs (3 variantes tri-état WCAG)"
    - "BDD HTTP : creerApp + DB in-memory + ClockFixe + app.inject — harnais activation.steps.ts"
    - "Clock-driven strict : opts.clock.aujourdhui() unique source de date dans racine.ts"
key_files:
  created:
    - src/web/helpers/alerte-helpers.ts
    - src/web/views/partials/partial-bandeau-alerte.ejs
    - src/web/views/pages/dashboard/accueil.ejs
    - tests/bdd/features/dashboard-composition.feature
    - tests/bdd/features/dashboard-empty-state.feature
    - tests/bdd/features/dashboard-premier-lancement.feature
    - tests/bdd/step_definitions/dashboard.steps.ts
  modified:
    - src/web/routes/racine.ts (+composition route, -redirect /biens)
    - src/web/views/partials/sidebar-nav.ejs (+entrée Tableau de bord 1ère position)
    - src/main.ts (+import alerte-helpers, +preHandler injection, +wiring DI racinePlugin)
decisions:
  - "Helpers EJS (formaterAlerteUrgence/iconeTypeAlerte/libelleTypeAlerte) injectés en preHandler global main.ts — pattern miroir formatDate/formatMoney (Phase 1)"
  - "Fenêtre échéances loyer à venir : [today, today.add({months:2}).with({day:1}).subtract({days:1})] — mois courant + 1 mois (Claude's Discretion, D-DASH-02 §4)"
  - "partial-bandeau-cfe-echeance.ejs et partial-indexation-banner.ejs NON migrés : D-AL-05 migration optionnelle reportée à 07-06/LEARNINGS — les deux partials coexistent"
  - "Merge worktree base : le worktree était initialisé sur a3cc424 sans les commits 07-01..07-04 — merge de db4a569 (07-04 summary) pour récupérer les fichiers domaine + application"
  - "BDD empty-state : assertions sur les IDs ARIA (titre-alertes-critiques etc.) plutôt que les libellés de section — évite les faux positifs de la sidebar nav"
metrics:
  duration: "45 minutes"
  completed: "2026-06-12"
  tasks_completed: 3
  files_created: 7
  files_modified: 3
---

# Phase 7 Plan 05: Slice verticale dashboard `GET /` (DAS-01) — Summary

**One-liner:** Route `GET /` réécrite pour rendre `pages/dashboard/accueil.ejs` avec 4 sections empilées (alertes critiques, impayés, relances+IRL, échéances à venir) + état zen "Vous êtes à jour" ; partial unifié polymorphe `partial-bandeau-alerte.ejs` (3 variantes WCAG) + 3 helpers EJS purs + sidebar étendue + wiring DI `main.ts` ; 3 features BDD HTTP vertes (5 scénarios).

## Interfaces produites (pour 07-06)

### 8 locals passés à `accueil.ejs`

```typescript
{
  titre: 'Tableau de bord',
  navActive: 'dashboard',
  alertesCritiques: Alerte[],      // top 5, joursRestants <= 7, tri ASC
  alertesCritiquesTotal: number,
  impayes: Impaye[],               // top 5, estEnRetard=true, tri joursDeRetard DESC
  impayesTotal: number,
  actionsJour: Array<ActionRelance | ActionIrl>,  // top 5, relances DESC puis IRL ASC
  actionsJourTotal: number,
  echeancesAVenir: EcheanceLoyer[], // top 5, fenêtre [today, +2mois]
  echeancesAVenirTotal: number,
  etatGlobal: 'a_jour' | 'avec_alertes',
}
```

### Contrat props `partial-bandeau-alerte.ejs`

```ejs
<%# Props :
  - alerte : Alerte { type, joursRestants, dateEcheance, libelle, urlAction, source }
  - inline (optionnel, default false) : si true → sans bloc lien d'action
    (pour la table /baux/indexations plan 07-06)
%>
```

### 3 helpers EJS — `src/web/helpers/alerte-helpers.ts`

| Fonction | Signature | Usage |
|----------|-----------|-------|
| `formaterAlerteUrgence` | `(alerte: Alerte) => string` | Libellé WCAG ("Échéance dans N jours", etc.) |
| `iconeTypeAlerte` | `(type: TypeAlerte) => string` | Icône Unicode aria-hidden (€ % ⚠ ⏰) |
| `libelleTypeAlerte` | `(alerte: Alerte) => string` | Libellé type ("CFE 2026", "Révision IRL", "DPE", etc.) |

Injectés dans `reply.locals` via le hook `preHandler` global de `main.ts` — disponibles dans tous les partials EJS sans passage explicite par les routes.

### Fenêtre "mois courant + 1 mois" (retenue)

```typescript
const finFenetre = today.add({ months: 2 }).with({ day: 1 }).subtract({ days: 1 });
// Exemple : today=2026-06-12 → finFenetre=2026-07-31
```

Sémantique : toutes les échéances non payées dont `jourEcheanceAttendue ∈ [today, dernier_jour_mois_suivant]`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Helpers EJS + partial unifié + sidebar | e60965e | alerte-helpers.ts, partial-bandeau-alerte.ejs, sidebar-nav.ejs |
| 2 | Route GET / + vue accueil.ejs + main.ts | 36c9ade | racine.ts, accueil.ejs, main.ts |
| 3 | BDD features + step definitions | eed1338 | 3 features, dashboard.steps.ts |

## Verification Results

- `pnpm tsc --noEmit` : **0 erreur**
- `pnpm vitest run` : **1056 tests passent (0 fail)** — suite complète verte, aucune régression Phase 1-6
- `pnpm exec cucumber-js --tags "@phase7-dashboard"` : **5 scénarios verts** (composition 4 sections, top 5, tri ASC urgence, état zen, redirection 302 premier lancement)
- `dependency-cruiser` : **0 violation** — `src/web/helpers/alerte-helpers.ts` n'importe aucune infra, `racine.ts` importe uniquement domaine + application
- `partial-bandeau-cfe-echeance.ejs` : **NON modifié** (vérifié via git diff)

## Deviations from Plan

### Merge base worktree manquante

**[Rule 3 - Blocking]** Le worktree était initialisé sur `a3cc424` sans les commits 07-01..07-04. Les fichiers `src/application/dashboard/calculer-toutes-alertes.ts`, `src/domain/locatif/alerte-irl.ts`, etc. manquaient. Correction : merge de `db4a569` (07-04 summary commit, contient l'intégralité des plans 07-01..07-04).

### Symlink node_modules pour Cucumber

**[Rule 3 - Blocking]** Le worktree n'a pas de `node_modules` propres. Cucumber échouait avec `ERR_MODULE_NOT_FOUND`. Correction : `ln -s /path/main-repo/node_modules /path/worktree/gestion-locative/node_modules`.

### Features empty-state : assertions sur IDs ARIA plutôt que libellés

**[Rule 1 - Bug]** L'assertion `la page ne contient pas "Impayés"` échouait car "Impayés" apparaît dans le lien sidebar nav. Correction : assertions sur les IDs ARIA de section (`titre-impayes`, etc.) qui sont spécifiques aux sections du dashboard.

### NON migration des partials Phase 6/3

Décision explicite (D-AL-05) : `partial-bandeau-cfe-echeance.ejs` et `partial-indexation-banner.ejs` NON migrés vers le nouveau partial unifié. Les deux coexistent. Migration reportée à 07-06/LEARNINGS pour que le plan 07-06 ait le contexte complet. Noté dans le SUMMARY conformément aux instructions du plan.

## Known Stubs

Aucun stub bloquant. La vue `accueil.ejs` consomme des données réelles depuis les repositories. Les sections affichent les empty states inline si vides (pas de données fictives).

## Threat Flags

Aucune nouvelle surface hors du registre `<threat_model>` du plan. T-07-05-01..05 couverts :
- `<%= %>` utilisé pour toutes les données dynamiques (jamais `<%-` sur données) ✓
- `rel="noopener noreferrer"` présent sur le lien externe CFE ✓
- Pas d'entrée utilisateur non trustée sur `GET /` ✓

## Self-Check: PASSED

- `src/web/helpers/alerte-helpers.ts` : FOUND
- `src/web/views/partials/partial-bandeau-alerte.ejs` : FOUND
- `src/web/views/pages/dashboard/accueil.ejs` : FOUND
- `src/web/routes/racine.ts` : MODIFIED (confirmed)
- `src/web/views/partials/sidebar-nav.ejs` : MODIFIED (confirmed)
- `src/main.ts` : MODIFIED (confirmed)
- `tests/bdd/features/dashboard-composition.feature` : FOUND
- `tests/bdd/features/dashboard-empty-state.feature` : FOUND
- `tests/bdd/features/dashboard-premier-lancement.feature` : FOUND
- `tests/bdd/step_definitions/dashboard.steps.ts` : FOUND
- Commits e60965e, 36c9ade, eed1338 : VERIFIED in git log
