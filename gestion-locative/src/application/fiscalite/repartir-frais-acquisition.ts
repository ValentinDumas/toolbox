/**
 * Use case pur repartirFraisAcquisition — répartition prorata BOFIP (D-FIS-G1.3).
 *
 * Calcule la quote-part de frais d'acquisition (notaire + agence) à ajouter à
 * chaque composant amortissable, proportionnellement à leur montant HT.
 *
 * Source juridique : BOFIP-BIC-AMT-10-20 §110 — "les frais d'acquisition sont
 * répartis au prorata de la valeur de chaque composant amortissable".
 *
 * Algorithme (D-FIS-G1.3) :
 *   1. Filtre les composants amortissables (type ≠ 'terrain' AND dateSortie = null)
 *   2. Calcule Σ montantHt des amortissables
 *   3. Pour chaque amortissable sauf le dernier : quotePart = fraisTotal × (c.montantHt / Σ) — banker's rounding
 *   4. Le DERNIER composant (ordre stable ORDRE_COMPOSANTS_AMORTISSABLES) absorbe l'écart d'arrondi
 *   5. Garantit : Σ quote-parts === fraisTotal exact au centime
 *
 * Pas d'effet de bord — fonction pure (pas d'I/O, pas de transaction).
 */

import { Money } from '../../domain/_shared/money.js';
import type { ComposantId } from '../../domain/_shared/identifiants.js';
import { Composant, ORDRE_COMPOSANTS_AMORTISSABLES } from '../../domain/fiscalite/composant.js';

export interface RepartirFraisInput {
  composants: Composant[];
  fraisTotal: Money;
}

/**
 * Répartit les frais d'acquisition au prorata sur les composants amortissables.
 *
 * @returns Map<ComposantId, Money> — quote-part de frais pour chaque composant amortissable.
 *          Retourne Map vide si aucun composant amortissable (caller décide — activer-fiscalite-bien refuse).
 *
 * D-FIS-G1.3 : dernier composant dans l'ordre stable ORDRE_COMPOSANTS_AMORTISSABLES
 *              absorbe l'arrondi pour garantir Σ = fraisTotal.
 *
 * BOFIP-BIC-AMT-10-20 §110.
 */
export function repartirFraisAcquisition(input: RepartirFraisInput): Map<ComposantId, Money> {
  const { composants, fraisTotal } = input;

  // 1. Filtrer les amortissables
  const amortissables = composants.filter((c) => c.estAmortissable());

  // Si aucun amortissable, retourner Map vide
  if (amortissables.length === 0) {
    return new Map();
  }

  // 2. Trier par ordre stable pour l'absorption de l'arrondi (le dernier absorbe)
  const ordonnes = [...amortissables].sort((a, b) => {
    const iA = ORDRE_COMPOSANTS_AMORTISSABLES.indexOf(a.type);
    const iB = ORDRE_COMPOSANTS_AMORTISSABLES.indexOf(b.type);
    // Types inconnus (future extension) à la fin
    const posA = iA === -1 ? ORDRE_COMPOSANTS_AMORTISSABLES.length : iA;
    const posB = iB === -1 ? ORDRE_COMPOSANTS_AMORTISSABLES.length : iB;
    return posA - posB;
  });

  // 3. Calculer Σ montantHt amortissables
  const somme = ordonnes.reduce(
    (acc, c) => acc.additionner(c.montantHt),
    Money.zero(),
  );

  // Si Σ = 0 (tous à zéro — impossible en pratique car Composant creer throw si 0 pour amortissable)
  // Mais par défense en profondeur : retourner Map vide
  if (somme.egale(Money.zero())) {
    return new Map();
  }

  // 4. Calculer les quotes-parts pour tous sauf le dernier (banker's rounding)
  const result = new Map<ComposantId, Money>();
  let sommePrecedents = Money.zero();

  for (let i = 0; i < ordonnes.length - 1; i++) {
    const composant = ordonnes[i]!;
    // quotePart = fraisTotal × (c.montantHt / Σ amortissables)
    const quotePart = fraisTotal.multiplyByFraction(
      composant.montantHt.toCentimes(),
      somme.toCentimes(),
    );
    result.set(composant.id, quotePart);
    sommePrecedents = sommePrecedents.additionner(quotePart);
  }

  // 5. Le dernier composant absorbe l'écart pour garantir Σ = fraisTotal exact
  const dernier = ordonnes[ordonnes.length - 1]!;
  const quotePartDernier = fraisTotal.soustraire(sommePrecedents);
  result.set(dernier.id, quotePartDernier);

  return result;
}
