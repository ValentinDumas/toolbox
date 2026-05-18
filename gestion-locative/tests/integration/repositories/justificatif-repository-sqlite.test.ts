import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { Temporal } from '@js-temporal/polyfill';
import { Kysely, SqliteDialect } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  BienId,
  LocataireId,
} from '../../../src/domain/_shared/identifiants.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { Justificatif } from '../../../src/domain/documents/justificatif.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { JustificatifRepositorySqlite } from '../../../src/infrastructure/repositories/justificatif-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import {
  unJustificatifAvecBienSeul,
  unJustificatifAvecLocataireSeul,
  unJustificatifEnCorbeille,
  unJustificatifValide,
} from '../../_builders/documents.js';
import { unLocataireValide } from '../../_builders/locatif.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('JustificatifRepositorySqlite', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let repo: JustificatifRepositorySqlite;
  let bienId: BienId;
  let locataireId: LocataireId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

    repo = new JustificatifRepositorySqlite(db);

    const bienRepo = new BienRepositorySqlite(db);
    const lot = unLotValide({ designation: 'T2 test' });
    const bien = unBienValide({ lots: [lot] });
    await bienRepo.enregistrer(bien);
    bienId = bien.id;

    const locataireRepo = new LocataireRepositorySqlite(db);
    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);
    locataireId = locataire.id;
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('roundtrip enregistrer + trouverParId avec rattachement bien seul', async () => {
    const j = Justificatif.creer(
      unJustificatifAvecBienSeul({
        bienId,
        montantTtc: Money.fromEuros(450),
      }),
    );

    await repo.enregistrer(j);
    const retrouve = await repo.trouverParId(j.id);

    expect(retrouve).not.toBeNull();
    expect(retrouve!.id).toBe(j.id);
    expect(retrouve!.bienId).toBe(bienId);
    expect(retrouve!.locataireId).toBeNull();
    expect(retrouve!.montantTtc?.enEuros()).toBe(Money.fromEuros(450).enEuros());
    expect(retrouve!.mimeType).toBe('application/pdf');
  });

  it('roundtrip enregistrer + trouverParId avec rattachement locataire seul', async () => {
    const j = Justificatif.creer(
      unJustificatifAvecLocataireSeul({ locataireId }),
    );
    await repo.enregistrer(j);
    const r = await repo.trouverParId(j.id);
    expect(r!.bienId).toBeNull();
    expect(r!.locataireId).toBe(locataireId);
  });

  it('roundtrip avec rattachement bien ET locataire', async () => {
    const j = Justificatif.creer(
      unJustificatifValide({ bienId, locataireId }),
    );
    await repo.enregistrer(j);
    const r = await repo.trouverParId(j.id);
    expect(r!.bienId).toBe(bienId);
    expect(r!.locataireId).toBe(locataireId);
  });

  it('rechercher LIKE case-insensitive sur titre', async () => {
    const j1 = Justificatif.creer(
      unJustificatifAvecBienSeul({ bienId, titre: 'Facture EDF mai' }),
    );
    const j2 = Justificatif.creer(
      unJustificatifAvecBienSeul({ bienId, titre: 'Quittance loyer' }),
    );
    await repo.enregistrer(j1);
    await repo.enregistrer(j2);

    const result = await repo.rechercher({ search: 'edf' });
    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(j1.id);
  });

  it('rechercher LIKE sur notes', async () => {
    const j = Justificatif.creer(
      unJustificatifAvecBienSeul({
        bienId,
        titre: 'Document neutre',
        notes: 'Ne contient pas le mot recherché — clavier-magique',
      }),
    );
    await repo.enregistrer(j);

    const result = await repo.rechercher({ search: 'magique' });
    expect(result.items.length).toBe(1);
  });

  it('rechercher LIKE sur nom_fichier_original', async () => {
    const j = Justificatif.creer(
      unJustificatifAvecBienSeul({
        bienId,
        titre: 'titre quelconque',
        nomFichierOriginal: 'releve-banque-mai-2026.pdf',
      }),
    );
    await repo.enregistrer(j);

    const result = await repo.rechercher({ search: 'releve-banque' });
    expect(result.items.length).toBe(1);
  });

  it('rechercher filtre bienId', async () => {
    const j1 = Justificatif.creer(unJustificatifAvecBienSeul({ bienId }));
    const j2 = Justificatif.creer(
      unJustificatifAvecLocataireSeul({ locataireId }),
    );
    await repo.enregistrer(j1);
    await repo.enregistrer(j2);

    const result = await repo.rechercher({ bienId });
    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(j1.id);
  });

  it('rechercher filtre anneeFiscale (substr date_document)', async () => {
    const j2025 = Justificatif.creer(
      unJustificatifAvecBienSeul({
        bienId,
        dateDocument: Temporal.PlainDate.from('2025-12-31'),
      }),
    );
    const j2026 = Justificatif.creer(
      unJustificatifAvecBienSeul({
        bienId,
        dateDocument: Temporal.PlainDate.from('2026-01-15'),
      }),
    );
    await repo.enregistrer(j2025);
    await repo.enregistrer(j2026);

    const result = await repo.rechercher({ anneeFiscale: 2025 });
    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(j2025.id);
  });

  it('rechercher avec typeIn future-proof D-120', async () => {
    const facture = Justificatif.creer(
      unJustificatifAvecBienSeul({ bienId, type: 'facture' }),
    );
    const piece = Justificatif.creer(
      unJustificatifAvecLocataireSeul({ locataireId, type: 'piece_locataire' }),
    );
    const releve = Justificatif.creer(
      unJustificatifAvecBienSeul({ bienId, type: 'releve_bancaire' }),
    );
    await repo.enregistrer(facture);
    await repo.enregistrer(piece);
    await repo.enregistrer(releve);

    const result = await repo.rechercher({
      typeIn: ['piece_locataire', 'releve_bancaire', 'attestation', 'autre'],
    });
    expect(result.total).toBe(2);
    const ids = result.items.map((i) => i.id).sort();
    expect(ids).toEqual([piece.id, releve.id].sort());
  });

  it('rechercher pagination page=1 size=5 sur 7 items → 5 items + total=7', async () => {
    for (let i = 0; i < 7; i++) {
      const j = Justificatif.creer(
        unJustificatifAvecBienSeul({
          bienId,
          titre: `Doc ${String(i).padStart(2, '0')}`,
          dateDocument: Temporal.PlainDate.from('2026-01-01').add({ days: i }),
        }),
      );
      await repo.enregistrer(j);
    }
    const r1 = await repo.rechercher({ page: 1, pageSize: 5 });
    expect(r1.total).toBe(7);
    expect(r1.items.length).toBe(5);
    const r2 = await repo.rechercher({ page: 2, pageSize: 5 });
    expect(r2.items.length).toBe(2);
  });

  it('upsert onConflict(id) sur soft-delete : enregistrer 2× change corbeille_le sans dupliquer', async () => {
    const j = Justificatif.creer(unJustificatifAvecBienSeul({ bienId }));
    await repo.enregistrer(j);

    const enCorbeille = j.mettreEnCorbeille(
      'Doublon',
      Temporal.PlainDate.from('2026-05-15'),
    );
    await repo.enregistrer(enCorbeille);

    const tousActifsEtCorbeille = await repo.rechercher({
      inclureCorbeille: true,
    });
    expect(tousActifsEtCorbeille.total).toBe(1);

    const r = await repo.trouverParId(j.id);
    expect(r!.corbeilleLe).not.toBeNull();
    expect(r!.raisonCorbeille).toBe('Doublon');
  });

  it('rechercher par défaut exclut la corbeille (inclureCorbeille=false)', async () => {
    const actif = Justificatif.creer(unJustificatifAvecBienSeul({ bienId }));
    await repo.enregistrer(actif);
    await repo.enregistrer(
      Justificatif.creer(unJustificatifEnCorbeille({ bienId })),
    );

    const r = await repo.rechercher({});
    expect(r.total).toBe(1);
    expect(r.items[0]?.id).toBe(actif.id);
  });

  it('listerCorbeille retourne uniquement corbeille_le ≠ null', async () => {
    await repo.enregistrer(
      Justificatif.creer(unJustificatifAvecBienSeul({ bienId })),
    );
    const c = Justificatif.creer(unJustificatifEnCorbeille({ bienId }));
    await repo.enregistrer(c);

    const corbeille = await repo.listerCorbeille();
    expect(corbeille.length).toBe(1);
    expect(corbeille[0]?.id).toBe(c.id);
  });

  it('supprimerDefinitivement hard-delete la row', async () => {
    const j = Justificatif.creer(unJustificatifAvecBienSeul({ bienId }));
    await repo.enregistrer(j);
    await repo.supprimerDefinitivement(j.id);

    const r = await repo.trouverParId(j.id);
    expect(r).toBeNull();
  });

  // ───────── Wave 2 extras: filtres facettés combinés + pagination + filtres locataire ─────────

  it('rechercher LIKE case-insensitive sur titre (3 assertions séparées)', async () => {
    const j1 = Justificatif.creer(
      unJustificatifAvecBienSeul({
        bienId,
        titre: 'Facture peinture salon',
      }),
    );
    const j2 = Justificatif.creer(
      unJustificatifAvecBienSeul({
        bienId,
        titre: 'Bail signé locataire X',
      }),
    );
    const j3 = Justificatif.creer(
      unJustificatifAvecBienSeul({
        bienId,
        titre: 'Diagnostic gaz',
      }),
    );
    await repo.enregistrer(j1);
    await repo.enregistrer(j2);
    await repo.enregistrer(j3);

    // 1. Recherche minuscule matche titre capitalisé
    const r1 = await repo.rechercher({ search: 'peinture' });
    expect(r1.total).toBe(1);
    expect(r1.items[0]?.id).toBe(j1.id);

    // 2. Recherche partielle au milieu du titre
    const r2 = await repo.rechercher({ search: 'gaz' });
    expect(r2.total).toBe(1);
    expect(r2.items[0]?.id).toBe(j3.id);

    // 3. Pattern qui ne matche rien
    const r3 = await repo.rechercher({ search: 'inexistant' });
    expect(r3.total).toBe(0);
  });

  it('rechercher filtres facettés combinés (bien + type)', async () => {
    const facture = Justificatif.creer(
      unJustificatifAvecBienSeul({ bienId, type: 'facture' }),
    );
    const piece = Justificatif.creer(
      unJustificatifAvecBienSeul({ bienId, type: 'piece_locataire' }),
    );
    const autreBienFacture = Justificatif.creer(
      unJustificatifAvecLocataireSeul({ locataireId, type: 'facture' }),
    );
    await repo.enregistrer(facture);
    await repo.enregistrer(piece);
    await repo.enregistrer(autreBienFacture);

    const r = await repo.rechercher({ bienId, type: 'facture' });
    expect(r.total).toBe(1);
    expect(r.items[0]?.id).toBe(facture.id);
  });

  it('rechercher filtres facettés combinés (bien + locataire + type)', async () => {
    const j1 = Justificatif.creer(
      unJustificatifValide({ bienId, locataireId, type: 'facture' }),
    );
    const j2 = Justificatif.creer(
      unJustificatifAvecBienSeul({ bienId, type: 'facture' }),
    );
    await repo.enregistrer(j1);
    await repo.enregistrer(j2);

    const r = await repo.rechercher({ bienId, locataireId, type: 'facture' });
    expect(r.total).toBe(1);
    expect(r.items[0]?.id).toBe(j1.id);
  });

  it('rechercher pagination 25 items → page=1 size=20 → 20 items + total=25', async () => {
    for (let i = 0; i < 25; i++) {
      const num = String(i + 1).padStart(3, '0');
      const j = Justificatif.creer(
        unJustificatifAvecBienSeul({
          bienId,
          titre: `Document ${num}`,
          dateDocument: Temporal.PlainDate.from('2026-01-01').add({ days: i }),
        }),
      );
      await repo.enregistrer(j);
    }
    const r1 = await repo.rechercher({ page: 1, pageSize: 20 });
    expect(r1.total).toBe(25);
    expect(r1.items.length).toBe(20);

    const r2 = await repo.rechercher({ page: 2, pageSize: 20 });
    expect(r2.total).toBe(25);
    expect(r2.items.length).toBe(5);
  });

  it('listerCorbeille retourne ORDER BY corbeille_le DESC', async () => {
    const j1 = Justificatif.creer(
      unJustificatifEnCorbeille({
        bienId,
        corbeilleLe: Temporal.PlainDate.from('2026-05-10'),
        titre: 'Plus ancien',
      }),
    );
    const j2 = Justificatif.creer(
      unJustificatifEnCorbeille({
        bienId,
        corbeilleLe: Temporal.PlainDate.from('2026-05-15'),
        titre: 'Plus récent',
      }),
    );
    await repo.enregistrer(j1);
    await repo.enregistrer(j2);

    const liste = await repo.listerCorbeille();
    expect(liste.length).toBe(2);
    expect(liste[0]?.titre).toBe('Plus récent');
    expect(liste[1]?.titre).toBe('Plus ancien');
  });

  it('rechercher avec pageSize=5 sur 7 justificatifs (cas fiche Bien)', async () => {
    for (let i = 0; i < 7; i++) {
      const num = String(i + 1).padStart(3, '0');
      const j = Justificatif.creer(
        unJustificatifAvecBienSeul({
          bienId,
          titre: `Document ${num}`,
          dateDocument: Temporal.PlainDate.from('2026-01-01').add({ days: i }),
        }),
      );
      await repo.enregistrer(j);
    }
    const r = await repo.rechercher({ bienId, pageSize: 5, page: 1 });
    expect(r.total).toBe(7);
    expect(r.items.length).toBe(5);
    // Le plus récent en premier (date_document DESC) — Document 007
    expect(r.items[0]?.titre).toBe('Document 007');
  });

  it('rechercher filtre typeIn limite la liste aux 4 types D-120', async () => {
    const facture = Justificatif.creer(
      unJustificatifAvecLocataireSeul({ locataireId, type: 'facture' }),
    );
    const piece = Justificatif.creer(
      unJustificatifAvecLocataireSeul({ locataireId, type: 'piece_locataire' }),
    );
    const releve = Justificatif.creer(
      unJustificatifAvecLocataireSeul({ locataireId, type: 'releve_bancaire' }),
    );
    const attestation = Justificatif.creer(
      unJustificatifAvecLocataireSeul({ locataireId, type: 'attestation' }),
    );
    const autre = Justificatif.creer(
      unJustificatifAvecLocataireSeul({ locataireId, type: 'autre' }),
    );
    await repo.enregistrer(facture);
    await repo.enregistrer(piece);
    await repo.enregistrer(releve);
    await repo.enregistrer(attestation);
    await repo.enregistrer(autre);

    const r = await repo.rechercher({
      locataireId,
      typeIn: ['piece_locataire', 'releve_bancaire', 'attestation', 'autre'],
    });
    expect(r.total).toBe(4);
    const ids = r.items.map((i) => i.id).sort();
    expect(ids).toEqual(
      [piece.id, releve.id, attestation.id, autre.id].sort(),
    );
  });
});
