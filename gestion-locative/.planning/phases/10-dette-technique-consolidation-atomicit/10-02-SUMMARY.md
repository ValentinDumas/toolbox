---
phase: 10-dette-technique-consolidation-atomicit
plan: "02"
subsystem: web/routes, web/views, domain/locatif
tags: [dette-technique, refactoring, alertes-irl, enrichissement]
dependency_graph:
  requires: []
  provides: [DET-02]
  affects: [src/web/routes/baux.ts, src/web/views/pages/baux/indexations.ejs]
tech_stack:
  added: []
  patterns: [Map injection, domaine pur, chemin d enrichissement unique]
key_files:
  modified:
    - src/web/routes/baux.ts
    - src/web/views/pages/baux/indexations.ejs
decisions:
  - "Construire nomLocataireParBail avant l'appel calculerAlertesIrl, identique au pattern de calculer-toutes-alertes.ts"
  - "Supprimer boucle post-hoc et dict locatairesParBail (2 chemins → 1 chemin)"
  - "Vue lit alerte.source.extra.nomLocataire (champ enrichi par le domaine)"
metrics:
  duration: "~10 minutes"
  completed_date: "2026-06-16"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 10 Plan 02: Unification enrichissement alertes IRL Summary

**One-liner:** Suppression du second chemin d'enrichissement post-hoc dans routes/baux.ts — Map nomLocataireParBail injectée en 5e argument de calculerAlertesIrl, vue rebranchée sur alerte.source.extra.nomLocataire.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Construire nomLocataireParBail et passer en 5e arg | c2b34b6 | src/web/routes/baux.ts |
| 2 | Rebrancher vue indexations sur source.extra.nomLocataire | 0945b80 | src/web/views/pages/baux/indexations.ejs |

## What Was Done

### Task 1 — routes/baux.ts

Dans le handler `app.get('/baux/indexations')` :
- Construit `locatairesParId` et `nomLocataireParBail` (Map<BailId,string>) en miroir exact de `calculer-toutes-alertes.ts` §66-74
- Passe `nomLocataireParBail` en 5e argument à `calculerAlertesIrl`
- Supprime la boucle post-hoc (§167-178) et le dict `locatairesParBail: Record<string,string>`
- Retire `locatairesParBail` du payload `reply.view`

### Task 2 — indexations.ejs

- Remplace `locatairesParBail[alerte.source.refId]` par `alerte.source.extra.nomLocataire`
- La vue lit directement le champ enrichi par le domaine (même source : `${loc.prenom} ${loc.nom}`)

## Verification

- `grep -c "calculerAlertesIrl(baux, biens, indexationsParBail, maintenant, nomLocataireParBail)" src/web/routes/baux.ts` → 1
- `grep -c "locatairesParBail" src/web/routes/baux.ts` → 0
- `grep -c "locatairesParBail" src/web/views/pages/baux/indexations.ejs` → 0
- `grep -c "source.extra.nomLocataire" src/web/views/pages/baux/indexations.ejs` → 1
- `tsc --noEmit` → exit 0
- Integration tests (262/262) → green (run against main repo, worktree sans node_modules)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — changement purement interne, aucune nouvelle surface réseau ou accès fichier.

## Self-Check: PASSED

- [x] src/web/routes/baux.ts — modified, committed at c2b34b6
- [x] src/web/views/pages/baux/indexations.ejs — modified, committed at 0945b80
- [x] Commits exist: c2b34b6, 0945b80
- [x] TypeScript: exit 0
- [x] locatairesParBail éliminé des deux fichiers
