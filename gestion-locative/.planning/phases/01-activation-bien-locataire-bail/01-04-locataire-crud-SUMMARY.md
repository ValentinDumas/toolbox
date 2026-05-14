---
phase: 01-activation-bien-locataire-bail
plan: "04"
subsystem: locatif-crud
tags: [locataire, crud, ddd, hexagonal, zod, ejs, tdd, temporal]
dependency_graph:
  requires:
    - walking-skeleton (plan 01-02)
    - patrimoine-crud (plan 01-03)
  provides:
    - CRUD-Locataire-complet
    - LocataireRepository-port-and-sqlite-adapter
    - Locataire-domain-entity-invariants
    - Zod-schemas-locataire
    - EJS-pages-locataires-liste-formulaire-detail
    - sidebar-nav-locataires-active
    - unLocataireValide-builder
  affects:
    - plan 05 (Bail — consomme LocataireRepository.trouverParId pour relier Bail à Locataire)
    - plan 06 (Wizard — réutilise creerLocataire use case)
tech_stack:
  added:
    - "@js-temporal/polyfill — Temporal.PlainDate.from(isoString) ↔ .toString() pour date_naissance SQLite"
  patterns:
    - "Temporal.PlainDate ↔ string ISO : .toString() vers SQLite, Temporal.PlainDate.from(row.date_naissance) depuis SQLite"
    - "Entité Locataire immutable — factory Locataire.creer() + invariants + modifier() copy-on-write"
    - "LieuNaissance VO inline (commune/pays) — validerLieuNaissance() helper privé"
    - "REGEX_EMAIL_MINIMAL côté domaine + z.string().email() côté HTTP (séparation responsabilité)"
    - "Temporal.PlainDate.compare(date, Temporal.Now.plainDateISO()) >= 0 → invariant futur"
    - "LocataireIntrouvable extends Error dans src/domain/locatif/erreurs.ts — même style BienIntrouvable"
    - "formatDate(PlainDate) → DD/MM/YYYY helper local dans les routes (format légal français)"
    - "navActive='locataires' passé aux vues → aria-current='page' sur le lien sidebar"
    - "locataireModificationSchema = locataireCreationSchema.partial() — PATCH style"
key_files:
  created:
    - gestion-locative/src/domain/locatif/locataire.ts
    - gestion-locative/src/domain/locatif/locataire-repository.ts
    - gestion-locative/src/domain/locatif/erreurs.ts
    - gestion-locative/src/infrastructure/repositories/locataire-repository-sqlite.ts
    - gestion-locative/src/application/locatif/creer-locataire.ts
    - gestion-locative/src/application/locatif/modifier-locataire.ts
    - gestion-locative/src/application/locatif/supprimer-locataire.ts
    - gestion-locative/src/application/locatif/lister-locataires.ts
    - gestion-locative/src/web/routes/locataires.ts
    - gestion-locative/src/web/schemas/locataire-schemas.ts
    - gestion-locative/src/web/views/pages/locataires/liste.ejs
    - gestion-locative/src/web/views/pages/locataires/formulaire.ejs
    - gestion-locative/src/web/views/pages/locataires/detail.ejs
    - gestion-locative/tests/_builders/locatif.ts
    - gestion-locative/tests/unit/locatif/locataire.test.ts
    - gestion-locative/tests/integration/repositories/locataire-repository-sqlite.test.ts
  modified:
    - gestion-locative/src/main.ts (LocataireRepositorySqlite + locatairesPlugin)
    - gestion-locative/src/web/views/partials/layout-debut.ejs (Locataires cliquable + aria-current)
decisions:
  - "LieuNaissance VO inline dans locataire.ts (pas de fichier dédié) — V1 simplicité (D-32 YAGNI)"
  - "Regex email minimal côté domaine (/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/) — validation RFC complète déléguée à Zod z.string().email()"
  - "Invariant date_naissance : Temporal.PlainDate.compare >= 0 → rejet (aujourd'hui inclus — on ne naît pas aujourd'hui pour être locataire)"
  - "telephone: string | null — champ optionnel conservé null si non fourni"
  - "Adresse actuelle sur la fiche Locataire (pas l'adresse du bien) — mentions obligatoires LOCATION_MEUBLEE_REGLES §9.1"
  - "Section 'Baux associés' stub vide dans detail.ejs — Plan 05 la peuplera (D-33 : cautionnement sur Bail, pas Locataire)"
  - "formatDate helper local dans routes — pas de module partagé pour éviter l'over-engineering V1"
  - "navActive passé via locals EJS + aria-current='page' (standard HTML) plutôt que classe CSS ad hoc"
metrics:
  duration: "29 minutes"
  completed_date: "2026-05-14"
  tasks_completed: 3
  tasks_total: 3
  files_created: 16
  files_modified: 2
---

# Phase 01 Plan 04: Locataire CRUD Summary

**One-liner:** CRUD Locataire complet — entité hexagonale immutable avec invariants identité/contact, adapter SQLite Temporal.PlainDate↔ISO, 4 use cases, Zod schemas, 3 vues EJS réutilisant partials plan 03, sidebar nav active.

## Tests Green

| Suite | Fichier | Tests |
|-------|---------|-------|
| Unit Locataire | tests/unit/locatif/locataire.test.ts | 8 verts |
| Integration LocataireRepository | tests/integration/repositories/locataire-repository-sqlite.test.ts | 4 verts |
| Unit Lot (plan 03 carryover) | tests/unit/patrimoine/lot.test.ts | 5 verts |
| Unit Bien (plan 03 carryover) | tests/unit/patrimoine/bien.test.ts | 8 verts |
| Integration BienRepository (plan 03 carryover) | tests/integration/repositories/bien-repository-sqlite.test.ts | 6 verts |
| BDD | tests/bdd/features/activation.feature | 1 scenario, 5 steps verts |

**Total : 31 tests verts + 1 BDD scenario green.**

## Partials EJS réutilisés (plan 03 — zéro duplication)

- `form-field.ejs` — tous les champs du formulaire locataire (nom, prénom, date, email, etc.)
- `data-table.ejs` — table locataires avec colonnes Nom Prénom / Email / Téléphone / Ville
- `confirm-dialog.ejs` — dialog destructif sur liste et détail locataire

## Temporal.PlainDate ↔ string ISO (pattern pour Plan 05 Bail.date_debut)

```typescript
// Vers SQLite (dans versRow) :
date_naissance: locataire.dateNaissance.toString()
// → Temporal.PlainDate.toString() retourne "YYYY-MM-DD"

// Depuis SQLite (dans versDomaine) :
dateNaissance: Temporal.PlainDate.from(row.date_naissance)
// → Temporal.PlainDate.from("YYYY-MM-DD") reconstruit l'objet

// Invariant domaine (rejet futur) :
if (Temporal.PlainDate.compare(props.dateNaissance, Temporal.Now.plainDateISO()) >= 0) {
  throw new InvariantViolated('La date de naissance doit être dans le passé');
}
```

Plan 05 appliquera le même pattern pour `bail.date_debut`.

## helper formatDate injecté en EJS locals

```typescript
// Dans src/web/routes/locataires.ts
function formatDate(date: Temporal.PlainDate): string {
  const j = String(date.day).padStart(2, '0');
  const m = String(date.month).padStart(2, '0');
  return `${j}/${m}/${date.year}`;
}
// Passé comme local : reply.view('pages/locataires/detail.ejs', { formatDate, ... })
// Utilisé dans EJS : <%= formatDate(locataire.dateNaissance) %> → "15/06/1985"
```

## Builder `unLocataireValide` pour Plan 05

```typescript
// tests/_builders/locatif.ts — extension future Plan 05 ajoutera unBailValide
export function unLocataireValide(overrides: OverridesLocataire = {}): Locataire {
  return Locataire.creer({
    id: overrides.id,
    nom: overrides.nom ?? 'Dupont',
    prenom: overrides.prenom ?? 'Marie',
    dateNaissance: overrides.dateNaissance ?? Temporal.PlainDate.from('1985-06-15'),
    lieuNaissance: { commune: overrides.communeNaissance ?? 'Paris', pays: overrides.paysNaissance ?? 'France' },
    nationalite: overrides.nationalite ?? 'française',
    email: overrides.email ?? 'marie@example.fr',
    telephone: overrides.telephone !== undefined ? overrides.telephone : '0123456789',
    adresseActuelle: Adresse.creer({ ... }),
  });
}
```

## Routes CRUD Locataire

| Méthode | Route | Use case | Résultat |
|---------|-------|----------|---------|
| GET | /locataires | listerLocataires | 200 liste ou empty state |
| GET | /locataires/nouveau | — | 200 formulaire création |
| POST | /locataires | creerLocataire | 302 /locataires/:id ou re-render erreurs |
| GET | /locataires/:id | trouverParId | 200 détail ou 404 |
| GET | /locataires/:id/modifier | trouverParId | 200 formulaire pré-rempli |
| POST | /locataires/:id/modifier | modifierLocataire | 302 /locataires/:id |
| POST | /locataires/:id/supprimer | supprimerLocataire | 302 /locataires |

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 — tests rouges (TDD RED) | 8a4fce9 | test(01-04): unit Locataire rouge + integration repo rouge |
| Task 2 — domaine + use cases (TDD GREEN) | 5059f01 | feat(01-04): domaine Locataire + port + adapter SQLite + use cases CRUD |
| Task 3 — routes + EJS + sidebar | 0e092ee | feat(01-04): routes /locataires CRUD + Zod schemas + EJS pages liste/formulaire/detail + sidebar active |

## Deviations from Plan

None — plan executed exactly as written. TDD RED/GREEN cycle respected. YAGNI maintained (D-32 : pas de pièces/documents, D-33 : pas de garant sur fiche — section "Baux associés" stub vide).

## Known Stubs

- `src/web/views/pages/locataires/detail.ejs` : section "Baux associés" affiche "Aucun bail pour l'instant." — Plan 05 la peuplera avec les baux réels liés au locataire.

## Threat Flags

T-04-01 à T-04-05 tous mitigés comme prévu :
- T-04-01 (POST tampering) : Zod `locataireCreationSchema` + invariants domaine.
- T-04-04 (URL id forgery) : UUID v4 + `trouverParId` retourne null → 404.
- T-04-05 (email validation) : regex domaine + `z.string().email()` HTTP.

Aucune nouvelle surface réseau hors plan.

## Self-Check: PASSED

Fichiers vérifiés :
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/domain/locatif/locataire.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/domain/locatif/locataire-repository.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/infrastructure/repositories/locataire-repository-sqlite.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/application/locatif/creer-locataire.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/web/routes/locataires.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/web/schemas/locataire-schemas.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/web/views/pages/locataires/liste.ejs
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/tests/_builders/locatif.ts

Commits vérifiés :
- FOUND: 8a4fce9 (Task 1 — RED)
- FOUND: 5059f01 (Task 2 — GREEN)
- FOUND: 0e092ee (Task 3 — routes + EJS)
