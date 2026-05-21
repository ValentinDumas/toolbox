/**
 * Tests unitaires — Use case exporterCsvFiscal (D-FIS-G5.3).
 *
 * RED phase : tests écrits avant l'implémentation.
 *
 * Format CSV attendu :
 *   - UTF-8 BOM (﻿) en début de fichier (Excel-friendly)
 *   - Séparateur ";" (point-virgule — convention française)
 *   - Colonnes : Type;Montant en euros;Détail
 *   - Nom fichier : declaration-fiscale-{exercice}.csv
 *
 * Sources :
 *   - D-FIS-G5.3 : export CSV expert-comptable
 *   - T-05-07-04 : CSV injection mitigation (valeurs via Money.enEuros — Intl.NumberFormat)
 *   - RFC 6266 : Content-Disposition filename*=UTF-8''
 */

import { describe, it, expect, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import { Money } from '../../../src/domain/_shared/money.js';
import type { BailleurId, DeclarationAnnuelleId } from '../../../src/domain/_shared/identifiants.js';
import { DeclarationAnnuelle } from '../../../src/domain/fiscalite/declaration-annuelle.js';
import type { DeclarationAnnuelleRepository } from '../../../src/domain/fiscalite/declaration-annuelle-repository.js';
import { exporterCsvFiscal, DeclarationIntrouvable } from '../../../src/application/fiscalite/exporter-csv-fiscal.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';

const BAILLEUR_ID = crypto.randomUUID() as BailleurId;
const DECL_ID = crypto.randomUUID() as DeclarationAnnuelleId;

function uneDeclMicroBic(): DeclarationAnnuelle {
  return DeclarationAnnuelle.creer({
    id: DECL_ID,
    bailleurId: BAILLEUR_ID,
    exercice: 2026,
    regimeApplique: 'micro_bic',
    recettesTotales: Money.fromEuros(50_000),
    chargesQualifieesParCategorie: {
      entretien_reparation: Money.zero(),
      amelioration: Money.zero(),
      charge_courante_periodique: Money.zero(),
      non_deductible: Money.zero(),
      non_qualifie: Money.zero(),
    },
    dotationAmortissement: Money.zero(),
    ardGenere: Money.zero(),
    ardConsomme: Money.zero(),
    revenusFoyerSnapshot: Money.fromEuros(40_000),
    statutLmnpLmp: 'lmnp_confirme',
    composantsSnapshot: '[]',
    clotureLe: Temporal.PlainDate.from('2026-12-31'),
    seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
  });
}

function uneDeclReel(): DeclarationAnnuelle {
  return DeclarationAnnuelle.creer({
    id: DECL_ID,
    bailleurId: BAILLEUR_ID,
    exercice: 2026,
    regimeApplique: 'reel',
    recettesTotales: Money.fromEuros(100_000),
    chargesQualifieesParCategorie: {
      entretien_reparation: Money.fromEuros(5_000),
      amelioration: Money.fromEuros(8_000),
      charge_courante_periodique: Money.fromEuros(2_000),
      non_deductible: Money.fromEuros(1_000),
      non_qualifie: Money.zero(),
    },
    dotationAmortissement: Money.fromEuros(10_000),
    ardGenere: Money.fromEuros(2_000),
    ardConsomme: Money.zero(),
    revenusFoyerSnapshot: Money.fromEuros(80_000),
    statutLmnpLmp: 'lmp_probable',
    composantsSnapshot: '[{"type":"gros_oeuvre"}]',
    clotureLe: Temporal.PlainDate.from('2026-12-31'),
    seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
  });
}

function makeDeclRepo(decl: DeclarationAnnuelle | null): DeclarationAnnuelleRepository {
  return {
    enregistrer: vi.fn(),
    trouverParId: vi.fn().mockResolvedValue(decl),
    trouverParBailleurExercice: vi.fn(),
    listerParBailleur: vi.fn(),
  };
}

describe('exporterCsvFiscal — use case (D-FIS-G5.3)', () => {
  it('Test 1 : déclaration introuvable → throw DeclarationIntrouvable', async () => {
    const repo = makeDeclRepo(null);

    await expect(
      exporterCsvFiscal({ declarationId: DECL_ID }, { declRepo: repo }),
    ).rejects.toThrow(DeclarationIntrouvable);
  });

  it('Test 2 : déclaration micro-BIC 50k → CSV contient ligne Recettes et régime micro_bic', async () => {
    const decl = uneDeclMicroBic();
    const repo = makeDeclRepo(decl);

    const { contenu, nomFichier } = await exporterCsvFiscal(
      { declarationId: DECL_ID },
      { declRepo: repo },
    );

    // UTF-8 BOM en tête
    expect(contenu.startsWith('﻿')).toBe(true);
    // Ligne header
    expect(contenu).toContain('Type;Montant en euros;Détail');
    // Ligne recettes
    expect(contenu).toContain('Recettes annuelles;');
    // Régime micro_bic mentionné
    expect(contenu).toContain('micro_bic');
    // Nom fichier correct
    expect(nomFichier).toBe('declaration-fiscale-2026.csv');
  });

  it('Test 3 : déclaration réel 100k → CSV contient toutes les colonnes + UTF-8 BOM', async () => {
    const decl = uneDeclReel();
    const repo = makeDeclRepo(decl);

    const { contenu, nomFichier } = await exporterCsvFiscal(
      { declarationId: DECL_ID },
      { declRepo: repo },
    );

    // UTF-8 BOM
    expect(contenu.startsWith('﻿')).toBe(true);
    // Colonnes attendues
    expect(contenu).toContain('Recettes annuelles;');
    expect(contenu).toContain('Charges entretien');
    expect(contenu).toContain('Dotation amortissement;');
    expect(contenu).toContain('ARD généré;');
    expect(contenu).toContain('Résultat fiscal;');
    expect(contenu).toContain('Statut LMNP/LMP;');
    // Régime réel mentionné
    expect(contenu).toContain('reel');
    // Nom fichier
    expect(nomFichier).toBe('declaration-fiscale-2026.csv');
  });
});
