---
phase: 02-quittancement-ch-ances-encaissements-relances
verified: 2026-05-14T20:45:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
deferred: []
human_verification: []
---

# Phase 02: Quittancement — Vérification

**Phase Goal:** L'utilisateur peut piloter le cycle complet de perception du loyer sur un bail existant : émettre l'avis d'échéance, encaisser, quittancer, identifier les retards, relancer.
**Verified:** 2026-05-14T20:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | L'utilisateur peut générer un avis d'échéance PDF à partir d'un Bail actif | VERIFIED | `src/web/routes/echeances.ts` GET /echeances/:id/avis-pdf → `construireAvisEcheance` → `pdfRenderer.genererBuffer` → Content-Disposition attachment. BDD 36/36 passed. |
| 2 | L'utilisateur peut saisir un Encaissement ; un paiement partiel n'émet pas de Quittance | VERIFIED | `src/application/encaissements/creer-encaissement.ts` recalcul statut idempotent ; `src/web/routes/quittances.ts` vérifie `echeance.statut === 'payee'` (via `EcheanceLoyerNonPayee` erreur). BDD @enc-03 scenarios passent. |
| 3 | L'utilisateur peut générer une Quittance PDF uniquement pour une période entièrement payée | VERIFIED | `src/application/encaissements/generer-quittance.ts` — invariant `EcheanceLoyerNonPayee` throw si statut != 'payee'. PDF persisté dans `~/Library/Application Support/…` via `StockageFichierLocal`. Numérotation AAAA-NNN atomique via transaction Kysely. Mentions loi 89 art. 21 + "Tous comptes apurés" dans `quittance-doc-def.ts`. |
| 4 | Le système calcule et affiche les impayés et retards par locataire et par période | VERIFIED | `src/domain/encaissements/impaye.ts` — `calculerImpaye()` fonction pure : `estEnRetard`, `joursDeRetard`, `resteDu`. `listerImpayes()` agrège via `echeanceLoyerRepo.listerNonPayees()` + `encaissementRepo.sommePaieeParEcheance()`. Route GET /impayes + vue `pages/impayes/liste.ejs`. Filtre `?locataire=`. Empty state "Tous les loyers sont à jour". BDD 4 scenarios @enc-04 passent. |
| 5 | L'utilisateur peut déclencher des Relances escaladées (amiable → mise en demeure) avec templates email | VERIFIED | `src/application/encaissements/calculer-relance-disponible.ts` — `SEUILS_RELANCE_JOURS={1:10,2:30,3:60}`, chaînage strict D-71. `enregistrerRelance` — canal `email` (mailto RFC 6068 via `buildMailto`) ou `pdf` (PDF mise en demeure art. 1344). Templates EJS externes dans `templates/relances/`. `relance-action.ejs` partial conditionnel sur `/impayes`. Route GET/POST /relances. BDD 7 scenarios @enc-05 passent. |

**Score:** 5/5 truths verified

### Requirement ID Coverage

| Requirement | Plan | Description | Status | Evidence |
|-------------|------|-------------|--------|----------|
| ENC-01 | 02-04 | Quittance PDF pour période entièrement payée | SATISFIED | `generer-quittance.ts` + `quittance-doc-def.ts` + `stockage-fichier-local.ts` + `quittances.ts` route. 6 BDD scenarios @enc-01. |
| ENC-02 | 02-02 | Avis d'échéance PDF + génération EcheanceLoyer | SATISFIED | `activer-bail.ts` + `avis-echeance-doc-def.ts` + `pdf-renderer-pdfmake.ts` + route `/echeances/:id/avis-pdf`. Prorata 1ère ET dernière échéance (Test 21.bis BDD). |
| ENC-03 | 02-03 | Saisie Encaissement, paiements partiels sans quittance | SATISFIED | `creer-encaissement.ts` + `annuler-encaissement.ts` + `recalculer-statut-echeance.ts`. Soft-delete `annule_le`. Compensateur `Money.compensateur(positif)`. 5 BDD scenarios @enc-03. |
| ENC-04 | 02-05 | Calcul impayés et retards par locataire et période | SATISFIED | `impaye.ts` (`calculerImpaye`, `listerImpayes`). `estEnRetard` dérivé non stocké (D-55). Filtre locataire. 4 BDD scenarios @enc-04. |
| ENC-05 | 02-06 | Relances escaladées amiable → mise en demeure | SATISFIED | `calculer-relance-disponible.ts` + `enregistrer-relance.ts` + `build-mailto.ts` + `mise-en-demeure-doc-def.ts`. Chaînage strict D-71. 7 BDD scenarios @enc-05. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `migrations/0002_phase2_bailleur_bail_ext.sql` | Migration bailleur + ALTER bail | VERIFIED | Exists, substantive, applied at startup |
| `migrations/0003_phase2_echeance_loyer.sql` | Table echeance_loyer | VERIFIED | Exists |
| `migrations/0004_phase2_encaissement.sql` | Table encaissement (soft-delete) | VERIFIED | Exists |
| `migrations/0005_phase2_quittance.sql` | Table quittance + meta compteur | VERIFIED | Exists |
| `migrations/0006_phase2_relance.sql` | Table relance | VERIFIED | Exists |
| `src/domain/_shared/clock.ts` | Port Clock + ClockSysteme + ClockFixe | VERIFIED | Exists, exports all 3, used in creerApp |
| `src/domain/identite/bailleur.ts` | Agrégat Bailleur singleton | VERIFIED | Exists, invariant nomComplet.trim() != '' |
| `src/domain/encaissements/echeance-loyer.ts` | Agrégat EcheanceLoyer | VERIFIED | Exists, statut invariant + total = loyerHc + charges |
| `src/domain/encaissements/encaissement.ts` | Agrégat Encaissement + soft-delete | VERIFIED | Exists, annuler() copy-on-write |
| `src/domain/encaissements/quittance.ts` | Agrégat Quittance + annuler() | VERIFIED | Exists, numéro AAAA-NNN invariant |
| `src/domain/encaissements/relance.ts` | Agrégat Relance + NiveauRelance + CanalRelance | VERIFIED | Exists, 1|2|3 validation, annuler() copy-on-write |
| `src/domain/encaissements/impaye.ts` | DTO Impaye + calculerImpaye + listerImpayes | VERIFIED | Exists, estEnRetard dérivé non stocké |
| `src/domain/encaissements/pdf-renderer.ts` | Port PdfRenderer | VERIFIED | Exists, domain-pur (unknown docDef type) |
| `src/domain/locatif/activite-bail-detector.ts` | Port ActiviteBailDetector | VERIFIED | Exists |
| `src/application/encaissements/activer-bail.ts` | Use case activation + N EcheanceLoyer + prorata | VERIFIED | Exists, genererEcheancesPour exported, D-72 warning |
| `src/application/encaissements/creer-encaissement.ts` | Use case saisie Encaissement | VERIFIED | Exists, recalcul statut, D-61 warnings |
| `src/application/encaissements/recalculer-statut-echeance.ts` | Use case recalcul idempotent | VERIFIED | Exists, sommePaieeParEcheance |
| `src/application/encaissements/generer-quittance.ts` | Use case émission Quittance + compteur atomique | VERIFIED | Exists, prochainNumero in transaction |
| `src/application/encaissements/calculer-relance-disponible.ts` | Fonction pure niveauDisponible | VERIFIED | Exists, SEUILS_RELANCE_JOURS, chaînage strict |
| `src/application/encaissements/enregistrer-relance.ts` | Use case create Relance + mailto/pdf | VERIFIED | Exists, TemplateRenderer port injecté |
| `src/application/locatif/modifier-bail-actif.ts` | Use case D-73 modification bail actif | VERIFIED | Exists, preview compteurs + double confirm UX |
| `src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts` | Adapter SQLite EcheanceLoyer | VERIFIED | Exists, enregistrerBatch transaction |
| `src/infrastructure/repositories/encaissement-repository-sqlite.ts` | Adapter SQLite Encaissement | VERIFIED | Exists, sommePaieeParEcheance |
| `src/infrastructure/repositories/quittance-repository-sqlite.ts` | Adapter SQLite Quittance + prochainNumero | VERIFIED | Exists |
| `src/infrastructure/repositories/relance-repository-sqlite.ts` | Adapter SQLite Relance | VERIFIED | Exists |
| `src/infrastructure/repositories/activite-bail-detector-sqlite.ts` | Adapter v2 (echeance_loyer count) | VERIFIED | Exists — counts echeance_loyer non-annulées. Note: encaissement + quittance count not added (02-03/02-04 promises), but functionally sufficient since all encaissements/quittances require an echeance. |
| `src/infrastructure/pdf/pdf-renderer-pdfmake.ts` | Adapter pdfmake (CJS-in-ESM, Roboto TTF) | VERIFIED | Exists, createRequire pattern, setUrlAccessPolicy(false) |
| `src/infrastructure/pdf/avis-echeance-doc-def.ts` | DocDef avis d'échéance | VERIFIED | Exists |
| `src/infrastructure/pdf/quittance-doc-def.ts` | DocDef quittance loi 89 art. 21 | VERIFIED | "Tous comptes apurés" + "article 21 de la loi n° 89-462" present |
| `src/infrastructure/pdf/mise-en-demeure-doc-def.ts` | DocDef mise en demeure | VERIFIED | Exists, compress:false for testability |
| `src/infrastructure/storage/stockage-fichier-local.ts` | Persistance PDF local (~/Library/…) | VERIFIED | Exists, flag 'wx' immutabilité, slugify whitelist |
| `src/infrastructure/templates/template-renderer-ejs.ts` | Adapter TemplateRenderer EJS | VERIFIED | Exists |
| `src/web/routes/bailleur.ts` | Routes GET/POST /bailleur | VERIFIED | Exists, upsert creerOuMajBailleur, sidebar lien |
| `src/web/routes/echeances.ts` | Routes activer + liste + avis-pdf | VERIFIED | Exists, 4 routes wired |
| `src/web/routes/encaissements.ts` | Routes CRUD Encaissement | VERIFIED | Exists |
| `src/web/routes/quittances.ts` | Routes CRUD Quittance + /pdf | VERIFIED | Exists |
| `src/web/routes/impayes.ts` | Route GET /impayes + filtre locataire | VERIFIED | Exists, niveauxDisponibles calculés en temps réel |
| `src/web/routes/relances.ts` | Routes GET/POST /relances + /pdf | VERIFIED | Exists, TemplateRendererEjs + PdfRendererPdfmake instanciés inline |
| `src/helpers/build-mailto.ts` | Helper RFC 6068 + truncation 1900 chars | VERIFIED | Exists, %0D%0A CRLF |
| `src/helpers/format-periode.ts` | Helper formatPeriode fr-FR | VERIFIED | Exists |
| `templates/relances/01-amiable.ejs` | Template EJS amiable | VERIFIED | Exists |
| `templates/relances/02-ferme.ejs` | Template EJS ferme | VERIFIED | Exists |
| `templates/relances/03-mise-en-demeure.ejs` | Template EJS mise en demeure | VERIFIED | Exists |
| `src/web/views/partials/sidebar-nav.ejs` | Liens sidebar complets | VERIFIED | Contient: Profil bailleur, Encaissements (group dépliable), Quittances, Impayés, Relances |
| `src/web/views/pages/echeances/liste.ejs` | Page liste échéances | VERIFIED | Exists, colonnes Période/Échéance/Loyer HC/Charges/Total/Statut/Actions |
| `src/web/views/pages/encaissements/formulaire.ejs` | Formulaire saisie Encaissement | VERIFIED | Exists |
| `src/web/views/pages/quittances/liste.ejs` | Page liste quittances | VERIFIED | Exists |
| `src/web/views/pages/impayes/liste.ejs` | Page impayés + total global | VERIFIED | Exists, empty state "Tous les loyers sont à jour" |
| `src/web/views/pages/relances/liste.ejs` | Page liste relances | VERIFIED | Exists |
| `src/web/views/partials/relance-action.ejs` | Partial bouton relance conditionnel | VERIFIED | Exists, niveaux 1/2/3 buttons + "Télécharger la mise en demeure PDF" |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main.ts` | tous les plugins | register() avec repos injectés | WIRED | 6 plugins enregistrés: bailleur, echeances, encaissements, quittances, impayes, relances |
| `src/application/encaissements/activer-bail.ts` | `src/domain/_shared/money.ts` | `loyerHc.multiplyByFraction(joursOccupes, joursInMois, 'banker')` | WIRED | Prorata 1ère ET dernière échéance avec BigInt banker's rounding |
| `src/web/routes/echeances.ts` | `src/infrastructure/pdf/pdf-renderer-pdfmake.ts` | `pdfRenderer.genererBuffer(construireAvisEcheance(...))` | WIRED | Content-Disposition attachment PDF |
| `src/web/routes/baux.ts` | `src/application/encaissements/activer-bail.ts` | POST /baux/:id/activer → `activerBail(commande, bailRepo, echeanceLoyerRepo, clock)` | WIRED | Redirect avec bannière succès |
| `src/application/encaissements/creer-encaissement.ts` | `src/application/encaissements/recalculer-statut-echeance.ts` | `recalculerStatutEcheance(echeanceId, repos)` après persistance | WIRED | Statut auto-recalculé après chaque encaissement |
| `src/application/encaissements/recalculer-statut-echeance.ts` | `src/infrastructure/repositories/encaissement-repository-sqlite.ts` | `sommePaieeParEcheance(id)` | WIRED | SUM montant_centimes WHERE annule_le IS NULL |
| `src/application/encaissements/generer-quittance.ts` | table `meta` (compteur_quittance_{annee}) | `prochainNumero` dans transaction Kysely | WIRED | Atomique — incrémentation + INSERT quittance en une transaction |
| `src/application/encaissements/generer-quittance.ts` | `src/infrastructure/storage/stockage-fichier-local.ts` | `stockage.ecrireQuittance(numero, periode, locataireSlug, buffer)` | WIRED | PDF persisté localement, flag 'wx' immutabilité |
| `src/application/encaissements/calculer-relance-disponible.ts` | `src/domain/_shared/clock.ts` | `clock.aujourdhui()` vs `jourEcheanceAttendue + SEUILS_RELANCE_JOURS[niveau]` | WIRED | Seuils J+10/J+30/J+60, chaînage strict |
| `src/application/encaissements/enregistrer-relance.ts` | `templates/relances/*.ejs` | `ejs.render(fs.readFileSync(path), variables)` via TemplateRendererEjs | WIRED | Templates rendus côté serveur |
| `src/web/routes/relances.ts` | `src/helpers/build-mailto.ts` | niveaux 1-2: `buildMailto({to, subject, body: contenuRendu})` | WIRED | URI mailto RFC 6068, %0D%0A CRLF |
| `src/web/views/pages/impayes/liste.ejs` | `src/web/views/partials/relance-action.ejs` | `include('../../partials/relance-action', { echeanceId, niveauDisponible })` | WIRED | Bouton conditionnel par niveau calculé en temps réel |
| `src/application/locatif/supprimer-bail.ts` | `src/domain/locatif/activite-bail-detector.ts` | `if (await activiteBailDetector.aDeLActivite(id)) throw InvariantViolated(...)` | WIRED | D-74 — suppression refusée si activité |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `pages/impayes/liste.ejs` | `impayes` | `listerImpayes()` → `echeanceLoyerRepo.listerNonPayees()` + `encaissementRepo.sommePaieeParEcheance()` | SQLite queries, real data | FLOWING |
| `pages/echeances/liste.ejs` | `echeances` | `listerEcheancesParBail()` → `EcheanceLoyerRepositorySqlite.listerParBail()` | SQLite ORDER BY periode_debut ASC | FLOWING |
| `pages/quittances/liste.ejs` | `quittancesEnrichies` | `quittanceRepo.listerToutes()` + enrichissement async (echeance + locataire) | SQLite queries | FLOWING |
| `pages/relances/liste.ejs` | `lignes` | `listerRelances()` + enrichissement async (echeance + bail + locataire) | SQLite queries | FLOWING |
| `pages/bailleur/profil.ejs` | `bailleur` | `bailleurRepo.trouver()` → `BailleurRepositorySqlite.trouver()` | SQLite SELECT, null if absent | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit tests (229 tests) | `pnpm test` | 41 files, 229 passed | PASS |
| BDD scenarios (36 scenarios) | `pnpm test:bdd` | 36 scenarios, 189 steps, 0 failures | PASS |
| TypeScript compilation | `pnpm tsc --noEmit` | 0 errors | PASS |
| Dependency cruiser | `pnpm lint:deps` | 0 violations (105 modules, 461 dependencies) | PASS |

### Probe Execution

No probe scripts found or declared. Step skipped.

### Requirements Coverage

All 5 ENC requirements declared across the 6 plans are covered:

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ENC-01 | 02-04 | Quittance PDF période entièrement payée | SATISFIED | `generer-quittance.ts`, loi 89 art. 21, BDD 6 scenarios @enc-01 |
| ENC-02 | 02-02 | Avis d'échéance PDF + EcheanceLoyer | SATISFIED | `activer-bail.ts`, prorata 1ère/dernière, BDD 4 scenarios @enc-02 |
| ENC-03 | 02-03 | Encaissement saisie + partiel sans quittance | SATISFIED | `creer-encaissement.ts`, soft-delete, compensateur, BDD 5 scenarios @enc-03 |
| ENC-04 | 02-05 | Calcul impayés et retards | SATISFIED | `impaye.ts`, estEnRetard dérivé, filtre locataire, BDD 4 scenarios @enc-04 |
| ENC-05 | 02-06 | Relances escaladées 3 niveaux | SATISFIED | `calculer-relance-disponible.ts`, chaînage strict D-71, BDD 7 scenarios @enc-05 |

No orphaned requirements — all 5 ENC requirements mapped to Phase 2 in REQUIREMENTS.md Traceability table.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/infrastructure/repositories/activite-bail-detector-sqlite.ts` | Comments reference plans 02-03/02-04 extending with encaissement + quittance counts, but the extension was never added | INFO | Not a blocker. The echeance_loyer count is functionally sufficient because all encaissements and quittances are attached to an echeance — no encaissement or quittance can exist without a corresponding echeance being counted. The D-74 protection is functionally complete despite the missing OR clauses. |

No `TBD`, `FIXME`, or `XXX` markers found in production code. No unreferenced debt markers. No placeholder views or stub routes.

### Human Verification Required

No human verification items — all truths are programmatically verifiable and confirmed by the BDD suite (36 scenarios, 189 steps, 0 failures) and unit/integration tests (229 tests passing).

### Gaps Summary

No gaps. All 5 ROADMAP Success Criteria are verified. All 5 ENC requirement IDs (ENC-01 through ENC-05) are satisfied with concrete implementation evidence. The single INFO-level observation (ActiviteBailDetector not extended with encaissement/quittance count) is not a blocker — the echeance_loyer count provides equivalent D-74 protection because the data model enforces that encaissements and quittances always reference an echeance.

---

_Verified: 2026-05-14T20:45:00Z_
_Verifier: Claude (gsd-verifier)_
