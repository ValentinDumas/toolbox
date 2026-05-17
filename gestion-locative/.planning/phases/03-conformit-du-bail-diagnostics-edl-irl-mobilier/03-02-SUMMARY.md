---
phase: "03"
plan: "02"
subsystem: locatif
tags: [edl, inventaire-item, mobilier, etat-des-lieux, loc-03, loc-06, tdd, bdd]
dependency-graph:
  requires: [03-01]
  provides: [EtatDesLieux, InventaireItem, comparerInventaires, Bail.mobilier, EDL-routes]
  affects: [bail.ts, main.ts, baux-routes]
tech-stack:
  added:
    - InventaireItem VO (domain/_shared/inventaire-item.ts) — 12 types décret 2015-981 + invariants
    - EtatDesLieux aggregate (domain/locatif/etat-des-lieux.ts) — soft-delete annuler() + copy-on-write
    - EtatDesLieuxRepository port + SQLite adapter avec UNIQUE partial index (annule_le IS NULL)
    - comparerInventaires domain service (WARNING_ITEM_DISPARU + WARNING_ITEM_DEGRADE)
    - enregistrerEDLEntree/Sortie use cases (D-84, D-85, D-89, D-98, D-101)
    - listerEDL use case (parallel lookup)
    - Migration 0008 — etat_des_lieux table + ALTER TABLE bail ADD COLUMN mobilier
    - Routes /baux/:id/edl/* (etats-des-lieux.ts plugin — 8 routes)
    - Schemas Zod edl-schemas.ts + bail mobilier field
    - EJS views pages/baux/edl + 3 partials (partial-edl-form, partial-inventaire-display, partial-inventaire-warnings)
    - helpers format-etat-item.ts + format-type-item-inventaire.ts
  patterns:
    - TDD outside-in RED→GREEN (2 commits)
    - Soft-delete pattern (annuleLe + raisonAnnulation) — Encaissement Phase 2
    - JSON inline storage pour inventaire (Cautionnement Phase 1)
    - UNIQUE partial index WHERE annule_le IS NULL (D-89 double barrier)
    - Copy-on-write immutable domain (EtatDesLieux.annuler, Bail.modifier)
    - mobilierVersInventaireItems : etat='bon' par défaut pour items présents (checklist ≠ EDL)
key-files:
  created:
    - src/domain/_shared/inventaire-item.ts
    - src/domain/locatif/etat-des-lieux.ts
    - src/domain/locatif/etat-des-lieux-repository.ts
    - src/domain/locatif/comparer-inventaires.ts
    - src/infrastructure/repositories/etat-des-lieux-repository-sqlite.ts
    - src/application/locatif/enregistrer-edl-entree.ts
    - src/application/locatif/enregistrer-edl-sortie.ts
    - src/application/locatif/lister-edl.ts
    - src/helpers/format-etat-item.ts
    - src/helpers/format-type-item-inventaire.ts
    - src/web/schemas/edl-schemas.ts
    - src/web/routes/etats-des-lieux.ts
    - src/web/views/pages/baux/edl/formulaire.ejs
    - src/web/views/pages/baux/edl/entree.ejs
    - src/web/views/pages/baux/edl/sortie.ejs
    - src/web/views/partials/partial-edl-form.ejs
    - src/web/views/partials/partial-inventaire-display.ejs
    - src/web/views/partials/partial-inventaire-warnings.ejs
    - migrations/0008_phase3_edl.sql
    - tests/unit/_shared/inventaire-item.test.ts (T1-T10)
    - tests/unit/locatif/etat-des-lieux.test.ts (T11-T19)
    - tests/unit/locatif/comparer-inventaires.test.ts (T20-T25)
    - tests/unit/locatif/bail-mobilier.test.ts (T26-T31)
    - tests/unit/locatif/enregistrer-edl.test.ts (T32-T38)
    - tests/unit/helpers/format-etat-item.test.ts (T39)
    - tests/unit/helpers/format-type-item-inventaire.test.ts (T40)
    - tests/integration/repositories/etat-des-lieux-repository-sqlite.test.ts (T41-T44)
    - tests/integration/repositories/bail-repository-sqlite-mobilier.test.ts (T45)
    - tests/bdd/features/edl.feature (T46-T50)
    - tests/bdd/features/checklist-mobilier.feature (T51-T53)
    - tests/bdd/step_definitions/edl.steps.ts
    - tests/bdd/step_definitions/checklist-mobilier.steps.ts
  modified:
    - src/domain/locatif/bail.ts (Bail.mobilier + verifierChecklistMobilier)
    - src/domain/locatif/erreurs.ts (EtatDesLieuxIntrouvable, EDLEntreeExisteDeja, EDLSortieExisteDeja, EDLDejaAnnule)
    - src/domain/_shared/identifiants.ts (EtatDesLieuxId + nouveauEtatDesLieuxId)
    - src/infrastructure/db/kysely-types.ts (BailTable.mobilier + EtatDesLieuxTable)
    - src/infrastructure/repositories/bail-repository-sqlite.ts (mobilier JSON roundtrip)
    - src/application/locatif/creer-bail.ts (mobilier field)
    - src/application/locatif/modifier-bail.ts (mobilier field)
    - src/web/routes/baux.ts (edlRepo + mobilierVersInventaireItems in POST /baux + /modifier)
    - src/web/schemas/bail-schemas.ts (mobilier field + mobilierVersInventaireItems helper)
    - src/web/views/pages/baux/detail.ejs (section EDL avec liens)
    - src/web/views/pages/baux/formulaire.ejs (fieldset mobilier 12 checkboxes)
    - src/main.ts (EtatDesLieuxRepositorySqlite + etatsDesLieuxPlugin + format helpers)
    - tests/_builders/locatif.ts (InventaireItem builders + EtatDesLieux builders)
    - tests/_world/monde-phase3.ts (bailId + edlId fields)
decisions:
  - "InventaireItem.creer exige etat non-null si présent — mobilierVersInventaireItems set etat='bon' par défaut (pas de null présent sans état dans le domaine)"
  - "Bail mobilier stocke 12 items complets (incluant absents) pour simplifier les requêtes; JSON inline (pattern Cautionnement Phase 1)"
  - "UNIQUE partial index WHERE annule_le IS NULL enforce D-89 au niveau DB + use case (double barrier)"
  - "comparerInventaires pure function sans effet de bord — retourne Warning[] sans throw"
  - "EDL form Zod schema parse inventaire comme body indexé [idx].field via normaliserInventaireFormBody"
metrics:
  duration: "~3h (2 agents — context limite + reprise)"
  completed: "2026-05-17"
  tasks: 3
  files: 48
---

# Phase 03 Plan 02: EDL + Mobilier + InventaireItem VO Summary

EDL full vertical slice avec InventaireItem VO (décret 2015-981, 12 types atomiques), EtatDesLieux aggregate (soft-delete, copy-on-write), comparerInventaires domain service, Bail.mobilier checklist, migration 0008, et toutes les routes HTTP + vues EJS pour LOC-03 + LOC-06.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED tests (T1-T53) | `6daea75` | 20 test files (tests/unit + integration + bdd) |
| 2 | GREEN domain implementation | `d8d53fa` | 18 src files (domain, infra, application, helpers) |
| 3 | Routes + vues + wiring + BDD vert | `379d090` | 17 files (routes, schemas, views, main.ts) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Champs de formulaire incorrects dans checklist-mobilier.steps.ts**
- Found during: Task 3
- Issue: Les step definitions utilisaient `loyerHc`, `montantCharges`, `depotGarantie`, `irlReference.trimestre/valeur` mais le Zod schema attend `loyerHcEuros`, `montantChargesEuros`, `depotGarantieEuros`, `irlTrimestre`, `irlValeur`
- Fix: Correction des noms de champs dans buildBailPayloadAvecMobilier + step edition
- Files modified: tests/bdd/step_definitions/checklist-mobilier.steps.ts
- Commit: 379d090

**2. [Rule 1 - Bug] URL incorrecte dans le step "éditer le bail" (POST /baux/:id vs /baux/:id/modifier)**
- Found during: Task 3
- Issue: Le step envoyait POST /baux/:id qui n'existe pas (la route est /modifier)
- Fix: Changement de l'URL dans le step injection
- Files modified: tests/bdd/step_definitions/checklist-mobilier.steps.ts
- Commit: 379d090

**3. [Rule 1 - Bug] Cucumber expression parenthèses non échappées pour literie décochée**
- Found during: Task 3
- Issue: `(literie décochée)` en Cucumber expression rend le groupe optionnel, donc le pattern ne match pas
- Fix: Echappement avec `\(literie décochée\)` dans le step definition
- Files modified: tests/bdd/step_definitions/checklist-mobilier.steps.ts
- Commit: 379d090

**4. [Rule 1 - Bug] Singulier/pluriel "ligne(s)" dans step definition EDL**
- Found during: Task 3
- Issue: La feature dit `1 ligne` (singulier) mais le step def ne matchait que `lignes` (pluriel)
- Fix: Utilisation de la syntaxe Cucumber `{int} ligne(s) pour ce bail` (s optionnel)
- Files modified: tests/bdd/step_definitions/edl.steps.ts
- Commit: 379d090

**5. [Rule 1 - Bug] InventaireItem.creer throws si present=true et etat=null — mobilierVersInventaireItems**
- Found during: Task 3 (debug via test ciblé)
- Issue: La checklist mobilier créait des items avec present=true et etat=null, violant l'invariant domaine "L'état est requis si l'item est présent"
- Fix: mobilierVersInventaireItems met etat='bon' par défaut pour les items présents (l'EDL affine l'état réel lors de l'état des lieux)
- Files modified: src/web/schemas/bail-schemas.ts
- Commit: 379d090

**6. [Rule 2 - Missing functionality] creerBail + modifierBail use cases ne supportaient pas mobilier**
- Found during: Task 3
- Issue: Les use cases ne propagaient pas le champ mobilier au Bail.creer/modifier
- Fix: Ajout du champ optionnel mobilier dans CreerBailCommande et ModifierBailCommande
- Files modified: src/application/locatif/creer-bail.ts, src/application/locatif/modifier-bail.ts
- Commit: 379d090

## Known Stubs

None — toutes les fonctionnalités sont câblées et opérationnelles.

## TDD Gate Compliance

- RED gate: commit `6daea75` (`test(03-02): ...`)
- GREEN gate: commit `d8d53fa` (`feat(03-02): ...`)
- REFACTOR: non applicable (code propre dès GREEN)

Gate séquence conforme.

## Self-Check: PASSED
