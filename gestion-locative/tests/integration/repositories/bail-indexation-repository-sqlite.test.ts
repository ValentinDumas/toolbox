import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { BailIndexationRepositorySqlite } from '../../../src/infrastructure/repositories/bail-indexation-repository-sqlite.js';
import { BailIndexation } from '../../../src/domain/locatif/bail-indexation.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { IRL } from '../../../src/domain/_shared/irl.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import {
  unLocataireValide,
  unBailIndexableValide,
  uneBailIndexationAppliqueeValide,
  uneBailIndexationRenonceeValide,
} from '../../_builders/locatif.js';
import type { BailId, LocataireId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('BailIndexationRepositorySqlite', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let repo: BailIndexationRepositorySqlite;
  let bailId: BailId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    repo = new BailIndexationRepositorySqlite(db);

    const bienRepo = new BienRepositorySqlite(db);
    const locataireRepo = new LocataireRepositorySqlite(db);
    const bailRepo = new BailRepositorySqlite(db);

    const lot = unLotValide({ designation: 'Principal' });
    const bien = unBienValide({ lots: [lot] });
    await bienRepo.enregistrer(bien);

    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);

    const bail = unBailIndexableValide({
      bienId: bien.id,
      locataireId: locataire.id as LocataireId,
      lotIds: [lot.id],
    });
    await bailRepo.enregistrer(bail);
    bailId = bail.id;
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('T19: roundtrip — enregistrer + trouverParId (appliquée)', async () => {
    const bi = uneBailIndexationAppliqueeValide({ bailId });
    await repo.enregistrer(bi);
    const trouve = await repo.trouverParId(bi.id);
    expect(trouve).not.toBeNull();
    expect(trouve!.bailId).toBe(bailId);
    expect(trouve!.indexationAppliquee).toBe(true);
    expect(trouve!.raisonNonApplication).toBeNull();
    expect(trouve!.loyerAvant.toCentimes()).toBe(80_000n);
    expect(trouve!.loyerApres.toCentimes()).toBe(81_920n);
    expect(trouve!.irlAvant.valeur).toBe('142.06');
    expect(trouve!.irlApres.valeur).toBe('145.47');
  });

  it('T19b: roundtrip — renoncée préserve raisonNonApplication', async () => {
    const bi = uneBailIndexationRenonceeValide({ bailId });
    await repo.enregistrer(bi);
    const trouve = await repo.trouverParId(bi.id);
    expect(trouve!.indexationAppliquee).toBe(false);
    expect(trouve!.raisonNonApplication).toBe('refus_bailleur');
    expect(trouve!.loyerAvant.egale(trouve!.loyerApres)).toBe(true);
  });

  it('T20: enregistrer 2× même id → constraint UNIQUE (append-only, pas d\'upsert)', async () => {
    const bi = uneBailIndexationAppliqueeValide({ bailId });
    await repo.enregistrer(bi);
    await expect(repo.enregistrer(bi)).rejects.toThrow();
  });

  it('T21: listerParBail trié date_effet DESC', async () => {
    const bi1 = uneBailIndexationAppliqueeValide({
      bailId,
      dateEffet: Temporal.PlainDate.from('2026-05-01'),
    });
    const bi2 = uneBailIndexationAppliqueeValide({
      bailId,
      dateEffet: Temporal.PlainDate.from('2027-05-01'),
      irlAvant: IRL.creer({ trimestre: '2025-T4', valeur: '145.47' }),
      irlApres: IRL.creer({ trimestre: '2026-T4', valeur: '148.00' }),
      loyerAvant: Money.fromCentimes(81_920n),
      loyerApres: Money.fromCentimes(83_383n),
    });
    await repo.enregistrer(bi1);
    await repo.enregistrer(bi2);
    const liste = await repo.listerParBail(bailId);
    expect(liste.length).toBe(2);
    expect(liste[0]!.dateEffet.toString()).toBe('2027-05-01');
    expect(liste[1]!.dateEffet.toString()).toBe('2026-05-01');
  });

  it('T22: dernierePourBail retourne la plus récente, null sinon', async () => {
    expect(await repo.dernierePourBail(bailId)).toBeNull();
    const bi1 = uneBailIndexationAppliqueeValide({
      bailId,
      dateEffet: Temporal.PlainDate.from('2026-05-01'),
    });
    await repo.enregistrer(bi1);
    const bi2 = uneBailIndexationAppliqueeValide({
      bailId,
      dateEffet: Temporal.PlainDate.from('2027-05-01'),
      irlAvant: IRL.creer({ trimestre: '2025-T4', valeur: '145.47' }),
      irlApres: IRL.creer({ trimestre: '2026-T4', valeur: '148.00' }),
      loyerAvant: Money.fromCentimes(81_920n),
      loyerApres: Money.fromCentimes(83_383n),
    });
    await repo.enregistrer(bi2);
    const derniere = await repo.dernierePourBail(bailId);
    expect(derniere).not.toBeNull();
    expect(derniere!.dateEffet.toString()).toBe('2027-05-01');
    // Validate via BailIndexation type
    expect(derniere).toBeInstanceOf(BailIndexation);
  });
});
