---
phase: 05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement
verified: 2026-05-21T13:30:00Z
status: gaps_found
score: 4/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Le système agrège les recettes et les charges sans perte de précision arithmétique — aucun float ne doit transiter entre le SUM SQLite et Money.fromCentimes()"
    status: failed
    reason: "recettes-repository-sqlite.ts:47 et charges-repository-sqlite.ts:65,111 font `BigInt(Math.round(total))` sur un SUM<number> retourné par Kysely. Le SUM flottant peut perdre 1 centime avant le BigInt(), en violation directe de la règle 'jamais de float pour les montants fiscaux'. Identifié en CR-01 du code review."
    artifacts:
      - path: "src/infrastructure/repositories/recettes-repository-sqlite.ts"
        issue: "ligne 47 : BigInt(Math.round(total)) sur fn.sum<number>. Correct : fn.sum<string> + BigInt(total) directement."
      - path: "src/infrastructure/repositories/charges-repository-sqlite.ts"
        issue: "lignes 65 et 111 : même pattern. Deux emplacements de perte de précision."
    missing:
      - "Remplacer fn.sum<number> par fn.sum<string> dans les deux repos, et supprimer Math.round()"

  - truth: "L'amortissement par composant n'est pas double-compté quand plusieurs biens sont actifs simultanément (ARD SYNTHESE_BIEN correct en multi-biens)"
    status: failed
    reason: "cloturerExercice.ts L225-238 : pour chaque bienId dans biensIds, une SYNTHESE_BIEN est créée avec ardCumuleDisponible = tableau.ardCumuleEnSortie GLOBAL (la somme de tous les biens). dernierArdCumuleBailleur SUM toutes ces lignes SYNTHESE_BIEN → avec 2 biens, le SUM double l'ARD. Le commentaire L223 reconnaît cette 'simplification' mais affirme à tort que le résultat est correct. Identifié en CR-03 du code review."
    artifacts:
      - path: "src/application/fiscalite/cloturer-exercice.ts"
        issue: "L225-238 : boucle for (const bienId of biensIds) crée N lignes SYNTHESE_BIEN chacune avec ardCumuleEnSortie global → N × ardCumule stocké au total."
      - path: "src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts"
        issue: "L142 : fn.sum('ard_cumule_disponible_centimes') sur toutes les SYNTHESE_BIEN de l'exercice → multiplie par N si N biens."
    missing:
      - "Une seule SYNTHESE_BIEN par exercice (pas par bienId) OU répartition proportionnelle de ardCumuleEnSortie par bien et SUM correct lors de la lecture."

  - truth: "La couche application ne dépend d'aucune implémentation infrastructure concrète — hexagonal strict respecté (règle non-négociable CLAUDE.md)"
    status: failed
    reason: "exporter-pdf-recap.ts L26 importe directement construireRecapFiscal depuis src/infrastructure/pdf/recap-fiscal-doc-def.ts. La couche application dépend d'une implémentation infra concrète — violation directe DIP et de la règle hexagonale non-négociable. Identifié en CR-06 du code review. Note : cloturer-exercice.ts, activer-fiscalite-bien.ts et creer-declaration-corrigee.ts importent Kysely<DB> depuis l'infrastructure (type-only imports), ce qui est acceptable dans le pattern repository transaction de ce projet — cette violation-là est moins critique que l'import d'implémentation concrete dans exporter-pdf-recap."
    artifacts:
      - path: "src/application/fiscalite/exporter-pdf-recap.ts"
        issue: "L26 : `import { construireRecapFiscal } from '../../infrastructure/pdf/recap-fiscal-doc-def.js'` — import d'implémentation concrète depuis la couche application."
    missing:
      - "Extraire un port RecapFiscalBuilder dans src/domain/ ou src/application/ et injecter l'implémentation pdfmake via le DI."
---

# Phase 5 : Fiscalité LMNP — Rapport de vérification

**Objectif de phase :** Le système agrège recettes et charges sur l'exercice, calcule l'abattement micro-BIC, l'amortissement par composant en régime réel, et alerte sur le risque de bascule LMNP → LMP.
**Vérifié :** 2026-05-21T13:30:00Z
**Statut :** gaps_found
**Re-vérification :** Non — vérification initiale

---

## Critères de succès ROADMAP

Cinq critères extraits du ROADMAP.md §Phase 5 :

1. Le système agrège les recettes (via `Encaissement`s) et les charges (via `Justificatif`s rattachés) du régime fiscal réel sur une année fiscale donnée.
2. Le système calcule l'abattement micro-BIC (50 % longue durée, 30 % tourisme non classé, plancher 305 €) et signale le franchissement du seuil 83 600 €.
3. Le système calcule l'amortissement par composant en régime réel : terrain exclu, prorata temporis à l'acquisition, ARD reportable, plafonné au résultat avant amortissement.
4. Le système détecte le risque de bascule LMP (recettes annuelles > 23 000 € ET > revenus actifs du foyer) et alerte explicitement l'utilisateur.
5. Toute la logique fiscale de cette phase est couverte à 100 % par des scénarios BDD — vérifiable via le rapport de couverture du domaine `fiscalite/`.

---

## Vérités observables

| # | Vérité | Statut | Preuve / Problème |
|---|--------|--------|-------------------|
| 1 | Le système agrège recettes et charges (SC-1) | ✗ FAILED | Agrégation existe mais souffre de perte de précision float (CR-01) : `fn.sum<number>` + `BigInt(Math.round(...))` dans recettes-repository-sqlite.ts:47 et charges-repository-sqlite.ts:65,111 — viole la règle "jamais de float pour les montants fiscaux". |
| 2 | Le système calcule l'abattement micro-BIC (SC-2) | ✓ VERIFIED | `calculer-micro-bic.ts` exporte `calculerMicroBic`, gère plancher 305 €, seuil 83 600 €, retourne `seuilDepasse`. Tests : 888 tests verts dont les cas limites L242-244. Feature `fiscalite-micro-bic.feature` (4 scénarios). `SEUIL_MICRO_BIC_LONGUE_DUREE = 8_360_000n`, `PLANCHER_ABATTEMENT = 30_500n` vérifiés dans `regles-2026.ts`. |
| 3 | Le système calcule l'amortissement par composant (SC-3) | ✗ FAILED | `calculerAmortissement` existe et est pur (365n BigInt, prorata, ARD). Mais `cloturerExercice.ts L225-238` double-compte l'ARD en multi-biens : chaque SYNTHESE_BIEN reçoit ardCumuleEnSortie global, puis `dernierArdCumuleBailleur` SUM toutes ces lignes (CR-03). |
| 4 | Le système détecte la bascule LMP (SC-4) | ✓ VERIFIED | `detecter-bascule-lmp.ts` : VerdictLmp tri-état (`lmnp_confirme`, `lmp_probable`, `indetermine_revenus_foyer_manquants`). CGI 155 IV + Conseil Constitutionnel 2009-587 DC cités. Anti-sticky vérifié. 9 tests + 7 scénarios BDD. |
| 5 | Couverture BDD 100 % cas limites (SC-5) | ✓ VERIFIED | 21 fichiers tests unit fiscalite + 14 features BDD. `fiscalite-cas-limites-locked.feature` (11 scénarios L242-252 tous couverts). Suite passe 888 tests. |
| — | Règle non-négociable DDD hexagonal (CLAUDE.md) | ✗ FAILED | `exporter-pdf-recap.ts L26` importe `construireRecapFiscal` depuis `infrastructure/pdf/` — violation directe de l'isolation couche application (CR-06). |

**Score :** 3/5 vérités SC passées (SC-2, SC-4, SC-5 VERIFIED ; SC-1, SC-3 FAILED). La règle hexagonale non-négociable est également FAILED.

---

## Artefacts requis

### Domaine fiscal

| Artefact | Statut | Détails |
|----------|--------|---------|
| `src/domain/fiscalite/regles/regles-2026.ts` | ✓ VERIFIED | REGLES_2026 exporté : 8_360_000n, 30_500n, 2_300_000n, DUREES_AMORTISSEMENT_ANS. 27 citations juridiques CGI/BOFIP/LF 2025. |
| `src/domain/fiscalite/regles/regle-fiscale-provider.ts` | ✓ VERIFIED | Interface RegleFiscaleProvider + RegleFiscaleProviderEnMemoire. |
| `src/domain/fiscalite/erreurs.ts` | ✓ VERIFIED | 6 classes d'erreurs typées. |
| `src/domain/fiscalite/composant.ts` | ✓ VERIFIED | Sub-aggregate Composant avec invariants BOFIP. |
| `src/domain/fiscalite/valorisation-fiscale.ts` | ✓ VERIFIED | VO ValorisationFiscale + fraisAcquisitionTotal(). |
| `src/domain/fiscalite/ard.ts` | ✓ VERIFIED | VO ARD immutable + consommer(). |
| `src/domain/fiscalite/declaration-annuelle.ts` | ✓ VERIFIED | Agrégat append-only + factory creer. |
| `src/domain/fiscalite/declaration-corrigee.ts` | ✓ VERIFIED | Agrégat append-only + déclarationOriginaleId. |
| `src/domain/fiscalite/qualification-fiscale.ts` | ✓ VERIFIED | Type QualificationFiscale + LABELS + helpers. |

### Use cases application

| Artefact | Statut | Détails |
|----------|--------|---------|
| `src/application/fiscalite/calculer-micro-bic.ts` | ✓ VERIFIED | Fonction pure + MicroBicResult. |
| `src/application/fiscalite/calculer-amortissement.ts` | ✓ VERIFIED | Pur, BigInt 365n, prorata, ARD plafond. |
| `src/application/fiscalite/detecter-bascule-lmp.ts` | ✓ VERIFIED | Tri-état, anti-sticky, CGI 155 IV cité. |
| `src/application/fiscalite/cloturer-exercice.ts` | ✗ PARTIAL | Orchestration complète mais CR-03 double-ARD multi-biens. |
| `src/application/fiscalite/repartir-frais-acquisition.ts` | ✓ VERIFIED | Prorata BOFIP, dernier composant absorbe arrondi. |
| `src/application/fiscalite/activer-fiscalite-bien.ts` | ✓ VERIFIED | Transaction, BienDejaActifFiscalement, ComposantsSommeIncoherente. |
| `src/application/fiscalite/exporter-pdf-recap.ts` | ✗ VIOLATION | Import infrastructure concrète L26 — violation hexagonale non-négociable. |
| `src/application/fiscalite/choisir-regime.ts` | ✓ VERIFIED | Use case pur micro/réel. |
| `src/application/fiscalite/creer-declaration-corrigee.ts` | ✓ VERIFIED | Append-only, originale intouchée. |

### Repositories

| Artefact | Statut | Détails |
|----------|--------|---------|
| `src/infrastructure/repositories/recettes-repository-sqlite.ts` | ✗ STUB | L32+47 : `fn.sum<number>` + `BigInt(Math.round(...))` — perte de précision float possible (CR-01). |
| `src/infrastructure/repositories/charges-repository-sqlite.ts` | ✗ STUB | L37+65 et L91+111 : même pattern float (CR-01). |
| `src/infrastructure/repositories/composant-repository-sqlite.ts` | ✓ VERIFIED | Round-trip Composant + ValorisationFiscale. |
| `src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts` | ✓ VERIFIED | Append-only strict (sans onConflict). `dernierArdCumuleBailleur` présent avec SUM SYNTHESE_BIEN. Note : la logique multi-biens est défectueuse côté cloturerExercice, pas dans le repo lui-même. |
| `src/infrastructure/repositories/declaration-annuelle-repository-sqlite.ts` | ✓ VERIFIED | Append-only (sans onConflict). UNIQUE (bailleur_id, exercice). |
| `src/infrastructure/repositories/declaration-corrigee-repository-sqlite.ts` | ✓ VERIFIED | Append-only. N corrections successives. |

### Migrations SQL

| Migration | Statut | Détails |
|-----------|--------|---------|
| `migrations/0014_phase5_qualification_charges.sql` | ✓ VERIFIED | Existe, 1.9K. |
| `migrations/0015_phase5_bailleur_fiscalite.sql` | ✓ VERIFIED | Existe, 1.3K. |
| `migrations/0016_phase5_declaration_annuelle.sql` | ✓ VERIFIED | Existe, 1.5K. |
| `migrations/0017_phase5_declaration_corrigee.sql` | ✓ VERIFIED | Existe, 1.6K. |
| `migrations/0018_phase5_composant.sql` | ✓ VERIFIED | Existe, 2.2K. |
| `migrations/0019_phase5_amortissement_exercice.sql` | ✓ VERIFIED | Existe, 2.3K. |
| `migrations/0020_phase5_valorisation_fiscale.sql` | ✓ VERIFIED | Existe, 1.4K. |
| `migrations/0021_phase5_ticket_nature_fiscale.sql` | ✓ VERIFIED | Existe, 1.2K. |

### UI et routes

| Artefact | Statut | Détails |
|----------|--------|---------|
| `src/web/views/partials/sidebar-nav.ejs` | ✓ VERIFIED | `/fiscalite` présent, `aria-current="page"` conditionnel sur `navActive === 'fiscalite'`. |
| Routes fiscalite (9 registrations main.ts) | ✓ VERIFIED | qualification, composants, amortissement, revenus-foyer, cloture, racine, exports, onboarding, multi-bien tous registerés dans main.ts. |

---

## Liens clés (wiring)

| De | Vers | Via | Statut |
|----|------|-----|--------|
| RecettesRepositorySqlite | Money.fromCentimes (sans float) | `fn.sum<string>` → `BigInt(total)` | ✗ NOT_WIRED — utilise `fn.sum<number>` + `Math.round` |
| cloturerExercice (SYNTHESE_BIEN) | ardCumuleEnSortie correct en multi-biens | 1 seule SYNTHESE_BIEN par exercice | ✗ NOT_WIRED — N lignes créées, SUM N×ardCumule |
| exporter-pdf-recap (application) | RecapFiscalBuilder (port) | Injection interface | ✗ NOT_WIRED — import concret infrastructure direct |
| calculerAmortissement | Money.multiplyByFraction(jours, 365n) | prorata BigInt pur | ✓ WIRED — ligne 155 calculer-amortissement.ts |
| cloturer-exercice | tableauAmortRepo.enregistrerBatch (append-only) | db.transaction().execute | ✓ WIRED |
| detecterBasculeLmp | VerdictLmp tri-état + SEUIL_LMP_RECETTES | appel pur dans cloturer-exercice | ✓ WIRED |
| sidebar-nav.ejs | /fiscalite | `href="/fiscalite"` + `aria-current` | ✓ WIRED |

---

## Traçabilité des exigences

| Exigence | Plan(s) | Description | Statut | Preuve |
|----------|---------|-------------|--------|--------|
| FIS-01 | 05-05, 05-06 | Détection bascule LMP (recettes > 23 000 € ET > revenus actifs) | ✓ SATISFIED | detecter-bascule-lmp.ts + 7 scénarios BDD + anti-sticky vérifié |
| FIS-02 | 05-02 | Calcul abattement micro-BIC (50 %, plancher 305 €, seuil 83 600 €) | ✓ SATISFIED | calculer-micro-bic.ts + regles-2026.ts + 4 scénarios BDD cas limites |
| FIS-03 | 05-02 | Agrégation recettes et charges régime réel | ✗ BLOCKED | Agrégation implémentée mais perte float possible sur SUM (CR-01) — règle "jamais de float pour les montants fiscaux" violée |
| FIS-04 | 05-03, 05-04, 05-06 | Amortissement par composant (terrain exclu, ARD reportable, plafond résultat) | ✗ BLOCKED | calculerAmortissement pur correct, mais cloturerExercice crée double-ARD en multi-biens (CR-03) |

---

## Anti-patterns détectés

| Fichier | Ligne | Pattern | Sévérité | Impact |
|---------|-------|---------|----------|--------|
| `src/infrastructure/repositories/recettes-repository-sqlite.ts` | 47 | `BigInt(Math.round(sum_as_number))` — float avant BigInt | BLOCKER | Montant fiscal recettes potentiellement incorrect (SC-1/FIS-03) |
| `src/infrastructure/repositories/charges-repository-sqlite.ts` | 65, 111 | Même pattern float SUM→BigInt | BLOCKER | Montant fiscal charges potentiellement incorrect (SC-1/FIS-03) |
| `src/application/fiscalite/exporter-pdf-recap.ts` | 26 | Import concret depuis `infrastructure/pdf/recap-fiscal-doc-def.js` | BLOCKER | Violation règle hexagonale non-négociable CLAUDE.md |
| `src/application/fiscalite/cloturer-exercice.ts` | 223-238 | N lignes SYNTHESE_BIEN avec ardCumule global → SUM × N | BLOCKER | ARD doublé (ou N-tuplé) en cas de multi-biens (FIS-04) |
| `src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts` | 152 | `BigInt(total)` sur `fn.sum<number>` — même fragilité float | WARNING | Même pattern CR-01 dans `dernierArdCumuleBailleur` |

Aucun marqueur TBD/FIXME/XXX non tracé détecté dans les fichiers Phase 5.

---

## Vérifications comportementales (spot-checks)

| Comportement | Résultat | Statut |
|--------------|----------|--------|
| `pnpm test` — 134 fichiers, 888 tests | 888 passed (0 failed) | ✓ PASS |
| `pnpm typecheck` | 0 erreur TypeScript | ✓ PASS |
| Imports infra dans `src/domain/fiscalite/` | 0 résultat | ✓ PASS |
| `onConflict` absent dans repos append-only | Confirmé absent (tableau-amortissement, declaration-annuelle, declaration-corrigee) | ✓ PASS |
| `fn.sum<number>` + `Math.round` dans recettes/charges repos | Présent L47, L65, L111 | ✗ FAIL |
| Import infra dans couche application | `exporter-pdf-recap.ts:26` | ✗ FAIL |

---

## Humain requis

Aucun item de vérification humaine additionnelle. Les gaps sont tous vérifiables programmatiquement et ont été confirmés.

---

## Résumé des gaps

**3 BLOCKERs qui empêchent l'atteinte du goal de phase :**

### Gap 1 — Perte de précision flottante dans l'agrégation des recettes et charges (CR-01)

`recettes-repository-sqlite.ts:47` et `charges-repository-sqlite.ts:65,111` font `BigInt(Math.round(fn.sum<number>(...)))`. Le SUM SQLite retourné en JS `number` (flottant 64 bits) peut perdre 1 centime avant conversion en `BigInt`. La règle du projet est formelle : jamais de float pour les montants fiscaux. SC-1 (agrégation) et FIS-03 sont bloqués.

**Fix :** `fn.sum<string>('col').as('total')` + `BigInt(result?.total ?? '0')` — lecture directe de la chaîne entière sans passer par le flottant.

### Gap 2 — Double-comptage de l'ARD en cas multi-biens (CR-03)

`cloturerExercice.ts L225-238` crée une ligne `SYNTHESE_BIEN` par `bienId` en stockant à chaque fois l'ARD GLOBAL du bailleur. `dernierArdCumuleBailleur` fait ensuite `SUM` de toutes ces lignes pour l'exercice → ARD multiplié par le nombre de biens. Le commentaire "Simplification V1 : résultat correct" est erroné. SC-3 et FIS-04 sont bloqués.

**Fix (V1 mono-bailleur) :** Ne créer qu'une seule `SYNTHESE_BIEN` par exercice (portée par le premier `bienId` ou une valeur sentinelle) au lieu d'une par bien.

### Gap 3 — Violation hexagonale dans exporter-pdf-recap (CR-06)

`exporter-pdf-recap.ts` (couche application) importe directement `construireRecapFiscal` depuis `src/infrastructure/pdf/recap-fiscal-doc-def.ts`. C'est une violation de la règle non-négociable DDD hexagonal / Ports & Adapters définie dans CLAUDE.md. Le domaine et l'application ne doivent dépendre d'aucune implémentation infrastructure concrète.

**Fix :** Créer un port `RecapFiscalBuilder` dans `src/application/fiscalite/` (ou domaine), l'injecter comme dépendance dans `exporterPdfRecap`, et implémenter le port dans `src/infrastructure/pdf/`.

---

**Gaps structurés dans le frontmatter YAML pour `/gsd-plan-phase --gaps`.**

---

_Vérifié : 2026-05-21_
_Vérificateur : Claude (gsd-verifier)_
