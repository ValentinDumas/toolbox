import { Temporal } from '@js-temporal/polyfill';
import type { EcheanceLoyerId, BailId, EncaissementId } from '../../src/domain/_shared/identifiants.js';
import { Money } from '../../src/domain/_shared/money.js';

// EcheanceLoyer ne peut pas encore être importé (code non créé) — builder retourne un objet pur
// pour les tests d'intégration. Les tests unit importeront EcheanceLoyer directement.

export interface EcheanceLoyerProps {
  id?: EcheanceLoyerId;
  bailId: BailId;
  periodeDebut: Temporal.PlainDate;
  periodeFin: Temporal.PlainDate;
  jourEcheanceAttendue: Temporal.PlainDate;
  loyerHc: Money;
  montantCharges: Money;
  modeCharges: 'forfait' | 'provisions';
  total: Money;
  statut: 'en_attente' | 'partiellement_payee' | 'payee' | 'annulee';
  annuleLe: Temporal.PlainDate | null;
}

interface OverridesEcheanceLoyer {
  id?: EcheanceLoyerId;
  bailId?: BailId;
  periodeDebut?: Temporal.PlainDate;
  periodeFin?: Temporal.PlainDate;
  jourEcheanceAttendue?: Temporal.PlainDate;
  loyerHc?: Money;
  montantCharges?: Money;
  modeCharges?: 'forfait' | 'provisions';
  total?: Money;
  statut?: 'en_attente' | 'partiellement_payee' | 'payee' | 'annulee';
  annuleLe?: Temporal.PlainDate | null;
}

/**
 * Builder EcheanceLoyer valide — defaults cohérents.
 * loyerHc 620€ + charges 80€ = total 700€.
 */
export function unEcheanceLoyerValide(overrides: OverridesEcheanceLoyer = {}): EcheanceLoyerProps {
  const loyerHc = overrides.loyerHc ?? Money.fromEuros(620);
  const montantCharges = overrides.montantCharges ?? Money.fromEuros(80);
  const total = overrides.total ?? loyerHc.additionner(montantCharges);

  return {
    id: overrides.id,
    bailId: overrides.bailId ?? (crypto.randomUUID() as BailId),
    periodeDebut: overrides.periodeDebut ?? Temporal.PlainDate.from('2026-05-01'),
    periodeFin: overrides.periodeFin ?? Temporal.PlainDate.from('2026-05-31'),
    jourEcheanceAttendue: overrides.jourEcheanceAttendue ?? Temporal.PlainDate.from('2026-05-05'),
    loyerHc,
    montantCharges,
    modeCharges: overrides.modeCharges ?? 'forfait',
    total,
    statut: overrides.statut ?? 'en_attente',
    annuleLe: overrides.annuleLe !== undefined ? overrides.annuleLe : null,
  };
}

export interface EncaissementProps {
  id?: EncaissementId;
  echeanceId: EcheanceLoyerId;
  montant: Money;
  date: Temporal.PlainDate;
  mode: 'virement' | 'cheque' | 'especes' | 'prelevement' | 'autre';
  annuleLe?: Temporal.PlainDate | null;
  raisonAnnulation?: string | null;
}

interface OverridesEncaissement {
  id?: EncaissementId;
  echeanceId?: EcheanceLoyerId;
  montant?: Money;
  date?: Temporal.PlainDate;
  mode?: 'virement' | 'cheque' | 'especes' | 'prelevement' | 'autre';
  annuleLe?: Temporal.PlainDate | null;
  raisonAnnulation?: string | null;
}

/**
 * Builder Encaissement valide — defaults cohérents.
 * montant 700€, mode virement, date 2026-05-05.
 * echeanceId requis (toujours fourni via overrides).
 */
export function unEncaissementValide(overrides: OverridesEncaissement & { echeanceId: EcheanceLoyerId }): EncaissementProps {
  return {
    id: overrides.id,
    echeanceId: overrides.echeanceId,
    montant: overrides.montant ?? Money.fromEuros(700),
    date: overrides.date ?? Temporal.PlainDate.from('2026-05-05'),
    mode: overrides.mode ?? 'virement',
    annuleLe: overrides.annuleLe !== undefined ? overrides.annuleLe : null,
    raisonAnnulation: overrides.raisonAnnulation !== undefined ? overrides.raisonAnnulation : null,
  };
}
