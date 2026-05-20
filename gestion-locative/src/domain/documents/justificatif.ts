import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../_shared/erreurs.js';
import {
  nouveauJustificatifId,
  type BienId,
  type CheminRelatif,
  type JustificatifId,
  type LocataireId,
} from '../_shared/identifiants.js';
import { Money } from '../_shared/money.js';
import { ComposantsSommeIncoherente } from '../fiscalite/erreurs.js';
import {
  QUALIFICATIONS_VALIDES,
  type QualificationFiscale,
} from '../fiscalite/qualification-fiscale.js';

import {
  DocumentDejaEnCorbeille,
  DocumentNonEnCorbeille,
} from './erreurs.js';

/**
 * Agrégat racine Justificatif (D-102).
 *
 * Invariants :
 *   - bienId OR locataireId non-null (D-103 — défense en profondeur niveau domaine)
 *   - mimeType ∈ {application/pdf, image/jpeg, image/png, image/webp}
 *     (image/heic interdit en domaine — converti côté infra D-105)
 *   - tailleOctets > 0 && ≤ 52 428 800 (50 MiB — D-105)
 *   - [Phase 5] qualification ∈ {entretien_reparation, amelioration, charge_courante_periodique} ⇒ montantTtc non null (D-FIS-G2.4)
 *
 * Soft-delete : `mettreEnCorbeille` / `restaurer` retournent de nouvelles instances
 * (copy-on-write — Pattern 3). Le fichier physique est conservé.
 * Rétention : `peutEtrePurge(today)` retourne true seulement après creeLe + 10 ans (D-109).
 *
 * Phase 5 extensions :
 *   - `qualificationFiscale` (D-FIS-G2.1) : statut 'non_qualifie' par défaut
 *   - `datePaiement` (D-FIS-G2.11) : priorité sur dateDocument pour anneeFiscale()
 *   - `parentJustificatifId` (D-FIS-G2.6) : FK self pour les enfants d'un split
 *   - `qualifier()` : copy-on-write avec invariant TTC (D-FIS-G2.4)
 *   - `decomposerEnEnfants()` : split multi-biens avec invariant Σ (D-FIS-G2.6)
 */

export type TypeJustificatif =
  | 'facture'
  | 'ticket_caisse'
  | 'bail_signe'
  | 'edl_signe'
  | 'diagnostic_pdf'
  | 'attestation'
  | 'piece_locataire'
  | 'releve_bancaire'
  | 'autre';

export type MimeJustificatif =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

export const TYPES_JUSTIFICATIF: readonly TypeJustificatif[] = [
  'facture',
  'ticket_caisse',
  'bail_signe',
  'edl_signe',
  'diagnostic_pdf',
  'attestation',
  'piece_locataire',
  'releve_bancaire',
  'autre',
] as const;

export const MIMES_JUSTIFICATIF: readonly MimeJustificatif[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const LABELS_TYPE_JUSTIFICATIF: Record<TypeJustificatif, string> = {
  facture: 'Facture',
  ticket_caisse: 'Ticket de caisse',
  bail_signe: 'Bail signé',
  edl_signe: 'État des lieux signé',
  diagnostic_pdf: 'Diagnostic (PDF)',
  attestation: 'Attestation',
  piece_locataire: 'Pièce locataire',
  releve_bancaire: 'Relevé bancaire',
  autre: 'Autre',
};

const TAILLE_MAX_OCTETS = 52_428_800;
const RETENTION_ANNEES = 10;

const RATTACHEMENT_MESSAGE =
  'Le document doit être rattaché à un bien ou à un locataire.';

/** Qualifications qui exigent montantTtc non null (D-FIS-G2.4). */
const QUALIFICATIONS_AVEC_TTC_OBLIGATOIRE: readonly QualificationFiscale[] = [
  'entretien_reparation',
  'amelioration',
  'charge_courante_periodique',
];

export interface JustificatifProps {
  id?: JustificatifId;
  type: TypeJustificatif;
  dateDocument: Temporal.PlainDate;
  titre: string;
  montantTtc: Money | null;
  cheminFichier: CheminRelatif;
  nomFichierOriginal: string;
  mimeType: MimeJustificatif;
  tailleOctets: number;
  bienId: BienId | null;
  locataireId: LocataireId | null;
  notes: string | null;
  creeLe: Temporal.PlainDate;
  corbeilleLe?: Temporal.PlainDate | null;
  raisonCorbeille?: string | null;
  // Phase 5 — qualification fiscale (migration 0014)
  qualificationFiscale?: QualificationFiscale | null;
  qualifieLe?: Temporal.PlainDate | null;
  datePaiement?: Temporal.PlainDate | null;
  parentJustificatifId?: JustificatifId | null;
}

export class Justificatif {
  readonly id: JustificatifId;
  readonly type: TypeJustificatif;
  readonly dateDocument: Temporal.PlainDate;
  readonly titre: string;
  readonly montantTtc: Money | null;
  readonly cheminFichier: CheminRelatif;
  readonly nomFichierOriginal: string;
  readonly mimeType: MimeJustificatif;
  readonly tailleOctets: number;
  readonly bienId: BienId | null;
  readonly locataireId: LocataireId | null;
  readonly notes: string | null;
  readonly creeLe: Temporal.PlainDate;
  readonly corbeilleLe: Temporal.PlainDate | null;
  readonly raisonCorbeille: string | null;
  // Phase 5 — qualification fiscale
  readonly qualificationFiscale: QualificationFiscale | null;
  readonly qualifieLe: Temporal.PlainDate | null;
  readonly datePaiement: Temporal.PlainDate | null;
  readonly parentJustificatifId: JustificatifId | null;

  private constructor(id: JustificatifId, props: Omit<JustificatifProps, 'id'>) {
    this.id = id;
    this.type = props.type;
    this.dateDocument = props.dateDocument;
    this.titre = props.titre;
    this.montantTtc = props.montantTtc;
    this.cheminFichier = props.cheminFichier;
    this.nomFichierOriginal = props.nomFichierOriginal;
    this.mimeType = props.mimeType;
    this.tailleOctets = props.tailleOctets;
    this.bienId = props.bienId;
    this.locataireId = props.locataireId;
    this.notes = props.notes;
    this.creeLe = props.creeLe;
    this.corbeilleLe = props.corbeilleLe ?? null;
    this.raisonCorbeille = props.raisonCorbeille ?? null;
    this.qualificationFiscale = props.qualificationFiscale ?? null;
    this.qualifieLe = props.qualifieLe ?? null;
    this.datePaiement = props.datePaiement ?? null;
    this.parentJustificatifId = props.parentJustificatifId ?? null;
  }

  static creer(props: JustificatifProps): Justificatif {
    if (props.bienId === null && props.locataireId === null) {
      throw new InvariantViolated(RATTACHEMENT_MESSAGE);
    }

    if (!MIMES_JUSTIFICATIF.includes(props.mimeType)) {
      throw new InvariantViolated(
        `Mime type invalide pour un justificatif persisté : ${props.mimeType}. ` +
          `Les images HEIC doivent être converties en JPEG avant persistance (D-105).`,
      );
    }

    if (props.tailleOctets <= 0) {
      throw new InvariantViolated(
        `La taille du fichier doit être strictement positive (reçu ${props.tailleOctets}).`,
      );
    }
    if (props.tailleOctets > TAILLE_MAX_OCTETS) {
      throw new InvariantViolated(
        'Fichier trop volumineux. La taille maximale est 50 Mo.',
      );
    }

    if (props.titre.trim().length === 0) {
      throw new InvariantViolated('Le titre du justificatif est obligatoire.');
    }

    // D-FIS-G2.4 : TTC obligatoire pour les qualifications déductibles
    const qualif = props.qualificationFiscale ?? null;
    if (
      qualif !== null &&
      (QUALIFICATIONS_AVEC_TTC_OBLIGATOIRE as readonly string[]).includes(qualif) &&
      props.montantTtc === null
    ) {
      throw new InvariantViolated(
        `montantTtc obligatoire si qualification ∈ {entretien_reparation, amelioration, charge_courante_periodique} — D-FIS-G2.4`,
      );
    }

    const id = props.id ?? nouveauJustificatifId();
    return new Justificatif(id, {
      type: props.type,
      dateDocument: props.dateDocument,
      titre: props.titre.trim(),
      montantTtc: props.montantTtc,
      cheminFichier: props.cheminFichier,
      nomFichierOriginal: props.nomFichierOriginal,
      mimeType: props.mimeType,
      tailleOctets: props.tailleOctets,
      bienId: props.bienId,
      locataireId: props.locataireId,
      notes: props.notes,
      creeLe: props.creeLe,
      corbeilleLe: props.corbeilleLe ?? null,
      raisonCorbeille: props.raisonCorbeille ?? null,
      qualificationFiscale: qualif,
      qualifieLe: props.qualifieLe ?? null,
      datePaiement: props.datePaiement ?? null,
      parentJustificatifId: props.parentJustificatifId ?? null,
    });
  }

  /**
   * Copy-on-write — retourne un nouveau Justificatif en corbeille.
   * Throw DocumentDejaEnCorbeille si déjà en corbeille.
   */
  mettreEnCorbeille(raison: string, today: Temporal.PlainDate): Justificatif {
    if (this.corbeilleLe !== null) {
      throw new DocumentDejaEnCorbeille();
    }
    return Justificatif.creer({
      ...this.toProps(),
      corbeilleLe: today,
      raisonCorbeille: raison,
    });
  }

  /**
   * Copy-on-write — retourne un nouveau Justificatif restauré.
   * Throw DocumentNonEnCorbeille si pas en corbeille.
   */
  restaurer(): Justificatif {
    if (this.corbeilleLe === null) {
      throw new DocumentNonEnCorbeille();
    }
    return Justificatif.creer({
      ...this.toProps(),
      corbeilleLe: null,
      raisonCorbeille: null,
    });
  }

  /**
   * D-109 : un justificatif peut être purgé après creeLe + 10 ans.
   * Avant cette date, la purge est refusée (rétention obligatoire).
   */
  peutEtrePurge(today: Temporal.PlainDate): boolean {
    const datePurgePossible = this.creeLe.add({ years: RETENTION_ANNEES });
    return Temporal.PlainDate.compare(today, datePurgePossible) >= 0;
  }

  /**
   * D-FIS-G2.11 : année fiscale privilégie datePaiement (fallback dateDocument).
   *
   * Raffinage Phase 5 de la méthode Phase 4 (qui utilisait uniquement dateDocument).
   * Aligne sur la comptabilité d'encaissement BOFIP-BIC-DECLA-30-40-20.
   */
  anneeFiscale(): number {
    return this.datePaiement?.year ?? this.dateDocument.year;
  }

  /**
   * Copy-on-write — qualifie fiscalement ce justificatif (D-FIS-G2.1, D-FIS-G2.4).
   *
   * Invariant D-FIS-G2.4 : montantTtc obligatoire si qualification ∈
   * {entretien_reparation, amelioration, charge_courante_periodique}.
   *
   * @throws InvariantViolated si TTC null pour qualification déductible
   */
  qualifier(qualification: QualificationFiscale, qualifieLe: Temporal.PlainDate): Justificatif {
    if (!(QUALIFICATIONS_VALIDES as readonly string[]).includes(qualification)) {
      throw new InvariantViolated(
        `Qualification fiscale invalide : "${qualification}". Valeurs acceptées : ${QUALIFICATIONS_VALIDES.join(', ')}`,
      );
    }
    return Justificatif.creer({
      ...this.toProps(),
      qualificationFiscale: qualification,
      qualifieLe,
    });
  }

  /**
   * Retourne N enfants Justificatif pour le split multi-biens (D-FIS-G2.6).
   *
   * Invariant : Σ enfants.montantTtc === this.montantTtc.
   * Ne persiste rien — délègue à decomposer-justificatif use case.
   *
   * @throws InvariantViolated si parent.montantTtc null (impossible de vérifier Σ)
   * @throws ComposantsSommeIncoherente si Σ enfants ≠ parent.montantTtc
   */
  decomposerEnEnfants(
    enfants: Array<{ bienId: BienId; montantTtc: Money; titre: string }>,
  ): Justificatif[] {
    if (this.montantTtc === null) {
      throw new InvariantViolated(
        'Impossible de décomposer un justificatif sans montant TTC.',
      );
    }

    const sommeEnfants = enfants.reduce(
      (acc, e) => acc.additionner(e.montantTtc),
      Money.zero(),
    );

    if (!sommeEnfants.egale(this.montantTtc)) {
      throw new ComposantsSommeIncoherente(this.montantTtc, sommeEnfants);
    }

    return enfants.map((e) =>
      Justificatif.creer({
        type: this.type,
        dateDocument: this.dateDocument,
        titre: e.titre,
        montantTtc: e.montantTtc,
        cheminFichier: this.cheminFichier,
        nomFichierOriginal: this.nomFichierOriginal,
        mimeType: this.mimeType,
        tailleOctets: this.tailleOctets,
        bienId: e.bienId,
        locataireId: null,
        notes: this.notes,
        creeLe: this.creeLe,
        datePaiement: this.datePaiement,
        parentJustificatifId: this.id,
        qualificationFiscale: 'non_qualifie',
      }),
    );
  }

  toProps(): JustificatifProps {
    return {
      id: this.id,
      type: this.type,
      dateDocument: this.dateDocument,
      titre: this.titre,
      montantTtc: this.montantTtc,
      cheminFichier: this.cheminFichier,
      nomFichierOriginal: this.nomFichierOriginal,
      mimeType: this.mimeType,
      tailleOctets: this.tailleOctets,
      bienId: this.bienId,
      locataireId: this.locataireId,
      notes: this.notes,
      creeLe: this.creeLe,
      corbeilleLe: this.corbeilleLe,
      raisonCorbeille: this.raisonCorbeille,
      qualificationFiscale: this.qualificationFiscale,
      qualifieLe: this.qualifieLe,
      datePaiement: this.datePaiement,
      parentJustificatifId: this.parentJustificatifId,
    };
  }
}
