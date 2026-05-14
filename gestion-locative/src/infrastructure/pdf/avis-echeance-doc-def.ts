import { Temporal } from '@js-temporal/polyfill';
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js';
import type { EcheanceLoyer } from '../../domain/encaissements/echeance-loyer.js';
import type { Bailleur } from '../../domain/identite/bailleur.js';
import type { Locataire } from '../../domain/locatif/locataire.js';
import type { Adresse } from '../../domain/_shared/adresse.js';

function formatDateFr(date: Temporal.PlainDate): string {
  const j = String(date.day).padStart(2, '0');
  const m = String(date.month).padStart(2, '0');
  return `${j}/${m}/${date.year}`;
}

/**
 * Construit la définition JSON pdfmake pour un avis d'échéance de loyer (D-66).
 * Généré à la demande — non persisté (D-66).
 */
export function construireAvisEcheance(
  echeance: EcheanceLoyer,
  bailleur: Bailleur,
  locataire: Locataire,
  adresseBien: Adresse,
  dateGeneration: Temporal.PlainDate,
): TDocumentDefinitions {
  const periode = `${formatDateFr(echeance.periodeDebut)} au ${formatDateFr(echeance.periodeFin)}`;
  const echeanceLabel = `À régler avant le ${formatDateFr(echeance.jourEcheanceAttendue)}`;
  const chargesLabel = echeance.modeCharges === 'forfait'
    ? 'Charges forfait mensuel'
    : 'Provisions sur charges';

  return {
    pageSize: 'A4',
    pageMargins: [56, 56, 56, 56],
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.4 },
    styles: {
      titreSection: { fontSize: 14, bold: true },
      sousTitre: { fontSize: 12 },
      labelBloc: { bold: true },
    },
    content: [
      {
        columns: [
          {
            stack: [
              { text: "AVIS D'ÉCHEANCE DE LOYER", style: 'titreSection' },
              { text: `Période : ${periode}`, style: 'sousTitre' },
            ],
          },
          {
            text: `Généré le ${formatDateFr(dateGeneration)}`,
            alignment: 'right',
            fontSize: 10,
          },
        ],
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 4, x2: 483, y2: 4, lineWidth: 1 }],
        margin: [0, 8, 0, 8],
      },
      {
        columns: [
          {
            stack: [
              { text: 'Bailleur', style: 'labelBloc' },
              bailleur.nomComplet,
              bailleur.adresse.rue,
              `${bailleur.adresse.codePostal} ${bailleur.adresse.ville}`,
            ],
          },
          {
            stack: [
              { text: 'Locataire', style: 'labelBloc' },
              `${locataire.prenom} ${locataire.nom}`,
              adresseBien.rue,
              `${adresseBien.codePostal} ${adresseBien.ville}`,
            ],
          },
        ],
      },
      {
        margin: [0, 16, 0, 0],
        table: {
          widths: ['*', 'auto'],
          body: [
            [
              { text: 'Désignation', bold: true, fillColor: '#f3f4f6' },
              { text: 'Montant', bold: true, fillColor: '#f3f4f6', alignment: 'right' as const },
            ],
            [
              'Loyer hors charges',
              { text: echeance.loyerHc.enEuros(), alignment: 'right' as const },
            ],
            [
              chargesLabel,
              { text: echeance.montantCharges.enEuros(), alignment: 'right' as const },
            ],
            [
              { text: 'Total à régler', bold: true },
              { text: echeance.total.enEuros(), alignment: 'right' as const, bold: true, fontSize: 12 },
            ],
          ],
        },
        layout: 'lightHorizontalLines',
      },
      { text: echeanceLabel, margin: [0, 16, 0, 0] },
      {
        text: 'Document non opposable — à titre indicatif.',
        italics: true,
        fontSize: 9,
        margin: [0, 8, 0, 0],
      },
    ],
  };
}
