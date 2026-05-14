import { describe, it, expect, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

// NOTE: Ces imports n'existent pas encore — tests RED intentionnellement
import { StockageFichierLocal } from '../../../src/infrastructure/storage/stockage-fichier-local.js';
import { FichierIntrouvable } from '../../../src/domain/encaissements/erreurs.js';

const tmpDirs: string[] = [];

function creerTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glo-storage-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe('StockageFichierLocal', () => {
  it('T16: ecrireQuittance crée le dossier quittances/2026 et écrit le fichier', async () => {
    const baseDir = creerTmpDir();
    const stockage = new StockageFichierLocal(baseDir);

    const buffer = Buffer.from('%PDF-test');
    const nomFichier = 'quittance-2026-001-mai-2026-dupont.pdf';

    const cheminRelatif = await stockage.ecrireQuittance(2026, nomFichier, buffer);

    // Chemin relatif retourné
    expect(cheminRelatif).toBe(path.join('quittances', '2026', nomFichier));

    // Fichier existe sur disque
    const cheminAbsolu = path.join(baseDir, 'quittances', '2026', nomFichier);
    expect(fs.existsSync(cheminAbsolu)).toBe(true);

    // Contenu correct
    const lu = fs.readFileSync(cheminAbsolu);
    expect(lu.equals(buffer)).toBe(true);
  });

  it('T17: lireQuittance retourne le buffer écrit', async () => {
    const baseDir = creerTmpDir();
    const stockage = new StockageFichierLocal(baseDir);

    const buffer = Buffer.from('%PDF-test-lecture');
    const nomFichier = 'quittance-2026-002-juin-2026-martin.pdf';
    const cheminRelatif = await stockage.ecrireQuittance(2026, nomFichier, buffer);

    const lu = await stockage.lireQuittance(cheminRelatif);
    expect(lu.equals(buffer)).toBe(true);
  });

  it('T17b: lireQuittance throw FichierIntrouvable si fichier absent', async () => {
    const baseDir = creerTmpDir();
    const stockage = new StockageFichierLocal(baseDir);

    await expect(
      stockage.lireQuittance('quittances/2026/inexistant.pdf'),
    ).rejects.toThrow(FichierIntrouvable);
  });

  it('T18: slugify normalise les accents et caractères spéciaux', () => {
    expect(StockageFichierLocal.slugify('René Dupré-Martin')).toBe('rene-dupre-martin');
  });

  it('T18b: slugify protège contre path traversal — supprime les / et ..', () => {
    const result = StockageFichierLocal.slugify('../../../etc/passwd');
    expect(result).not.toContain('/');
    expect(result).not.toContain('..');
    // Le résultat ne doit contenir que des caractères [a-z0-9-]
    expect(result).toMatch(/^[a-z0-9-]*$/);
  });

  it('T18c: slugify produit uniquement [a-z0-9-]', () => {
    const result = StockageFichierLocal.slugify('Jean-Marc Éliàs du Château 123');
    expect(result).toMatch(/^[a-z0-9-]+$/);
  });

  it('ecrireQuittance rejette si le fichier existe déjà (immutabilité D-63)', async () => {
    const baseDir = creerTmpDir();
    const stockage = new StockageFichierLocal(baseDir);

    const buffer = Buffer.from('%PDF-original');
    const nomFichier = 'quittance-2026-001-mai-2026-dupont.pdf';

    await stockage.ecrireQuittance(2026, nomFichier, buffer);

    // Deuxième écriture doit échouer
    await expect(
      stockage.ecrireQuittance(2026, nomFichier, Buffer.from('%PDF-ecrase')),
    ).rejects.toThrow();
  });
});
