import { Temporal } from '@js-temporal/polyfill';
import { Justificatif } from '../../src/domain/documents/justificatif.js';
import { TicketTravaux } from '../../src/domain/travaux/ticket-travaux.js';
import { Money } from '../../src/domain/_shared/money.js';
import type { QualificationFiscale } from '../../src/domain/fiscalite/qualification-fiscale.js';
import type { BienId, CheminRelatif, JustificatifId, TicketTravauxId } from '../../src/domain/_shared/identifiants.js';
import { DeclarationCfe, type DeclarationCfeProps } from '../../src/domain/fiscalite/cfe/declaration-cfe.js';
import { Composant } from '../../src/domain/fiscalite/composant.js';
import type { OrigineKindComposant, MotifSortieComposant } from '../../src/domain/fiscalite/composant.js';
import { ValorisationFiscale } from '../../src/domain/fiscalite/valorisation-fiscale.js';
import {
  MAPPING_LIASSE_2026,
  type MappingLiasse2026,
} from '../../src/domain/fiscalite/liasse/mapping-liasse-2026.js';
import type {
  BrouillonLiasseDto,
  SectionLiasseDto,
} from '../../src/domain/fiscalite/liasse/case-liasse.js';
import type { DeclarationAnnuelle } from '../../src/domain/fiscalite/declaration-annuelle.js';

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

// ─── Composant Builders ───────────────────────────────────────────────────────

interface OverridesComposant {
  bienId?: BienId;
  montantHt?: Money;
  dateAcquisition?: Temporal.PlainDate;
  origineKind?: OrigineKindComposant;
  ticketId?: TicketTravauxId | null;
  dateSortie?: Temporal.PlainDate | null;
  motifSortie?: MotifSortieComposant | null;
}

/**
 * Builder Composant gros_oeuvre valide (initial, sans sortie).
 * Montant par défaut : 200 000 € — cas de référence CONTEXT.md L249.
 */
export function unComposantGrosOeuvre(overrides: OverridesComposant = {}): Composant {
  return Composant.creer({
    bienId: overrides.bienId ?? (crypto.randomUUID() as BienId),
    type: 'gros_oeuvre',
    montantHt: overrides.montantHt ?? Money.fromEuros(200_000),
    dateAcquisition: overrides.dateAcquisition ?? Temporal.PlainDate.from('2026-01-01'),
    origineKind: overrides.origineKind ?? 'initial',
    ticketId: overrides.ticketId !== undefined ? overrides.ticketId : null,
    dateSortie: overrides.dateSortie !== undefined ? overrides.dateSortie : null,
    motifSortie: overrides.motifSortie !== undefined ? overrides.motifSortie : null,
  });
}

/**
 * Builder Composant mobilier valide (initial, sans sortie).
 * Mobilier = durée 7 ans, dernier dans l'ordre stable de répartition.
 */
export function unComposantMobilier(overrides: OverridesComposant = {}): Composant {
  return Composant.creer({
    bienId: overrides.bienId ?? (crypto.randomUUID() as BienId),
    type: 'mobilier',
    montantHt: overrides.montantHt ?? Money.fromEuros(5_000),
    dateAcquisition: overrides.dateAcquisition ?? Temporal.PlainDate.from('2026-01-01'),
    origineKind: overrides.origineKind ?? 'initial',
    ticketId: overrides.ticketId !== undefined ? overrides.ticketId : null,
    dateSortie: overrides.dateSortie !== undefined ? overrides.dateSortie : null,
    motifSortie: overrides.motifSortie !== undefined ? overrides.motifSortie : null,
  });
}

// ─── ValorisationFiscale Builders ─────────────────────────────────────────────

interface OverridesValorisationFiscale {
  bienId?: BienId;
  prixAcquisition?: Money;
  dateAcquisition?: Temporal.PlainDate;
  fraisNotaire?: Money;
  fraisAgence?: Money;
  quotePartTerrainRatio?: number;
  activeLe?: Temporal.PlainDateTime;
}

/**
 * Builder ValorisationFiscale valide.
 * Valeurs par défaut : cas de référence PLAN 03 (prix 216k, frais notaire 16k, agence 8k).
 */
export function uneValorisationFiscale(overrides: OverridesValorisationFiscale = {}): ValorisationFiscale {
  return ValorisationFiscale.creer({
    bienId: overrides.bienId ?? (crypto.randomUUID() as BienId),
    prixAcquisition: overrides.prixAcquisition ?? Money.fromEuros(216_000),
    dateAcquisition: overrides.dateAcquisition ?? Temporal.PlainDate.from('2026-03-15'),
    fraisNotaire: overrides.fraisNotaire ?? Money.fromEuros(16_000),
    fraisAgence: overrides.fraisAgence ?? Money.fromEuros(8_000),
    quotePartTerrainRatio: overrides.quotePartTerrainRatio ?? 0.10,
    activeLe: overrides.activeLe ?? Temporal.PlainDateTime.from('2026-03-15T10:00:00'),
  });
}

// ─── Phase 6 — Liasse builders (FIS-05) ───────────────────────────────────────

interface OverridesMapping {
  millesime?: 2026;
  sections?: Partial<MappingLiasse2026['sections']>;
}

/**
 * Builder MappingLiasse2026 — retourne `MAPPING_LIASSE_2026` ou un mapping
 * partiellement override (utile pour tester des sections vides ou enrichies).
 *
 * Phase 6 / FIS-05 / D-L6.3. Pattern miroir `unBailleurValide`.
 */
export function unMappingLiasse2026(overrides: OverridesMapping = {}): MappingLiasse2026 {
  if (!overrides.sections) {
    return MAPPING_LIASSE_2026;
  }
  return {
    millesime: overrides.millesime ?? 2026,
    sections: {
      ...MAPPING_LIASSE_2026.sections,
      ...overrides.sections,
    },
  };
}

interface OverridesBrouillonLiasseDto {
  exercice?: number;
  bailleurNom?: string;
  sections?: ReadonlyArray<SectionLiasseDto>;
  clotureLe?: Temporal.PlainDate;
}

/**
 * Builder minimal `BrouillonLiasseDto` régime réel — utile aux tests Plan 02-05
 * qui n'instancient pas tout le pipeline `genererBrouillonLiasse`.
 *
 * Si `decl` est fourni, exercice/clotureLe par défaut sont dérivés du snapshot.
 */
export function unBrouillonLiasseDtoReel(
  decl?: DeclarationAnnuelle,
  overrides: OverridesBrouillonLiasseDto = {},
): BrouillonLiasseDto {
  return {
    exercice: overrides.exercice ?? decl?.exercice ?? 2026,
    regimeApplique: 'reel',
    bailleurNom: overrides.bailleurNom ?? 'Jean Dupont',
    sections: overrides.sections ?? [],
    clotureLe: overrides.clotureLe ?? decl?.clotureLe ?? Temporal.PlainDate.from('2026-12-31'),
  };
}

// ─── Phase 6 — CFE builders (FIS-06) ──────────────────────────────────────────

/**
 * Builder minimal `DeclarationCfe` (Phase 6 / FIS-06 / D-CFE6.3).
 *
 * Defaults sûrs : `non_deposee` + millésime 2026 + échéance 15/12/2026.
 * Pattern miroir `unTicketAmelioration` (cf. _builders/fiscalite.ts L111).
 */
export function uneDeclarationCfe(
  overrides: Partial<DeclarationCfeProps> = {},
): DeclarationCfe {
  return DeclarationCfe.creer({
    bienId: overrides.bienId ?? DEFAULT_BIEN_ID,
    millesime: overrides.millesime ?? 2026,
    statut: overrides.statut ?? 'non_deposee',
    dateDepotDeclaration:
      'dateDepotDeclaration' in overrides ? overrides.dateDepotDeclaration ?? null : null,
    montantAvisCentimes:
      'montantAvisCentimes' in overrides ? overrides.montantAvisCentimes ?? null : null,
    dateEcheancePaiement:
      overrides.dateEcheancePaiement ?? Temporal.PlainDate.from('2026-12-15'),
    id: overrides.id,
  });
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
