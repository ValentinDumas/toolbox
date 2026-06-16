---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Durcissement & mise en main
status: planning
last_updated: "2026-06-16T09:02:24.067Z"
last_activity: 2026-06-16
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-16)

**Core value:** Centraliser factures, quittances, baux et échéances pour simplifier les obligations fiscales LMNP (liasse 2031, 2042 C PRO, CFE, amortissements, plus-value LF 2025) — sans cloud, sans délégation.
**Current focus:** v1.0 MVP LMNP shippé — planning du prochain milestone (`/gsd-new-milestone`)

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-06-16 — Milestone v1.1 started

## Performance Metrics

**Velocity:**

- Total plans completed: 32
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| — | — | — | — |
| 02 | 7 | - | - |
| 01 | 8 | - | - |
| 04 | 4 | - | - |
| 06 | 7 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P02 | 10 | 4 tasks | 23 files |
| Phase 01 P03 | 25m | 3 tasks | 25 files |
| Phase 01 P04 | 29 | 3 tasks | 16 files |
| Phase 01-activation-bien-locataire-bail P05 | 35 | 3 tasks | 26 files |
| Phase 01-activation-bien-locataire-bail P06 | 9 | 3 tasks | 15 files |
| Phase 01 P07 | 20 | 3 tasks | 16 files |
| Phase 05 P06 | 180 | 3 tasks | 54 files |
| Phase 05 P07 | 105 | 3 tasks | 35 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: V1 = LMNP location meublée longue durée uniquement (autres cas reportés V1.1/V2).
- Init: Local-first / mono-user / SQLite (pas de cloud).
- Init: Ubiquitous language français dans le code (DDD).
- Init: BDD outside-in mandaté, 100 % couverture sur la logique fiscale.
- Init: DDD hexagonal — 6 bounded contexts (Patrimoine, Locatif, Encaissements, Comptabilité, Fiscalité, Documents).
- Init: Tech stack applicative non figée — à trancher en `/gsd-discuss-phase 1`.
- Init: Roadmap en Vertical MVP slices (PROJECT_MODE=mvp), Phase 1 = activation KPI sans fiscal.
- [Phase ?]: layout-debut/fin split — contenu-string incompatible avec include EJS
- [Phase ?]: LieuNaissance VO inline dans locataire.ts — V1 simplicité (D-32 YAGNI)
- [Phase ?]: Regex email minimal côté domaine + z.string().email() côté HTTP — séparation responsabilité
- [Phase ?]: Temporal.PlainDate.compare >= 0 → rejet date future
- [Phase ?]: navActive locals + aria-current='page' sidebar nav active state
- [Phase 05]: Boundary CGI art. 50-0 inclusive : recettes >= 83600 euro = reel (lt strict pour micro_bic eligible)
- [Phase 05]: BDD step lazy bien creation : pas de pre-creation dans le step contexte N biens actifs, auto-creation par adresse dans les steps recettes/charges
- [Phase 05]: Content-Disposition RFC 6266 avec helper contentDispositionFilename() dans routes exports.ts
- [Phase 07-07]: nomLocataire résolu dans le use case (Map<BailId,string>) et injecté en argument optionnel aux calculateurs domaine — le domaine reste pur (aucun repo).
- [Phase 07-07]: Fenêtre fin-bail réelle [-30 avant fin, +60 après] (D-SRC-05) ; IRL forward-only [0,+30] (D-SRC-02) — docs réconciliées et verrouillées par scénario BDD.
- [Phase 07-07]: Pas de lien « Voir tout » pour les alertes critiques S2 en V1 (aucune page dédiée) ; « Voir tout » actions du jour → /baux/indexations.

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: La stack applicative (langage, framework UI, ORM, lib PDF) est à trancher en `/gsd-discuss-phase 1` avant exécution.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-06-16 (v1.0). None correspond to an unsatisfied v1 requirement — milestone audit `passed`.

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| debug | g1-validation-500-json | diagnosed (fix landed in gap-closure) | 2026-06-16 |
| debug | g4-banniere-flash-dupliquee | diagnosed (fix landed in gap-closure) | 2026-06-16 |
| debug | g8-relance-mailto-pas-ouvert | diagnosed (fix landed in 02-07) | 2026-06-16 |
| uat | 02-UAT.md | 0 pending scenarios (status not closed) | 2026-06-16 |
| uat | 03-UAT.md | 0 pending scenarios (status not closed) | 2026-06-16 |
| uat | 04-HUMAN-UAT.md | resolved (status field stale) | 2026-06-16 |
| uat | 06-UAT.md | 12 pending human-UAT scenarios (paused) | 2026-06-16 |
| verification | 01-08-gap-closure-uat-p02 | gaps_found = stale ROADMAP table, now reconciled | 2026-06-16 |

## Session Continuity

Last session: 2026-06-16T07:15:52.504Z
Stopped at: Completed 07-07-PLAN.md (gap-closure WR-01..05, checkpoint approved)
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
