---
phase: "02"
plan: "01"
plan_id: "02-01"
subsystem: "identite + locatif + infrastructure + web"
tags: ["bailleur", "clock", "bail-extension", "D-74", "sqlite", "walking-enabler"]
dependency_graph:
  requires: []
  provides:
    - "Port Clock + ClockSysteme + ClockFixe"
    - "Agrégat Bailleur singleton"
    - "BailleurRepository + BailleurRepositorySqlite"
    - "Bail.activer() + Bail.desactiver() + actifDepuis + jourEcheance"
    - "Migration 0002 (bailleur + ALTER bail)"
    - "Port ActiviteBailDetector + adapter SQLite v0"
    - "Use cases: creerOuMajBailleur, supprimerBail (D-74), desactiverBail"
    - "Route GET/POST /bailleur"
    - "Routes POST /baux/:id/desactiver, /baux/:id/supprimer (D-74)"
    - "Cucumber World Phase 2 réutilisable"
  affects:
    - "baux.ts (plugin opts étendus)"
    - "detail.ejs (boutons conditionnels)"
    - "main.ts (creerApp opts étendus)"
tech_stack:
  added:
    - "Temporal.PlainDate (brand new usage dans Bail.activer)"
    - "ActiviteBailDetector (port domaine)"
  patterns:
    - "Singleton DDD: UNIQUE(singleton_marker) + double barrière use case"
    - "Multi-file migration: appliquerToutesMigrations lit *.sql triés alphabétiquement"
    - "Clock injection: creerApp(db, { clock?, activiteBailDetector? })"
    - "Tagged Cucumber Before/After: not @bailleur and not @D-74 pour isolation"
    - "Walking-enabler adapter v0: retourne false, étendu progressivement plans 02-02 à 02-04"
key_files:
  created:
    - "migrations/0002_phase2_bailleur_bail_ext.sql"
    - "src/domain/_shared/clock.ts"
    - "src/domain/identite/bailleur.ts"
    - "src/domain/identite/bailleur-repository.ts"
    - "src/domain/identite/erreurs.ts"
    - "src/domain/locatif/activite-bail-detector.ts"
    - "src/infrastructure/repositories/bailleur-repository-sqlite.ts"
    - "src/infrastructure/repositories/activite-bail-detector-sqlite.ts"
    - "src/application/identite/creer-ou-maj-bailleur.ts"
    - "src/application/locatif/desactiver-bail.ts"
    - "src/web/schemas/bailleur-schemas.ts"
    - "src/web/routes/bailleur.ts"
    - "src/web/views/pages/bailleur/profil.ejs"
    - "src/web/views/partials/banniere-warning.ejs"
    - "tests/_builders/identite.ts"
    - "tests/_world/monde-phase2.ts"
    - "tests/unit/_shared/clock.test.ts"
    - "tests/unit/identite/bailleur.test.ts"
    - "tests/unit/locatif/supprimer-bail.test.ts"
    - "tests/unit/locatif/desactiver-bail.test.ts"
    - "tests/integration/repositories/bailleur-repository-sqlite.test.ts"
    - "tests/bdd/features/bailleur.feature"
    - "tests/bdd/features/quittancement.feature"
    - "tests/bdd/step_definitions/bailleur.steps.ts"
    - "tests/bdd/step_definitions/quittancement.steps.ts"
  modified:
    - "src/domain/_shared/identifiants.ts (BailleurId + 4 brand types futurs)"
    - "src/domain/locatif/bail.ts (actifDepuis, jourEcheance, activer, desactiver)"
    - "src/infrastructure/db/kysely-types.ts (BailleurTable, BailTable extended)"
    - "src/infrastructure/db/database.ts (appliquerToutesMigrations multi-fichiers)"
    - "src/infrastructure/repositories/bail-repository-sqlite.ts (actif_depuis, jour_echeance)"
    - "src/application/locatif/supprimer-bail.ts (D-74: inject ActiviteBailDetector)"
    - "src/web/routes/baux.ts (plugin opts, GET /baux/:id, POST supprimer D-74, POST desactiver)"
    - "src/web/routes/wizard.ts (Session.banniereWarning déclaré)"
    - "src/web/views/pages/baux/detail.ejs (boutons conditionnels D-74)"
    - "src/web/views/partials/sidebar-nav.ejs (lien Profil bailleur)"
    - "src/main.ts (creerApp opts: clock, activiteBailDetector)"
    - "tests/_builders/locatif.ts (suppression imports inutilisés)"
    - "tests/bdd/step_definitions/activation.steps.ts (Before/After filtrés not @bailleur and not @D-74)"
    - "tests/unit/locatif/bail.test.ts (extension activer tests, suppression imports inutilisés)"
    - "tests/integration/repositories/bail-repository-sqlite.test.ts (migrations multi-fichiers)"
    - "tests/integration/repositories/bien-repository-sqlite.test.ts (idem)"
    - "tests/integration/repositories/locataire-repository-sqlite.test.ts (idem)"
decisions:
  - "DP-07 RÉSOLU: Bailleur dans src/domain/identite/ (nouveau BC)"
  - "DP-08 RÉSOLU: compteur quittance en table meta clé compteur_quittance_AAAA (plan 02-04)"
  - "DP-09 RÉSOLU: slug PDF quittance-{numero}-{periode}-{slug}.pdf (plan 02-04)"
  - "DP-10 RÉSOLU: Money.multiplyByFraction(num, den, mode='banker') (plan 02-02)"
  - "Cucumber isolation: tagged Before/After par feature pour éviter double-init"
  - "Walking-enabler adapter v0: retourne false — étendu progressivement sans recompiler les plans précédents"
metrics:
  duration: "~20 minutes (session précédente + continuation)"
  completed_date: "2026-05-14"
  task_count: 4
  file_count: 43
---

# Phase 02 Plan 01: Walking Enabler Phase 2 — Profil Bailleur + D-74 Summary

**One-liner:** Page /bailleur fonctionnelle (singleton Bailleur, upsert use case, bannière session) + port Clock + Bail.activer/desactiver + ActiviteBailDetector adapter v0 + D-74 suppression refusée si activité.

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 (RED) | `8566032` | `test(02-01): tests rouges bailleur + clock + extension bail (Wave 0)` |
| Task 2 (GREEN) | `050b6d9` | `feat(02-01): clock + bailleur + extension bail` |
| Task 3 (GREEN) | `dad1d43` | `feat(02-01): page profil bailleur + sidebar + use case upsert` |
| Task 4 (GREEN) | `d08e787` | `feat(02-01): D-74 — port ActiviteBailDetector + suppression refusée si activité + désactiver` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration multi-fichiers: tests existants utilisaient appliquerMigrationsBrutes avec chemin absolu 0001_init.sql**
- **Found during:** Task 2
- **Issue:** Après ajout de `0002_phase2_bailleur_bail_ext.sql`, les tables `bail` utilisent `actif_depuis` et `jour_echeance`. Les tests d'intégration Phase 1 (bail-repository-sqlite.test.ts, bien-repository-sqlite.test.ts, locataire-repository-sqlite.test.ts) et la BDD activation.steps.ts ne chargeaient que 0001_init.sql, faisant échouer les INSERT bail avec "table bail has no column named actif_depuis".
- **Fix:** Mise à jour de tous les tests existants pour utiliser `appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR)`.
- **Files modified:** `tests/integration/repositories/bail-repository-sqlite.test.ts`, `tests/integration/repositories/bien-repository-sqlite.test.ts`, `tests/integration/repositories/locataire-repository-sqlite.test.ts`, `tests/bdd/step_definitions/activation.steps.ts`
- **Commit:** `050b6d9`

**2. [Rule 1 - Bug] Cucumber ambiguity: double Before hook + duplicate step definitions**
- **Found during:** Task 3
- **Issue:** `activation.steps.ts` avait un Before hook global (sans filtre de tag) qui s'exécutait pour TOUS les scénarios incluant @bailleur et @D-74. De plus, les step definitions "il est redirigé vers {string}" et "la page affiche {string}" étaient dupliquées dans bailleur.steps.ts, causant "Multiple step definitions match".
- **Fix:** (1) `activation.steps.ts` Before/After filtrés avec `not @bailleur and not @D-74`. (2) Suppression des step definitions dupliquées de bailleur.steps.ts (les globales d'activation.steps.ts suffisent). (3) `monde-phase2.ts` réécrit pour exporter des helpers sans hooks globaux.
- **Files modified:** `tests/bdd/step_definitions/activation.steps.ts`, `tests/bdd/step_definitions/bailleur.steps.ts`, `tests/_world/monde-phase2.ts`
- **Commit:** `dad1d43`

**3. [Rule 2 - Missing Critical] Imports inutilisés créant des erreurs lint (@typescript-eslint/no-unused-vars)**
- **Found during:** Task 3
- **Issue:** Lors de la création des tests rouges (Task 1), des imports avaient été ajoutés de manière préventive (Bail, IRL, unMontantValide, unIrlValide, nouveauBailId, nouveauBienId, nouveauLocataireId, fs, BailId) qui n'étaient pas utilisés dans les tests finaux.
- **Fix:** Suppression des imports inutilisés dans tests/unit/locatif/bail.test.ts, tests/_world/monde-phase2.ts, tests/integration/repositories/bail-repository-sqlite.test.ts, tests/_builders/locatif.ts.
- **Files modified:** 4 fichiers de test
- **Commit:** `dad1d43`

## TDD Gate Compliance

- RED gate (`test(02-01)` commit): `8566032` — CONFORME
- GREEN gate (`feat(02-01)` commits): `050b6d9`, `dad1d43`, `d08e787` — CONFORME

## Patterns Établis

### Clock injection
`creerApp(db, { clock?, activiteBailDetector? })` — opt-in pour tests déterministes et stubs BDD.

### Singleton DDD (Bailleur)
Double barrière :
1. DB: `UNIQUE(singleton_marker)` sur la table bailleur.
2. Use case: `creerOuMajBailleur` appelle `trouver()` avant `enregistrer()` — upsert sémantique.

### Multi-file migrations
`appliquerToutesMigrations(db, sqlite, dossierMigrations)` lit `fs.readdirSync(dir).filter(.sql).sort()` et applique chaque fichier idempotent via clé `migration_{filename}` dans la table meta. Rétro-compat : clé `migrations_appliquees=0001` pour 0001_init.sql.

### Cucumber isolation par tag
- `activation.steps.ts`: `Before({ tags: 'not @bailleur and not @D-74' })`
- `bailleur.steps.ts`: `Before({ tags: '@bailleur' })`
- `quittancement.steps.ts`: `Before({ tags: '@D-74' })`

### Walking-enabler adapter v0
`ActiviteBailDetectorSqlite.aDeLActivite()` retourne `false` en 02-01. Plans 02-02 à 02-04 ajouteront les sous-requêtes `count(echeance_loyer)`, `count(encaissement)`, `count(quittance)` en OR logique.

## Dépendances pour plans suivants

- `EcheanceLoyerId`, `EncaissementId`, `QuittanceId`, `RelanceId` déjà exportés dans `identifiants.ts` (anti-thrash).
- `Clock` injecté dans `creerApp` — disponible pour plans 02-02..02-06 (génération échéances déterministe).
- `Bail.activer(actifDepuis, jourEcheance)` disponible pour plan 02-02 (génération EcheanceLoyer).
- `ActiviteBailDetector` port prêt — adapter étendu progressivement par plans suivants.
- `MondePhase2` World Cucumber réutilisable (exports `initialiserMondePhase2`, `fermerMondePhase2`).

## Known Stubs

Aucun stub bloquant les objectifs de ce plan.

`ActiviteBailDetectorSqlite` retourne `false` par construction en 02-01 — c'est intentionnel (walking-enabler). Plan 02-02 étend avec `count(echeance_loyer)`.

## Threat Flags

Aucune nouvelle surface de sécurité non prévue dans le threat model du plan.

## Self-Check: PASSED

Fichiers créés vérifiés:
- `src/domain/locatif/activite-bail-detector.ts` — EXISTS
- `src/infrastructure/repositories/activite-bail-detector-sqlite.ts` — EXISTS
- `src/application/locatif/desactiver-bail.ts` — EXISTS
- `src/application/locatif/supprimer-bail.ts` — MODIFIED (EXISTS)
- `src/web/views/partials/banniere-warning.ejs` — EXISTS
- `tests/bdd/features/quittancement.feature` — EXISTS
- `tests/bdd/step_definitions/quittancement.steps.ts` — EXISTS

Commits vérifiés:
- `8566032` — EXISTS (test(02-01) RED)
- `050b6d9` — EXISTS (feat(02-01) GREEN Task 2)
- `dad1d43` — EXISTS (feat(02-01) GREEN Task 3)
- `d08e787` — EXISTS (feat(02-01) GREEN Task 4)
