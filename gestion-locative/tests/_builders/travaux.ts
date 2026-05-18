import { Temporal } from '@js-temporal/polyfill';

import type {
  BienId,
  TicketTravauxId,
} from '../../src/domain/_shared/identifiants.js';
import { Money } from '../../src/domain/_shared/money.js';
import type {
  StatutTicket,
  TicketTravauxProps,
} from '../../src/domain/travaux/ticket-travaux.js';

interface OverridesTicket {
  id?: TicketTravauxId;
  bienId?: BienId;
  titre?: string;
  description?: string;
  dateOuverture?: Temporal.PlainDate;
  dateCloture?: Temporal.PlainDate | null;
  statut?: StatutTicket;
  coutEstimeTtc?: Money | null;
  coutReelTtc?: Money | null;
  notes?: string | null;
  creeLe?: Temporal.PlainDate;
  annuleLe?: Temporal.PlainDate | null;
  raisonAnnulation?: string | null;
}

const DEFAUT_DATE_OUVERTURE = Temporal.PlainDate.from('2026-05-01');

/**
 * Builder TicketTravaux valide — defaults raisonnables.
 *
 * statut='ouvert', dateOuverture=2026-05-01, titre='Remplacement chauffe-eau',
 * description par défaut, coutEstime=1200€, coutReel=null.
 */
export function unTicketTravauxValide(
  overrides: OverridesTicket = {},
): TicketTravauxProps {
  return {
    id: overrides.id,
    bienId: overrides.bienId ?? (crypto.randomUUID() as BienId),
    titre: overrides.titre ?? 'Remplacement chauffe-eau',
    description:
      overrides.description ??
      'Fuite chauffe-eau salle de bain — remplacement nécessaire.',
    dateOuverture: overrides.dateOuverture ?? DEFAUT_DATE_OUVERTURE,
    dateCloture:
      overrides.dateCloture !== undefined ? overrides.dateCloture : null,
    statut: overrides.statut ?? 'ouvert',
    coutEstimeTtc:
      overrides.coutEstimeTtc !== undefined
        ? overrides.coutEstimeTtc
        : Money.fromEuros(1200),
    coutReelTtc:
      overrides.coutReelTtc !== undefined ? overrides.coutReelTtc : null,
    notes: overrides.notes !== undefined ? overrides.notes : null,
    creeLe: overrides.creeLe ?? DEFAUT_DATE_OUVERTURE,
    annuleLe: overrides.annuleLe !== undefined ? overrides.annuleLe : null,
    raisonAnnulation:
      overrides.raisonAnnulation !== undefined
        ? overrides.raisonAnnulation
        : null,
  };
}

/** Builder ticket statut='en_cours'. */
export function unTicketTravauxEnCours(
  overrides: OverridesTicket = {},
): TicketTravauxProps {
  return unTicketTravauxValide({ ...overrides, statut: 'en_cours' });
}

/** Builder ticket statut='clos' avec dateCloture + coutReelTtc. */
export function unTicketTravauxClos(
  overrides: OverridesTicket = {},
): TicketTravauxProps {
  return unTicketTravauxValide({
    ...overrides,
    statut: 'clos',
    dateCloture:
      overrides.dateCloture ?? Temporal.PlainDate.from('2026-06-01'),
    coutReelTtc:
      overrides.coutReelTtc !== undefined
        ? overrides.coutReelTtc
        : Money.fromEuros(1250),
  });
}

/** Builder ticket statut='annule' avec annuleLe + raisonAnnulation. */
export function unTicketTravauxAnnule(
  overrides: OverridesTicket = {},
): TicketTravauxProps {
  return unTicketTravauxValide({
    ...overrides,
    statut: 'annule',
    annuleLe: overrides.annuleLe ?? Temporal.PlainDate.from('2026-05-10'),
    raisonAnnulation: overrides.raisonAnnulation ?? 'Hors budget',
  });
}
