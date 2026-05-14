---
phase: 02-quittancement-ch-ances-encaissements-relances
fixed_at: 2026-05-14T19:55:00Z
review_path: .planning/phases/02-quittancement-ch-ances-encaissements-relances/02-REVIEW.md
iteration: 2
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report (Iteration 2)

**Fixed at:** 2026-05-14T19:55:00Z
**Source review:** `.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-REVIEW.md`
**Iteration:** 2

**Summary:**
- Findings in scope: 5 (1 Critical + 4 Warning)
- Fixed: 5
- Skipped: 0

Iteration 2 ramasse les régressions/résidus de l'iteration 1 — l'unique
Critical (CR-01, oubli du fix WR-05 sur la branche `doUpdateSet`) plus les
4 Warning. Le projet passe `tsc --noEmit` proprement après application.

## Fixed Issues

### CR-01: `bail-repository-sqlite.enregistrer` — WR-05 fix incomplet, UPSERT du chemin de mise à jour ignore l'assert overflow

**Files modified:** `src/infrastructure/repositories/bail-repository-sqlite.ts`
**Commit:** `561afe0`
**Applied fix:** Remplacement des 3 dernières occurrences de `Number(bail.X.toCentimes())` par `bail.X.toSqliteInteger()` dans la clause `.doUpdateSet(...)` du UPSERT (lignes 48, 50, 51 — `loyer_hc`, `montant_charges`, `depot_garantie`). Le chemin de mise à jour bénéficie maintenant de l'assert `MAX_SAFE_INTEGER` de `Money.toSqliteInteger()`, alignement complet avec le chemin d'insertion corrigé par WR-05 (iter 1).

---

### WR-01: `ActiviteBailDetectorSqlite` — contredit sa propre docstring et laisse des orphelins potentiels

**Files modified:** `src/infrastructure/repositories/activite-bail-detector-sqlite.ts`
**Commit:** `84e3172`
**Applied fix:** Implémentation des 3 sous-requêtes annoncées par la docstring (OR logique court-circuité) :
1. `count(echeance_loyer WHERE bail_id = ?)` — sans le filtre `annule_le IS NULL`, audit-friendly D-60 (un bail garde activity tant qu'il a touché à la table)
2. `count(encaissement INNER JOIN echeance_loyer WHERE bail_id = ?)`
3. `count(quittance INNER JOIN echeance_loyer WHERE bail_id = ?)`

Suppression du scénario d'orphelinage : annuler toutes les échéances d'un bail ne fait plus passer la hard-delete. Docstring réécrite pour refléter la version finale.

---

### WR-02: `generer-quittance.ts` compensation silencieuse — pas de log, pas d'alerte

**Files modified:** `src/application/encaissements/generer-quittance.ts`
**Commit:** `f73b717`
**Applied fix:** Remplacement du `catch {}` muet (lignes 164-166) par `catch (compErr)` avec `console.error([CRITICAL] …)` détaillant :
- id et numéro de la quittance affectée
- erreur originale (PDF/disque)
- erreur de compensation (annuler échouée)
- requête SQL exacte pour le cleanup manuel : `UPDATE quittance SET annulee_le = '<date>' WHERE id = '<id>'`

L'opérateur a maintenant une trace exploitable pour restaurer l'invariant audit "quittance active ⇒ PDF présent" en cas de double-erreur.

---

### WR-03: `recalculer-statut-echeance.ts` — erreur générique non typée pour échéance introuvable

**Files modified:** `src/application/encaissements/recalculer-statut-echeance.ts`
**Commit:** `b56b2eb`
**Applied fix:** Ajout de `import { EcheanceLoyerIntrouvable } from '../../domain/encaissements/erreurs.js'` et remplacement de `throw new Error(\`Échéance introuvable : ${echeanceId}\`)` par `throw new EcheanceLoyerIntrouvable(String(echeanceId))`. Alignement avec `creer-encaissement.ts:47` et `enregistrer-relance.ts:69`. Aucun test ne testait l'ancien message d'erreur générique — pas de régression de tests.

---

### WR-04: IN-01 + IN-02 non appliqués (résiduel)

**Files modified:** `src/application/encaissements/activer-bail.ts`, `src/web/routes/baux.ts`
**Commit:** `9c558e3`
**Applied fix:**

**activer-bail.ts (IN-01) :** Suppression de la branche morte `if (actifDepuis.day === 1 && i === dureeMois - 1)` aux lignes 126-130 (impossible étant donné `Bail.creer` impose `dureeMois >= 12` (D-35), et duplique en plus le code de la branche suivante). Le `if (i === 0)` se simplifie en `if (actifDepuis.day === 1)` / `else` (prorata). Commentaire ajouté pour expliquer pourquoi.

**baux.ts (IN-02) :** Suppression des 4 imports dynamiques `_T`, `_M`, `_IRL`, `_Addr` aux lignes 563-566 (déjà importés statiquement en tête du fichier). Remplacement des références `_T.PlainDate`, `_M.fromEuros`, `_IRL.creer`, `_Addr.creer` par les imports statiques `Temporal.PlainDate`, `Money.fromEuros`, `IRL.creer`, `Adresse.creer`. L'import dynamique de `Cautionnement` (ligne 587) n'était pas dans le scope du review, conservé.

---

## Skipped Issues

Aucun finding skippé. Les 5 dans le scope (CR-01 + WR-01..WR-04) ont été appliqués proprement, vérifiés par re-lecture (Tier 1) et par `tsc --noEmit` (Tier 2 — full project typecheck PASSES). Les 6 findings IN-* (couverture tests, dead code, commentaires migration) sortent du scope `critical_warning` et restent ouverts pour une iteration future.

---

_Fixed: 2026-05-14T19:55:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
