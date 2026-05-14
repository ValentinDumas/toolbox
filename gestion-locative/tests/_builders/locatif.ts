import { Temporal } from '@js-temporal/polyfill';
import { Locataire } from '../../src/domain/locatif/locataire.js';
import { Adresse } from '../../src/domain/_shared/adresse.js';
import type { LocataireId, BienId, LotId, BailId } from '../../src/domain/_shared/identifiants.js';
import { Money } from '../../src/domain/_shared/money.js';
import { IRL } from '../../src/domain/_shared/irl.js';
import { Cautionnement } from '../../src/domain/locatif/cautionnement.js';
import { Bail } from '../../src/domain/locatif/bail.js';
import { nouveauBienId, nouveauLotId } from '../../src/domain/_shared/identifiants.js';

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
  });
}
