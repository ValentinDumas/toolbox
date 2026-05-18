import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Temporal } from '@js-temporal/polyfill';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listerCorbeille } from '../../../src/application/documents/lister-corbeille.js';
import { listerJustificatifsParBien } from '../../../src/application/documents/lister-justificatifs-par-bien.js';
import {
  TYPES_AUTORISES_LOCATAIRE,
  listerJustificatifsParLocataire,
} from '../../../src/application/documents/lister-justificatifs-par-locataire.js';
import { modifierJustificatif } from '../../../src/application/documents/modifier-justificatif.js';
import { rechercherJustificatifs } from '../../../src/application/documents/rechercher-justificatifs.js';
import { restaurerJustificatif } from '../../../src/application/documents/restaurer-justificatif.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import type {
  BienId,
  LocataireId,
} from '../../../src/domain/_shared/identifiants.js';
import { Money } from '../../../src/domain/_shared/money.js';
import {
  DocumentNonEnCorbeille,
  JustificatifIntrouvable,
} from '../../../src/domain/documents/erreurs.js';
import { Justificatif } from '../../../src/domain/documents/justificatif.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { JustificatifRepositorySqlite } from '../../../src/infrastructure/repositories/justificatif-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import {
  unJustificatifAvecBienSeul,
  unJustificatifAvecLocataireSeul,
  unJustificatifEnCorbeille,
} from '../../_builders/documents.js';
import { unLocataireValide } from '../../_builders/locatif.js';
import { unBienValide } from '../../_builders/patrimoine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('Use cases Documents Wave 2', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let repo: JustificatifRepositorySqlite;
  let bienId: BienId;
  let locataireId: LocataireId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    repo = new JustificatifRepositorySqlite(db);

    const bienRepo = new BienRepositorySqlite(db);
    const bien = unBienValide();
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

  describe('rechercherJustificatifs', () => {
    it('retourne items + total + page + pageSize', async () => {
      const j = Justificatif.creer(unJustificatifAvecBienSeul({ bienId }));
      await repo.enregistrer(j);

      const r = await rechercherJustificatifs(
        { page: 1, pageSize: 10 },
        { justificatifRepo: repo },
      );
      expect(r.items.length).toBe(1);
      expect(r.total).toBe(1);
      expect(r.page).toBe(1);
      expect(r.pageSize).toBe(10);
    });

    it('valide page ≥ 1', async () => {
      await expect(
        rechercherJustificatifs({ page: 0 }, { justificatifRepo: repo }),
      ).rejects.toThrow(InvariantViolated);
    });

    it('valide pageSize ∈ [1, 100]', async () => {
      await expect(
        rechercherJustificatifs(
          { pageSize: 0 },
          { justificatifRepo: repo },
        ),
      ).rejects.toThrow(InvariantViolated);

      await expect(
        rechercherJustificatifs(
          { pageSize: 101 },
          { justificatifRepo: repo },
        ),
      ).rejects.toThrow(InvariantViolated);
    });

    it('utilise pageSize=20 par défaut', async () => {
      const r = await rechercherJustificatifs(
        {},
        { justificatifRepo: repo },
      );
      expect(r.pageSize).toBe(20);
      expect(r.page).toBe(1);
    });
  });

  describe('listerCorbeille', () => {
    it('retourne uniquement les justificatifs soft-deleted', async () => {
      const actif = Justificatif.creer(unJustificatifAvecBienSeul({ bienId }));
      const enCorbeille = Justificatif.creer(
        unJustificatifEnCorbeille({ bienId }),
      );
      await repo.enregistrer(actif);
      await repo.enregistrer(enCorbeille);

      const liste = await listerCorbeille({}, { justificatifRepo: repo });
      expect(liste.length).toBe(1);
      expect(liste[0]?.id).toBe(enCorbeille.id);
    });
  });

  describe('restaurerJustificatif', () => {
    it('remet corbeille_le=null sur un justificatif en corbeille', async () => {
      const j = Justificatif.creer(unJustificatifEnCorbeille({ bienId }));
      await repo.enregistrer(j);

      const { justificatif } = await restaurerJustificatif(
        { id: j.id },
        { justificatifRepo: repo },
      );
      expect(justificatif.corbeilleLe).toBeNull();
      expect(justificatif.raisonCorbeille).toBeNull();

      const reloaded = await repo.trouverParId(j.id);
      expect(reloaded?.corbeilleLe).toBeNull();
    });

    it("throw JustificatifIntrouvable si l'id n'existe pas", async () => {
      await expect(
        restaurerJustificatif(
          { id: 'idinconnu' },
          { justificatifRepo: repo },
        ),
      ).rejects.toThrow(JustificatifIntrouvable);
    });

    it("throw DocumentNonEnCorbeille si pas en corbeille", async () => {
      const j = Justificatif.creer(unJustificatifAvecBienSeul({ bienId }));
      await repo.enregistrer(j);

      await expect(
        restaurerJustificatif({ id: j.id }, { justificatifRepo: repo }),
      ).rejects.toThrow(DocumentNonEnCorbeille);
    });
  });

  describe('modifierJustificatif', () => {
    it('patch metadata (titre, notes, montant) sans toucher au fichier', async () => {
      const j = Justificatif.creer(
        unJustificatifAvecBienSeul({
          bienId,
          titre: 'Avant',
          notes: null,
          montantTtc: null,
        }),
      );
      await repo.enregistrer(j);

      const { justificatif: modifie } = await modifierJustificatif(
        {
          id: j.id,
          patch: {
            titre: 'Après',
            notes: 'Nouvelles notes',
            montantTtc: Money.fromEuros(150),
          },
        },
        { justificatifRepo: repo },
      );

      expect(modifie.titre).toBe('Après');
      expect(modifie.notes).toBe('Nouvelles notes');
      expect(modifie.montantTtc?.toSqliteInteger()).toBe(15_000);
      // Champs immuables préservés
      expect(modifie.cheminFichier).toBe(j.cheminFichier);
      expect(modifie.mimeType).toBe(j.mimeType);
      expect(modifie.tailleOctets).toBe(j.tailleOctets);
      expect(modifie.nomFichierOriginal).toBe(j.nomFichierOriginal);
      expect(modifie.creeLe.equals(j.creeLe)).toBe(true);
    });

    it("throw JustificatifIntrouvable si l'id n'existe pas", async () => {
      await expect(
        modifierJustificatif(
          { id: 'idinconnu', patch: { titre: 'X' } },
          { justificatifRepo: repo },
        ),
      ).rejects.toThrow(JustificatifIntrouvable);
    });
  });

  describe('listerJustificatifsParBien', () => {
    it('retourne 5 derniers par défaut + total', async () => {
      for (let i = 0; i < 7; i++) {
        const j = Justificatif.creer(
          unJustificatifAvecBienSeul({
            bienId,
            titre: `Doc ${i}`,
            dateDocument: Temporal.PlainDate.from('2026-01-01').add({
              days: i,
            }),
          }),
        );
        await repo.enregistrer(j);
      }
      const r = await listerJustificatifsParBien(
        { bienId },
        { justificatifRepo: repo },
      );
      expect(r.total).toBe(7);
      expect(r.items.length).toBe(5);
      // Plus récent en premier (date_document DESC)
      expect(r.items[0]?.titre).toBe('Doc 6');
    });
  });

  describe('listerJustificatifsParLocataire', () => {
    it('TYPES_AUTORISES_LOCATAIRE contient exactement 4 types D-120', () => {
      expect(TYPES_AUTORISES_LOCATAIRE).toEqual([
        'piece_locataire',
        'releve_bancaire',
        'attestation',
        'autre',
      ]);
    });

    it('filtre par type autorisé', async () => {
      const piece = Justificatif.creer(
        unJustificatifAvecLocataireSeul({
          locataireId,
          type: 'piece_locataire',
        }),
      );
      const releve = Justificatif.creer(
        unJustificatifAvecLocataireSeul({
          locataireId,
          type: 'releve_bancaire',
        }),
      );
      await repo.enregistrer(piece);
      await repo.enregistrer(releve);

      const r = await listerJustificatifsParLocataire(
        { locataireId, type: 'piece_locataire' },
        { justificatifRepo: repo },
      );
      expect(r.total).toBe(1);
      expect(r.items[0]?.id).toBe(piece.id);
    });

    it("throw InvariantViolated si type non autorisé (D-120)", async () => {
      await expect(
        listerJustificatifsParLocataire(
          { locataireId, type: 'facture' },
          { justificatifRepo: repo },
        ),
      ).rejects.toThrow(InvariantViolated);
    });

    it('sans filtre type : limite aux 4 types autorisés via typeIn', async () => {
      const facture = Justificatif.creer(
        unJustificatifAvecLocataireSeul({ locataireId, type: 'facture' }),
      );
      const piece = Justificatif.creer(
        unJustificatifAvecLocataireSeul({
          locataireId,
          type: 'piece_locataire',
        }),
      );
      const releve = Justificatif.creer(
        unJustificatifAvecLocataireSeul({
          locataireId,
          type: 'releve_bancaire',
        }),
      );
      const attestation = Justificatif.creer(
        unJustificatifAvecLocataireSeul({
          locataireId,
          type: 'attestation',
        }),
      );
      const autre = Justificatif.creer(
        unJustificatifAvecLocataireSeul({ locataireId, type: 'autre' }),
      );
      await repo.enregistrer(facture);
      await repo.enregistrer(piece);
      await repo.enregistrer(releve);
      await repo.enregistrer(attestation);
      await repo.enregistrer(autre);

      const r = await listerJustificatifsParLocataire(
        { locataireId },
        { justificatifRepo: repo },
      );
      expect(r.total).toBe(4);
      const ids = r.items.map((i) => i.id).sort();
      expect(ids).toEqual(
        [piece.id, releve.id, attestation.id, autre.id].sort(),
      );
    });
  });
});
