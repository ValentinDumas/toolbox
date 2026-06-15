---
phase: 07-dashboard-notifications-d-ch-ances
plan: "08"
subsystem: patrimoine/alertes
tags: [gap-closure, tdd, alerte-diagnostic, urlAction, uat-fix]
dependency_graph:
  requires: []
  provides: [DAS-02-urlAction-diagnostic-fixed]
  affects: [dashboard-notifications, detail-bien-diagnostics]
tech_stack:
  added: []
  patterns: [TDD RED→GREEN, domain-pure, clock-driven]
key_files:
  created: []
  modified:
    - src/domain/patrimoine/alerte-diagnostic.ts
    - tests/unit/patrimoine/alerte-diagnostic.test.ts
    - tests/_builders/alertes.ts
decisions:
  - "urlAction diagnostic = /biens/${id}#diagnostics-heading — pas d'ancre par type (aucun id diag-* dans detail.ejs)"
metrics:
  duration: 5m
  completed: "2026-06-15"
---

# Phase 7 Plan 08: Gap-Closure UAT Test 4 — urlAction Alerte Diagnostic Summary

**One-liner:** Corrige urlAction alerte diagnostic de `/biens/:id/diagnostics#diag-dpe` (404) vers `/biens/:id#diagnostics-heading` (200 + ancre existante) via TDD RED→GREEN chirurgical.

## What Was Built

Gap UAT test 4 (sévérité major) fermé : le lien « Voir le diagnostic » sur une alerte critique renvoyait un HTTP 404 car la route `GET /biens/:id/diagnostics` n'existe pas. Cause racine : `urlAction` ligne 62 de `alerte-diagnostic.ts` pointait vers une route inexistante avec une ancre (`#diag-${type}`) absente des vues.

Fix chirurgical en 3 fichiers, 1 littéral changé par fichier :

1. `src/domain/patrimoine/alerte-diagnostic.ts:62` — urlAction corrigée vers `/biens/${bien.id}#diagnostics-heading` (route `GET /biens/:id` existante → 200 ; ancre `id="diagnostics-heading"` existante dans `detail.ejs:119`).
2. `tests/unit/patrimoine/alerte-diagnostic.test.ts:58` — unique assertion urlAction alignée sur la cible corrigée.
3. `tests/_builders/alertes.ts:93,101` — JSDoc + default `uneAlerteDiagnostic` alignés (cohérence fixture↔domaine).

## Tasks

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | TDD: corriger urlAction alerte diagnostic | 966fac6 | alerte-diagnostic.ts, alerte-diagnostic.test.ts, alertes.ts |

## Verification

- `pnpm vitest run tests/unit/patrimoine/alerte-diagnostic.test.ts` : 11 PASS, 0 FAIL
- `pnpm vitest run` (full suite) : 1065 PASS, 0 FAIL
- `pnpm tsc --noEmit` : 0 erreur
- `grep -c "/diagnostics#diag-" src/domain/patrimoine/alerte-diagnostic.ts` → 0
- `grep -c "#diagnostics-heading" src/domain/patrimoine/alerte-diagnostic.ts` → 1
- `grep -c "#diagnostics-heading" tests/unit/patrimoine/alerte-diagnostic.test.ts` → 1
- `grep -c "/diagnostics#diag-" tests/_builders/alertes.ts` → 0

## Deviations from Plan

None — plan executed exactly as written. Perimetre chirurgical respecte : seuls 3 fichiers touches, aucun module sibling d'alerte modifie, domaine pur preserve (aucun import technique dans alerte-diagnostic.ts).

## TDD Gate Compliance

- RED : assertion test modifiee → `vitest run` echoue (PASS 10 FAIL 1, AssertionError urlAction)
- GREEN : urlAction corrigee dans domaine → `vitest run` passe (PASS 11 FAIL 0)
- REFACTOR : aucun (code minimal, pas de cleanup necessaire)

## Known Stubs

None.

## Threat Flags

None. urlAction est un litteral statique + `bien.id` interne (ULID/UUID non saisi par un tiers) — surface inchangee, analyse threat model T-07-08-01 : accepted.

## Self-Check: PASSED

- [x] `src/domain/patrimoine/alerte-diagnostic.ts` modifie (commit 966fac6)
- [x] `tests/unit/patrimoine/alerte-diagnostic.test.ts` modifie (commit 966fac6)
- [x] `tests/_builders/alertes.ts` modifie (commit 966fac6)
- [x] Commit 966fac6 verifie via `git log --oneline`
- [x] 1065 tests passent, 0 echec
