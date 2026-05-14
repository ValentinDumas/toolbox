import { Temporal } from '@js-temporal/polyfill';
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js';
import type { EcheanceLoyer } from '../../domain/encaissements/echeance-loyer.js';
import type { Bailleur } from '../../domain/identite/bailleur.js';
import type { Adresse } from '../../domain/_shared/adresse.js';

/**
 * Interface minimale locataire pour la quittance (on n'importe pas la classe domaine).
 * Suffisant pour remplir les mentions légales loi 89 art. 21.
 */
interface LocataireQuittance {
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

function formatDateFr(date: Temporal.PlainDate): string {
  const j = String(date.day).padStart(2, '0');
  const m = String(date.month).padStart(2, '0');
  return `${j}/${m}/${date.year}`;
}

/**
 * Construit la définition JSON pdfmake pour une quittance de loyer (ENC-01, D-63).
 *
 * Mentions légales loi 89-462 art. 21 obligatoires :
 * - Identification du bailleur et du locataire
 * - Période du loyer quittancé
 * - Montant total encaissé (loyer HC + charges)
 * - Mention "Tous comptes apurés"
 * - Référence à l'article 21 de la loi n° 89-462 du 6 juillet 1989
 *
 * @param modeCharges - 'forfait' ou 'provisions' (détermine le libellé charges)
 */
export function construireQuittance(
  echeance: EcheanceLoyer,
  bailleur: Bailleur,
  locataire: LocataireQuittance,
  adresseBien: Adresse,
  numero: string,
  emiseLe: Temporal.PlainDate,
  modeCharges: 'forfait' | 'provisions',
): TDocumentDefinitions {
  const periodeDebut = formatDateLong(echeance.periodeDebut);
  const periodeFin = formatDateLong(echeance.periodeFin);
  const dateEmission = formatDateFr(emiseLe);
  const chargesLabel = modeCharges === 'forfait'
    ? 'Charges locatives (forfait)'
    : 'Provisions sur charges';

  const nomCompletLocataire = `${locataire.prenom} ${locataire.nom}`;

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
      // ─── ENTÊTE ─────────────────────────────────────────────────────────────
      {
        text: `QUITTANCE DE LOYER N° ${numero}`,
        style: 'titreDoc',
        alignment: 'center',
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },
      {
        text: `Période : du ${periodeDebut} au ${periodeFin}`,
        style: 'sousTitre',
        alignment: 'center',
        margin: [0, 0, 0, 24] as [number, number, number, number],
      },

      // ─── BAILLEUR — LOCATAIRE ────────────────────────────────────────────────
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
              { text: 'Au locataire', style: 'labelBloc' },
              nomCompletLocataire,
              adresseBien.rue,
              `${adresseBien.codePostal} ${adresseBien.ville}`,
            ],
            width: '50%',
          },
        ],
        margin: [0, 0, 0, 24] as [number, number, number, number],
      },

      // ─── TABLEAU VENTILATION ─────────────────────────────────────────────────
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [
              { text: 'Désignation', bold: true, fillColor: '#f3f4f6' },
              { text: 'Montant', bold: true, fillColor: '#f3f4f6', alignment: 'right' as const },
            ],
            [
              'Loyer principal hors charges',
              { text: echeance.loyerHc.enEuros(), alignment: 'right' as const },
            ],
            [
              chargesLabel,
              { text: echeance.montantCharges.enEuros(), alignment: 'right' as const },
            ],
            [
              { text: 'Total encaissé', bold: true },
              {
                text: echeance.total.enEuros(),
                alignment: 'right' as const,
                bold: true,
                fontSize: 12,
              },
            ],
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 24] as [number, number, number, number],
      },

      // ─── MENTION LÉGALE LOI 89 ART. 21 ──────────────────────────────────────
      {
        text: [
          'Le bailleur déclare avoir reçu de ',
          { text: nomCompletLocataire, bold: true },
          ' la somme de ',
          { text: echeance.total.enEuros(), bold: true },
          ` au titre du loyer et des charges pour la période du ${periodeDebut} au ${periodeFin}. `,
          { text: 'Tous comptes apurés.', bold: true },
        ],
        style: 'mentionLegale',
        margin: [0, 0, 0, 32] as [number, number, number, number],
      },

      // ─── SIGNATURE ──────────────────────────────────────────────────────────
      {
        columns: [
          {
            stack: [
              `Fait le ${dateEmission}`,
              { text: '\nSignature du bailleur :', margin: [0, 8, 0, 0] as [number, number, number, number] },
              { text: '\n\n', margin: [0, 0, 0, 40] as [number, number, number, number] },
            ],
          },
        ],
      },
    ],

    // ─── PIED DE PAGE ────────────────────────────────────────────────────────
    footer: {
      text: [
        `Établi conformément à l'article 21 de la loi n° 89-462 du 6 juillet 1989. `,
        `Quittance n° ${numero} — non cessible — à conserver.`,
      ],
      style: 'footer',
      alignment: 'center',
      margin: [56, 0, 56, 0] as [number, number, number, number],
    },
  };
}
