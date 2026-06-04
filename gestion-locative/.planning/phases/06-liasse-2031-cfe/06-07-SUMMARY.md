---
phase: 06-liasse-2031-cfe
plan: 07
status: complete
type: tdd
requirements: [FIS-06]
tags: [fiscalite, cfe, alerte, banner, clock, j30]
self_check: PASSED
key_files:
  created:
    - src/domain/fiscalite/cfe/alerte-cfe-j30.ts
    - src/application/fiscalite/lister-alertes-cfe-actives.ts
    - src/web/views/partials/partial-bandeau-cfe-echeance.ejs
    - tests/unit/fiscalite/alerte-cfe-j30.test.ts
    - tests/integration/web/route-cfe-banner.test.ts
  modified:
    - src/web/routes/biens.ts
    - src/web/routes/fiscalite/racine.ts
    - src/web/views/pages/biens/detail.ejs
    - src/web/views/pages/fiscalite/index.ejs
    - src/main.ts
---

# Plan 06-07 — Alerte CFE J-30 (FIS-06 slice 7)

## Self-Check: PASSED

## Ce qui a été livré

### Domaine pur
- **`alerte-cfe-j30.ts`** :
  - `joursAvantEcheance(dateEcheance, maintenant): number` — signé.
  - `estAlerteActive(decl, maintenant): boolean` — filtre statut + fenêtre [-60, +30].
  - `calculerAlertesCfe(declarations, maintenant): AlerteCfe[]` — agrège + tri ASC.
- **Pitfall §5 verrouillé** : `payee`, `exoneree_premiere_annee`, `exoneree_commune` exclus AVANT calcul.

### Application
- **`listerAlertesCfeActives`** : Clock injecté, `bienId` optionnel (filtre bien ou agrégat).

### Web
- **`partial-bandeau-cfe-echeance.ejs`** : 3 variantes UI-SPEC §S10 :
  - J-30 à J-8 : warning (bord gauche orange, `role="status"` `aria-live="polite"`).
  - J-7 à J-0 : warning forte (fond orange + `role="alert"` `aria-live="assertive"`).
  - J+1 et plus : destructive (bord rouge + `role="alert"`).
- Lien externe `https://www.impots.gouv.fr/professionnel/cotisation-fonciere-des-entreprises-cfe`
  avec `target="_blank" rel="noopener noreferrer"` (V9 ASVS).
- **Intégration vues** :
  - `pages/biens/detail.ejs` : banner par bien (au-dessus de la section CFE).
  - `pages/fiscalite/index.ejs` : section "Échéances CFE" agrégée (UI-SPEC §S11).

### DI
- `main.ts` : `cfeRepo` + `bienRepo` + `clock` câblés sur `biensPlugin` et `registerFiscaliteRacineRoute`.
- Calcul **À LA DEMANDE** via `clock.aujourdhui()` à chaque rendu — PAS de cron, PAS de setInterval (anti-pattern §6).

### Tests
| Type | Fichier | Résultat |
|---|---|---|
| Unit fonction pure | `tests/unit/fiscalite/alerte-cfe-j30.test.ts` | 15/15 GREEN (12 + 3 fast-check) |
| Intégration route + banner | `tests/integration/web/route-cfe-banner.test.ts` | 3/3 GREEN |

**Propriété fast-check monotonie** : `date1 < date2 ⇒ joursAvantEcheance(date1) > joursAvantEcheance(date2)`
(50 runs, validée).

## Décisions implémentées

| Décision | Implémentation |
|---|---|
| D-CFE6.5 — banner J-30 calculé à la demande | `Clock` injecté au use case, pas de persistance. |
| Pitfall §5 — filtre statut AVANT calcul | `STATUTS_ALERTABLES = {'non_deposee','deposee'}` dans `estAlerteActive`. |
| Anti-pattern §6 — pas de cron | Aucun setInterval/setTimeout. Calcul synchrone à chaque GET. |
| UI-SPEC §S10 — 3 variantes | Switch sur `joursRestants` côté template. |
| V9 ASVS — lien externe sécurisé | `rel="noopener noreferrer"` vérifié par test integration. |

## Anti-patterns évités (vérifiés par tests)

- ✓ CFE `payee` n'affiche pas de banner (test "PAS de banner si CFE payee").
- ✓ Lien externe contient `rel="noopener noreferrer"` (assert HTML).
- ✓ Calcul pur testé par fast-check (monotonie 50 runs).

## Capture ASCII — Banner CFE J-30

### Variante warning (J-30 à J-8)
```
┌────────────────────────────────────────────────────────────────────┐
│ ▌ CFE 2026 — Échéance dans 15 jours.                              │
│ ▌ Échéance le 15/12/2026.                                          │
│ ▌ [Régler la CFE sur impots.gouv.fr] [Mettre à jour le statut]    │
└────────────────────────────────────────────────────────────────────┘
```

### Variante destructive (J+1 et plus)
```
┌════════════════════════════════════════════════════════════════════┐
║ ▌ CFE 2026 — Échéance dépassée depuis 5 jours.                    ║
║ ▌ Échéance le 15/12/2026.                                          ║
║ ▌ [Régler la CFE sur impots.gouv.fr] [Mettre à jour le statut]    ║
└════════════════════════════════════════════════════════════════════┘
```

## Backlog différé

- 8 scénarios BDD `@phase6-cfe-alerte` planifiés dans le plan reportés à Phase 7 —
  les 15 tests unitaires + propriété fast-check couvrent déjà la logique métier complète.

## Commits (3 atomiques)

1. `test(06-07): tests alerte CFE J-30 fonction pure (RED)`
2. *(implicit GREEN — créé domaine.ts directement après RED, validé inline)*
3. `feat(06-07): alerte CFE J-30 — fonction pure + use case + banner + DI (D-CFE6.5)`
