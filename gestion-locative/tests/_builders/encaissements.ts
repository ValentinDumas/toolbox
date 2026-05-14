import { Temporal } from '@js-temporal/polyfill';
import type { EcheanceLoyerId, BailId, EncaissementId, QuittanceId, RelanceId } from '../../src/domain/_shared/identifiants.js';
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

// ─── Quittance Builder ────────────────────────────────────────────────────────

export interface QuittanceProps {
  id?: QuittanceId;
  echeanceId: EcheanceLoyerId;
  numero: string;
  cheminFichierRelatif: string;
  emiseLe: Temporal.PlainDate;
  annuleeLe?: Temporal.PlainDate | null;
  raisonAnnulation?: string | null;
}

interface OverridesQuittance {
  id?: QuittanceId;
  echeanceId?: EcheanceLoyerId;
  numero?: string;
  cheminFichierRelatif?: string;
  emiseLe?: Temporal.PlainDate;
  annuleeLe?: Temporal.PlainDate | null;
  raisonAnnulation?: string | null;
}

/**
 * Builder Quittance valide — defaults cohérents.
 * numero '2026-001', chemin standard, emiseLe 2026-05-31.
 */
export function uneQuittanceValide(overrides: OverridesQuittance & { echeanceId: EcheanceLoyerId }): QuittanceProps {
  return {
    id: overrides.id,
    echeanceId: overrides.echeanceId,
    numero: overrides.numero ?? '2026-001',
    cheminFichierRelatif: overrides.cheminFichierRelatif ?? 'quittances/2026/quittance-2026-001-mai-2026-dupont.pdf',
    emiseLe: overrides.emiseLe ?? Temporal.PlainDate.from('2026-05-31'),
    annuleeLe: overrides.annuleeLe !== undefined ? overrides.annuleeLe : null,
    raisonAnnulation: overrides.raisonAnnulation !== undefined ? overrides.raisonAnnulation : null,
  };
}

// ─── Relance Builder ──────────────────────────────────────────────────────────

export type NiveauRelance = 1 | 2 | 3;
export type CanalRelance = 'email' | 'pdf';

export interface RelanceProps {
  id?: RelanceId;
  echeanceId: EcheanceLoyerId;
  niveau: NiveauRelance;
  canal: CanalRelance;
  envoyeeLe: Temporal.PlainDate;
  contenuSnapshot: string;
  annuleLe?: Temporal.PlainDate | null;
}

interface OverridesRelance {
  id?: RelanceId;
  echeanceId?: EcheanceLoyerId;
  niveau?: NiveauRelance;
  canal?: CanalRelance;
  envoyeeLe?: Temporal.PlainDate;
  contenuSnapshot?: string;
  annuleLe?: Temporal.PlainDate | null;
}

/**
 * Builder Relance valide — defaults cohérents.
 * niveau 1, canal 'email', envoyeeLe 2026-05-15.
 */
export function uneRelanceValide(overrides: OverridesRelance & { echeanceId: EcheanceLoyerId }): RelanceProps {
  return {
    id: overrides.id,
    echeanceId: overrides.echeanceId,
    niveau: overrides.niveau ?? 1,
    canal: overrides.canal ?? 'email',
    envoyeeLe: overrides.envoyeeLe ?? Temporal.PlainDate.from('2026-05-15'),
    contenuSnapshot: overrides.contenuSnapshot ?? '{"version":"v1","variables":{},"contenuRendu":"","mailtoUri":null}',
    annuleLe: overrides.annuleLe !== undefined ? overrides.annuleLe : null,
  };
}
