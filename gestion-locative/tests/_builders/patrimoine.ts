import { Temporal } from '@js-temporal/polyfill';
import { Bien, type TypeBien } from '../../src/domain/patrimoine/bien.js';
import { Lot, type TypeLot } from '../../src/domain/patrimoine/lot.js';
import { Diagnostic } from '../../src/domain/patrimoine/diagnostic.js';
import { Adresse } from '../../src/domain/_shared/adresse.js';
import type { ClasseDpe } from '../../src/domain/_shared/duree-validite-diagnostic.js';
import type { BienId, LotId } from '../../src/domain/_shared/identifiants.js';

interface OverridesLot {
  id?: LotId;
  designation?: string;
  surface?: number | null;
  type?: TypeLot;
  etage?: number | null;
}

interface OverridesBien {
  id?: BienId;
  rue?: string;
  codePostal?: string;
  ville?: string;
  surface?: number;
  type?: TypeBien;
  anneeConstruction?: number;
  lots?: Lot[];
  diagnostics?: Diagnostic[];
  classeDpe?: ClasseDpe | null;
}

interface OverridesDiagnosticDpe {
  dateEmission?: Temporal.PlainDate;
  classeDpe?: ClasseDpe;
}

interface OverridesDiagnosticNonDpe {
  dateEmission?: Temporal.PlainDate;
}

export function unDiagnosticDpeValide(overrides: OverridesDiagnosticDpe = {}): Diagnostic {
  return Diagnostic.creer({
    type: 'dpe',
    dateEmission: overrides.dateEmission ?? Temporal.PlainDate.from('2025-01-15'),
    classeDpe: overrides.classeDpe ?? 'D',
  });
}

export function unDiagnosticGazValide(overrides: OverridesDiagnosticNonDpe = {}): Diagnostic {
  return Diagnostic.creer({
    type: 'gaz',
    dateEmission: overrides.dateEmission ?? Temporal.PlainDate.from('2025-01-15'),
  });
}

export function unDiagnosticElecValide(overrides: OverridesDiagnosticNonDpe = {}): Diagnostic {
  return Diagnostic.creer({
    type: 'elec',
    dateEmission: overrides.dateEmission ?? Temporal.PlainDate.from('2025-01-15'),
  });
}

export function unDiagnosticErpValide(overrides: OverridesDiagnosticNonDpe = {}): Diagnostic {
  return Diagnostic.creer({
    type: 'erp',
    dateEmission: overrides.dateEmission ?? Temporal.PlainDate.from('2025-01-15'),
  });
}

export function unLotValide(overrides: OverridesLot = {}): Lot {
  return Lot.creer({
    designation: overrides.designation ?? 'Appartement principal',
    surface: overrides.surface !== undefined ? overrides.surface : 50,
    type: overrides.type ?? 'appartement',
    etage: overrides.etage !== undefined ? overrides.etage : null,
    id: overrides.id,
  });
}

export function unBienValide(overrides: OverridesBien = {}): Bien {
  const lots = overrides.lots ?? [unLotValide()];
  return Bien.creer({
    id: overrides.id,
    adresse: Adresse.creer({
      rue: overrides.rue ?? '1 rue Test',
      codePostal: overrides.codePostal ?? '75001',
      ville: overrides.ville ?? 'Paris',
    }),
    surface: overrides.surface ?? 50,
    type: overrides.type ?? 'appartement',
    anneeConstruction: overrides.anneeConstruction ?? 2000,
    lots,
    diagnostics: overrides.diagnostics ?? [],
    classeDpe: overrides.classeDpe !== undefined ? overrides.classeDpe : null,
  });
}
