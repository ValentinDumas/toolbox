import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import type { EcheanceLoyerId, QuittanceId } from '../../../src/domain/_shared/identifiants.js';

// NOTE: Ces imports n'existent pas encore — tests RED intentionnellement
import { Quittance } from '../../../src/domain/encaissements/quittance.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import { QuittanceDejaAnnulee } from '../../../src/domain/encaissements/erreurs.js';

const echeanceId = crypto.randomUUID() as EcheanceLoyerId;
const emiseLe = Temporal.PlainDate.from('2026-05-31');

describe('Quittance.creer', () => {
  it('T4: crée une Quittance valide avec des props correctes', () => {
    const quittance = Quittance.creer({
      echeanceId,
      numero: '2026-001',
      cheminFichierRelatif: 'quittances/2026/quittance-2026-001-mai-2026-dupont.pdf',
      emiseLe,
    });
    expect(quittance.numero).toBe('2026-001');
    expect(quittance.echeanceId).toBe(echeanceId);
    expect(quittance.annuleeLe).toBeNull();
    expect(quittance.raisonAnnulation).toBeNull();
    expect(quittance.estActive()).toBe(true);
  });

  it('T5: rejette un numéro au format "26-1" (trop court)', () => {
    expect(() =>
      Quittance.creer({
        echeanceId,
        numero: '26-1',
        cheminFichierRelatif: 'quittances/2026/test.pdf',
        emiseLe,
      }),
    ).toThrow(InvariantViolated);
  });

  it('T5b: rejette un numéro alphabétique "abc"', () => {
    expect(() =>
      Quittance.creer({
        echeanceId,
        numero: 'abc',
        cheminFichierRelatif: 'quittances/2026/test.pdf',
        emiseLe,
      }),
    ).toThrow(InvariantViolated);
  });

  it('T5c: le message d\'erreur mentionne le numéro invalide', () => {
    expect(() =>
      Quittance.creer({
        echeanceId,
        numero: '26-1',
        cheminFichierRelatif: 'quittances/2026/test.pdf',
        emiseLe,
      }),
    ).toThrow('26-1');
  });

  it('accepte un id optionnel passé en override', () => {
    const id = crypto.randomUUID() as QuittanceId;
    const quittance = Quittance.creer({
      id,
      echeanceId,
      numero: '2026-001',
      cheminFichierRelatif: 'quittances/2026/quittance-2026-001-mai-2026-dupont.pdf',
      emiseLe,
    });
    expect(quittance.id).toBe(id);
  });
});

describe('Quittance.annuler', () => {
  it('T6: retourne une Quittance avec annuleeLe et raisonAnnulation set', () => {
    const quittance = Quittance.creer({
      echeanceId,
      numero: '2026-001',
      cheminFichierRelatif: 'quittances/2026/quittance-2026-001-mai-2026-dupont.pdf',
      emiseLe,
    });
    const annuleeLe = Temporal.PlainDate.from('2026-06-01');
    const annulee = quittance.annuler('Encaissement compensé', annuleeLe);
    expect(annulee.annuleeLe).toEqual(annuleeLe);
    expect(annulee.raisonAnnulation).toBe('Encaissement compensé');
    expect(annulee.estActive()).toBe(false);
    // Le PDF original est conservé (même chemin)
    expect(annulee.cheminFichierRelatif).toBe(quittance.cheminFichierRelatif);
  });

  it('T7: throw QuittanceDejaAnnulee si la quittance est déjà annulée', () => {
    const quittance = Quittance.creer({
      echeanceId,
      numero: '2026-001',
      cheminFichierRelatif: 'quittances/2026/quittance-2026-001-mai-2026-dupont.pdf',
      emiseLe,
      annuleeLe: Temporal.PlainDate.from('2026-06-01'),
      raisonAnnulation: 'Première annulation',
    });
    expect(() =>
      quittance.annuler('Deuxième annulation', Temporal.PlainDate.from('2026-06-02')),
    ).toThrow(QuittanceDejaAnnulee);
  });
});
