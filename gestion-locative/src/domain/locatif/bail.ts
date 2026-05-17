import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../_shared/erreurs.js';
import { nouveauBailId, type BailId, type BienId, type LotId, type LocataireId } from '../_shared/identifiants.js';
import { Money } from '../_shared/money.js';
import type { IRL } from '../_shared/irl.js';
import type { ClasseDpe } from '../_shared/duree-validite-diagnostic.js';

import type { Cautionnement } from './cautionnement.js';
import { InventaireItem, TYPES_ITEM_OBLIGATOIRES, type TypeItemInventaire } from '../_shared/inventaire-item.js';

/** Phase 1 : meublé classique seulement. Étudiant/mobilité différés V2 (D-34). */
export type TypeBail = 'classique';

/** Mode de gestion des charges locatives (LOCATION_MEUBLEE_REGLES §4.3). */
export type ModeCharges = 'forfait' | 'provisions';

interface BailProps {
  id?: BailId;
  locataireId: LocataireId;
  bienId: BienId;
  lotIds: LotId[];
  type: TypeBail;
  dateDebut: Temporal.PlainDate;
  dureeMois: number;
  loyerHc: Money;
  modeCharges: ModeCharges;
  montantCharges: Money;
  depotGarantie: Money;
  irlReference: IRL;
  cautionnement: Cautionnement | null;
  /** Phase 2 — D-51. null = brouillon, non-null = bail actif. */
  actifDepuis?: Temporal.PlainDate | null;
  /** Phase 2 — D-53. Jour du mois de l'échéance, 1..28. Défaut 1. */
  jourEcheance?: number;
  /** Phase 3 — LOC-06 D-97 : inventaire mobilier obligatoire décret 2015-981 (présence seulement). */
  mobilier?: InventaireItem[];
}

export interface ModifierBailPatch {
  locataireId?: LocataireId;
  bienId?: BienId;
  lotIds?: LotId[];
  dateDebut?: Temporal.PlainDate;
  dureeMois?: number;
  loyerHc?: Money;
  modeCharges?: ModeCharges;
  montantCharges?: Money;
  depotGarantie?: Money;
  irlReference?: IRL;
  cautionnement?: Cautionnement | null;
  /** Phase 2 — D-51. Utiliser `undefined` pour ne pas modifier, `null` pour désactiver. */
  actifDepuis?: Temporal.PlainDate | null;
  jourEcheance?: number;
  /** Phase 3 — LOC-06 D-97 : inventaire mobilier obligatoire décret 2015-981. */
  mobilier?: InventaireItem[];
}

/**
 * Agrégat racine Bail meublé classique (LOC-02).
 * Relie un Bien (avec ses Lots) à un Locataire.
 *
 * Invariants D-35 (LOCATION_MEUBLEE_REGLES §3.1 + §5) :
 *   - durée ≥ 12 mois
 *   - loyer HC > 0
 *   - dépôt de garantie ≤ 2 × loyer HC
 *   - ≥ 1 lot_id sélectionné
 *   - mode_charges ∈ {forfait, provisions}
 *
 * Note : la vérification "lot_ids ⊂ bien.lots" est faite au use case (cross-aggregate — D-30).
 */
export class Bail {
  readonly id: BailId;
  readonly locataireId: LocataireId;
  readonly bienId: BienId;
  readonly lotIds: ReadonlyArray<LotId>;
  readonly type: TypeBail;
  readonly dateDebut: Temporal.PlainDate;
  readonly dureeMois: number;
  readonly loyerHc: Money;
  readonly modeCharges: ModeCharges;
  readonly montantCharges: Money;
  readonly depotGarantie: Money;
  readonly irlReference: IRL;
  readonly cautionnement: Cautionnement | null;
  /** Phase 2 — D-51. null = brouillon, non-null = bail actif. */
  readonly actifDepuis: Temporal.PlainDate | null;
  /** Phase 2 — D-53. Jour du mois de l'échéance, 1..28. Défaut 1. */
  readonly jourEcheance: number;
  /** Phase 3 — LOC-06 D-97 : inventaire mobilier obligatoire décret 2015-981. Défaut []. */
  readonly mobilier: ReadonlyArray<InventaireItem>;

  private constructor(id: BailId, props: Omit<BailProps, 'id'>) {
    this.id = id;
    this.locataireId = props.locataireId;
    this.bienId = props.bienId;
    this.lotIds = Object.freeze([...props.lotIds]);
    this.type = props.type;
    this.dateDebut = props.dateDebut;
    this.dureeMois = props.dureeMois;
    this.loyerHc = props.loyerHc;
    this.modeCharges = props.modeCharges;
    this.montantCharges = props.montantCharges;
    this.depotGarantie = props.depotGarantie;
    this.irlReference = props.irlReference;
    this.cautionnement = props.cautionnement;
    this.actifDepuis = props.actifDepuis ?? null;
    this.jourEcheance = props.jourEcheance ?? 1;
    this.mobilier = Object.freeze([...(props.mobilier ?? [])]);
  }

  static creer(props: BailProps): Bail {
    // D-35 §3.1 — durée minimale 12 mois pour un bail meublé classique
    if (props.dureeMois < 12) {
      throw new InvariantViolated('Un bail meublé classique doit durer au moins 12 mois');
    }

    // D-35 — loyer hors charges doit être positif (centimes > 0)
    if (!props.loyerHc.superieurA(Money.zero())) {
      throw new InvariantViolated('Le loyer hors charges doit être supérieur à 0 €');
    }

    // D-35 §5 — dépôt de garantie ≤ 2 × loyer HC
    const depotMax = props.loyerHc.multiplier(2n);
    if (!props.depotGarantie.lte(depotMax)) {
      const max = depotMax.enEuros();
      throw new InvariantViolated(
        `Le dépôt de garantie ne peut pas dépasser 2 mois de loyer hors charges (maximum : ${max})`,
      );
    }

    // D-30 — au moins 1 lot sélectionné
    if (props.lotIds.length < 1) {
      throw new InvariantViolated('Sélectionnez au moins un lot pour ce bail');
    }

    // mode_charges ∈ {forfait, provisions}
    const modesValides: ModeCharges[] = ['forfait', 'provisions'];
    if (!modesValides.includes(props.modeCharges)) {
      throw new InvariantViolated(
        `Mode de charges invalide : "${props.modeCharges}". Valeurs acceptées : forfait, provisions`,
      );
    }

    // Phase 2 — D-53 : jourEcheance ∈ [1, 28] si fourni
    if (props.jourEcheance !== undefined) {
      if (props.jourEcheance < 1 || props.jourEcheance > 28) {
        throw new InvariantViolated("Le jour d'échéance doit être entre 1 et 28 (D-53)");
      }
    }

    const id = props.id ?? nouveauBailId();
    return new Bail(id, {
      locataireId: props.locataireId,
      bienId: props.bienId,
      lotIds: props.lotIds,
      type: props.type,
      dateDebut: props.dateDebut,
      dureeMois: props.dureeMois,
      loyerHc: props.loyerHc,
      modeCharges: props.modeCharges,
      montantCharges: props.montantCharges,
      depotGarantie: props.depotGarantie,
      irlReference: props.irlReference,
      cautionnement: props.cautionnement,
      actifDepuis: props.actifDepuis,
      jourEcheance: props.jourEcheance,
      mobilier: props.mobilier,
    });
  }

  /** Helper privé — retourne toutes les props pour les méthodes copy-on-write. */
  private toProps(): BailProps {
    return {
      id: this.id,
      locataireId: this.locataireId,
      bienId: this.bienId,
      lotIds: [...this.lotIds],
      type: this.type,
      dateDebut: this.dateDebut,
      dureeMois: this.dureeMois,
      loyerHc: this.loyerHc,
      modeCharges: this.modeCharges,
      montantCharges: this.montantCharges,
      depotGarantie: this.depotGarantie,
      irlReference: this.irlReference,
      cautionnement: this.cautionnement,
      actifDepuis: this.actifDepuis,
      jourEcheance: this.jourEcheance,
      mobilier: [...this.mobilier],
    };
  }

  /** Copy-on-write — re-valide tous les invariants. */
  modifier(patch: ModifierBailPatch): Bail {
    return Bail.creer({
      ...this.toProps(),
      ...(patch.locataireId !== undefined && { locataireId: patch.locataireId }),
      ...(patch.bienId !== undefined && { bienId: patch.bienId }),
      ...(patch.lotIds !== undefined && { lotIds: patch.lotIds }),
      ...(patch.dateDebut !== undefined && { dateDebut: patch.dateDebut }),
      ...(patch.dureeMois !== undefined && { dureeMois: patch.dureeMois }),
      ...(patch.loyerHc !== undefined && { loyerHc: patch.loyerHc }),
      ...(patch.modeCharges !== undefined && { modeCharges: patch.modeCharges }),
      ...(patch.montantCharges !== undefined && { montantCharges: patch.montantCharges }),
      ...(patch.depotGarantie !== undefined && { depotGarantie: patch.depotGarantie }),
      ...(patch.irlReference !== undefined && { irlReference: patch.irlReference }),
      // cautionnement : `null` intentionnel distinct de `undefined` (pas de changement)
      ...(patch.cautionnement !== undefined && { cautionnement: patch.cautionnement }),
      // actifDepuis : `null` intentionnel (désactivation) distinct de `undefined` (pas de changement)
      ...(patch.actifDepuis !== undefined && { actifDepuis: patch.actifDepuis }),
      ...(patch.jourEcheance !== undefined && { jourEcheance: patch.jourEcheance }),
      ...(patch.mobilier !== undefined && { mobilier: patch.mobilier }),
    });
  }

  /**
   * Phase 2 — D-51, D-53. Active le bail avec une date et un jour d'échéance.
   * Valide jourEcheance ∈ [1, 28] (D-53).
   */
  activer(actifDepuis: Temporal.PlainDate, jourEcheance: number): Bail {
    return Bail.creer({
      ...this.toProps(),
      actifDepuis,
      jourEcheance,
    });
  }

  /**
   * Phase 2 — D-74. Désactive le bail (actifDepuis = null).
   * Préserve l'historique (échéances, encaissements, quittances intacts).
   */
  desactiver(): Bail {
    return Bail.creer({
      ...this.toProps(),
      actifDepuis: null,
    });
  }

  /**
   * Phase 3 — LOC-06 D-98. Vérifie la checklist mobilier obligatoire (décret 2015-981).
   * Non bloquant — retourne un warning textuel si des items obligatoires sont absents.
   */
  verifierChecklistMobilier(): { manquants: TypeItemInventaire[]; warning: string | null } {
    if (this.mobilier.length === 0) {
      return {
        manquants: [...TYPES_ITEM_OBLIGATOIRES],
        warning: 'Aucun mobilier renseigné — risque maximum de requalification.',
      };
    }

    const manquants = TYPES_ITEM_OBLIGATOIRES.filter(
      (t) => !this.mobilier.some((i) => i.typeItem === t && i.present),
    );

    if (manquants.length === 0) {
      return { manquants: [], warning: null };
    }

    return {
      manquants,
      warning: `Attention : ${manquants.length} élément(s) obligatoire(s) du décret 2015-981 sont marqués absents. Le bail risque d'être requalifié en bail nu, entraînant un changement de régime fiscal (revenus fonciers au lieu de BIC).`,
    };
  }

  /**
   * Phase 3 — LOC-04 D-91 / DP-20. Date du prochain anniversaire du bail à partir de `today`.
   * Pure (no copy-on-write). Utilise Temporal natif pour le clamp bissextile.
   *
   * Sémantique : "atteint dès aujourd'hui" → prochain est dans 1 an.
   *  - today < dateDebut → dateDebut + 1 an
   *  - today >= dateDebut → cherche le plus petit N tel que dateDebut + N ans > today
   */
  dateAnniversaireProchaine(today: Temporal.PlainDate): Temporal.PlainDate {
    if (Temporal.PlainDate.compare(today, this.dateDebut) < 0) {
      return this.dateDebut.add({ years: 1 });
    }
    // Sémantique : "anniversaire atteint maintenant" → on retourne l'anniversaire suivant.
    // Cherche le plus petit N tel que dateDebut + N ans > today (strictement).
    // Sur dateDebut bissextile (29 fév), Temporal clamp à 28 fév les années
    // non bissextiles ; on commence à diff.years puis on incrémente récursivement.
    const diff = this.dateDebut.until(today, { largestUnit: 'years' });
    const prochainDepuis = (n: number): Temporal.PlainDate => {
      const candidat = this.dateDebut.add({ years: n });
      return Temporal.PlainDate.compare(candidat, today) > 0
        ? candidat
        : prochainDepuis(n + 1);
    };
    return prochainDepuis(diff.years);
  }

  /**
   * Phase 3 — LOC-04 D-91 simulation IRL + LOC-05 D-92 gel Climat F/G.
   * Pure (no copy-on-write).
   *
   * - DPE F/G → { gelLoyer: true, raison: 'gel_dpe', nouveauLoyerHc: this.loyerHc }
   * - Sinon : nouveauLoyerHc = loyerHc × (IRL_nouveau / IRL_référence) avec banker's rounding.
   *   Précision via BigInt sur centièmes (DP-16 résolu).
   */
  simulerIndexation(
    irlNouveau: IRL,
    classeDpeBien: ClasseDpe | null,
  ): { nouveauLoyerHc: Money; gelLoyer: boolean; raison?: 'gel_dpe' } {
    if (classeDpeBien === 'F' || classeDpeBien === 'G') {
      return { nouveauLoyerHc: this.loyerHc, gelLoyer: true, raison: 'gel_dpe' };
    }

    const valeurAvant = parseFloat(this.irlReference.valeur);
    const valeurApres = parseFloat(irlNouveau.valeur);
    const den = BigInt(Math.round(valeurAvant * 100));
    const num = BigInt(Math.round(valeurApres * 100));

    const nouveauLoyerHc = this.loyerHc.multiplyByRatio(num, den, 'banker');
    return { nouveauLoyerHc, gelLoyer: false };
  }
}
