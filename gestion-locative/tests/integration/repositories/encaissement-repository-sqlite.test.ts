import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { Money } from '../../../src/domain/_shared/money.js';
import type { BailId, EcheanceLoyerId, EncaissementId } from '../../../src/domain/_shared/identifiants.js';
import { unBailValide } from '../../_builders/locatif.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import { unLocataireValide } from '../../_builders/locatif.js';
import { EcheanceLoyerRepositorySqlite } from '../../../src/infrastructure/repositories/echeance-loyer-repository-sqlite.js';
import { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { ActiviteBailDetectorSqlite } from '../../../src/infrastructure/repositories/activite-bail-detector-sqlite.js';
import { EncaissementRepositorySqlite } from '../../../src/infrastructure/repositories/encaissement-repository-sqlite.js';
import { Encaissement } from '../../../src/domain/encaissements/encaissement.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('EncaissementRepositorySqlite', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let encaissementRepo: EncaissementRepositorySqlite;
  let echeanceLoyerRepo: EcheanceLoyerRepositorySqlite;
  let bailRepo: BailRepositorySqlite;
  let bienRepo: BienRepositorySqlite;
  let locataireRepo: LocataireRepositorySqlite;
  let echeanceId: EcheanceLoyerId;
  let bailId: BailId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    encaissementRepo = new EncaissementRepositorySqlite(db);
    echeanceLoyerRepo = new EcheanceLoyerRepositorySqlite(db);
    bailRepo = new BailRepositorySqlite(db);
    bienRepo = new BienRepositorySqlite(db);
    locataireRepo = new LocataireRepositorySqlite(db);

    // Setup dépendances
    const lot = unLotValide({ designation: 'Appt test enc' });
    const bien = unBienValide({ lots: [lot] });
    await bienRepo.enregistrer(bien);
    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);
    const bail = unBailValide({ bienId: bien.id, locataireId: locataire.id, lotIds: [lot.id] });
    await bailRepo.enregistrer(bail);
    bailId = bail.id;

    // Créer une échéance en base
    const loyerHc = Money.fromEuros(620);
    const charges = Money.fromEuros(80);
    const echeance = EcheanceLoyer.creer({
      bailId,
      periodeDebut: Temporal.PlainDate.from('2026-05-01'),
      periodeFin: Temporal.PlainDate.from('2026-05-31'),
      jourEcheanceAttendue: Temporal.PlainDate.from('2026-05-05'),
      loyerHc,
      montantCharges: charges,
      modeCharges: 'forfait',
      total: loyerHc.additionner(charges),
      statut: 'en_attente',
      annuleLe: null,
    });
    await echeanceLoyerRepo.enregistrerBatch([echeance]);
    echeanceId = echeance.id;
  });

  afterEach(async () => {
    await db.destroy();
  });

  function creerEncaissement(montant: Money, opts: { id?: EncaissementId } = {}): Encaissement {
    return Encaissement.creer({
      id: opts.id,
      echeanceId,
      montant,
      date: Temporal.PlainDate.from('2026-05-05'),
      mode: 'virement',
    });
  }

  // T21 : roundtrip Encaissement Money négatif (compensateur)
  it('T21: roundtrip compensateur — montant négatif stocké et relu correctement', async () => {
    const montant = Money.compensateur(Money.fromEuros(200));
    const enc = creerEncaissement(montant);
    await encaissementRepo.enregistrer(enc);

    const retrouve = await encaissementRepo.trouverParId(enc.id);
    expect(retrouve).not.toBeNull();
    expect(retrouve!.montant.toCentimes()).toBe(-20_000n);
    expect(retrouve!.montant.estNegatif()).toBe(true);
  });

  // T22 : sommePaieeParEcheance retourne Money.zero quand aucun
  it('T22: sommePaieeParEcheance retourne Money.zero quand aucun encaissement', async () => {
    const somme = await encaissementRepo.sommePaieeParEcheance(echeanceId);
    expect(somme.toCentimes()).toBe(0n);
  });

  // T22 : exclut les annulés de la somme
  it('T22: sommePaieeParEcheance exclut les encaissements avec annule_le NOT NULL', async () => {
    const enc1 = creerEncaissement(Money.fromEuros(700));
    const enc2 = creerEncaissement(Money.fromEuros(100));
    await encaissementRepo.enregistrer(enc1);
    await encaissementRepo.enregistrer(enc2);

    // Annuler enc2
    const enc2Annule = enc2.annuler('Test annulation', Temporal.PlainDate.from('2026-05-10'));
    await encaissementRepo.enregistrer(enc2Annule);

    const somme = await encaissementRepo.sommePaieeParEcheance(echeanceId);
    expect(somme.toCentimes()).toBe(70_000n); // Seulement enc1 (700€)
  });

  // Test ActiviteBailDetector étendu pour encaissement
  it('ActiviteBailDetectorSqlite.aDeLActivite retourne true si encaissement existe', async () => {
    const detector = new ActiviteBailDetectorSqlite(db);

    // Avant encaissement : false car écheance est active mais ActiviteBailDetector
    // est déjà étendu pour les échéances dans 02-02
    // Créons un nouveau bail SANS écheance
    const lot2 = unLotValide({ designation: 'Appt 2' });
    const bien2 = unBienValide({ lots: [lot2] });
    await bienRepo.enregistrer(bien2);
    const loc2 = unLocataireValide({ email: 'test2@example.fr' });
    await locataireRepo.enregistrer(loc2);
    const bail2 = unBailValide({ bienId: bien2.id, locataireId: loc2.id, lotIds: [lot2.id] });
    await bailRepo.enregistrer(bail2);

    // bail2 sans activité → false
    expect(await detector.aDeLActivite(bail2.id)).toBe(false);

    // bailId a une échéance → true
    expect(await detector.aDeLActivite(bailId)).toBe(true);
  });
});
