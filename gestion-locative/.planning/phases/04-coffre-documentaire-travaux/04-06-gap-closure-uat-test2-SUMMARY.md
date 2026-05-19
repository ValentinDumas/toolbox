---
phase: "04-coffre-documentaire-travaux"
plan: "06"
subsystem: "travaux"
tags: [phase-4, gap-closure, uat, test2, ux, validation-date, upload-pj, ticket]
dependency_graph:
  requires: ["04-01", "04-02", "04-03", "04-04", "04-05"]
  provides: ["G-UX-02-bis closed", "G-DATE-01 closed"]
  affects: ["POST /travaux/:id/justificatifs", "POST /travaux/:id/clore", "GET /travaux/nouveau", "GET /travaux/:id"]
tech_stack:
  added: []
  patterns:
    - "Re-render HTTP 400 avec erreurs inline (pas de session.banniereWarning + redirect) pour upload PJ ticket"
    - "Invariant domain dateCloture <= today via ClockFixe (parité avec creer())"
    - "Zod refine dateCloture <= Temporal.Now.plainDateISO() (parité avec creerTicketSchema)"
    - "HTML5 max=locals.today sur inputs date (défense en profondeur couche navigateur)"
key_files:
  created:
    - tests/integration/web/travaux-ticket-pj-erreurs.test.ts
    - tests/integration/web/travaux-max-date.test.ts
  modified:
    - src/domain/travaux/ticket-travaux.ts
    - src/web/routes/travaux.ts
    - src/web/schemas/ticket-travaux-schemas.ts
    - src/web/views/pages/travaux/detail.ejs
    - src/web/views/pages/travaux/nouveau.ejs
    - src/web/views/partials/partial-ticket-pj-section.ejs
    - tests/bdd/features/travaux.feature
    - tests/unit/travaux/ticket-travaux.test.ts
    - tests/unit/travaux/use-cases.test.ts
    - tests/integration/repositories/ticket-travaux-repository-sqlite.test.ts
decisions:
  - "Zod dateCloture refine utilise Temporal.Now.plainDateISO() (pas le clock injecté) — cohérent avec creerTicketSchema et ajouterPJUploadSchema existants ; le domain reste la source de vérité testable via ClockFixe"
  - "id='fichier-error-ticket' suffixé pour éviter collision DOM si form coffre et form ticket coexistent dans une même page"
  - "Scope strict upload : seul le cas fichier vide refactoré vers re-render. Autres erreurs (file too large, format, domain) restent en banniereWarning + redirect — harmonisation en V1.1"
  - "T10 et T11 BDD mis à jour (dateCloture 2026-06-01 → 2026-05-18) car le Zod refine utilise Temporal.Now.plainDateISO() — une date hardcodée future casserait les tests dès que la date réelle dépasse 2026-06-01"
metrics:
  duration: "~35 minutes"
  completed_date: "2026-05-19"
  tasks_completed: 2
  tasks_total: 2
  tests_before: 617
  tests_after: 622
  bdd_before: 112
  bdd_after: 113
---

# Phase 04 Plan 06 : Gap Closure UAT Test 2 (UX upload PJ ticket + validation date future) Summary

Fermeture de 2 gaps remontés par smoke test manuel Test 2 (2026-05-19) post-04-05 :
**G-UX-02-bis** — garde fichier vide + rendu erreur inline sur form upload PJ ticket, pattern identique à G-UX-02 (commit 3eed2e8 / 04-05 T3) ; et **G-DATE-01** — défense en profondeur 3 couches (domain InvariantViolated + Zod refine + HTML5 max) pour bloquer les dates de clôture futures, plus ajout HTML5 max sur création.

## Tâches exécutées

| Tâche | Commit | Statut |
|-------|--------|--------|
| T1 — G-UX-02-bis : garde fichier vide + rendu erreur inline form upload PJ ticket | `9a56b74` | Terminé |
| T2 — G-DATE-01 : invariant dateCloture <= today (domain + Zod + HTML5) + max HTML5 sur dateOuverture | `f2955dd` | Terminé |

## Résumé des changements

### T1 — G-UX-02-bis

- `src/web/routes/travaux.ts` : ajout de `renderErreurFichier()` (closure locale) dans le handler POST `/travaux/:id/justificatifs` mode upload. Détecte `!data` (pas de fichier) et `fichierBuffer.length === 0` (0 octet). Re-rend la fiche ticket HTTP 400 avec `erreurs: { fichier: 'Aucun fichier reçu.' }` et `valeurs` (champs texte préservés). L'ancienne logique `session.banniereWarning + redirect` est supprimée pour ces deux cas.
- `src/web/views/partials/partial-ticket-pj-section.ejs` : ajout de `const erreurs = locals.erreurs || {}` et `const valeurs = locals.valeurs || {}`. Input fichier enrichi avec `aria-describedby` + `aria-invalid`. Span `id="fichier-error-ticket"` ajouté sous l'input. Préservation des valeurs (titre, type, dateDocument, montantTtcEuros, notes) via `value="<%= valeurs.xxx || '' %>"`.
- `src/web/views/pages/travaux/detail.ejs` : passage de `erreurs` et `valeurs` au partial via `include(...)`.
- `tests/integration/web/travaux-ticket-pj-erreurs.test.ts` : 2 tests (POST sans fichier et POST fichier 0 octet → 400 + message visible + aria-invalid + valeurs préservées).

### T2 — G-DATE-01

- `src/domain/travaux/ticket-travaux.ts` : `clore()` lève `InvariantViolated('La date de clôture ne peut pas être dans le futur.')` si `dateCloture > today`, AVANT le check `dateCloture < dateOuverture`.
- `src/web/schemas/ticket-travaux-schemas.ts` : `cloreTicketSchema.dateCloture` obtient un refine identique à `creerTicketSchema.dateOuverture` (Temporal.Now.plainDateISO(), message verbatim).
- `src/web/routes/travaux.ts` : la route POST `/travaux/:id/clore` propage maintenant `erreurs` (incluant `erreurs.dateCloture`) à la vue lors d'un échec Zod, pour affichage inline.
- `src/web/views/pages/travaux/nouveau.ejs` : input `dateOuverture` avec `max="<%= locals.today ? locals.today.toString() : '' %>"`.
- `src/web/views/pages/travaux/detail.ejs` : input `dateCloture` avec `max="<%= locals.today ? locals.today.toString() : '' %>"` + rendu erreur inline `dateCloture-error`.
- `tests/bdd/features/travaux.feature` : scénario T17 `@gap-uat-date @inc-01` (POST clore 2099-12-31 → 400 + message visible).
- `tests/unit/travaux/ticket-travaux.test.ts` : 2 tests G-DATE-01 (`clore()` rejette future + accepte today).
- `tests/unit/travaux/use-cases.test.ts` : 1 test G-DATE-01 (`cloreTicketTravaux` propage via ClockFixe).
- `tests/integration/web/travaux-max-date.test.ts` : 2 tests (GET nouveau + GET detail contiennent `max="2026-05-19"`).

## Déviations du plan

### Auto-fixes appliqués

**1. [Rule 1 - Bug] Tests existants utilisant dateCloture future avec ClockFixe**
- **Trouvé pendant :** T2 — après ajout de l'invariant clore()
- **Problème :** 4 tests existants passaient une `dateCloture > today` (ex: `2026-06-01` avec `ClockFixe.du('2026-05-18')`). Ces tests échouaient maintenant avec `InvariantViolated` au lieu du comportement attendu.
- **Fix :** Remplacement de `Temporal.PlainDate.from('2026-06-01')` par `TODAY` ou `CLOCK.aujourdhui()` dans `ticket-travaux.test.ts` (2 tests), `use-cases.test.ts` (1 test), `ticket-travaux-repository-sqlite.test.ts` (1 test).
- **Fichiers modifiés :** `tests/unit/travaux/ticket-travaux.test.ts`, `tests/unit/travaux/use-cases.test.ts`, `tests/integration/repositories/ticket-travaux-repository-sqlite.test.ts`
- **Commits :** inclus dans `f2955dd`

**2. [Rule 1 - Bug] Scénarios BDD T10/T11 utilisant dateCloture future (2026-06-01)**
- **Trouvé pendant :** T2 — le Zod refine utilise `Temporal.Now.plainDateISO()` (date réelle)
- **Problème :** T10 (happy path) et T11 (sans coût) utilisaient `dateCloture "2026-06-01"`. Avec le nouveau refine Zod, cette date est dans le futur par rapport à la date réelle d'exécution → les tests BDD auraient échoué.
- **Fix :** Remplacement de `"2026-06-01"` par `"2026-05-18"` (date ouverture du ticket BDD, qui est <= clock fixe et <= today réel) dans `travaux.feature` T10 et T11.
- **Fichiers modifiés :** `tests/bdd/features/travaux.feature`
- **Commits :** inclus dans `f2955dd`

## Métriques de tests

| Métrique | Avant | Après |
|----------|-------|-------|
| Tests unit + integration | 617 | 622 (+5) |
| Scénarios BDD | 112 | 113 (+1) |
| Typecheck | exit 0 | exit 0 |
| Depcruise violations | 0 | 0 |

## Vérifications post-commit

| Check | Résultat |
|-------|----------|
| `fichierBuffer.length === 0` dans travaux.ts | 1 occurrence |
| `fichier-error-ticket` dans partial | 2 occurrences (aria-describedby + span id) |
| `aria-invalid` dans partial | 1 occurrence |
| `La date de clôture ne peut pas être dans le futur` dans domain | 2 (docstring + code) |
| `La date de clôture ne peut pas être dans le futur` dans Zod schema | 1 occurrence |
| `max="<%= locals.today` dans nouveau.ejs | 1 occurrence |
| `max="<%= locals.today` dans detail.ejs | 1 occurrence |
| `@gap-uat-date` dans travaux.feature | 1 occurrence |

## Known Stubs

Aucun stub identifié dans ce plan — les 2 gaps sont entièrement fermés avec données réelles.

## Self-Check: PASSED
