import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { EtatDesLieuxRepositorySqlite } from '../../../src/infrastructure/repositories/etat-des-lieux-repository-sqlite.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import { unLocataireValide, unBailValide, unEtatDesLieuxEntreeValide, unEtatDesLieuxSortieValide, inventaire12ItemsPresentsBon } from '../../_builders/locatif.js';
import type { BienId, LotId, LocataireId, BailId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('EtatDesLieuxRepositorySqlite', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let edlRepo: EtatDesLieuxRepositorySqlite;
  let bailRepo: BailRepositorySqlite;
  let bienRepo: BienRepositorySqlite;
  let locataireRepo: LocataireRepositorySqlite;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    edlRepo = new EtatDesLieuxRepositorySqlite(db);
    bailRepo = new BailRepositorySqlite(db);
    bienRepo = new BienRepositorySqlite(db);
    locataireRepo = new LocataireRepositorySqlite(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  async function creerBailEnBase(): Promise<BailId> {
    const lot = unLotValide({ designation: 'Principal' });
    const bien = unBienValide({ lots: [lot] });
    await bienRepo.enregistrer(bien);
    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);
    const bail = unBailValide({ bienId: bien.id, locataireId: locataire.id, lotIds: [lot.id] });
    await bailRepo.enregistrer(bail);
    return bail.id;
  }

  // T41 — roundtrip complet (12 items, contradictoire, dateSignature)
  it('roundtrip EDL via SQLite — 12 items JSON, contradictoire bool, dateSignature optionnelle', async () => {
    const bailId = await creerBailEnBase();
    const edl = unEtatDesLieuxEntreeValide({
      bailId,
      contradictoire: true,
      dateSignature: Temporal.PlainDate.from('2026-05-01'),
    });
    await edlRepo.enregistrer(edl);

    const loaded = await edlRepo.trouverParId(edl.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(edl.id);
    expect(loaded!.bailId).toBe(bailId);
    expect(loaded!.type).toBe('entree');
    expect(loaded!.contradictoire).toBe(true);
    expect(loaded!.dateSignature?.toString()).toBe('2026-05-01');
    expect(loaded!.inventaire.length).toBe(12);
    // Chaque item roundtrip OK
    for (const item of loaded!.inventaire) {
      expect(item.present).toBe(true);
      expect(item.etat).toBe('bon');
    }
  });

  // T42 — trouverActifParBailEtType retourne le non-annulé
  it('trouverActifParBailEtType — retourne EDL actif (pas l\'annulé)', async () => {
    const bailId = await creerBailEnBase();
    const edlAnnule = unEtatDesLieuxEntreeValide({ bailId });
    const edlAnnuleAvec = edlAnnule.annuler('test', Temporal.PlainDate.from('2026-06-01'));
    await edlRepo.enregistrer(edlAnnule);
    // Met à jour avec annule_le via upsert
    await edlRepo.enregistrer(edlAnnuleAvec);

    const edlActif = unEtatDesLieuxEntreeValide({ bailId });
    await edlRepo.enregistrer(edlActif);

    const found = await edlRepo.trouverActifParBailEtType(bailId, 'entree');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(edlActif.id);
    expect(found!.annuleLe).toBeNull();
  });

  // T43 — UNIQUE INDEX violation sur 2 EDL entrée non-annulés
  it('INSERT 2 EDL entrée non-annulés → violation UNIQUE INDEX', async () => {
    const bailId = await creerBailEnBase();
    const edl1 = unEtatDesLieuxEntreeValide({ bailId });
    const edl2 = unEtatDesLieuxEntreeValide({ bailId });
    await edlRepo.enregistrer(edl1);
    // Deuxième EDL entrée actif → doit provoquer un conflit DB
    await expect(edlRepo.enregistrer(edl2)).rejects.toThrow();
  });

  // T44 — Soft-delete puis nouvel EDL OK
  it('Soft-delete d\'un EDL puis INSERT nouvel EDL même bail/type → OK', async () => {
    const bailId = await creerBailEnBase();
    const edlOriginal = unEtatDesLieuxEntreeValide({ bailId });
    await edlRepo.enregistrer(edlOriginal);

    // Annuler (soft-delete)
    const edlAnnule = edlOriginal.annuler('correction', Temporal.PlainDate.from('2026-06-01'));
    await edlRepo.enregistrer(edlAnnule);

    // Nouvel EDL entrée actif — doit passer
    const edlNouveau = unEtatDesLieuxEntreeValide({ bailId });
    await expect(edlRepo.enregistrer(edlNouveau)).resolves.not.toThrow();

    const actif = await edlRepo.trouverActifParBailEtType(bailId, 'entree');
    expect(actif!.id).toBe(edlNouveau.id);
  });
});
