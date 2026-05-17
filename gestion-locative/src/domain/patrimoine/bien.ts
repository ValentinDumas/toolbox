import { Temporal } from '@js-temporal/polyfill';
import { InvariantViolated } from '../_shared/erreurs.js';
import { nouveauBienId, type BienId, type LotId } from '../_shared/identifiants.js';
import type { Adresse } from '../_shared/adresse.js';
import type { Lot } from './lot.js';
import type { Diagnostic } from './diagnostic.js';
import type { TypeDiagnostic, ClasseDpe } from '../_shared/duree-validite-diagnostic.js';

export type TypeBien = 'appartement' | 'maison' | 'immeuble' | 'local_commercial';

interface BienProps {
  id?: BienId;
  adresse: Adresse;
  surface: number;
  type: TypeBien;
  anneeConstruction: number;
  lots: Lot[];
  diagnostics?: Diagnostic[];
  classeDpe?: ClasseDpe | null;
}

export interface ModifierBienPatch {
  adresse?: Adresse;
  surface?: number;
  type?: TypeBien;
  anneeConstruction?: number;
}

export class Bien {
  readonly id: BienId;
  readonly adresse: Adresse;
  readonly surface: number;
  readonly type: TypeBien;
  readonly anneeConstruction: number;
  readonly lots: ReadonlyArray<Lot>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  readonly classeDpe: ClasseDpe | null;

  private constructor(id: BienId, props: Omit<BienProps, 'id'>) {
    this.id = id;
    this.adresse = props.adresse;
    this.surface = props.surface;
    this.type = props.type;
    this.anneeConstruction = props.anneeConstruction;
    this.lots = Object.freeze([...props.lots]);
    this.diagnostics = Object.freeze([...(props.diagnostics ?? [])]);
    this.classeDpe = props.classeDpe ?? null;
  }

  static creer(props: BienProps): Bien {
    if (props.surface <= 0) {
      throw new InvariantViolated("La surface d'un Bien doit être strictement positive");
    }

    if (props.lots.length === 0) {
      throw new InvariantViolated("Un Bien doit avoir au moins un Lot");
    }

    const typesValides: TypeBien[] = ['appartement', 'maison', 'immeuble', 'local_commercial'];
    if (!typesValides.includes(props.type)) {
      throw new InvariantViolated(`Le type de bien "${props.type}" est invalide`);
    }

    const anneeActuelle = new Date().getFullYear();
    if (props.anneeConstruction < 1700 || props.anneeConstruction > anneeActuelle + 1) {
      throw new InvariantViolated(`L'année de construction doit être comprise entre 1700 et ${anneeActuelle + 1}`);
    }

    const id = props.id ?? nouveauBienId();
    return new Bien(id, {
      adresse: props.adresse,
      surface: props.surface,
      type: props.type,
      anneeConstruction: props.anneeConstruction,
      lots: props.lots,
      diagnostics: props.diagnostics ?? [],
      classeDpe: props.classeDpe ?? null,
    });
  }

  modifier(patch: ModifierBienPatch): Bien {
    return Bien.creer({
      id: this.id,
      adresse: patch.adresse ?? this.adresse,
      surface: patch.surface ?? this.surface,
      type: patch.type ?? this.type,
      anneeConstruction: patch.anneeConstruction ?? this.anneeConstruction,
      lots: [...this.lots],
      diagnostics: [...this.diagnostics],
      classeDpe: this.classeDpe,
    });
  }

  ajouterLot(lot: Lot): Bien {
    return Bien.creer({
      id: this.id,
      adresse: this.adresse,
      surface: this.surface,
      type: this.type,
      anneeConstruction: this.anneeConstruction,
      lots: [...this.lots, lot],
      diagnostics: [...this.diagnostics],
      classeDpe: this.classeDpe,
    });
  }

  supprimerLot(lotId: LotId): Bien {
    const restants = this.lots.filter((l) => l.id !== lotId);
    if (restants.length === 0) {
      throw new InvariantViolated("Un Bien doit conserver au moins un Lot");
    }
    return Bien.creer({
      id: this.id,
      adresse: this.adresse,
      surface: this.surface,
      type: this.type,
      anneeConstruction: this.anneeConstruction,
      lots: restants,
      diagnostics: [...this.diagnostics],
      classeDpe: this.classeDpe,
    });
  }

  /**
   * Ajoute un Diagnostic au Bien (copy-on-write).
   * Si le diagnostic est de type 'dpe', synchronise automatiquement Bien.classeDpe (DP-14, D-78).
   * Jamais de suppression — historique complet conservé (D-79).
   */
  ajouterDiagnostic(d: Diagnostic): Bien {
    const nouvelleClasseDpe =
      d.type === 'dpe' ? (d.classeDpe ?? this.classeDpe) : this.classeDpe;

    return Bien.creer({
      id: this.id,
      adresse: this.adresse,
      surface: this.surface,
      type: this.type,
      anneeConstruction: this.anneeConstruction,
      lots: [...this.lots],
      diagnostics: [...this.diagnostics, d],
      classeDpe: nouvelleClasseDpe,
    });
  }

  /**
   * Retourne le diagnostic actif (non expiré, le plus récent par dateEmission) pour un type.
   * Retourne null si aucun diagnostic de ce type n'existe (D-79).
   */
  diagnosticActif(type: TypeDiagnostic): Diagnostic | null {
    return (
      this.diagnostics
        .filter((d) => d.type === type)
        .sort((a, b) => Temporal.PlainDate.compare(b.dateEmission, a.dateEmission))[0] ?? null
    );
  }

  /**
   * Retourne true si le DPE du bien est classé F ou G → gel du loyer (D-92, LOC-05).
   * Consommé par simulerIndexation (Phase 3-03).
   */
  estGelLoyer(): boolean {
    return this.classeDpe === 'F' || this.classeDpe === 'G';
  }
}
