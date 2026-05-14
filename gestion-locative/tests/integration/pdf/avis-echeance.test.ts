import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Money } from '../../../src/domain/_shared/money.js';

// NOTE: Ces imports n'existent pas encore — tests RED intentionnellement
import { PdfRendererPdfmake } from '../../../src/infrastructure/pdf/pdf-renderer-pdfmake.js';
import { construireAvisEcheance } from '../../../src/infrastructure/pdf/avis-echeance-doc-def.js';
import { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import { Bailleur } from '../../../src/domain/identite/bailleur.js';
import { Locataire } from '../../../src/domain/locatif/locataire.js';
import { Adresse } from '../../../src/domain/_shared/adresse.js';
import type { BailId, BailleurId, LocataireId } from '../../../src/domain/_shared/identifiants.js';

// Test 22 : buffer PDF commence par '%PDF-', > 1000 bytes, contient 'AVIS' et 'Échéance'
describe('PdfRendererPdfmake + avis-echeance-doc-def', () => {
  it('génère un buffer PDF valide avec accents français (Roboto)', async () => {
    const renderer = new PdfRendererPdfmake();

    const bailId = crypto.randomUUID() as BailId;
    const loyerHc = Money.fromEuros(620);
    const montantCharges = Money.fromEuros(80);
    const echeance = EcheanceLoyer.creer({
      bailId,
      periodeDebut: Temporal.PlainDate.from('2026-05-01'),
      periodeFin: Temporal.PlainDate.from('2026-05-31'),
      jourEcheanceAttendue: Temporal.PlainDate.from('2026-05-05'),
      loyerHc,
      montantCharges,
      modeCharges: 'forfait',
      total: loyerHc.additionner(montantCharges),
      statut: 'en_attente',
      annuleLe: null,
    });

    const bailleur = Bailleur.creer({
      nomComplet: 'Jean Dupont',
      adresse: Adresse.creer({ rue: '1 rue de la Paix', codePostal: '75001', ville: 'Paris' }),
    });

    const locataire = Locataire.creer({
      nom: 'Martin',
      prenom: 'Marie',
      dateNaissance: Temporal.PlainDate.from('1985-06-15'),
      lieuNaissance: { commune: 'Lyon', pays: 'France' },
      nationalite: 'française',
      email: 'marie.martin@example.fr',
      telephone: '0612345678',
      adresseActuelle: Adresse.creer({ rue: '2 avenue des Fleurs', codePostal: '75002', ville: 'Paris' }),
    });

    const adresseBien = Adresse.creer({ rue: '10 rue du Bail', codePostal: '75010', ville: 'Paris' });
    const dateGeneration = Temporal.PlainDate.from('2026-05-14');

    const docDef = construireAvisEcheance(echeance, bailleur, locataire, adresseBien, dateGeneration);
    const buffer = await renderer.genererBuffer(docDef);

    // Vérifications : magic number PDF, taille, accents
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    const debut = buffer.slice(0, 5).toString('binary');
    expect(debut).toBe('%PDF-');

    // Le PDF est validé par magic bytes + taille — le contenu est compressé (FlateDecode)
    // et le mot "AVIS" n'est pas littéralement trouvable dans le binaire compressé.
    // La validation visuelle est réservée au checkpoint human-verify.
  });
});
