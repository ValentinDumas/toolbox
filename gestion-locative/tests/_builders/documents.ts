import { Temporal } from '@js-temporal/polyfill';

import { Money } from '../../src/domain/_shared/money.js';
import type {
  BienId,
  CheminRelatif,
  JustificatifId,
  LocataireId,
} from '../../src/domain/_shared/identifiants.js';
import {
  Justificatif,
  type JustificatifProps,
  type MimeJustificatif,
  type TypeJustificatif,
} from '../../src/domain/documents/justificatif.js';

interface OverridesJustificatif {
  id?: JustificatifId;
  type?: TypeJustificatif;
  dateDocument?: Temporal.PlainDate;
  titre?: string;
  montantTtc?: Money | null;
  cheminFichier?: CheminRelatif;
  nomFichierOriginal?: string;
  mimeType?: MimeJustificatif;
  tailleOctets?: number;
  bienId?: BienId | null;
  locataireId?: LocataireId | null;
  notes?: string | null;
  creeLe?: Temporal.PlainDate;
  corbeilleLe?: Temporal.PlainDate | null;
  raisonCorbeille?: string | null;
}

/**
 * Builder Justificatif valide — defaults raisonnables.
 *
 * Type=facture, mimeType=application/pdf, bienId fourni (locataireId=null),
 * dateDocument 2026-05-01, creeLe 2026-05-01.
 */
export function unJustificatifValide(
  overrides: OverridesJustificatif = {},
): JustificatifProps {
  return {
    id: overrides.id,
    type: overrides.type ?? 'facture',
    dateDocument: overrides.dateDocument ?? Temporal.PlainDate.from('2026-05-01'),
    titre: overrides.titre ?? 'Facture test',
    montantTtc:
      overrides.montantTtc !== undefined
        ? overrides.montantTtc
        : Money.fromEuros(120),
    cheminFichier:
      overrides.cheminFichier ??
      ('documents/justificatifs/2026/test-slug.pdf' as CheminRelatif),
    nomFichierOriginal: overrides.nomFichierOriginal ?? 'facture.pdf',
    mimeType: overrides.mimeType ?? 'application/pdf',
    tailleOctets: overrides.tailleOctets ?? 12345,
    bienId:
      overrides.bienId !== undefined
        ? overrides.bienId
        : (crypto.randomUUID() as BienId),
    locataireId:
      overrides.locataireId !== undefined ? overrides.locataireId : null,
    notes: overrides.notes !== undefined ? overrides.notes : null,
    creeLe: overrides.creeLe ?? Temporal.PlainDate.from('2026-05-01'),
    corbeilleLe:
      overrides.corbeilleLe !== undefined ? overrides.corbeilleLe : null,
    raisonCorbeille:
      overrides.raisonCorbeille !== undefined ? overrides.raisonCorbeille : null,
  };
}

export function unJustificatifAvecBienSeul(
  overrides: OverridesJustificatif = {},
): JustificatifProps {
  return unJustificatifValide({
    ...overrides,
    bienId: overrides.bienId ?? (crypto.randomUUID() as BienId),
    locataireId: null,
  });
}

export function unJustificatifAvecLocataireSeul(
  overrides: OverridesJustificatif = {},
): JustificatifProps {
  return unJustificatifValide({
    ...overrides,
    bienId: null,
    locataireId:
      overrides.locataireId ?? (crypto.randomUUID() as LocataireId),
  });
}

export function unJustificatifEnCorbeille(
  overrides: OverridesJustificatif = {},
): JustificatifProps {
  return unJustificatifValide({
    ...overrides,
    corbeilleLe:
      overrides.corbeilleLe ?? Temporal.PlainDate.from('2026-05-10'),
    raisonCorbeille: overrides.raisonCorbeille ?? 'Doublon',
  });
}

export function unJustificatifAncienDixAns(
  today: Temporal.PlainDate,
  overrides: OverridesJustificatif = {},
): JustificatifProps {
  return unJustificatifValide({
    ...overrides,
    creeLe: overrides.creeLe ?? today.subtract({ years: 10 }),
  });
}

/** Helper d'instanciation directe (utile pour les tests qui veulent l'agrégat). */
export function instancierJustificatif(
  overrides: OverridesJustificatif = {},
): Justificatif {
  return Justificatif.creer(unJustificatifValide(overrides));
}
