---
phase: 04-coffre-documentaire-travaux
plan: "04"
plan_id: "04-04"
subsystem: documents-travaux-infra
completed: 2026-05-18
duration_minutes: 35
tags: [phase-4, gap-closure, security-hardening, ddd-purity, defense-in-depth]
requirements: [DOC-01, DOC-03, INC-01]

dependency_graph:
  requires: [04-01, 04-02, 04-03]
  provides: [gap-closure-CR-01, gap-closure-CR-03, gap-closure-CR-06, gap-closure-CR-04-05, gap-closure-CR-08]
  affects: [database.ts, lire-ticket.ts, uploader-justificatif.ts, stockage-justificatifs-local.ts, coffre.ts, valider-magic-bytes.ts]

tech_stack:
  added: []
  patterns:
    - activerPragmas() helper — per-connection PRAGMA pattern (SQLite)
    - RFC 6266 + RFC 8187 Content-Disposition encoding
    - Domain-pure slugify (ports & adapters strict)
    - Defense-in-depth path-traversal validation in adapter ecrire()
    - Magic-bytes sub-format validation (WebP VP8/VP8L/VP8X, HEIC box_size)

key_files:
  created:
    - src/domain/_shared/slug.ts
    - src/web/helpers/content-disposition.ts
    - tests/integration/db/foreign-keys-sentinel.test.ts
    - tests/unit/_shared/slug.test.ts
    - tests/unit/_shared/content-disposition.test.ts
  modified:
    - src/infrastructure/db/database.ts
    - src/application/travaux/lire-ticket.ts
    - src/application/documents/uploader-justificatif.ts
    - src/infrastructure/storage/stockage-justificatifs-local.ts
    - src/domain/documents/erreurs.ts
    - src/web/routes/coffre.ts
    - src/application/documents/valider-magic-bytes.ts
    - .dependency-cruiser.cjs
    - tests/unit/travaux/use-cases.test.ts
    - tests/unit/documents/valider-magic-bytes.test.ts
    - tests/bdd/features/travaux.feature
    - tests/bdd/step_definitions/travaux.steps.ts
    - tests/integration/storage/stockage-justificatifs-local.test.ts
    - tests/_world/monde-phase{2,3,4}.ts (+ 17 integration test files propagation activerPragmas)

decisions:
  - "PRAGMA foreign_keys = ON implémenté comme helper per-connection — pas en migration SQL (SQLite docs : le PRAGMA est per-connection, non persisté)"
  - "slugify déplacé dans domain/_shared (pur) — les violations depcruise pré-existantes (kysely-types.ts leakage, generer-quittance) exclues avec commentaire RISKS.md ; refactoring dédié nécessaire"
  - "no-application-to-infra activée avec pathNot exclusions pour violations pré-existantes non triviales à corriger dans ce plan"
  - "magicWebp() fixture de test mise à jour pour inclure sous-format VP8 (16 bytes minimum) ; magicHeic() mise à jour avec box_size=24 valide"
---

# Phase 04 — Plan 04 : Gap Closure Summary

Gap closure plan : fermeture de 5 findings issus de `04-VERIFICATION.md` (3 blockers + 2 partials) qui compromettaient les invariants D-109 (rétention 10 ans), D-113 (cascade asymétrique pivot N:N) et la pureté DDD revendiquée par `CLAUDE.md`.

## One-liner

PRAGMA foreign_keys activé par connexion + filtre corbeilleLe sur fiche ticket + slugify déplacé en domain/_shared + validation défensive ecrire() + RFC 6266 Content-Disposition + vérification sous-format WebP VP8/HEIC box_size

## Tâches exécutées

| Tâche | Commits | Statut |
|---|---|---|
| T1 — CR-01 : PRAGMA foreign_keys = ON + sentinel | 96f395a | VERT |
| T2 — CR-03 : Filtrer corbeilleLe dans lire-ticket | 2b63e70 | VERT |
| T3 — CR-06 : slugify dans domain/_shared + depcruise | f3f6b48 | VERT |
| T4 — CR-04+CR-05 : ecrire() défensif + RFC 6266 | 9a56c82 | VERT |
| T5 — CR-08 : WebP sous-format VP8 + HEIC box_size | 9b463e8 | VERT |

## Résultats des vérifications

| Check | Résultat |
|---|---|
| `pnpm tsc --noEmit` | Exit 0 |
| `pnpm test` (unit + integration) | 594 tests VERTS (573 existants + 21 nouveaux) |
| `pnpm test:bdd` | 112 scénarios VERTS (111 existants + 1 @gap-04) |
| `pnpm depcruise src` | 0 violation |
| `grep sqlite.pragma('foreign_keys = ON') database.ts` | 1 occurrence |
| `grep "PRAGMA foreign_keys = ON" ticket-travaux-test` | 0 occurrence (supprimé) |
| `grep StockageJustificatifsLocal.slugify src/ tests/` | 0 occurrence |
| `grep "import.*StockageJustificatifsLocal" src/application/` | 0 occurrence |
| `grep "corbeilleLe === null" lire-ticket.ts` | 1 occurrence |
| `grep encodeFilenameRFC6266 coffre.ts` | 2 occurrences (import + utilisation) |
| `grep VP8 valider-magic-bytes.ts` | 3 occurrences (VP8 , VP8L, VP8X) |
| `grep readUInt32BE valider-magic-bytes.ts` | 1 occurrence |

## Gaps fermés

### CR-01 (blocker) — PRAGMA foreign_keys = ON

**Problème :** `ouvrirDb()` n'appelait jamais `sqlite.pragma('foreign_keys = ON')`. La cascade D-113 (`ON DELETE CASCADE` sur `ticket_justificatifs.ticket_id`) était silencieusement désactivée en prod. Le test cascade activait le PRAGMA manuellement, masquant le bug.

**Fix :**
- `src/infrastructure/db/database.ts` : helper exporté `activerPragmas(sqlite)` + appel dans `ouvrirDb()`
- `tests/integration/db/foreign-keys-sentinel.test.ts` : test sentinel prouvant que `ouvrirDb()` active le PRAGMA
- 17 fichiers tests propagés (toutes les connexions `new Database(':memory:')` appellent maintenant `activerPragmas`)
- Activation manuelle dans `ticket-travaux-repository-sqlite.test.ts:271` supprimée

### CR-03 (blocker) — Filtre corbeilleLe dans lire-ticket

**Problème :** `lire-ticket.ts:50` incluait les Justificatifs soft-deleted dans les résultats. La fiche ticket affichait des PJ en corbeille avec un lien cassé.

**Fix :**
- `src/application/travaux/lire-ticket.ts:50` : `if (j && j.corbeilleLe === null)`
- Test unitaire `use-cases.test.ts` : "filtre les Justificatifs en corbeille (CR-03)"
- Scénario BDD T16 `@gap-04 @inc-01` + steps associés dans `travaux.steps.ts`

### CR-06 (blocker) — slugify dans domain/_shared

**Problème :** `uploader-justificatif.ts` importait `StockageJustificatifsLocal` (infra) uniquement pour appeler `slugify`. Violation hexagonale `application/ → infrastructure/` non couverte par depcruise.

**Fix :**
- `src/domain/_shared/slug.ts` : fonction pure `slugify` (copiée verbatim depuis l'infra)
- `uploader-justificatif.ts` : import `slugify` depuis `domain/_shared/slug.js`
- `stockage-justificatifs-local.ts` : méthode statique `slugify` supprimée
- `.dependency-cruiser.cjs` : règle `no-application-to-infra` (severity: error) activée
- 5 tests unit `slug.test.ts`

### CR-04+CR-05 (partial) — Validation défensive ecrire() + RFC 6266

**Problème :** `ecrire()` n'avait aucune validation défensive sur slug/ext/annee avant `path.join`. Le header `Content-Disposition` interpolait `nomFichierOriginal` sans escape.

**Fix :**
- `src/domain/documents/erreurs.ts` : classe `CheminInvalide` exportée
- `src/infrastructure/storage/stockage-justificatifs-local.ts` : `ecrire()` valide slug (`^[a-z0-9-]{1,80}$`), ext (`^[a-z0-9]{1,5}$`), annee (1900–2200), puis startsWith baseDir
- `src/web/helpers/content-disposition.ts` : helper `encodeFilenameRFC6266()` conforme RFC 6266 + RFC 8187
- `src/web/routes/coffre.ts` : utilise `encodeFilenameRFC6266` sur `Content-Disposition`
- 4 tests unit RFC 6266 + 3 tests integration validation `ecrire()`

### CR-08 (partial) — Magic-bytes WebP sous-format + HEIC box_size

**Problème :** Un fichier `RIFF...WEBP` suivi d'un payload arbitraire passait la validation. HEIC sans box_size valide pouvait passer.

**Fix :**
- `src/application/documents/valider-magic-bytes.ts` : branche WebP vérifie `subType ∈ {VP8 , VP8L, VP8X}` (offset 12-15). Branche HEIC vérifie `box_size = readUInt32BE(0) >= 16 && <= bytes.length`
- 7 nouveaux tests (4 WebP + 3 HEIC)
- Fixtures existantes `magicWebp()` et `magicHeic()` mises à jour pour inclure les nouvelles contraintes

## Déviations du plan

### [Rule 1 - Bug] Fixtures de test magicWebp/magicHeic incompatibles avec CR-08

**Trouvé lors :** Task 5 (CR-08)
**Problème :** Les fixtures `magicWebp()` (12 bytes, pas de subType) et `magicHeic()` (12 bytes, pas de box_size) ne satisfaisaient plus les nouvelles contraintes. Les tests existants auraient cassé sans mise à jour.
**Fix :** `magicWebp()` étendue à 16 bytes avec sous-type VP8  par défaut. `magicHeic()` étendue à 24 bytes avec box_size=24 valide.
**Fichiers modifiés :** `tests/unit/documents/valider-magic-bytes.test.ts`
**Commit :** 9b463e8

### [Rule 2 - Missing critical] stockage-justificatifs-local.test.ts référençait StockageJustificatifsLocal.slugify

**Trouvé lors :** Task 3 (CR-06)
**Problème :** Après suppression de `StockageJustificatifsLocal.slugify`, le test d'intégration utilisait encore l'ancienne API et causait une erreur TypeScript.
**Fix :** Test mis à jour pour importer `slugify` depuis `domain/_shared/slug.ts`.
**Fichiers modifiés :** `tests/integration/storage/stockage-justificatifs-local.test.ts`
**Commit :** f3f6b48

### [Architectural note] Violations pré-existantes no-application-to-infra

**Trouvé lors :** Task 3 (depcruise avec règle no-application-to-infra)
**Contexte :** 10 violations pré-existantes (kysely-types.ts leakage, generer-quittance.ts → stockage/pdf infra) ne pouvaient pas être corrigées dans le scope de ce plan (Rule 4 — changements architecturaux non triviaux).
**Traitement :** Ajout de `pathNot` exclusions dans la règle avec commentaire documentant le refactoring nécessaire. La règle est active pour les nouveaux fichiers. Ces violations sont trackées pour un plan de refactoring dédié (RISKS.md).

## Known Stubs

Aucun stub identifié — toutes les fonctions créées ou modifiées sont pleinement opérationnelles.

## Threat Flags

Aucune nouvelle surface de sécurité non couverte par le threat model du plan.

## Self-Check: PASSED

Fichiers vérifiés :
- `src/infrastructure/db/database.ts` : FOUND
- `tests/integration/db/foreign-keys-sentinel.test.ts` : FOUND
- `src/domain/_shared/slug.ts` : FOUND
- `src/web/helpers/content-disposition.ts` : FOUND
- Commits 96f395a, 2b63e70, f3f6b48, 9a56c82, 9b463e8 : tous présents dans git log
