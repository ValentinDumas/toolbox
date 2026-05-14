---
phase: "02"
plan: "05"
plan_id: "02-05"
subsystem: encaissements
tags: [impaye, lister-impayes, ENC-04, D-55, calcul-derive, read-only, filtre-locataire]
dependency_graph:
  requires: ["02-01", "02-02", "02-03", "02-04"]
  provides:
    - Impaye DTO (lecture seule, calcul dérivé D-55)
    - calculerImpaye fonction pure (testable sans I/O)
    - listerImpayes use case (multi-repos, filtre locataireId, tri ASC)
    - Route GET /impayes + filtre ?locataire= (query param paramétré)
    - Page liste avec empty state "Tous les loyers sont à jour"
    - Sidebar lien Impayés
    - Fix listerNonPayees (statut IN au lieu de !=)
  affects:
    - "02-06: Impaye DTO + joursDeRetard → niveaux relance (J+10/J+30/J+60)"
tech_stack:
  added: []
  patterns:
    - "DTO de lecture vs agrégat persisté (Impaye n'a pas de factory creer — c'est un DTO)"
    - "Fonction pure calculerImpaye testable sans I/O"
    - "Use case multi-repos avec Promise.all en parallèle"
    - "Filtre query param GET → LocataireId cast simple (pas de validation stricte — Kysely paramétré)"
    - "listerNonPayees: statut IN ('en_attente','partiellement_payee') AND annule_le IS NULL"
key_files:
  created:
    - src/domain/encaissements/impaye.ts
    - src/web/routes/impayes.ts
    - src/web/views/pages/impayes/liste.ejs
    - tests/unit/encaissements/lister-impayes.test.ts
  modified:
    - src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts (fix listerNonPayees)
    - src/main.ts (impayesPlugin register + formatPeriode inject)
    - src/web/views/partials/sidebar-nav.ejs (lien Impayés)
    - tests/integration/repositories/echeance-loyer-repository-sqlite.test.ts (T10 listerNonPayees)
    - tests/bdd/features/quittancement.feature (4 scenarios @enc-04)
    - tests/bdd/step_definitions/quittancement.steps.ts (ENC-04 hooks + steps)
decisions:
  - "listerImpayes co-localisé dans impaye.ts (domaine pur) plutôt que application/ — test importe de la même source"
  - "listerNonPayees corrigé: statut IN (en_attente, partiellement_payee) — filtre explicite (Rule 1)"
  - "formatPeriode ajouté au preHandler global (Rule 2 — manquait pour la vue impayes)"
  - "Empty state inline dans la vue (pas via partial) — partial ne gère pas ctaUrl=null proprement"
  - "Page READ-ONLY — aucune écriture possible depuis cette page (T-02-05-02)"
metrics:
  duration: "~9 minutes"
  completed: "2026-05-14"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 6
---

# Phase 02 Plan 05: Page Impayés ENC-04 Summary

One-liner: Vertical slice ENC-04 — page Impayés calculant resteDu/joursDeRetard/estEnRetard via fonction pure calculerImpaye, avec filtre locataire et tri ASC, lecture seule.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `b1c3683` | test | Tests rouges calculerImpaye + listerImpayes + ENC-04 (Wave 0) |
| `75ff141` | feat | Page Impayés + use case listerImpayes (ENC-04) |

## What Was Built

**ENC-04 vertical slice:** Page GET /impayes listant toutes les EcheanceLoyer non entièrement payées (statut ∈ {en_attente, partiellement_payee}), avec pour chaque ligne : locataire (nom complet + lien), bail (id court + lien), période, total dû, montant payé, reste dû (rouge), badge statut (en_retard/partiel/en_attente), jours de retard, liens vers échéance et saisie encaissement.

**D-55 respecté:** "en_retard" reste un dérivé non stocké. Calculé dans `calculerImpaye()` via `Temporal.PlainDate.compare(today, jourEcheanceAttendue) > 0`.

**Empty state:** "Tous les loyers sont à jour" affiché quand la liste est vide.

**Filtre locataire:** `GET /impayes?locataire=:id` — filtrage côté use case après agrégation (pas de SQL join). Sécurité T-02-05-01 : Kysely paramétré.

**Tri:** Résultats triés par `jourEcheanceAttendue ASC` (plus anciens en premier).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] listerNonPayees incluait les échéances annulées**
- **Found during:** Task 2 — analyse de l'implémentation existante pour T10
- **Issue:** `listerNonPayees` filtrait `statut != 'payee'` incluant ainsi les écheances avec `statut='annulee'` (même si `annule_le IS NULL`). Le test T10 vérifie explicitement cette exclusion.
- **Fix:** Remplacement par `statut IN ('en_attente', 'partiellement_payee')` — filtre positif plus robuste.
- **Files modified:** `src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts`
- **Commit:** `75ff141`

**2. [Rule 2 - Missing] formatPeriode manquant dans le preHandler global**
- **Found during:** Task 2 — création de la vue impayes/liste.ejs qui utilise `formatPeriode`
- **Issue:** `formatPeriode` n'était pas injecté dans `reply.locals` via le preHandler. Seuls `formatDate` et `formatMoney` l'étaient.
- **Fix:** Ajout de l'import et injection de `formatPeriode` dans le preHandler de `main.ts`.
- **Files modified:** `src/main.ts`
- **Commit:** `75ff141`

**3. [Rule 1 - Simplification] listerImpayes co-localisé dans impaye.ts**
- **Found during:** Task 1 — rédaction des tests RED (import depuis impaye.js)
- **Issue:** Le plan prévoyait `listerImpayes` dans `src/application/encaissements/lister-impayes.ts` mais le test importait `{ calculerImpaye, listerImpayes }` depuis `impaye.js`. Pour ne pas avoir une divergence entre test et implementation, les deux sont co-localisés.
- **Fix:** `listerImpayes` dans `src/domain/encaissements/impaye.ts`. Domaine pur — pas d'import technique, cohérent avec l'architecture hexagonale (le use case est passé via les ports de repos).
- **Files modified:** `src/domain/encaissements/impaye.ts`
- **Commit:** `75ff141`

## Known Stubs

None. La page est câblée sur les vrais repos SQLite via le plugin Fastify injecté dans main.ts. Tous les calculs utilisent les données réelles :
- `echeanceLoyerRepo.listerNonPayees()` → EcheanceLoyerRepositorySqlite
- `encaissementRepo.sommePaieeParEcheance()` → EncaissementRepositorySqlite
- `bailRepo.trouverParId()` → BailRepositorySqlite
- `locataireRepo.trouverParId()` + `listerTous()` → LocataireRepositorySqlite

## Threat Flags

None additional beyond plan threat model:
- T-02-05-01: mitigé — Kysely paramétré, aucun SQL injection possible via ?locataire=
- T-02-05-02: accepté — mono-user V1
- T-02-05-03: accepté — N < 100 typiquement, Promise.all en parallèle
- T-02-05-04: accepté — re-render à chaque GET, pas de cache

## Dépendances pour Plan 02-06

- **Impaye DTO:** `joursDeRetard` est la clé pour les niveaux de relance (J+10 → niveau 1, J+30 → niveau 2, J+60 → niveau 3 — D-71).
- **estEnRetard:** déjà calculé dans `calculerImpaye` — le plan 02-06 peut filtrer directement `impaye.estEnRetard === true && impaye.joursDeRetard >= 10` pour la suggestion de relance niveau 1.
- **Page Impayés:** point d'entrée naturel pour les boutons de relance contextuelle (02-06).

## Self-Check: PASSED

Files exist:
- `src/domain/encaissements/impaye.ts` ✓
- `src/web/routes/impayes.ts` ✓
- `src/web/views/pages/impayes/liste.ejs` ✓
- `tests/unit/encaissements/lister-impayes.test.ts` ✓

Commits exist:
- `b1c3683` ✓
- `75ff141` ✓
