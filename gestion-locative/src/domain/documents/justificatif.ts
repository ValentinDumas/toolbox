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
 *
 * Soft-delete : `mettreEnCorbeille` / `restaurer` retournent de nouvelles instances
 * (copy-on-write — Pattern 3). Le fichier physique est conservé.
 * Rétention : `peutEtrePurge(today)` retourne true seulement après creeLe + 10 ans (D-109).
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

  /** D-107 — année fiscale dérivée de dateDocument (PAS de cree_le). */
  anneeFiscale(): number {
    return this.dateDocument.year;
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
    };
  }
}
