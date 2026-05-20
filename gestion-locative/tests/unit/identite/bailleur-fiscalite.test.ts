/**
 * Tests BDD — Bailleur étendu avec champs fiscaux Phase 5 (D-LOCK-2, D-FIS-G3.1, D-FIS-G5.4).
 *
 * Couverture :
 *   - creer sans les 3 nouveaux champs → les 3 sont null
 *   - creer avec regimeFiscal='reel' + revenusActifs + fiscalitePremierAcces → les 3 sont set
 *   - modifier(regimeFiscal='micro_bic') → copy-on-write, autres champs préservés
 *   - modifier(revenusActifs) → autres champs préservés
 *   - modifier(fiscalitePremierAcces) → trace première ouverture
 */

import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Money } from '../../../src/domain/_shared/money.js';
import { Bailleur } from '../../../src/domain/identite/bailleur.js';
import { Adresse } from '../../../src/domain/_shared/adresse.js';

function uneAdresseValide(): Adresse {
  return Adresse.creer({ rue: '12 rue de la Paix', codePostal: '75002', ville: 'Paris' });
}

describe('Bailleur — champs fiscaux Phase 5 (D-LOCK-2)', () => {
  describe('creer() — defaults fiscaux null', () => {
    it('creer sans champs fiscaux → regimeFiscal = null', () => {
      const b = Bailleur.creer({ nomComplet: 'Jean Dupont', adresse: uneAdresseValide() });
      expect(b.regimeFiscal).toBeNull();
    });

    it('creer sans champs fiscaux → revenusActifsAnnuelsCourant = null', () => {
      const b = Bailleur.creer({ nomComplet: 'Jean Dupont', adresse: uneAdresseValide() });
      expect(b.revenusActifsAnnuelsCourant).toBeNull();
    });

    it('creer sans champs fiscaux → fiscalitePremierAcces = null', () => {
      const b = Bailleur.creer({ nomComplet: 'Jean Dupont', adresse: uneAdresseValide() });
      expect(b.fiscalitePremierAcces).toBeNull();
    });
  });

  describe('creer() — avec champs fiscaux définis', () => {
    it('creer avec regimeFiscal reel → regimeFiscal = "reel"', () => {
      const b = Bailleur.creer({
        nomComplet: 'Jean Dupont',
        adresse: uneAdresseValide(),
        regimeFiscal: 'reel',
      });
      expect(b.regimeFiscal).toBe('reel');
    });

    it('creer avec revenusActifsAnnuelsCourant 50 000 € → centimes préservés', () => {
      const revenus = Money.fromEuros(50_000);
      const b = Bailleur.creer({
        nomComplet: 'Jean Dupont',
        adresse: uneAdresseValide(),
        revenusActifsAnnuelsCourant: revenus,
      });
      expect(b.revenusActifsAnnuelsCourant).not.toBeNull();
      expect(b.revenusActifsAnnuelsCourant!.toCentimes()).toBe(5_000_000n);
    });

    it('creer avec fiscalitePremierAcces → PlainDateTime set', () => {
      const dt = Temporal.PlainDateTime.from('2026-05-20T14:30:00');
      const b = Bailleur.creer({
        nomComplet: 'Jean Dupont',
        adresse: uneAdresseValide(),
        fiscalitePremierAcces: dt,
      });
      expect(b.fiscalitePremierAcces).not.toBeNull();
      expect(b.fiscalitePremierAcces!.toString()).toBe('2026-05-20T14:30:00');
    });
  });

  describe('modifier() — copy-on-write strict (D-LOCK-2)', () => {
    it('modifier(regimeFiscal="micro_bic") → nouvelle instance avec regimeFiscal micro_bic', () => {
      const original = Bailleur.creer({
        nomComplet: 'Jean Dupont',
        adresse: uneAdresseValide(),
        regimeFiscal: 'reel',
        revenusActifsAnnuelsCourant: Money.fromEuros(40_000),
      });
      const modifie = original.modifier({ regimeFiscal: 'micro_bic' });
      expect(modifie.regimeFiscal).toBe('micro_bic');
      // Copy-on-write : instance différente
      expect(modifie).not.toBe(original);
      // Champs non modifiés préservés
      expect(modifie.nomComplet).toBe('Jean Dupont');
      expect(modifie.revenusActifsAnnuelsCourant!.toCentimes()).toBe(4_000_000n);
    });

    it('modifier(revenusActifsAnnuelsCourant) → regimeFiscal et fiscalitePremierAcces préservés', () => {
      const dt = Temporal.PlainDateTime.from('2026-05-20T14:30:00');
      const original = Bailleur.creer({
        nomComplet: 'Jean Dupont',
        adresse: uneAdresseValide(),
        regimeFiscal: 'reel',
        fiscalitePremierAcces: dt,
      });
      const modifie = original.modifier({
        revenusActifsAnnuelsCourant: Money.fromEuros(60_000),
      });
      expect(modifie.revenusActifsAnnuelsCourant!.toCentimes()).toBe(6_000_000n);
      expect(modifie.regimeFiscal).toBe('reel');
      expect(modifie.fiscalitePremierAcces!.toString()).toBe('2026-05-20T14:30:00');
    });

    it('modifier(fiscalitePremierAcces) → trace première ouverture, autres champs préservés', () => {
      const original = Bailleur.creer({
        nomComplet: 'Jean Dupont',
        adresse: uneAdresseValide(),
        regimeFiscal: 'micro_bic',
        revenusActifsAnnuelsCourant: Money.fromEuros(30_000),
      });
      const dt = Temporal.PlainDateTime.from('2026-05-20T14:30:00');
      const modifie = original.modifier({ fiscalitePremierAcces: dt });
      expect(modifie.fiscalitePremierAcces!.toString()).toBe('2026-05-20T14:30:00');
      expect(modifie.regimeFiscal).toBe('micro_bic');
      expect(modifie.revenusActifsAnnuelsCourant!.toCentimes()).toBe(3_000_000n);
    });

    it('modifier() sans champs fiscaux → les 3 champs sont préservés tels quels', () => {
      const dt = Temporal.PlainDateTime.from('2026-05-20T14:30:00');
      const original = Bailleur.creer({
        nomComplet: 'Jean Dupont',
        adresse: uneAdresseValide(),
        regimeFiscal: 'reel',
        revenusActifsAnnuelsCourant: Money.fromEuros(55_000),
        fiscalitePremierAcces: dt,
      });
      const modifie = original.modifier({ nomComplet: 'Jean-Pierre Dupont' });
      expect(modifie.nomComplet).toBe('Jean-Pierre Dupont');
      expect(modifie.regimeFiscal).toBe('reel');
      expect(modifie.revenusActifsAnnuelsCourant!.toCentimes()).toBe(5_500_000n);
      expect(modifie.fiscalitePremierAcces!.toString()).toBe('2026-05-20T14:30:00');
    });
  });
});
