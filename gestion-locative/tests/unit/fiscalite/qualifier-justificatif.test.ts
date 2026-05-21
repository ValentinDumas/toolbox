/**
 * Tests TDD — use case qualifierJustificatif (CRÉÉ Plan 06, retrofit D-FIS-G2.5).
 *
 * Couverture :
 *   Test 1 : justificatif introuvable → throw JustificatifIntrouvable
 *   Test 2 : exercice clôturé → throw DeclarationFigeeException (D-FIS-G2.5)
 *   Test 3 : pas de déclaration → qualifie OK + justificatifRepo.enregistrer appelé
 *   Test 4 : anneeFiscale basée sur datePaiement (priorité sur dateDocument — D-FIS-G2.11)
 */

import { Temporal } from '@js-temporal/polyfill';
import { describe, it, expect, vi } from 'vitest';
import { qualifierJustificatif } from '../../../src/application/fiscalite/qualifier-justificatif.js';
import { listerJustificatifsNonQualifies } from '../../../src/application/fiscalite/lister-justificatifs-non-qualifies.js';
import { JustificatifIntrouvable } from '../../../src/domain/documents/erreurs.js';
import { DeclarationFigeeException } from '../../../src/domain/fiscalite/erreurs.js';
import type { BailleurId, JustificatifId } from '../../../src/domain/_shared/identifiants.js';
import { unJustificatifNonQualifie } from '../../_builders/fiscalite.js';
import { unBailleurValide } from '../../_builders/identite.js';

const TODAY = Temporal.PlainDate.from('2026-05-20');
const BAILLEUR_ID = crypto.randomUUID() as BailleurId;

function makeClock() {
  return { aujourdhui: () => TODAY };
}

describe('qualifierJustificatif', () => {
  it('Test 1 : justificatif introuvable → throw JustificatifIntrouvable', async () => {
    const repos = {
      justificatifRepo: { trouverParId: vi.fn().mockResolvedValue(null), enregistrer: vi.fn() },
      declRepo: { trouverParBailleurExercice: vi.fn() },
      bailleurRepo: { trouver: vi.fn() },
    };

    await expect(
      qualifierJustificatif(
        { justificatifId: 'jus-inexistant' as JustificatifId, qualification: 'entretien_reparation' },
        repos as never,
        makeClock(),
      ),
    ).rejects.toThrow(JustificatifIntrouvable);

    expect(repos.declRepo.trouverParBailleurExercice).not.toHaveBeenCalled();
  });

  it('Test 1b : bailleur absent → throw BailleurAbsent (lignes 62-65)', async () => {
    const { BailleurAbsent } = await import('../../../src/domain/identite/erreurs.js');
    const justificatif = unJustificatifNonQualifie({ dateDocument: Temporal.PlainDate.from('2026-03-01') });

    const repos = {
      justificatifRepo: { trouverParId: vi.fn().mockResolvedValue(justificatif), enregistrer: vi.fn() },
      declRepo: { trouverParBailleurExercice: vi.fn() },
      bailleurRepo: { trouver: vi.fn().mockResolvedValue(null) },
    };

    await expect(
      qualifierJustificatif(
        { justificatifId: justificatif.id as JustificatifId, qualification: 'entretien_reparation' },
        repos as never,
        makeClock(),
      ),
    ).rejects.toThrow(BailleurAbsent);

    expect(repos.declRepo.trouverParBailleurExercice).not.toHaveBeenCalled();
  });

  it('Test 2 : exercice clôturé → throw DeclarationFigeeException', async () => {
    const bailleur = { ...unBailleurValide(), id: BAILLEUR_ID };
    const justificatif = unJustificatifNonQualifie({
      dateDocument: Temporal.PlainDate.from('2026-03-01'),
    });
    const fakeDecl = { id: 'decl-123', exercice: 2026, clotureLe: Temporal.PlainDate.from('2026-12-31') };

    const repos = {
      justificatifRepo: { trouverParId: vi.fn().mockResolvedValue(justificatif), enregistrer: vi.fn() },
      declRepo: { trouverParBailleurExercice: vi.fn().mockResolvedValue(fakeDecl) },
      bailleurRepo: { trouver: vi.fn().mockResolvedValue(bailleur) },
    };

    await expect(
      qualifierJustificatif(
        { justificatifId: justificatif.id as JustificatifId, qualification: 'entretien_reparation' },
        repos as never,
        makeClock(),
      ),
    ).rejects.toThrow(DeclarationFigeeException);

    // Aucune écriture si figée
    expect(repos.justificatifRepo.enregistrer).not.toHaveBeenCalled();
  });

  it('Test 3 : pas de déclaration → qualifie OK + justificatifRepo.enregistrer appelé', async () => {
    const bailleur = { ...unBailleurValide(), id: BAILLEUR_ID };
    const justificatif = unJustificatifNonQualifie({
      dateDocument: Temporal.PlainDate.from('2026-03-01'),
    });

    const repos = {
      justificatifRepo: { trouverParId: vi.fn().mockResolvedValue(justificatif), enregistrer: vi.fn() },
      declRepo: { trouverParBailleurExercice: vi.fn().mockResolvedValue(null) },
      bailleurRepo: { trouver: vi.fn().mockResolvedValue(bailleur) },
    };

    await qualifierJustificatif(
      { justificatifId: justificatif.id as JustificatifId, qualification: 'entretien_reparation' },
      repos as never,
      makeClock(),
    );

    expect(repos.justificatifRepo.enregistrer).toHaveBeenCalledOnce();
    // Vérifie que la qualification est passée à l'entité qualifiée
    const [qualifie] = repos.justificatifRepo.enregistrer.mock.calls[0] as [{ qualificationFiscale: string }];
    expect(qualifie.qualificationFiscale).toBe('entretien_reparation');
  });

  it('Test 4 : datePaiement 2026 prioritaire sur dateDocument 2025 → check figée pour 2026', async () => {
    const bailleur = { ...unBailleurValide(), id: BAILLEUR_ID };
    // dateDocument = 2025, datePaiement = 2026 → exercice = 2026 (D-FIS-G2.11)
    const justificatif = unJustificatifNonQualifie({
      dateDocument: Temporal.PlainDate.from('2025-12-15'),
      datePaiement: Temporal.PlainDate.from('2026-01-05'),
    });

    const repos = {
      justificatifRepo: { trouverParId: vi.fn().mockResolvedValue(justificatif), enregistrer: vi.fn() },
      declRepo: { trouverParBailleurExercice: vi.fn().mockResolvedValue(null) },
      bailleurRepo: { trouver: vi.fn().mockResolvedValue(bailleur) },
    };

    await qualifierJustificatif(
      { justificatifId: justificatif.id as JustificatifId, qualification: 'charge_courante_periodique' },
      repos as never,
      makeClock(),
    );

    // Vérifie que le check figée est fait sur exercice 2026 (datePaiement.year)
    expect(repos.declRepo.trouverParBailleurExercice).toHaveBeenCalledWith(BAILLEUR_ID, 2026);
  });
});

// ─── Couverture : listerJustificatifsNonQualifies (fichier 100% non couvert) ────

describe('listerJustificatifsNonQualifies — use case (D-FIS-G2.1)', () => {
  it('délègue au repo et retourne la liste brute (lignes 14-19)', async () => {
    const j1 = unJustificatifNonQualifie({ dateDocument: Temporal.PlainDate.from('2026-03-01') });
    const j2 = unJustificatifNonQualifie({ dateDocument: Temporal.PlainDate.from('2026-06-15') });

    const justificatifRepo = {
      listerNonQualifiesPourAnnee: vi.fn().mockResolvedValue([j1, j2]),
    };

    const result = await listerJustificatifsNonQualifies(
      { annee: 2026 },
      { justificatifRepo },
    );

    expect(result).toHaveLength(2);
    expect(justificatifRepo.listerNonQualifiesPourAnnee).toHaveBeenCalledWith(2026);
  });

  it('retourne liste vide si aucun non-qualifié', async () => {
    const justificatifRepo = {
      listerNonQualifiesPourAnnee: vi.fn().mockResolvedValue([]),
    };

    const result = await listerJustificatifsNonQualifies(
      { annee: 2026 },
      { justificatifRepo },
    );

    expect(result).toHaveLength(0);
  });
});
