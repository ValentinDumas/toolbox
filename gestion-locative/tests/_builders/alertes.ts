/**
 * Builders Alerte unifié — Phase 7 / DAS-02 / 07-01 + 07-02 + 07-04.
 *
 * Pattern miroir tests/_builders/fiscalite.ts (fonction unX(overrides = {}) + spread).
 * Couvre les 4 types : cfe / irl / fin_bail / diagnostic (complet pour 07-05).
 */

import { Temporal } from '@js-temporal/polyfill';

import type { Alerte } from '../../src/domain/_shared/alerte.js';
import type { BienId } from '../../src/domain/_shared/identifiants.js';

const DEFAULT_BIEN_ID = '11111111-1111-4111-8111-111111111111' as BienId;
const DEFAULT_DECL_ID = '22222222-2222-4222-8222-222222222222';

/**
 * Builder Alerte unifié (D-AL-01).
 * Defaults : alerte CFE J-15, non déposée, millésime 2026.
 */
export function uneAlerte(overrides: Partial<Alerte> = {}): Alerte {
  return {
    type: 'cfe',
    joursRestants: 15,
    dateEcheance: Temporal.PlainDate.from('2026-12-15'),
    libelle: 'CFE 2026',
    urlAction: `/biens/${DEFAULT_BIEN_ID}/cfe/${DEFAULT_DECL_ID}/editer`,
    source: {
      type: 'cfe',
      refId: DEFAULT_DECL_ID,
      bienId: DEFAULT_BIEN_ID,
      extra: {
        millesime: 2026,
        statutCfe: 'non_deposee',
      },
    },
    ...overrides,
  };
}

/**
 * Alias sémantique de `uneAlerte` — signale l'intention de construire une alerte CFE.
 */
export function uneAlerteCfe(overrides: Partial<Alerte> = {}): Alerte {
  return uneAlerte(overrides);
}

const DEFAULT_DIAG_ID = '44444444-4444-4444-8444-444444444444';

const DEFAULT_BAIL_ID = '33333333-3333-4333-8333-333333333333';

/**
 * Builder Alerte IRL — Phase 7 / DAS-02 / 07-02.
 * Defaults : alerte IRL J-15, révision IRL, lien /baux/{bailId}/indexer.
 */
export function uneAlerteIrl(overrides: Partial<Alerte> = {}): Alerte {
  return {
    type: 'irl',
    joursRestants: 15,
    dateEcheance: Temporal.PlainDate.from('2026-07-01'),
    libelle: 'Révision IRL',
    urlAction: `/baux/${DEFAULT_BAIL_ID}/indexer`,
    source: {
      type: 'irl',
      refId: DEFAULT_BAIL_ID,
      bienId: DEFAULT_BIEN_ID,
    },
    ...overrides,
  };
}

/**
 * Builder Alerte fin de bail — Phase 7 / DAS-02 / 07-02.
 * Defaults : alerte fin de bail J-30, lien /baux/{bailId}.
 */
export function uneAlerteFinBail(overrides: Partial<Alerte> = {}): Alerte {
  return {
    type: 'fin_bail',
    joursRestants: 30,
    dateEcheance: Temporal.PlainDate.from('2026-08-01'),
    libelle: 'Fin de bail',
    urlAction: `/baux/${DEFAULT_BAIL_ID}`,
    source: {
      type: 'fin_bail',
      refId: DEFAULT_BAIL_ID,
      bienId: DEFAULT_BIEN_ID,
    },
    ...overrides,
  };
}

/**
 * Builder Alerte diagnostic — Phase 7 / DAS-02 / 07-04.
 * Defaults : alerte diagnostic DPE J-5, lien /biens/{bienId}#diagnostics-heading.
 */
export function uneAlerteDiagnostic(overrides: Partial<Alerte> = {}): Alerte {
  return {
    type: 'diagnostic',
    joursRestants: 5,
    dateEcheance: Temporal.PlainDate.from('2026-06-16'),
    libelle: 'Diagnostic DPE',
    urlAction: `/biens/${DEFAULT_BIEN_ID}#diagnostics-heading`,
    source: {
      type: 'diagnostic',
      refId: DEFAULT_DIAG_ID,
      bienId: DEFAULT_BIEN_ID,
      extra: { typeDiagnostic: 'dpe' },
    },
    ...overrides,
  };
}
