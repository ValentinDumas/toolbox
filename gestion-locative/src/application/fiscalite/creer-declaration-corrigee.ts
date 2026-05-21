/**
 * Use case — créer une DeclarationCorrigee post-clôture (D-FIS-G4.4).
 *
 * APPEND-ONLY STRICT : la déclaration originale RESTE INTACTE.
 * Chaque correction crée une nouvelle ligne dans declarations_corrigees
 * qui pointe vers la même declarationOriginaleId (N corrections successives autorisées).
 *
 * Sources juridiques :
 *   - D-FIS-G4.4 : append-only strict — originale intouchée
 *   - T-05-06-09 : creer-declaration-corrigee NE modifie PAS l'originale
 */

import type { Kysely } from 'kysely';
import type { DB } from '../../infrastructure/db/kysely-types.js';
import { Temporal } from '@js-temporal/polyfill';
import type { DeclarationAnnuelleId, DeclarationCorrigeeId } from '../../domain/_shared/identifiants.js';
import { Money } from '../../domain/_shared/money.js';
import { DeclarationCorrigee } from '../../domain/fiscalite/declaration-corrigee.js';
import type { QualificationFiscale } from '../../domain/fiscalite/qualification-fiscale.js';
import type { VerdictLmp } from '../../domain/fiscalite/verdict-lmp.js';
import type { DeclarationAnnuelleRepository, DeclarationCorrigeeRepository } from '../../domain/fiscalite/declaration-annuelle-repository.js';
/** Exception levée si la déclaration originale est introuvable. */
export class DeclarationOriginaleAbsente extends Error {
  constructor(public readonly declarationOriginaleId: DeclarationAnnuelleId) {
    super(
      `Déclaration originale introuvable : ${declarationOriginaleId} (D-FIS-G4.4)`,
    );
    this.name = 'DeclarationOriginaleAbsente';
  }
}

/** Valeurs corrigées (toutes optionnelles — on merge avec l'originale). */
export interface CorrectionsDeclaration {
  recettesTotalesEuros?: number;
  /** Remplace les charges par catégorie si fourni */
  chargesQualifieesParCategorie?: Record<QualificationFiscale, Money>;
  dotationAmortissementEuros?: number;
  ardGenereEuros?: number;
  ardConsommeEuros?: number;
  revenusFoyerSnapshotEuros?: number | null;
  statutLmnpLmp?: VerdictLmp;
  regimeApplique?: 'micro_bic' | 'reel';
}

/** Commande pour créer une correction. */
export interface CreerDeclarationCorrigeeCommande {
  declarationOriginaleId: DeclarationAnnuelleId;
  motif: string;
  corrections: CorrectionsDeclaration;
}

interface CreerDeclarationCorrigeeRepos {
  declRepo: Pick<DeclarationAnnuelleRepository, 'trouverParId'>;
  declCorrRepo: Pick<DeclarationCorrigeeRepository, 'enregistrer'>;
}

/**
 * Crée une DeclarationCorrigee en append-only.
 *
 * Logique :
 *   1. Lookup declarationOriginale → throw DeclarationOriginaleAbsente si null
 *   2. Fusion : valeurs corrigées écrasent les valeurs originales
 *   3. DeclarationCorrigee.creer avec les valeurs fusionnées
 *   4. Transaction → declCorrRepo.enregistrer (pas de modification de l'originale)
 *   5. Retour DeclarationCorrigeeId
 *
 * @param commande - commande avec id original, motif, corrections partielles
 * @param repos - ports lecture/écriture
 * @param db - instance Kysely pour transaction
 * @returns id de la nouvelle DeclarationCorrigee
 * @throws DeclarationOriginaleAbsente si declarationOriginaleId introuvable
 * @throws InvariantViolated si motif vide (domain guard)
 */
export async function creerDeclarationCorrigee(
  commande: CreerDeclarationCorrigeeCommande,
  repos: CreerDeclarationCorrigeeRepos,
  db: Kysely<DB>,
): Promise<DeclarationCorrigeeId> {
  // (1) Lookup originale (D-FIS-G4.4 — originale doit exister)
  const declOriginale = await repos.declRepo.trouverParId(commande.declarationOriginaleId);
  if (declOriginale === null) {
    throw new DeclarationOriginaleAbsente(commande.declarationOriginaleId);
  }

  const { corrections } = commande;

  // (2) Fusion : valeurs corrigées > valeurs originales pour les champs fournis
  // Les champs non fournis dans corrections héritent des valeurs de l'originale

  const recettesTotales =
    corrections.recettesTotalesEuros !== undefined
      ? Money.fromCentimes(BigInt(Math.round(corrections.recettesTotalesEuros * 100)))
      : declOriginale.recettesTotales;

  const chargesQualifieesParCategorie =
    corrections.chargesQualifieesParCategorie ?? declOriginale.chargesQualifieesParCategorie;

  const dotationAmortissement =
    corrections.dotationAmortissementEuros !== undefined
      ? Money.fromCentimes(BigInt(Math.round(corrections.dotationAmortissementEuros * 100)))
      : declOriginale.dotationAmortissement;

  const ardGenere =
    corrections.ardGenereEuros !== undefined
      ? Money.fromCentimes(BigInt(Math.round(corrections.ardGenereEuros * 100)))
      : declOriginale.ardGenere;

  const ardConsomme =
    corrections.ardConsommeEuros !== undefined
      ? Money.fromCentimes(BigInt(Math.round(corrections.ardConsommeEuros * 100)))
      : declOriginale.ardConsomme;

  let revenusFoyerSnapshot: Money | null;
  if (corrections.revenusFoyerSnapshotEuros !== undefined) {
    revenusFoyerSnapshot =
      corrections.revenusFoyerSnapshotEuros !== null
        ? Money.fromCentimes(BigInt(Math.round(corrections.revenusFoyerSnapshotEuros * 100)))
        : null;
  } else {
    revenusFoyerSnapshot = declOriginale.revenusFoyerSnapshot;
  }

  const statutLmnpLmp = corrections.statutLmnpLmp ?? declOriginale.statutLmnpLmp;
  const regimeApplique = corrections.regimeApplique ?? declOriginale.regimeApplique;

  // (3) Création de la correction (domain factory avec invariants)
  const correction = DeclarationCorrigee.creer({
    declarationOriginaleId: commande.declarationOriginaleId,
    motif: commande.motif,
    regimeApplique,
    recettesTotales,
    chargesQualifieesParCategorie,
    dotationAmortissement,
    ardGenere,
    ardConsomme,
    revenusFoyerSnapshot,
    statutLmnpLmp,
    creeLe: Temporal.Now.plainDateTimeISO(),
  });

  // (4) Transaction append-only — PAS de modification de l'originale (T-05-06-09)
  await db.transaction().execute(async (trx) => {
    await repos.declCorrRepo.enregistrer(correction, trx);
    // NOTE : repos.declRepo.enregistrer(declOriginale) N'EST PAS appelé ici — originale intouchée
  });

  return correction.id;
}
