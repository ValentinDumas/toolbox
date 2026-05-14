import { describe, it, expect, vi } from 'vitest';
import { supprimerBail } from '../../../src/application/locatif/supprimer-bail.js';
import type { BailRepository } from '../../../src/domain/locatif/bail-repository.js';
import type { ActiviteBailDetector } from '../../../src/domain/locatif/activite-bail-detector.js';
import type { BailId } from '../../../src/domain/_shared/identifiants.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import { BailIntrouvable } from '../../../src/domain/locatif/erreurs.js';
import { unBailValide } from '../../_builders/locatif.js';

function creerStubDetecteur(aDeLActivite: boolean): ActiviteBailDetector {
  return { aDeLActivite: vi.fn().mockResolvedValue(aDeLActivite) };
}

function creerStubRepo(bail: ReturnType<typeof unBailValide> | null): BailRepository {
  return {
    trouverParId: vi.fn().mockResolvedValue(bail),
    enregistrer: vi.fn(),
    listerTous: vi.fn(),
    listerParLocataire: vi.fn(),
    supprimer: vi.fn(),
  };
}

describe('supprimerBail', () => {
  // T-D74-2 : stub aDeLActivite=false → suppression OK
  it('supprime le bail si ActiviteBailDetector retourne false', async () => {
    const bail = unBailValide();
    const repo = creerStubRepo(bail);
    const detecteur = creerStubDetecteur(false);

    await supprimerBail(bail.id, repo, detecteur);

    expect(repo.supprimer).toHaveBeenCalledWith(bail.id);
  });

  // T-D74-3 : stub aDeLActivite=true → InvariantViolated, pas de suppression
  it('refuse la suppression si ActiviteBailDetector retourne true (D-74)', async () => {
    const bail = unBailValide();
    const repo = creerStubRepo(bail);
    const detecteur = creerStubDetecteur(true);

    await expect(supprimerBail(bail.id, repo, detecteur)).rejects.toThrow(
      'Bail avec activité ne peut être supprimé',
    );
    await expect(supprimerBail(bail.id, repo, detecteur)).rejects.toBeInstanceOf(InvariantViolated);
    expect(repo.supprimer).not.toHaveBeenCalled();
  });

  it('throw BailIntrouvable si le bail n\'existe pas', async () => {
    const repo = creerStubRepo(null);
    const detecteur = creerStubDetecteur(false);

    await expect(
      supprimerBail('bail-inexistant' as BailId, repo, detecteur),
    ).rejects.toBeInstanceOf(BailIntrouvable);
  });
});
