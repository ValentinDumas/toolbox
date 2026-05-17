/**
 * VO InventaireItem — item de l'inventaire mobilier obligatoire.
 * Conforme décret n°2015-981 du 31/07/2015 + LOCATION_MEUBLEE_REGLES.md §2.
 * Partagé entre EtatDesLieux.inventaire (LOC-03) et Bail.mobilier (LOC-06).
 * Revue annuelle si décret modifié (R1.1 RISKS.md).
 */
import { InvariantViolated } from './erreurs.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Les 12 items atomiques EXHAUSTIFS du décret 2015-981 (LOCATION_MEUBLEE_REGLES.md §2 lignes 13-28).
 * Aucune fusion (vaisselle ≠ ustensiles, table ≠ sieges).
 * Aucune invention (cuisine_evier, chauffage_eau_chaude ne sont PAS dans le décret).
 * Lock revision iteration 1 BLOCKER 1.
 */
export type TypeItemInventaire =
  | 'literie'
  | 'volets_occultants'
  | 'plaques_cuisson'
  | 'four_micro_ondes'
  | 'refrigerateur_congelateur'
  | 'vaisselle'
  | 'ustensiles'
  | 'table'
  | 'sieges'
  | 'etageres'
  | 'luminaires'
  | 'materiel_entretien';

/** État physique d'un item — null si item absent. */
export type EtatItem = 'bon' | 'moyen' | 'degrade' | null;

const ETATS_VALIDES: readonly EtatItem[] = ['bon', 'moyen', 'degrade', null];

// ─── TYPES_ITEM_INVENTAIRE — ordre canonique décret 2015-981 ─────────────────

/**
 * Array énumérant les 12 items dans l'ordre canonique du décret 2015-981.
 * Utiliser pour itération UI (formulaires, partials EJS).
 */
export const TYPES_ITEM_INVENTAIRE: TypeItemInventaire[] = [
  'literie',
  'volets_occultants',
  'plaques_cuisson',
  'four_micro_ondes',
  'refrigerateur_congelateur',
  'vaisselle',
  'ustensiles',
  'table',
  'sieges',
  'etageres',
  'luminaires',
  'materiel_entretien',
];

/** V1 — tous les 12 items sont obligatoires (D-100). */
export const TYPES_ITEM_OBLIGATOIRES: TypeItemInventaire[] = [...TYPES_ITEM_INVENTAIRE];

// ─── LABELS_ITEM_INVENTAIRE — libellés français legal-faithful ───────────────

/**
 * Libellés français exacts — wording fidèle au décret 2015-981.
 * Utilisé par les helpers preHandler et le domain service comparerInventaires.
 */
export const LABELS_ITEM_INVENTAIRE: Record<TypeItemInventaire, string> = {
  literie: 'Literie avec couette ou couverture',
  volets_occultants: "Dispositif d'occultation des fenêtres (chambres)",
  plaques_cuisson: 'Plaques de cuisson',
  four_micro_ondes: 'Four ou four à micro-ondes',
  refrigerateur_congelateur: 'Réfrigérateur et congélateur (ou compartiment freezer ≤ -6 °C)',
  vaisselle: 'Vaisselle nécessaire à la prise des repas',
  ustensiles: 'Ustensiles de cuisine',
  table: 'Table',
  sieges: 'Sièges',
  etageres: 'Étagères de rangement',
  luminaires: 'Luminaires',
  materiel_entretien: "Matériel d'entretien ménager adapté au logement",
};

// ─── InventaireItemProps ─────────────────────────────────────────────────────

export interface InventaireItemProps {
  typeItem: TypeItemInventaire;
  present: boolean;
  etat: EtatItem;
  note: string | null;
}

// ─── InventaireItem VO ───────────────────────────────────────────────────────

export class InventaireItem {
  readonly typeItem: TypeItemInventaire;
  readonly present: boolean;
  readonly etat: EtatItem;
  readonly note: string | null;

  private constructor(props: InventaireItemProps) {
    this.typeItem = props.typeItem;
    this.present = props.present;
    this.etat = props.etat;
    this.note = props.note;
  }

  static creer(props: InventaireItemProps): InventaireItem {
    // Valider typeItem ∈ TYPES_ITEM_INVENTAIRE
    if (!(TYPES_ITEM_INVENTAIRE as readonly string[]).includes(props.typeItem)) {
      throw new InvariantViolated(
        `Type d'item d'inventaire invalide : "${props.typeItem}"`,
      );
    }

    // Valider etat ∈ {bon, moyen, degrade, null}
    if (!(ETATS_VALIDES as readonly (string | null)[]).includes(props.etat)) {
      throw new InvariantViolated(`État d'item invalide : "${props.etat}"`);
    }

    // Si item présent, état requis
    if (props.present === true && props.etat === null) {
      throw new InvariantViolated("L'état est requis si l'item est présent");
    }

    // Si item absent, normaliser état à null (tolérant — item absent ⇒ état non pertinent)
    const etatFinal = props.present ? props.etat : null;

    return new InventaireItem({
      typeItem: props.typeItem,
      present: props.present,
      etat: etatFinal,
      note: props.note ?? null,
    });
  }

  /** Sérialisation JSON pour stockage en colonne TEXT SQLite (pattern Cautionnement Phase 1). */
  toJSON(): InventaireItemProps {
    return {
      typeItem: this.typeItem,
      present: this.present,
      etat: this.etat,
      note: this.note,
    };
  }
}

// ─── Fonctions pures ─────────────────────────────────────────────────────────

/** Rang de dégradation pour calcul etatADegrade. */
const RANG_ETAT: Record<Exclude<EtatItem, null>, number> = {
  bon: 0,
  moyen: 1,
  degrade: 2,
};

/**
 * Retourne true si la transition d'état représente une dégradation.
 * Cas : bon→moyen, bon→dégradé, moyen→dégradé.
 * Cas ignorés : amélioration (degrade→bon), identique, null (absent).
 */
export function etatADegrade(avant: EtatItem, apres: EtatItem): boolean {
  if (avant === null || apres === null) return false;
  return RANG_ETAT[apres] > RANG_ETAT[avant];
}

/**
 * Crée un inventaire vide (present=false, etat=null) pour les types donnés.
 * Usage : builders de test et factory EtatDesLieux à vide.
 */
export function inventaireVidePour(types: TypeItemInventaire[]): InventaireItem[] {
  return types.map((t) => InventaireItem.creer({ typeItem: t, present: false, etat: null, note: null }));
}

/**
 * Crée un inventaire complet avec tous les 12 items présents et en bon état.
 * Usage : valeur par défaut du formulaire EDL (Hick's Law D-98).
 */
export function inventaireCompletPresent(): InventaireItem[] {
  return TYPES_ITEM_INVENTAIRE.map((t) =>
    InventaireItem.creer({ typeItem: t, present: true, etat: 'bon', note: null }),
  );
}
