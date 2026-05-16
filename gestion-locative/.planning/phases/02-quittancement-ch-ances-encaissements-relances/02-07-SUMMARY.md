---
phase: "02"
plan: "07"
subsystem: "web/encaissements"
tags: ["gap-closure", "G3", "G4", "G5", "G6", "G7", "G8", "ejs", "echeances", "relances", "quittances"]

dependency_graph:
  requires: ["02-01", "02-02", "02-03", "02-04", "02-05", "02-06"]
  provides: ["global-echeances-route", "ouverture-mail-view", "empty-state-conditional-cta", "quittances-discoverability"]
  affects: ["web/routes/echeances.ts", "web/routes/relances.ts", "web/views/pages/echeances/liste-globale.ejs", "web/views/pages/relances/ouverture-mail.ejs"]

tech_stack:
  added: []
  patterns: ["conditional-ejs-render", "page-intermediaire-mailto", "BDD-gap-scenarios", "listerTous-repo-method"]

key_files:
  created:
    - gestion-locative/src/web/views/pages/relances/ouverture-mail.ejs
    - gestion-locative/src/web/views/pages/echeances/liste-globale.ejs
    - gestion-locative/tests/unit/views/empty-state.test.ts
    - gestion-locative/tests/integration/web/relances-mailto.test.ts
    - gestion-locative/tests/bdd/features/gaps-g6-g7.feature
    - gestion-locative/tests/bdd/step_definitions/gaps-g6-g7.steps.ts
  modified:
    - gestion-locative/src/web/views/partials/empty-state.ejs
    - gestion-locative/src/web/views/partials/sidebar-nav.ejs
    - gestion-locative/src/web/views/pages/bailleur/profil.ejs
    - gestion-locative/src/web/views/pages/baux/detail.ejs
    - gestion-locative/src/web/views/pages/quittances/liste.ejs
    - gestion-locative/src/web/views/pages/quittances/fiche.ejs
    - gestion-locative/src/web/views/pages/relances/liste.ejs
    - gestion-locative/src/web/routes/echeances.ts
    - gestion-locative/src/web/routes/relances.ts
    - gestion-locative/src/domain/encaissements/echeance-loyer-repository.ts
    - gestion-locative/src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts
    - gestion-locative/src/application/encaissements/lister-echeances.ts
    - gestion-locative/tests/bdd/features/relances.feature
    - gestion-locative/tests/bdd/step_definitions/relances.steps.ts
    - gestion-locative/tests/integration/repositories/echeance-loyer-repository-sqlite.test.ts
    - gestion-locative/tests/unit/encaissements/activer-bail.test.ts

decisions:
  - "G8: page intermédiaire ouverture-mail.ejs avec window.location.href au lieu de redirect immédiat — le redirect 302 ne peut pas déclencher un client mail (protocole mailto non suivi par le navigateur sur redirect serveur)"
  - "G6: listerTous() ajouté au repo port EcheanceLoyerRepository plutôt que requête directe en route — respect hexagonal architecture"
  - "G7: CTA above-the-fold sur /quittances liste + mise à jour empty-state avec CTA vers /echeances?statut=payee"
  - "G4: suppression des 5 ré-includes banniere-success dans les pages (layout-debut.ejs reste le seul point de rendu)"

metrics:
  duration_minutes: 90
  completed_date: "2026-05-16"
  tasks_completed: 5
  tasks_total: 5
  files_created: 6
  files_modified: 16
---

# Phase 02 Plan 07: Gap Closure (G3–G8) Summary

Fermeture des 6 gaps UAT phase 02 : CTA conditionnel empty-state (G3), déduplication banniere-success (G4), affichage actifDepuis fiche bail (G5), route globale /echeances avec filtres (G6), CTA discoverability quittances (G7), page intermédiaire mailto relances niveaux 1-2 (G8).

## Tasks Completed

| Task | Gap | Commit | Description |
|------|-----|--------|-------------|
| 1 | G3 | b7d4fc3 | empty-state.ejs CTA conditionnel + test unitaire rendu |
| 2 | G4 | 3ca2f8e | Suppression 5 ré-includes banniere-success |
| 3 | G5 | 4c6bf65 | Affichage actifDepuis sur fiche bail |
| 4 | G6+G7 | 7c28fa6 | Route globale /echeances + filtres bail/statut + CTA quittances |
| 5 | G8 | 78f184c | Page intermédiaire ouverture-mail.ejs + tests intégration + BDD |

## Gaps Closed

### G3 — Empty-state CTA vide affiché inconditionnellement

`empty-state.ejs` entourait le lien CTA dans un conditionnel `<% if (locals.ctaUrl && locals.ctaLabel) { %>`. Test unitaire `tests/unit/views/empty-state.test.ts` couvre les 4 branches (CTA présent, ctaLabel null, ctaUrl null, tous null).

### G4 — Bannière succès dupliquée (double-include systémique)

5 pages ré-incluaient `banniere-success.ejs` alors que `layout-debut.ejs` l'inclut déjà. Suppression des includes redondants dans : `profil.ejs`, `baux/detail.ejs`, `quittances/liste.ejs`, `quittances/fiche.ejs`, `relances/liste.ejs`.

### G5 — actifDepuis invisible sur fiche bail

Ajout dans `baux/detail.ejs` section Période : `Actif depuis` affiché si `bail.actifDepuis !== null`, formaté via `formatDate()`. Brouillons (actifDepuis null) n'affichent pas le champ.

### G6 — Filtres bail/statut absents sur /echeances

- Nouveau port `listerTous(filtres?)` dans `EcheanceLoyerRepository`
- Implémentation SQLite dans `echeance-loyer-repository-sqlite.ts` (filtre bailId + statut, ORDER BY periode_debut DESC)
- Use case `listerToutesEcheances()` dans `lister-echeances.ts`
- Route `GET /echeances` dans `echeances.ts` avec select bail + statut + enrichissement locataire/bail
- Vue `pages/echeances/liste-globale.ejs` avec form filtres (selects bail et statut), tableau 7 colonnes, empty-state
- Lien "Toutes les échéances" ajouté à `sidebar-nav.ejs`
- Tests : 4 tests repo (`listerTous` T1-T4) + 6 scénarios BDD @gap-G6 + @gap-G7

### G7 — Discoverability "Émettre une quittance"

- CTA `<a href="/echeances?statut=payee" role="button">Émettre une quittance</a>` ajouté au-dessus de la table dans `quittances/liste.ejs`
- Empty-state mis à jour avec `ctaLabel: 'Émettre une quittance', ctaUrl: '/echeances?statut=payee'`

### G8 — POST /relances ignorait mailtoUri canal email

Root cause : redirect 302 ne peut pas déclencher un client mail natif — le navigateur ne suit pas les URIs `mailto:` sur redirect serveur.

Fix : la branche `canal === 'email'` retourne désormais `reply.view('pages/relances/ouverture-mail.ejs', ...)` avec :
- `<script>window.location.href = <%- JSON.stringify(mailtoUri) %>;</script>` — auto-trigger côté client
- Lien fallback `<a href="<%= mailtoUri %>" role="button">Ouvrir le mail</a>`
- Lien retour vers `/impayes`

Tests : intégration `relances-mailto.test.ts` (T1 canal email HTML 200 + T2 régression PDF niveau 3) + 2 scénarios BDD @gap-G8.

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| Unit + Integration (vitest) | 257 passed | PASS |
| BDD (cucumber-js) | 47 scenarios, 245 steps | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stub manquant `listerTous` dans test activer-bail**
- Found during: Task 4 (TypeScript compilation)
- Issue: `creerEcheanceLoyerRepoStub()` dans `activer-bail.test.ts` ne satisfaisait plus l'interface après ajout de `listerTous` au port
- Fix: Ajout de `listerTous: async () => []` dans le stub
- Files modified: `tests/unit/encaissements/activer-bail.test.ts`
- Commit: 7c28fa6

**2. [Rule 1 - Bug] Regex BDD trop générique causait conflit de step**
- Found during: Task 4 (BDD step registration)
- Issue: Step générique `le bailleur navigue vers GET (.+)` conflictait avec les steps relances existants
- Fix: Utilisation de regex étroites `/\/echeances[^\s]*/` et `/\/quittances/` dans gaps-g6-g7.steps.ts
- Files modified: `tests/bdd/step_definitions/gaps-g6-g7.steps.ts`
- Commit: 7c28fa6

**3. [Rule 1 - Bug] Table quittance colonnes incorrectes**
- Found during: Task 4 (BDD seed data)
- Issue: Code utilisait `pdf_path` (inexistant) — table réelle a `chemin_fichier_relatif` et `numero` au format `AAAA-NNN`
- Fix: Correction des colonnes dans le helper `creerBailleur` / Given step
- Files modified: `tests/bdd/step_definitions/gaps-g6-g7.steps.ts`
- Commit: 7c28fa6

**4. [Rule 1 - Bug] T2 integration test retournait 422 (niveau 3 non disponible)**
- Found during: Task 5 (T2 test execution)
- Issue: Clock `2026-05-15` = J+35 depuis échéance `2026-04-10`; niveau 3 requiert J+60. Règle métier levait `RelanceNiveauNonDisponible`
- Fix: T2 recrée l'app avec `ClockFixe.du('2026-06-10')` (J+61) + insère relances 1 et 2 avant l'appel niveau 3
- Files modified: `tests/integration/web/relances-mailto.test.ts`
- Commit: 78f184c

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: xss | src/web/views/pages/relances/ouverture-mail.ejs | mailtoUri injectée via `<%- JSON.stringify(mailtoUri) %>` — JSON.stringify échappe les quotes/backslash mais pas le HTML. mailtoUri provient du service enregistrerRelance qui la construit depuis données locataire DB (non contrôlée par l'utilisateur dans ce flux single-user) — risque résiduel accepté. |

## Known Stubs

None — toutes les données affichées proviennent de la base SQLite.

## Self-Check: PASSED

Files created confirmed:
- gestion-locative/src/web/views/pages/relances/ouverture-mail.ejs: FOUND
- gestion-locative/src/web/views/pages/echeances/liste-globale.ejs: FOUND
- gestion-locative/tests/unit/views/empty-state.test.ts: FOUND
- gestion-locative/tests/integration/web/relances-mailto.test.ts: FOUND
- gestion-locative/tests/bdd/features/gaps-g6-g7.feature: FOUND
- gestion-locative/tests/bdd/step_definitions/gaps-g6-g7.steps.ts: FOUND

Commits confirmed:
- b7d4fc3 (Task 1 G3): FOUND
- 3ca2f8e (Task 2 G4): FOUND
- 4c6bf65 (Task 3 G5): FOUND
- 7c28fa6 (Task 4 G6+G7): FOUND
- 78f184c (Task 5 G8): FOUND
