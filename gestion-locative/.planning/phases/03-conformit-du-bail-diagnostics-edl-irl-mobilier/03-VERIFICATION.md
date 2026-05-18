---
phase: 03-conformit-du-bail-diagnostics-edl-irl-mobilier
verified: 2026-05-18T06:38:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Wizard IRL — parcours clavier complet 5 étapes"
    expected: "Tab traverse étapes 1→5 ; focus visible ; aria-current=step à chaque étape"
    why_human: "Comportement clavier + focus visuel non testable de manière fiable en headless ; snapshot tests vérifient structure mais pas focus runtime"
  - test: "Bannière gel-loyer Climat — annonce screen reader"
    expected: "Lecteur d'écran annonce 'Gel loyer Climat actif (DPE F)' à l'arrivée sur la page"
    why_human: "role=alert + aria-live=assertive + autofocus testables structurellement ; annonce SR effective dépend du lecteur"
  - test: "Print stylesheet — rendu impression"
    expected: "Aperçu avant impression masque nav/boutons ; tables avec bordures ; @page margin 2cm"
    why_human: "Rendu @media print non vérifiable sans navigateur réel"
  - test: "Avenant IRL PDF — mentions légales loi 89 art. 17-1"
    expected: "PDF généré contient article 17-1 loi 89-462, loyer avant/après, IRL ref, signatures"
    why_human: "Tests intégration vérifient docDef pdfmake mais pas le rendu PDF binaire final"
---

# Phase 03 — Conformité du bail (Diagnostics, EDL, IRL, Mobilier) — Verification Report

**Phase Goal:** Le système garantit la conformité juridique du bail meublé : diagnostics à jour, EDL contradictoire, indexation IRL annuelle (avec gel loyer Climat si DPE F/G), checklist mobilier décret 2015-981.

**Verified:** 2026-05-18T06:38Z
**Status:** PASSED (with human-verify items for visual/SR/PDF rendering)
**Re-verification:** No — initial verification

## Goal Achievement — Observable Truths (Success Criteria ROADMAP)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|--------------------|--------|----------|
| 1 | Stockage `Diagnostic`s (DPE/gaz/élec/ERP) avec date émission + expiration calculée par durée légale | VERIFIED | `src/domain/patrimoine/diagnostic.ts` (factory creer + invariants), `src/domain/_shared/duree-validite-diagnostic.ts` (DUREES_VALIDITE), migration 0007, route `/biens/:id/diagnostics`, helpers `format-statut-diagnostic`. 35 unit tests + 5 BDD `@pat-03` verts. |
| 2 | Enregistrement EDL entrée + sortie contradictoire avec Inventaire mobilier annexé | VERIFIED | `src/domain/locatif/etat-des-lieux.ts` (soft-delete copy-on-write), `inventaire-item.ts` (12 types décret 2015-981), `comparer-inventaires.ts` (warnings), `etats-des-lieux.ts` (8 routes), migration 0008. BDD `@loc-03` + `@loc-06` verts. |
| 3 | À l'anniversaire du Bail, système propose et applique l'indexation IRL + génère avenant signable | VERIFIED | `Bail.dateAnniversaireProchaine` + `Bail.simulerIndexation` + `Bail.appliquerIndexation` + `BailIndexation` append-only + `appliquerIndexationIRL` use case + `avenant-irl-doc-def.ts` PDF pdfmake + GET `/baux/:id/avenant/:annee`. Migration 0009. BDD `@loc-04` + `@loc-04-apply` verts. |
| 4 | Refus de toute indexation à la hausse si DPE F/G (gel loyer Climat) avec motif | VERIFIED | `Bien.estGelLoyer()` (03-01) + `GelLoyerClimatActif` erreur domain + defense en profondeur 2 niveaux (UI route GET + use case `simulerIndexationIRL`/`appliquerIndexationIRL`) + vue `gel-loyer.ejs` avec wording exact UI-SPEC. BDD `@loc-05` (bypass POST DPE F → 403) vert. |
| 5 | Vérification checklist 12 items mobilier décret 2015-981 avec signalement requalification | VERIFIED | `Bail.mobilier` + `verifierChecklistMobilier`, `InventaireItem` VO 12 types, fieldset/legend EJS dans formulaire bail, `partial-inventaire-warnings.ejs`. BDD `@loc-06` checklist mobilier vert. |

**Score:** 5/5 success criteria verified.

## Plan-by-Plan Verification

| Plan | Scope | Objectif PLAN vs SUMMARY | Status |
|------|-------|--------------------------|--------|
| 03-01 | PAT-03 Diagnostics | Sous-agrégat Diagnostic + DUREES_VALIDITE + classeDpe + estGelLoyer + badge DPE + route /biens/:id/diagnostics | VERIFIED — 3 commits (ee9ec0b/05a6ae8/797ad41), 35 tests + 5 BDD verts |
| 03-02 | LOC-03 + LOC-06 EDL + mobilier | EtatDesLieux + InventaireItem (12 items 2015-981) + comparerInventaires + Bail.mobilier + migration 0008 + 8 routes EDL | VERIFIED — 3 commits (6daea75/d8d53fa/379d090), tests verts |
| 03-03 | LOC-04 simul + LOC-05 gel | Money.multiplyByRatio + dateAnniversaireProchaine + simulerIndexation + GelLoyerClimatActif + wizard étapes 2-3 + gel-loyer.ejs | VERIFIED — 3 commits (23ed487/eaf7c23/1b1f647), 6 BDD verts |
| 03-04 | LOC-04 apply | BailIndexation append-only + appliquerIndexation + 5 effets transactionnels + avenant PDF + migration 0009 + GET avenant/:annee | VERIFIED — 3 commits (2af2e5b/0b36d2d/1ba1648), 5 BDD `@loc-04-apply` verts. Déviation documentée : transaction Kysely englobante non implémentée (rationale D-94 accepté — BailRepository transaction interne) |
| 03-05 | UI polish + a11y WCAG 2.1 AA | Audit cross-vues + print.css + snapshot tests + BDD `@a11y-phase3` | VERIFIED — 3 commits (0065c9d/f621dfd/491ba0c), 4 BDD `@a11y-phase3` verts. Note : human-verify checkpoint auto-approuvé en mode chain — items routés vers `human_verification` ci-dessus |

## Requirements Coverage

| REQ | Source plan | Description | Status | Evidence |
|-----|-------------|-------------|--------|----------|
| PAT-03 | 03-01 | Diagnostic avec date émission + expiration | SATISFIED | Diagnostic entity + DUREES_VALIDITE + 5 BDD `@pat-03` |
| LOC-03 | 03-02 | EDL entrée/sortie contradictoire + inventaire | SATISFIED | EtatDesLieux aggregate + BDD `@loc-03` |
| LOC-04 | 03-03 + 03-04 | Indexation IRL à la date anniversaire + avenant | SATISFIED | simulerIndexation + appliquerIndexation + BailIndexation + avenant PDF + BDD `@loc-04` + `@loc-04-apply` |
| LOC-05 | 03-03 | Refus indexation hausse si DPE F/G | SATISFIED | Bien.estGelLoyer + GelLoyerClimatActif + defense en profondeur 2 niveaux + BDD `@loc-05` |
| LOC-06 | 03-02 | Checklist 12 items mobilier 2015-981 | SATISFIED | InventaireItem 12 types + Bail.mobilier + verifierChecklistMobilier + BDD `@loc-06` |

Aucune REQ orpheline. Couverture 5/5.

## Key Artifacts Verified

15 fichiers clés cités dans les SUMMARYs vérifiés FOUND sur disque :
- migrations 0007/0008/0009 ✓
- diagnostic.ts / etat-des-lieux.ts / bail-indexation.ts / inventaire-item.ts / comparer-inventaires.ts ✓
- simuler-indexation-irl.ts / appliquer-indexation-irl.ts ✓
- avenant-irl-doc-def.ts ✓
- routes diagnostics.ts / etats-des-lieux.ts / indexations.ts ✓
- public/styles/print.css ✓

Tous les commits cités dans les 5 SUMMARYs sont présents dans `git log`. Aucun fichier stub détecté.

## Quality Gates

| Gate | Commande | Résultat |
|------|----------|----------|
| Typecheck | `pnpm tsc --noEmit` | exit 0 — 0 erreur |
| Architecture (deps purs) | `pnpm lint:deps` | 0 violation (139 modules, 632 dépendances) |
| Unit + integration tests | `pnpm test` | 432/432 verts (76 fichiers) |
| BDD | `pnpm test:bdd` | 75/75 scenarios verts (414 steps) |

## Anti-Patterns Scanned

- `grep -rn "TBD\|FIXME\|XXX"` sur les 8 fichiers domaine/application/routes les plus modifiés Phase 3 → **0 marker**.
- Aucun stub identifié dans les 5 SUMMARYs (chaque section "Known Stubs" indique "aucun").
- Déviations Plan→Summary toutes documentées avec rationale (D-94 transaction PDF compensation, listerBailsIndexables filtre optionnel, sémantique anniversaire bissextile, format mention "article 17-1").

## Outstanding Gaps / UAT Items

Aucun gap bloquant. 4 items routés vers vérification humaine (cf. `human_verification` frontmatter) :

1. Parcours clavier complet wizard IRL 5 étapes.
2. Annonce screen reader bannière gel-loyer Climat.
3. Rendu @media print en aperçu navigateur.
4. PDF avenant — contenu rendu binaire (vs docDef).

Ces items sont des **smoke checks humains** sur le rendu (clavier, SR, PDF, print) — pas des fonctionnalités manquantes. Le plan 03-05 a auto-approuvé son checkpoint human-verify en mode chain ; les présents items capturent ce qui reste à vérifier visuellement avant ouverture Phase 4.

## Notes / Observations

- **Docs hygiène (informative)** : `.planning/ROADMAP.md` affiche encore `0/5 — Planned` pour Phase 3 alors que les 5 plans sont exécutés et committés. Idem `STATE.md` indique `Plan: 1 of 5` / `Status: Executing`. À mettre à jour à la clôture phase. Non bloquant pour le goal achievement.
- **Tests réels exécutés ce run** confirment les chiffres du SUMMARY 03-05 (432 tests, 75 BDD), aucune régression Phase 1/2.

## Final Verdict

**PASS** — Phase 03 — Conformité du bail (Diagnostics, EDL, IRL, Mobilier) est livrée :
- 5/5 success criteria ROADMAP vérifiés contre le code.
- 5/5 requirements (PAT-03, LOC-03, LOC-04, LOC-05, LOC-06) satisfaits.
- 5/5 plans exécutés et committés avec self-check PASSED.
- Tous les quality gates verts (tsc / lint:deps / test / test:bdd).

4 items de vérification humaine pour le rendu visuel/SR/PDF/print restent recommandés avant Phase 4 mais n'affectent pas l'achievement du goal Phase 3.

---

_Verified: 2026-05-18T06:38Z_
_Verifier: Claude (gsd-verifier)_
