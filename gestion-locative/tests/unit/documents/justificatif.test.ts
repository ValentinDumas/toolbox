import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';

import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import {
  DocumentDejaEnCorbeille,
  DocumentNonEnCorbeille,
} from '../../../src/domain/documents/erreurs.js';
import { Justificatif } from '../../../src/domain/documents/justificatif.js';
import {
  unJustificatifAncienDixAns,
  unJustificatifAvecBienSeul,
  unJustificatifAvecLocataireSeul,
  unJustificatifEnCorbeille,
  unJustificatifValide,
} from '../../_builders/documents.js';

describe('Justificatif.creer — D-103 rattachement', () => {
  it('refuse de créer un justificatif sans bienId ET sans locataireId', () => {
    expect(() =>
      Justificatif.creer(
        unJustificatifValide({ bienId: null, locataireId: null }),
      ),
    ).toThrow(InvariantViolated);
  });

  it("propage le message verbatim UI-6.2 'Le document doit être rattaché à un bien ou à un locataire.'", () => {
    expect(() =>
      Justificatif.creer(
        unJustificatifValide({ bienId: null, locataireId: null }),
      ),
    ).toThrow(
      'Le document doit être rattaché à un bien ou à un locataire.',
    );
  });

  it('accepte bienId seul', () => {
    const j = Justificatif.creer(unJustificatifAvecBienSeul());
    expect(j.bienId).not.toBeNull();
    expect(j.locataireId).toBeNull();
  });

  it('accepte locataireId seul', () => {
    const j = Justificatif.creer(unJustificatifAvecLocataireSeul());
    expect(j.bienId).toBeNull();
    expect(j.locataireId).not.toBeNull();
  });
});

describe('Justificatif.creer — D-105 MIME validation', () => {
  it.each([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ] as const)('accepte le mime type %s', (mime) => {
    const j = Justificatif.creer(unJustificatifValide({ mimeType: mime }));
    expect(j.mimeType).toBe(mime);
  });

  it('refuse image/heic (doit être converti côté infra avant persistance)', () => {
    expect(() =>
      Justificatif.creer(
        // @ts-expect-error — on teste un mime non assignable
        unJustificatifValide({ mimeType: 'image/heic' }),
      ),
    ).toThrow(InvariantViolated);
  });
});

describe('Justificatif.creer — D-105 taille', () => {
  it('refuse une taille ≤ 0', () => {
    expect(() =>
      Justificatif.creer(unJustificatifValide({ tailleOctets: 0 })),
    ).toThrow(InvariantViolated);
  });

  it('refuse une taille > 50 Mo (52 428 800 octets)', () => {
    expect(() =>
      Justificatif.creer(unJustificatifValide({ tailleOctets: 52_428_801 })),
    ).toThrow(InvariantViolated);
  });

  it('accepte une taille pile à 50 Mo', () => {
    const j = Justificatif.creer(
      unJustificatifValide({ tailleOctets: 52_428_800 }),
    );
    expect(j.tailleOctets).toBe(52_428_800);
  });
});

describe('Justificatif.mettreEnCorbeille — D-109 soft-delete copy-on-write', () => {
  it("retourne une nouvelle instance avec corbeilleLe et raisonCorbeille remplis", () => {
    const j = Justificatif.creer(unJustificatifValide());
    const today = Temporal.PlainDate.from('2026-05-10');

    const enCorbeille = j.mettreEnCorbeille('Doublon', today);

    expect(enCorbeille.corbeilleLe).toEqual(today);
    expect(enCorbeille.raisonCorbeille).toBe('Doublon');
    expect(j.corbeilleLe).toBeNull(); // L'original reste intact
  });

  it("throw DocumentDejaEnCorbeille si déjà en corbeille", () => {
    const j = Justificatif.creer(unJustificatifEnCorbeille());
    expect(() =>
      j.mettreEnCorbeille('Doublon', Temporal.PlainDate.from('2026-05-12')),
    ).toThrow(DocumentDejaEnCorbeille);
  });
});

describe('Justificatif.restaurer — copy-on-write symétrique', () => {
  it('retourne une nouvelle instance avec corbeilleLe=null et raisonCorbeille=null', () => {
    const j = Justificatif.creer(unJustificatifEnCorbeille());
    const restaure = j.restaurer();

    expect(restaure.corbeilleLe).toBeNull();
    expect(restaure.raisonCorbeille).toBeNull();
  });

  it("throw DocumentNonEnCorbeille si pas en corbeille", () => {
    const j = Justificatif.creer(unJustificatifValide());
    expect(() => j.restaurer()).toThrow(DocumentNonEnCorbeille);
  });
});

describe('Justificatif.peutEtrePurge — D-109 gate 10 ans', () => {
  const creeLe = Temporal.PlainDate.from('2016-05-18');

  it('retourne false un jour avant creeLe + 10 ans', () => {
    const j = Justificatif.creer(unJustificatifValide({ creeLe }));
    const today = creeLe.add({ years: 10 }).subtract({ days: 1 });
    expect(j.peutEtrePurge(today)).toBe(false);
  });

  it('retourne true pile à creeLe + 10 ans', () => {
    const j = Justificatif.creer(unJustificatifValide({ creeLe }));
    const today = creeLe.add({ years: 10 });
    expect(j.peutEtrePurge(today)).toBe(true);
  });

  it('retourne true un jour après creeLe + 10 ans', () => {
    const j = Justificatif.creer(unJustificatifValide({ creeLe }));
    const today = creeLe.add({ years: 10 }).add({ days: 1 });
    expect(j.peutEtrePurge(today)).toBe(true);
  });

  it("utilise le builder unJustificatifAncienDixAns pour vérifier le seuil pile", () => {
    const today = Temporal.PlainDate.from('2026-05-18');
    const j = Justificatif.creer(unJustificatifAncienDixAns(today));
    expect(j.peutEtrePurge(today)).toBe(true);
  });
});

describe('Justificatif.anneeFiscale — D-107', () => {
  it("retourne dateDocument.year (pas creeLe.year)", () => {
    const j = Justificatif.creer(
      unJustificatifValide({
        dateDocument: Temporal.PlainDate.from('2025-12-15'),
        creeLe: Temporal.PlainDate.from('2026-01-10'),
      }),
    );
    expect(j.anneeFiscale()).toBe(2025);
  });
});
