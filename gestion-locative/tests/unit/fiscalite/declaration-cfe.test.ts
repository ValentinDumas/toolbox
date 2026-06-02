/**
 * Tests unitaires — Agrégat racine `DeclarationCfe` (Phase 6 / FIS-06 / D-CFE6.2 + D-CFE6.3 + D-CFE6.4).
 *
 * Couverture obligatoire :
 *   - Factory `creer` génère un id automatique + brand `DeclarationCfeId` UUID v4.
 *   - Invariants D-CFE6.3 :
 *       * millesime in [2020, 2030]
 *       * statut === 'deposee' implique dateDepotDeclaration non null
 *       * statut === 'payee' implique dateDepotDeclaration + montantAvisCentimes non null
 *       * statut === 'exoneree_premiere_annee' autorisé sans dépôt ni montant (D-CFE6.4)
 *   - Copy-on-write `modifier` :
 *       * patch partiel préserve les champs non patchés
 *       * pattern `'field' in patch` permet d'effacer un champ vers null (anti-écrasement silencieux)
 *       * patch vide retourne instance équivalente
 *
 * Pattern miroir : src/domain/travaux/ticket-travaux.ts (Pattern critique 3 06-PATTERNS.md).
 */

import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import { DeclarationCfe } from '../../../src/domain/fiscalite/cfe/declaration-cfe.js';
import {
  STATUTS_CFE_VALIDES,
  type StatutCfe,
} from '../../../src/domain/fiscalite/cfe/statut-cfe.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import {
  nouveauDeclarationCfeId,
  type BienId,
  type DeclarationCfeId,
} from '../../../src/domain/_shared/identifiants.js';
import { Money } from '../../../src/domain/_shared/money.js';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BIEN_ID_TEST = '11111111-1111-4111-8111-111111111111' as BienId;
const ECHEANCE_2026 = Temporal.PlainDate.from('2026-12-15');

function propsNonDeposee2026(over: Partial<Parameters<typeof DeclarationCfe.creer>[0]> = {}) {
  return {
    bienId: BIEN_ID_TEST,
    millesime: 2026,
    statut: 'non_deposee' as StatutCfe,
    dateDepotDeclaration: null,
    montantAvisCentimes: null,
    dateEcheancePaiement: ECHEANCE_2026,
    ...over,
  };
}

describe('nouveauDeclarationCfeId — brand + UUID v4 (D-CFE6.2)', () => {
  it('retourne une string conforme au format UUID v4', () => {
    const id = nouveauDeclarationCfeId();
    expect(typeof id).toBe('string');
    expect(id).toMatch(UUID_V4_REGEX);
  });

  it('génère des identifiants distincts à chaque appel', () => {
    const a = nouveauDeclarationCfeId();
    const b = nouveauDeclarationCfeId();
    expect(a).not.toBe(b);
  });
});

describe('StatutCfe — 5 valeurs strict (D-CFE6.3)', () => {
  it('STATUTS_CFE_VALIDES expose exactement les 5 valeurs métier', () => {
    expect([...STATUTS_CFE_VALIDES]).toEqual([
      'non_deposee',
      'deposee',
      'exoneree_premiere_annee',
      'exoneree_commune',
      'payee',
    ]);
  });
});

describe('DeclarationCfe.creer — factory + invariants (D-CFE6.3)', () => {
  it('crée une déclaration "non_deposee" avec id auto-généré quand id absent', () => {
    const decl = DeclarationCfe.creer(propsNonDeposee2026());
    expect(decl.id).toMatch(UUID_V4_REGEX);
    expect(decl.bienId).toBe(BIEN_ID_TEST);
    expect(decl.millesime).toBe(2026);
    expect(decl.statut).toBe('non_deposee');
    expect(decl.dateDepotDeclaration).toBeNull();
    expect(decl.montantAvisCentimes).toBeNull();
    expect(decl.dateEcheancePaiement.toString()).toBe('2026-12-15');
  });

  it('respecte un id explicite (round-trip repository)', () => {
    const explicitId = nouveauDeclarationCfeId();
    const decl = DeclarationCfe.creer(propsNonDeposee2026({ id: explicitId }));
    expect(decl.id).toBe(explicitId);
  });

  it('rejette un statut hors enum avec InvariantViolated', () => {
    expect(() =>
      DeclarationCfe.creer(
        propsNonDeposee2026({ statut: 'invalide' as unknown as StatutCfe }),
      ),
    ).toThrow(InvariantViolated);
  });

  it('rejette millesime < 2020 avec InvariantViolated citant la plage', () => {
    expect(() =>
      DeclarationCfe.creer(propsNonDeposee2026({ millesime: 2019 })),
    ).toThrow(/2020.*2030/);
  });

  it('rejette millesime > 2030 avec InvariantViolated citant la plage', () => {
    expect(() =>
      DeclarationCfe.creer(propsNonDeposee2026({ millesime: 2031 })),
    ).toThrow(/2020.*2030/);
  });

  it("rejette statut='deposee' sans dateDepotDeclaration (D-CFE6.3)", () => {
    expect(() =>
      DeclarationCfe.creer(
        propsNonDeposee2026({
          statut: 'deposee',
          dateDepotDeclaration: null,
        }),
      ),
    ).toThrow(/dateDepotDeclaration/);
  });

  it("accepte statut='deposee' avec dateDepotDeclaration valorisée", () => {
    const decl = DeclarationCfe.creer(
      propsNonDeposee2026({
        statut: 'deposee',
        dateDepotDeclaration: Temporal.PlainDate.from('2026-12-10'),
      }),
    );
    expect(decl.statut).toBe('deposee');
    expect(decl.dateDepotDeclaration?.toString()).toBe('2026-12-10');
  });

  it("rejette statut='payee' sans dateDepotDeclaration (D-CFE6.3)", () => {
    expect(() =>
      DeclarationCfe.creer(
        propsNonDeposee2026({
          statut: 'payee',
          dateDepotDeclaration: null,
          montantAvisCentimes: Money.fromEuros(320),
        }),
      ),
    ).toThrow(/dateDepotDeclaration/);
  });

  it("rejette statut='payee' sans montantAvisCentimes (D-CFE6.3)", () => {
    expect(() =>
      DeclarationCfe.creer(
        propsNonDeposee2026({
          statut: 'payee',
          dateDepotDeclaration: Temporal.PlainDate.from('2026-12-10'),
          montantAvisCentimes: null,
        }),
      ),
    ).toThrow(/montantAvisCentimes/);
  });

  it("accepte statut='payee' avec dateDepotDeclaration + montantAvisCentimes", () => {
    const decl = DeclarationCfe.creer(
      propsNonDeposee2026({
        statut: 'payee',
        dateDepotDeclaration: Temporal.PlainDate.from('2026-12-10'),
        montantAvisCentimes: Money.fromEuros(320),
      }),
    );
    expect(decl.statut).toBe('payee');
    expect(decl.montantAvisCentimes?.enEuros()).toBe(320);
  });

  it("accepte statut='exoneree_premiere_annee' SANS dépôt ni montant (D-CFE6.4)", () => {
    const decl = DeclarationCfe.creer(
      propsNonDeposee2026({
        statut: 'exoneree_premiere_annee',
        dateDepotDeclaration: null,
        montantAvisCentimes: null,
      }),
    );
    expect(decl.statut).toBe('exoneree_premiere_annee');
    expect(decl.dateDepotDeclaration).toBeNull();
    expect(decl.montantAvisCentimes).toBeNull();
  });

  it("accepte statut='exoneree_commune' SANS dépôt ni montant", () => {
    const decl = DeclarationCfe.creer(
      propsNonDeposee2026({
        statut: 'exoneree_commune',
        dateDepotDeclaration: null,
        montantAvisCentimes: null,
      }),
    );
    expect(decl.statut).toBe('exoneree_commune');
  });
});

describe('DeclarationCfe.modifier — copy-on-write + pattern "field in patch" (D-CFE6.3)', () => {
  it('retourne une nouvelle instance avec champs patchés (immutabilité)', () => {
    const decl = DeclarationCfe.creer(propsNonDeposee2026());
    const patched = decl.modifier({
      statut: 'deposee',
      dateDepotDeclaration: Temporal.PlainDate.from('2026-12-10'),
    });
    expect(patched).not.toBe(decl);
    expect(decl.statut).toBe('non_deposee');
    expect(patched.statut).toBe('deposee');
    expect(patched.dateDepotDeclaration?.toString()).toBe('2026-12-10');
    expect(patched.id).toBe(decl.id);
    expect(patched.bienId).toBe(decl.bienId);
    expect(patched.millesime).toBe(decl.millesime);
  });

  it('préserve les champs non patchés', () => {
    const base = DeclarationCfe.creer(
      propsNonDeposee2026({
        statut: 'payee',
        dateDepotDeclaration: Temporal.PlainDate.from('2026-12-10'),
        montantAvisCentimes: Money.fromEuros(320),
      }),
    );
    const patched = base.modifier({
      dateEcheancePaiement: Temporal.PlainDate.from('2026-12-20'),
    });
    expect(patched.statut).toBe('payee');
    expect(patched.dateDepotDeclaration?.toString()).toBe('2026-12-10');
    expect(patched.montantAvisCentimes?.enEuros()).toBe(320);
    expect(patched.dateEcheancePaiement.toString()).toBe('2026-12-20');
  });

  it("efface explicitement montantAvisCentimes via 'field' in patch", () => {
    const base = DeclarationCfe.creer(
      propsNonDeposee2026({
        statut: 'payee',
        dateDepotDeclaration: Temporal.PlainDate.from('2026-12-10'),
        montantAvisCentimes: Money.fromEuros(320),
      }),
    );
    // Pour effacer, le statut doit redevenir compatible (sinon invariant).
    const patched = base.modifier({
      statut: 'deposee',
      montantAvisCentimes: null,
    });
    expect(patched.montantAvisCentimes).toBeNull();
    expect(patched.statut).toBe('deposee');
  });

  it("efface explicitement dateDepotDeclaration via 'field' in patch (statut compatible)", () => {
    const base = DeclarationCfe.creer(
      propsNonDeposee2026({
        statut: 'deposee',
        dateDepotDeclaration: Temporal.PlainDate.from('2026-12-10'),
      }),
    );
    const patched = base.modifier({
      statut: 'non_deposee',
      dateDepotDeclaration: null,
    });
    expect(patched.dateDepotDeclaration).toBeNull();
    expect(patched.statut).toBe('non_deposee');
  });

  it('patch vide retourne une instance équivalente (tous champs préservés)', () => {
    const base = DeclarationCfe.creer(
      propsNonDeposee2026({
        statut: 'payee',
        dateDepotDeclaration: Temporal.PlainDate.from('2026-12-10'),
        montantAvisCentimes: Money.fromEuros(320),
      }),
    );
    const patched = base.modifier({});
    expect(patched.id).toBe(base.id);
    expect(patched.statut).toBe('payee');
    expect(patched.dateDepotDeclaration?.toString()).toBe('2026-12-10');
    expect(patched.montantAvisCentimes?.enEuros()).toBe(320);
    expect(patched.dateEcheancePaiement.toString()).toBe(base.dateEcheancePaiement.toString());
  });

  it('relaie InvariantViolated si le patch viole un invariant', () => {
    const base = DeclarationCfe.creer(propsNonDeposee2026());
    expect(() =>
      base.modifier({
        statut: 'payee',
        // pas de dateDepotDeclaration ni montantAvisCentimes => invariant
      }),
    ).toThrow(InvariantViolated);
  });
});

describe("DeclarationCfe — type DeclarationCfeId est bien un brand", () => {
  it('compile uniquement si on caste vers DeclarationCfeId (preuve type-level via usage)', () => {
    const id: DeclarationCfeId = nouveauDeclarationCfeId();
    expect(id).toMatch(UUID_V4_REGEX);
  });
});
