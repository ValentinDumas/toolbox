import fs from 'node:fs/promises';
import path from 'node:path';

import { FichierIntrouvable } from '../../domain/encaissements/erreurs.js';

/**
 * Adaptateur stockage fichiers PDF locaux (D-63).
 *
 * Persistance dans ~/Library/Application Support/gestion-locative/documents/
 * (ou GESTION_LOCATIVE_DATA_DIR pour les tests).
 */
export class StockageFichierLocal {
  constructor(private readonly baseDir: string) {}

  /**
   * Écrit un fichier PDF de quittance sur disque.
   * Crée le dossier si absent (mkdir recursive).
   * Utilise flag 'wx' : rejette si le fichier existe déjà (D-63 immutabilité).
   *
   * Retourne le chemin RELATIF à baseDir.
   */
  async ecrireQuittance(annee: number, nomFichier: string, buffer: Buffer): Promise<string> {
    const cheminAbsolu = path.join(this.baseDir, 'quittances', String(annee), nomFichier);
    await fs.mkdir(path.dirname(cheminAbsolu), { recursive: true });
    await fs.writeFile(cheminAbsolu, buffer, { flag: 'wx' });
    return path.join('quittances', String(annee), nomFichier);
  }

  /**
   * Lit un fichier PDF depuis son chemin relatif à baseDir.
   * Vérifie l'absence de path traversal avant lecture.
   * Throw FichierIntrouvable si absent.
   */
  async lireQuittance(cheminRelatif: string): Promise<Buffer> {
    const cheminAbsolu = path.resolve(this.baseDir, cheminRelatif);

    // Protection path traversal : le chemin résolu doit rester sous baseDir
    const baseDirResolu = path.resolve(this.baseDir);
    if (!cheminAbsolu.startsWith(baseDirResolu + path.sep) && cheminAbsolu !== baseDirResolu) {
      throw new FichierIntrouvable(cheminRelatif);
    }

    try {
      const data = await fs.readFile(cheminAbsolu);
      return Buffer.from(data);
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        throw new FichierIntrouvable(cheminRelatif);
      }
      throw err;
    }
  }

  /**
   * Slugifie une chaîne en [a-z0-9-] uniquement.
   * Protection contre path traversal et caractères dangereux.
   * "René Dupré-Martin" → "rene-dupre-martin"
   * "../../../etc/passwd" → résultat sans / ni ..
   */
  static slugify(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFD')
      // Retirer les marques diacritiques (U+0300-U+036F après NFD)
      .replace(/\p{M}/gu, '')
      // Retirer tout ce qui n'est pas [a-z0-9] → remplacer par -
      .replace(/[^a-z0-9]+/g, '-')
      // Retirer les tirets en début et fin
      .replace(/^-|-$/g, '');
  }
}
