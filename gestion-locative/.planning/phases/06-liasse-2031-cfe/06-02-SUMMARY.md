---
phase: 06-liasse-2031-cfe
plan: 02
status: complete
type: tdd
requirements: [FIS-05]
tags: [fiscalite, liasse, micro-bic, 2042-c-pro]
self_check: PASSED
key_files:
  created:
    - tests/bdd/features/brouillon-liasse-micro.feature
  modified:
    - src/domain/fiscalite/liasse/mapping-liasse-2026.ts
    - src/application/fiscalite/generer-brouillon-liasse.ts
    - src/web/views/pages/fiscalite/index.ejs
    - src/web/routes/fiscalite/liasse.ts
    - tests/_builders/fiscalite.ts (réutilisé sans modif)
    - tests/bdd/step_definitions/brouillon-liasse.steps.ts
    - tests/unit/fiscalite/generer-brouillon-liasse.test.ts
    - tests/unit/fiscalite/mapping-liasse-provider.test.ts
    - tests/integration/web/route-liasse.test.ts
---

# Plan 06-02 — Brouillon micro-BIC (FIS-05 slice 2)

## Self-Check: PASSED

## Ce qui a été livré

### Domaine
- **`mapping-liasse-2026.ts`** : section `'2042-C-PRO'` peuplée avec la case `5NI`
  (Locations meublées non professionnelles — Régime micro-BIC — Locations meublées
  longue durée). Source PR LF 2024 + RESEARCH §Cerfa Case Mapping.

### Application
- **`genererBrouillonLiasse`** : branche sur `decl.regimeApplique`.
  - `'reel'` → comportement Wave 1 (sections 2031-SD + 2033-A/B/C/D).
  - `'micro_bic'` → une seule section `2042-C-PRO`.
- Retire le throw `RegimeMicroBicNonSupporteWave1` (classe `@deprecated` conservée
  pour la rétro-compat des imports nommés mais plus jamais levée).
- **`resoudreValeurCase('recettesTotales')`** retourne `decl.recettesTotales`
  inchangé — AUCUN calcul d'abattement côté app (R4.3 pédagogie absolue).

### Web
- **`pages/fiscalite/index.ejs`** : le filtre `regimeApplique === 'reel'` du bloc
  "Brouillons de liasse" est levé. Les déclarations micro-BIC et réel sont listées
  côte à côte, avec un suffixe `(micro-BIC)` / `(réel)` pour clarté.
- **`routes/fiscalite/liasse.ts`** : retire le handler 422 `RegimeMicroBicNonSupporteWave1`.

### Tests
| Type | Fichier | Résultat |
|---|---|---|
| Unit use case | `tests/unit/fiscalite/generer-brouillon-liasse.test.ts` | 3 nouveaux tests micro + Test 4 mis à jour |
| Unit mapping | `tests/unit/fiscalite/mapping-liasse-provider.test.ts` | "2042-C-PRO vide" → "2042-C-PRO contient 5NI" |
| Intégration route | `tests/integration/web/route-liasse.test.ts` | 422 micro → 200 micro-BIC |
| BDD `@phase6-liasse-micro` | `tests/bdd/features/brouillon-liasse-micro.feature` | 2 scénarios, 9 steps GREEN |
| BDD `@phase6-liasse-reel` (régression) | inchangé | 4 scénarios, 17 steps GREEN |

**Total Phase 6 après 06-02 : 252 unit/integration + 15 BDD @phase6 GREEN.**

## Décisions implémentées

| Décision | Implémentation |
|---|---|
| D-L6.2 — micro + réel | `genererBrouillonLiasse` branche sur `regimeApplique`. |
| R4.3 — pas d'abattement côté app | Case 5NI = `decl.recettesTotales` brut, jamais `multiplyByFraction(50, 100)`. |
| LF 2024 — 5NI remplace 5ND | Code 5NI confirmé RESEARCH §Cerfa Case Mapping. |
| V1 single-user mono-déclarant | 5OI/5PI (indivision/PAC) hors V1 — non mappés. |

## Anti-patterns évités (vérifiés grep)

- ✓ `grep -n "multiplyByFraction(50" src/application/fiscalite/generer-brouillon-liasse.ts` → 0 résultat.
- ✓ `grep -n "5NI" src/domain/fiscalite/liasse/mapping-liasse-2026.ts` → 3 lignes (commentaire + déf).
- ✓ Aucune section 2031-SD/2033-* injectée en micro (vérifié par BDD micro-01 + unit M3).

## Capture ASCII — Vue micro-BIC

```
Brouillon liasse fiscale 2026 — Régime micro-BIC
  Bandeau S1 : "Brouillon — à reporter case-par-case sur impots.gouv.fr"

  ┌───────────────────────────────────────────────────────────────┐
  │ 2042-C-PRO — Report micro-BIC 2026                            │
  ├───────────────────────────────────────────────────────────────┤
  │ Case  │ Libellé officiel                          │ Valeur    │
  │ 5NI   │ Locations meublées … longue durée         │ 18 000,00 │
  └───────────────────────────────────────────────────────────────┘
```

## Commits (2 atomiques)

1. `test(06-02): scenarios micro-BIC (RED)`
2. `feat(06-02): brouillon micro-BIC 2042 C PRO case 5NI (FIS-05 slice 2)`
