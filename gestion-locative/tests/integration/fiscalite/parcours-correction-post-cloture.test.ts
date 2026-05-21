/**
 * Tests d'intégration — Correction post-clôture append-only (Plan 08).
 *
 * Couverture plan 05-08 must_have :
 *   - DeclarationCorrigee créée SANS modifier l'originale (D-FIS-G4.4)
 *   - N corrections successives → N lignes, originale toujours intacte
 *
 * DB in-memory SQLite + migrations complètes (pattern cloturer-exercice.test.ts).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { cloturerExercice } from '../../../src/application/fiscalite/cloturer-exercice.js';
import { creerDeclarationCorrigee } from '../../../src/application/fiscalite/creer-declaration-corrigee.js';
import { BailleurRepositorySqlite } from '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { RecettesRepositorySqlite } from '../../../src/infrastructure/repositories/recettes-repository-sqlite.js';
import { ChargesRepositorySqlite } from '../../../src/infrastructure/repositories/charges-repository-sqlite.js';
import { ComposantRepositorySqlite, ValorisationFiscaleRepositorySqlite } from '../../../src/infrastructure/repositories/composant-repository-sqlite.js';
import { TableauAmortissementRepositorySqlite } from '../../../src/infrastructure/repositories/tableau-amortissement-repository-sqlite.js';
import { JustificatifRepositorySqlite } from '../../../src/infrastructure/repositories/justificatif-repository-sqlite.js';
import { TicketTravauxRepositorySqlite } from '../../../src/infrastructure/repositories/ticket-travaux-repository-sqlite.js';
import { DeclarationAnnuelleRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-annuelle-repository-sqlite.js';
import { DeclarationCorrigeeRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-corrigee-repository-sqlite.js';
import { RegleFiscaleProviderEnMemoire } from '../../../src/domain/fiscalite/regles/regle-fiscale-provider.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { unBailleurValide } from '../../_builders/identite.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import type { BailleurId, BienId, DeclarationAnnuelleId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');
const EXERCICE = 2026;
const TODAY = Temporal.PlainDate.from('2026-12-31');

function makeClock(date = TODAY) {
  return { aujourdhui: () => date };
}

describe('parcours-correction-post-cloture — append-only strict', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let bailleurId: BailleurId;
  let bienId: BienId;
  let bailleurRepo: BailleurRepositorySqlite;
  let declRepo: DeclarationAnnuelleRepositorySqlite;
  let declCorrRepo: DeclarationCorrigeeRepositorySqlite;
  let regleFiscale: RegleFiscaleProviderEnMemoire;
  let bailId: string;
  let declarationId: DeclarationAnnuelleId;

  function makeRepos() {
    return {
      bailleurRepo,
      recettesRepo: new RecettesRepositorySqlite(db),
      chargesRepo: new ChargesRepositorySqlite(db),
      composantRepo: new ComposantRepositorySqlite(db),
      valorisationRepo: new ValorisationFiscaleRepositorySqlite(db),
      declRepo,
      tableauAmortRepo: new TableauAmortissementRepositorySqlite(db),
      justificatifRepo: new JustificatifRepositorySqlite(db),
      ticketRepo: new TicketTravauxRepositorySqlite(db),
      bienRepo: new BienRepositorySqlite(db),
    };
  }

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

    bailleurRepo = new BailleurRepositorySqlite(db);
    declRepo = new DeclarationAnnuelleRepositorySqlite(db);
    declCorrRepo = new DeclarationCorrigeeRepositorySqlite(db);
    regleFiscale = new RegleFiscaleProviderEnMemoire();

    // Bailleur avec revenus foyer (60k > 48k recettes → LMNP confirmé)
    const bailleur = unBailleurValide().modifier({
      revenusActifsAnnuelsCourant: Money.fromEuros(60_000),
    });
    await bailleurRepo.enregistrer(bailleur);
    bailleurId = bailleur.id;

    // Bien
    const bien = unBienValide();
    await new BienRepositorySqlite(db).enregistrer(bien);
    bienId = bien.id;

    // Locataire + bail + 12 écheances + 12 encaissements = 48 000 € recettes
    const locataireId = crypto.randomUUID();
    await db.insertInto('locataire').values({
      id: locataireId, nom: 'Dupont', prenom: 'Alice', date_naissance: '1985-03-15',
      commune_naissance: 'Lyon', pays_naissance: 'France', nationalite: 'française',
      email: 'alice@example.fr', telephone: null, rue: '5 av Test', code_postal: '69001',
      ville: 'Lyon', supprime_le: null,
    }).execute();

    bailId = crypto.randomUUID();
    await db.insertInto('bail').values({
      id: bailId, locataire_id: locataireId, bien_id: bienId, type: 'meuble',
      date_debut: `${EXERCICE}-01-01`, duree_mois: 12, loyer_hc: 400_000,
      mode_charges: 'forfait', montant_charges: 0, depot_garantie: 800_000,
      irl_trimestre: '2024-T4', irl_valeur: '142.06', cautionnement: null,
      actif_depuis: `${EXERCICE}-01-01`, jour_echeance: 1, mobilier: null, supprime_le: null,
    }).execute();

    // 12 échéances + 12 encaissements de 4 000 €
    for (let mois = 1; mois <= 12; mois++) {
      const echeanceId = crypto.randomUUID();
      const moisStr = String(mois).padStart(2, '0');
      const lastDay = new Date(EXERCICE, mois, 0).getDate();
      await db.insertInto('echeance_loyer').values({
        id: echeanceId, bail_id: bailId,
        periode_debut: `${EXERCICE}-${moisStr}-01`,
        periode_fin: `${EXERCICE}-${moisStr}-${lastDay}`,
        jour_echeance_attendue: `${EXERCICE}-${moisStr}-01`,
        loyer_hc: 400_000, montant_charges: 0, mode_charges: 'forfait',
        total: 400_000, statut: 'payee', annule_le: null,
      }).execute();

      await db.insertInto('encaissement').values({
        id: crypto.randomUUID(), echeance_id: echeanceId,
        montant_centimes: 400_000, date: `${EXERCICE}-${moisStr}-01`,
        mode: 'virement', annule_le: null, raison_annulation: null,
      }).execute();
    }

    // Clôture initiale (parcours complet) → declarationId
    const repos = makeRepos();
    const resultat = await cloturerExercice(
      { bailleurId, exercice: EXERCICE },
      repos,
      makeClock(),
      regleFiscale,
      db,
    );
    declarationId = resultat.declarationId;
  });

  afterEach(async () => {
    await db.destroy();
    sqlite.close();
  });

  it('Correction post-clôture : originale INTACTE après 1 correction', async () => {
    // Capturer snapshot de l'originale avant correction
    const declOriginale = await declRepo.trouverParId(declarationId);
    expect(declOriginale).not.toBeNull();
    const recettesOriginales = declOriginale!.recettesTotales.centimes;
    const regimeOriginal = declOriginale!.regimeApplique;
    const verdictOriginal = declOriginale!.statutLmnpLmp;
    const clotureleOriginal = declOriginale!.clotureLe.toString();

    // Créer une correction (recettes corrigées : 50 000 €)
    await creerDeclarationCorrigee(
      {
        declarationOriginaleId: declarationId,
        motif: 'Justificatif TF oublié',
        corrections: { recettesTotalesEuros: 50_000 },
      },
      { declRepo, declCorrRepo },
      db,
    );

    // Vérifier que l'originale est INCHANGÉE
    const declApresCorrection = await declRepo.trouverParId(declarationId);
    expect(declApresCorrection).not.toBeNull();
    expect(declApresCorrection!.recettesTotales.centimes).toBe(recettesOriginales);
    expect(declApresCorrection!.regimeApplique).toBe(regimeOriginal);
    expect(declApresCorrection!.statutLmnpLmp).toBe(verdictOriginal);
    expect(declApresCorrection!.clotureLe.toString()).toBe(clotureleOriginal);

    // Vérifier que la correction est persistée avec les bonnes valeurs
    const corrections = await declCorrRepo.listerParDeclarationOriginale(declarationId);
    expect(corrections).toHaveLength(1);
    expect(corrections[0].recettesTotales.centimes).toBe(5_000_000n); // 50 000 €
    expect(corrections[0].declarationOriginaleId).toBe(declarationId);
    expect(corrections[0].motif).toBe('Justificatif TF oublié');
  });

  it('N corrections successives : 3 corrections → 3 lignes, originale toujours intacte', async () => {
    // Capturer snapshot de l'originale
    const declOriginale = await declRepo.trouverParId(declarationId);
    const recettesOriginales = declOriginale!.recettesTotales.centimes;

    // 3 corrections successives avec des montants et motifs distincts
    const motifs = [
      { motif: 'Correction 1 — loyer manquant', recettes: 50_000 },
      { motif: 'Correction 2 — charge oubliée', recettes: 49_000 },
      { motif: 'Correction 3 — TF rectifiée', recettes: 48_500 },
    ];

    for (const { motif, recettes } of motifs) {
      await creerDeclarationCorrigee(
        {
          declarationOriginaleId: declarationId,
          motif,
          corrections: { recettesTotalesEuros: recettes },
        },
        { declRepo, declCorrRepo },
        db,
      );
    }

    // 3 corrections enregistrées
    const corrections = await declCorrRepo.listerParDeclarationOriginale(declarationId);
    expect(corrections).toHaveLength(3);

    // Toutes les corrections pointent vers l'originale
    for (const corr of corrections) {
      expect(corr.declarationOriginaleId).toBe(declarationId);
    }

    // Motifs des 3 corrections présents
    const motifsObtenus = corrections.map((c) => c.motif);
    expect(motifsObtenus).toContain('Correction 1 — loyer manquant');
    expect(motifsObtenus).toContain('Correction 2 — charge oubliée');
    expect(motifsObtenus).toContain('Correction 3 — TF rectifiée');

    // Originale TOUJOURS intacte
    const declFinal = await declRepo.trouverParId(declarationId);
    expect(declFinal!.recettesTotales.centimes).toBe(recettesOriginales);
  });
});
