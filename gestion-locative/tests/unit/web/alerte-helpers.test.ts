/**
 * Tests unitaires — alerte-helpers.ts (Phase 7 / DAS-01 / DAS-02 / 07-07-PLAN).
 *
 * Couvre les 3 fonctions pures :
 *   - libelleTypeAlerte : mapping type+extra → libellé français (WR-02 correction élec)
 *   - formaterAlerteUrgence : libellé WCAG jours restants
 *   - iconeTypeAlerte : icône Unicode par type
 *
 * Pattern miroir : tests/unit/fiscalite/alerte-cfe-j30.test.ts
 */

import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import {
  libelleTypeAlerte,
  formaterAlerteUrgence,
  iconeTypeAlerte,
} from '../../../src/web/helpers/alerte-helpers.js';
import type { Alerte } from '../../../src/domain/_shared/alerte.js';

const DATE_REF = Temporal.PlainDate.from('2026-06-12');

function alerteDiagnostic(typeDiagnostic?: string): Alerte {
  return {
    type: 'diagnostic',
    joursRestants: 15,
    dateEcheance: DATE_REF.add({ days: 15 }),
    libelle: 'Diagnostic',
    urlAction: '/biens/xxx',
    source: {
      type: 'diagnostic',
      refId: 'diag-001',
      extra: typeDiagnostic !== undefined ? { typeDiagnostic } : undefined,
    },
  };
}

function alerteFinBail(nomLocataire?: string): Alerte {
  return {
    type: 'fin_bail',
    joursRestants: 20,
    dateEcheance: DATE_REF.add({ days: 20 }),
    libelle: 'Fin de bail',
    urlAction: '/baux/xxx',
    source: {
      type: 'fin_bail',
      refId: 'bail-001',
      extra: nomLocataire !== undefined ? { nomLocataire } : undefined,
    },
  };
}

function alerteCfe(millesime?: number): Alerte {
  return {
    type: 'cfe',
    joursRestants: 30,
    dateEcheance: DATE_REF.add({ days: 30 }),
    libelle: 'CFE',
    urlAction: '/fiscalite/cfe',
    source: {
      type: 'cfe',
      refId: 'cfe-001',
      extra: millesime !== undefined ? { millesime } : undefined,
    },
  };
}

function alerteIrl(): Alerte {
  return {
    type: 'irl',
    joursRestants: 10,
    dateEcheance: DATE_REF.add({ days: 10 }),
    libelle: 'Révision IRL',
    urlAction: '/baux/xxx/indexer',
    source: {
      type: 'irl',
      refId: 'bail-001',
    },
  };
}

// ─── libelleTypeAlerte ───────────────────────────────────────────────────────

describe('libelleTypeAlerte — diagnostics', () => {
  it("typeDiagnostic 'elec' → 'Électricité' (WR-02 correction)", () => {
    expect(libelleTypeAlerte(alerteDiagnostic('elec'))).toBe('Électricité');
  });

  it("typeDiagnostic 'dpe' → 'DPE'", () => {
    expect(libelleTypeAlerte(alerteDiagnostic('dpe'))).toBe('DPE');
  });

  it("typeDiagnostic 'gaz' → 'Gaz'", () => {
    expect(libelleTypeAlerte(alerteDiagnostic('gaz'))).toBe('Gaz');
  });

  it("typeDiagnostic 'erp' → fallback 'Diagnostic'", () => {
    expect(libelleTypeAlerte(alerteDiagnostic('erp'))).toBe('Diagnostic');
  });

  it('typeDiagnostic absent → fallback Diagnostic', () => {
    expect(libelleTypeAlerte(alerteDiagnostic())).toBe('Diagnostic');
  });
});

describe('libelleTypeAlerte — fin_bail', () => {
  it("nomLocataire 'Marie Curie' → 'Fin de bail — Marie Curie'", () => {
    expect(libelleTypeAlerte(alerteFinBail('Marie Curie'))).toBe('Fin de bail — Marie Curie');
  });

  it('nomLocataire absent → Fin de bail (simple)', () => {
    expect(libelleTypeAlerte(alerteFinBail())).toBe('Fin de bail');
  });

  it('nomLocataire chaîne vide → Fin de bail (simple)', () => {
    expect(libelleTypeAlerte(alerteFinBail(''))).toBe('Fin de bail');
  });
});

describe('libelleTypeAlerte — cfe', () => {
  it('millesime 2026 → CFE 2026', () => {
    expect(libelleTypeAlerte(alerteCfe(2026))).toBe('CFE 2026');
  });

  it('millesime absent → CFE', () => {
    expect(libelleTypeAlerte(alerteCfe())).toBe('CFE');
  });
});

describe('libelleTypeAlerte — irl', () => {
  it("type 'irl' → 'Révision IRL'", () => {
    expect(libelleTypeAlerte(alerteIrl())).toBe('Révision IRL');
  });
});

// ─── formaterAlerteUrgence ───────────────────────────────────────────────────

describe('formaterAlerteUrgence', () => {
  it('j = -2 → "Échéance dépassée depuis 2 jours"', () => {
    const alerte = { ...alerteIrl(), joursRestants: -2 };
    expect(formaterAlerteUrgence(alerte)).toBe('Échéance dépassée depuis 2 jours');
  });

  it('j = -1 → "Échéance dépassée depuis 1 jour"', () => {
    const alerte = { ...alerteIrl(), joursRestants: -1 };
    expect(formaterAlerteUrgence(alerte)).toBe('Échéance dépassée depuis 1 jour');
  });

  it("j = 0 → \"Échéance aujourd'hui\"", () => {
    const alerte = { ...alerteIrl(), joursRestants: 0 };
    expect(formaterAlerteUrgence(alerte)).toBe("Échéance aujourd'hui");
  });

  it('j = 1 → "Échéance dans 1 jour"', () => {
    const alerte = { ...alerteIrl(), joursRestants: 1 };
    expect(formaterAlerteUrgence(alerte)).toBe('Échéance dans 1 jour');
  });

  it('j = 5 → "Échéance dans 5 jours"', () => {
    const alerte = { ...alerteIrl(), joursRestants: 5 };
    expect(formaterAlerteUrgence(alerte)).toBe('Échéance dans 5 jours');
  });
});

// ─── iconeTypeAlerte ─────────────────────────────────────────────────────────

describe('iconeTypeAlerte', () => {
  it("cfe → '€'", () => expect(iconeTypeAlerte('cfe')).toBe('€'));
  it("irl → '%'", () => expect(iconeTypeAlerte('irl')).toBe('%'));
  it("diagnostic → '⚠'", () => expect(iconeTypeAlerte('diagnostic')).toBe('⚠'));
  it("fin_bail → '⏰'", () => expect(iconeTypeAlerte('fin_bail')).toBe('⏰'));
});
