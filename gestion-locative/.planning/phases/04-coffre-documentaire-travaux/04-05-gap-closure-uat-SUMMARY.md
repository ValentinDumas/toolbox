---
phase: 04-coffre-documentaire-travaux
plan: "05"
plan_id: "04-05"
subsystem: documents
tags: [phase-4, gap-closure, uat, heic, ux-fixes]
dependency_graph:
  requires: [04-01, 04-02, 04-03, 04-04]
  provides: [HEIC-upload-robuste, ux-upload-form-feedback, ux-coffre-single-cta]
  affects: [src/application/documents, src/infrastructure/image, src/web/routes, src/web/views]
tech_stack:
  added: []
  patterns: [ISOBMFF-large-box, ConversionHeicIndisponible-domain-error, 503-service-unavailable, vanilla-js-progressive-enhancement]
key_files:
  created:
    - tests/integration/web/coffre-upload-erreurs.test.ts
    - tests/integration/web/upload-form-rattachement-toggle.test.ts
    - tests/integration/web/coffre-empty-state-no-duplicate-cta.test.ts
  modified:
    - src/application/documents/valider-magic-bytes.ts
    - src/domain/documents/erreurs.ts
    - src/infrastructure/image/convertisseur-image-sharp.ts
    - src/web/routes/coffre.ts
    - src/web/views/pages/coffre/upload.ejs
    - src/web/views/pages/coffre/liste.ejs
    - tests/unit/documents/valider-magic-bytes.test.ts
    - tests/integration/image/convertisseur-image-sharp.test.ts
    - README.md
    - RISKS.md
decisions:
  - "503 plutôt que 415 pour ConversionHeicIndisponible : le fichier HEIC est un format supporté, c'est la pipeline serveur (libheif sans plugin) qui est temporairement HS."
  - "Script vanilla inline (pas ESM externe) dans upload.ejs : pas de CSP strict confirmé, JS progressif sans framework, cohérent avec Pico.css EJS classique."
  - "large box (box_size=1) support via readBigUInt64BE : conforme ISO/IEC 14496-12 §4.2, brand offset 16-19."
  - "Pas de postinstall script pour libheif : brew/apt requiert sudo / interactivité, doc README plus appropriée."
  - "Bouton header masqué en empty-state initial (Hick) : action principale au centre dans empty-state, header conservé dès que total > 0 || filtresActifs."
metrics:
  duration: "~60min"
  completed_date: "2026-05-19"
  tasks_completed: 4
  tasks_total: 4
  files_modified: 10
  files_created: 3
---

# Phase 04 Plan 05 : Gap Closure UAT (HEIC + UX upload) Summary

Ferme 5 gaps remontés par smoke test manuel post-04-04 (source : `04-HUMAN-UAT.md`) : 2 blockers HEIC + 3 mineurs UX. SC-1 "uploader des Justificatifs" désormais fonctionnel E2E pour les utilisateurs iPhone.

## Tasks Completed

| Task | Nom | Commit | Fichiers clés |
|------|-----|--------|---------------|
| T1 | G-HEIC-01 + G-HEIC-02 : Validation HEIC élargie + fallback ConversionHeicIndisponible | ba3db3d | valider-magic-bytes.ts, erreurs.ts, convertisseur-image-sharp.ts, coffre.ts, RISKS.md |
| T2 | G-HEIC-02 doc : README section Dépendances système | e7845d3 | README.md |
| T3 | G-UX-01 + G-UX-02 : Toggle radio rattachement + détection fichier vide | 3eed2e8 | upload.ejs, coffre-upload-erreurs.test.ts, upload-form-rattachement-toggle.test.ts |
| T4 | G-UX-03 : Pas de bouton "Ajouter un document" dupliqué sur /coffre vide | ab121a7 | liste.ejs, coffre-empty-state-no-duplicate-cta.test.ts |

## Gaps Closed

| Gap | Sévérité | Solution |
|-----|----------|---------|
| G-HEIC-01 | blocker | HEIC_BRANDS élargi à 17 brands + support large box (ISO/IEC 14496-12 §4.2) |
| G-HEIC-02 | blocker | ConversionHeicIndisponible (classe domaine) + 503 actionable + doc README + RISKS R6.1 |
| G-UX-01 | minor | Script vanilla applyState toggle .disabled + .field-disabled sur selects Bien/Locataire |
| G-UX-02 | minor | Guard fichierBuffer.length === 0 → 400 + erreurs.fichier "Aucun fichier reçu." |
| G-UX-03 | minor | Bouton header conditionnel (total > 0 \|\| filtresActifs) — empty-state porte CTA seul |

## Tests

- Avant : 594 tests
- Après : 615 tests (+21 nouveaux)
- Répartition nouveaux tests :
  - `valider-magic-bytes.test.ts` : +14 (brands ISOBMFF x8, large box x2, logger x2, adaptation test existant x2)
  - `convertisseur-image-sharp.test.ts` : +4 (G-HEIC-02 regex classification x4)
  - `coffre-upload-erreurs.test.ts` : +2 (sans fichier, fichier 0 octet)
  - `upload-form-rattachement-toggle.test.ts` : +1 (marqueurs HTML présents)
  - `coffre-empty-state-no-duplicate-cta.test.ts` : +2 (coffre vide 1 CTA, filtre actif bouton header)
- Depcruise : 0 violation
- Typecheck : exit 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test "HEIC corrompu → erreur métier explicite" mis à jour**
- **Trouvé pendant :** T1 (run des tests existants après modification du convertisseur)
- **Problème :** Le test existant s'attendait à `/Conversion HEIC/` mais depuis G-HEIC-02 les erreurs "bad seek" déclenchent `ConversionHeicIndisponible` (message différent). C'est le comportement **correct** voulu par G-HEIC-02.
- **Fix :** Regex élargie à `/HEIC non supporté sur ce poste|Conversion HEIC/` + commentaire explicatif.
- **Fichier :** `tests/integration/image/convertisseur-image-sharp.test.ts`
- **Commit :** ba3db3d

**2. [Rule 2 - Missing functionality] Test G-HEIC-02 via classe testable plutôt que vi.mock**
- **Trouvé pendant :** T1 (conception tests)
- **Problème :** `vi.mock('sharp')` en module-level incompatible avec les tests passe-through du même fichier.
- **Fix :** Sous-classe `ConvertisseurImageSharpTestable` qui expose le comportement interne du catch block. Couvre bien les 2 cas (libheif → ConversionHeicIndisponible, erreur générique → Error standard).
- **Commit :** ba3db3d

## Known Stubs

Aucun stub — toutes les fonctionnalités sont câblées.

## Threat Flags

Aucun nouveau surface de sécurité introduit. Les endpoints existants (`POST /coffre/upload`) ont reçu des handlers supplémentaires (503, 400 fichier vide) qui durcissent la défense.

## Self-Check: PASSED

Fichiers créés :
- `/Users/valentinshodo/Projects/toolbox/gestion-locative/tests/integration/web/coffre-upload-erreurs.test.ts` — FOUND
- `/Users/valentinshodo/Projects/toolbox/gestion-locative/tests/integration/web/upload-form-rattachement-toggle.test.ts` — FOUND
- `/Users/valentinshodo/Projects/toolbox/gestion-locative/tests/integration/web/coffre-empty-state-no-duplicate-cta.test.ts` — FOUND

Commits :
- ba3db3d (T1 HEIC) — FOUND
- e7845d3 (T2 README) — FOUND
- 3eed2e8 (T3 UX form) — FOUND
- ab121a7 (T4 UX liste) — FOUND

Tests : 615 verts, 0 échec, depcruise 0 violation.
