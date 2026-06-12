/**
 * Helpers EJS purs — alertes unifiées (Phase 7 / DAS-01 / D-DASH-03 / D-AL-05).
 *
 * 3 fonctions PURES, déterministes, sans I/O ni import infra.
 * Injectées dans `reply.locals` via le hook `preHandler` global de main.ts.
 *
 * Conformité WCAG 1.4.1 : la couleur n'est JAMAIS le seul vecteur d'information.
 * Toute variante de couleur est doublée par :
 *   - un libellé textuel d'urgence (`formaterAlerteUrgence`)
 *   - une icône Unicode `aria-hidden="true"` (`iconeTypeAlerte`)
 *   - un libellé du type d'alerte (`libelleTypeAlerte`)
 *
 * Aucun import Fastify / Kysely / infrastructure.
 */

import type { Alerte, TypeAlerte } from '../../domain/_shared/alerte.js';

/**
 * Dérive le libellé WCAG d'urgence depuis `alerte.joursRestants`.
 *
 * Exemples :
 *   j = -2 → "Échéance dépassée depuis 2 jours"
 *   j = 0  → "Échéance aujourd'hui"
 *   j = 1  → "Échéance dans 1 jour"
 *   j = 5  → "Échéance dans 5 jours"
 */
export function formaterAlerteUrgence(alerte: Alerte): string {
  const j = alerte.joursRestants;
  if (j < 0) {
    const abs = Math.abs(j);
    return `Échéance dépassée depuis ${abs} jour${abs > 1 ? 's' : ''}`;
  }
  if (j === 0) {
    return "Échéance aujourd'hui";
  }
  return `Échéance dans ${j} jour${j > 1 ? 's' : ''}`;
}

/**
 * Retourne un caractère Unicode sobre, destiné à être rendu `aria-hidden="true"`.
 * Fallback `ⓘ` pour tout type inconnu.
 */
export function iconeTypeAlerte(type: TypeAlerte): string {
  const icones: Record<TypeAlerte, string> = {
    cfe: '€',
    irl: '%',
    diagnostic: '⚠',
    fin_bail: '⏰',
  };
  return icones[type] ?? 'ⓘ';
}

/**
 * Retourne le libellé français du type d'alerte.
 *
 * Pour `cfe` : inclut le millésime si disponible dans `source.extra.millesime`.
 * Pour `diagnostic` : utilise `source.extra.typeDiagnostic` pour granularité DPE/Gaz/Électricité.
 * Pour `fin_bail` : inclut le nom du locataire si disponible dans `source.extra.nomLocataire`.
 */
export function libelleTypeAlerte(alerte: Alerte): string {
  switch (alerte.type) {
    case 'cfe': {
      const millesime = alerte.source.extra?.['millesime'];
      return millesime !== undefined ? `CFE ${millesime}`.trim() : 'CFE';
    }
    case 'irl':
      return 'Révision IRL';
    case 'diagnostic': {
      const typeDiag = alerte.source.extra?.['typeDiagnostic'];
      if (typeDiag === 'dpe') return 'DPE';
      if (typeDiag === 'gaz') return 'Gaz';
      if (typeDiag === 'electricite') return 'Électricité';
      return 'Diagnostic';
    }
    case 'fin_bail': {
      const nom = alerte.source.extra?.['nomLocataire'];
      if (nom && String(nom).trim()) return `Fin de bail — ${String(nom).trim()}`;
      return 'Fin de bail';
    }
    default:
      return 'Alerte';
  }
}
