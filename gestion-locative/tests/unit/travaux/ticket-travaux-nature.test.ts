import { Temporal } from '@js-temporal/polyfill';
import { describe, it, expect } from 'vitest';
import { TicketTravaux } from '../../../src/domain/travaux/ticket-travaux.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import type { BienId } from '../../../src/domain/_shared/identifiants.js';

/**
 * Tests TDD — extension TicketTravaux pour la qualification fiscale (D-FIS-G1.2, D-FIS-G2.3).
 *
 * Sources juridiques :
 *   - D-FIS-G1.2 : nature='acquisition_mobilier' force natureFiscale='amelioration'
 *   - D-FIS-G2.3 : qualifier(natureFiscale, today) — copy-on-write
 */

const TODAY = Temporal.PlainDate.from('2026-05-20');
const BIEN_ID = crypto.randomUUID() as BienId;

function unTicketOuvert(): TicketTravaux {
  return TicketTravaux.creer(
    {
      bienId: BIEN_ID,
      titre: 'Travaux peinture',
      description: 'Réfection peinture salon',
      dateOuverture: Temporal.PlainDate.from('2026-04-01'),
      dateCloture: null,
      statut: 'ouvert',
      coutEstimeTtc: null,
      coutReelTtc: null,
      notes: null,
      creeLe: TODAY,
      annuleLe: null,
      raisonAnnulation: null,
    },
    TODAY,
  );
}

describe('TicketTravaux.qualifier', () => {
  it('qualifier amelioration → natureFiscale=amelioration (copy-on-write)', () => {
    const ticket = unTicketOuvert();
    const qualifie = ticket.qualifier('amelioration', TODAY, TODAY);
    expect(qualifie.natureFiscale).toBe('amelioration');
    expect(qualifie.qualifieLeTicket?.toString()).toBe('2026-05-20');
    // original inchangé (copy-on-write)
    expect(ticket.natureFiscale).toBeNull();
  });

  it('qualifier entretien_reparation → natureFiscale=entretien_reparation', () => {
    const ticket = unTicketOuvert();
    const qualifie = ticket.qualifier('entretien_reparation', TODAY, TODAY);
    expect(qualifie.natureFiscale).toBe('entretien_reparation');
  });

  it('qualifier ticket annulé lève InvariantViolated (D-FIS-G2.3)', () => {
    const ticket = unTicketOuvert().annuler('raison test', TODAY, TODAY);
    expect(() => ticket.qualifier('entretien_reparation', TODAY, TODAY)).toThrow(InvariantViolated);
  });

  it('nature="acquisition_mobilier" → natureFiscale forcée à "amelioration" (D-FIS-G1.2)', () => {
    const ticket = TicketTravaux.creer(
      {
        bienId: BIEN_ID,
        titre: 'Achat mobilier salon',
        description: 'Lit + matelas + armoire',
        dateOuverture: Temporal.PlainDate.from('2026-04-01'),
        dateCloture: null,
        statut: 'ouvert',
        coutEstimeTtc: null,
        coutReelTtc: null,
        notes: null,
        creeLe: TODAY,
        annuleLe: null,
        raisonAnnulation: null,
        nature: 'acquisition_mobilier',
      },
      TODAY,
    );
    expect(ticket.nature).toBe('acquisition_mobilier');
    expect(ticket.natureFiscale).toBe('amelioration'); // forcé automatiquement
  });
});
