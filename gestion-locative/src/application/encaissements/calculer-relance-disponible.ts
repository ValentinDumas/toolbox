import { Temporal } from '@js-temporal/polyfill';
import type { EcheanceLoyer } from '../../domain/encaissements/echeance-loyer.js';
import type { Relance, NiveauRelance } from '../../domain/encaissements/relance.js';

/**
 * Seuils en jours pour chaque niveau de relance (D-68).
 * Stockés en constante de domaine — modifiables par PR si nouvelle pratique.
 */
export const SEUILS_RELANCE_JOURS: Record<NiveauRelance, number> = {
  1: 10,
  2: 30,
  3: 60,
};

/**
 * Fonction PURE — calcule le niveau de relance disponible selon :
 * - Le statut de l'échéance (payée/annulée → null)
 * - Les relances déjà envoyées (actives uniquement — annuleLe IS NULL)
 * - Le chaînage strict : impossible de sauter un niveau (D-71)
 * - Le seuil J+10/J+30/J+60 par rapport à jourEcheanceAttendue
 *
 * Accepte une interface duck-typing pour la flexibilité (EcheanceLoyer ou Impaye DTO).
 */
export function calculerRelanceDisponible(
  echeance: Pick<EcheanceLoyer, 'statut' | 'jourEcheanceAttendue'>,
  relancesActives: Relance[],
  today: Temporal.PlainDate,
): NiveauRelance | null {
  // Échéance payée ou annulée → pas de relance
  if (echeance.statut === 'payee' || echeance.statut === 'annulee') {
    return null;
  }

  // Filtrer les relances actives (annuleLe IS NULL) et trier par niveau ASC
  const actives = relancesActives
    .filter((r) => r.annuleLe === null)
    .sort((a, b) => a.niveau - b.niveau);

  // Dernier niveau envoyé (0 si aucune relance)
  const dernierNiveau = actives.length === 0 ? 0 : (actives[actives.length - 1]!.niveau);

  // Tous niveaux épuisés
  if (dernierNiveau === 3) return null;

  const niveauCandidat = (dernierNiveau + 1) as NiveauRelance;

  // Vérifier le seuil temporel
  const seuil = echeance.jourEcheanceAttendue.add({
    days: SEUILS_RELANCE_JOURS[niveauCandidat],
  });

  return Temporal.PlainDate.compare(today, seuil) >= 0 ? niveauCandidat : null;
}
