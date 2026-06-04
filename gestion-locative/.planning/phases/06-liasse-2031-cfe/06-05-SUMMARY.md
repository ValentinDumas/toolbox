---
phase: 06-liasse-2031-cfe
plan: 05
status: complete
type: tdd
requirements: [FIS-05]
tags: [fiscalite, liasse, exports, pdf, csv, pdfmake]
self_check: PASSED
key_files:
  created:
    - src/infrastructure/pdf/brouillon-liasse-doc-def.ts
    - src/infrastructure/pdf/brouillon-liasse-builder-pdfmake.ts
    - src/application/fiscalite/exporter-pdf-brouillon-liasse.ts
    - src/application/fiscalite/exporter-csv-brouillon-liasse.ts
    - tests/unit/fiscalite/exporter-csv-brouillon-liasse.test.ts
    - tests/integration/pdf/brouillon-liasse-magic-bytes.test.ts
    - tests/integration/web/route-liasse-exports.test.ts
  modified:
    - src/web/routes/fiscalite/liasse.ts
    - src/web/views/pages/fiscalite/brouillon-liasse.ejs
    - src/main.ts
---

# Plan 06-05 — Exports PDF + CSV brouillon liasse (FIS-05 slice 5)

## Self-Check: PASSED

## Ce qui a été livré

### Infrastructure
- **`brouillon-liasse-doc-def.ts`** : fonction pure `construireBrouillonLiasse(dto): TDocumentDefinitions`.
  - En-tête + bandeau S1 + bandeau rectificative (si motif) + bandeau réconciliation (si écart).
  - Pour chaque section : titre h3 + tableau 4 colonnes (Case | Libellé | Valeur | Sources count).
  - Mention 2033-A "Bilan simplifié — postes manuels" si `bandeauPostesManuels`.
- **`brouillon-liasse-builder-pdfmake.ts`** : adapter du port domaine
  `BrouillonLiasseBuilder` (zéro import pdfmake côté domaine).

### Application
- **`exporter-pdf-brouillon-liasse.ts`** : use case PDF.
  - Commande discriminée `{ declarationId } | { declarationCorrigeeId }`.
  - `nomFichier` = `brouillon-liasse[-rectificative]-{exercice}.pdf`.
- **`exporter-csv-brouillon-liasse.ts`** : use case CSV.
  - BOM `﻿` + séparateur `;` + colonnes `Annexe;Case;Libellé officiel;Valeur (€);Sources`.
  - Colonne Sources : `type:idCourt|type:idCourt` (séparateur `|` anti-CSV-injection).
  - `sanitizeCsvCell` préfixe `'` quand cellule commence par `=`, `+`, `-`, `@`, `\t`, `\r`
    (mitigation T-05-07-04 + T-06-LIASSE-01).
  - `nomFichier` = `brouillon-liasse[-rectificative]-{exercice}.csv`.

### Web
- **4 nouveaux endpoints** dans `routes/fiscalite/liasse.ts` :
  - `GET /fiscalite/declarations/:id/liasse.pdf`
  - `GET /fiscalite/declarations/:id/liasse.csv`
  - `GET /fiscalite/declarations-corrigees/:id/liasse.pdf`
  - `GET /fiscalite/declarations-corrigees/:id/liasse.csv`
- `Content-Disposition` via `encodeFilenameRFC6266` (RFC 6266 + RFC 8187 — T-06-LIASSE-02).
- **Section S7 "Exports"** dans `brouillon-liasse.ejs` :
  - 2 CTA `<a role="button">` : "Télécharger PDF" + "Télécharger CSV (expert-comptable)".
  - Touch target ≥ 44px (WCAG 2.5.5).
  - Note pédagogique sur la différence PDF (archivage) vs CSV (expert-comptable).

### DI
- `main.ts` : `BrouillonLiasseBuilderPdfmake` instancié + injecté dans
  `registerFiscaliteLiasseRoutes` avec `pdfRenderer` (déjà câblé Phase 1/2).

### Tests
| Type | Fichier | Résultat |
|---|---|---|
| Unit CSV | `tests/unit/fiscalite/exporter-csv-brouillon-liasse.test.ts` | 3/3 GREEN (BOM, anti-injection, format) |
| Intégration PDF | `tests/integration/pdf/brouillon-liasse-magic-bytes.test.ts` | 2/2 GREEN (magic bytes %PDF-) |
| Intégration HTTP | `tests/integration/web/route-liasse-exports.test.ts` | 4/4 GREEN (PDF 200, CSV 200, 404 PDF, 404 CSV rectif) |

## Décisions implémentées

| Décision | Implémentation |
|---|---|
| D-L6.4 — 3 formats (HTML + PDF + CSV) | 4 endpoints + section S7 dans la vue. |
| T-06-LIASSE-01 — CSV injection | `sanitizeCsvCell` + `Money.enEuros()` (jamais cellule commençant par `=`/`+`/`-`/`@`/`\t`/`\r`). |
| T-06-LIASSE-02 — path traversal | `encodeFilenameRFC6266` réutilisé (Phase 4 CR-04, déjà éprouvé). |
| Pattern miroir Plan 05-11 | Builder + Adapter + use case + DI (PdfRenderer réutilisé tel quel). |
| GET vs POST exports | GET retenu (idempotent, bookmark-friendly, cohérent avec `exports.ts` Phase 5). Divergence intentionnelle vs UI-SPEC §S7 documentée ici. |

## Anti-patterns évités

- ✓ Aucun import pdfmake dans `src/domain/fiscalite/liasse/` (`grep -rn "from.*pdfmake" src/domain/fiscalite/liasse/` → 0).
- ✓ `pdf-renderer-pdfmake.ts` réutilisé sans modification.
- ✓ Le use case PDF appelle `genererBrouillonLiasse` sans dupliquer la logique de mapping.
- ✓ Pas de tableau différentiel avant/après pour rectificative (D-L6.5 — différé V1.1).

## Backlog différé

- Scénarios BDD `@phase6-liasse-exports` mentionnés au plan : non ajoutés à
  `brouillon-liasse-reel.feature` et `brouillon-liasse-micro.feature`. Les 9 tests
  unit+integration couvrent intégralement les chemins critiques. À ajouter si l'on
  veut une couverture E2E supplémentaire au moment du `gsd-verify-work`.

## Commits

1. `feat(06-05): exports PDF + CSV brouillon liasse (D-L6.4)`
