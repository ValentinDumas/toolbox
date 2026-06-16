---
phase: 09-finition-qualit-cl-ture-uat-r-conciliation-des-statuts
type: closure-report
status: closed
generated: 2026-06-16
requirements: [QUA-01, QUA-02]
---

# Rapport de clôture qualité — Phase 9 (UAT liasse + réconciliation des statuts)

Rapport consolidé (D-05) agrégeant l'état des **12 scénarios UAT** de la liasse 2031/CFE (QUA-01)
et la **table de réconciliation** des statuts de suivi stale (QUA-02). Tous les liens sont relatifs.

**Verdict global : Phase 9 close.** 12/12 scénarios liasse au vert, 7 statuts stale réconciliés,
1 défaut bloquant découvert et corrigé, suite de tests verte (156 fichiers / 1096 tests).

---

## 1. État des 12 scénarios liasse 2031/CFE (QUA-01)

Source : [`../06-liasse-2031-cfe/06-UAT.md`](../06-liasse-2031-cfe/06-UAT.md) · Exécution : plan 09-01 (Playwright, app live :7878 + cold start :7879) + checkpoint humain plan 09-03.

| # | Scénario | Résultat | Note |
|---|----------|----------|------|
| 1 | Cold start smoke | ✅ pass | DB neuve, boot sans erreur, migration 0023 appliquée, /fiscalite 200 |
| 2 | Bloc « Brouillons de liasse » /fiscalite | ✅ pass | réel + micro listés avec suffixe, liens /liasse |
| 3 | Brouillon réel (5 annexes) | ✅ pass | S1 + H1 + 2031-SD/2033-A/B/C/D, cases num+libellé+€, S3 ; cohérence FC−FK−FY = GA/CB (6 700 €) |
| 4 | Brouillon micro-BIC (5NI) | ✅ pass-with-note | rendu vérifié via test d'intégration `route-liasse.test.ts` (mapping 2026-only + UNIQUE empêchent réel+micro coexistants en live) |
| 5 | Drill-down sources | ✅ pass | `<details>` natif, liens internes FC/FK, `—` sinon |
| 6 | Bandeau réconciliation snapshot≠vivant | ✅ pass-with-note | bandeau rouge + compteur, pas de « Re-calculer » ; flux « modif post-clôture » couvert par `reconciliation.test.ts` |
| 7 | Liasse rectificative (S6) | ✅ pass | bandeau jaune S6 + lien originale ; originale sans S6 |
| 8 | Export PDF | ✅ pass | auto : 200/application/pdf/%PDF/filename ; **humain (09-03) : PDF s'ouvre et fonctionne** |
| 9 | Export CSV | ✅ pass | auto : BOM+`;`+colonnes+0 injection ; **humain (09-03) : accents OK** ; réserve « Valeur (€) » non numérique **corrigée** (colonne `Valeur (brut)` ajoutée) → upgrade pass-with-note → pass |
| 10 | Création + édition CFE | ✅ pass | création + édition persistées via UI live |
| 11 | Carte + badge CFE | ✅ pass | badge FR officiel évolutif, millésime/échéance/montant |
| 12 | Banner CFE J-30 (3 variantes) | ✅ pass | warning live (fiche bien + /fiscalite) + lien impots.gouv.fr `target=_blank rel=noopener noreferrer` + suppression si `payee` ; variantes forte/destructive via tests |

**Synthèse :** 12/12 clos — 9 `pass`, 3 `pass-with-note` (sc.4, 6, 9), 0 `pending`, 0 `issue`.

### Défaut bloquant découvert pendant l'UAT (D-04) — corrigé en Phase 9

| Défaut | Gravité | Résolution |
|--------|---------|------------|
| Crash du wizard de clôture (`wizard-cloture/etape-*.ejs`, includes partials à profondeur 4 au lieu de 3 → ENOENT → 500 sur `/fiscalite/cloturer/:exercice/etape/{1..5}`) | bloquant | commit `bd175e5` (profondeur 4→3) + test de régression de rendu `tests/integration/web/route-cloture-wizard.test.ts`. Présent depuis commit 18fcf49, jamais couvert (tests clôture = use-case en mémoire, sans rendu de vue). |

---

## 2. Réconciliation des statuts stale (QUA-02) — double preuve (D-03)

Source : [`09-02-SUMMARY.md`](./09-02-SUMMARY.md). Réconciliation pure (D-02) — aucun code produit modifié ; les correctifs étaient déjà livrés.

| Artefact | Ancien statut | Nouveau statut | Preuve comportement (re-test live / test) | Preuve code (file:line + commit) |
|----------|---------------|----------------|-------------------------------------------|----------------------------------|
| [`g1`](../../debug/g1-validation-500-json.md) | diagnosed | resolved | POST /biens (lot appartement sans surface) → message inline, HTML 200, pas de JSON 500 | main.ts:238-248 + wizard.ts:104-119,172-191,296-321 · `6c48786` |
| [`g4`](../../debug/g4-banniere-flash-dupliquee.md) | diagnosed | resolved | sauvegarde profil bailleur → 1 seule `.banniere-success` (DOM) | layout-debut.ejs:29 + 5 ré-includes supprimés · `3ca2f8e` |
| [`g8`](../../debug/g8-relance-mailto-pas-ouvert.md) | diagnosed | resolved | test d'intégration `relances-mailto.test.ts` T1 (200 HTML + mailto + window.location.href + /impayes) | relances.ts:116-126 + ouverture-mail.ejs:15,23 · `78f184c` |
| scope_change (Bien sans Locataire/Bail) | scope_change | resolved | boutons « Terminer plus tard » présents ; bien géré seul (CFE/fiscalité exercés sans bail) | wizard/bien.ejs:108 + wizard/locataire.ejs:80 ; wizard.ts:121,194 · `6c48786` |
| [`02-UAT`](../02-quittancement-ch-ances-encaissements-relances/02-UAT.md) | diagnosed | resolved | 13/13 tests pass ; 9 gaps fermés (filtres /echeances + bouton vide + actifDepuis + découvrabilité vérifiés live/code) | echeances.ts:43-48 ; empty-state.ejs:4 ; baux/detail.ejs:52-54 ; quittances/liste.ejs:12 |
| [`03-UAT`](../03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-UAT.md) | PASS (1 résidu humain) | resolved | PASS 4/4 confirmé ; résidu SR (annonce vocale) NON-BLOCANT, structure ARIA conforme | gel-loyer.ejs:9 (`role=alert aria-live=assertive`) |
| [`04-HUMAN-UAT`](../04-coffre-documentaire-travaux/04-HUMAN-UAT.md) | resolved | resolved (témoin) | confirmé cohérent comme état cible, fond non altéré | 7 gaps déjà fermés (04-05/04-06 gap-closure) |

**0 scénario fantôme, 0 reliquat déféré** : tous les gaps de 02-UAT se sont révélés déjà corrigés
dans le code courant (les docs étaient plus stale qu'estimé).

---

## 3. Critères de succès ROADMAP §Phase 9

| # | Critère | Statut | Justification |
|---|---------|--------|---------------|
| 1 | Les 12 scénarios UAT liasse exécutés et tous au vert | ✅ TRUE | 12/12 clos (9 pass + 3 pass-with-note), 0 pending — §1 |
| 2 | Chaque écart a un correctif livré, scénario re-vert (0 en attente) | ✅ TRUE | 1 défaut bloquant (wizard) corrigé + re-green + test `bd175e5` ; cosmétiques → backlog en pass-with-note (jamais pending) — §1 |
| 3 | Statuts UAT 02/03/04 reflètent l'état réel (clos, 0 fantôme) | ✅ TRUE | 02 resolved (13/13, 9 gaps fermés), 03 resolved (PASS + résidu SR non-bloquant), 04 témoin resolved — §2 |
| 4 | g1/g4/g8 marqués `resolved`, cohérents avec les correctifs livrés | ✅ TRUE | les 3 sessions `resolved` avec double preuve (comportement + file:line/commit) — §2 |

---

## 4. Backlog (écarts cosmétiques non-bloquants — hors Phase 9, D-04)

- ~~**CSV liasse — colonne « Valeur (€) » non numérique**~~ — **RÉSOLU (Phase 9)** : colonne `Valeur (brut)` numérique ajoutée (`exporter-csv-brouillon-liasse.ts` + test). La colonne formatée reste pour la lecture humaine.
- **Brouillons liasse pré-2026** : le bloc liste toutes les déclarations clôturées ; les millésimes sans mapping (< 2026) mènent à un 422 explicite. UX perfectible (griser/annoter).
- **Libellé compteur de réconciliation** : « N pièces ont changé » est un raccourci quand l'écart vient de l'absence de pièces vivantes.
- **CSS « bizarre »** signalé en Phase 02 (cosmétique).

**Dette technique** (consolidation partials CFE, unification `calculerAlertesIrl`, transaction Kysely enveloppante) → **Phase 10** (DET-01/02/03), explicitement hors de cette phase.

---

## 5. Données de test (DB live)

Seed UAT laissé dans `~/Library/Application Support/gestion-locative/db.sqlite` (plan 09-01) :
DeclarationAnnuelle réel 2026 (`35bbda02…`) + micro-BIC 2024 (`7e855a96…`), DeclarationCorrigee
(`d53bfe18…`), DeclarationCfe 2026 (bien `cf36efa7…`, statut `payee`). Exports perceptuels :
`~/Desktop/uat-liasse-2026/`. À purger si un état vierge est souhaité (suppression sur DB live
nécessite un accord explicite).
