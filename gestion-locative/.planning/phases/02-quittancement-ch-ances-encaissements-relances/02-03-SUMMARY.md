---
phase: "02"
plan: "03"
plan_id: "02-03"
subsystem: encaissements
tags:
  - ENC-03
  - D-57
  - D-58
  - D-59
  - D-60
  - D-61
  - D-73
  - soft-delete
  - compensateur
  - recalcul-statut
  - modifier-bail-actif
dependency_graph:
  requires:
    - "02-01 (Clock, activerBail, genererEcheances)"
    - "02-02 (EcheanceLoyer, ActiviteBailDetector, migration 0003)"
  provides:
    - "creerEncaissement: cross-aggregate (echeance non annulée, bail actif)"
    - "annulerEncaissement: soft-delete + recalcul statut"
    - "recalculerStatutEcheance: shared internal use case"
    - "modifierBailActif: D-73 preview + transaction suppression/régénération"
    - "routes /encaissements CRUD + /baux/:id/modifier-actif"
    - "Money.compensateur + estNegatif + negation"
    - "migration 0004: table encaissement (montant_centimes signed)"
  affects:
    - "02-04: EcheanceLoyer.statut === 'payee' → condition Quittance"
    - "02-05: listerNonPayees() → Impayés dashboard"
tech_stack:
  added:
    - "EncaissementRepositorySqlite (Kysely, signed montant_centimes)"
    - "genererEcheancesPour (extracted + exported helper)"
    - "EcheanceLoyerRepository.supprimerLot (hard-delete D-73)"
  patterns:
    - "soft-delete: annule_le + raison_annulation (D-60)"
    - "compensateur: Money à centimes négatifs via constructeur privé bypass (D-60)"
    - "recalcul statut idempotent: sommePaieeParEcheance → en_attente/partiellement_payee/payee/surPaiement"
    - "warning-live.ejs partial: aria-live polite pour surpaiement + D-61 warnings"
    - "double-confirm UX: preview counters → dialog natif avec hidden confirmation=oui (D-73)"
    - "cross-aggregate use case: echeance.annuleLe null + bail.actifDepuis not null"
key_files:
  created:
    - "migrations/0004_phase2_encaissement.sql"
    - "src/domain/encaissements/encaissement.ts"
    - "src/domain/encaissements/encaissement-repository.ts"
    - "src/application/encaissements/recalculer-statut-echeance.ts"
    - "src/application/encaissements/creer-encaissement.ts"
    - "src/application/encaissements/annuler-encaissement.ts"
    - "src/application/encaissements/lister-encaissements.ts"
    - "src/application/locatif/modifier-bail-actif.ts"
    - "src/infrastructure/repositories/encaissement-repository-sqlite.ts"
    - "src/web/schemas/encaissement-schemas.ts"
    - "src/web/routes/encaissements.ts"
    - "src/web/views/partials/warning-live.ejs"
    - "src/web/views/pages/encaissements/formulaire.ejs"
    - "src/web/views/pages/encaissements/liste.ejs"
    - "src/web/views/pages/encaissements/fiche.ejs"
    - "src/web/views/pages/baux/modifier.ejs"
    - "tests/bdd/features/encaissements.feature"
    - "tests/bdd/features/modifier-bail-actif.feature"
    - "tests/unit/encaissements/encaissement.test.ts"
    - "tests/unit/encaissements/creer-encaissement.test.ts"
    - "tests/unit/encaissements/annuler-encaissement.test.ts"
    - "tests/unit/encaissements/recalculer-statut-echeance.test.ts"
    - "tests/integration/repositories/encaissement-repository-sqlite.test.ts"
    - "tests/unit/locatif/modifier-bail-actif.test.ts"
  modified:
    - "src/domain/_shared/money.ts (compensateur + estNegatif + negation)"
    - "src/domain/encaissements/erreurs.ts (EncaissementIntrouvable + EcheanceAnnulee + BailNonActif)"
    - "src/domain/encaissements/echeance-loyer-repository.ts (+ supprimerLot)"
    - "src/infrastructure/db/kysely-types.ts (+ EncaissementTable)"
    - "src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts (+ supprimerLot)"
    - "src/application/encaissements/activer-bail.ts (genererEcheances → export genererEcheancesPour)"
    - "src/web/routes/baux.ts (D-73 routes + redirect bail actif)"
    - "src/web/routes/echeances.ts (banniereSuccess session)"
    - "src/web/views/pages/echeances/liste.ejs (warning-live, Saisir encaissement, Générer quittance)"
    - "src/web/views/partials/sidebar-nav.ejs (Encaissements group dépliable)"
    - "src/main.ts (EncaissementRepositorySqlite + encaissementsPlugin)"
    - "tests/bdd/features/quittancement.feature (split vers encaissements.feature)"
    - "tests/bdd/step_definitions/quittancement.steps.ts (D-73 steps + dedup fix)"
    - "tests/_builders/encaissements.ts (unEncaissementValide)"
decisions:
  - "Split quittancement.feature → encaissements.feature (Cucumber ne supporte pas 2 Feature: par fichier)"
  - "Step regex pour /encaissements/nouveau et /baux/:id/modifier-actif (Cucumber expression interprète / comme alternation)"
  - "Duplicate Given/When step supprimé (le Given suffit pour les deux contextes)"
  - "echeances route: lecture banniereSuccess session ajoutée (Rule 2 — missing pour D-73 redirect)"
  - "D-73 régénération: slice depuis la fin des écheances générées (les futures sont les dernières)"
  - "modifier.ejs: dialog JS sync les valeurs du formulaire principal dans les hidden inputs de confirm"
metrics:
  duration: "~120 minutes"
  completed_date: "2026-05-14"
  tasks_completed: 4
  files_created: 24
  files_modified: 14
  tests_added: 161
  bdd_scenarios_added: 6
---

# Phase 02 Plan 03: ENC-03 Saisie Encaissement + D-73 Modification Bail Actif Summary

**One-liner:** Vertical slice ENC-03 complet — soft-delete compensateur Money négatif, recalcul statut idempotent, saisie/annulation encaissement avec warnings D-61, + D-73 modification bail actif avec preview compteurs et double confirmation UX.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 — Tests rouges | `f925241` | `test(02-03): tests rouges Money.compensateur + Encaissement + ENC-03 (Wave 0)` |
| 2 — Domain + use cases | `c670341` | `feat(02-03): encaissement domain + use cases + soft-delete + compensateur` |
| 3 — Routes + views + BDD ENC-03 | `01cbfdc` | `feat(02-03): saisie + annulation Encaissement + warnings + page liste/fiche (ENC-03)` |
| 4 — D-73 modifierBailActif | `95bd437` | `feat(02-03): D-73 — modifierBailActif use case + route /baux/:id/modifier-actif + view modale double confirmation` |

## Patterns Établis

### Soft-delete + Compensateur (D-60)
`Encaissement.annuler()` retourne un nouvel agrégat avec `annuleLe + raisonAnnulation` set. Jamais de DELETE. Pour corriger un montant antérieur : créer un `Encaissement` compensateur avec `Money.compensateur(positif)` — centimes négatifs via constructeur privé (bypass `fromCentimes` qui refuse les négatifs). L'audit trail est intégralement préservé.

### Recalcul Statut Idempotent
`recalculerStatutEcheance()` est appelé après chaque mutation (creer / annuler). Algorithme: `sommePaieeParEcheance` (SUM WHERE annule_le IS NULL) → seuils → `mettreAJourStatut`. Résultat cohérent même si appelé plusieurs fois.

### Warning-live Partial
`warning-live.ejs` rend un `<aside role="status" aria-live="polite">` conditionnel. Utilisé pour les surpaiements (D-59) et les warnings D-61 (date antérieure ou trop avancée). Réutilisable dans toutes les vues futures.

### Double-Confirm UX (D-73)
Étape 1: bouton "Prévisualiser l'impact" soumet le formulaire sans `confirmation=oui` → re-render avec compteurs recalculés. Étape 2: bouton "Confirmer et appliquer" ouvre un `<dialog>` natif (pas de JS externe) avec hidden `confirmation=oui`. Le JS synchronise les valeurs courantes du formulaire dans les hidden inputs du dialog avant d'ouvrir.

### Use Case Cross-Aggregate (Bail + EcheanceLoyer + Encaissement)
`creerEncaissement` valide: `echeance.annuleLe === null` ET `bail.actifDepuis !== null`. Même pattern dans `modifierBailActif`: itère les échéances, pour chacune vérifie `listerParEcheance({inclureAnnules: false}).length > 0` pour déterminer si préserver ou régénérer.

## Vérifications Finales

- `pnpm tsc --noEmit` : 0 erreur
- `pnpm lint:deps` : 0 violation (domaine pur — pas d'import infra dans domain/application)
- `pnpm test` : 161 tests VERTS (28 fichiers)
- `pnpm test:bdd` : 19 scenarios VERTS (incluant 5 @enc-03 + 1 @D-73)

## Déviations du Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Double Feature: dans quittancement.feature**
- **Found during:** Task 3 BDD
- **Issue:** Cucumber interdit 2 blocs `Feature:` dans un seul fichier `.feature`. Le fichier issu de Task 1 avait D-74 et ENC-03 dans le même fichier.
- **Fix:** Split en deux fichiers : `quittancement.feature` (D-74 conservé) + `encaissements.feature` (ENC-03 nouveau).
- **Files modified:** `tests/bdd/features/quittancement.feature`, `tests/bdd/features/encaissements.feature`
- **Commit:** `01cbfdc`

**2. [Rule 1 - Bug] Step ambiguity: Given/When dupliqué**
- **Found during:** Task 3 BDD
- **Issue:** `Given('le bailleur saisit un encaissement...')` + `When('le bailleur saisit un encaissement...')` identiques → Cucumber "Multiple step definitions match".
- **Fix:** Supprimé le `When` redondant. Le `Given` couvre les deux contextes (Given/And/When utilisent la même définition).
- **Files modified:** `tests/bdd/step_definitions/quittancement.steps.ts`
- **Commit:** `01cbfdc`

**3. [Rule 1 - Bug] Regex steps pour URLs avec /**
- **Found during:** Task 3 BDD
- **Issue:** Cucumber Expression interprète `/` comme alternation → "Alternative may not be empty".
- **Fix:** Remplacement par regex `/^le bailleur navigue vers GET \/encaissements\/nouveau$/` pour les steps contenant des URLs.
- **Files modified:** `tests/bdd/step_definitions/quittancement.steps.ts`
- **Commit:** `01cbfdc`

**4. [Rule 2 - Missing] banniereSuccess manquante dans GET /baux/:id/echeances**
- **Found during:** Task 4 BDD D-73
- **Issue:** La route `GET /baux/:id/echeances` ne lisait pas la session banniereSuccess → le redirect post-modification ne montrait pas la bannière de succès.
- **Fix:** Ajout de la lecture + vidage de `req.session.banniereSuccess` et `banniereWarning` dans la route, passés à la vue.
- **Files modified:** `src/web/routes/echeances.ts`
- **Commit:** `95bd437`

**5. [Rule 1 - Bug] EcheanceLoyerRepository stubs manquaient supprimerLot**
- **Found during:** Task 4 TypeScript check
- **Issue:** L'ajout de `supprimerLot` au port a cassé les stubs dans `activer-bail.test.ts`.
- **Fix:** Ajout de `supprimerLot: async () => {}` aux stubs existants.
- **Files modified:** `tests/unit/encaissements/activer-bail.test.ts`
- **Commit:** `95bd437`

## Known Stubs

Aucun stub bloquant l'objectif du plan. Les boutons "Générer quittance" dans `echeances/liste.ejs` pointent vers `/quittances/nouveau?echeance=...` qui retourne 404 jusqu'au plan 02-04 — comportement intentionnel et documenté dans la spec.

## Dépendances pour Plans Suivants

- **02-04 Quittances:** `EcheanceLoyer.statut === 'payee'` est la condition d'émission. La route `/quittances/nouveau?echeance=:id` est déjà liée depuis `echeances/liste.ejs`.
- **02-05 Impayés:** `echeanceLoyerRepo.listerNonPayees()` est déjà implémenté et utilisé dans `GET /encaissements/nouveau`. Le plan 02-05 pourra l'utiliser directement pour le dashboard impayés.
- **Rapport fiscal:** `listerEncaissements({inclureAnnules: false})` + `sommePaieeParEcheance` sont les deux requêtes clés pour les déclarations LMNP.

## Self-Check: PASSED

Files exist:
- `src/application/locatif/modifier-bail-actif.ts` ✓
- `src/web/views/pages/baux/modifier.ejs` ✓
- `src/web/views/pages/encaissements/formulaire.ejs` ✓
- `src/web/views/partials/warning-live.ejs` ✓
- `tests/bdd/features/encaissements.feature` ✓
- `tests/bdd/features/modifier-bail-actif.feature` ✓

Commits exist:
- `f925241` ✓
- `c670341` ✓
- `01cbfdc` ✓
- `95bd437` ✓
