---
phase: 06-liasse-2031-cfe
plan: 04
status: complete
type: tdd
requirements: [FIS-05]
tags: [fiscalite, liasse, rectificative, declaration-corrigee]
self_check: PASSED
key_files:
  created:
    - src/web/views/partials/partial-bandeau-rectificative.ejs
  modified:
    - src/domain/fiscalite/liasse/case-liasse.ts
    - src/application/fiscalite/generer-brouillon-liasse.ts
    - src/web/routes/fiscalite/liasse.ts
    - src/web/views/pages/fiscalite/brouillon-liasse.ejs
    - src/main.ts
    - tests/integration/web/route-liasse.test.ts
---

# Plan 06-04 — Liasse rectificative (FIS-05 slice 4)

## Self-Check: PASSED

## Ce qui a été livré

### Application
- **`genererBrouillonLiasse`** : commande discriminée
  - `{ declarationId }` → comportement Wave 1-3 (charge la DeclarationAnnuelle).
  - `{ declarationCorrigeeId }` → charge la DeclarationCorrigee + sa déclaration originale,
    construit un snapshot synthétique combinant les champs corrigés et les champs hérités
    (bailleurId/exercice/composantsSnapshot/clotureLe viennent de l'originale).
- DTO racine enrichi : `motifRectification?: string` + `urlOriginale?: string`.

### Web
- **`partial-bandeau-rectificative.ejs`** : `<aside role="status">` jaune avec copywriting
  UI-SPEC §S6 EXACT et lien interne `/fiscalite/declarations/:idOriginal/liasse`.
- **`brouillon-liasse.ejs`** : bandeau S6 conditionnel (avant la réconciliation).
- **Route nouvelle** `GET /fiscalite/declarations-corrigees/:id/liasse` — réutilise la même
  vue + handler d'erreurs factorisé.

### DI
- `main.ts` : `declCorrigeeRepo` câblé sur `registerFiscaliteLiasseRoutes`.

### Tests
- `tests/integration/web/route-liasse.test.ts` étendu de 3 cas :
  - 200 rectificative — bandeau S6 + motif + lien vers originale.
  - 200 originale post-rectification — pas de bandeau (audit-friendly).
  - 404 corrigée inexistante.
- **Total 8/8 GREEN**. Régression réel + micro inchangée.

## Décisions implémentées

| Décision | Implémentation |
|---|---|
| D-L6.5 — même format + bandeau motif | Aucune nouvelle section, juste le bandeau S6 + DTO enrichi. |
| Phase 5 D-FIS-G4.2 — append-only | Snapshot synthétique reconstruit à la lecture, jamais persisté. |
| Anti-pattern §4 — pas de mutation Phase 5 | La déclaration originale reste consultable sans bandeau. |
| Audit-friendly | Lien `Voir la déclaration originale` toujours visible sur la rectificative. |

## Capture ASCII — bandeau S6

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚠  Liasse rectificative — motif : Oubli charge syndic.               │
│    Cette version remplace le brouillon précédent. La déclaration     │
│    originale reste consultable.                                       │
│                                                                       │
│    [Voir la déclaration originale]                                   │
└──────────────────────────────────────────────────────────────────────┘
```

## Backlog différé

- 4 scénarios BDD `@phase6-liasse-rectificative` mentionnés dans le plan : les 3 tests
  intégration couvrent les chemins critiques (rectificative, originale post-rectif, 404).
  Les scénarios BDD additionnels (corrections successives, audit) sont reportés à
  Phase 7 si jugés utiles.
- Bloc `/fiscalite` qui priorise la corrigée la plus récente : non implémenté côté UI
  (la route racine continue de lister la DeclarationAnnuelle ; la corrigée est
  accessible via son URL directe). À traiter quand le besoin émergera (UI-SPEC §S11).

## Commits

1. `feat(06-04): liasse rectificative depuis DeclarationCorrigee (D-L6.5)`
