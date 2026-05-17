import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import { PdfRendererPdfmake } from '../../../src/infrastructure/pdf/pdf-renderer-pdfmake.js';
import { construireAvenantIRL } from '../../../src/infrastructure/pdf/avenant-irl-doc-def.js';
import { Bailleur } from '../../../src/domain/identite/bailleur.js';
import { Adresse } from '../../../src/domain/_shared/adresse.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { IRL } from '../../../src/domain/_shared/irl.js';
import { unBailIndexableValide, unLocataireValide } from '../../_builders/locatif.js';

describe('Avenant IRL PDF builder (Phase 3-04, D-93)', () => {
  it('T27: génère un buffer PDF valide + mentions loi 89 art. 17-1', async () => {
    const renderer = new PdfRendererPdfmake();
    const bailleur = Bailleur.creer({
      nomComplet: 'Jean Bailleur',
      adresse: Adresse.creer({ rue: '1 rue Bailleur', codePostal: '75001', ville: 'Paris' }),
    });
    const locataire = unLocataireValide({ nom: 'Martin', prenom: 'Marie' });
    const bail = unBailIndexableValide({
      loyerHc: Money.fromCentimes(81_920n),
      irlReference: IRL.creer({ trimestre: '2025-T4', valeur: '145.47' }),
    });
    const irlAncien = IRL.creer({ trimestre: '2024-T4', valeur: '142.06' });
    const irlNouveau = IRL.creer({ trimestre: '2025-T4', valeur: '145.47' });
    const loyerAvant = Money.fromCentimes(80_000n);
    const loyerApres = Money.fromCentimes(81_920n);
    const dateEffet = Temporal.PlainDate.from('2026-05-01');

    const docDef = construireAvenantIRL(
      bail,
      locataire,
      bailleur,
      irlNouveau,
      irlAncien,
      loyerAvant,
      loyerApres,
      dateEffet,
    );

    const buffer = await renderer.genererBuffer(docDef);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1500);
    expect(buffer.slice(0, 5).toString('binary')).toBe('%PDF-');

    const json = JSON.stringify(docDef);
    expect(json).toContain('AVENANT');
    expect(json).toContain('Révision IRL');
    expect(json).toContain('article 17-1');
    expect(json).toContain('89-462');
    expect(json).toContain('Jean Bailleur');
    expect(json).toContain('Martin');
    expect(json).toContain('142.06');
    expect(json).toContain('145.47');
  });
});
