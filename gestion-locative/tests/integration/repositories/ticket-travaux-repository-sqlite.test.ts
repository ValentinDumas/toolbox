import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { Temporal } from '@js-temporal/polyfill';
import { Kysely, SqliteDialect } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  BienId,
  CheminRelatif,
} from '../../../src/domain/_shared/identifiants.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { Justificatif } from '../../../src/domain/documents/justificatif.js';
import { TicketTravaux } from '../../../src/domain/travaux/ticket-travaux.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { JustificatifRepositorySqlite } from '../../../src/infrastructure/repositories/justificatif-repository-sqlite.js';
import { TicketTravauxRepositorySqlite } from '../../../src/infrastructure/repositories/ticket-travaux-repository-sqlite.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import {
  unTicketTravauxAnnule,
  unTicketTravauxClos,
  unTicketTravauxEnCours,
  unTicketTravauxValide,
} from '../../_builders/travaux.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');
const TODAY = Temporal.PlainDate.from('2026-05-18');

function uneJustificatifValide(opts: {
  bienId: BienId;
  titre: string;
  dateDocument?: Temporal.PlainDate;
}): Justificatif {
  return Justificatif.creer({
    type: 'facture',
    dateDocument: opts.dateDocument ?? Temporal.PlainDate.from('2026-05-15'),
    titre: opts.titre,
    montantTtc: null,
    cheminFichier:
      `documents/justificatifs/2026/${opts.titre.replace(/\s/g, '-')}.pdf` as CheminRelatif,
    nomFichierOriginal: `${opts.titre.replace(/\s/g, '-')}.pdf`,
    mimeType: 'application/pdf',
    tailleOctets: 1024,
    bienId: opts.bienId,
    locataireId: null,
    notes: null,
    creeLe: Temporal.PlainDate.from('2026-05-15'),
  });
}

describe('TicketTravauxRepositorySqlite', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let repo: TicketTravauxRepositorySqlite;
  let bienId: BienId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    repo = new TicketTravauxRepositorySqlite(db);

    const bienRepo = new BienRepositorySqlite(db);
    const lot = unLotValide({ designation: 'T2 travaux' });
    const bien = unBienValide({ lots: [lot] });
    await bienRepo.enregistrer(bien);
    bienId = bien.id;
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('roundtrip enregistrer + trouverParId (ticket simple ouvert)', async () => {
    const t = TicketTravaux.creer(
      unTicketTravauxValide({
        bienId,
        coutEstimeTtc: Money.fromEuros(1200),
      }),
      TODAY,
    );
    await repo.enregistrer(t);
    const r = await repo.trouverParId(t.id);
    expect(r).not.toBeNull();
    expect(r!.id).toBe(t.id);
    expect(r!.bienId).toBe(bienId);
    expect(r!.statut).toBe('ouvert');
    expect(r!.coutEstimeTtc?.enEuros()).toBe(Money.fromEuros(1200).enEuros());
    expect(r!.coutReelTtc).toBeNull();
    expect(r!.raisonAnnulation).toBeNull();
  });

  it('roundtrip enregistrer + trouverParId (ticket clos avec coût réel et date de clôture)', async () => {
    const t = TicketTravaux.creer(
      unTicketTravauxClos({
        bienId,
        coutReelTtc: Money.fromEuros(1250),
        dateCloture: Temporal.PlainDate.from('2026-06-01'),
      }),
      TODAY,
    );
    await repo.enregistrer(t);
    const r = await repo.trouverParId(t.id);
    expect(r!.statut).toBe('clos');
    expect(r!.dateCloture?.toString()).toBe('2026-06-01');
    expect(r!.coutReelTtc?.toCentimes()).toBe(125000n);
  });

  it('roundtrip enregistrer + trouverParId (ticket annulé avec raison)', async () => {
    const t = TicketTravaux.creer(
      unTicketTravauxAnnule({ bienId, raisonAnnulation: 'Plus pertinent' }),
      TODAY,
    );
    await repo.enregistrer(t);
    const r = await repo.trouverParId(t.id);
    expect(r!.statut).toBe('annule');
    expect(r!.annuleLe?.toString()).toBe('2026-05-10');
    expect(r!.raisonAnnulation).toBe('Plus pertinent');
  });

  it('upsert via onConflict id — change statut + dateCloture + coutReel sans dupliquer', async () => {
    const t = TicketTravaux.creer(unTicketTravauxValide({ bienId }), TODAY);
    await repo.enregistrer(t);
    // G-DATE-01 : dateCloture doit être <= today (2026-05-18)
    const clos = t.clore(
      Money.fromEuros(900),
      TODAY,
      TODAY,
    );
    await repo.enregistrer(clos);
    const rows = sqlite
      .prepare('SELECT id, statut FROM tickets_travaux WHERE id = ?')
      .all(t.id as string) as Array<{ id: string; statut: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.statut).toBe('clos');
  });

  it('listerParBien — par défaut exclut les tickets annulés', async () => {
    const ouvert = TicketTravaux.creer(
      unTicketTravauxValide({ bienId, titre: 'Ouvert' }),
      TODAY,
    );
    const annule = TicketTravaux.creer(
      unTicketTravauxAnnule({ bienId, titre: 'Annulé' }),
      TODAY,
    );
    await repo.enregistrer(ouvert);
    await repo.enregistrer(annule);
    const tickets = await repo.listerParBien(bienId);
    expect(tickets).toHaveLength(1);
    expect(tickets[0]?.titre).toBe('Ouvert');
  });

  it('listerParBien avec inclureAnnules=true → tous les tickets', async () => {
    const ouvert = TicketTravaux.creer(
      unTicketTravauxValide({ bienId, titre: 'Ouvert' }),
      TODAY,
    );
    const annule = TicketTravaux.creer(
      unTicketTravauxAnnule({ bienId, titre: 'Annulé' }),
      TODAY,
    );
    await repo.enregistrer(ouvert);
    await repo.enregistrer(annule);
    const tickets = await repo.listerParBien(bienId, { inclureAnnules: true });
    expect(tickets).toHaveLength(2);
  });

  it('listerParBien filtre par statuts ["ouvert", "en_cours"]', async () => {
    const ouvert = TicketTravaux.creer(
      unTicketTravauxValide({ bienId, titre: 'Ouvert' }),
      TODAY,
    );
    const enCours = TicketTravaux.creer(
      unTicketTravauxEnCours({ bienId, titre: 'En cours' }),
      TODAY,
    );
    const clos = TicketTravaux.creer(
      unTicketTravauxClos({ bienId, titre: 'Clos' }),
      TODAY,
    );
    await repo.enregistrer(ouvert);
    await repo.enregistrer(enCours);
    await repo.enregistrer(clos);
    const tickets = await repo.listerParBien(bienId, {
      statuts: ['ouvert', 'en_cours'],
    });
    expect(tickets).toHaveLength(2);
    const titres = tickets.map((t) => t.titre).sort();
    expect(titres).toEqual(['En cours', 'Ouvert']);
  });

  it('lierJustificatif → INSERT pivot (idempotent sur double appel)', async () => {
    const t = TicketTravaux.creer(unTicketTravauxValide({ bienId }), TODAY);
    await repo.enregistrer(t);
    const justifRepo = new JustificatifRepositorySqlite(db);
    const j = uneJustificatifValide({ bienId, titre: 'Devis 1' });
    await justifRepo.enregistrer(j);

    await repo.lierJustificatif(t.id, j.id);
    await repo.lierJustificatif(t.id, j.id); // idempotent
    const rows = sqlite
      .prepare('SELECT ticket_id, justificatif_id FROM ticket_justificatifs')
      .all() as Array<{ ticket_id: string; justificatif_id: string }>;
    expect(rows).toHaveLength(1);
  });

  it('delierJustificatif → DELETE pivot', async () => {
    const t = TicketTravaux.creer(unTicketTravauxValide({ bienId }), TODAY);
    await repo.enregistrer(t);
    const justifRepo = new JustificatifRepositorySqlite(db);
    const j = uneJustificatifValide({ bienId, titre: 'Devis 1' });
    await justifRepo.enregistrer(j);
    await repo.lierJustificatif(t.id, j.id);

    await repo.delierJustificatif(t.id, j.id);
    const rows = sqlite
      .prepare('SELECT ticket_id FROM ticket_justificatifs')
      .all();
    expect(rows).toHaveLength(0);
    // Le justificatif reste en base
    const justifRow = sqlite
      .prepare('SELECT id FROM justificatifs WHERE id = ?')
      .get(j.id as string);
    expect(justifRow).toBeDefined();
  });

  it('listerJustificatifsLies retourne JustificatifId[] triés par date_document DESC', async () => {
    const t = TicketTravaux.creer(unTicketTravauxValide({ bienId }), TODAY);
    await repo.enregistrer(t);
    const justifRepo = new JustificatifRepositorySqlite(db);
    const j1 = uneJustificatifValide({
      bienId,
      titre: 'Ancien',
      dateDocument: Temporal.PlainDate.from('2026-03-01'),
    });
    const j2 = uneJustificatifValide({
      bienId,
      titre: 'Recent',
      dateDocument: Temporal.PlainDate.from('2026-05-15'),
    });
    await justifRepo.enregistrer(j1);
    await justifRepo.enregistrer(j2);
    await repo.lierJustificatif(t.id, j1.id);
    await repo.lierJustificatif(t.id, j2.id);

    const ids = await repo.listerJustificatifsLies(t.id);
    expect(ids).toHaveLength(2);
    // j2 (recent) en premier
    expect(ids[0]).toBe(j2.id);
    expect(ids[1]).toBe(j1.id);
  });

  it('Cascade asymétrique D-113 — DELETE ticket supprime les rows pivot mais préserve les Justificatifs', async () => {
    const t = TicketTravaux.creer(unTicketTravauxValide({ bienId }), TODAY);
    await repo.enregistrer(t);
    const justifRepo = new JustificatifRepositorySqlite(db);
    const j1 = uneJustificatifValide({ bienId, titre: 'PJ1' });
    const j2 = uneJustificatifValide({ bienId, titre: 'PJ2' });
    await justifRepo.enregistrer(j1);
    await justifRepo.enregistrer(j2);
    await repo.lierJustificatif(t.id, j1.id);
    await repo.lierJustificatif(t.id, j2.id);

    // DELETE direct via SQL (simule un nettoyage admin)
    sqlite
      .prepare('DELETE FROM tickets_travaux WHERE id = ?')
      .run(t.id as string);

    const pivotRows = sqlite
      .prepare('SELECT ticket_id FROM ticket_justificatifs WHERE ticket_id = ?')
      .all(t.id as string);
    expect(pivotRows).toHaveLength(0);

    const justifRows = sqlite
      .prepare('SELECT id FROM justificatifs')
      .all() as Array<{ id: string }>;
    expect(justifRows).toHaveLength(2);
  });
});
