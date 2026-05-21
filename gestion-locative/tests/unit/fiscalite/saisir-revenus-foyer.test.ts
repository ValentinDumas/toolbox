/**
 * Tests TDD — saisir-revenus-foyer (RED phase).
 *
 * Cas : enregistrer les revenus actifs annuels du foyer + trace fiscalitePremierAcces.
 *
 * Sources :
 *   D-FIS-G3.1 — champ revenusActifsAnnuelsCourant sur Bailleur (pré-remplissage wizard).
 *   D-FIS-G5.4 — fiscalitePremierAcces (DateTime?) trace UNIQUEMENT le premier accès.
 *   BDD_PRACTICES.md — test par comportement observable.
 */

import { describe, it, expect, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Money } from '../../../src/domain/_shared/money.js';
import { Bailleur } from '../../../src/domain/identite/bailleur.js';
import { Adresse } from '../../../src/domain/_shared/adresse.js';
import { BailleurAbsent } from '../../../src/domain/identite/erreurs.js';
import { saisirRevenusFoyer } from '../../../src/application/fiscalite/saisir-revenus-foyer.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function unBailleurSansFiscalite(): Bailleur {
  return Bailleur.creer({
    nomComplet: 'Jean Dupont',
    adresse: Adresse.creer({ rue: '1 rue de la Paix', codePostal: '75001', ville: 'Paris' }),
    regimeFiscal: null,
    revenusActifsAnnuelsCourant: null,
    fiscalitePremierAcces: null,
  });
}

function unBailleurAvecFiscalitePremierAcces(): Bailleur {
  return Bailleur.creer({
    nomComplet: 'Jean Dupont',
    adresse: Adresse.creer({ rue: '1 rue de la Paix', codePostal: '75001', ville: 'Paris' }),
    regimeFiscal: null,
    revenusActifsAnnuelsCourant: null,
    fiscalitePremierAcces: Temporal.PlainDateTime.from('2025-01-15T10:30:00'),
  });
}

const CLOCK = ClockFixe.du('2026-12-31');

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('saisirRevenusFoyer — use case impure', () => {
  // ── Test 10 : premier accès → fiscalitePremierAcces set + revenusActifsAnnuelsCourant mis à jour ──
  it('Test 10 : bailleur sans fiscalitePremierAcces → set sur premier accès + revenusActifs mis à jour', async () => {
    const bailleur = unBailleurSansFiscalite();
    let bailleurEnregistre: Bailleur | null = null;

    const bailleurRepo = {
      trouver: async () => bailleur,
      enregistrer: async (b: Bailleur) => { bailleurEnregistre = b; },
      mettreAJour: async (_b: Bailleur) => { bailleurEnregistre = _b; },
    };

    await saisirRevenusFoyer(
      { revenusActifsAnnuelsCourantEuros: 48_000 },
      { bailleurRepo },
      CLOCK,
    );

    expect(bailleurEnregistre).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(bailleurEnregistre!.revenusActifsAnnuelsCourant?.toCentimes()).toBe(4_800_000n);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(bailleurEnregistre!.fiscalitePremierAcces).not.toBeNull();
  });

  // ── Test 11 : fiscalitePremierAcces déjà set → INCHANGÉ ─────────────────
  it('Test 11 : bailleur avec fiscalitePremierAcces déjà set → fiscalitePremierAcces INCHANGÉ (D-FIS-G5.4)', async () => {
    const dateInitiale = Temporal.PlainDateTime.from('2025-01-15T10:30:00');
    const bailleur = unBailleurAvecFiscalitePremierAcces();
    let bailleurEnregistre: Bailleur | null = null;

    const bailleurRepo = {
      trouver: async () => bailleur,
      enregistrer: async (b: Bailleur) => { bailleurEnregistre = b; },
      mettreAJour: async (_b: Bailleur) => { bailleurEnregistre = _b; },
    };

    await saisirRevenusFoyer(
      { revenusActifsAnnuelsCourantEuros: 55_000 },
      { bailleurRepo },
      CLOCK,
    );

    expect(bailleurEnregistre).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(bailleurEnregistre!.fiscalitePremierAcces?.toString()).toBe(
      dateInitiale.toString(),
    );
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(bailleurEnregistre!.revenusActifsAnnuelsCourant?.toCentimes()).toBe(5_500_000n);
  });

  // ── Test 12 : bailleur absent → throw BailleurAbsent ─────────────────────
  it('Test 12 : bailleurRepo.trouver() retourne null → throw BailleurAbsent', async () => {
    const bailleurRepo = {
      trouver: async () => null,
      enregistrer: vi.fn(),
      mettreAJour: vi.fn(),
    };

    await expect(
      saisirRevenusFoyer(
        { revenusActifsAnnuelsCourantEuros: 40_000 },
        { bailleurRepo },
        CLOCK,
      ),
    ).rejects.toThrow(BailleurAbsent);
  });
});
