import { Temporal } from '@js-temporal/polyfill';
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js';
import type { EcheanceLoyer } from '../../domain/encaissements/echeance-loyer.js';
import type { Bailleur } from '../../domain/identite/bailleur.js';
import type { Adresse } from '../../domain/_shared/adresse.js';
import type { Money } from '../../domain/_shared/money.js';

/**
 * Interface minimale locataire pour la mise en demeure.
 */
interface LocataireMinimal {
  readonly nom: string;
  readonly prenom: string;
}

/**
 * Interface minimale bail pour la mise en demeure.
 */
interface BailMinimal {
  readonly dateDebut: Temporal.PlainDate;
  readonly dureeMois: number;
  readonly loyerHc: Money;
}

/**
 * Interface minimale bien pour la mise en demeure.
 */
interface BienMinimal {
  readonly adresse: Adresse;
}

function formatDateFr(date: Temporal.PlainDate): string {
  const j = String(date.day).padStart(2, '0');
  const m = String(date.month).padStart(2, '0');
  return `${j}/${m}/${date.year}`;
}

const MOIS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatPeriodeMois(date: Temporal.PlainDate): string {
  return `${MOIS_FR[date.month - 1]} ${date.year}`;
}

/**
 * Construit la définition JSON pdfmake pour une mise en demeure de payer (D-69 niveau 3).
 *
 * Mentions légales Code civil art. 1344 :
 * - Identification bailleur + locataire
 * - Référence bail
 * - Corps juridique (délai 8 jours)
 * - Voies de droit
 * - Tableau détail impayé
 * - Signature
 * - Footer LR/AR
 *
 * Généré à la demande depuis contenuSnapshot — non persisté (cohérent D-66 esprit on-the-fly).
 */
export function construireMiseEnDemeure(
  echeance: EcheanceLoyer,
  _encaissementsLies: unknown[],
  bailleur: Bailleur,
  locataire: LocataireMinimal,
  _bien: BienMinimal,
  adresseBien: Adresse,
  bail: BailMinimal,
  montantTotalDu: Money,
  today: Temporal.PlainDate,
): TDocumentDefinitions {
  const nomCompletLocataire = `${locataire.prenom} ${locataire.nom}`;
  const dateEmission = formatDateFr(today);
  const periodeImpayee = formatPeriodeMois(echeance.periodeDebut);

  return {
    pageSize: 'A4',
    pageMargins: [56, 56, 56, 80],
    compress: false,
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.4 },
    styles: {
      titreSection: { fontSize: 14, bold: true },
      labelBloc: { bold: true },
      total: { bold: true, fontSize: 11 },
      footer: { fontSize: 8, color: '#555555', italics: true },
    },
    content: [
      // ─── BAILLEUR / LOCATAIRE ─────────────────────────────────────────────────
      {
        columns: [
          {
            stack: [
              { text: 'Bailleur', style: 'labelBloc' },
              bailleur.nomComplet,
              bailleur.adresse.rue,
              `${bailleur.adresse.codePostal} ${bailleur.adresse.ville}`,
            ],
            width: '50%',
          },
          {
            stack: [
              { text: 'Destinataire', style: 'labelBloc' },
              nomCompletLocataire,
              adresseBien.rue,
              `${adresseBien.codePostal} ${adresseBien.ville}`,
            ],
            width: '50%',
          },
        ],
        margin: [0, 0, 0, 32] as [number, number, number, number],
      },

      // ─── TITRE ─────────────────────────────────────────────────────────────────
      {
        text: 'MISE EN DEMEURE DE PAYER',
        style: 'titreSection',
        alignment: 'center',
        margin: [0, 0, 0, 24] as [number, number, number, number],
      },

      // ─── RÉFÉRENCE BAIL ─────────────────────────────────────────────────────────
      {
        text: `Bail meublé du ${formatDateFr(bail.dateDebut)} — Bien : ${adresseBien.rue}, ${adresseBien.codePostal} ${adresseBien.ville}`,
        margin: [0, 0, 0, 4] as [number, number, number, number],
      },
      {
        text: `Durée : ${bail.dureeMois} mois — Loyer mensuel : ${bail.loyerHc.enEuros()} HC`,
        margin: [0, 0, 0, 16] as [number, number, number, number],
      },

      // ─── CORPS JURIDIQUE (Code civil art. 1344) ──────────────────────────────────
      {
        text: [
          `Par la présente, je vous mets en demeure de régler, dans un délai de 8 (huit) jours `,
          `à compter de la réception de ce courrier, la somme de `,
          { text: montantTotalDu.enEuros(), bold: true },
          ` correspondant au loyer impayé de la période ${periodeImpayee}.`,
        ],
        margin: [0, 0, 0, 16] as [number, number, number, number],
      },
      {
        text: `À défaut de règlement dans ce délai, je me verrai contraint(e) d'engager toutes les voies de droit nécessaires au recouvrement de cette créance.`,
        margin: [0, 0, 0, 24] as [number, number, number, number],
      },

      // ─── TABLEAU DÉTAIL IMPAYÉ ────────────────────────────────────────────────
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [
              { text: 'Période', bold: true, fillColor: '#f3f4f6' },
              { text: 'Montant dû', bold: true, fillColor: '#f3f4f6', alignment: 'right' as const },
            ],
            [
              periodeImpayee,
              { text: echeance.total.enEuros(), alignment: 'right' as const },
            ],
            [
              { text: 'Total', bold: true },
              { text: montantTotalDu.enEuros(), alignment: 'right' as const, bold: true, fontSize: 11 },
            ],
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 32] as [number, number, number, number],
      },

      // ─── CLÔTURE ─────────────────────────────────────────────────────────────
      {
        text: `Fait le ${dateEmission}, à ${bailleur.adresse.ville}`,
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },
      {
        text: 'Signature :',
        margin: [0, 0, 0, 40] as [number, number, number, number],
      },
    ],

    // ─── PIED DE PAGE ────────────────────────────────────────────────────────
    footer: {
      text: 'Ce courrier doit être envoyé en lettre recommandée avec accusé de réception (AR).',
      style: 'footer',
      alignment: 'center',
      margin: [56, 0, 56, 0] as [number, number, number, number],
    },
  };
}
