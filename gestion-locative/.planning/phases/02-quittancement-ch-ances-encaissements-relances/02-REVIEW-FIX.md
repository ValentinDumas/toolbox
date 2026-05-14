---
phase: 02-quittancement-ch-ances-encaissements-relances
fixed_at: 2026-05-14T23:15:00Z
review_path: .planning/phases/02-quittancement-ch-ances-encaissements-relances/02-REVIEW.md
iteration: 3
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report (Iteration 3)

**Fixed at:** 2026-05-14T23:15:00Z
**Source review:** `.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-REVIEW.md`
**Iteration:** 3

**Summary:**
- Findings in scope: 11 (1 Critical + 4 Warning + 6 Info — `fix_scope=all`)
- Fixed: 11 (5 already fixed by iteration 2, 6 fixed in this iteration)
- Skipped: 0

**Context:** REVIEW.md a été généré AVANT les fixes iteration 2. Les 5 premiers
findings (CR-01, WR-01..WR-04) ont déjà été corrigés en iter 2 et les commits
sont visibles sur `main`. Ce rapport iter 3 finit le job en s'attaquant aux 6
Info findings (couverture de tests, dead code, commentaires de migration,
typing des stubs).

**Tier 2 verification :** `pnpm typecheck` (full project) PASS, `pnpm vitest run`
PASS (232 tests).

## Fixed Issues

### CR-01: `bail-repository-sqlite.enregistrer` — WR-05 fix incomplet, UPSERT du chemin de mise à jour ignore l'assert overflow

**Status:** Already fixed in iteration 2
**Files modified:** `src/infrastructure/repositories/bail-repository-sqlite.ts`
**Commit:** `561afe0` (iter 2)
**Applied fix:** Remplacement des 3 dernières occurrences de
`Number(bail.X.toCentimes())` par `bail.X.toSqliteInteger()` dans la clause
`.doUpdateSet(...)` du UPSERT. Le chemin de mise à jour bénéficie maintenant
de l'assert `MAX_SAFE_INTEGER` (alignement avec le chemin d'insertion fixé en
iter 1 via WR-05). Verified by re-reading `bail-repository-sqlite.ts:48,50,51`
in current main — fix is present.

---

### WR-01: `ActiviteBailDetectorSqlite` — contredit sa propre docstring et laisse des orphelins potentiels

**Status:** Already fixed in iteration 2
**Files modified:** `src/infrastructure/repositories/activite-bail-detector-sqlite.ts`
**Commit:** `84e3172` (iter 2)
**Applied fix:** Implémentation des 3 sous-requêtes annoncées par la docstring
(OR logique court-circuité) : `echeance_loyer` (sans filtre `annule_le`),
`encaissement` via INNER JOIN, `quittance` via INNER JOIN. Suppression du
scénario d'orphelinage : annuler toutes les échéances d'un bail ne fait plus
passer la hard-delete. Verified by re-reading file — 3 queries present
with short-circuit OR semantics.

---

### WR-02: `generer-quittance.ts` compensation silencieuse — pas de log, pas d'alerte

**Status:** Already fixed in iteration 2
**Files modified:** `src/application/encaissements/generer-quittance.ts`
**Commit:** `f73b717` (iter 2)
**Applied fix:** Remplacement du `catch {}` muet par `catch (compErr)` avec
`console.error([CRITICAL] …)` détaillant id/numéro quittance, erreurs
originale et de compensation, et la requête SQL exacte pour le cleanup
manuel.

---

### WR-03: `recalculer-statut-echeance.ts` — erreur générique non typée

**Status:** Already fixed in iteration 2
**Files modified:** `src/application/encaissements/recalculer-statut-echeance.ts`
**Commit:** `b56b2eb` (iter 2)
**Applied fix:** Remplacement de `throw new Error(...)` par
`throw new EcheanceLoyerIntrouvable(String(echeanceId))`. Verified — fix
is present at line 38 in current main.

---

### WR-04: IN-01 + IN-02 non appliqués (résiduel)

**Status:** Already fixed in iteration 2
**Files modified:** `src/application/encaissements/activer-bail.ts`, `src/web/routes/baux.ts`
**Commit:** `9c558e3` (iter 2)
**Applied fix:** Suppression de la branche morte dans `activer-bail.ts:126-130`
et des 4 imports dynamiques inutiles dans `baux.ts:563-566`.

---

### IN-01: Test coverage gap — WR-08 (Encaissement.creer rejette 0€)

**Files modified:** `tests/unit/encaissements/encaissement.test.ts`
**Commit:** `db4e3ff`
**Applied fix:** Ajout d'un test régression `WR-08: rejette montant = 0 €`
qui asserte que `Encaissement.creer({ ..., montant: Money.zero() })` throw
`InvariantViolated` avec le message exact `'Un Encaissement ne peut pas
être de 0 €'`. Empêche un futur refactor de retirer silencieusement
l'invariant ajouté par WR-08 (iter 1) en `domain/encaissements/encaissement.ts:65-67`.

---

### IN-02: Test coverage gap — CR-05 (recalculerStatutEcheance préserve 'annulee')

**Files modified:** `tests/unit/encaissements/recalculer-statut-echeance.test.ts`
**Commit:** `d705f3f`
**Applied fix:** Ajout d'un test `CR-05: échéance déjà annulée → préserve
statut annulee, pas de mettreAJourStatut`. Le test stub un échéance dont
`statut === 'annulee'`, asserte que le résultat conserve `'annulee'` avec
`surPaiement: null`, ET vérifie via `vi.fn()` spy que `mettreAJourStatut`
n'est JAMAIS appelé (invariant terminal D-60). Empêche un refactor de
ressusciter une échéance annulée même quand somme == total.

---

### IN-03: Test coverage gap — WR-04 (build-mailto truncation au milieu de %XX)

**Files modified:** `tests/unit/helpers/build-mailto.test.ts`
**Commits:** `afbbf98` (test ajouté), `9d06eff` (TS strict-mode fixup pour
`bodyMatch?.[1] ?? ''`)
**Applied fix:** Ajout d'un test `WR-04: troncature recule si elle
tomberait au milieu d'une séquence %XX`. Le corps est calibré pour qu'avec
`LIMITE_CORPS = 1900` et `mentionEnc.length = 89`, la position naïve de
coupure (1811) tombe à l'intérieur d'un `%C3%A9` (séquence pour `é`).
Sans protection : `decodeURIComponent` jette `URI malformed`. Avec
protection (WR-04) : limite recule à un boundary décodable. Le test
asserte explicitement `expect(() => decodeURIComponent(bodyEncoded)).not.toThrow()`,
détectant donc une régression du fix.

Note iter 3 : le commit initial cassait `pnpm typecheck` (`bodyMatch![1]`
typé `string | undefined` sous `noUncheckedIndexedAccess`). Le commit
`9d06eff` aligne la syntaxe avec le test précédent du fichier (`bodyMatch?.[1] ?? ''`).

---

### IN-04: Dead code — `listerQuittances` use case et `compterParBail` repo method

**Files modified:**
- `src/application/encaissements/lister-quittances.ts` (deleted)
- `src/domain/encaissements/echeance-loyer-repository.ts`
- `src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts`
- `tests/unit/encaissements/recalculer-statut-echeance.test.ts`
- `tests/unit/encaissements/creer-encaissement.test.ts`
- `tests/unit/encaissements/activer-bail.test.ts`
- `tests/unit/encaissements/annuler-encaissement.test.ts`
- `tests/unit/locatif/modifier-bail-actif.test.ts`

**Commit:** `f684b94`
**Applied fix:**
- Suppression de `src/application/encaissements/lister-quittances.ts` :
  exporté mais jamais importé. La route `GET /quittances` appelle directement
  `quittanceRepo.listerToutes(...)` avec une logique d'enrichissement spécifique
  (échéance + locataire) qu'il serait artificiel de couper en deux.
- Retrait de `compterParBail(bailId): Promise<number>` de l'interface
  `EcheanceLoyerRepository` + suppression de l'implémentation dans
  `echeance-loyer-repository-sqlite.ts` + nettoyage des 6 stubs de test
  qui le déclaraient uniquement pour satisfaire l'interface.

Net : -33 lignes, +1 ligne. Surface API réduite, conventions DDD/SOLID
respectées (YAGNI sur ports inutilisés).

---

### IN-05: Migration 0002 — commentaire de DEFAULT 1 + CHECK manque la subtilité SQLite 3.31

**Files modified:** `migrations/0002_phase2_bailleur_bail_ext.sql`
**Commit:** `ec4090b`
**Applied fix:** Ajout d'un bloc de commentaire SQL documentant que
`ALTER TABLE ... ADD COLUMN ... CHECK(...)` requiert SQLite ≥ 3.31
(release 2020-01-22), avec note que `better-sqlite3 ^11` bundle ≥ 3.42 —
OK en pratique — mais vérification nécessaire pour quiconque substituerait
un autre adapter (turso, libsql, sqlite3 natif). Aucun changement de
comportement SQL.

---

### IN-06: `creer-encaissement.ts` — Bail typé `unknown` dans stubs de test

**Files modified:** `tests/unit/encaissements/creer-encaissement.test.ts`
**Commit:** `8e8ec92`
**Applied fix:** Le stub `creerStubBailRepo` retournait `bail as unknown`
sur un objet ad-hoc `{id, dateDebut, actifDepuis}`, ce qui contournait
totalement le type-checking sur l'agrégat `Bail`. Refactor :
- `creerStubBailRepo(bail: Bail)` (au lieu de l'objet ad-hoc).
- `trouverParId` retourne `Promise<Bail | null>` (typage explicite).
- Helper `creerBailActif(): Bail` utilise
  `unBailValide({id, dateDebut}).activer(actifDepuis, jourEcheance)`.
- Les 2 sites inline T13 et T16 réécrits pour utiliser `unBailValide().activer()`
  ou `unBailValide()` (cas non-actif, `actifDepuis === null` par défaut).

Le test fait maintenant office de garde de l'API publique de `Bail` :
si `Bail.activer` change de signature, le test devient rouge.

Note : le cast `as never` sur le bailRepo au site d'appel est conservé
car le stub ne satisfait que 3/5 méthodes de `BailRepository`
(`listerParLocataire`, `supprimer` non implémentés). Compléter le stub
sort du scope IN-06 — délibéré.

---

## Skipped Issues

Aucun finding skippé. Les 11 findings dans le scope (1 Critical + 4 Warning
+ 6 Info) ont été appliqués proprement et vérifiés.

**Verification chain :**
- Tier 1 (re-read) : tous les fichiers modifiés relus à l'emplacement du fix.
- Tier 2 (syntax/typecheck) : `pnpm typecheck` PASS (full project, 0 erreur),
  `pnpm vitest run` PASS (232 tests, 0 failure).
- Tier 3 : N/A (Tier 2 disponible).

**Aucun fix marqué `requires human verification`** — toutes les corrections
sont des additions de tests, retraits de code mort, ou ajouts de commentaires.
Aucune modification de logique fiscale ni de chemin critique de persistance
au-delà de ce qui a été déjà couvert et testé en iter 2.

---

_Fixed: 2026-05-14T23:15:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
