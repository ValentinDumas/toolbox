/**
 * Routes export fiscalité — GET /fiscalite/declarations/:id/csv et /pdf.
 *
 * D-FIS-G5.3 : téléchargement CSV + PDF récap bailleur.
 * RFC 6266 : Content-Disposition filename*=UTF-8'' (nom de fichier encodé UTF-8).
 *
 * Sources :
 *   - D-FIS-G5.3 : export CSV + PDF
 *   - RFC 6266 : encodage UTF-8 dans Content-Disposition
 *   - T-05-07-04 : CSV injection mitigation via Money.enEuros()
 */

import type { FastifyInstance } from 'fastify';
import type { DeclarationAnnuelleRepository } from '../../../domain/fiscalite/declaration-annuelle-repository.js';
import type { BailleurRepository } from '../../../domain/identite/bailleur-repository.js';
import type { BienRepository } from '../../../domain/patrimoine/bien-repository.js';
import type { TableauAmortissementRepository } from '../../../domain/fiscalite/tableau-amortissement-repository.js';
import type { PdfRenderer } from '../../../domain/encaissements/pdf-renderer.js';
import type { DeclarationAnnuelleId } from '../../../domain/_shared/identifiants.js';
import {
  exporterCsvFiscal,
  DeclarationIntrouvable,
} from '../../../application/fiscalite/exporter-csv-fiscal.js';
import {
  exporterPdfRecap,
  DeclarationIntrouvablePdf,
  BailleurIntrouvable,
} from '../../../application/fiscalite/exporter-pdf-recap.js';

export interface ExportsDeps {
  declRepo: DeclarationAnnuelleRepository;
  bailleurRepo: BailleurRepository;
  bienRepo: BienRepository;
  tableauAmortRepo: TableauAmortissementRepository;
  pdfRenderer: PdfRenderer;
}

/**
 * Encode un nom de fichier pour l'en-tête Content-Disposition RFC 6266.
 * Format : filename*=UTF-8''<encoded>
 */
function contentDispositionFilename(nomFichier: string): string {
  const encoded = encodeURIComponent(nomFichier);
  return `attachment; filename="${nomFichier}"; filename*=UTF-8''${encoded}`;
}

export async function registerFiscaliteExportsRoutes(
  app: FastifyInstance,
  deps: ExportsDeps,
): Promise<void> {
  const { declRepo, bailleurRepo, bienRepo, tableauAmortRepo, pdfRenderer } = deps;

  /**
   * GET /fiscalite/declarations/:id/csv
   * Téléchargement CSV de la déclaration annuelle.
   */
  app.get<{ Params: { id: string } }>(
    '/fiscalite/declarations/:id/csv',
    async (req, reply) => {
      const declarationId = req.params.id as DeclarationAnnuelleId;

      try {
        const { contenu, nomFichier } = await exporterCsvFiscal(
          { declarationId },
          { declRepo },
        );

        return reply
          .type('text/csv; charset=utf-8')
          .header('Content-Disposition', contentDispositionFilename(nomFichier))
          .send(contenu);
      } catch (err) {
        if (err instanceof DeclarationIntrouvable) {
          return reply.status(404).type('text/plain').send('Déclaration introuvable.');
        }
        throw err;
      }
    },
  );

  /**
   * GET /fiscalite/declarations/:id/pdf
   * Téléchargement PDF du récapitulatif bailleur.
   */
  app.get<{ Params: { id: string } }>(
    '/fiscalite/declarations/:id/pdf',
    async (req, reply) => {
      const declarationId = req.params.id as DeclarationAnnuelleId;

      try {
        const { buffer, nomFichier } = await exporterPdfRecap(
          { declarationId },
          { declRepo, bailleurRepo, bienRepo, tableauAmortRepo },
          pdfRenderer,
        );

        return reply
          .type('application/pdf')
          .header('Content-Disposition', contentDispositionFilename(nomFichier))
          .send(buffer);
      } catch (err) {
        if (err instanceof DeclarationIntrouvablePdf || err instanceof BailleurIntrouvable) {
          return reply.status(404).type('text/plain').send(err.message);
        }
        throw err;
      }
    },
  );
}
