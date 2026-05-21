/**
 * Step definitions @fis-declaration-corrigee : Déclaration corrigée post-clôture.
 *
 * Réutilise le même DB in-memory pattern que fiscalite-cloture.steps.ts.
 * Les scénarios @fis-declaration-corrigee dépendent du Background @fis-cloture
 * (bailleur singleton + bien + système prêt) — les steps Given/When communs
 * sont définis dans fiscalite-cloture.steps.ts et réutilisés ici.
 *
 * Sources :
 *   D-FIS-G4.4 — append-only strict, originale intouchée
 *   T-05-06-09 — creer-declaration-corrigee NE modifie PAS l'originale
 */

import { When, Then, World } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { Kysely } from 'kysely';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import type { BailleurId, DeclarationAnnuelleId, DeclarationCorrigeeId } from '../../../src/domain/_shared/identifiants.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';

import { creerDeclarationCorrigee } from '../../../src/application/fiscalite/creer-declaration-corrigee.js';
import { DeclarationAnnuelleRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-annuelle-repository-sqlite.js';
import { DeclarationCorrigeeRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-corrigee-repository-sqlite.js';

// ─── World extension ──────────────────────────────────────────────────────────
// Ces steps s'exécutent dans le même World que fiscalite-cloture.steps.ts
// (Cucumber partage le World entre tous les step files pour le même scénario).

interface MondeCorrectionPartiel extends World {
  db: Kysely<DB> | null;
  bailleurId: BailleurId | null;
  derniereDeclarationId: DeclarationAnnuelleId | null;
  derniereErreur: Error | null;
  derniereCorrectionId: DeclarationCorrigeeId | null;
  [key: string]: unknown;
}

// ─── When correction ──────────────────────────────────────────────────────────

When(
  /^une correction est créée sur la déclaration (\d{4}) avec recettes ([\d ]+) €$/,
  async function (this: MondeCorrectionPartiel, _exerciceStr: string, recettesStr: string) {
    const recettesEuros = parseInt(recettesStr.replace(/\s/g, ''), 10);
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.derniereDeclarationId, 'Aucune déclaration créée — clôturez d\'abord');

    const declRepo = new DeclarationAnnuelleRepositorySqlite(this.db);
    const declCorrRepo = new DeclarationCorrigeeRepositorySqlite(this.db);

    const corrId = await creerDeclarationCorrigee(
      {
        declarationOriginaleId: this.derniereDeclarationId,
        motif: 'Correction recettes pour test BDD',
        corrections: { recettesTotalesEuros: recettesEuros },
      },
      { declRepo, declCorrRepo },
      this.db,
    );
    this.derniereCorrectionId = corrId;
  },
);

When(
  /^une correction sans motif est tentée sur la déclaration (\d{4})$/,
  async function (this: MondeCorrectionPartiel, _exerciceStr: string) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.derniereDeclarationId, 'Aucune déclaration créée — clôturez d\'abord');

    const declRepo = new DeclarationAnnuelleRepositorySqlite(this.db);
    const declCorrRepo = new DeclarationCorrigeeRepositorySqlite(this.db);

    try {
      await creerDeclarationCorrigee(
        {
          declarationOriginaleId: this.derniereDeclarationId,
          motif: '',
          corrections: {},
        },
        { declRepo, declCorrRepo },
        this.db,
      );
    } catch (err) {
      this.derniereErreur = err as Error;
    }
  },
);

// ─── Then vérifications correction ───────────────────────────────────────────

Then(
  /^la correction a des recettes_totales de ([\d ]+) centimes$/,
  async function (this: MondeCorrectionPartiel, centimesStr: string) {
    const centimesAttendus = parseInt(centimesStr.replace(/\s/g, ''), 10);
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.derniereCorrectionId, 'Aucune correction créée');

    const corr = await this.db
      .selectFrom('declarations_corrigees')
      .select('recettes_totales_centimes')
      .where('id', '=', this.derniereCorrectionId)
      .executeTakeFirst();

    assert.ok(corr, 'Correction introuvable en DB');
    assert.strictEqual(
      Number(corr.recettes_totales_centimes),
      centimesAttendus,
      `Recettes correction attendues : ${centimesAttendus} centimes, obtenu : ${corr.recettes_totales_centimes}`,
    );
  },
);

Then(
  'la correction est refusée pour motif manquant',
  function (this: MondeCorrectionPartiel) {
    assert.ok(
      this.derniereErreur instanceof InvariantViolated,
      `Exception attendue : InvariantViolated (motif vide), obtenu : ${this.derniereErreur?.constructor?.name ?? 'aucune'}`,
    );
  },
);
