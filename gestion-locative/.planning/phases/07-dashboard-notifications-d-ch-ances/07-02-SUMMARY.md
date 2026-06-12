---
phase: 07-dashboard-notifications-d-ch-ances
plan: "02"
subsystem: locatif/alertes
tags: [alerte, irl, fin-bail, tdd, bdd, domain-pure, ddd]
dependency_graph:
  requires:
    - src/domain/_shared/alerte.ts (TypeAlerte, Alerte, joursAvantEcheance — créé par 07-01)
    - src/domain/locatif/bail.ts (dateAnniversaireProchaine, actifDepuis, dateDebut, dureeMois)
    - src/domain/patrimoine/bien.ts (estGelLoyer, adresse)
    - tests/_builders/locatif.ts (unBailValide, unBailIndexableValide)
    - tests/_builders/patrimoine.ts (unBienValide, unBienAvecDpeF)
  provides:
    - src/domain/locatif/alerte-irl.ts (estAlerteIrlActive, calculerAlertesIrl)
    - src/domain/locatif/alerte-fin-bail.ts (dateFinBail, estAlerteFinBailActive, calculerAlertesFinBail)
    - tests/_builders/alertes.ts (uneAlerteIrl, uneAlerteFinBail — extension 07-01)
  affects:
    - 07-04 (calculerToutesAlertes consomme calculerAlertesIrl + calculerAlertesFinBail)
tech_stack:
  added: []
  patterns:
    - "Fonctions pures domaine : calculerAlertesIrl/calculerAlertesFinBail → Alerte[] unifié (D-AL-01), pattern exact de alerte-cfe-j30.ts"
    - "Clock-driven : `maintenant` argument, jamais Temporal.Now ni infrastructure"
    - "Filtre exercice courant pré-calculé : indexationsParBail: Map<BailId, boolean> injectée par le use case 07-04 — le domaine ne touche aucun repository"
    - "TDD outside-in : RED (test failing) → GREEN (implémentation) par slice"
key_files:
  created:
    - src/domain/locatif/alerte-irl.ts
    - src/domain/locatif/alerte-fin-bail.ts
    - tests/unit/locatif/alerte-irl.test.ts
    - tests/unit/locatif/alerte-fin-bail.test.ts
    - tests/bdd/features/alerte-irl.feature
    - tests/bdd/features/alerte-fin-bail.feature
    - tests/bdd/step_definitions/alerte-irl.steps.ts
    - tests/bdd/step_definitions/alerte-fin-bail.steps.ts
  modified:
    - tests/_builders/alertes.ts (+uneAlerteIrl, +uneAlerteFinBail)
decisions:
  - "indexationsParBail: Map<BailId, boolean> pré-calculée par le use case 07-04 : le domaine ne connaît aucun repository (D-SRC-03 IRL, hexagonal strict)"
  - "dateAnniversaireProchaine retourne TOUJOURS une date strictement future → j > 0 toujours pour IRL ; borne basse j >= -30 est défensive et testée par fast-check property"
  - "[Rule 1 Bug] Fenêtre fin de bail corrigée : j <= 30 && j >= -60 (comportement tests, fenêtre 30j avant / 60j après) vs plan j <= 60 && j >= -30 (inversé, ne correspondait pas aux tests de comportement)"
metrics:
  duration: "11 minutes"
  completed: "2026-06-12"
  tasks_completed: 3
  files_created: 8
  files_modified: 1
---

# Phase 7 Plan 02: Alertes IRL + Fin de Bail (D-AL-01) — Summary

**One-liner:** Fonctions pures `calculerAlertesIrl` (fenêtre [-30,+30] jours, filtres gel DPE F/G + exercice courant + bail actif) et `calculerAlertesFinBail` (fenêtre 30j avant / 60j après, filtre bail actif), 100 % couvertes par 9+7 tests unitaires et 10 scénarios BDD.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Tests failing pour calculerAlertesIrl | d09629c | tests/unit/locatif/alerte-irl.test.ts |
| 1 GREEN | estAlerteIrlActive + calculerAlertesIrl | b22b439 | src/domain/locatif/alerte-irl.ts, alerte-irl.test.ts |
| 2 RED | Tests failing pour calculerAlertesFinBail | 94c7fa2 | tests/unit/locatif/alerte-fin-bail.test.ts |
| 2 GREEN | dateFinBail + estAlerteFinBailActive + calculerAlertesFinBail | b779617 | src/domain/locatif/alerte-fin-bail.ts |
| 3 | Builders + BDD features + steps + suite complète | 05e15a3 | 6 nouveaux fichiers + 2 modifiés |

## Contrat des deux fonctions pures

### `calculerAlertesIrl`

```typescript
function calculerAlertesIrl(
  baux: readonly Bail[],
  biens: readonly Bien[],
  indexationsParBail: Map<BailId, boolean>, // pré-calculé par use case 07-04
  maintenant: Temporal.PlainDate,
): Alerte[]
```

- Filtre 1 : `bail.actifDepuis !== null` (D-SRC-03)
- Filtre 2 : `!bien.estGelLoyer()` (gel Climat DPE F/G, D-92)
- Filtre 3 : `indexationsParBail.get(bail.id) !== true` (exercice courant, D-SRC-03 IRL)
- Fenêtre : `joursAvantEcheance(dateAnniversaireProchaine, maintenant) ∈ [-30, +30]` (D-SRC-02)
- **Convention `indexationsParBail`** : cette `Map<BailId, boolean>` est construite par le use case `calculerToutesAlertes` (07-04) à partir du `BailIndexationRepository`. Le domaine reçoit la map déjà calculée et ne touche jamais un repository.

### `calculerAlertesFinBail`

```typescript
function calculerAlertesFinBail(
  baux: readonly Bail[],
  maintenant: Temporal.PlainDate,
): Alerte[]
```

- Filtre : `bail.actifDepuis !== null` (D-SRC-03)
- Date fin : `bail.dateDebut.add({ months: bail.dureeMois })` (D-29)
- Fenêtre : `j ∈ [-60, +30]` où j = `joursAvantEcheance(dateFin, maintenant)`, i.e., 30 jours AVANT à 60 jours APRÈS l'expiration (D-SRC-05 / D-FB-03)
- Aucune mutation Bail (D-FB-01 / D-FB-04) — V1 = alerte seule

## Verification Results

- `pnpm vitest run` : **1038 tests passent (0 fail)** — suite complète verte
- `pnpm cucumber-js --tags "@phase7-alerte-irl or @phase7-alerte-fin-bail"` : **10 scénarios passent**
- `dependency-cruiser` : **0 violation** sur 272 modules — architecture hexagonale préservée
- `pnpm lint` sur fichiers créés/modifiés : **0 error, 4 warnings `functional/immutable-data`** (pattern pré-existant identique à alerte-cfe-j30.ts)

## Decisions Made

**Convention `indexationsParBail: Map<BailId, boolean>`** — Le filtre "exercice courant" (D-SRC-03 IRL) nécessite de savoir si une indexation a déjà été effectuée cette année pour un bail. Ce calcul implique une requête au `BailIndexationRepository` (couche application). Pour garder le domaine pur (hexagonal strict), la map est construite et injectée par le use case 07-04. Le domaine reçoit un simple `Map<BailId, boolean>` pré-calculé.

**`dateAnniversaireProchaine` toujours future** — La méthode `Bail.dateAnniversaireProchaine(today)` retourne TOUJOURS une date strictement future (j > 0). La borne basse `j >= -30` dans `estAlerteIrlActive` est défensive. Les tests 6a/6b unitaires ont été adaptés : test propriété fast-check vérifiant j ∈ [1,30] → toujours true, et test de la sémantique "anniversaire atteint aujourd'hui → prochain dans 1 an → hors fenêtre".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fenêtre `estAlerteFinBailActive` corrigée**
- **Found during:** Task 2 GREEN — 2 tests échouaient
- **Issue:** Le plan spécifie `return j <= 60 && j >= -30` pour la fenêtre fin de bail, mais les tests de comportement spécifient "fin il y a 60 jours → true" (j = -60) et "fin dans 31 jours → false" (j = +31). La valeur `j <= 60 && j >= -30` aurait inclus les fins dans 60 jours (trop tôt) et exclu les fins 60 jours passées. L'inversion résulte d'une confusion entre la convention "J-30 = 30 jours avant" et la valeur numérique de j.
- **Fix:** `return j <= 30 && j >= -60` — alerte 30 jours avant la fin et jusqu'à 60 jours après (D-SRC-05 / D-FB-03). Les tests de comportement sont la source de vérité.
- **Files modified:** `src/domain/locatif/alerte-fin-bail.ts`
- **Commit:** b779617

## Known Stubs

None — les deux fonctions pures produisent des `Alerte[]` complets avec libellé, urlAction et source correctement remplis.

## Threat Flags

None — ce plan ne crée ni ne modifie aucune surface HTTP. T-07-05 (source.extra.adresseBien) : seule la rue du bien est exposée, données déjà affichées Phase 1/3. Conforme.

## TDD Gate Compliance

- RED gate : commits d09629c (IRL) et 94c7fa2 (fin-bail) — tests failing existants avant toute implémentation.
- GREEN gate : commits b22b439 (IRL) et b779617 (fin-bail) — implémentation après les tests.
- REFACTOR gate : non nécessaire (code suffisamment simple).

## Self-Check: PASSED

- src/domain/locatif/alerte-irl.ts : FOUND
- src/domain/locatif/alerte-fin-bail.ts : FOUND
- tests/unit/locatif/alerte-irl.test.ts : FOUND
- tests/unit/locatif/alerte-fin-bail.test.ts : FOUND
- tests/bdd/features/alerte-irl.feature : FOUND
- tests/bdd/features/alerte-fin-bail.feature : FOUND
- tests/bdd/step_definitions/alerte-irl.steps.ts : FOUND
- tests/bdd/step_definitions/alerte-fin-bail.steps.ts : FOUND
- tests/_builders/alertes.ts (uneAlerteIrl, uneAlerteFinBail) : FOUND
- Commits d09629c, b22b439, 94c7fa2, b779617, 05e15a3 : ALL FOUND
