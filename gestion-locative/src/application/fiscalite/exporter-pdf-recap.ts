/**
 * Use case exporterPdfRecap — D-FIS-G5.3.
 *
 * Génère le buffer PDF du récapitulatif fiscal annuel pour un bailleur.
 *
 * Orchestration :
 *   1. Charger la déclaration annuelle
 *   2. Charger le bailleur
 *   3. Charger la liste des biens
 *   4. Charger le tableau d'amortissement (exercice N)
 *   5. Construire la TDocumentDefinitions via construireRecapFiscal
 *   6. Générer le buffer PDF via pdfRenderer.genererBuffer()
 *
 * Sources :
 *   - D-FIS-G5.3 : export PDF récap bailleur
 *   - LF 2025 art. 84 : contexte sortie composant (tableau amortissement)
 *   - CGI art. 150 VB III : prorata sortie composant
 */

import type { DeclarationAnnuelleId } from '../../domain/_shared/identifiants.js';
import type { DeclarationAnnuelleRepository } from '../../domain/fiscalite/declaration-annuelle-repository.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { TableauAmortissementRepository } from '../../domain/fiscalite/tableau-amortissement-repository.js';
import type { PdfRenderer } from '../../domain/encaissements/pdf-renderer.js';
import { construireRecapFiscal } from '../../infrastructure/pdf/recap-fiscal-doc-def.js';

export class DeclarationIntrouvablePdf extends Error {
  constructor(declarationId: string) {
    super(`Déclaration introuvable pour le PDF : ${declarationId}`);
    this.name = 'DeclarationIntrouvablePdf';
  }
}

export class BailleurIntrouvable extends Error {
  constructor() {
    super('Bailleur introuvable — profil non configuré');
    this.name = 'BailleurIntrouvable';
  }
}

export interface ExporterPdfRecapCommande {
  declarationId: DeclarationAnnuelleId;
}

export interface ExporterPdfRecapDeps {
  declRepo: DeclarationAnnuelleRepository;
  bailleurRepo: BailleurRepository;
  bienRepo: BienRepository;
  tableauAmortRepo: TableauAmortissementRepository;
}

export interface ExporterPdfRecapResultat {
  buffer: Buffer;
  nomFichier: string;
}

/**
 * Exporte le récapitulatif fiscal annuel en buffer PDF.
 *
 * @throws DeclarationIntrouvablePdf si la déclaration n'existe pas
 * @throws BailleurIntrouvable si le bailleur n'est pas configuré
 */
export async function exporterPdfRecap(
  commande: ExporterPdfRecapCommande,
  deps: ExporterPdfRecapDeps,
  pdfRenderer: PdfRenderer,
): Promise<ExporterPdfRecapResultat> {
  const { declarationId } = commande;
  const { declRepo, bailleurRepo, bienRepo, tableauAmortRepo } = deps;

  // 1. Charger la déclaration
  const decl = await declRepo.trouverParId(declarationId);
  if (decl === null) {
    throw new DeclarationIntrouvablePdf(declarationId);
  }

  // 2. Charger le bailleur
  const bailleur = await bailleurRepo.trouver();
  if (bailleur === null) {
    throw new BailleurIntrouvable();
  }

  // 3. Charger les biens actifs
  const biens = await bienRepo.listerTous();

  // 4. Charger les lignes de tableau d'amortissement pour l'exercice
  // On récupère pour tous les biens — on filtre SYNTHESE_BIEN côté docDef
  const tableauxAmort = await Promise.all(
    biens.map((b) => tableauAmortRepo.listerParBienExercice(b.id, decl.exercice)),
  ).then((listes) => listes.flat());

  // 5. Construire la TDocumentDefinitions
  const docDef = construireRecapFiscal(decl, bailleur, biens, tableauxAmort);

  // 6. Générer le buffer PDF
  const buffer = await pdfRenderer.genererBuffer(docDef);

  const nomFichier = `recap-fiscal-${decl.exercice}.pdf`;

  return { buffer, nomFichier };
}
