import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Bail } from '../../../src/domain/locatif/bail.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { IRL } from '../../../src/domain/_shared/irl.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import { unBailValide, unMontantValide, unIrlValide } from '../../_builders/locatif.js';
import { nouveauBienId, nouveauLotId, nouveauLocataireId } from '../../../src/domain/_shared/identifiants.js';

// Tests Phase 2 — extension Bail.activer() (D-51, D-53)

describe('Bail', () => {
  it('Bail.creer accepte un bail valide (12 mois, dépôt = loyer)', () => {
    expect(() => unBailValide()).not.toThrow();
  });

  it('Bail.creer rejette duree_mois = 11 (LOCATION_MEUBLEE_REGLES §3.1)', () => {
    expect(() => unBailValide({ dureeMois: 11 })).toThrow(
      'Un bail meublé classique doit durer au moins 12 mois',
    );
  });

  it('Bail.creer rejette duree_mois = 0', () => {
    expect(() => unBailValide({ dureeMois: 0 })).toThrow(InvariantViolated);
  });

  it('Bail.creer accepte dépôt = 2×loyer_hc (limite inclusive)', () => {
    const loyer = Money.fromCentimes(80_000n);
    const depot = Money.fromCentimes(160_000n); // exactement 2×
    expect(() => unBailValide({ loyerHc: loyer, depotGarantie: depot })).not.toThrow();
  });

  it('Bail.creer rejette dépôt = 2×loyer_hc + 1 centime (LOCATION_MEUBLEE_REGLES §5)', () => {
    const loyer = Money.fromCentimes(80_000n);
    const depot = Money.fromCentimes(160_001n); // 1 centime au-dessus
    expect(() => unBailValide({ loyerHc: loyer, depotGarantie: depot })).toThrow(
      'Le dépôt de garantie ne peut pas dépasser 2 mois de loyer hors charges',
    );
  });

  it('Bail.creer rejette loyer_hc = 0 (Money zero)', () => {
    expect(() => unBailValide({ loyerHc: Money.zero() })).toThrow(
      'Le loyer hors charges doit être supérieur à 0 €',
    );
  });

  it('Bail.creer rejette lot_ids vide', () => {
    expect(() => unBailValide({ lotIds: [] })).toThrow(
      'Sélectionnez au moins un lot',
    );
  });

  it("Bail.creer accepte mode_charges 'forfait'", () => {
    expect(() => unBailValide({ modeCharges: 'forfait' })).not.toThrow();
  });

  it("Bail.creer accepte mode_charges 'provisions'", () => {
    expect(() => unBailValide({ modeCharges: 'provisions' })).not.toThrow();
  });

  it("Bail.creer rejette mode_charges 'autre'", () => {
    expect(() => unBailValide({ modeCharges: 'autre' as 'forfait' })).toThrow(InvariantViolated);
  });

  it('Bail.creer accepte cautionnement null (optionnel V1)', () => {
    expect(() => unBailValide({ cautionnement: null })).not.toThrow();
  });

  it('Bail.creer accepte date_debut dans le passé OU futur (pas d\'invariant temporel Phase 1)', () => {
    const passe = Temporal.PlainDate.from('2020-01-01');
    const futur = Temporal.PlainDate.from('2027-06-01');
    expect(() => unBailValide({ dateDebut: passe })).not.toThrow();
    expect(() => unBailValide({ dateDebut: futur })).not.toThrow();
  });

  it('Bail.modifier({ loyerHc: Money(1000) }) retourne nouvelle instance', () => {
    const bail = unBailValide();
    const nouveauLoyer = Money.fromEuros(1000);
    // dépôt doit être ≤ 2×1000 = 2000 €
    const modifie = bail.modifier({ loyerHc: nouveauLoyer, depotGarantie: Money.fromEuros(1000) });
    expect(modifie.loyerHc.toCentimes()).toBe(100_000n);
    expect(modifie).not.toBe(bail);
  });

  it('Bail.modifier avec dépôt = 3×loyer throw (re-valide invariants)', () => {
    const bail = unBailValide({ loyerHc: Money.fromEuros(800) });
    expect(() =>
      bail.modifier({ depotGarantie: Money.fromEuros(2400) }), // 3 × 800
    ).toThrow('Le dépôt de garantie ne peut pas dépasser 2 mois de loyer hors charges');
  });

  // Phase 2 — Bail.activer() (D-51, D-53)
  it('bail.activer(PlainDate, 5) retourne Bail activé avec actifDepuis et jourEcheance=5', () => {
    const bail = unBailValide();
    const date = Temporal.PlainDate.from('2026-06-01');
    const bailActive = bail.activer(date, 5);
    expect(bailActive.actifDepuis).not.toBeNull();
    expect(Temporal.PlainDate.compare(bailActive.actifDepuis!, date)).toBe(0);
    expect(bailActive.jourEcheance).toBe(5);
    expect(bailActive).not.toBe(bail); // copy-on-write
  });

  it("bail.activer(date, 29) throw InvariantViolated (D-53)", () => {
    const bail = unBailValide();
    const date = Temporal.PlainDate.from('2026-06-01');
    expect(() => bail.activer(date, 29)).toThrow(
      "Le jour d'échéance doit être entre 1 et 28 (D-53)",
    );
  });

  it("bail.activer(date, 0) throw InvariantViolated (D-53)", () => {
    const bail = unBailValide();
    const date = Temporal.PlainDate.from('2026-06-01');
    expect(() => bail.activer(date, 0)).toThrow(
      "Le jour d'échéance doit être entre 1 et 28 (D-53)",
    );
  });
});
