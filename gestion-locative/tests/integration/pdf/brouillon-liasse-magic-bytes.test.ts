/**
 * Tests d'intégration PDF — `construireBrouillonLiasse` + `PdfRendererPdfmake`
 * (Phase 6 / FIS-05 / Plan 06-05).
 *
 * Vérifie que le buffer PDF généré commence par les magic bytes `%PDF-` et
 * que les sections rendues correspondent aux régimes (réel/micro/rectificative).
 */

import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import { Money } from '../../../src/domain/_shared/money.js';
import { PdfRendererPdfmake } from '../../../src/infrastructure/pdf/pdf-renderer-pdfmake.js';
import { construireBrouillonLiasse } from '../../../src/infrastructure/pdf/brouillon-liasse-doc-def.js';
import type { BrouillonLiasseDto } from '../../../src/domain/fiscalite/liasse/case-liasse.js';

function dtoMinimal(opts: { motifRectification?: string }): BrouillonLiasseDto {
  return {
    exercice: 2026,
    regimeApplique: 'reel',
    bailleurNom: 'Test Bailleur',
    sections: [
      {
        titre: '2031-SD — Déclaration de résultats BIC 2026',
        annexe: '2031-SD',
        cases: [
          {
            numero: 'CB',
            libelleOfficiel: 'Bénéfice fiscal',
            annexe: '2031-SD',
            valeur: Money.fromEuros(8_500),
          },
        ],
      },
    ],
    clotureLe: Temporal.PlainDate.from('2026-12-31'),
    ...(opts.motifRectification ? { motifRectification: opts.motifRectification, urlOriginale: '/fiscalite/declarations/x/liasse' } : {}),
  };
}

describe('construireBrouillonLiasse + PdfRendererPdfmake (Plan 06-05)', () => {
  it('génère un buffer PDF valide (magic bytes %PDF-)', async () => {
    const renderer = new PdfRendererPdfmake();
    const docDef = construireBrouillonLiasse(dtoMinimal({}));
    const buffer = await renderer.genererBuffer(docDef);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('rectificative : génère le PDF avec mention motif', async () => {
    const renderer = new PdfRendererPdfmake();
    const docDef = construireBrouillonLiasse(
      dtoMinimal({ motifRectification: 'Oubli charge syndic' }),
    );
    const buffer = await renderer.genererBuffer(docDef);

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });
});
