import { describe, it, expect } from 'vitest';
import { IRL } from '../../../src/domain/_shared/irl.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';

describe('IRL', () => {
  it("IRL.creer('2026-T1', '145.47') ne throw pas", () => {
    expect(() => IRL.creer({ trimestre: '2026-T1', valeur: '145.47' })).not.toThrow();
  });

  it("IRL.creer('', '145.47') throw (trimestre vide)", () => {
    expect(() => IRL.creer({ trimestre: '', valeur: '145.47' })).toThrow(InvariantViolated);
  });

  it("IRL.creer('2026-T1', '') throw (valeur vide)", () => {
    expect(() => IRL.creer({ trimestre: '2026-T1', valeur: '' })).toThrow(InvariantViolated);
  });

  it("IRL.creer('2026-T1', '0') throw (valeur ≤ 0)", () => {
    expect(() => IRL.creer({ trimestre: '2026-T1', valeur: '0' })).toThrow(InvariantViolated);
  });

  it("IRL.creer('2026-T1', 'abc') throw (valeur pas un decimal)", () => {
    expect(() => IRL.creer({ trimestre: '2026-T1', valeur: 'abc' })).toThrow(InvariantViolated);
  });

  it("IRL.creer avec format invalide '2026T1' throw (format YYYY-TN attendu)", () => {
    expect(() => IRL.creer({ trimestre: '2026T1', valeur: '145.47' })).toThrow(InvariantViolated);
  });

  it('égalité par valeur : 2 IRL identiques sont égaux', () => {
    const irl1 = IRL.creer({ trimestre: '2026-T1', valeur: '145.47' });
    const irl2 = IRL.creer({ trimestre: '2026-T1', valeur: '145.47' });
    expect(irl1.egale(irl2)).toBe(true);
  });
});
