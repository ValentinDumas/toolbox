import { Temporal } from '@js-temporal/polyfill';
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js';

import type { Bail } from '../../domain/locatif/bail.js';
import type { Bailleur } from '../../domain/identite/bailleur.js';
import type { Money } from '../../domain/_shared/money.js';
import type { IRL } from '../../domain/_shared/irl.js';

/**
 * Vue minimale Locataire pour l'avenant (on n'importe pas la classe domaine pour
 * éviter un couplage indésirable infra → domaine sur des détails locataire).
 */
interface LocataireAvenant {
  readonly nom: string;
  readonly prenom: string;
}

function formatDateLong(date: Temporal.PlainDate): string {
  const mois = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  const jour = date.day === 1 ? '1er' : String(date.day);
  return `${jour} ${mois[date.month - 1]} ${date.year}`;
}

/**
 * Construit la définition pdfmake pour un avenant IRL (Phase 3-04, D-93).
 *
 * Mentions obligatoires loi 89-462 article 17-1 :
 *   - identification bailleur et locataire,
 *   - ancien et nouveau loyer HC, IRL ancien et nouveau,
 *   - formule légale (rappelée pour transparence — UI-SPEC),
 *   - date d'effet,
 *   - emplacements signature bailleur + locataire,
 *   - footer renvoyant à l'article 17-1 de la loi 89-462.
 */
export function construireAvenantIRL(
  bail: Bail,
  locataire: LocataireAvenant,
  bailleur: Bailleur,
  irlNouveau: IRL,
  irlAncien: IRL,
  loyerAvant: Money,
  loyerApres: Money,
  dateEffet: Temporal.PlainDate,
): TDocumentDefinitions {
  const nomCompletLocataire = `${locataire.prenom} ${locataire.nom}`;
  const dateDebutLong = formatDateLong(bail.dateDebut);
  const dateEffetLong = formatDateLong(dateEffet);

  const formule =
    `${loyerAvant.enEuros()} × (${irlNouveau.valeur} / ${irlAncien.valeur}) = ${loyerApres.enEuros()}`;

  return {
    pageSize: 'A4',
    pageMargins: [56, 56, 56, 80],
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.4 },
    styles: {
      titreDoc: { fontSize: 16, bold: true },
      sousTitre: { fontSize: 12 },
      labelBloc: { bold: true },
      total: { bold: true, fontSize: 12 },
      mentionLegale: { italics: true, fontSize: 10 },
      footer: { fontSize: 8, color: '#555555' },
    },
    content: [
      {
        text: 'AVENANT À LA CONVENTION DE BAIL — Révision IRL',
        style: 'titreDoc',
        alignment: 'center',
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },
      {
        text: `Exercice ${dateEffet.year} — Bail du ${dateDebutLong}`,
        style: 'sousTitre',
        alignment: 'center',
        margin: [0, 0, 0, 24] as [number, number, number, number],
      },

      {
        columns: [
          {
            stack: [
              { text: 'Le bailleur', style: 'labelBloc' },
              bailleur.nomComplet,
              bailleur.adresse.rue,
              `${bailleur.adresse.codePostal} ${bailleur.adresse.ville}`,
            ],
            width: '50%',
          },
          {
            stack: [
              { text: 'Le locataire', style: 'labelBloc' },
              nomCompletLocataire,
            ],
            width: '50%',
          },
        ],
        margin: [0, 0, 0, 24] as [number, number, number, number],
      },

      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [
              { text: 'Élément', bold: true, fillColor: '#f3f4f6' },
              { text: 'Valeur', bold: true, fillColor: '#f3f4f6', alignment: 'right' as const },
            ],
            [
              'Ancien loyer HC',
              { text: loyerAvant.enEuros(), alignment: 'right' as const },
            ],
            [
              'IRL de référence',
              { text: `${irlAncien.trimestre} — ${irlAncien.valeur}`, alignment: 'right' as const },
            ],
            [
              'Nouvel IRL',
              { text: `${irlNouveau.trimestre} — ${irlNouveau.valeur}`, alignment: 'right' as const },
            ],
            [
              { text: 'Nouveau loyer HC', bold: true },
              {
                text: loyerApres.enEuros(),
                alignment: 'right' as const,
                bold: true,
                fontSize: 12,
              },
            ],
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 16] as [number, number, number, number],
      },

      {
        text: `Calcul : ${formule} — formule légale loi 89-462 article 17-1.`,
        style: 'mentionLegale',
        margin: [0, 0, 0, 16] as [number, number, number, number],
      },

      {
        text: `Date d'effet : ${dateEffetLong}.`,
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },

      {
        text: 'Les parties acceptent la révision ci-dessus.',
        margin: [0, 0, 0, 24] as [number, number, number, number],
      },

      {
        columns: [
          {
            stack: [
              { text: 'Signature du bailleur :', style: 'labelBloc' },
              { text: '\n\n', margin: [0, 0, 0, 40] as [number, number, number, number] },
            ],
            width: '50%',
          },
          {
            stack: [
              { text: 'Signature du locataire :', style: 'labelBloc' },
              { text: '\n\n', margin: [0, 0, 0, 40] as [number, number, number, number] },
            ],
            width: '50%',
          },
        ],
      },
    ],

    footer: {
      text: "Conformément à l'article 17-1 de la loi n° 89-462 du 6 juillet 1989.",
      style: 'footer',
      alignment: 'center',
      margin: [56, 0, 56, 0] as [number, number, number, number],
    },
  };
}
