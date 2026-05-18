import { Temporal } from '@js-temporal/polyfill';
import type { Kysely } from 'kysely';

import type { Clock } from '../../domain/_shared/clock.js';
import {
  nouveauJustificatifId,
  type BienId,
  type CheminRelatif,
  type JustificatifId,
  type LocataireId,
} from '../../domain/_shared/identifiants.js';
import { Money } from '../../domain/_shared/money.js';
import type { ConvertisseurImage } from '../../domain/documents/convertisseur-image.js';
import {
  FichierTropVolumineux,
  FormatNonAccepte,
  MimeMismatch,
} from '../../domain/documents/erreurs.js';
import {
  Justificatif,
  type MimeJustificatif,
  type TypeJustificatif,
} from '../../domain/documents/justificatif.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';
import type { StockageJustificatifs } from '../../domain/documents/stockage-justificatifs.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { DB } from '../../infrastructure/db/kysely-types.js';
import { StockageJustificatifsLocal } from '../../infrastructure/storage/stockage-justificatifs-local.js';

import {
  validerMagicBytes,
  type MimeDetecte,
} from './valider-magic-bytes.js';

export interface UploaderJustificatifCommande {
  titre: string;
  type: TypeJustificatif;
  dateDocument: Temporal.PlainDate;
  bienId?: BienId | string | null;
  locataireId?: LocataireId | string | null;
  notes?: string | null;
  montantTtc?: Money | null;
  fichier: {
    buffer: Buffer;
    nomOriginal: string;
    mimeAnnonce: string;
  };
}

export interface UploaderJustificatifDeps {
  justificatifRepo: JustificatifRepository;
  bienRepo: BienRepository;
  locataireRepo: LocataireRepository;
  stockage: StockageJustificatifs;
  convertisseurImage: ConvertisseurImage;
  clock: Clock;
  db: Kysely<DB>;
}

export interface UploaderJustificatifResultat {
  justificatifId: JustificatifId;
  cheminFichier: CheminRelatif;
}

const TAILLE_MAX_OCTETS = 52_428_800;

const EXT_PAR_MIME: Record<MimeJustificatif, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class BienAttacheIntrouvable extends Error {
  constructor() {
    super('Bien introuvable.');
    this.name = 'BienAttacheIntrouvable';
  }
}

export class LocataireAttacheIntrouvable extends Error {
  constructor() {
    super('Locataire introuvable.');
    this.name = 'LocataireAttacheIntrouvable';
  }
}

/**
 * Use case : uploader un justificatif (DOC-01).
 *
 * Flux :
 *   1. Vérifie référentiels (bien / locataire) hors trx
 *   2. Validation magic-bytes (D-118 — magic gagne sur MIME annoncé)
 *   3. Conversion HEIC → JPEG si nécessaire (D-105) côté infra
 *   4. Préparation chemin + slug + id
 *   5. Trx : Justificatif.creer + repo.enregistrer
 *   6. Écriture disque (hors trx) ; compensation soft-delete si échec
 */
export async function uploaderJustificatif(
  commande: UploaderJustificatifCommande,
  deps: UploaderJustificatifDeps,
): Promise<UploaderJustificatifResultat> {
  // Garde-fou taille (le multipart impose déjà 50 Mo mais on protège pour appels non-HTTP)
  if (commande.fichier.buffer.length > TAILLE_MAX_OCTETS) {
    throw new FichierTropVolumineux();
  }

  // Étape 1 — vérifications référentielles
  if (commande.bienId !== undefined && commande.bienId !== null) {
    const bien = await deps.bienRepo.trouverParId(commande.bienId as BienId);
    if (!bien) {
      throw new BienAttacheIntrouvable();
    }
  }
  if (commande.locataireId !== undefined && commande.locataireId !== null) {
    const locataire = await deps.locataireRepo.trouverParId(
      commande.locataireId as LocataireId,
    );
    if (!locataire) {
      throw new LocataireAttacheIntrouvable();
    }
  }

  // Étape 2 — validation magic-bytes (D-118)
  const validation = validerMagicBytes(
    commande.fichier.buffer,
    commande.fichier.mimeAnnonce,
  );
  if (!validation.ok) {
    if (validation.raison === 'format-non-accepte') {
      throw new FormatNonAccepte();
    }
    throw new MimeMismatch();
  }
  const mimeDetecte: MimeDetecte = validation.mimeFinal;

  // Étape 3 — conversion image si nécessaire (D-105)
  let bytesPersistes: Buffer = commande.fichier.buffer;
  let mimePersiste: MimeJustificatif;
  if (mimeDetecte === 'application/pdf') {
    mimePersiste = 'application/pdf';
  } else {
    const conv = await deps.convertisseurImage.convertirVersJpegSiNecessaire(
      commande.fichier.buffer,
      mimeDetecte,
    );
    bytesPersistes = conv.bytes;
    mimePersiste = conv.mimeFinal;
  }

  // Étape 4 — préparation chemin
  const justificatifId = nouveauJustificatifId();
  const slug = StockageJustificatifsLocal.slugify(commande.titre);
  const anneeFiscale = commande.dateDocument.year;
  const ext = EXT_PAR_MIME[mimePersiste];
  const cheminPrevisible: CheminRelatif =
    `documents/justificatifs/${anneeFiscale}/${justificatifId}-${slug}.${ext}` as CheminRelatif;

  // Étape 5 — création + enregistrement (en trx)
  const today = deps.clock.aujourdhui();
  const justificatif = Justificatif.creer({
    id: justificatifId,
    type: commande.type,
    dateDocument: commande.dateDocument,
    titre: commande.titre,
    montantTtc: commande.montantTtc ?? null,
    cheminFichier: cheminPrevisible,
    nomFichierOriginal: commande.fichier.nomOriginal,
    mimeType: mimePersiste,
    tailleOctets: bytesPersistes.length,
    bienId:
      commande.bienId !== undefined && commande.bienId !== null
        ? (commande.bienId as BienId)
        : null,
    locataireId:
      commande.locataireId !== undefined && commande.locataireId !== null
        ? (commande.locataireId as LocataireId)
        : null,
    notes: commande.notes ?? null,
    creeLe: today,
    corbeilleLe: null,
    raisonCorbeille: null,
  });

  await deps.db.transaction().execute(async (trx) => {
    await deps.justificatifRepo.enregistrer(justificatif, trx);
  });

  // Étape 6 — écriture disque (hors trx) avec compensation
  try {
    await deps.stockage.ecrire(
      anneeFiscale,
      justificatifId,
      slug,
      ext,
      bytesPersistes,
    );
  } catch (err) {
    // Compensation : soft-delete la row qu'on vient d'enregistrer
    try {
      const enCorbeille = justificatif.mettreEnCorbeille(
        'Échec écriture disque',
        today,
      );
      await deps.justificatifRepo.enregistrer(enCorbeille);
    } catch (compensationErr) {

      console.error(
        '[CRITICAL] Échec compensation après écriture disque ratée',
        { initial: err, compensation: compensationErr },
      );
    }
    throw err;
  }

  return {
    justificatifId,
    cheminFichier: justificatif.cheminFichier,
  };
}
