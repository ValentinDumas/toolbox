import { describe, it, expect, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { desactiverBail } from '../../../src/application/locatif/desactiver-bail.js';
import type { BailRepository } from '../../../src/domain/locatif/bail-repository.js';
import type { BailId } from '../../../src/domain/_shared/identifiants.js';
import { BailIntrouvable } from '../../../src/domain/locatif/erreurs.js';
import { unBailValide } from '../../_builders/locatif.js';

function creerStubRepo(bail: ReturnType<typeof unBailValide> | null): BailRepository {
  return {
    trouverParId: vi.fn().mockResolvedValue(bail),
    enregistrer: vi.fn(),
    listerTous: vi.fn(),
    listerParLocataire: vi.fn(),
    supprimer: vi.fn(),
  };
}

describe('desactiverBail', () => {
  // T-D74-4 : lookup + bail.desactiver() + persist, actifDepuis = null
  it('bascule actifDepuis à null et persiste le bail désactivé', async () => {
    const bail = unBailValide().activer(Temporal.PlainDate.from('2026-06-01'), 5);
    const repo = creerStubRepo(bail);

    await desactiverBail(bail.id, repo);

    expect(repo.enregistrer).toHaveBeenCalledOnce();
    const bailPersiste = (repo.enregistrer as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(bailPersiste.actifDepuis).toBeNull();
    expect(bailPersiste.id).toBe(bail.id);
  });

  it('throw BailIntrouvable si le bail n\'existe pas', async () => {
    const repo = creerStubRepo(null);

    await expect(
      desactiverBail('bail-inexistant' as BailId, repo),
    ).rejects.toBeInstanceOf(BailIntrouvable);
  });
});
