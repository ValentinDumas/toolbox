---
phase: 06-liasse-2031-cfe
plan: 06
status: complete
type: tdd
requirements: [FIS-06]
tags: [fiscalite, cfe, suivi-declaratif, agregat-racine]
self_check: PASSED
key_files:
  created:
    - src/domain/fiscalite/cfe/statut-cfe.ts
    - src/domain/fiscalite/cfe/declaration-cfe.ts
    - src/domain/fiscalite/cfe/declaration-cfe-repository.ts
    - src/infrastructure/repositories/declaration-cfe-repository-sqlite.ts
    - migrations/0023_phase6_declaration_cfe.sql
    - src/application/fiscalite/enregistrer-declaration-cfe.ts
    - src/application/fiscalite/modifier-declaration-cfe.ts
    - src/application/fiscalite/lister-declarations-cfe-par-bien.ts
    - src/web/schemas/cfe-schemas.ts
    - src/web/routes/biens/cfe.ts
    - src/web/helpers/formater-statut-cfe.ts
    - src/web/helpers/formater-millesime-cfe.ts
    - src/web/views/pages/biens/cfe/nouvelle.ejs
    - src/web/views/pages/biens/cfe/editer.ejs
    - src/web/views/partials/partial-carte-cfe.ejs
    - src/web/views/partials/partial-badge-statut-cfe.ejs
    - src/web/views/partials/partial-aide-cfe.ejs
    - tests/unit/fiscalite/declaration-cfe.test.ts
    - tests/integration/repositories/declaration-cfe-repository-sqlite.test.ts
    - tests/integration/web/route-cfe.test.ts
    - tests/bdd/features/cfe-suivi-declaratif.feature
    - tests/bdd/step_definitions/cfe.steps.ts
  modified:
    - src/domain/_shared/identifiants.ts
    - src/domain/fiscalite/erreurs.ts
    - src/infrastructure/db/kysely-types.ts
    - src/main.ts
    - src/web/routes/biens.ts
    - src/web/views/pages/biens/detail.ejs
    - tests/_builders/fiscalite.ts
---

# Plan 06-06 — Fondation suivi déclaratif CFE (FIS-06)

## Self-Check: PASSED

Tous les `must_haves` du plan vérifiés via tests automatisés + lint:deps + grep R4.3 absolu.

## Ce qui a été livré

### Domaine
- **`DeclarationCfe`** : agrégat racine BC Fiscalité (D-CFE6.2), référence `BienId` par identifiant
  (jamais sous-agrégat de `Bien`), pattern miroir `TicketTravaux`.
- **`StatutCfe`** : type union strict 5 valeurs (D-CFE6.3) + `STATUTS_CFE_VALIDES` + `LIBELLES_STATUT_CFE`.
- **`DeclarationCfeId`** : brand UUID v4 dans `_shared/identifiants.ts` (pattern miroir `TicketTravauxId`).
- **Invariants D-CFE6.3** ordonnés dans `creer()` :
  - statut ∈ `STATUTS_CFE_VALIDES`.
  - millésime ∈ `[2020, 2030]`.
  - `statut === 'deposee'` ⇒ `dateDepotDeclaration` non null.
  - `statut === 'payee'` ⇒ `dateDepotDeclaration` ET `montantAvisCentimes` non null.
  - `exoneree_*` autorisés sans dépôt ni montant (D-CFE6.4).
- **`modifier(patch)`** copy-on-write avec pattern `'field' in patch` pour les nullables
  (anti-écrasement silencieux — RESEARCH §Pattern 3).
- **Erreur typée** `DeclarationCfeIntrouvable` (this.name explicite).

### Infrastructure
- **Migration `0023_phase6_declaration_cfe.sql`** :
  ```sql
  CREATE TABLE IF NOT EXISTS declarations_cfe (
    id                       TEXT PRIMARY KEY,
    bien_id                  TEXT NOT NULL REFERENCES bien(id),
    millesime                INTEGER NOT NULL,
    statut                   TEXT NOT NULL CHECK (statut IN (
      'non_deposee','deposee','exoneree_premiere_annee','exoneree_commune','payee'
    )),
    date_depot_declaration   TEXT NULL,
    montant_avis_centimes    INTEGER NULL,
    date_echeance_paiement   TEXT NOT NULL,
    UNIQUE (bien_id, millesime)
  );
  ```
- **`DeclarationCfeRepositorySqlite`** : upsert composite `onConflict.columns(['bien_id','millesime']).doUpdateSet(...)`
  — la clé d'idempotence métier est composite, PAS `id` (D-CFE6.2).
- **Kysely types** : `StatutCfeRow` + `DeclarationsCfeTable` + entrée dans `DB`.

### Application
- **`enregistrerDeclarationCfe`** : charge `Bien` (throw `BienIntrouvable` si absent) →
  `DeclarationCfe.creer(props)` (relaie `InvariantViolated`) → `cfeRepo.enregistrer`.
- **`modifierDeclarationCfe`** : charge → copy-on-write `.modifier(patch)` → upsert
  (throw `DeclarationCfeIntrouvable` si id inconnu).
- **`listerDeclarationsCfeParBien`** : wrapper léger trié `millesime DESC`.

### Web
- **Routes** : GET `/biens/:id/cfe/nouvelle`, POST `/biens/:id/cfe`, GET `/biens/:id/cfe/:cfeId/editer`,
  POST `/biens/:id/cfe/:cfeId/modifier`. Cross-bien check (T-06-CFE6-05) sur la modification.
- **Zod schemas** `enregistrerCfeSchema` + `modifierCfeSchema` : pas de `id` ni `bienId`
  dans le body (anti-mass-assignment T-06-CFE6-01) ; `montantAvisEuros` converti
  en `Money.fromEuros` côté route.
- **Vues EJS** : `nouvelle.ejs` (formulaire), `editer.ejs` (réutilise `nouvelle.ejs` avec `mode=edition`).
- **Partials** :
  - `partial-aide-cfe.ejs` (UI-SPEC §S9 — repliable, CGI art. 1478, lien SIE
    `rel="noopener noreferrer"`, AUCUN calcul de base imposable).
  - `partial-badge-statut-cfe.ejs` (UI-SPEC §S8 — badge couleur + icône WCAG 1.4.1).
  - `partial-carte-cfe.ejs` (UI-SPEC §S8 — carte par millésime sur fiche Bien).
- **Helpers** : `formaterStatutCfe`, `formaterMillesimeCfe`.
- **Fiche Bien** étendue : section "Cotisation Foncière des Entreprises (CFE)"
  avec empty-state ou liste de cartes.
- **DI `main.ts`** : `cfeRepo` instancié, `registerBiensCfeRoutes` enregistré, passé à `biensPlugin`.

### Tests
| Type | Fichier | Résultat |
|---|---|---|
| Unit domaine | `tests/unit/fiscalite/declaration-cfe.test.ts` | 22/22 GREEN |
| Intégration repo SQLite | `tests/integration/repositories/declaration-cfe-repository-sqlite.test.ts` | 5/5 GREEN |
| Intégration routes HTTP | `tests/integration/web/route-cfe.test.ts` | 5/5 GREEN |
| BDD `@phase6-cfe-suivi` | `tests/bdd/features/cfe-suivi-declaratif.feature` | 6/6 scénarios, 31 steps GREEN |

**Total Plan 06-06 : 38 tests verts.**

## Décisions implémentées

| Décision | Implémentation |
|---|---|
| D-CFE6.1 — suivi déclaratif | Routes/vues ne reproduisent PAS le 1447-C-SD case-par-case (juste statut + dates + montant). |
| D-CFE6.2 — agrégat racine | `DeclarationCfe` dans `domain/fiscalite/cfe/`, brand `DeclarationCfeId`, FK `bien_id REFERENCES bien(id)`. |
| D-CFE6.3 — 5 statuts + invariants | `STATUTS_CFE_VALIDES` + invariants `creer()` typés. |
| D-CFE6.4 — exonération première année | `partial-aide-cfe.ejs` cite CGI art. 1478 + statut `exoneree_premiere_annee` autorisé sans dépôt/montant. |
| R4.3 — pas de calcul base imposable | `grep -rE "calculer.*base|valeur.*locative"` → 0 résultat sur tous les fichiers Phase 6 CFE. |

## Anti-patterns évités (vérifiés grep)

- ✓ Aucun import `pdfmake|kysely|fastify|zod|fs|path` dans `src/domain/fiscalite/cfe/`.
- ✓ Aucune ligne `calculer.*base|valeur.*locative` dans le domaine/application/web CFE (R4.3 verrouillé).
- ✓ `onConflict.columns(['bien_id', 'millesime'])` (composite), PAS `onConflict.column('id')`.
- ✓ Aucun Zod dans `application/fiscalite/*-cfe.ts` (D-15).
- ✓ `lint:deps` exit 0 (262 modules, 1273 deps).

## Capture ASCII — Section CFE sur fiche Bien

### Empty state (aucune déclaration)
```
┌─────────────────────────────────────────────────────────────┐
│ Cotisation Foncière des Entreprises (CFE)                   │
│                                                             │
│ Aucune déclaration CFE enregistrée pour ce bien. La CFE est │
│ due par tout LMNP (CGI art. 1447) — votre première année    │
│ d'activité est exonérée ; vous recevrez ensuite un avis     │
│ de votre commune en octobre/novembre.                       │
│                                                             │
│ [ Enregistrer une déclaration CFE ]                         │
└─────────────────────────────────────────────────────────────┘
```

### Liste (au moins 1 déclaration)
```
┌─────────────────────────────────────────────────────────────┐
│ Cotisation Foncière des Entreprises (CFE)                   │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ CFE 2026 — déposée le 10/12/2026                        │ │
│ │ | échéance paiement : 15/12/2026     [⚠ Déposée]        │ │
│ │ [Modifier]                                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [ Enregistrer une nouvelle déclaration CFE ]                │
└─────────────────────────────────────────────────────────────┘
```

## Backlog pour Plan 06-07 (slice 7 FIS-06 — alerte J-30)

- `listerDeclarationsCfeParBien` déjà implémenté et injectable.
- `cfeRepo` accessible via `main.ts` et `biens.ts`.
- Manque : use case `listerAlertesCfeActives` (filtre `dateEcheancePaiement` à J-30) +
  partial `partial-bandeau-cfe-echeance.ejs` + intégration sur fiche bien et `/fiscalite`.

## Commits (8 atomiques)

1. `test(06-06): tests unit DeclarationCfe + StatutCfe (RED)`
2. `feat(06-06): brand DeclarationCfeId + erreur DeclarationCfeIntrouvable`
3. `feat(06-06): agregat racine DeclarationCfe + StatutCfe + invariants D-CFE6.3` (GREEN)
4. `test(06-06): builder uneDeclarationCfe`
5. `feat(06-06): migration 0023 declarations_cfe + kysely types`
6. `test(06-06): tests integration repo SQLite + scenarios BDD cfe-suivi-declaratif (RED)`
7. `feat(06-06): port + adapter SQLite DeclarationCfeRepository (upsert composite) + use cases` (GREEN)
8. `feat(06-06): routes biens/cfe + schemas Zod + vues nouvelle/editer + partials S8/S9`
9. `feat(06-06): DI DeclarationCfeRepositorySqlite + integration section CFE sur fiche Bien`
