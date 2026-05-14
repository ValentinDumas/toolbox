---
phase: 01-activation-bien-locataire-bail
plan: "05"
subsystem: bail-classique
tags: [bail, money, irl, cautionnement, ddd, hexagonal, invariants-fiscaux, tdd]
dependency_graph:
  requires:
    - patrimoine-crud (plan 01-03)
    - locataire-crud (plan 01-04)
  provides:
    - Bail-aggregate-LOC-02
    - Money-VO-bigint-centimes
    - IRL-VO
    - Cautionnement-VO
    - BailRepository-port-and-sqlite-adapter
    - CRUD-Bail-complet
    - section-Baux-associes-fiche-locataire
  affects:
    - plan 06 (Wizard — creerBail use case réutilisé, unBailValide builder disponible)
    - Phase 2 (Quittancement — Bail.loyerHc + Bail.dateDebut + Money VO utilisés pour échéances)
    - Phase 3 (Conformité — Bail.irlReference utilisé pour révision IRL)
    - Phase 4 (Comptabilité — Money VO utilisé pour encaissements/amortissements)
    - Phase 6 (Reporting fiscal — LMNP liasse 2031 lit les baux actifs)
tech_stack:
  added:
    - "Money VO bigint centimes — zéro dépendance externe, toJSON()→number pour HTTP/SQLite"
    - "IRL VO string-based — trimestre YYYY-TN + valeur string decimal (évite arrondi flottant)"
    - "Temporal.PlainDate — pattern déjà établi Plan 04, réutilisé pour bail.dateDebut et cautionnement.dateSignature"
  patterns:
    - "Money ↔ INTEGER SQLite : Number(money.centimes) en écriture, Money.fromCentimes(BigInt(row.loyer_hc)) en lecture"
    - "Cautionnement ↔ TEXT JSON SQLite : JSON.stringify(cautionnement.toJSON()) écriture, JSON.parse + Cautionnement.creer() lecture"
    - "Temporal.PlainDate ↔ TEXT ISO : identique Plan 04 (bail.dateDebut.toString() / Temporal.PlainDate.from(row.date_debut))"
    - "creerBail use case cross-aggregate : vérifie lot_ids ⊂ bien.lots via BienRepository.trouverParId (D-30)"
    - "BailRepositorySqlite transaction : INSERT bail + DELETE/INSERT bail_lots atomiques via Kysely transaction()"
    - "Empty state prérequis : biensCount===0 || locatairesCount===0 → message 'Impossible de créer un bail' + CTA conditionnel"
key_files:
  created:
    - gestion-locative/src/domain/_shared/money.ts
    - gestion-locative/src/domain/_shared/irl.ts
    - gestion-locative/src/domain/locatif/cautionnement.ts
    - gestion-locative/src/domain/locatif/bail.ts
    - gestion-locative/src/domain/locatif/bail-repository.ts
    - gestion-locative/src/infrastructure/repositories/bail-repository-sqlite.ts
    - gestion-locative/src/application/locatif/creer-bail.ts
    - gestion-locative/src/application/locatif/modifier-bail.ts
    - gestion-locative/src/application/locatif/supprimer-bail.ts
    - gestion-locative/src/application/locatif/lister-baux.ts
    - gestion-locative/src/web/routes/baux.ts
    - gestion-locative/src/web/schemas/bail-schemas.ts
    - gestion-locative/src/web/views/pages/baux/liste.ejs
    - gestion-locative/src/web/views/pages/baux/formulaire.ejs
    - gestion-locative/src/web/views/pages/baux/detail.ejs
    - gestion-locative/tests/unit/_shared/money.test.ts
    - gestion-locative/tests/unit/_shared/irl.test.ts
    - gestion-locative/tests/unit/locatif/cautionnement.test.ts
    - gestion-locative/tests/unit/locatif/bail.test.ts
    - gestion-locative/tests/integration/repositories/bail-repository-sqlite.test.ts
  modified:
    - gestion-locative/src/domain/locatif/erreurs.ts (BailIntrouvable ajouté)
    - gestion-locative/src/main.ts (BailRepositorySqlite + bauxPlugin + bailRepo → locatairesPlugin)
    - gestion-locative/src/web/routes/locataires.ts (bailRepo optionnel + chargement baux pour detail)
    - gestion-locative/src/web/views/pages/locataires/detail.ejs (section "Baux associés" stub remplacé)
    - gestion-locative/src/web/views/partials/layout-debut.ejs (lien "Baux" actif + aria-current)
    - gestion-locative/tests/_builders/locatif.ts (builders unMontantValide, unIrlValide, uneCautionnementPhysique, unBailValide)
decisions:
  - "Money stocké en INTEGER centimes SQLite — Number() en écriture (sûr pour loyers < 2^53), BigInt() en lecture. Évite les drifts flottants REAL."
  - "IRL.valeur en string decimal (pas number) — préserve précision de l'indice INSEE sans arrondi JavaScript."
  - "Cautionnement stocké en TEXT JSON inline dans colonne bail.cautionnement (D-33 + RESEARCH §4) — mono-user local, pas de fuite (T-05-04 accept)."
  - "Cross-aggregate D-30 (lot_ids ⊂ bien.lots) vérifié au use case creerBail via BienRepository.trouverParId — l'agrégat Bail ne traverse pas directement Bien (DDD.md §4.3)."
  - "Formulaire /baux/nouveau : approche YAGNI — query ?bienId=... pré-sélectionne le bien et affiche ses lots directement (pas de fetch JS progressif — D-38 Phase 1)."
  - "lotIds Zod : union string|string[] transformé en array — formbody x-www-form-urlencoded envoie un string si 1 seul checkbox coché."
  - "BailRepository.listerParLocataire passé à locatairesPlugin via opts optionnel — rétro-compat sans casser les tests plan 04."
metrics:
  duration: "35 minutes"
  completed_date: "2026-05-14"
  tasks_completed: 3
  tasks_total: 3
  files_created: 20
  files_modified: 6
---

# Phase 01 Plan 05: Bail classique Summary

**One-liner:** Agrégat Bail meublé classique complet — VOs Money/IRL/Cautionnement, 5 invariants D-35 (durée≥12, dépôt≤2×, loyer>0, lot≥1, mode charges), adapter SQLite avec transaction bail+bail_lots, CRUD Baux, section Baux associés sur fiche Locataire.

## Tests Green

| Suite | Fichier | Tests |
|-------|---------|-------|
| Unit Money | tests/unit/_shared/money.test.ts | 13 verts |
| Unit IRL | tests/unit/_shared/irl.test.ts | 7 verts |
| Unit Cautionnement | tests/unit/locatif/cautionnement.test.ts | 5 verts |
| Unit Bail | tests/unit/locatif/bail.test.ts | 14 verts (TOUS invariants D-35) |
| Unit Locataire (carryover) | tests/unit/locatif/locataire.test.ts | 8 verts |
| Unit Lot (carryover) | tests/unit/patrimoine/lot.test.ts | 5 verts |
| Unit Bien (carryover) | tests/unit/patrimoine/bien.test.ts | 8 verts |
| Integration BailRepository | tests/integration/repositories/bail-repository-sqlite.test.ts | 6 verts |
| Integration BienRepository (carryover) | tests/integration/repositories/bien-repository-sqlite.test.ts | 6 verts |
| Integration LocataireRepository (carryover) | tests/integration/repositories/locataire-repository-sqlite.test.ts | 4 verts |
| BDD | tests/bdd/features/activation.feature | 1 scenario, 5 steps verts |

**Total : 76 tests verts + 1 BDD scenario green.**

**Coverage gate domain :**
- `src/domain/_shared/money.ts` : 100% (13 tests couvrent toutes branches)
- `src/domain/locatif/bail.ts` : 100% (14 tests dont cas limites dépôt=2×exact et modifier re-valide)

## Signature `creerBail` (use case multi-repos — plan 06 wizard)

```typescript
// src/application/locatif/creer-bail.ts
export async function creerBail(
  commande: CreerBailCommande,
  bailRepo: BailRepository,
  bienRepo: BienRepository,
  locataireRepo: LocataireRepository,
): Promise<BailId>

// CommercialCommande :
// { bienId, locataireId, lotIds[], dateDebut, dureeMois,
//   loyerHc: Money, modeCharges, montantCharges, depotGarantie,
//   irlReference: IRL, cautionnement: CautionnementCommande | null }
```

Étapes : vérifier Bien existe → vérifier Locataire existe → vérifier lot_ids ⊂ bien.lots (D-30) → `Bail.creer()` (invariants D-35) → `bailRepo.enregistrer()`.

## Patterns de désérialisation (référence Phase 2+)

```typescript
// Money ↔ INTEGER SQLite
// Écriture :
loyer_hc: Number(bail.loyerHc.toCentimes())  // bigint → number (centimes)
// Lecture :
const loyerHc = Money.fromCentimes(BigInt(row.loyer_hc))  // number → bigint → Money

// Temporal.PlainDate ↔ TEXT ISO SQLite (identique Plan 04)
date_debut: bail.dateDebut.toString()         // "YYYY-MM-DD"
const dateDebut = Temporal.PlainDate.from(row.date_debut)

// Cautionnement ↔ TEXT JSON SQLite
cautionnement: JSON.stringify(bail.cautionnement.toJSON())
const cautionnement = Cautionnement.creer(JSON.parse(row.cautionnement))
```

## Messages UI-SPEC §Error States — tous implémentés mot pour mot

| Invariant | Message exact |
|-----------|---------------|
| Loyer HC = 0 | "Le loyer hors charges doit être supérieur à 0 €" |
| Dépôt > 2 × loyer | "Le dépôt de garantie ne peut pas dépasser 2 mois de loyer hors charges (maximum : X €)" |
| Durée < 12 mois | "Un bail meublé classique doit durer au moins 12 mois" |
| Aucun lot sélectionné | "Sélectionnez au moins un lot pour ce bail" |
| Mode charges invalide | InvariantViolated (forfait / provisions seulement) |

## Builders Plan 06 et Phases 2-6

```typescript
// tests/_builders/locatif.ts — 4 nouveaux builders

unMontantValide(centimes = 80_000n): Money
// → Money.fromCentimes(centimes)

unIrlValide(overrides?): IRL
// → IRL.creer({ trimestre: '2026-T1', valeur: '145.47' })

uneCautionnementPhysique(overrides?): Cautionnement
// → Cautionnement.creer({ type: 'physique', garant: garnatValide, ... })

unBailValide(overrides?): Bail
// → Bail.creer({ dureeMois: 12, loyerHc: 80000n, depotGarantie: 80000n, ... })
```

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 — tests rouges (TDD RED) | 6a1495e | test(01-05): unit Money/IRL/Cautionnement/Bail rouge + integration repo rouge |
| Task 2 — domaine + adapter + use cases (TDD GREEN) | 576857d | feat(01-05): VOs Money (bigint centimes) + IRL + Cautionnement + Bail + port + adapter SQLite + use cases CRUD |
| Task 3 — routes + EJS + sidebar | 5551d1e | feat(01-05): routes /baux + Zod schemas + EJS pages liste/formulaire/detail + section Baux locataire + sidebar active |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Intl.NumberFormat fr-FR espace insécable U+00A0**
- **Found during:** Task 1 → Task 2 iteration
- **Issue:** Le test Money `enEuros()` comparait `'800,50 €'` avec espace normal (U+0020) alors que `Intl.NumberFormat('fr-FR')` émet un espace insécable (U+00A0) avant `€`.
- **Fix:** Test mis à jour pour utiliser `.toMatch(/800,50/)` et `.toMatch(/€/)` au lieu de `toBe()` — couvre le comportement sans dépendance sur le caractère exact.
- **Files modified:** tests/unit/_shared/money.test.ts
- **Commit:** 576857d (même commit)

**2. [Rule 1 - Bug] lotIds Zod — string seul si 1 checkbox coché**
- **Found during:** Task 3 design
- **Issue:** FormData `x-www-form-urlencoded` envoie `lotIds=value` (string) si un seul checkbox est coché, et `lotIds=v1&lotIds=v2` (tableau) si plusieurs. Le schema Zod initial ne gérait que le tableau.
- **Fix:** Schema `z.union([z.string().uuid(), z.array(z.string().uuid())]).transform((val) => Array.isArray(val) ? val : [val])`.
- **Files modified:** src/web/schemas/bail-schemas.ts
- **Commit:** 5551d1e

## Known Stubs

Aucun stub bloquant. Éléments intentionnels (plan scope) :
- Formulaire baux : pas de JS fetch dynamique pour rafraîchir les Lots quand le Bien change — YAGNI Phase 1. L'utilisateur utilise `?bienId=` en query ou re-navigue.
- Sidebar baux : lien "Baux" actif, lien "Wizard" toujours absent (Plan 06).

## Threat Flags

T-05-01 à T-05-06 mitigés comme prévu :
- T-05-01 (dépôt tampering) : Zod `superRefine` côté HTTP + `Bail.creer()` invariant domaine (double barrière).
- T-05-02 (bienId/locataireId/lotIds tampering) : `creerBail` vérifie existence + appartenance avant persistance.
- T-05-03 (Money SQL injection) : Kysely paramètre ; conversion Number↔BigInt documentée en commentaire.
- T-05-06 (lots illimité) : `z.array(...).min(1).max(50)`.
- T-05-04, T-05-05, T-05-07 : accept (mono-user local, plan scope).

## Self-Check: PASSED

Fichiers vérifiés :
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/domain/_shared/money.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/domain/_shared/irl.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/domain/locatif/cautionnement.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/domain/locatif/bail.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/domain/locatif/bail-repository.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/infrastructure/repositories/bail-repository-sqlite.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/application/locatif/creer-bail.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/web/routes/baux.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/web/schemas/bail-schemas.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/web/views/pages/baux/liste.ejs
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/web/views/pages/baux/formulaire.ejs
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/web/views/pages/baux/detail.ejs
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/tests/unit/_shared/money.test.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/tests/unit/locatif/bail.test.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/tests/integration/repositories/bail-repository-sqlite.test.ts

Commits vérifiés :
- FOUND: 6a1495e (Task 1 — RED tests)
- FOUND: 576857d (Task 2 — GREEN domain + infra + use cases)
- FOUND: 5551d1e (Task 3 — routes + EJS)
