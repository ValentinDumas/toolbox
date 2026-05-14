import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import type { BailId, EcheanceLoyerId } from '../../../src/domain/_shared/identifiants.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { unBailValide, unLocataireValide } from '../../_builders/locatif.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';

// NOTE: Ces imports n'existent pas encore — tests RED intentionnellement
import { QuittanceRepositorySqlite } from '../../../src/infrastructure/repositories/quittance-repository-sqlite.js';
import { Quittance } from '../../../src/domain/encaissements/quittance.js';
import { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { EcheanceLoyerRepositorySqlite } from '../../../src/infrastructure/repositories/echeance-loyer-repository-sqlite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('QuittanceRepositorySqlite', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let quittanceRepo: QuittanceRepositorySqlite;
  let echeanceLoyerRepo: EcheanceLoyerRepositorySqlite;
  let echeanceId: EcheanceLoyerId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    quittanceRepo = new QuittanceRepositorySqlite(db);
    echeanceLoyerRepo = new EcheanceLoyerRepositorySqlite(db);

    // Créer dépendances en base
    const bailRepo = new BailRepositorySqlite(db);
    const bienRepo = new BienRepositorySqlite(db);
    const locataireRepo = new LocataireRepositorySqlite(db);

    const lot = unLotValide({ designation: 'Appt test' });
    const bien = unBienValide({ lots: [lot] });
    await bienRepo.enregistrer(bien);

    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);

    const bail = unBailValide({
      bienId: bien.id,
      locataireId: locataire.id,
      lotIds: [lot.id],
    });
    await bailRepo.enregistrer(bail);
    const bailId = bail.id;

    // Créer une échéance
    const loyerHc = Money.fromEuros(620);
    const montantCharges = Money.fromEuros(80);
    const echeance = EcheanceLoyer.creer({
      bailId,
      periodeDebut: Temporal.PlainDate.from('2026-05-01'),
      periodeFin: Temporal.PlainDate.from('2026-05-31'),
      jourEcheanceAttendue: Temporal.PlainDate.from('2026-05-05'),
      loyerHc,
      montantCharges,
      modeCharges: 'forfait',
      total: loyerHc.additionner(montantCharges),
      statut: 'payee',
      annuleLe: null,
    });
    await echeanceLoyerRepo.enregistrer(echeance);
    echeanceId = echeance.id;
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('T14: roundtrip — enregistrer + trouverParId avec annuleeLe null', async () => {
    const quittance = Quittance.creer({
      echeanceId,
      numero: '2026-001',
      cheminFichierRelatif: 'quittances/2026/quittance-2026-001-mai-2026-dupont.pdf',
      emiseLe: Temporal.PlainDate.from('2026-05-31'),
    });

    await quittanceRepo.enregistrer(quittance);
    const retrouve = await quittanceRepo.trouverParId(quittance.id);

    expect(retrouve).not.toBeNull();
    expect(retrouve!.id).toBe(quittance.id);
    expect(retrouve!.numero).toBe('2026-001');
    expect(retrouve!.cheminFichierRelatif).toBe('quittances/2026/quittance-2026-001-mai-2026-dupont.pdf');
    expect(retrouve!.annuleeLe).toBeNull();
    expect(retrouve!.estActive()).toBe(true);
  });

  it('T14b: roundtrip — enregistrer + mettre à jour avec annuleeLe set', async () => {
    const quittance = Quittance.creer({
      echeanceId,
      numero: '2026-001',
      cheminFichierRelatif: 'quittances/2026/quittance-2026-001-mai-2026-dupont.pdf',
      emiseLe: Temporal.PlainDate.from('2026-05-31'),
    });
    await quittanceRepo.enregistrer(quittance);

    const annuleeLe = Temporal.PlainDate.from('2026-06-01');
    const quittanceAnnulee = quittance.annuler('Test annulation', annuleeLe);
    await quittanceRepo.enregistrer(quittanceAnnulee);

    const retrouve = await quittanceRepo.trouverParId(quittance.id);
    expect(retrouve!.annuleeLe).toEqual(annuleeLe);
    expect(retrouve!.raisonAnnulation).toBe('Test annulation');
    expect(retrouve!.estActive()).toBe(false);
  });

  it('T15: prochainNumero(2026) quand meta absent → "2026-001" et crée la clé valeur "1"', async () => {
    const numero = await quittanceRepo.prochainNumero(2026);
    expect(numero).toBe('2026-001');

    // Vérifier que la clé a été créée en meta
    const row = await db
      .selectFrom('meta')
      .select('valeur')
      .where('cle', '=', 'compteur_quittance_2026')
      .executeTakeFirst();
    expect(row?.valeur).toBe('1');
  });

  it('T15b: prochainNumero(2026) quand meta.valeur=42 → "2026-043" et UPDATE valeur=43', async () => {
    // Insérer compteur à 42
    await db.insertInto('meta').values({ cle: 'compteur_quittance_2026', valeur: '42' }).execute();

    const numero = await quittanceRepo.prochainNumero(2026);
    expect(numero).toBe('2026-043');

    const row = await db
      .selectFrom('meta')
      .select('valeur')
      .where('cle', '=', 'compteur_quittance_2026')
      .executeTakeFirst();
    expect(row?.valeur).toBe('43');
  });

  it('T15c: trouverActiveParEcheance retourne null si aucune quittance', async () => {
    const result = await quittanceRepo.trouverActiveParEcheance(echeanceId);
    expect(result).toBeNull();
  });

  it('T15d: trouverActiveParEcheance retourne la quittance active', async () => {
    const quittance = Quittance.creer({
      echeanceId,
      numero: '2026-001',
      cheminFichierRelatif: 'quittances/2026/quittance-2026-001-mai-2026-dupont.pdf',
      emiseLe: Temporal.PlainDate.from('2026-05-31'),
    });
    await quittanceRepo.enregistrer(quittance);

    const result = await quittanceRepo.trouverActiveParEcheance(echeanceId);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(quittance.id);
  });

  it('T15e: trouverActiveParEcheance retourne null si seule quittance est annulée', async () => {
    const quittance = Quittance.creer({
      echeanceId,
      numero: '2026-001',
      cheminFichierRelatif: 'quittances/2026/quittance-2026-001-mai-2026-dupont.pdf',
      emiseLe: Temporal.PlainDate.from('2026-05-31'),
    });
    await quittanceRepo.enregistrer(quittance);
    const annulee = quittance.annuler('Raison test', Temporal.PlainDate.from('2026-06-01'));
    await quittanceRepo.enregistrer(annulee);

    const result = await quittanceRepo.trouverActiveParEcheance(echeanceId);
    expect(result).toBeNull();
  });
});
