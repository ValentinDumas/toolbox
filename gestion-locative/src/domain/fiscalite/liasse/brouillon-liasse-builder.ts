/**
 * Port `BrouillonLiasseBuilder` — abstraction de la construction du document
 * PDF du brouillon liasse fiscale (Phase 6 / FIS-05 / D-L6.4).
 *
 * **Wave 1 : signature uniquement.** L'adapter `BrouillonLiasseBuilderPdfmake`
 * sera créé au Plan 05 (FIS-05.4 — exports PDF/CSV).
 *
 * Pattern miroir exact : `src/domain/fiscalite/recap-fiscal-builder.ts`.
 *
 * Le domaine reste pur : il passe un `unknown` pour éviter d'importer le type
 * `TDocumentDefinitions` de pdfmake (package infrastructure). L'adapter caste
 * vers `TDocumentDefinitions` à l'entrée — règle hexagonale CLAUDE.md.
 *
 * Signature plus simple que `RecapFiscalBuilder` car le DTO est déjà construit
 * côté application (cross-BC agrégation = use case `genererBrouillonLiasse`).
 *
 * Utilisé par (Plans suivants) :
 *   - Plan 05 : `application/fiscalite/exporter-pdf-brouillon-liasse.ts`
 *
 * Implémenté par (Plans suivants) :
 *   - Plan 05 : `infrastructure/pdf/brouillon-liasse-builder-pdfmake.ts`
 */

import type { BrouillonLiasseDto } from './case-liasse.js';

export interface BrouillonLiasseBuilder {
  /**
   * Construit la définition pdfmake du brouillon liasse à partir du DTO résolu.
   *
   * Le type concret retourné est `TDocumentDefinitions` (pdfmake), volontairement
   * masqué en `unknown` pour préserver la pureté du domaine (CLAUDE.md règle
   * hexagonale, miroir de `PdfRenderer.genererBuffer`).
   *
   * @param dto - brouillon liasse résolu (sections × cases × valeurs snapshot)
   * @returns définition de document opaque, à passer à `PdfRenderer.genererBuffer`
   */
  construire(dto: BrouillonLiasseDto): unknown;
}
