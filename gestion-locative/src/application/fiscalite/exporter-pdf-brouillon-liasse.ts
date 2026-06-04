import type { DeclarationAnnuelleId, DeclarationCorrigeeId } from '../../domain/_shared/identifiants.js';
import type { BrouillonLiasseBuilder } from '../../domain/fiscalite/liasse/brouillon-liasse-builder.js';
import type { PdfRenderer } from '../../domain/encaissements/pdf-renderer.js';
import {
  genererBrouillonLiasse,
  type GenererBrouillonLiasseDeps,
} from './generer-brouillon-liasse.js';

export type ExporterPdfBrouillonLiasseCommande =
  | { readonly declarationId: DeclarationAnnuelleId }
  | { readonly declarationCorrigeeId: DeclarationCorrigeeId };

export interface ExporterPdfBrouillonLiasseDeps extends GenererBrouillonLiasseDeps {
  readonly brouillonLiasseBuilder: BrouillonLiasseBuilder;
  readonly pdfRenderer: PdfRenderer;
}

export interface ExporterPdfBrouillonLiasseResultat {
  readonly buffer: Buffer;
  readonly nomFichier: string;
}

/**
 * Use case — exporter le brouillon liasse au format PDF (Phase 6 / FIS-05 / D-L6.4).
 *
 * Pattern miroir : `exporter-pdf-recap.ts`.
 */
export async function exporterPdfBrouillonLiasse(
  commande: ExporterPdfBrouillonLiasseCommande,
  deps: ExporterPdfBrouillonLiasseDeps,
): Promise<ExporterPdfBrouillonLiasseResultat> {
  const dto = await genererBrouillonLiasse(commande, deps);
  const docDef = deps.brouillonLiasseBuilder.construire(dto);
  const buffer = await deps.pdfRenderer.genererBuffer(docDef);
  const nomFichier = dto.motifRectification
    ? `brouillon-liasse-rectificative-${dto.exercice}.pdf`
    : `brouillon-liasse-${dto.exercice}.pdf`;
  return { buffer, nomFichier };
}
