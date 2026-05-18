import type { CheminRelatif, JustificatifId } from '../_shared/identifiants.js';

/**
 * Port domain `StockageJustificatifs` (D-106 — dédié BC Documents).
 *
 * NE PAS étendre `StockageFichierLocal` du BC Encaissements : les deux contextes
 * ont des cycles de vie radicalement différents (quittance = PDF généré 1 fois,
 * justificatif = upload utilisateur avec rétention 10 ans + corbeille).
 */
export interface StockageJustificatifs {
  /**
   * Écrit un fichier sous `documents/justificatifs/{annee}/{id}-{slug}.{ext}`.
   * Flag 'wx' : refuse l'écrasement (immutabilité au sens disque).
   * Retourne le chemin relatif à baseDir.
   */
  ecrire(
    annee: number,
    justificatifId: JustificatifId,
    slug: string,
    ext: string,
    bytes: Buffer,
  ): Promise<CheminRelatif>;

  /**
   * Lit un fichier depuis son chemin relatif.
   * Applique WR-03 anti-path-traversal (NUL byte, realpath, baseDir prefix).
   * Throw FichierIntrouvable si absent ou en dehors de baseDir.
   */
  lire(cheminRelatif: CheminRelatif): Promise<Buffer>;

  /**
   * Supprime physiquement le fichier (utilisé uniquement après purge D-109,
   * jamais lors d'un soft-delete via `mettreEnCorbeille`).
   */
  supprimer(cheminRelatif: CheminRelatif): Promise<void>;
}
