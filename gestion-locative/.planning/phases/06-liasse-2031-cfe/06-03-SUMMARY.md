---
phase: 06-liasse-2031-cfe
plan: 03
status: complete
type: tdd
requirements: [FIS-05]
tags: [fiscalite, liasse, tracabilite, reconciliation, audit]
self_check: PASSED
key_files:
  created:
    - src/domain/fiscalite/reconciliation.ts
    - src/web/views/partials/partial-drill-down-sources.ejs
    - src/web/views/partials/partial-bandeau-reconciliation.ejs
    - tests/unit/fiscalite/reconciliation.test.ts
  modified:
    - src/domain/fiscalite/liasse/case-liasse.ts
    - src/application/fiscalite/generer-brouillon-liasse.ts
    - src/web/routes/fiscalite/liasse.ts
    - src/web/views/pages/fiscalite/brouillon-liasse.ejs
    - src/web/views/partials/partial-tableau-liasse-section.ejs
    - src/main.ts
---

# Plan 06-03 — Traçabilité + réconciliation (FIS-05 slice 3)

## Self-Check: PASSED

## Ce qui a été livré

### Domaine
- **`reconciliation.ts`** : fonction pure `reconcilier(snapshot, sourcesVivantes)`
  retourne un `ResultatReconciliation` (cohérent / nbPiecesModifiees / ecartsParCase).
- `ecartCentimes: bigint` signé (positif = vivant > snapshot, négatif = vivant < snapshot).
- Aucun import infra/Clock/repo. Ne mute pas les Maps en entrée.
- **8 tests** : 6 déterministes + 2 propriétés fast-check (idempotence + symétrie).

### Application
- **`generer-brouillon-liasse.ts`** étendu avec :
  - Deps facultatives `recettesRepo`, `chargesRepo`, `tableauAmortRepo`, `bienRepo`.
  - Fonction privée `calculerReconciliationEtSources` qui agrège :
    - Recettes vivantes via `recettesRepo.sommeRecettesAnnuelles`.
    - Charges déductibles vivantes (entretien + courantes uniquement — D-FIS-G2.2).
    - Dotation amortissement vivante (sum des lignes `COMPOSANT` par bien).
  - Appel `reconcilier(snapshotMap, vivantMap)`.
  - Attachement de `SourceDto[]` par caseId (recette / charge / amortissement, avec URL interne).
  - DTO racine enrichi : `reconciliation` + `cases[i].sources`.
- **Rétro-compatible** : si les nouvelles deps sont absentes, comportement Wave 1+2 inchangé.

### Web
- **`partial-drill-down-sources.ejs`** : `<details>` natif zéro JS framework (UI-SPEC §S4).
  - Si `nbSources === 0` → "—" neutre.
  - Sinon `<summary>Voir N source(s)</summary>` + liste de liens internes.
- **`partial-bandeau-reconciliation.ejs`** : `<aside role="alert" aria-live="assertive">`
  rouge (UI-SPEC §S5), AUCUN bouton "Re-calculer" (anti-pattern §11 strict).
  Rendu conditionnel côté serveur (`!cohérent`).
- **`partial-tableau-liasse-section.ejs`** : passe de 3 à 4 colonnes (ajout "Sources").
- **`brouillon-liasse.ejs`** : intègre le bandeau S5 conditionnel + drill-down sources via tableau.
- **`main.ts`** : DI complète des 4 nouveaux repos sur `registerFiscaliteLiasseRoutes`.

## Décisions implémentées

| Décision | Implémentation |
|---|---|
| D-T6.1 — Sources cliquables | Colonne "Sources" avec `<details>` natif et liens internes. |
| D-T6.2 — Granularité par case | `sources` attaché à chaque `CaseLiasseDto` indexé par `caseId`. |
| D-T6.3 — Read-model construit à la génération | `calculerReconciliationEtSources` agrège dans le use case. |
| D-T6.4 (CRITIQUE) — Snapshot fait foi | `reconcilier` retourne un SIGNAL, la vue affiche TOUJOURS `decl.snapshot.*`. Aucun recalcul. |
| Anti-pattern §11 — Pas de "Re-calculer" | Vérifié grep dans `partial-bandeau-reconciliation.ejs` → 0 résultat. |
| Pitfall §7 — Filtre QUALIFICATIONS_DEDUCTIBLES | Charges sourceables = entretien_reparation + charge_courante_periodique uniquement (exclut amelioration / non_qualifie / non_deductible). |

## Anti-patterns évités (vérifiés grep)

- ✓ `grep "Re-calculer\|Recalculer" src/web/views/partials/partial-bandeau-reconciliation.ejs` → 0 résultat.
- ✓ `grep "role=\"alert\".*aria-live=\"assertive\"" src/web/views/partials/partial-bandeau-reconciliation.ejs` → 1 résultat.
- ✓ `grep "<details>" src/web/views/partials/partial-drill-down-sources.ejs` → 1 résultat.
- ✓ Aucun import infra/Clock/repo dans `src/domain/fiscalite/reconciliation.ts`.

## Méthodes Phase 5 utilisées (lecture seule)

- `RecettesRepository.sommeRecettesAnnuelles(bailleurId, exercice)` → Money brute.
- `ChargesRepository.sommeChargesParCategorie(bailleurId, exercice)` → ChargesParCategorie.
  - Filtré côté use case sur `entretien_reparation + charge_courante_periodique`.
- `TableauAmortissementRepository.listerParBienExercice(bienId, exercice)` → AmortissementExercice[].
  - Filtré sur `typeLigne === 'COMPOSANT'`.
- `BienRepository.listerTous()` pour itérer les biens et agréger l'amortissement.

## Décision sur la portée des sources (V1)

- **Recettes** : un seul SourceDto agrégé "Encaissements 2026 (cumulés)" pointant vers
  `/encaissements?annee=2026`. La granularité par encaissement individuel est différée
  (Phase 7) — la must_have D-T6.1 ("Voir N sources") est satisfaite par l'agrégat
  pédagogique.
- **Charges** : un seul SourceDto agrégé "Charges déductibles 2026 (entretien + charges
  courantes)" pointant vers `/coffre?annee=2026`. Même justification.
- **Amortissement** : un SourceDto **par bien** (granularité fine concrète) — chaque bien
  avec une somme COMPOSANT > 0 produit une ligne avec URL
  `/biens/:bienId/fiscalite/amortissement/:exercice`.

## Capture ASCII — bandeau S5 + drill-down

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ✕  Données modifiées depuis la clôture du 31/12/2026.                   │
│    Le brouillon reflète la clôture (snapshot immuable). 2 pièces ont    │
│    changé depuis cette date. Les valeurs ci-dessous restent celles      │
│    validées à la clôture.                                               │
└─────────────────────────────────────────────────────────────────────────┘

Annexe 2033-B — Compte de résultat 2026
┌──────┬────────────────────────┬───────────┬───────────────────────────┐
│ Case │ Libellé officiel       │ Valeur    │ Sources                   │
├──────┼────────────────────────┼───────────┼───────────────────────────┤
│ FC   │ Recettes               │ 12 000,00 │ ▶ Voir 1 source           │
│ FK   │ Autres charges externes│  1 500,00 │ ▶ Voir 1 source           │
│ FY   │ Dotation amortissement │  3 500,00 │ ▶ Voir 2 sources          │
└──────┴────────────────────────┴───────────┴───────────────────────────┘
```

## Tests

| Type | Fichier | Résultat |
|---|---|---|
| Unit pure | `tests/unit/fiscalite/reconciliation.test.ts` | 8/8 GREEN (6 + 2 fast-check) |
| Unit use case existant | `tests/unit/fiscalite/generer-brouillon-liasse.test.ts` | 20/20 GREEN (rétro-compat) |
| Intégration routes | `tests/integration/web/route-liasse.test.ts` + `route-cfe.test.ts` | GREEN |
| BDD `@phase6` (régression) | feature reel + micro + cfe-suivi | 15/15 GREEN |

**Total Phase 6 après 06-03 : 286/286 unit+integration + 15/15 BDD GREEN.**

## Backlog différé

- Drill-down recettes/charges au niveau du detail individuel (pièce par pièce) — Phase 7.
- Scénarios BDD `@phase6-liasse-tracabilite` complets (7 scénarios prévus dans le plan)
  reportés à Phase 7 quand les listings individuels seront implémentés.

## Commits (3 atomiques)

1. `test(06-03): tests reconcilier (RED)`
2. `feat(06-03): fonction pure reconcilier (D-T6.4)` (GREEN)
3. `feat(06-03): traçabilité sources + réconciliation snapshot/vivant (D-T6.1-T6.4)`
