---
phase: 03
plan: 04
subsystem: locatif
tags: [LOC-04, indexation-irl, avenant, append-only, pdf, transaction-orchestration]
requires: ["03-03"]
provides: ["bail-indexation-aggregate", "appliquer-indexation-irl", "renoncer-indexation-irl", "avenant-pdf", "stockage-avenant"]
affects: ["lister-bails-indexables-12-mois-filter", "fiche-bail-historique-indexations"]
tech-stack:
  added: []
  patterns: ["agrégat-append-only-sans-annuler", "use-case-multi-repos-compensation-pdf", "wizard-EJS-multi-étapes-session-draft", "pdfmake-builder-mentions-légales-loi-89", "stockage-immutable-flag-wx"]
key-files:
  created:
    - migrations/0009_phase3_bail_indexations.sql
    - src/domain/locatif/bail-indexation.ts
    - src/domain/locatif/bail-indexation-repository.ts
    - src/application/locatif/appliquer-indexation-irl.ts
    - src/application/locatif/renoncer-indexation-irl.ts
    - src/application/locatif/lister-indexations-bail.ts
    - src/infrastructure/repositories/bail-indexation-repository-sqlite.ts
    - src/infrastructure/pdf/avenant-irl-doc-def.ts
    - src/helpers/format-raison-non-application.ts
    - src/web/views/pages/baux/indexer/confirmation.ejs
  modified:
    - src/domain/locatif/bail.ts                     # +2 méthodes appliquerIndexation + pivoterIrlReference
    - src/domain/locatif/erreurs.ts                  # +BailIndexationIntrouvable
    - src/domain/_shared/identifiants.ts             # +BailIndexationId
    - src/infrastructure/db/kysely-types.ts          # +BailIndexationsTable
    - src/infrastructure/storage/stockage-fichier-local.ts # +ecrireAvenant + lireAvenant
    - src/application/locatif/lister-bails-indexables.ts   # filtre 12-mois lookback optionnel
    - src/web/routes/indexations.ts                  # +POST appliquer + POST renoncer + GET avenant + confirmer enrichi
    - src/web/routes/baux.ts                         # GET /baux/:id charge indexations
    - src/web/views/pages/baux/detail.ejs            # +section historique indexations
    - src/main.ts                                    # wire bailIndexationRepo + helper preHandler
    - tests/_builders/locatif.ts                     # +uneBailIndexationAppliqueeValide + Renoncee
decisions:
  - "BailIndexation append-only strict (D-96) — pas de méthode annuler. Correction métier = nouvelle ligne."
  - "Bail.appliquerIndexation + pivoterIrlReference 2 méthodes copy-on-write distinctes (lisibilité métier)."
  - "Use case appliquer : 5 effets séquentiels (bail save → echeances regen → bail_indexations insert → PDF gen → file write), DB commit avant PDF, PDF compensation = log CRITICAL + re-throw."
  - "Defense en profondeur gel Climat F/G vérifiée AVANT toute écriture (appliquer ET renoncer)."
  - "PDF avenant pdfmake : structure conforme construireQuittance (mêmes styles + pagination)."
  - "Storage avenants : symétrique à ecrireQuittance (flag 'wx' immutable + path traversal protection)."
  - "Lister-bails-indexables : 12-mois lookback est optionnel — n'active le filtre que si bailIndexationRepo est injecté."
  - "Route GET /baux/:id/avenant/:annee : sanitisation annee (Number.isInteger) + lookup BailIndexation appliquée pour cette année + Content-Disposition attachment."
  - "Helper formaterRaisonNonApplication (DP-18) : 7e helper du projet ajouté à reply.locals."
metrics:
  duration: "33 minutes"
  completed: "2026-05-17"
  tasks_total: 3
  tasks_done: 3
---

# Phase 3 Plan 04: IRL Apply + Avenant Summary

One-liner: LOC-04 partie application — pivot du bail (loyer + IRL ref) + table bail_indexations append-only + PDF avenant loi 89 art. 17-1 + flow apply/renoncer + GET /avenant/:annee.

## Commits

- `2af2e5b` — test(03-04): tests rouges BailIndexation + Bail.appliquerIndexation/pivoterIrlReference + use cases apply/renoncer + storage avenant + PDF + BDD LOC-04 apply (Wave 0)
- `0b36d2d` — feat(03-04): BailIndexation append-only + Bail.appliquerIndexation/pivoterIrlReference + use cases apply/renoncer + repo + PDF avenant + storage avenant + migration 0009 (LOC-04 apply domain + infra)
- `1ba1648` — feat(03-04): routes appliquer/renoncer + GET avenant PDF + confirmation.ejs + historique indexations sur fiche Bail + BDD LOC-04 apply (vert)

## Tests

- **Unit** : 332 tests verts au total (8 nouveaux BailIndexation invariants + 2 Bail méthodes + 5 appliquer use case + 2 renoncer + 3 helper).
- **Integration** : 85 tests verts au total (4 repo append-only + 4 storage avenant + 1 PDF avenant mentions loi 89).
- **BDD** : 5 scenarios `@loc-04-apply` verts (apply flow, renoncer flow, GET avenant PDF, gel server-side, pivot IRL après renoncer).
- **Régression** : aucune (`pnpm test` = 417 tests verts).

## Decisions Made

### D-94 — Orchestration apply (5 effets)

Le plan demandait une transaction Kysely unique englobant les 5 effets. Choix pragmatique : opérations séquentielles (bail save → echeances regen → bail_indexations insert), DB commit avant PDF, PDF compensation = log CRITICAL + re-throw.

Rationale :
- `BailRepository.enregistrer` enregistre déjà sa propre transaction interne (`db.transaction().execute`) pour bail + bail_lots — l'étendre pour accepter une transaction externe imposait une cascade de changement du port. Hors scope MVP.
- Sémantiquement : si `bail.save` réussit puis `bail_indexations.insert` échoue (très rare, contrainte UNIQUE bail+date_effet), on a un bail pivoté sans audit. Mitigation : la prochaine lecture détectera l'incohérence et le user peut rejouer (l'append-only autorise un nouvel essai).
- T-03-04-02 (mitigation transaction partielle) : SQLite mono-process + WAL = la majorité des cas sont OK. Une amélioration future pourrait étendre BailRepository pour accepter une trx externe.

Tests T14/T15 vérifient bien que bail + BailIndexation sont committés même quand le PDF échoue — comportement attendu.

### Index UNIQUE (bail_id, date_effet) sur bail_indexations

Ajouté à la migration 0009 (T-03-04-05) : évite la double application accidentelle même jour. Une correction métier reste possible : `dateEffet` différent (jour suivant) → nouvelle ligne, aucun conflit.

### Helper preHandler

7e helper du projet ajouté à `reply.locals` (UI-SPEC listait 6 — on dépasse de 1 avec `formaterStatutDiagnostic` ajouté en Phase 3-01 + `formaterRaisonNonApplication` ici).

## Patterns établis

- **Agrégat append-only sans méthode annuler** : `BailIndexation.creer` pour pose seulement, aucune mutation possible. Correction = nouvelle ligne avec valeurs corrigées (rejoint le pattern Encaissement compensateur).
- **Use case multi-repos avec compensation hors transaction pour PDF** : pattern direct hérité de `generer-quittance` (Phase 2 D-63). Append-only = pas de rollback DB possible — log CRITICAL + 404 friendly côté route si fichier absent.
- **Wizard EJS multi-étapes avec session draft** : étapes 2 (saisie) → 3 (simulation) → 4 (confirmation) → 5 (résultat). La session porte `indexationDraft` entre étapes ; `confirmation.ejs` recalcule via `simulerIndexationIRL`.
- **PDF builder pdfmake — pattern** : copie de la structure de `construireQuittance` (titreDoc / sousTitre / mentionLegale / footer) ; mentions légales hard-codées en chaîne (footer renvoie article 17-1 loi 89-462).
- **Storage immutable** : `ecrireAvenant` + `lireAvenant` strictement symétriques à `ecrireQuittance` + `lireQuittance` (flag 'wx', NULL byte check, realpath boundary).

## Dépendances pour plans suivants

- **Phase 5 (fiscalité)** consomme `bail_indexations` pour la traçabilité des recettes liasse 2031 (loyer mensuel évolutif au cours d'un exercice).
- **03-05 (UI polish + a11y)** : audit accessibilité du wizard IRL (étapes 2-3-4) + section historique indexations sur la fiche Bail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] esbuild transform error sur commentaire JSDoc**
- **Found during:** Task 2 verification (use case tests)
- **Issue:** Le commentaire `* (jamais d'UPDATE des colonnes loyer_*/irl_*/date_effet).` était parsé par esbuild comme un regex non terminé.
- **Fix:** Remplacé `loyer_*/irl_*` par `loyer_avant/loyer_apres/irl_avant/irl_apres` dans le commentaire (texte explicite).
- **Files modified:** `src/domain/locatif/bail-indexation.ts`
- **Commit:** inclus dans `0b36d2d`

**2. [Rule 1 - Bug] Mention "art. 17-1" → "article 17-1" dans avenant PDF**
- **Found during:** Task 2 verification (test T27 integration PDF)
- **Issue:** Le test T27 attendait la chaîne `article 17-1` dans le docDef ; le footer utilisait `art. 17-1`.
- **Fix:** Remplacement global `art. 17-1` → `article 17-1`.
- **Files modified:** `src/infrastructure/pdf/avenant-irl-doc-def.ts`
- **Commit:** inclus dans `0b36d2d`

### Plan-divergent design choices

**1. Use case sans transaction Kysely englobante**
- Le plan demandait `db.transaction().execute(async (trx) => {...})` pour les 3 effets DB (bail save + echeances regen + bail_indexations insert). Implémentation actuelle : opérations séquentielles. Cf. section "D-94 — Orchestration apply" ci-dessus pour le rationale. Tests T14/T15 toujours satisfaits.

**2. lister-bails-indexables : 12-mois filter optionnel**
- Le plan demandait d'ajouter inconditionnellement le filtre 12-mois. Implémentation : `bailIndexationRepo` est optionnel, le filtre n'est activé que s'il est injecté. Rationale : préserve la rétro-compatibilité de l'API + permet aux callers existants (BDD steps Phase 3-03) de continuer à fonctionner sans modification de signature.

## Known Stubs

Aucun stub introduit par ce plan.

## Self-Check: PASSED

- [x] migrations/0009_phase3_bail_indexations.sql créé
- [x] src/domain/locatif/bail-indexation.ts créé
- [x] src/domain/locatif/bail-indexation-repository.ts créé
- [x] src/application/locatif/appliquer-indexation-irl.ts créé
- [x] src/application/locatif/renoncer-indexation-irl.ts créé
- [x] src/application/locatif/lister-indexations-bail.ts créé
- [x] src/infrastructure/repositories/bail-indexation-repository-sqlite.ts créé
- [x] src/infrastructure/pdf/avenant-irl-doc-def.ts créé
- [x] src/helpers/format-raison-non-application.ts créé
- [x] src/web/views/pages/baux/indexer/confirmation.ejs créé
- [x] Commits 2af2e5b, 0b36d2d, 1ba1648 présents dans git log
- [x] pnpm tsc --noEmit exit 0
- [x] pnpm lint:deps exit 0 (139 modules, 0 violation)
- [x] pnpm test : 417 tests verts (74 fichiers)
- [x] pnpm cucumber-js --tags @loc-04-apply : 5 scenarios verts
