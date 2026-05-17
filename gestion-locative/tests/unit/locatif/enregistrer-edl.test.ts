import { describe, it, expect, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { enregistrerEDLEntree } from '../../../src/application/locatif/enregistrer-edl-entree.js';
import { enregistrerEDLSortie } from '../../../src/application/locatif/enregistrer-edl-sortie.js';
import { BailIntrouvable } from '../../../src/domain/locatif/erreurs.js';
import {
  EDLEntreeExisteDeja,
  EDLSortieExisteDeja,
} from '../../../src/domain/locatif/erreurs.js';
import {
  inventaireCompletPresent,
  inventaireVidePour,
  TYPES_ITEM_INVENTAIRE,
  TYPES_ITEM_OBLIGATOIRES,
  InventaireItem,
} from '../../../src/domain/_shared/inventaire-item.js';
import { unBailValide, unEtatDesLieuxEntreeValide } from '../../_builders/locatif.js';
import { nouveauBailId } from '../../../src/domain/_shared/identifiants.js';
import type { BailRepository } from '../../../src/domain/locatif/bail-repository.js';
import type { EtatDesLieuxRepository } from '../../../src/domain/locatif/etat-des-lieux-repository.js';

const bail = unBailValide({
  dateDebut: Temporal.PlainDate.from('2026-01-01'),
  dureeMois: 12,
});

function makeBailRepo(b: ReturnType<typeof unBailValide> | null = bail): BailRepository {
  return {
    enregistrer: vi.fn(),
    trouverParId: vi.fn().mockResolvedValue(b),
    listerParBien: vi.fn(),
    trouverBailActifParBien: vi.fn(),
  } as unknown as BailRepository;
}

function makeEdlRepo(
  edlEntreeActif: Awaited<ReturnType<EtatDesLieuxRepository['trouverActifParBailEtType']>> = null,
  edlSortieActif: Awaited<ReturnType<EtatDesLieuxRepository['trouverActifParBailEtType']>> = null,
): EtatDesLieuxRepository {
  return {
    enregistrer: vi.fn(),
    trouverParId: vi.fn(),
    trouverActifParBailEtType: vi.fn().mockImplementation((_bailId: unknown, type: string) => {
      if (type === 'entree') return Promise.resolve(edlEntreeActif);
      return Promise.resolve(edlSortieActif);
    }),
    listerParBail: vi.fn(),
  } as unknown as EtatDesLieuxRepository;
}

const commandeEntreeValide = {
  bailId: bail.id,
  dateEdl: Temporal.PlainDate.from('2026-05-01'),
  contradictoire: true,
  dateSignature: Temporal.PlainDate.from('2026-05-01'),
  inventaire: inventaireCompletPresent().map((i) => i.toJSON()),
};

const commandeSortieValide = {
  bailId: bail.id,
  dateEdl: Temporal.PlainDate.from('2027-05-01'),
  contradictoire: false,
  dateSignature: null,
  inventaire: inventaireCompletPresent().map((i) => i.toJSON()),
};

describe('enregistrerEDLEntree', () => {
  // T32
  it('bail existe, pas de EDL entrée actif — retourne { edlId, warnings: [] }', async () => {
    const bailRepo = makeBailRepo(bail);
    const edlRepo = makeEdlRepo(null);
    const result = await enregistrerEDLEntree(commandeEntreeValide, bailRepo, edlRepo);
    expect(result.edlId).toBeTruthy();
    expect(result.warnings).toHaveLength(0);
    expect(edlRepo.enregistrer).toHaveBeenCalledTimes(1);
  });

  // T33
  it('bailId inexistant → throw BailIntrouvable', async () => {
    const bailRepo = makeBailRepo(null);
    const edlRepo = makeEdlRepo(null);
    await expect(
      enregistrerEDLEntree({ ...commandeEntreeValide, bailId: nouveauBailId() }, bailRepo, edlRepo),
    ).rejects.toThrow(BailIntrouvable);
  });

  // T34
  it('EDL entrée actif déjà existe → throw EDLEntreeExisteDeja', async () => {
    const edlActif = unEtatDesLieuxEntreeValide({ bailId: bail.id });
    const bailRepo = makeBailRepo(bail);
    const edlRepo = makeEdlRepo(edlActif);
    await expect(
      enregistrerEDLEntree(commandeEntreeValide, bailRepo, edlRepo),
    ).rejects.toThrow(EDLEntreeExisteDeja);
  });

  // T35
  it('5 items obligatoires absents → warnings non vide (warning D-98), use case ne throw pas', async () => {
    const inventaire = inventaireCompletPresent().map((item, idx) => {
      // Rendre absents les 5 premiers items obligatoires
      if (idx < 5) {
        return InventaireItem.creer({ typeItem: item.typeItem, present: false, etat: null, note: null });
      }
      return item;
    });
    const commandeAvecAbsents = {
      ...commandeEntreeValide,
      inventaire: inventaire.map((i) => i.toJSON()),
    };
    const bailRepo = makeBailRepo(bail);
    const edlRepo = makeEdlRepo(null);
    const result = await enregistrerEDLEntree(commandeAvecAbsents, bailRepo, edlRepo);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("5 élément(s) du décret 2015-981 absents dans cet inventaire");
    expect(result.warnings[0]).toContain("risque de requalification du bail en bail non meublé");
  });
});

describe('enregistrerEDLSortie', () => {
  // T36
  it('EDL sortie sans EDL entrée actif → warning D-85 + deltaWarnings: []', async () => {
    const bailRepo = makeBailRepo(bail);
    const edlRepo = makeEdlRepo(null, null);
    const result = await enregistrerEDLSortie(commandeSortieValide, bailRepo, edlRepo);
    expect(result.warnings.some((w) => w.includes("Pas d'EDL d'entrée enregistré"))).toBe(true);
    expect(result.deltaWarnings).toHaveLength(0);
  });

  // T37
  it('EDL sortie avec EDL entrée actif présent → deltaWarnings calculés', async () => {
    const edlEntree = unEtatDesLieuxEntreeValide({ bailId: bail.id });
    const bailRepo = makeBailRepo(bail);
    const edlRepo = makeEdlRepo(edlEntree, null);
    const result = await enregistrerEDLSortie(commandeSortieValide, bailRepo, edlRepo);
    // Les 2 inventaires sont identiques → deltaWarnings vide
    expect(Array.isArray(result.deltaWarnings)).toBe(true);
    expect(result.deltaWarnings).toHaveLength(0);
  });

  // T38
  it('EDL sortie avec dateEdl avant fin officielle → warning D-84', async () => {
    // bail.dateDebut=2026-01-01 + dureeMois=12 → fin officielle=2027-01-01
    // dateEdl=2026-05-01 < 2027-01-01 → warning D-84
    const commandeSortieAvant = {
      ...commandeSortieValide,
      dateEdl: Temporal.PlainDate.from('2026-05-01'),
    };
    const bailActif = unBailValide({
      dateDebut: Temporal.PlainDate.from('2026-01-01'),
      dureeMois: 12,
    }).activer(Temporal.PlainDate.from('2026-01-01'), 1);
    const bailRepo = makeBailRepo(bailActif);
    const edlRepo = makeEdlRepo(null, null);
    const result = await enregistrerEDLSortie(
      { ...commandeSortieAvant, bailId: bailActif.id },
      bailRepo,
      edlRepo,
    );
    expect(result.warnings.some((w) => w.includes('EDL de sortie enregistré avant la fin officielle'))).toBe(true);
  });
});
