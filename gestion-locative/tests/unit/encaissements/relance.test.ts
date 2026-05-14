import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import type { EcheanceLoyerId, RelanceId } from '../../../src/domain/_shared/identifiants.js';

// Tests RED — Relance domain factory
// NOTE: Ces modules n'existent pas encore — tests RED intentionnellement
import { Relance } from '../../../src/domain/encaissements/relance.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';

const echeanceId = crypto.randomUUID() as EcheanceLoyerId;
const envoyeeLe = Temporal.PlainDate.from('2026-05-15');
const contenuSnapshot = '{"version":"v1","variables":{},"contenuRendu":"test","mailtoUri":null}';

describe('Relance.creer', () => {
  it('T1 : crée une Relance niveau 1 email valide', () => {
    const relance = Relance.creer({
      echeanceId,
      niveau: 1,
      canal: 'email',
      envoyeeLe,
      contenuSnapshot,
    });
    expect(relance.echeanceId).toBe(echeanceId);
    expect(relance.niveau).toBe(1);
    expect(relance.canal).toBe('email');
    expect(relance.envoyeeLe).toEqual(envoyeeLe);
    expect(relance.contenuSnapshot).toBe(contenuSnapshot);
    expect(relance.annuleLe).toBeNull();
    expect(relance.id).toBeDefined();
  });

  it('T2 : niveau hors {1,2,3} → throw InvariantViolated', () => {
    expect(() =>
      Relance.creer({
        echeanceId,
        niveau: 0 as unknown as 1,
        canal: 'email',
        envoyeeLe,
        contenuSnapshot,
      }),
    ).toThrow(InvariantViolated);

    expect(() =>
      Relance.creer({
        echeanceId,
        niveau: 4 as unknown as 1,
        canal: 'email',
        envoyeeLe,
        contenuSnapshot,
      }),
    ).toThrow(InvariantViolated);
  });

  it('T3 : canal hors {"email","pdf"} → throw InvariantViolated', () => {
    expect(() =>
      Relance.creer({
        echeanceId,
        niveau: 1,
        canal: 'sms' as unknown as 'email',
        envoyeeLe,
        contenuSnapshot,
      }),
    ).toThrow(InvariantViolated);
  });

  it('T4 : Relance.annuler(date) retourne nouvelle Relance avec annuleLe set', () => {
    const relance = Relance.creer({
      echeanceId,
      niveau: 1,
      canal: 'email',
      envoyeeLe,
      contenuSnapshot,
    });
    const annuleLe = Temporal.PlainDate.from('2026-05-20');
    const annulee = relance.annuler(annuleLe);
    expect(annulee.annuleLe).toEqual(annuleLe);
    expect(annulee.id).toBe(relance.id); // copy-on-write même id
    expect(relance.annuleLe).toBeNull(); // original inchangé
  });

  it('accepte un id optionnel passé en override', () => {
    const id = crypto.randomUUID() as RelanceId;
    const relance = Relance.creer({
      id,
      echeanceId,
      niveau: 2,
      canal: 'pdf',
      envoyeeLe,
      contenuSnapshot,
    });
    expect(relance.id).toBe(id);
    expect(relance.niveau).toBe(2);
    expect(relance.canal).toBe('pdf');
  });
});
