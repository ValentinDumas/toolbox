import fs from 'node:fs/promises';
import path from 'node:path';

import { FichierIntrouvable } from '../../domain/documents/erreurs.js';
import type { StockageJustificatifs } from '../../domain/documents/stockage-justificatifs.js';
import type { CheminRelatif, JustificatifId } from '../../domain/_shared/identifiants.js';

/**
 * Adaptateur local pour `StockageJustificatifs` (D-106 — port dédié BC Documents).
 *
 * Persistance sous `${baseDir}/documents/justificatifs/{annee}/{id}-{slug}.{ext}`.
 *
 * WR-03 anti-path-traversal copié intégralement de `stockage-fichier-local.ts`
 * (séparation BC : on n'étend pas l'adapter Encaissements).
 */
export class StockageJustificatifsLocal implements StockageJustificatifs {
  constructor(private readonly baseDir: string) {}

  async ecrire(
    annee: number,
    justificatifId: JustificatifId,
    slug: string,
    ext: string,
    bytes: Buffer,
  ): Promise<CheminRelatif> {
    const extNetto = ext.startsWith('.') ? ext.slice(1) : ext;
    const cheminRelatif = path.join(
      'documents',
      'justificatifs',
      String(annee),
      `${justificatifId}-${slug}.${extNetto}`,
    );
    const cheminAbsolu = path.join(this.baseDir, cheminRelatif);
    await fs.mkdir(path.dirname(cheminAbsolu), { recursive: true });
    await fs.writeFile(cheminAbsolu, bytes, { flag: 'wx' });
    return cheminRelatif as CheminRelatif;
  }

  async lire(cheminRelatif: CheminRelatif): Promise<Buffer> {
    const chemin = cheminRelatif as string;
    if (chemin.includes('\0')) {
      throw new FichierIntrouvable(chemin);
    }

    const cheminAbsolu = path.resolve(this.baseDir, chemin);
    const baseDirResolu = path.resolve(this.baseDir);
    if (
      !cheminAbsolu.startsWith(baseDirResolu + path.sep) &&
      cheminAbsolu !== baseDirResolu
    ) {
      throw new FichierIntrouvable(chemin);
    }

    let cheminReel: string;
    let baseDirReel: string;
    try {
      baseDirReel = await fs.realpath(baseDirResolu);
      cheminReel = await fs.realpath(cheminAbsolu);
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        throw new FichierIntrouvable(chemin);
      }
      throw err;
    }
    if (
      !cheminReel.startsWith(baseDirReel + path.sep) &&
      cheminReel !== baseDirReel
    ) {
      throw new FichierIntrouvable(chemin);
    }

    try {
      const data = await fs.readFile(cheminReel);
      return Buffer.from(data);
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        throw new FichierIntrouvable(chemin);
      }
      throw err;
    }
  }

  async supprimer(cheminRelatif: CheminRelatif): Promise<void> {
    const chemin = cheminRelatif as string;
    if (chemin.includes('\0')) {
      throw new FichierIntrouvable(chemin);
    }
    const cheminAbsolu = path.resolve(this.baseDir, chemin);
    const baseDirResolu = path.resolve(this.baseDir);
    if (
      !cheminAbsolu.startsWith(baseDirResolu + path.sep) &&
      cheminAbsolu !== baseDirResolu
    ) {
      throw new FichierIntrouvable(chemin);
    }
    try {
      await fs.unlink(cheminAbsolu);
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        throw new FichierIntrouvable(chemin);
      }
      throw err;
    }
  }
}
