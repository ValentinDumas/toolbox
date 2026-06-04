/**
 * Adapter pdfmake pour le port `BrouillonLiasseBuilder` (Phase 6 / FIS-05 / D-L6.4).
 *
 * Pattern miroir : `recap-fiscal-builder-pdfmake.ts`.
 * Wraps la fonction pure `construireBrouillonLiasse` qui retourne une
 * `TDocumentDefinitions` pdfmake. Le port domaine ne voit que `unknown`.
 */

import type { BrouillonLiasseBuilder } from '../../domain/fiscalite/liasse/brouillon-liasse-builder.js';
import type { BrouillonLiasseDto } from '../../domain/fiscalite/liasse/case-liasse.js';
import { construireBrouillonLiasse } from './brouillon-liasse-doc-def.js';

export class BrouillonLiasseBuilderPdfmake implements BrouillonLiasseBuilder {
  construire(dto: BrouillonLiasseDto): unknown {
    return construireBrouillonLiasse(dto);
  }
}
