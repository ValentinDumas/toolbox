import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import { BailIndexation } from '../../../src/domain/locatif/bail-indexation.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { IRL } from '../../../src/domain/_shared/irl.js';
import { nouveauBailId } from '../../../src/domain/_shared/identifiants.js';

const bailId = nouveauBailId();
const dateEffet = Temporal.PlainDate.from('2026-05-01');
const irlAvant = IRL.creer({ trimestre: '2024-T4', valeur: '142.06' });
const irlApres = IRL.creer({ trimestre: '2025-T4', valeur: '145.47' });
const loyerAvant = Money.fromCentimes(80_000n);
const loyerApresHausse = Money.fromCentimes(81_920n);

describe('BailIndexation (Phase 3-04, D-96)', () => {
  it('T1: creer indexation appliquée valide (hausse loyer)', () => {
    expect(() =>
      BailIndexation.creer({
        bailId,
        dateEffet,
        irlAvant,
        irlApres,
        loyerAvant,
        loyerApres: loyerApresHausse,
        indexationAppliquee: true,
        raisonNonApplication: null,
      }),
    ).not.toThrow();
  });

  it('T2: throw si appliquée + raisonNonApplication non null', () => {
    expect(() =>
      BailIndexation.creer({
        bailId,
        dateEffet,
        irlAvant,
        irlApres,
        loyerAvant,
        loyerApres: loyerApresHausse,
        indexationAppliquee: true,
        raisonNonApplication: 'gel_dpe',
      }),
    ).toThrow(InvariantViolated);
  });

  it('T3: throw si appliquée + loyerApres < loyerAvant', () => {
    expect(() =>
      BailIndexation.creer({
        bailId,
        dateEffet,
        irlAvant,
        irlApres,
        loyerAvant,
        loyerApres: Money.fromCentimes(79_000n),
        indexationAppliquee: true,
        raisonNonApplication: null,
      }),
    ).toThrow(InvariantViolated);
  });

  it('T4: throw si non appliquée + raisonNonApplication null', () => {
    expect(() =>
      BailIndexation.creer({
        bailId,
        dateEffet,
        irlAvant,
        irlApres,
        loyerAvant,
        loyerApres: loyerAvant,
        indexationAppliquee: false,
        raisonNonApplication: null,
      }),
    ).toThrow(InvariantViolated);
  });

  it('T5: throw si non appliquée + loyerApres modifié', () => {
    expect(() =>
      BailIndexation.creer({
        bailId,
        dateEffet,
        irlAvant,
        irlApres,
        loyerAvant,
        loyerApres: loyerApresHausse,
        indexationAppliquee: false,
        raisonNonApplication: 'refus_bailleur',
      }),
    ).toThrow(InvariantViolated);
  });

  it('T6: non appliquée avec gel_dpe + loyer égal → OK', () => {
    expect(() =>
      BailIndexation.creer({
        bailId,
        dateEffet,
        irlAvant,
        irlApres,
        loyerAvant,
        loyerApres: loyerAvant,
        indexationAppliquee: false,
        raisonNonApplication: 'gel_dpe',
      }),
    ).not.toThrow();
  });

  it('T7: throw si raisonNonApplication hors enum', () => {
    expect(() =>
      BailIndexation.creer({
        bailId,
        dateEffet,
        irlAvant,
        irlApres,
        loyerAvant,
        loyerApres: loyerAvant,
        indexationAppliquee: false,
        raisonNonApplication: 'autre' as 'gel_dpe',
      }),
    ).toThrow(InvariantViolated);
  });

  it('T8: pas de méthode annuler — agrégat append-only', () => {
    expect((BailIndexation.prototype as unknown as { annuler?: unknown }).annuler).toBeUndefined();
  });
});
