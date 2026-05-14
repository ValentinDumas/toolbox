import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { Money } from '../../../src/domain/_shared/money.js';
import type { BailId } from '../../../src/domain/_shared/identifiants.js';
import { unBailValide } from '../../_builders/locatif.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import { unLocataireValide } from '../../_builders/locatif.js';

// NOTE: Ces imports n'existent pas encore — tests RED intentionnellement
import { EcheanceLoyerRepositorySqlite } from '../../../src/infrastructure/repositories/echeance-loyer-repository-sqlite.js';
import { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { ActiviteBailDetectorSqlite } from '../../../src/infrastructure/repositories/activite-bail-detector-sqlite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('EcheanceLoyerRepositorySqlite', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let echeanceRepo: EcheanceLoyerRepositorySqlite;
  let bailRepo: BailRepositorySqlite;
  let bienRepo: BienRepositorySqlite;
  let locataireRepo: LocataireRepositorySqlite;
  let bailId: BailId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    echeanceRepo = new EcheanceLoyerRepositorySqlite(db);
    bailRepo = new BailRepositorySqlite(db);
    bienRepo = new BienRepositorySqlite(db);
    locataireRepo = new LocataireRepositorySqlite(db);

    // Créer dépendances en base
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
    bailId = bail.id;
  });

  afterEach(async () => {
    await db.destroy();
  });

  function creerEcheance(overrides: { periodeDebut?: string; statut?: 'en_attente' | 'partiellement_payee' | 'payee' | 'annulee' } = {}): EcheanceLoyer {
    const periodeDebut = Temporal.PlainDate.from(overrides.periodeDebut ?? '2026-05-01');
    const periodeFin = periodeDebut.with({ day: periodeDebut.daysInMonth });
    const loyerHc = Money.fromEuros(620);
    const montantCharges = Money.fromEuros(80);
    return EcheanceLoyer.creer({
      bailId,
      periodeDebut,
      periodeFin,
      jourEcheanceAttendue: periodeDebut.with({ day: 5 }),
      loyerHc,
      montantCharges,
      modeCharges: 'forfait',
      total: loyerHc.additionner(montantCharges),
      statut: overrides.statut ?? 'en_attente',
      annuleLe: null,
    });
  }

  // Test 16 : enregistrerBatch → listerParBail en ordre périodeDebut ASC
  it('enregistrerBatch puis listerParBail retourne en ordre ASC périodeDebut', async () => {
    const e1 = creerEcheance({ periodeDebut: '2026-05-01' });
    const e2 = creerEcheance({ periodeDebut: '2026-06-01' });
    const e3 = creerEcheance({ periodeDebut: '2026-07-01' });

    await echeanceRepo.enregistrerBatch([e1, e2, e3]);

    const retrouvees = await echeanceRepo.listerParBail(bailId);
    expect(retrouvees).toHaveLength(3);
    expect(retrouvees[0]!.periodeDebut.toString()).toBe('2026-05-01');
    expect(retrouvees[1]!.periodeDebut.toString()).toBe('2026-06-01');
    expect(retrouvees[2]!.periodeDebut.toString()).toBe('2026-07-01');
  });

  // Test 17 : mettreAJourStatut modifie le statut sans toucher aux autres champs
  it('mettreAJourStatut : modifie statut, autres champs intacts (roundtrip)', async () => {
    const e = creerEcheance();
    await echeanceRepo.enregistrerBatch([e]);

    await echeanceRepo.mettreAJourStatut(e.id, 'payee');

    const retrouvee = await echeanceRepo.trouverParId(e.id);
    expect(retrouvee).not.toBeNull();
    expect(retrouvee!.statut).toBe('payee');
    expect(retrouvee!.loyerHc.toCentimes()).toBe(Money.fromEuros(620).toCentimes());
    expect(retrouvee!.montantCharges.toCentimes()).toBe(Money.fromEuros(80).toCentimes());
    expect(retrouvee!.periodeDebut.toString()).toBe('2026-05-01');
  });

  // Test ActiviteBailDetector : extension avec echeance_loyer
  it('ActiviteBailDetectorSqlite.aDeLActivite retourne true si echeance existe pour bail', async () => {
    const detector = new ActiviteBailDetectorSqlite(db);

    // Avant insertion : pas d'activité
    expect(await detector.aDeLActivite(bailId)).toBe(false);

    // Après insertion
    const e = creerEcheance();
    await echeanceRepo.enregistrerBatch([e]);

    expect(await detector.aDeLActivite(bailId)).toBe(true);
  });

  it('ActiviteBailDetectorSqlite.aDeLActivite retourne false pour bail sans echeance', async () => {
    const detector = new ActiviteBailDetectorSqlite(db);
    // Créer un autre bail sans écheances
    const lot2 = unLotValide({ designation: 'Appt 2' });
    const bien2 = unBienValide({ lots: [lot2] });
    await bienRepo.enregistrer(bien2);
    const locataire2 = unLocataireValide({ email: 'autre@example.fr' });
    await locataireRepo.enregistrer(locataire2);
    const bail2 = unBailValide({ bienId: bien2.id, locataireId: locataire2.id, lotIds: [lot2.id] });
    await bailRepo.enregistrer(bail2);

    // bail2 n'a pas d'écheances
    expect(await detector.aDeLActivite(bail2.id)).toBe(false);

    // bailId a une écheance
    await echeanceRepo.enregistrerBatch([creerEcheance()]);
    expect(await detector.aDeLActivite(bailId)).toBe(true);
    expect(await detector.aDeLActivite(bail2.id)).toBe(false);
  });

  // T10: listerNonPayees — filtre statut ∈ {en_attente, partiellement_payee}, exclut payee + annulee
  it('T10: listerNonPayees retourne uniquement les échéances en_attente et partiellement_payee, ordonnées par jour_echeance_attendue ASC', async () => {
    // 4 échéances : 1 payee, 1 annulee, 1 en_attente, 1 partiellement_payee
    const ePayee = creerEcheance({ periodeDebut: '2026-01-01', statut: 'payee' });
    const eAnnulee = creerEcheance({ periodeDebut: '2026-02-01', statut: 'annulee' });

    // en_attente — jour_echeance_attendue = periodeDebut.with({day:5})
    const eEnAttente = EcheanceLoyer.creer({
      bailId,
      periodeDebut: Temporal.PlainDate.from('2026-04-01'),
      periodeFin: Temporal.PlainDate.from('2026-04-30'),
      jourEcheanceAttendue: Temporal.PlainDate.from('2026-04-05'),
      loyerHc: Money.fromEuros(620),
      montantCharges: Money.fromEuros(80),
      modeCharges: 'forfait',
      total: Money.fromEuros(700),
      statut: 'en_attente',
      annuleLe: null,
    });

    const ePartiellementPayee = EcheanceLoyer.creer({
      bailId,
      periodeDebut: Temporal.PlainDate.from('2026-03-01'),
      periodeFin: Temporal.PlainDate.from('2026-03-31'),
      jourEcheanceAttendue: Temporal.PlainDate.from('2026-03-05'),
      loyerHc: Money.fromEuros(620),
      montantCharges: Money.fromEuros(80),
      modeCharges: 'forfait',
      total: Money.fromEuros(700),
      statut: 'partiellement_payee',
      annuleLe: null,
    });

    await echeanceRepo.enregistrerBatch([ePayee, eAnnulee, eEnAttente, ePartiellementPayee]);

    const nonPayees = await echeanceRepo.listerNonPayees();

    expect(nonPayees).toHaveLength(2);
    // Ordonnées par jour_echeance_attendue ASC : mars (2026-03-05) avant avril (2026-04-05)
    expect(nonPayees[0]!.statut).toBe('partiellement_payee');
    expect(nonPayees[1]!.statut).toBe('en_attente');
    // Vérifier que payee et annulee sont exclus
    const statuts = nonPayees.map((e) => e.statut);
    expect(statuts).not.toContain('payee');
    expect(statuts).not.toContain('annulee');
  });
});
