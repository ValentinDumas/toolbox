---
phase: 02-quittancement-ch-ances-encaissements-relances
reviewed: 2026-05-14T23:55:00Z
depth: standard
files_reviewed: 116
files_reviewed_list:
  - migrations/0002_phase2_bailleur_bail_ext.sql
  - migrations/0003_phase2_echeance_loyer.sql
  - migrations/0004_phase2_encaissement.sql
  - migrations/0005_phase2_quittance.sql
  - migrations/0006_phase2_relance.sql
  - src/application/encaissements/activer-bail.ts
  - src/application/encaissements/annuler-encaissement.ts
  - src/application/encaissements/annuler-quittance.ts
  - src/application/encaissements/calculer-relance-disponible.ts
  - src/application/encaissements/creer-encaissement.ts
  - src/application/encaissements/enregistrer-relance.ts
  - src/application/encaissements/generer-quittance.ts
  - src/application/encaissements/lister-echeances.ts
  - src/application/encaissements/lister-encaissements.ts
  - src/application/encaissements/lister-relances.ts
  - src/application/encaissements/recalculer-statut-echeance.ts
  - src/application/identite/creer-ou-maj-bailleur.ts
  - src/application/locatif/desactiver-bail.ts
  - src/application/locatif/modifier-bail-actif.ts
  - src/application/locatif/supprimer-bail.ts
  - src/domain/_shared/clock.ts
  - src/domain/_shared/identifiants.ts
  - src/domain/_shared/money.ts
  - src/domain/encaissements/echeance-loyer-repository.ts
  - src/domain/encaissements/echeance-loyer.ts
  - src/domain/encaissements/encaissement-repository.ts
  - src/domain/encaissements/encaissement.ts
  - src/domain/encaissements/erreurs.ts
  - src/domain/encaissements/impaye.ts
  - src/domain/encaissements/pdf-renderer.ts
  - src/domain/encaissements/quittance-repository.ts
  - src/domain/encaissements/quittance.ts
  - src/domain/encaissements/relance-repository.ts
  - src/domain/encaissements/relance.ts
  - src/domain/encaissements/template-renderer.ts
  - src/domain/identite/bailleur-repository.ts
  - src/domain/identite/bailleur.ts
  - src/domain/identite/erreurs.ts
  - src/domain/locatif/activite-bail-detector.ts
  - src/domain/locatif/bail.ts
  - src/helpers/build-mailto.ts
  - src/helpers/format-numero-quittance.ts
  - src/helpers/format-periode.ts
  - src/infrastructure/db/database.ts
  - src/infrastructure/db/kysely-types.ts
  - src/infrastructure/pdf/avis-echeance-doc-def.ts
  - src/infrastructure/pdf/mise-en-demeure-doc-def.ts
  - src/infrastructure/pdf/pdf-renderer-pdfmake.ts
  - src/infrastructure/pdf/quittance-doc-def.ts
  - src/infrastructure/repositories/activite-bail-detector-sqlite.ts
  - src/infrastructure/repositories/bail-repository-sqlite.ts
  - src/infrastructure/repositories/bailleur-repository-sqlite.ts
  - src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts
  - src/infrastructure/repositories/encaissement-repository-sqlite.ts
  - src/infrastructure/repositories/quittance-repository-sqlite.ts
  - src/infrastructure/repositories/relance-repository-sqlite.ts
  - src/infrastructure/storage/stockage-fichier-local.ts
  - src/infrastructure/templates/template-renderer-ejs.ts
  - src/main.ts
  - src/web/routes/bailleur.ts
  - src/web/routes/baux.ts
  - src/web/routes/echeances.ts
  - src/web/routes/encaissements.ts
  - src/web/routes/impayes.ts
  - src/web/routes/quittances.ts
  - src/web/routes/relances.ts
  - src/web/routes/wizard.ts
  - src/web/schemas/bailleur-schemas.ts
  - src/web/schemas/encaissement-schemas.ts
  - src/web/schemas/quittance-schemas.ts
  - src/web/schemas/relance-schemas.ts
  - src/web/views/pages/bailleur/profil.ejs
  - src/web/views/pages/baux/activer.ejs
  - src/web/views/pages/baux/detail.ejs
  - src/web/views/pages/baux/modifier.ejs
  - src/web/views/pages/echeances/liste.ejs
  - src/web/views/pages/encaissements/fiche.ejs
  - src/web/views/pages/encaissements/formulaire.ejs
  - src/web/views/pages/encaissements/liste.ejs
  - src/web/views/pages/impayes/liste.ejs
  - src/web/views/pages/quittances/fiche.ejs
  - src/web/views/pages/quittances/liste.ejs
  - src/web/views/pages/relances/liste.ejs
  - src/web/views/partials/banniere-warning.ejs
  - src/web/views/partials/relance-action.ejs
  - src/web/views/partials/sidebar-nav.ejs
  - src/web/views/partials/warning-live.ejs
  - templates/relances/01-amiable.ejs
  - templates/relances/02-ferme.ejs
  - templates/relances/03-mise-en-demeure.ejs
  - tests/_builders/encaissements.ts
  - tests/_builders/identite.ts
  - tests/_builders/locatif.ts
  - tests/_world/monde-phase2.ts
  - tests/bdd/features/bailleur.feature
  - tests/bdd/features/enc02-activation-bail.feature
  - tests/bdd/features/encaissements.feature
  - tests/bdd/features/modifier-bail-actif.feature
  - tests/bdd/features/quittancement.feature
  - tests/bdd/features/quittances.feature
  - tests/bdd/features/relances.feature
  - tests/bdd/step_definitions/activation.steps.ts
  - tests/bdd/step_definitions/bailleur.steps.ts
  - tests/bdd/step_definitions/quittancement.steps.ts
  - tests/bdd/step_definitions/quittances.steps.ts
  - tests/bdd/step_definitions/relances.steps.ts
  - tests/integration/pdf/mise-en-demeure.test.ts
  - tests/integration/pdf/quittance.test.ts
  - tests/integration/repositories/bail-repository-sqlite.test.ts
  - tests/integration/repositories/bailleur-repository-sqlite.test.ts
  - tests/integration/repositories/bien-repository-sqlite.test.ts
  - tests/integration/repositories/echeance-loyer-repository-sqlite.test.ts
  - tests/integration/repositories/encaissement-repository-sqlite.test.ts
  - tests/integration/repositories/locataire-repository-sqlite.test.ts
  - tests/integration/repositories/quittance-repository-sqlite.test.ts
  - tests/integration/repositories/relance-repository-sqlite.test.ts
  - tests/integration/storage/stockage-fichier-local.test.ts
  - tests/unit/_shared/clock.test.ts
  - tests/unit/encaissements/activer-bail.test.ts
  - tests/unit/encaissements/annuler-encaissement.test.ts
  - tests/unit/encaissements/calculer-relance-disponible.test.ts
  - tests/unit/encaissements/creer-encaissement.test.ts
  - tests/unit/encaissements/encaissement.test.ts
  - tests/unit/encaissements/enregistrer-relance.test.ts
  - tests/unit/encaissements/generer-quittance.test.ts
  - tests/unit/encaissements/lister-impayes.test.ts
  - tests/unit/encaissements/quittance.test.ts
  - tests/unit/encaissements/recalculer-statut-echeance.test.ts
  - tests/unit/encaissements/relance.test.ts
  - tests/unit/helpers/build-mailto.test.ts
  - tests/unit/helpers/format-numero-quittance.test.ts
  - tests/unit/identite/bailleur.test.ts
  - tests/unit/locatif/bail.test.ts
  - tests/unit/locatif/desactiver-bail.test.ts
  - tests/unit/locatif/modifier-bail-actif.test.ts
  - tests/unit/locatif/supprimer-bail.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 2: Code Review Report (Re-Review #3 — final)

**Reviewed:** 2026-05-14T23:55:00Z
**Depth:** standard
**Files Reviewed:** 116
**Status:** clean

## Summary

Re-review #3 (final) après 3 itérations de fixes. **Tous les findings précédents sont traités**. Le code est désormais propre selon les critères de revue (correctness, security, maintainability).

### Récapitulatif des fixes validés sur les 11 findings de la revue #2

**Critical résolu :**
- **CR-01** (`bail-repository-sqlite.enregistrer` — UPSERT `.doUpdateSet` bypass de l'assert overflow) : commit `561afe0`. Les lignes 48, 50, 51 utilisent maintenant `bail.loyerHc.toSqliteInteger()`, `bail.montantCharges.toSqliteInteger()` et `bail.depotGarantie.toSqliteInteger()`, identique au chemin INSERT (lignes 32, 34, 35). Le chemin de mise à jour profite désormais de l'assert `MAX_SAFE_INTEGER`.

**Warnings résolus :**
- **WR-01** (`ActiviteBailDetectorSqlite` — docstring vs implémentation) : commit `84e3172`. L'adapter chaîne désormais les 3 checks (`echeance_loyer` puis `encaissement` via join puis `quittance` via join) avec court-circuit OR. Le filtre `annule_le IS NULL` retiré sur `echeance_loyer`. Plus de risque d'orphelins encaissement/quittance après hard-delete.
- **WR-02** (`generer-quittance.ts` — compensation silencieuse) : commit `f73b717`. Le `catch (compErr)` interne (lignes 164-172) log explicitement `[CRITICAL] generer-quittance compensation failed for quittance {id} ({numero})` avec instruction SQL de cleanup manuel. L'opérateur peut désormais détecter et corriger l'incohérence.
- **WR-03** (`recalculer-statut-echeance.ts` — erreur générique) : commit `b56b2eb`. Ligne 38 lève `EcheanceLoyerIntrouvable(String(echeanceId))` au lieu de `new Error(...)` générique. Les callers (`annulerEncaissement`, `creerEncaissement`) peuvent maintenant distinguer la cause via `instanceof`.
- **WR-04** (`activer-bail.ts` branche morte + `baux.ts` imports dynamiques) : commit `9c558e3`. La branche morte ligne 126-130 (cas `i === 0 && i === dureeMois - 1` impossible par D-35 dureeMois ≥ 12) est supprimée et un commentaire l'explique. Les imports dynamiques `_T`, `_M`, `_IRL`, `_Addr` sont retirés de `baux.ts` (les modules sont statiquement importés en tête de fichier).

**Info résolus :**
- **IN-01** (test régression WR-08 Encaissement 0€) : commit `db4e3ff`. Le test "WR-08: rejette montant = 0 €" couvre la garde (lignes 40-47 de `encaissement.test.ts`).
- **IN-02** (test régression CR-05 statut 'annulee' préservé) : commit `d705f3f`. Le test "CR-05: échéance déjà annulée → préserve statut annulee, pas de mettreAJourStatut" vérifie le statut retourné ET l'absence d'appel à `mettreAJourStatut` (lignes 106-137 de `recalculer-statut-echeance.test.ts`).
- **IN-03** (test régression WR-04 troncature mailto au milieu de %XX) : commit `afbbf98` + `9d06eff`. Test "WR-04: troncature recule si elle tomberait au milieu d'une séquence %XX" reproduit le scénario pathologique et vérifie `decodeURIComponent` ne jette pas (lignes 56-83 de `build-mailto.test.ts`).
- **IN-04** (dead code `listerQuittances` + `compterParBail`) : commit `f684b94`. Le fichier `src/application/encaissements/lister-quittances.ts` est supprimé. La méthode `compterParBail` est retirée de l'interface `EcheanceLoyerRepository` et de l'adapter SQLite. Plus aucune référence en source.
- **IN-05** (commentaire SQLite 3.31 requirement) : commit `ec4090b`. La note "Requiert SQLite ≥ 3.31. better-sqlite3 ^11 bundle ≥ 3.42" est ajoutée dans `migrations/0002_phase2_bailleur_bail_ext.sql` (lignes 12-15).
- **IN-06** (test typing Bail via builder) : commit `8e8ec92`. `creer-encaissement.test.ts` utilise désormais `unBailValide().activer(...)` pour produire un vrai `Bail` typé, avec helper `creerBailActif()` qui type-checke l'API agrégat.

### Vérifications complémentaires (sweep final)

- Aucun `Number(*.toCentimes())` résiduel dans les chemins INFRA (`src/infrastructure/repositories/*.ts`). Les seules occurrences en source (`baux.ts:310,312,313,458,460,461`) divisent par 100 pour l'affichage UI (centimes → euros pour `<input type="number">`) — pas de stockage SQLite, pas de risque overflow.
- Aucun `console.log` hors `src/infrastructure/db/database.ts:111,116` (CLI migrate — usage légitime).
- Aucune fonction dangereuse (`eval`, `innerHTML`, `dangerouslySetInnerHTML`, `exec`, `system`) dans la base code.
- Aucun `as any` dans le code production. Les `as never` n'apparaissent que dans les tests stubs (acceptable pour mocks).
- CSP, X-Content-Type-Options, Referrer-Policy correctement appliqués via hook `onSend` (`main.ts:135-143`).
- `SESSION_SECRET` fail-fast avec assert ≥ 32 chars (`main.ts:66-73`).
- Chemin path-traversal protection : `fs.realpath` + null-byte check + double barrière `startsWith(baseDir + sep)` (`stockage-fichier-local.ts:39-81`).
- Migrations 0003-0006 SQL : contraintes `CHECK` cohérentes (statut, mode, niveau, canal), indexes partiels pour les requêtes hot-path (`statut != 'payee'`, `annule_le IS NULL`).
- Domaine pur : aucun import infrastructure dans `src/domain/` ni `src/application/` (TemplateRenderer + PdfRenderer + Clock + Repos sont des ports).
- Snapshot Relance.contenuSnapshot bien JSON-typed avec champ `version: 'v1'` pour migrations futures (D-69 audit-friendly).
- UPSERT compteur quittance atomique avec `CAST(meta.valeur AS INTEGER) + 1` + `RETURNING` (CR-03) — testé en intégration.
- Compensation transactionnelle quittance PDF : copy-on-write `Quittance.annuler` + double-catch avec log (CR-02 + WR-02).

### Hors-périmètre signalé pour info (non-bloquant)

Aucun finding actif. Le code est prêt pour clôture de phase 2.

---

_Reviewed: 2026-05-14T23:55:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: re-review #3 — confirmation clean après 3 itérations de fix_
