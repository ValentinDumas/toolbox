import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type {
  CheminRelatif,
  JustificatifId,
} from '../../../src/domain/_shared/identifiants.js';
import { CheminInvalide, FichierIntrouvable } from '../../../src/domain/documents/erreurs.js';
import { slugify } from '../../../src/domain/_shared/slug.js';
import { StockageJustificatifsLocal } from '../../../src/infrastructure/storage/stockage-justificatifs-local.js';

const tmpDirs: string[] = [];

function creerTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glo-stockage-just-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

const idTest = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' as JustificatifId;

describe('StockageJustificatifsLocal.ecrire', () => {
  it('crée documents/justificatifs/{annee}/ et écrit le fichier (flag wx)', async () => {
    const baseDir = creerTmpDir();
    const stockage = new StockageJustificatifsLocal(baseDir);
    const bytes = Buffer.from('%PDF-1.7 hello');

    const cheminRelatif = await stockage.ecrire(2026, idTest, 'test-slug', 'pdf', bytes);

    expect(cheminRelatif).toBe(
      path.join('documents', 'justificatifs', '2026', `${idTest}-test-slug.pdf`),
    );
    const absolu = path.join(baseDir, cheminRelatif);
    expect(fs.existsSync(absolu)).toBe(true);
    expect(fs.readFileSync(absolu).equals(bytes)).toBe(true);
  });

  it('refuse l\'écrasement (flag wx) — deuxième ecrire sur le même chemin throw', async () => {
    const baseDir = creerTmpDir();
    const stockage = new StockageJustificatifsLocal(baseDir);
    await stockage.ecrire(2026, idTest, 'slug', 'pdf', Buffer.from('a'));
    await expect(
      stockage.ecrire(2026, idTest, 'slug', 'pdf', Buffer.from('b')),
    ).rejects.toThrow();
  });

  it('accepte ext avec ou sans point initial', async () => {
    const baseDir = creerTmpDir();
    const stockage = new StockageJustificatifsLocal(baseDir);
    const c = await stockage.ecrire(2026, idTest, 'x', '.jpg', Buffer.from('xx'));
    expect(c.endsWith('.jpg')).toBe(true);
  });
});

describe('StockageJustificatifsLocal.lire', () => {
  it('retourne le buffer écrit', async () => {
    const baseDir = creerTmpDir();
    const stockage = new StockageJustificatifsLocal(baseDir);
    const bytes = Buffer.from('hello world');
    const chemin = await stockage.ecrire(2026, idTest, 's', 'png', bytes);

    const lu = await stockage.lire(chemin);
    expect(lu.equals(bytes)).toBe(true);
  });

  it('throw FichierIntrouvable si fichier absent', async () => {
    const baseDir = creerTmpDir();
    const stockage = new StockageJustificatifsLocal(baseDir);
    await expect(
      stockage.lire(
        'documents/justificatifs/2026/inexistant.pdf' as CheminRelatif,
      ),
    ).rejects.toThrow(FichierIntrouvable);
  });

  it('WR-03 bloque NUL byte', async () => {
    const baseDir = creerTmpDir();
    const stockage = new StockageJustificatifsLocal(baseDir);
    await expect(
      stockage.lire(
        'documents/justificatifs/2026/x\0.pdf' as CheminRelatif,
      ),
    ).rejects.toThrow(FichierIntrouvable);
  });

  it('WR-03 bloque path traversal ../../../etc/passwd', async () => {
    const baseDir = creerTmpDir();
    const stockage = new StockageJustificatifsLocal(baseDir);
    await expect(
      stockage.lire('../../../etc/passwd' as CheminRelatif),
    ).rejects.toThrow(FichierIntrouvable);
  });
});

describe('StockageJustificatifsLocal.supprimer (D-109 purge)', () => {
  it('supprime physiquement le fichier', async () => {
    const baseDir = creerTmpDir();
    const stockage = new StockageJustificatifsLocal(baseDir);
    const chemin = await stockage.ecrire(
      2026,
      idTest,
      's',
      'pdf',
      Buffer.from('x'),
    );
    expect(fs.existsSync(path.join(baseDir, chemin))).toBe(true);

    await stockage.supprimer(chemin);
    expect(fs.existsSync(path.join(baseDir, chemin))).toBe(false);
  });

  it('throw FichierIntrouvable si déjà absent', async () => {
    const baseDir = creerTmpDir();
    const stockage = new StockageJustificatifsLocal(baseDir);
    await expect(
      stockage.supprimer('inexistant.pdf' as CheminRelatif),
    ).rejects.toThrow(FichierIntrouvable);
  });
});

describe('slugify (DP-27) — déplacé dans domain/_shared/slug.ts (CR-06)', () => {
  it('normalise les accents', () => {
    expect(slugify('Facture EDF — Juin été')).toBe(
      'facture-edf-juin-ete',
    );
  });

  it('limite à 80 chars maximum', () => {
    const longString = 'a'.repeat(200);
    const slug = slugify(longString);
    expect(slug.length).toBeLessThanOrEqual(80);
  });

  it('fallback "document" si vide après normalisation', () => {
    expect(slugify('!!!')).toBe('document');
    expect(slugify('   ')).toBe('document');
    expect(slugify('')).toBe('document');
  });

  it('protège contre path traversal — supprime / et ..', () => {
    const r = slugify('../../../etc/passwd');
    expect(r).not.toContain('/');
    expect(r).not.toContain('..');
    expect(r).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('CR-04 — validation défensive ecrire()', () => {
  it('refuse slug avec ../', async () => {
    const baseDir = creerTmpDir();
    const stockage = new StockageJustificatifsLocal(baseDir);
    await expect(
      stockage.ecrire(2026, idTest, '../etc/passwd', 'pdf', Buffer.from('x')),
    ).rejects.toBeInstanceOf(CheminInvalide);
  });
  it('refuse ext malformée', async () => {
    const baseDir = creerTmpDir();
    const stockage = new StockageJustificatifsLocal(baseDir);
    await expect(
      stockage.ecrire(2026, idTest, 'ok', '../', Buffer.from('x')),
    ).rejects.toBeInstanceOf(CheminInvalide);
  });
  it('refuse annee invalide', async () => {
    const baseDir = creerTmpDir();
    const stockage = new StockageJustificatifsLocal(baseDir);
    await expect(
      stockage.ecrire(-1, idTest, 'ok', 'pdf', Buffer.from('x')),
    ).rejects.toBeInstanceOf(CheminInvalide);
    await expect(
      stockage.ecrire(NaN, idTest, 'ok', 'pdf', Buffer.from('x')),
    ).rejects.toBeInstanceOf(CheminInvalide);
  });
});
