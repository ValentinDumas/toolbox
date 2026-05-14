import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Cautionnement } from '../../../src/domain/locatif/cautionnement.js';
import { Adresse } from '../../../src/domain/_shared/adresse.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';

const garnatValide = {
  nom: 'Martin',
  prenom: 'Jean',
  email: 'jean.martin@example.fr',
  telephone: '0612345678',
  adresse: Adresse.creer({ rue: '10 avenue de la Paix', codePostal: '75008', ville: 'Paris' }),
};

describe('Cautionnement', () => {
  it("creer type='physique' avec garant complet — ne throw pas", () => {
    expect(() =>
      Cautionnement.creer({
        type: 'physique',
        garant: garnatValide,
        montantGaranti: null,
        dateSignature: Temporal.PlainDate.from('2026-05-01'),
        dureeEngagement: 12,
      }),
    ).not.toThrow();
  });

  it("creer type='visale' sans garant (organisme) — ne throw pas", () => {
    expect(() =>
      Cautionnement.creer({
        type: 'visale',
        garant: null,
        montantGaranti: null,
        dateSignature: Temporal.PlainDate.from('2026-05-01'),
        dureeEngagement: 12,
      }),
    ).not.toThrow();
  });

  it('creer type hors enum — throw InvariantViolated', () => {
    expect(() =>
      Cautionnement.creer({
        type: 'bancaire' as 'physique',
        garant: null,
        montantGaranti: null,
        dateSignature: Temporal.PlainDate.from('2026-05-01'),
        dureeEngagement: 12,
      }),
    ).toThrow(InvariantViolated);
  });

  it("creer date_signature dans le futur — throw (cautionnement signé avant ou à date du bail)", () => {
    const dateFutur = Temporal.Now.plainDateISO().add({ days: 1 });
    expect(() =>
      Cautionnement.creer({
        type: 'physique',
        garant: garnatValide,
        montantGaranti: null,
        dateSignature: dateFutur,
        dureeEngagement: 12,
      }),
    ).toThrow(InvariantViolated);
  });

  it('creer durée_engagement < 1 mois — throw InvariantViolated', () => {
    expect(() =>
      Cautionnement.creer({
        type: 'physique',
        garant: garnatValide,
        montantGaranti: null,
        dateSignature: Temporal.PlainDate.from('2026-05-01'),
        dureeEngagement: 0,
      }),
    ).toThrow(InvariantViolated);
  });
});
