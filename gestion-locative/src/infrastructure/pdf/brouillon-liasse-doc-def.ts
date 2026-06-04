/**
 * Constructeur pdfmake pour le brouillon liasse fiscale (Phase 6 / FIS-05 / D-L6.4).
 *
 * Fonction pure : à partir d'un `BrouillonLiasseDto` (résolu côté application),
 * produit une `TDocumentDefinitions` pdfmake destinée au PDF d'archivage.
 *
 * Pattern miroir : `recap-fiscal-doc-def.ts`.
 */

import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces.js';

import type { BrouillonLiasseDto } from '../../domain/fiscalite/liasse/case-liasse.js';

const BORDER_NONE = [false, false, false, false] as [boolean, boolean, boolean, boolean];

function bandeauBrouillon(exercice: number): Content {
  return {
    text:
      `Brouillon liasse fiscale ${exercice}. À reporter case-par-case sur votre télédéclaration impots.gouv.fr. `
      + "Ce document n'est pas une transmission officielle.",
    style: 'bandeauAccent',
    margin: [0, 0, 0, 12],
  };
}

function bandeauRectificative(motif: string): Content {
  return {
    text: `Liasse rectificative — motif : ${motif}. Cette version remplace le brouillon précédent. La déclaration originale reste consultable.`,
    style: 'bandeauWarning',
    margin: [0, 0, 0, 12],
  };
}

function bandeauReconciliation(nbPieces: number): Content {
  return {
    text: `Données modifiées depuis la clôture : ${nbPieces} pièce${nbPieces > 1 ? 's' : ''} modifiée${nbPieces > 1 ? 's' : ''}. Les valeurs ci-dessous restent celles validées à la clôture.`,
    style: 'bandeauDestructive',
    margin: [0, 0, 0, 12],
  };
}

function tableauSection(section: BrouillonLiasseDto['sections'][number]): Content {
  const enTete: TableCell[] = [
    { text: 'Case', style: 'thCell' },
    { text: 'Libellé officiel', style: 'thCell' },
    { text: 'Valeur', style: 'thCell', alignment: 'right' },
    { text: 'Sources', style: 'thCell' },
  ];
  const lignes: TableCell[][] = [enTete];
  for (const c of section.cases) {
    lignes.push([
      { text: c.numero, style: 'tdCase' },
      { text: c.libelleOfficiel, fontSize: 9 },
      {
        text: c.valeur ? c.valeur.enEuros() : c.mention ?? '—',
        alignment: 'right',
        fontSize: 9,
      },
      {
        text: c.sources && c.sources.length > 0 ? `${c.sources.length} source(s)` : '—',
        fontSize: 9,
        color: c.sources && c.sources.length > 0 ? '#000000' : '#888888',
      },
    ]);
  }
  const stack: Content[] = [
    { text: section.titre, style: 'h3', margin: [0, 12, 0, 6] },
  ];
  if (section.bandeauPostesManuels) {
    stack.push({
      text:
        'Bilan simplifié (2033-A) : seuls les postes calculables sont remplis. '
        + 'Les autres postes — trésorerie, créances, dettes, emprunts — restent à compléter manuellement sur la télédéclaration.',
      style: 'bandeauNotice',
      margin: [0, 0, 0, 6],
    });
  }
  stack.push({
    table: {
      headerRows: 1,
      widths: [40, '*', 70, 70],
      body: lignes,
    },
    layout: 'lightHorizontalLines',
  });
  return { stack };
}

export function construireBrouillonLiasse(dto: BrouillonLiasseDto): TDocumentDefinitions {
  const content: Content[] = [
    {
      text: `Brouillon liasse fiscale ${dto.exercice} — ${dto.bailleurNom}`,
      style: 'h1',
      margin: [0, 0, 0, 6],
    },
    {
      text: `Régime : ${dto.regimeApplique === 'reel' ? 'Régime réel' : 'Micro-BIC'} · Exercice clôturé le ${dto.clotureLe.toString()}`,
      fontSize: 10,
      margin: [0, 0, 0, 12],
    },
    bandeauBrouillon(dto.exercice),
  ];

  if (dto.motifRectification) {
    content.push(bandeauRectificative(dto.motifRectification));
  }
  if (dto.reconciliation && !dto.reconciliation.cohérent) {
    content.push(bandeauReconciliation(dto.reconciliation.nbPiecesModifiees));
  }

  for (const section of dto.sections) {
    content.push(tableauSection(section));
  }

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    info: {
      title: `Brouillon liasse fiscale ${dto.exercice}`,
      author: dto.bailleurNom,
      subject: `Brouillon liasse ${dto.regimeApplique}`,
      creator: 'gestion-locative',
    },
    content,
    styles: {
      h1: { fontSize: 16, bold: true },
      h3: { fontSize: 12, bold: true },
      thCell: { bold: true, fillColor: '#F0F0F0', fontSize: 9 },
      tdCase: { fontSize: 9, font: 'Roboto' },
      bandeauAccent: { fontSize: 9, italics: true, color: '#1F4E79' },
      bandeauWarning: { fontSize: 9, italics: true, color: '#C2410C' },
      bandeauDestructive: { fontSize: 9, bold: true, color: '#B91C1C' },
      bandeauNotice: { fontSize: 9, italics: true, color: '#555555' },
    },
    defaultStyle: { fontSize: 10 },
  };
}
