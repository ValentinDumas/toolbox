---
phase: 01-activation-bien-locataire-bail
plan: "03"
subsystem: patrimoine-crud
tags: [patrimoine, crud, bien, lot, hexagonal, zod, ejs, tdd]
dependency_graph:
  requires:
    - walking-skeleton (plan 01-02)
  provides:
    - CRUD-Bien-complet
    - multi-lots-gestion
    - Zod-schemas-bien-lot
    - EJS-partials-form-field-data-table-confirm-dialog
    - use-cases-modifier-supprimer-lister-ajouter-lot-supprimer-lot
  affects:
    - plan 04 (Locataire — réutilise form-field, data-table, confirm-dialog, BienIntrouvable pattern)
    - plan 05 (Bail — même partials EJS)
    - plan 06 (Wizard — réutilise routes structure et layout-debut/fin)
tech_stack:
  added:
    - "Zod schemas (déjà présent) — activé via src/web/schemas/bien-schemas.ts"
    - "EJS include system — layout-debut/layout-fin partials pour pages sans contenu-string"
  patterns:
    - "normaliserLotsFormBody(body) — regroupe lots[N].XXX FormData en tableau avant Zod"
    - "layout-debut.ejs + layout-fin.ejs — split layout pour inclusions EJS natives dans les pages"
    - "Bien.modifier(patch) copy-on-write — re-valide tous invariants via Bien.creer()"
    - "repo.supprimer() cascade soft-delete — transaction Kysely bien + lots"
    - "extraireErreurs(issues) — ZodIssue[] → Record<string, string> pour re-render"
    - "BienIntrouvable extends Error — erreur domaine patrimoine séparée de InvariantViolated"
    - "tests/_builders/patrimoine.ts — factories unBienValide/unLotValide (BDD_PRACTICES §9)"
key_files:
  created:
    - gestion-locative/src/web/schemas/bien-schemas.ts
    - gestion-locative/src/web/views/pages/biens/formulaire.ejs
    - gestion-locative/src/web/views/pages/biens/detail.ejs
    - gestion-locative/src/web/views/partials/form-field.ejs
    - gestion-locative/src/web/views/partials/data-table.ejs
    - gestion-locative/src/web/views/partials/confirm-dialog.ejs
    - gestion-locative/src/web/views/partials/layout-debut.ejs
    - gestion-locative/src/web/views/partials/layout-fin.ejs
    - gestion-locative/src/application/patrimoine/modifier-bien.ts
    - gestion-locative/src/application/patrimoine/supprimer-bien.ts
    - gestion-locative/src/application/patrimoine/lister-biens.ts
    - gestion-locative/src/application/patrimoine/ajouter-lot.ts
    - gestion-locative/src/application/patrimoine/supprimer-lot.ts
    - gestion-locative/src/domain/patrimoine/erreurs.ts
    - gestion-locative/tests/_builders/patrimoine.ts
    - gestion-locative/tests/unit/patrimoine/lot.test.ts
  modified:
    - gestion-locative/src/domain/patrimoine/bien.ts (modifier, supprimerLot)
    - gestion-locative/src/infrastructure/repositories/bien-repository-sqlite.ts (cascade soft-delete)
    - gestion-locative/src/web/routes/biens.ts (CRUD complet — 8 routes)
    - gestion-locative/src/web/views/pages/biens/liste.ejs (data-table + confirm-dialog + link /biens/nouveau)
    - gestion-locative/tests/unit/patrimoine/bien.test.ts (+5 tests)
    - gestion-locative/tests/integration/repositories/bien-repository-sqlite.test.ts (+4 tests)
    - gestion-locative/tests/bdd/step_definitions/activation.steps.ts (lots[0].designation format)
    - gestion-locative/src/infrastructure/db/kysely-types.ts (fix ColumnType unused)
    - gestion-locative/src/main.ts (fix missing return type)
decisions:
  - "layout-debut.ejs + layout-fin.ejs introduits — la stratégie contenu-string de plan 02 ne permet pas les include EJS imbriqués (include() ne peut pas être dans un template literal JS)"
  - "normaliserLotsFormBody regroupe les champs lots[N].XXX avant Zod — FormData x-www-form-urlencoded ne supporte pas les arrays nativement"
  - "BienIntrouvable dans src/domain/patrimoine/erreurs.ts — séparation des erreurs domaine patrimoine vs InvariantViolated (_shared)"
  - "repo.supprimer() cascade via transaction Kysely — soft-delete lots en même transaction que le bien (cohérence agrégat DDD)"
  - "BDD step mis à jour pour lots[0].designation — rétro-compat maintenue (surface lot injectée si type appartement)"
  - "Formulaire inline plan 02 retiré de liste.ejs — remplacé par lien /biens/nouveau"
metrics:
  duration: "25 minutes"
  completed_date: "2026-05-14"
  tasks_completed: 3
  tasks_total: 3
  files_created: 16
  files_modified: 9
---

# Phase 01 Plan 03: Patrimoine CRUD Summary

**One-liner:** CRUD Bien complet multi-lots — Bien.modifier/supprimerLot immuables, 5 use cases, Zod schemas FormData, 3 partials EJS réutilisables (form-field/data-table/confirm-dialog), 19 tests verts.

## Tests Green

| Suite | Fichier | Tests |
|-------|---------|-------|
| Unit Lot | tests/unit/patrimoine/lot.test.ts | 5 verts |
| Unit Bien | tests/unit/patrimoine/bien.test.ts | 8 verts |
| Integration repo | tests/integration/repositories/bien-repository-sqlite.test.ts | 6 verts |
| BDD | tests/bdd/features/activation.feature | 1 scenario, 5 steps verts |

**Total : 5 unit Lot + 8 unit Bien + 6 integration = 19 tests verts + 1 BDD scenario green.**

## Partials EJS réutilisables

### `form-field.ejs`
```ejs
<%- include('../../partials/form-field', {
  id: 'rue', name: 'rue', label: 'Rue',
  value: valeurs.rue || '',
  required: true,
  hint: null,
  erreur: erreurs.rue || null
}) %>
```
Génère : `<div class="field">` + label + input + `aria-describedby` + `role="alert"` error span.

### `data-table.ejs`
```ejs
<%- include('../../partials/data-table', {
  ariaLabel: 'Liste des biens',
  colonnes: [{ titre: 'Adresse' }, { titre: 'Surface', numerique: true }, { titre: 'Actions', srOnly: true }],
  lignes: biens.map(b => [b.adresse.enLigne(), b.surface + ' m²']),
  actions: function(ligne, i) { return '<a href="/biens/' + biens[i].id + '">Voir</a>'; }
}) %>
```
Génère : `<table aria-label>` + sticky thead + zebra tbody + row-actions hover.

### `confirm-dialog.ejs`
```ejs
<%- include('../../partials/confirm-dialog', {
  id: 'dialog-supprimer-X',
  formAction: '/biens/' + b.id + '/supprimer',
  message: 'Supprimer ... ? Cette action est irréversible.',
  confirmLabel: 'Supprimer définitivement',
  cancelLabel: 'Annuler'
}) %>
<button type="button" data-open-dialog="dialog-supprimer-X">Supprimer</button>
```
Génère : `<dialog>` natif + `autofocus` sur Annuler + bouton `#dc2626`.

## FormData lots[N].XXX pattern

Pour Plans 04-05 héritant du pattern multi-entités :

```
POST /biens body (x-www-form-urlencoded):
  rue=...&codePostal=...&ville=...&surface=...&type=...&anneeConstruction=...
  &lots[0].designation=Appt+A&lots[0].type=appartement&lots[0].surface=50&lots[0].etage=1
  &lots[1].designation=Cave&lots[1].type=cave&lots[1].surface=&lots[1].etage=
```

`normaliserLotsFormBody(body)` regroupe en `[{ designation, type, surface, etage }, ...]` avant passage à `bienCreationSchema.safeParse()`.

## Routes CRUD Bien

| Méthode | Route | Use case | Résultat |
|---------|-------|----------|---------|
| GET | /biens | listerBiens | 200 liste tabulée |
| GET | /biens/nouveau | — | 200 formulaire création |
| POST | /biens | creerBien | 302 /biens/:id ou re-render avec erreurs |
| GET | /biens/:id | trouverParId | 200 détail ou 404 |
| GET | /biens/:id/modifier | trouverParId | 200 formulaire pré-rempli |
| POST | /biens/:id/modifier | modifierBien | 302 /biens/:id |
| POST | /biens/:id/supprimer | supprimerBien | 302 /biens |
| POST | /biens/:id/lots | ajouterLot | 302 /biens/:id |
| POST | /biens/:id/lots/:lotId/supprimer | supprimerLot | 302 ou 400 si dernier lot |

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 — tests rouges | 88d4629 | test(01-03): unit Lot rouge + invariants Bien étendus + integration update/soft-delete rouges |
| Task 2 — domaine + use cases | 1d71dea | feat(01-03): domaine — Bien.modifier/supprimerLot + BienIntrouvable + 5 use cases + repo cascade soft-delete |
| Task 3 — routes + EJS | 55d6085 | feat(01-03): Zod schemas + routes /biens CRUD complet + EJS partials form-field/data-table/confirm-dialog |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] layout.ejs contenu-string incompatible avec include() EJS**
- **Found during:** Task 3
- **Issue:** La stratégie plan 02 (contenu = template string JS) empêche les appels `<%- include(...) %>` imbriqués — EJS include ne peut être invoqué que dans un contexte EJS, pas depuis un template literal JS.
- **Fix:** Création de `layout-debut.ejs` et `layout-fin.ejs` — les pages wrappent leur contenu avec ces deux partials au lieu de construire une string `contenu`. `layout.ejs` conservé tel quel pour rétro-compatibilité BDD.
- **Files modified:** 2 nouveaux partials, pages formulaire/detail/liste refactorisées
- **Commit:** 55d6085

**2. [Rule 2 - Pre-existing errors] ColumnType unused + missing return type**
- **Found during:** Task 3 (pnpm lint gate)
- **Issue:** `src/infrastructure/db/kysely-types.ts` importait `ColumnType` inutilisé (plan 02). `src/main.ts` avait une arrow function sans type de retour (plan 02).
- **Fix:** Suppression import `ColumnType` ; ajout `: Promise<void>` sur `cleanup`.
- **Files modified:** kysely-types.ts, main.ts
- **Commit:** 55d6085

**3. [Rule 1 - Bug] BDD step uses old lot1_designation format**
- **Found during:** Task 3 (BDD non-regression check anticipée)
- **Issue:** Le step `activation.steps.ts` soumettait `lot1_designation` / `lot1_type` (format plan 02). Le nouveau POST /biens attend `lots[0].designation` / `lots[0].type`.
- **Fix:** Step mis à jour pour envoyer `lots[0].designation`, `lots[0].type`, `lots[0].surface` (conditionnel selon type), `lots[0].etage`.
- **Files modified:** tests/bdd/step_definitions/activation.steps.ts
- **Commit:** 55d6085

## Known Stubs

Aucun stub bloquant. Les éléments suivants sont intentionnels (portés à Plans 04-07) :
- `src/web/routes/racine.ts` : branche wizard toujours inactive (Plan 06)
- Nav sidebar : liens Locataires/Baux `href="#" aria-disabled="true"` (Plans 04/05)

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input-tampering | src/web/routes/biens.ts | POST /biens/:id/lots — lotId URL param non validé comme UUID avant passage à supprimerLot — mitigé par trouverParId(bienId) qui retourne null si invalide |

T-03-01 à T-03-06 mitigés comme prévu : Zod schemas rejettent valeurs hors enum/format, normaliserLotsFormBody valide structure avant Zod, limit max(50) lots.

## Self-Check: PASSED

Fichiers vérifiés :
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/web/schemas/bien-schemas.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/web/views/partials/form-field.ejs
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/web/views/partials/data-table.ejs
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/web/views/partials/confirm-dialog.ejs
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/application/patrimoine/modifier-bien.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/application/patrimoine/supprimer-lot.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/domain/patrimoine/erreurs.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/tests/_builders/patrimoine.ts

Commits vérifiés :
- FOUND: 88d4629 (Task 1 — RED tests)
- FOUND: 1d71dea (Task 2 — domaine + use cases)
- FOUND: 55d6085 (Task 3 — routes + EJS)
