/**
 * Tests unitaires — Fonction pure `reconcilier()` (Phase 6 / FIS-05 Plan 06-03 / D-T6.4).
 *
 * Couvre :
 *   - Cas heureux : maps vides → cohérent=true / nbPiecesModifiees=0.
 *   - Cas heureux : valeurs identiques par clé → cohérent=true.
 *   - Cas écart : une clé diffère → cohérent=false, nbPiecesModifiees=1, ecart = vivant - snapshot.
 *   - Cas absence : clé snapshot non présente côté vivant → fallback Money.zero().
 *   - Immutabilité : `reconcilier` ne mute pas les Maps en entrée.
 *   - Type Read-only (vérifié par compilation TS).
 *   - Propriété fast-check 1 : idempotence — reconcilier(m, m).cohérent = true.
 *   - Propriété fast-check 2 : symétrie ecart = vivant - snapshot.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { Money } from '../../../src/domain/_shared/money.js';
import {
  reconcilier,
  type ResultatReconciliation,
  type EcartReconciliationParCase,
} from '../../../src/domain/fiscalite/reconciliation.js';

describe('reconcilier — fonction pure D-T6.4 (Plan 06-03)', () => {
  it('maps vides → cohérent=true / nbPiecesModifiees=0 / ecartsParCase=[]', () => {
    const r = reconcilier(new Map(), new Map());
    expect(r.cohérent).toBe(true);
    expect(r.nbPiecesModifiees).toBe(0);
    expect(r.ecartsParCase).toEqual([]);
  });

  it("valeurs identiques par clé → cohérent=true", () => {
    const snapshot = new Map<string, Money>([['c1', Money.fromCentimes(100n)]]);
    const vivant = new Map<string, Money>([['c1', Money.fromCentimes(100n)]]);
    const r = reconcilier(snapshot, vivant);
    expect(r.cohérent).toBe(true);
    expect(r.nbPiecesModifiees).toBe(0);
  });

  it("une clé diffère → cohérent=false / nbPiecesModifiees=1 / ecart = vivant - snapshot", () => {
    const snapshot = new Map<string, Money>([['c1', Money.fromCentimes(100n)]]);
    const vivant = new Map<string, Money>([['c1', Money.fromCentimes(150n)]]);
    const r = reconcilier(snapshot, vivant);
    expect(r.cohérent).toBe(false);
    expect(r.nbPiecesModifiees).toBe(1);
    const e = r.ecartsParCase[0];
    expect(e).toBeDefined();
    expect(e!.caseId).toBe('c1');
    expect(e!.ecartCentimes).toBe(50n);
  });

  it('clé snapshot absente côté vivant → fallback Money.zero()', () => {
    const snapshot = new Map<string, Money>([['c1', Money.fromCentimes(80n)]]);
    const vivant = new Map<string, Money>();
    const r = reconcilier(snapshot, vivant);
    expect(r.cohérent).toBe(false);
    expect(r.ecartsParCase[0]!.valeurVivante.egale(Money.zero())).toBe(true);
    // ecart = 0 - 80 = -80 → on stocke en BigInt, ici on vérifie via |.|
    expect(r.ecartsParCase[0]!.ecartCentimes).toBe(-80n);
  });

  it('ne mute pas les Maps en entrée (D-T6.4 anti-side-effect)', () => {
    const snapshot = new Map<string, Money>([['c1', Money.fromCentimes(10n)]]);
    const vivant = new Map<string, Money>([['c1', Money.fromCentimes(20n)]]);
    const sizeSnap = snapshot.size;
    const sizeViv = vivant.size;
    reconcilier(snapshot, vivant);
    expect(snapshot.size).toBe(sizeSnap);
    expect(vivant.size).toBe(sizeViv);
    expect(snapshot.get('c1')!.centimes).toBe(10n);
    expect(vivant.get('c1')!.centimes).toBe(20n);
  });

  it('plusieurs cases avec écarts mixtes → nbPiecesModifiees = nombre d\'écarts', () => {
    const snap = new Map<string, Money>([
      ['c1', Money.fromCentimes(100n)],
      ['c2', Money.fromCentimes(200n)],
      ['c3', Money.fromCentimes(300n)],
    ]);
    const viv = new Map<string, Money>([
      ['c1', Money.fromCentimes(100n)], // identique
      ['c2', Money.fromCentimes(250n)], // écart +50
      ['c3', Money.fromCentimes(290n)], // écart -10
    ]);
    const r = reconcilier(snap, viv);
    expect(r.cohérent).toBe(false);
    expect(r.nbPiecesModifiees).toBe(2);
    const c2 = r.ecartsParCase.find((e) => e.caseId === 'c2');
    const c3 = r.ecartsParCase.find((e) => e.caseId === 'c3');
    expect(c2!.ecartCentimes).toBe(50n);
    expect(c3!.ecartCentimes).toBe(-10n);
  });

  it("propriété fast-check 1 : idempotence sur données identiques", () => {
    const arbCase = fc.tuple(
      fc.string({ minLength: 1, maxLength: 8 }),
      fc.bigInt({ min: 0n, max: 1_000_000_000n }),
    );
    fc.assert(
      fc.property(fc.array(arbCase, { maxLength: 10 }), (entries) => {
        const m = new Map<string, Money>(
          entries.map(([k, v]) => [k, Money.fromCentimes(v)]),
        );
        const r: ResultatReconciliation = reconcilier(m, m);
        return r.cohérent === true && r.nbPiecesModifiees === 0;
      }),
      { numRuns: 50 },
    );
  });

  it("propriété fast-check 2 : symétrie ecart = valeurVivante - valeurSnapshot", () => {
    const arbCase = fc.tuple(
      fc.string({ minLength: 1, maxLength: 4 }),
      fc.bigInt({ min: 0n, max: 1_000_000n }),
      fc.bigInt({ min: 0n, max: 1_000_000n }),
    );
    fc.assert(
      fc.property(fc.array(arbCase, { maxLength: 10 }), (entries) => {
        const snap = new Map<string, Money>();
        const viv = new Map<string, Money>();
        for (const [k, s, v] of entries) {
          snap.set(k, Money.fromCentimes(s));
          viv.set(k, Money.fromCentimes(v));
        }
        const r = reconcilier(snap, viv);
        return r.ecartsParCase.every((e: EcartReconciliationParCase) => {
          const attendu = e.valeurVivante.centimes - e.valeurSnapshot.centimes;
          return e.ecartCentimes === attendu;
        });
      }),
      { numRuns: 50 },
    );
  });
});
