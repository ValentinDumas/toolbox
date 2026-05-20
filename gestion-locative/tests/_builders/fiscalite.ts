import { Temporal } from '@js-temporal/polyfill';
import { Justificatif } from '../../src/domain/documents/justificatif.js';
import { TicketTravaux } from '../../src/domain/travaux/ticket-travaux.js';
import { Money } from '../../src/domain/_shared/money.js';
import type { QualificationFiscale } from '../../src/domain/fiscalite/qualification-fiscale.js';
import type { BienId, CheminRelatif, JustificatifId } from '../../src/domain/_shared/identifiants.js';

const TODAY = Temporal.PlainDate.from('2026-05-20');
const DEFAULT_BIEN_ID = crypto.randomUUID() as BienId;

// ─── Justificatif Builders ────────────────────────────────────────────────────

interface OverridesJustificatif {
  type?: 'facture' | 'ticket_caisse' | 'bail_signe' | 'edl_signe' | 'diagnostic_pdf' | 'attestation' | 'piece_locataire' | 'releve_bancaire' | 'autre';
  bienId?: BienId;
  montantTtc?: Money | null;
  titre?: string;
  dateDocument?: Temporal.PlainDate;
  datePaiement?: Temporal.PlainDate | null;
  cheminFichier?: CheminRelatif;
  parentJustificatifId?: JustificatifId | null;
  qualificationFiscale?: QualificationFiscale | null;
  qualifieLe?: Temporal.PlainDate | null;
  creeLe?: Temporal.PlainDate;
}

/**
 * Builder Justificatif non qualifié (statut par défaut Phase 5).
 * Utilisé pour les tests de qualification (@fis-02, @fis-03).
 */
export function unJustificatifNonQualifie(overrides: OverridesJustificatif = {}): Justificatif {
  return Justificatif.creer({
    type: overrides.type ?? 'facture',
    dateDocument: overrides.dateDocument ?? Temporal.PlainDate.from('2026-01-15'),
    titre: overrides.titre ?? 'Facture entretien chaudière',
    montantTtc: overrides.montantTtc !== undefined ? overrides.montantTtc : Money.fromEuros(500),
    cheminFichier: overrides.cheminFichier ?? ('factures/2026/entretien-chaudiere.pdf' as CheminRelatif),
    nomFichierOriginal: 'entretien-chaudiere.pdf',
    mimeType: 'application/pdf',
    tailleOctets: 50_000,
    bienId: overrides.bienId ?? DEFAULT_BIEN_ID,
    locataireId: null,
    notes: null,
    creeLe: overrides.creeLe ?? TODAY,
    datePaiement: overrides.datePaiement !== undefined ? overrides.datePaiement : null,
    parentJustificatifId: overrides.parentJustificatifId ?? null,
    qualificationFiscale: overrides.qualificationFiscale ?? null,
    qualifieLe: overrides.qualifieLe ?? null,
  });
}

/**
 * Builder Justificatif déjà qualifié.
 * Pré-qualifié avec la qualification fournie + date qualifieLe = TODAY.
 */
export function unJustificatifQualifie(
  qualif: QualificationFiscale,
  overrides: OverridesJustificatif = {},
): Justificatif {
  const montantTtc = overrides.montantTtc !== undefined
    ? overrides.montantTtc
    : Money.fromEuros(500);

  return Justificatif.creer({
    type: overrides.type ?? 'facture',
    dateDocument: overrides.dateDocument ?? Temporal.PlainDate.from('2026-01-15'),
    titre: overrides.titre ?? `Justificatif qualifié ${qualif}`,
    montantTtc,
    cheminFichier: overrides.cheminFichier ?? ('factures/2026/qualifie.pdf' as CheminRelatif),
    nomFichierOriginal: 'qualifie.pdf',
    mimeType: 'application/pdf',
    tailleOctets: 50_000,
    bienId: overrides.bienId ?? DEFAULT_BIEN_ID,
    locataireId: null,
    notes: null,
    creeLe: overrides.creeLe ?? TODAY,
    datePaiement: overrides.datePaiement !== undefined ? overrides.datePaiement : null,
    qualificationFiscale: qualif,
    qualifieLe: overrides.qualifieLe ?? TODAY,
    parentJustificatifId: overrides.parentJustificatifId ?? null,
  });
}

// ─── TicketTravaux Builders ───────────────────────────────────────────────────

interface OverridesTicket {
  bienId?: BienId;
  titre?: string;
  description?: string;
  dateOuverture?: Temporal.PlainDate;
  coutEstimeTtc?: Money | null;
  natureFiscale?: QualificationFiscale | null;
}

/**
 * Builder TicketTravaux de type amélioration.
 * Déjà ouvert avec nature='amelioration'.
 */
export function unTicketAmelioration(overrides: OverridesTicket = {}): TicketTravaux {
  return TicketTravaux.creer(
    {
      bienId: overrides.bienId ?? DEFAULT_BIEN_ID,
      titre: overrides.titre ?? 'Travaux réfection salle de bain',
      description: overrides.description ?? 'Réfection complète salle de bain (carrelage, sanitaires)',
      dateOuverture: overrides.dateOuverture ?? Temporal.PlainDate.from('2026-03-01'),
      dateCloture: null,
      statut: 'ouvert',
      coutEstimeTtc: overrides.coutEstimeTtc !== undefined ? overrides.coutEstimeTtc : Money.fromEuros(8_000),
      coutReelTtc: null,
      notes: null,
      creeLe: TODAY,
      annuleLe: null,
      raisonAnnulation: null,
      nature: 'amelioration',
      natureFiscale: overrides.natureFiscale ?? null,
    },
    TODAY,
  );
}

/**
 * Builder TicketTravaux d'acquisition mobilier.
 * natureFiscale forcé à 'amelioration' (D-FIS-G1.2).
 */
export function unTicketAcquisitionMobilier(overrides: OverridesTicket = {}): TicketTravaux {
  return TicketTravaux.creer(
    {
      bienId: overrides.bienId ?? DEFAULT_BIEN_ID,
      titre: overrides.titre ?? 'Achat mobilier appartement',
      description: overrides.description ?? 'Lit + matelas + armoire + table basse',
      dateOuverture: overrides.dateOuverture ?? Temporal.PlainDate.from('2026-04-01'),
      dateCloture: null,
      statut: 'ouvert',
      coutEstimeTtc: overrides.coutEstimeTtc !== undefined ? overrides.coutEstimeTtc : Money.fromEuros(3_500),
      coutReelTtc: null,
      notes: null,
      creeLe: TODAY,
      annuleLe: null,
      raisonAnnulation: null,
      nature: 'acquisition_mobilier',
      // natureFiscale sera forcé à 'amelioration' par le domaine (D-FIS-G1.2)
    },
    TODAY,
  );
}
