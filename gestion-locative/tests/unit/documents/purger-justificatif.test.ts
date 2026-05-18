import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Temporal } from '@js-temporal/polyfill';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { purgerJustificatif } from '../../../src/application/documents/purger-justificatif.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import type {
  BienId,
  CheminRelatif,
} from '../../../src/domain/_shared/identifiants.js';
import {
  JustificatifIntrouvable,
  PurgeAvantDixAnsRefusee,
} from '../../../src/domain/documents/erreurs.js';
import { Justificatif } from '../../../src/domain/documents/justificatif.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { JustificatifRepositorySqlite } from '../../../src/infrastructure/repositories/justificatif-repository-sqlite.js';
import { unBienValide } from '../../_builders/patrimoine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('purgerJustificatif (D-109 — 3 branches)', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let repo: JustificatifRepositorySqlite;
  let bienId: BienId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    repo = new JustificatifRepositorySqlite(db);
    const bienRepo = new BienRepositorySqlite(db);
    const bien = unBienValide();
    await bienRepo.enregistrer(bien);
    bienId = bien.id;
  });

  afterEach(async () => {
    await db.destroy();
  });

  const stockageNoop = {
    ecrire: vi.fn().mockResolvedValue('chemin' as CheminRelatif),
    lire: vi.fn().mockResolvedValue(Buffer.alloc(0)),
    supprimer: vi.fn().mockResolvedValue(undefined),
  };

  it('throw JustificatifIntrouvable si l\'id n\'existe pas', async () => {
    const clock = ClockFixe.du('2026-05-18');
    await expect(
      purgerJustificatif(
        { id: 'idinconnu' },
        { justificatifRepo: repo, stockage: stockageNoop, clock, db },
      ),
    ).rejects.toThrow(JustificatifIntrouvable);
  });

  it('throw InvariantViolated si le document n\'est PAS en corbeille (branche 1)', async () => {
    const clock = ClockFixe.du('2026-05-18');
    const j = Justificatif.creer({
      type: 'facture',
      dateDocument: Temporal.PlainDate.from('2026-05-18'),
      titre: 'Doc actif',
      montantTtc: null,
      cheminFichier: 'documents/justificatifs/2026/x.pdf' as CheminRelatif,
      nomFichierOriginal: 'x.pdf',
      mimeType: 'application/pdf',
      tailleOctets: 1024,
      bienId,
      locataireId: null,
      notes: null,
      creeLe: Temporal.PlainDate.from('2026-05-18'),
    });
    await repo.enregistrer(j);

    await expect(
      purgerJustificatif(
        { id: j.id },
        { justificatifRepo: repo, stockage: stockageNoop, clock, db },
      ),
    ).rejects.toThrow(InvariantViolated);
  });

  it('throw PurgeAvantDixAnsRefusee avec message verbatim avant 10 ans (branche 2)', async () => {
    const clock = ClockFixe.du('2026-05-18');
    const j = Justificatif.creer({
      type: 'facture',
      dateDocument: Temporal.PlainDate.from('2026-05-18'),
      titre: 'Doc en corbeille',
      montantTtc: null,
      cheminFichier: 'documents/justificatifs/2026/x.pdf' as CheminRelatif,
      nomFichierOriginal: 'x.pdf',
      mimeType: 'application/pdf',
      tailleOctets: 1024,
      bienId,
      locataireId: null,
      notes: null,
      creeLe: Temporal.PlainDate.from('2026-05-18'),
      corbeilleLe: Temporal.PlainDate.from('2026-05-18'),
      raisonCorbeille: 'Doublon',
    });
    await repo.enregistrer(j);

    await expect(
      purgerJustificatif(
        { id: j.id },
        { justificatifRepo: repo, stockage: stockageNoop, clock, db },
      ),
    ).rejects.toThrow(PurgeAvantDixAnsRefusee);

    try {
      await purgerJustificatif(
        { id: j.id },
        { justificatifRepo: repo, stockage: stockageNoop, clock, db },
      );
    } catch (err) {
      expect((err as Error).message).toContain(
        "Conservation légale obligatoire jusqu'au 18/05/2036",
      );
      expect((err as Error).message).toContain(
        'Vous pourrez purger ce document à partir de cette date.',
      );
    }
  });

  it('hard-delete row + cleanup fichier après 10 ans (branche 3 — peutEtrePurge=true)', async () => {
    const clock = ClockFixe.du('2036-05-18');
    const supprimerSpy = vi.fn().mockResolvedValue(undefined);
    const stockage = { ...stockageNoop, supprimer: supprimerSpy };

    const j = Justificatif.creer({
      type: 'facture',
      dateDocument: Temporal.PlainDate.from('2026-05-18'),
      titre: 'Doc ancien',
      montantTtc: null,
      cheminFichier: 'documents/justificatifs/2026/ancien.pdf' as CheminRelatif,
      nomFichierOriginal: 'ancien.pdf',
      mimeType: 'application/pdf',
      tailleOctets: 1024,
      bienId,
      locataireId: null,
      notes: null,
      creeLe: Temporal.PlainDate.from('2026-05-18'),
      corbeilleLe: Temporal.PlainDate.from('2026-05-20'),
      raisonCorbeille: 'Obsolète',
    });
    await repo.enregistrer(j);

    await purgerJustificatif(
      { id: j.id },
      { justificatifRepo: repo, stockage, clock, db },
    );

    // Row supprimée
    const r = await repo.trouverParId(j.id);
    expect(r).toBeNull();

    // stockage.supprimer appelé exactement 1 fois avec le chemin
    expect(supprimerSpy).toHaveBeenCalledOnce();
    expect(supprimerSpy).toHaveBeenCalledWith(
      'documents/justificatifs/2026/ancien.pdf',
    );
  });

  it('hard-delete row OK même si cleanup fichier jette (ENOENT) — pas de rollback', async () => {
    const clock = ClockFixe.du('2036-05-18');
    const supprimerSpy = vi
      .fn()
      .mockRejectedValue(new Error('ENOENT: file not found'));
    const stockage = { ...stockageNoop, supprimer: supprimerSpy };
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const j = Justificatif.creer({
      type: 'facture',
      dateDocument: Temporal.PlainDate.from('2026-05-18'),
      titre: 'Doc orphelin',
      montantTtc: null,
      cheminFichier:
        'documents/justificatifs/2026/orphelin.pdf' as CheminRelatif,
      nomFichierOriginal: 'orphelin.pdf',
      mimeType: 'application/pdf',
      tailleOctets: 1024,
      bienId,
      locataireId: null,
      notes: null,
      creeLe: Temporal.PlainDate.from('2026-05-18'),
      corbeilleLe: Temporal.PlainDate.from('2026-05-20'),
      raisonCorbeille: 'Obsolète',
    });
    await repo.enregistrer(j);

    // Ne devrait PAS rejeter — best-effort cleanup
    await expect(
      purgerJustificatif(
        { id: j.id },
        { justificatifRepo: repo, stockage, clock, db },
      ),
    ).resolves.toBeUndefined();

    // Row bien supprimée
    expect(await repo.trouverParId(j.id)).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });
});
