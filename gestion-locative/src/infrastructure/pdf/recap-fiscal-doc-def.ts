/**
 * Constructeur de définition pdfmake pour le récapitulatif fiscal annuel LMNP.
 *
 * Mentions légales incluses :
 *   - CGI art. 50-0 : seuils micro-BIC
 *   - CGI art. 39 : charges déductibles en régime réel
 *   - CGI art. 39 B : ARD reportable sans limite
 *   - D-FIS-G5.3 : export PDF récap bailleur
 *
 * Sources :
 *   - D-FIS-G5.3 : export PDF bailleur
 *   - CGI art. 50-0, 39, 39 B
 */

import type { TDocumentDefinitions } from 'pdfmake/interfaces.js';

import type { Bailleur } from '../../domain/identite/bailleur.js';
import type { Bien } from '../../domain/patrimoine/bien.js';
import type { DeclarationAnnuelle } from '../../domain/fiscalite/declaration-annuelle.js';
import type { AmortissementExercice } from '../../domain/fiscalite/amortissement-exercice.js';
import { Money } from '../../domain/_shared/money.js';

/**
 * Construit la TDocumentDefinitions pdfmake pour le récapitulatif fiscal bailleur.
 *
 * @param decl - déclaration annuelle clôturée
 * @param bailleur - identité bailleur (mentions légales)
 * @param biens - liste des biens (pour affichage patrimoine)
 * @param tableauxAmort - lignes AmortissementExercice de l'exercice
 */
export function construireRecapFiscal(
  decl: DeclarationAnnuelle,
  bailleur: Bailleur,
  biens: Bien[],
  tableauxAmort: AmortissementExercice[],
): TDocumentDefinitions {
  const exercice = decl.exercice;
  const regime = decl.regimeApplique === 'reel' ? 'Régime réel simplifié' : 'Micro-BIC (abattement 50 %)';

  // Calcul résultat fiscal
  let resultatFiscal = Money.zero();
  if (decl.regimeApplique === 'reel') {
    const totalCharges = Object.values(decl.chargesQualifieesParCategorie)
      .reduce((acc, m) => acc.additionner(m), decl.dotationAmortissement);
    if (decl.recettesTotales.centimes >= totalCharges.centimes) {
      resultatFiscal = decl.recettesTotales.soustraire(totalCharges);
    }
  }

  // Lignes de synthèse
  const lignesSynthese: [string, string][] = [
    ['Régime fiscal', regime],
    ['Recettes annuelles', decl.recettesTotales.enEuros()],
  ];

  if (decl.regimeApplique === 'reel') {
    const charges = decl.chargesQualifieesParCategorie;
    lignesSynthese.push(
      ['Charges entretien/réparation', charges.entretien_reparation.enEuros()],
      ['Charges amélioration', charges.amelioration.enEuros()],
      ['Charges courantes périodiques', charges.charge_courante_periodique.enEuros()],
      ['Dotation amortissement', decl.dotationAmortissement.enEuros()],
      ['ARD généré', decl.ardGenere.enEuros()],
      ['ARD consommé', decl.ardConsomme.enEuros()],
      ['Résultat fiscal', resultatFiscal.enEuros()],
    );
  }

  lignesSynthese.push(
    ['Statut LMNP/LMP', decl.statutLmnpLmp],
    ['Date de clôture', decl.clotureLe.toString()],
  );

  const tableauBody: unknown[][] = [
    [
      { text: 'Élément', bold: true, fillColor: '#f3f4f6' },
      { text: 'Valeur', bold: true, fillColor: '#f3f4f6', alignment: 'right' as const },
    ],
    ...lignesSynthese.map(([label, valeur]) => [
      label,
      { text: valeur, alignment: 'right' as const },
    ]),
  ];

  // Lignes patrimoine
  const biensList = biens.map((b) => ({
    text: `${b.adresse.rue}, ${b.adresse.codePostal} ${b.adresse.ville} — ${b.surface} m²`,
  }));

  // Lignes amortissement (lignes SYNTHESE_BIEN uniquement)
  const syntheseAmort = tableauxAmort.filter((l) => l.typeLigne === 'SYNTHESE_BIEN');
  const amortBody: unknown[][] = syntheseAmort.length > 0
    ? [
        [
          { text: 'Bien', bold: true, fillColor: '#f3f4f6' },
          { text: 'Dotation théorique', bold: true, fillColor: '#f3f4f6', alignment: 'right' as const },
          { text: 'ARD cumulé dispo', bold: true, fillColor: '#f3f4f6', alignment: 'right' as const },
        ],
        ...syntheseAmort.map((l) => [
          l.bienId,
          { text: l.dotationTheorique.enEuros(), alignment: 'right' as const },
          { text: (l.ardCumuleDisponible ?? Money.zero()).enEuros(), alignment: 'right' as const },
        ]),
      ]
    : [];

  return {
    pageSize: 'A4',
    pageMargins: [56, 56, 56, 80],
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.4 },
    styles: {
      titreDoc: { fontSize: 16, bold: true },
      sousTitre: { fontSize: 12 },
      labelBloc: { bold: true },
      sectionHeader: { fontSize: 11, bold: true, margin: [0, 16, 0, 8] as [number, number, number, number] },
      footer: { fontSize: 8, color: '#555555' },
    },
    content: [
      {
        text: `RÉCAPITULATIF FISCAL LMNP — Exercice ${exercice}`,
        style: 'titreDoc',
        alignment: 'center',
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },
      {
        text: bailleur.nomComplet,
        style: 'sousTitre',
        alignment: 'center',
        margin: [0, 0, 0, 4] as [number, number, number, number],
      },
      {
        text: `${bailleur.adresse.rue}, ${bailleur.adresse.codePostal} ${bailleur.adresse.ville}`,
        alignment: 'center',
        margin: [0, 0, 0, 24] as [number, number, number, number],
      },

      // Section Synthèse fiscale
      { text: 'SYNTHÈSE FISCALE', style: 'sectionHeader' },
      {
        table: {
          widths: ['*', 'auto'],
          body: tableauBody,
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 16] as [number, number, number, number],
      },

      // Section Patrimoine
      { text: 'PATRIMOINE LOCATIF', style: 'sectionHeader' },
      biensList.length > 0
        ? { ul: biensList }
        : { text: 'Aucun bien enregistré.', italics: true },

      // Section Amortissement (si données disponibles)
      ...(amortBody.length > 0
        ? [
            { text: 'TABLEAU D\'AMORTISSEMENT', style: 'sectionHeader' },
            {
              table: {
                widths: ['*', 'auto', 'auto'],
                body: amortBody,
              },
              layout: 'lightHorizontalLines',
              margin: [0, 0, 0, 16] as [number, number, number, number],
            },
          ]
        : []),

      // Mentions légales
      {
        text: 'Ce document est établi à titre informatif. Il ne constitue pas un avis fiscal.',
        italics: true,
        fontSize: 8,
        margin: [0, 24, 0, 0] as [number, number, number, number],
      },
    ],

    footer: {
      text: `Généré le ${new Date().toLocaleDateString('fr-FR')} — CGI art. 50-0, 39, 39 B — D-FIS-G5.3`,
      style: 'footer',
      alignment: 'center',
      margin: [56, 0, 56, 0] as [number, number, number, number],
    },
  };
}
