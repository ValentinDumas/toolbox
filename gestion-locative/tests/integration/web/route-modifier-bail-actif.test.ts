/**
 * Tests d'intégration HTTP — POST /baux/:id/modifier-actif (confirmation=oui).
 *
 * CR-03 (revue Phase 10) : le formulaire de modification d'un bail actif ne porte
 * aucun champ cautionnement ; la confirmation ne doit donc pas effacer le
 * cautionnement existant.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { creerApp } from '../../../src/main.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import type { BailId, LocataireId } from '../../../src/domain/_shared/identifiants.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import {
  unLocataireValide,
  unBailIndexableValide,
  uneCautionnementPhysique,
} from '../../_builders/locatif.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('POST /baux/:id/modifier-actif', () => {
  let app: Awaited<ReturnType<typeof creerApp>>;
  let db: Kysely<DB>;
  let bailRepo: BailRepositorySqlite;
  let bailId: BailId;

  beforeEach(async () => {
    process.env['SESSION_SECRET'] = 'test-secret-modifier-bail-actif-32c!!';
    const sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

    const lot = unLotValide({ designation: 'Principal' });
    const bien = unBienValide({ lots: [lot] });
    await new BienRepositorySqlite(db).enregistrer(bien);
    const locataire = unLocataireValide();
    await new LocataireRepositorySqlite(db).enregistrer(locataire);

    bailRepo = new BailRepositorySqlite(db);
    const bail = unBailIndexableValide({
      bienId: bien.id,
      locataireId: locataire.id as LocataireId,
      lotIds: [lot.id],
      dateDebut: Temporal.PlainDate.from('2026-01-01'),
      cautionnement: uneCautionnementPhysique(),
    });
    await bailRepo.enregistrer(bail);
    bailId = bail.id as BailId;

    app = await creerApp(db, { clock: ClockFixe.du('2026-06-16') });
  });

  afterEach(async () => {
    await app.close();
    await db.destroy();
  });

  it('conserve le cautionnement existant quand le formulaire ne le porte pas (CR-03)', async () => {
    const bail = (await bailRepo.trouverParId(bailId))!;
    const champs = new URLSearchParams({
      confirmation: 'oui',
      bienId: bail.bienId,
      locataireId: bail.locataireId,
      lotIds: bail.lotIds[0]!,
      dateDebut: bail.dateDebut.toString(),
      dureeMois: String(bail.dureeMois),
      loyerHcEuros: '850',
      modeCharges: bail.modeCharges,
      montantChargesEuros: '50',
      depotGarantieEuros: '800',
      irlTrimestre: bail.irlReference.trimestre,
      irlValeur: bail.irlReference.valeur,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/baux/${bailId}/modifier-actif`,
      payload: champs.toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });

    expect(res.statusCode).toBe(302);
    const bailApres = (await bailRepo.trouverParId(bailId))!;
    expect(bailApres.loyerHc.toCentimes()).toBe(85_000n);
    expect(bailApres.cautionnement).not.toBeNull();
    expect(bailApres.cautionnement!.garant!.nom).toBe('Martin');
  });
});
