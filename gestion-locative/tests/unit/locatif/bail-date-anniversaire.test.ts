import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { unBailValide } from '../../_builders/locatif.js';

describe('Bail.dateAnniversaireProchaine', () => {
  // T10 — today AVANT dateDebut → dateDebut + 1 an
  it('T10 today avant dateDebut → dateDebut + 1 an', () => {
    const bail = unBailValide({ dateDebut: Temporal.PlainDate.from('2026-05-01') });
    const r = bail.dateAnniversaireProchaine(Temporal.PlainDate.from('2026-04-01'));
    expect(r.toString()).toBe('2027-05-01');
  });

  // T11 — today === dateDebut → dateDebut + 1 an
  it('T11 today égal dateDebut → dateDebut + 1 an', () => {
    const bail = unBailValide({ dateDebut: Temporal.PlainDate.from('2026-05-01') });
    const r = bail.dateAnniversaireProchaine(Temporal.PlainDate.from('2026-05-01'));
    expect(r.toString()).toBe('2027-05-01');
  });

  // T12 — today === dateDebut + 1 an exact → +2 ans
  it('T12 today exactement +1 an → +2 ans', () => {
    const bail = unBailValide({ dateDebut: Temporal.PlainDate.from('2026-05-01') });
    const r = bail.dateAnniversaireProchaine(Temporal.PlainDate.from('2027-05-01'));
    expect(r.toString()).toBe('2028-05-01');
  });

  // T13 — today 1 an et 1.5 mois après → +2 ans
  it('T13 today 2027-06-15 → 2028-05-01', () => {
    const bail = unBailValide({ dateDebut: Temporal.PlainDate.from('2026-05-01') });
    const r = bail.dateAnniversaireProchaine(Temporal.PlainDate.from('2027-06-15'));
    expect(r.toString()).toBe('2028-05-01');
  });

  // T14 — today 4+ ans après
  it('T14 today 2030-12-31 → 2031-05-01', () => {
    const bail = unBailValide({ dateDebut: Temporal.PlainDate.from('2026-05-01') });
    const r = bail.dateAnniversaireProchaine(Temporal.PlainDate.from('2030-12-31'));
    expect(r.toString()).toBe('2031-05-01');
  });

  // T15 — dateDebut bissextile 2024-02-29
  // Temporal clamp 29 fév → 28 fév sur année non bissextile.
  // today=2025-02-28 == dateDebut.add({years:1}) → semantique "atteint maintenant" → prochain = +1 an
  it('T15 bissextile 2024-02-29 + 1y clamp 28 fév : today 2025-02-28 → 2026-02-28', () => {
    const bail = unBailValide({
      dateDebut: Temporal.PlainDate.from('2024-02-29'),
      dureeMois: 24,
    });
    const r = bail.dateAnniversaireProchaine(Temporal.PlainDate.from('2025-02-28'));
    expect(r.toString()).toBe('2026-02-28');
  });
});
