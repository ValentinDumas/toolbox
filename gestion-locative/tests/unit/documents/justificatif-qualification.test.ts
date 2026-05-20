import { Temporal } from '@js-temporal/polyfill';
import { describe, it, expect } from 'vitest';
import { Justificatif } from '../../../src/domain/documents/justificatif.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import { ComposantsSommeIncoherente } from '../../../src/domain/fiscalite/erreurs.js';
import type { BienId, JustificatifId, CheminRelatif } from '../../../src/domain/_shared/identifiants.js';

/**
 * Tests TDD — extension Justificatif pour la qualification fiscale (D-FIS-G2.1 à G2.11).
 *
 * Sources juridiques :
 *   - D-FIS-G2.4 : montantTtc obligatoire si qualification ∈ {entretien_reparation, amelioration, charge_courante_periodique}
 *   - D-FIS-G2.11 : anneeFiscale() privilégie datePaiement (fallback dateDocument)
 *   - D-FIS-G2.6 : decomposerEnEnfants — invariant Σ = parent
 */

const TODAY = Temporal.PlainDate.from('2026-05-20');
const BIEN_ID = crypto.randomUUID() as BienId;

function unJustificatifAvecTtc(overrides: Partial<{ montantTtc: Money | null; datePaiement: Temporal.PlainDate | null }> = {}): Justificatif {
  return Justificatif.creer({
    type: 'facture',
    dateDocument: Temporal.PlainDate.from('2025-12-30'),
    titre: 'Facture entretien chaudière',
    montantTtc: overrides.montantTtc !== undefined ? overrides.montantTtc : Money.fromEuros(500),
    cheminFichier: 'factures/2025/facture-chaudiere.pdf' as CheminRelatif,
    nomFichierOriginal: 'facture-chaudiere.pdf',
    mimeType: 'application/pdf',
    tailleOctets: 50_000,
    bienId: BIEN_ID,
    locataireId: null,
    notes: null,
    creeLe: TODAY,
    datePaiement: overrides.datePaiement !== undefined ? overrides.datePaiement : null,
  });
}

describe('Justificatif.qualifier', () => {
  it('qualification entretien_reparation avec montantTtc OK', () => {
    const j = unJustificatifAvecTtc();
    const jQualifie = j.qualifier('entretien_reparation', TODAY);
    expect(jQualifie.qualificationFiscale).toBe('entretien_reparation');
    expect(jQualifie.qualifieLe?.toString()).toBe('2026-05-20');
  });

  it('qualification entretien_reparation sans montantTtc lève InvariantViolated (D-FIS-G2.4)', () => {
    const j = unJustificatifAvecTtc({ montantTtc: null });
    expect(() => j.qualifier('entretien_reparation', TODAY)).toThrow(InvariantViolated);
  });

  it('qualification amelioration sans montantTtc lève InvariantViolated (D-FIS-G2.4)', () => {
    const j = unJustificatifAvecTtc({ montantTtc: null });
    expect(() => j.qualifier('amelioration', TODAY)).toThrow(InvariantViolated);
  });

  it('qualification charge_courante_periodique sans montantTtc lève InvariantViolated (D-FIS-G2.4)', () => {
    const j = unJustificatifAvecTtc({ montantTtc: null });
    expect(() => j.qualifier('charge_courante_periodique', TODAY)).toThrow(InvariantViolated);
  });

  it('qualification non_deductible sans montantTtc est autorisée (D-FIS-G2.4)', () => {
    const j = unJustificatifAvecTtc({ montantTtc: null });
    const jQualifie = j.qualifier('non_deductible', TODAY);
    expect(jQualifie.qualificationFiscale).toBe('non_deductible');
  });
});

describe('Justificatif.anneeFiscale', () => {
  it('prend la datePaiement si renseignée (D-FIS-G2.11)', () => {
    const j = unJustificatifAvecTtc({ datePaiement: Temporal.PlainDate.from('2026-03-15') });
    expect(j.anneeFiscale()).toBe(2026);
  });

  it('fallback dateDocument si datePaiement null (D-FIS-G2.11)', () => {
    const j = unJustificatifAvecTtc({ datePaiement: null });
    // dateDocument = 2025-12-30
    expect(j.anneeFiscale()).toBe(2025);
  });

  it('datePaiement 2026 et dateDocument 2025 → retourne 2026', () => {
    const j = unJustificatifAvecTtc({ datePaiement: Temporal.PlainDate.from('2026-03-15') });
    expect(j.anneeFiscale()).toBe(2026);
  });
});

describe('Justificatif.decomposerEnEnfants', () => {
  it('Σ enfants = parent → retourne N enfants avec parentJustificatifId', () => {
    const parent = unJustificatifAvecTtc({ montantTtc: Money.fromEuros(1000) });
    const autresBienId = crypto.randomUUID() as BienId;
    const enfants = parent.decomposerEnEnfants([
      { bienId: BIEN_ID, montantTtc: Money.fromEuros(600), titre: 'Part bien A' },
      { bienId: autresBienId, montantTtc: Money.fromEuros(400), titre: 'Part bien B' },
    ]);
    expect(enfants).toHaveLength(2);
    expect(enfants[0].parentJustificatifId).toBe(parent.id);
    expect(enfants[1].parentJustificatifId).toBe(parent.id);
    expect(enfants[0].bienId).toBe(BIEN_ID);
    expect(enfants[1].bienId).toBe(autresBienId);
  });

  it('Σ enfants ≠ parent → lève ComposantsSommeIncoherente (D-FIS-G2.6)', () => {
    const parent = unJustificatifAvecTtc({ montantTtc: Money.fromEuros(1000) });
    expect(() =>
      parent.decomposerEnEnfants([
        { bienId: BIEN_ID, montantTtc: Money.fromEuros(600), titre: 'Part A' },
        { bienId: BIEN_ID, montantTtc: Money.fromEuros(300), titre: 'Part B' }, // 600+300=900 ≠ 1000
      ])
    ).toThrow(ComposantsSommeIncoherente);
  });

  it('parent sans montantTtc → lève InvariantViolated (impossible de décomposer)', () => {
    const parent = unJustificatifAvecTtc({ montantTtc: null });
    expect(() =>
      parent.decomposerEnEnfants([
        { bienId: BIEN_ID, montantTtc: Money.fromEuros(500), titre: 'Part A' },
      ])
    ).toThrow(InvariantViolated);
  });
});
