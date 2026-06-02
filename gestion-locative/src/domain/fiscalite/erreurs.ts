/**
 * Familles d'erreurs typées — bounded context Fiscalité (Phase 5).
 *
 * Pattern : une classe par cas métier, chacune pose `this.name` explicite,
 * certaines exposent des données contextuelles via champs `public readonly`.
 *
 * Analog : src/domain/encaissements/erreurs.ts (même convention).
 */

import type { Money } from '../_shared/money.js';
import type { JustificatifId } from '../_shared/identifiants.js';

/**
 * Levée par RegleFiscaleProvider lorsqu'une année fiscale n'est pas couverte
 * par une révision triennale connue (ex : 2025, 2029+).
 *
 * Source : T-05-01-04 threat register — fail-fast, jamais de calcul fiscal
 * sur défaut silencieux.
 */
export class RegleFiscaleAbsente extends Error {
  constructor(annee: number) {
    super(`Règles fiscales absentes : année ${annee} hors plage versionnée (2026-2028). Ajouter regles-${Math.ceil(annee / 3) * 3}.ts à la prochaine révision triennale.`);
    this.name = 'RegleFiscaleAbsente';
  }
}

/**
 * Levée par cloturer-exercice lorsque des prérequis bloquants ne sont pas satisfaits.
 * Expose la liste des bloquants pour affichage dans le wizard (D-FIS-G4.1).
 */
export class PrerequisCloturalNonSatisfaits extends Error {
  constructor(public readonly bloquants: string[]) {
    super(`Clôture impossible : ${bloquants.length} prérequis non satisfaits — ${bloquants.join(', ')}`);
    this.name = 'PrerequisCloturalNonSatisfaits';
  }
}

/**
 * Levée par qualifier-justificatif ou qualifier-ticket-travaux lorsqu'une
 * DeclarationAnnuelle est clôturée (D-FIS-G2.5). Correction → DeclarationCorrigee.
 */
export class DeclarationFigeeException extends Error {
  constructor() {
    super('Déclaration clôturée — créer une DeclarationCorrigee pour modifier les qualifications');
    this.name = 'DeclarationFigeeException';
  }
}

/**
 * Levée lors de la validation d'une ValorisationFiscale si la somme des composants
 * ne correspond pas au prix d'acquisition total (D-FIS-G1.1, S3 UI-SPEC).
 */
export class ComposantsSommeIncoherente extends Error {
  constructor(
    public readonly attendu: Money,
    public readonly obtenu: Money,
  ) {
    super(`La somme des composants (${obtenu.enEuros()}) ne correspond pas au prix d'acquisition (${attendu.enEuros()})`);
    this.name = 'ComposantsSommeIncoherente';
  }
}

/**
 * Levée par detecter-bascule-lmp lorsque les recettes dépassent le seuil LMP
 * mais que les revenus du foyer ne sont pas renseignés (D-FIS-G3.1).
 */
export class RevenusFoyerManquants extends Error {
  constructor() {
    super('Revenus du foyer requis — les recettes dépassent 23 000 € et le statut LMNP/LMP ne peut pas être déterminé sans cette information (BOFIP-BIC-CHAMP-40-20)');
    this.name = 'RevenusFoyerManquants';
  }
}

/**
 * Levée si un Justificatif non qualifié est inclus dans un agrégat fiscal
 * nécessitant la qualification complète (D-FIS-G2.1).
 */
export class JustificatifNonQualifie extends Error {
  constructor(public readonly justificatifId: JustificatifId) {
    super(`Justificatif non qualifié : ${justificatifId} — qualifiez-le avant de clôturer l'exercice`);
    this.name = 'JustificatifNonQualifie';
  }
}

/**
 * Levée par `MappingLiasseProvider` lorsqu'un millésime n'est pas couvert
 * par un fichier `mapping-liasse-<millesime>.ts` (Phase 6 / FIS-05 / D-L6.3).
 *
 * Différence sémantique vs `RegleFiscaleAbsente` : les seuils micro-BIC sont
 * révisés par tranche triennale (2026-2028 couvert d'un coup), alors que le
 * cerfa peut changer chaque année (LF). On commence avec un seul millésime
 * couvert (2026) — il faudra créer `mapping-liasse-2027.ts` en janvier 2027
 * en revérifiant chaque case sur le PDF officiel impots.gouv.fr.
 *
 * Source : R1.1 RISKS.md (surveillance fiscale annuelle), D-L6.3, pitfall §6 RESEARCH.md.
 */
export class MappingLiasseAbsent extends Error {
  constructor(public readonly millesime: number) {
    super(
      `Mapping liasse absent : millésime ${millesime} non couvert. Le cerfa peut changer chaque année (LF) — vérifier le PDF officiel impots.gouv.fr et créer mapping-liasse-${millesime}.ts. (R1.1 RISKS.md)`,
    );
    this.name = 'MappingLiasseAbsent';
  }
}
