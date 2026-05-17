import { Temporal } from '@js-temporal/polyfill';
import { Diagnostic } from '../../domain/patrimoine/diagnostic.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import type { BienId, DiagnosticId } from '../../domain/_shared/identifiants.js';
import type { TypeDiagnostic, ClasseDpe } from '../../domain/_shared/duree-validite-diagnostic.js';

interface AjouterDiagnosticCommande {
  bienId: BienId;
  type: TypeDiagnostic;
  dateEmission: Temporal.PlainDate;
  classeDpe?: ClasseDpe | null;
}

/**
 * Use case : ajouter un Diagnostic à un Bien (sous-agrégat D-76).
 * Orchestre : lookup bien → creer diagnostic → ajouterDiagnostic → enregistrer.
 * Retourne le DiagnosticId créé.
 * Throws BienIntrouvable ou InvariantViolated (propagé au caller HTTP).
 */
export async function ajouterDiagnostic(
  commande: AjouterDiagnosticCommande,
  bienRepo: BienRepository,
): Promise<DiagnosticId> {
  const bien = await bienRepo.trouverParId(commande.bienId);
  if (!bien) throw new BienIntrouvable(commande.bienId);

  const diagnostic = Diagnostic.creer({
    type: commande.type,
    dateEmission: commande.dateEmission,
    classeDpe: commande.classeDpe ?? null,
  });

  const bienModifie = bien.ajouterDiagnostic(diagnostic);
  await bienRepo.enregistrer(bienModifie);

  return diagnostic.id;
}
