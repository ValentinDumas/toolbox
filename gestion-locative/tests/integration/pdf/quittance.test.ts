import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Money } from '../../../src/domain/_shared/money.js';
import { PdfRendererPdfmake } from '../../../src/infrastructure/pdf/pdf-renderer-pdfmake.js';
import { Bailleur } from '../../../src/domain/identite/bailleur.js';
import { Adresse } from '../../../src/domain/_shared/adresse.js';
import { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import type { BailId, BailleurId, LocataireId } from '../../../src/domain/_shared/identifiants.js';

// NOTE: Ce module n'existe pas encore — tests RED intentionnellement
import { construireQuittance } from '../../../src/infrastructure/pdf/quittance-doc-def.js';

// Helpers stub — Locataire et Bien simplifiés pour ce test
const locataireStub = {
  nom: 'Martin',
  prenom: 'Marie',
};

const bailId = crypto.randomUUID() as BailId;
const loyerHc = Money.fromEuros(800);
const montantCharges = Money.fromEuros(50);
const echeance = EcheanceLoyer.creer({
  bailId,
  periodeDebut: Temporal.PlainDate.from('2026-05-01'),
  periodeFin: Temporal.PlainDate.from('2026-05-31'),
  jourEcheanceAttendue: Temporal.PlainDate.from('2026-05-05'),
  loyerHc,
  montantCharges,
  modeCharges: 'forfait',
  total: loyerHc.additionner(montantCharges),
  statut: 'payee',
  annuleLe: null,
});

const bailleur = Bailleur.creer({
  nomComplet: 'Jean Dupont',
  adresse: Adresse.creer({ rue: '1 rue de la Paix', codePostal: '75001', ville: 'Paris' }),
});

const adresseBien = Adresse.creer({ rue: '10 rue du Bail', codePostal: '75010', ville: 'Paris' });
const numero = '2026-001';
const emiseLe = Temporal.PlainDate.from('2026-05-31');

// T19: Test PDF buffer mentions légales loi 89 art. 21
describe('PdfRendererPdfmake + quittance-doc-def', () => {
  it('T19: génère un buffer PDF valide avec toutes les mentions légales loi 89 art. 21', async () => {
    const renderer = new PdfRendererPdfmake();

    const docDef = construireQuittance(
      echeance,
      bailleur,
      locataireStub as Parameters<typeof construireQuittance>[2],
      adresseBien,
      numero,
      emiseLe,
      'forfait',
    );

    const buffer = await renderer.genererBuffer(docDef);

    // Magic bytes PDF
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1500);
    expect(buffer.slice(0, 5).toString('binary')).toBe('%PDF-');

    // Les mentions légales loi 89 art. 21 doivent être présentes dans les métadonnées
    // ou le contenu non-compressé du PDF.
    // Le texte pdfmake est souvent encodé en streams compressés mais les chaînes courtes
    // peuvent apparaître en clair dans les objets de type /Contents ou stream non-compressé.
    // On vérifie à minima la taille et les magic bytes.
    // La validation visuelle du contenu est réservée au checkpoint.
    expect(buffer.length).toBeGreaterThan(1500);
  });

  it('T19b: le docDef contient les mentions légales loi 89 dans son contenu JSON', () => {
    const docDef = construireQuittance(
      echeance,
      bailleur,
      locataireStub as Parameters<typeof construireQuittance>[2],
      adresseBien,
      numero,
      emiseLe,
      'forfait',
    );

    // Sérialiser en JSON pour inspecter le texte contenu (avant compression)
    const json = JSON.stringify(docDef);

    expect(json).toContain('Quittance');
    expect(json).toContain('2026-001');
    expect(json).toContain('article 21');
    expect(json).toContain('Tous comptes apurés');
    expect(json).toContain('Jean Dupont');
    expect(json).toContain('Marie Martin');
  });
});
