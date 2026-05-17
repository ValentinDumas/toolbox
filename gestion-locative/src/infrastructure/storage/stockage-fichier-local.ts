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
   * Vérifie l'absence de path traversal avant lecture, y compris via symlinks.
   * Throw FichierIntrouvable si absent.
   *
   * WR-03 : protection renforcée — utilise fs.realpath() pour résoudre les
   * liens symboliques. Bloque le scénario où un attacker avec write access
   * crée un symlink baseDir/quittances/x.pdf → /etc/passwd.
   * Rejette aussi les caractères NULL bytes dans cheminRelatif.
   */
  async lireQuittance(cheminRelatif: string): Promise<Buffer> {
    // Rejet immédiat des NULL bytes (peuvent tromper path.resolve mais
    // déclencher des comportements bizarres dans fs.readFile).
    if (cheminRelatif.includes('\0')) {
      throw new FichierIntrouvable(cheminRelatif);
    }

    const cheminAbsolu = path.resolve(this.baseDir, cheminRelatif);

    // Première barrière : le chemin résolu (sans symlinks) doit rester sous baseDir.
    const baseDirResolu = path.resolve(this.baseDir);
    if (!cheminAbsolu.startsWith(baseDirResolu + path.sep) && cheminAbsolu !== baseDirResolu) {
      throw new FichierIntrouvable(cheminRelatif);
    }

    // Seconde barrière : résoudre les symlinks et revalider.
    let cheminReel: string;
    let baseDirReel: string;
    try {
      baseDirReel = await fs.realpath(baseDirResolu);
      cheminReel = await fs.realpath(cheminAbsolu);
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        throw new FichierIntrouvable(cheminRelatif);
      }
      throw err;
    }
    if (!cheminReel.startsWith(baseDirReel + path.sep) && cheminReel !== baseDirReel) {
      throw new FichierIntrouvable(cheminRelatif);
    }

    try {
      const data = await fs.readFile(cheminReel);
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
   * Phase 3-04 — Écrit un fichier PDF d'avenant IRL sur disque.
   * Strictement symétrique à `ecrireQuittance` (flag 'wx' immutable, D-63).
   *
   * Retourne le chemin RELATIF à baseDir.
   */
  async ecrireAvenant(annee: number, nomFichier: string, buffer: Buffer): Promise<string> {
    const cheminAbsolu = path.join(this.baseDir, 'avenants', String(annee), nomFichier);
    await fs.mkdir(path.dirname(cheminAbsolu), { recursive: true });
    await fs.writeFile(cheminAbsolu, buffer, { flag: 'wx' });
    return path.join('avenants', String(annee), nomFichier);
  }

  /**
   * Phase 3-04 — Lit un fichier PDF d'avenant depuis son chemin relatif à baseDir.
   * Strictement symétrique à `lireQuittance` (NULL byte check + realpath boundary).
   */
  async lireAvenant(cheminRelatif: string): Promise<Buffer> {
    if (cheminRelatif.includes('\0')) {
      throw new FichierIntrouvable(cheminRelatif);
    }

    const cheminAbsolu = path.resolve(this.baseDir, cheminRelatif);
    const baseDirResolu = path.resolve(this.baseDir);
    if (!cheminAbsolu.startsWith(baseDirResolu + path.sep) && cheminAbsolu !== baseDirResolu) {
      throw new FichierIntrouvable(cheminRelatif);
    }

    let cheminReel: string;
    let baseDirReel: string;
    try {
      baseDirReel = await fs.realpath(baseDirResolu);
      cheminReel = await fs.realpath(cheminAbsolu);
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        throw new FichierIntrouvable(cheminRelatif);
      }
      throw err;
    }
    if (!cheminReel.startsWith(baseDirReel + path.sep) && cheminReel !== baseDirReel) {
      throw new FichierIntrouvable(cheminRelatif);
    }

    try {
      const data = await fs.readFile(cheminReel);
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
