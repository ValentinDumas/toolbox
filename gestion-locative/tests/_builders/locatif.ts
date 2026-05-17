import { Temporal } from '@js-temporal/polyfill';
import { Locataire } from '../../src/domain/locatif/locataire.js';
import { Adresse } from '../../src/domain/_shared/adresse.js';
import type { LocataireId, BienId, LotId, BailId } from '../../src/domain/_shared/identifiants.js';
import { Money } from '../../src/domain/_shared/money.js';
import { IRL } from '../../src/domain/_shared/irl.js';
import { Cautionnement } from '../../src/domain/locatif/cautionnement.js';
import { Bail } from '../../src/domain/locatif/bail.js';
import { nouveauBienId, nouveauLotId, nouveauBailId } from '../../src/domain/_shared/identifiants.js';
import {
  InventaireItem,
  TYPES_ITEM_INVENTAIRE,
  inventaireCompletPresent,
  inventaireVidePour,
  type TypeItemInventaire,
  type EtatItem,
} from '../../src/domain/_shared/inventaire-item.js';
import { EtatDesLieux, type TypeEDL } from '../../src/domain/locatif/etat-des-lieux.js';
import type { EtatDesLieuxId, BailIndexationId } from '../../src/domain/_shared/identifiants.js';
import { BailIndexation, type RaisonNonApplication } from '../../src/domain/locatif/bail-indexation.js';

interface OverridesLocataire {
  id?: LocataireId;
  nom?: string;
  prenom?: string;
  dateNaissance?: Temporal.PlainDate;
  communeNaissance?: string;
  paysNaissance?: string;
  nationalite?: string;
  email?: string;
  telephone?: string | null;
  rue?: string;
  codePostal?: string;
  ville?: string;
}

export function unLocataireValide(overrides: OverridesLocataire = {}): Locataire {
  return Locataire.creer({
    id: overrides.id,
    nom: overrides.nom ?? 'Dupont',
    prenom: overrides.prenom ?? 'Marie',
    dateNaissance: overrides.dateNaissance ?? Temporal.PlainDate.from('1985-06-15'),
    lieuNaissance: {
      commune: overrides.communeNaissance ?? 'Paris',
      pays: overrides.paysNaissance ?? 'France',
    },
    nationalite: overrides.nationalite ?? 'française',
    email: overrides.email ?? 'marie@example.fr',
    telephone: overrides.telephone !== undefined ? overrides.telephone : '0123456789',
    adresseActuelle: Adresse.creer({
      rue: overrides.rue ?? '1 rue Test',
      codePostal: overrides.codePostal ?? '75001',
      ville: overrides.ville ?? 'Paris',
    }),
  });
}

/** Builder Money — defaults 80_000n centimes (800 €). */
export function unMontantValide(centimes: bigint = 80_000n): Money {
  return Money.fromCentimes(centimes);
}

/** Builder IRL — defaults { trimestre: "2026-T1", valeur: "145.47" }. */
export function unIrlValide(overrides: { trimestre?: string; valeur?: string } = {}): IRL {
  return IRL.creer({
    trimestre: overrides.trimestre ?? '2026-T1',
    valeur: overrides.valeur ?? '145.47',
  });
}

/** Builder Cautionnement physique avec garant complet. */
export function uneCautionnementPhysique(
  overrides: {
    dateSignature?: Temporal.PlainDate;
    dureeEngagement?: number;
    montantGaranti?: Money | null;
  } = {},
): Cautionnement {
  return Cautionnement.creer({
    type: 'physique',
    garant: {
      nom: 'Martin',
      prenom: 'Jean',
      email: 'jean.martin@example.fr',
      telephone: '0612345678',
      adresse: Adresse.creer({ rue: '10 avenue de la Paix', codePostal: '75008', ville: 'Paris' }),
    },
    montantGaranti: overrides.montantGaranti !== undefined ? overrides.montantGaranti : null,
    dateSignature: overrides.dateSignature ?? Temporal.PlainDate.from('2026-05-01'),
    dureeEngagement: overrides.dureeEngagement ?? 12,
  });
}

interface OverridesBail {
  id?: BailId;
  locataireId?: LocataireId;
  bienId?: BienId;
  lotIds?: LotId[];
  dateDebut?: Temporal.PlainDate;
  dureeMois?: number;
  loyerHc?: Money;
  modeCharges?: 'forfait' | 'provisions';
  montantCharges?: Money;
  depotGarantie?: Money;
  irlReference?: IRL;
  cautionnement?: Cautionnement | null;
  mobilier?: InventaireItem[];
}

/**
 * Builder Bail "indexable" — actif, anniversaire atteignable (Phase 3-03).
 * Defaults : dateDebut 2025-05-01, irlReference 2024-T4/142.06, loyerHc 800€,
 * actif depuis dateDebut.
 */
export function unBailIndexableValide(overrides: OverridesBail = {}): Bail {
  const dateDebut = overrides.dateDebut ?? Temporal.PlainDate.from('2025-05-01');
  return Bail.creer({
    id: overrides.id,
    locataireId: overrides.locataireId ?? (crypto.randomUUID() as LocataireId),
    bienId: overrides.bienId ?? nouveauBienId(),
    lotIds: overrides.lotIds ?? [nouveauLotId()],
    type: 'classique',
    dateDebut,
    dureeMois: overrides.dureeMois ?? 12,
    loyerHc: overrides.loyerHc ?? Money.fromCentimes(80_000n),
    modeCharges: overrides.modeCharges ?? 'forfait',
    montantCharges: overrides.montantCharges ?? Money.fromCentimes(5_000n),
    depotGarantie: overrides.depotGarantie ?? Money.fromCentimes(80_000n),
    irlReference:
      overrides.irlReference ?? IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
    cautionnement: overrides.cautionnement !== undefined ? overrides.cautionnement : null,
    actifDepuis: dateDebut,
    jourEcheance: 1,
    mobilier: overrides.mobilier,
  });
}

/** Builder Bail valide — defaults cohérents avec invariants D-35. */
export function unBailValide(overrides: OverridesBail = {}): Bail {
  return Bail.creer({
    id: overrides.id,
    locataireId: overrides.locataireId ?? (crypto.randomUUID() as LocataireId),
    bienId: overrides.bienId ?? (nouveauBienId()),
    lotIds: overrides.lotIds ?? [nouveauLotId()],
    type: 'classique',
    dateDebut: overrides.dateDebut ?? Temporal.PlainDate.from('2026-06-01'),
    dureeMois: overrides.dureeMois ?? 12,
    loyerHc: overrides.loyerHc ?? Money.fromCentimes(80_000n),
    modeCharges: overrides.modeCharges ?? 'forfait',
    montantCharges: overrides.montantCharges ?? Money.fromCentimes(5_000n),
    depotGarantie: overrides.depotGarantie ?? Money.fromCentimes(80_000n),
    irlReference: overrides.irlReference ?? unIrlValide(),
    cautionnement: overrides.cautionnement !== undefined ? overrides.cautionnement : null,
    mobilier: overrides.mobilier,
  });
}

// ─── InventaireItem builders ─────────────────────────────────────────────────

interface OverridesInventaireItem {
  typeItem?: TypeItemInventaire;
  present?: boolean;
  etat?: EtatItem;
  note?: string | null;
}

export function unInventaireItemValide(overrides: OverridesInventaireItem = {}): InventaireItem {
  const present = overrides.present ?? true;
  const etat = overrides.etat !== undefined ? overrides.etat : (present ? 'bon' : null);
  return InventaireItem.creer({
    typeItem: overrides.typeItem ?? 'literie',
    present,
    etat,
    note: overrides.note !== undefined ? overrides.note : null,
  });
}

export function inventaire12ItemsPresentsBon(): InventaireItem[] {
  return inventaireCompletPresent();
}

export function inventaire12ItemsVides(): InventaireItem[] {
  return inventaireVidePour(TYPES_ITEM_INVENTAIRE);
}

// ─── EtatDesLieux builders ────────────────────────────────────────────────────

interface OverridesEDL {
  id?: EtatDesLieuxId;
  bailId?: BailId;
  type?: TypeEDL;
  dateEdl?: Temporal.PlainDate;
  contradictoire?: boolean;
  dateSignature?: Temporal.PlainDate | null;
  inventaire?: InventaireItem[];
  annuleLe?: Temporal.PlainDate | null;
  raisonAnnulation?: string | null;
}

export function unEtatDesLieuxEntreeValide(overrides: OverridesEDL = {}): EtatDesLieux {
  const contradictoire = overrides.contradictoire ?? true;
  const dateSignature =
    overrides.dateSignature !== undefined
      ? overrides.dateSignature
      : contradictoire
        ? Temporal.PlainDate.from('2026-05-01')
        : null;
  return EtatDesLieux.creer({
    id: overrides.id,
    bailId: overrides.bailId ?? nouveauBailId(),
    type: overrides.type ?? 'entree',
    dateEdl: overrides.dateEdl ?? Temporal.PlainDate.from('2026-05-01'),
    contradictoire,
    dateSignature,
    inventaire: overrides.inventaire ?? inventaire12ItemsPresentsBon(),
    annuleLe: overrides.annuleLe,
    raisonAnnulation: overrides.raisonAnnulation,
  });
}

// ─── BailIndexation builders (Phase 3-04) ─────────────────────────────────────

interface OverridesBailIndexation {
  id?: BailIndexationId;
  bailId?: BailId;
  dateEffet?: Temporal.PlainDate;
  irlAvant?: IRL;
  irlApres?: IRL;
  loyerAvant?: Money;
  loyerApres?: Money;
  indexationAppliquee?: boolean;
  raisonNonApplication?: RaisonNonApplication | null;
}

export function uneBailIndexationAppliqueeValide(
  overrides: OverridesBailIndexation = {},
): BailIndexation {
  return BailIndexation.creer({
    id: overrides.id,
    bailId: overrides.bailId ?? nouveauBailId(),
    dateEffet: overrides.dateEffet ?? Temporal.PlainDate.from('2026-05-01'),
    irlAvant: overrides.irlAvant ?? IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
    irlApres: overrides.irlApres ?? IRL.creer({ trimestre: '2025-T4', valeur: '145.47' }),
    loyerAvant: overrides.loyerAvant ?? Money.fromCentimes(80_000n),
    loyerApres: overrides.loyerApres ?? Money.fromCentimes(81_920n),
    indexationAppliquee: overrides.indexationAppliquee ?? true,
    raisonNonApplication:
      overrides.raisonNonApplication !== undefined ? overrides.raisonNonApplication : null,
  });
}

export function uneBailIndexationRenonceeValide(
  overrides: OverridesBailIndexation = {},
): BailIndexation {
  const loyerAvant = overrides.loyerAvant ?? Money.fromCentimes(80_000n);
  return BailIndexation.creer({
    id: overrides.id,
    bailId: overrides.bailId ?? nouveauBailId(),
    dateEffet: overrides.dateEffet ?? Temporal.PlainDate.from('2026-05-01'),
    irlAvant: overrides.irlAvant ?? IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
    irlApres: overrides.irlApres ?? IRL.creer({ trimestre: '2025-T4', valeur: '145.47' }),
    loyerAvant,
    loyerApres: overrides.loyerApres ?? loyerAvant,
    indexationAppliquee: overrides.indexationAppliquee ?? false,
    raisonNonApplication:
      overrides.raisonNonApplication !== undefined ? overrides.raisonNonApplication : 'refus_bailleur',
  });
}

export function unEtatDesLieuxSortieValide(overrides: OverridesEDL = {}): EtatDesLieux {
  const contradictoire = overrides.contradictoire ?? true;
  const dateSignature =
    overrides.dateSignature !== undefined
      ? overrides.dateSignature
      : contradictoire
        ? Temporal.PlainDate.from('2027-05-01')
        : null;
  return EtatDesLieux.creer({
    id: overrides.id,
    bailId: overrides.bailId ?? nouveauBailId(),
    type: overrides.type ?? 'sortie',
    dateEdl: overrides.dateEdl ?? Temporal.PlainDate.from('2027-05-01'),
    contradictoire,
    dateSignature,
    inventaire: overrides.inventaire ?? inventaire12ItemsPresentsBon(),
    annuleLe: overrides.annuleLe,
    raisonAnnulation: overrides.raisonAnnulation,
  });
}
