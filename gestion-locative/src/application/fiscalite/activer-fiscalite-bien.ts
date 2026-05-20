/**
 * Use case activer-fiscalite-bien — orchestration (D-FIS-G1.4).
 *
 * Crée 1 ValorisationFiscale + 6 Composants initiaux (1 terrain + 5 amortissables)
 * en 1 transaction atomique Kysely.
 *
 * Étapes (D-FIS-G1.1, G1.3, G1.4) :
 *   1. Lookup Bien — throw BienIntrouvable si absent
 *   2. Vérification idempotence — throw BienDejaActifFiscalement si VF déjà existe (T-05-03-01)
 *   3. Calcul terrain.montantHt = prixAcquisition × quotePartTerrainRatio
 *   4. Construction des 6 Composants initiaux (terrain + 5 amortissables)
 *   5. Vérification Σ composants = prixAcquisition — throw ComposantsSommeIncoherente (D-FIS-G1.1)
 *   6. Répartition frais acquisition au prorata — repartirFraisAcquisition (D-FIS-G1.3)
 *   7. MAJ montantHt de chaque composant amortissable avec sa quote-part frais
 *   8. Transaction atomique : persister ValorisationFiscale + 6 Composants
 *   9. Retour : { valorisationId, composantIds }
 *
 * Sources juridiques :
 *   - BOFIP-BIC-AMT-10-20 §110 : frais d'acquisition au prorata (D-FIS-G1.3)
 *   - D-FIS-G1.4 : écran dédié "Activer fiscalité réelle" — Bien utilisable sans valorisation
 *   - D-FIS-G1.1 : invariant Σ composants = prixAcquisition
 *   - T-05-03-01 : UNIQUE(bien_id) + lookup préalable = double défense contre double activation
 */

import { Temporal } from '@js-temporal/polyfill';
import type { Kysely } from 'kysely';

import type { DB } from '../../infrastructure/db/kysely-types.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type {
  ComposantRepository,
  ValorisationFiscaleRepository,
} from '../../domain/fiscalite/composant-repository.js';
import {
  Composant,
} from '../../domain/fiscalite/composant.js';
import type { TypeComposantBofip } from '../../domain/fiscalite/regles/regles-2026.js';
import { ValorisationFiscale } from '../../domain/fiscalite/valorisation-fiscale.js';
import { ComposantsSommeIncoherente } from '../../domain/fiscalite/erreurs.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import { Money } from '../../domain/_shared/money.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type {
  BienId,
  ComposantId,
  ValorisationFiscaleId,
} from '../../domain/_shared/identifiants.js';
import type { RegleFiscale2026 } from '../../domain/fiscalite/regles/regles-2026.js';
import { repartirFraisAcquisition } from './repartir-frais-acquisition.js';

/**
 * Erreur : tentative d'activation fiscale sur un Bien déjà actif.
 * T-05-03-01 : idempotence garantie par lookup préalable + UNIQUE DB.
 */
export class BienDejaActifFiscalement extends Error {
  constructor(bienId: BienId) {
    super(
      `Le bien ${bienId} a déjà une valorisation fiscale active. ` +
        `L'activation fiscale ne peut être effectuée qu'une seule fois (D-FIS-G1.4).`,
    );
    this.name = 'BienDejaActifFiscalement';
  }
}

/** Ligne de composant amortissable dans la commande (sans terrain — calculé en interne) */
export interface ComposantAmortissableInput {
  type: Exclude<TypeComposantBofip, 'terrain'>;
  montantHt: Money;
}

export interface ActiverFiscaliteBienCommande {
  bienId: BienId;
  prixAcquisition: Money;
  dateAcquisition: Temporal.PlainDate;
  fraisNotaire: Money;
  fraisAgence: Money;
  quotePartTerrainRatio: number;
  /** Les 5 composants amortissables (terrain calculé en interne via quotePartTerrainRatio) */
  composantsAmortissables: ComposantAmortissableInput[];
}

export interface ActiverFiscaliteBienResult {
  valorisationId: ValorisationFiscaleId;
  composantIds: ComposantId[];
}

interface Repos {
  bienRepo: BienRepository;
  valorisationRepo: ValorisationFiscaleRepository;
  composantRepo: ComposantRepository;
}

/**
 * Orchestre l'activation de la fiscalité réelle pour un Bien.
 *
 * D-FIS-G1.1 : invariant Σ composants = prixAcquisition vérifié avant persistance.
 * D-FIS-G1.3 : frais répartis au prorata sur composants amortissables (BOFIP-BIC-AMT-10-20 §110).
 * D-FIS-G1.4 : le Bien reste utilisable sans valorisation (Phases 1–4 non impactées).
 * T-05-03-01 : lookup préalable + UNIQUE DB = double défense.
 */
export async function activerFiscaliteBien(
  cmd: ActiverFiscaliteBienCommande,
  repos: Repos,
  clock: Clock,
  regleFiscale: RegleFiscale2026,
  db: Kysely<DB>,
): Promise<ActiverFiscaliteBienResult> {
  // 1. Lookup Bien
  const bien = await repos.bienRepo.trouverParId(cmd.bienId);
  if (!bien) {
    throw new BienIntrouvable(cmd.bienId);
  }

  // 2. Vérification idempotence (T-05-03-01)
  const vfExistante = await repos.valorisationRepo.trouverParBien(cmd.bienId);
  if (vfExistante !== null) {
    throw new BienDejaActifFiscalement(cmd.bienId);
  }

  // 3. Calculer terrain.montantHt = prixAcquisition × quotePartTerrainRatio
  // Conversion float → BigInt : Math.round(ratio * 10000) pour 4 décimales
  const ratioNum = BigInt(Math.round(cmd.quotePartTerrainRatio * 10_000));
  const terrainMontantHt = cmd.prixAcquisition.multiplyByFraction(ratioNum, 10_000n);

  const today = clock.aujourdhui();

  // 4. Construire le composant terrain
  const composantTerrain = Composant.creer({
    bienId: cmd.bienId,
    type: 'terrain',
    montantHt: terrainMontantHt,
    dateAcquisition: cmd.dateAcquisition,
    origineKind: 'initial',
  });

  // 5. Construire les 5 composants amortissables
  const composantsAmortissables = cmd.composantsAmortissables.map((input) =>
    Composant.creer({
      bienId: cmd.bienId,
      type: input.type,
      montantHt: input.montantHt,
      dateAcquisition: cmd.dateAcquisition,
      origineKind: 'initial',
    }),
  );

  // Tous les composants : terrain + 5 amortissables
  const tousComposants = [composantTerrain, ...composantsAmortissables];

  // 6. Vérification Σ composants = prixAcquisition (D-FIS-G1.1)
  const sommeComposants = tousComposants.reduce(
    (acc, c) => acc.additionner(c.montantHt),
    Money.zero(),
  );

  if (!sommeComposants.egale(cmd.prixAcquisition)) {
    throw new ComposantsSommeIncoherente(cmd.prixAcquisition, sommeComposants);
  }

  // 7. Répartir les frais d'acquisition (D-FIS-G1.3 — BOFIP-BIC-AMT-10-20 §110)
  const fraisTotal = cmd.fraisNotaire.additionner(cmd.fraisAgence);
  const repartition = repartirFraisAcquisition({
    composants: composantsAmortissables, // Terrain exclu de la répartition
    fraisTotal,
  });

  // 8. MAJ montantHt des composants amortissables avec leur quote-part de frais
  const composantsEnrichisFrais = composantsAmortissables.map((c) => {
    const quotePart = repartition.get(c.id);
    if (!quotePart) return c; // Si frais = 0, pas de quote-part
    // Recréer via creer avec montantHt enrichi (copy-on-write)
    return Composant.creer({
      ...c.toProps(),
      montantHt: c.montantHt.additionner(quotePart),
    });
  });

  // 9. Créer la ValorisationFiscale
  const vf = ValorisationFiscale.creer({
    bienId: cmd.bienId,
    prixAcquisition: cmd.prixAcquisition,
    dateAcquisition: cmd.dateAcquisition,
    fraisNotaire: cmd.fraisNotaire,
    fraisAgence: cmd.fraisAgence,
    quotePartTerrainRatio: cmd.quotePartTerrainRatio,
    activeLe: today.toPlainDateTime({ hour: 0, minute: 0, second: 0 }),
  });

  // 10. Transaction atomique : persister ValorisationFiscale + 6 Composants
  const composantsFinaux = [composantTerrain, ...composantsEnrichisFrais];

  await db.transaction().execute(async (trx) => {
    await repos.valorisationRepo.enregistrer(vf, trx);
    await repos.composantRepo.enregistrerBatch(composantsFinaux, trx);
  });

  return {
    valorisationId: vf.id,
    composantIds: composantsFinaux.map((c) => c.id),
  };
}
