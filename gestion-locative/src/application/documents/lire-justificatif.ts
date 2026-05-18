import type { JustificatifId } from '../../domain/_shared/identifiants.js';
import {
  DocumentDejaEnCorbeille,
  JustificatifIntrouvable,
} from '../../domain/documents/erreurs.js';
import type { Justificatif } from '../../domain/documents/justificatif.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';
import type { StockageJustificatifs } from '../../domain/documents/stockage-justificatifs.js';

export interface LireJustificatifResultat {
  justificatif: Justificatif;
  bytes: Buffer;
}

/**
 * Use case : lire un justificatif (fichier binaire).
 *
 * - throw JustificatifIntrouvable si la row n'existe pas (→ 404 côté route).
 * - throw DocumentDejaEnCorbeille si la row est en corbeille (→ 410 côté route).
 */
export async function lireJustificatif(
  commande: { id: JustificatifId | string },
  deps: {
    justificatifRepo: JustificatifRepository;
    stockage: StockageJustificatifs;
  },
): Promise<LireJustificatifResultat> {
  const j = await deps.justificatifRepo.trouverParId(commande.id);
  if (!j) {
    throw new JustificatifIntrouvable(String(commande.id));
  }
  if (j.corbeilleLe !== null) {
    throw new DocumentDejaEnCorbeille();
  }
  const bytes = await deps.stockage.lire(j.cheminFichier);
  return { justificatif: j, bytes };
}
