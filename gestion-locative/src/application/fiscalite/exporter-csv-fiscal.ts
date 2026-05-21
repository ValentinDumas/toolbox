/**
 * Use case exporterCsvFiscal — D-FIS-G5.3.
 *
 * Format CSV :
 *   - UTF-8 BOM (﻿) en début de fichier pour compatibilité Excel
 *   - Séparateur ";" (convention française)
 *   - Colonnes : Type;Montant en euros;Détail
 *   - Nom fichier : declaration-fiscale-{exercice}.csv
 *
 * Sécurité CSV injection (T-05-07-04) :
 *   Toutes les valeurs monétaires passent par Money.enEuros() (Intl.NumberFormat)
 *   qui produit "800,50 €" — jamais de préfixe =, @, +, -.
 *
 * Sources :
 *   - D-FIS-G5.3 : export CSV expert-comptable
 *   - RFC 6266 : Content-Disposition filename*=UTF-8'' (géré dans la route HTTP)
 */

import type { DeclarationAnnuelleId } from '../../domain/_shared/identifiants.js';
import type { DeclarationAnnuelleRepository } from '../../domain/fiscalite/declaration-annuelle-repository.js';

export class DeclarationIntrouvable extends Error {
  constructor(declarationId: string) {
    super(`Déclaration introuvable : ${declarationId}`);
    this.name = 'DeclarationIntrouvable';
  }
}

export interface ExporterCsvFiscalCommande {
  declarationId: DeclarationAnnuelleId;
}

export interface ExporterCsvFiscalDeps {
  declRepo: DeclarationAnnuelleRepository;
}

export interface ExporterCsvFiscalResultat {
  contenu: string;
  nomFichier: string;
}

/**
 * Exporte la déclaration annuelle au format CSV UTF-8 BOM.
 *
 * @throws DeclarationIntrouvable si la déclaration n'existe pas
 */
export async function exporterCsvFiscal(
  commande: ExporterCsvFiscalCommande,
  deps: ExporterCsvFiscalDeps,
): Promise<ExporterCsvFiscalResultat> {
  const { declarationId } = commande;
  const { declRepo } = deps;

  const decl = await declRepo.trouverParId(declarationId);
  if (decl === null) {
    throw new DeclarationIntrouvable(declarationId);
  }

  const BOM = '﻿';
  const SEP = ';';
  const lignes: string[] = [];

  // Header
  lignes.push(`Type${SEP}Montant en euros${SEP}Détail`);

  // Ligne régime
  lignes.push(`Régime fiscal${SEP}${decl.regimeApplique}${SEP}`);

  // Recettes
  lignes.push(`Recettes annuelles${SEP}${decl.recettesTotales.enEuros()}${SEP}`);

  if (decl.regimeApplique === 'reel') {
    // Charges déductibles par catégorie
    const charges = decl.chargesQualifieesParCategorie;
    if (charges.entretien_reparation.centimes > 0n) {
      lignes.push(`Charges entretien/réparation${SEP}${charges.entretien_reparation.enEuros()}${SEP}`);
    }
    if (charges.amelioration.centimes > 0n) {
      lignes.push(`Charges amélioration${SEP}${charges.amelioration.enEuros()}${SEP}`);
    }
    if (charges.charge_courante_periodique.centimes > 0n) {
      lignes.push(`Charges courantes périodiques${SEP}${charges.charge_courante_periodique.enEuros()}${SEP}`);
    }

    // Dotation amortissement
    lignes.push(`Dotation amortissement${SEP}${decl.dotationAmortissement.enEuros()}${SEP}`);

    // ARD
    lignes.push(`ARD généré${SEP}${decl.ardGenere.enEuros()}${SEP}`);
    lignes.push(`ARD consommé${SEP}${decl.ardConsomme.enEuros()}${SEP}`);
  }

  // Résultat fiscal
  const totalCharges = decl.regimeApplique === 'reel'
    ? Object.values(decl.chargesQualifieesParCategorie)
        .reduce((acc, m) => acc.additionner(m), decl.dotationAmortissement)
    : null;

  if (totalCharges !== null) {
    const resultat = decl.recettesTotales.centimes >= totalCharges.centimes
      ? decl.recettesTotales.soustraire(totalCharges)
      : null;
    if (resultat !== null) {
      lignes.push(`Résultat fiscal${SEP}${resultat.enEuros()}${SEP}`);
    }
  }

  // Statut LMNP/LMP
  lignes.push(`Statut LMNP/LMP${SEP}${decl.statutLmnpLmp}${SEP}`);

  // Date de clôture
  lignes.push(`Date de clôture${SEP}${decl.clotureLe.toString()}${SEP}`);

  const contenu = BOM + lignes.join('\n');
  const nomFichier = `declaration-fiscale-${decl.exercice}.csv`;

  return { contenu, nomFichier };
}
