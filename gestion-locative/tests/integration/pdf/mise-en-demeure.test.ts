import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Money } from '../../../src/domain/_shared/money.js';
import { PdfRendererPdfmake } from '../../../src/infrastructure/pdf/pdf-renderer-pdfmake.js';
import { Bailleur } from '../../../src/domain/identite/bailleur.js';
import { Adresse } from '../../../src/domain/_shared/adresse.js';
import { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import type { BailId, BailleurId } from '../../../src/domain/_shared/identifiants.js';

// Tests RED — mise-en-demeure-doc-def + PdfRendererPdfmake
// NOTE: Ce module n'existe pas encore — tests RED intentionnellement
import { construireMiseEnDemeure } from '../../../src/infrastructure/pdf/mise-en-demeure-doc-def.js';

const bailId = crypto.randomUUID() as BailId;
const loyerHc = Money.fromEuros(700);
const echeance = EcheanceLoyer.creer({
  bailId,
  periodeDebut: Temporal.PlainDate.from('2026-05-01'),
  periodeFin: Temporal.PlainDate.from('2026-05-31'),
  jourEcheanceAttendue: Temporal.PlainDate.from('2026-05-05'),
  loyerHc,
  montantCharges: Money.zero(),
  modeCharges: 'forfait',
  total: loyerHc,
  statut: 'en_attente',
  annuleLe: null,
});

const bailleur = Bailleur.creer({
  id: crypto.randomUUID() as BailleurId,
  nomComplet: 'Jean Dupont',
  adresse: Adresse.creer({ rue: '1 rue de la Paix', codePostal: '75001', ville: 'Paris' }),
});

const locataireStub = {
  prenom: 'Marie',
  nom: 'Martin',
  email: 'marie@example.fr',
  adresse: { rue: '10 rue du Bail', codePostal: '75010', ville: 'Paris' },
};

const bienStub = {
  adresse: Adresse.creer({ rue: '10 rue du Bail', codePostal: '75010', ville: 'Paris' }),
};

const bailStub = {
  dateDebut: Temporal.PlainDate.from('2026-01-01'),
  dureeMois: 12,
  loyerHc,
};

const today = Temporal.PlainDate.from('2026-07-05');
const montantTotalDu = Money.fromEuros(700);

describe('construireMiseEnDemeure + PdfRendererPdfmake', () => {
  it('T22 : docDef contient mentions essentielles Code civil art. 1344 + buffer commence par %PDF-', async () => {
    const renderer = new PdfRendererPdfmake();

    // Vérifier le docDef avant que pdfmake le mutate
    const docDef = construireMiseEnDemeure(
      echeance,
      [],
      bailleur,
      locataireStub,
      bienStub,
      bienStub.adresse,
      bailStub,
      montantTotalDu,
      today,
    );

    // Sérialiser AVANT le rendu pdfmake (pdfmake mute le docDef en place)
    const json = JSON.stringify(docDef);
    expect(json).toContain('MISE EN DEMEURE');
    expect(json).toContain('8 (huit) jours');
    expect(json).toContain('voies de droit');
    expect(json).toContain('recommand');
    expect(json).toContain('Marie Martin');
    expect(json).toContain('Jean Dupont');

    // Génération PDF
    const buffer = await renderer.genererBuffer(docDef);
    expect(buffer.slice(0, 5).toString('binary')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
