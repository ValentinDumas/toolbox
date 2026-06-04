import type { DeclarationAnnuelleId, DeclarationCorrigeeId } from '../../domain/_shared/identifiants.js';
import {
  genererBrouillonLiasse,
  type GenererBrouillonLiasseDeps,
} from './generer-brouillon-liasse.js';

const BOM = '﻿';
const SEP = ';';
const SEP_SOURCES = '|';

/**
 * Mitigation T-05-07-04 + T-06-LIASSE-01 (CSV injection — Excel formula).
 *
 * Préfixe un guillemet simple `'` quand la cellule commence par un caractère
 * que les tableurs interprètent comme formule (`=`, `+`, `-`, `@`, `\t`, `\r`).
 */
function sanitizeCsvCell(value: string): string {
  const dangereux = ['=', '+', '-', '@', '\t', '\r'];
  if (dangereux.some((p) => value.startsWith(p))) {
    return "'" + value;
  }
  return value;
}

export type ExporterCsvBrouillonLiasseCommande =
  | { readonly declarationId: DeclarationAnnuelleId }
  | { readonly declarationCorrigeeId: DeclarationCorrigeeId };

export interface ExporterCsvBrouillonLiasse {
  readonly contenu: string;
  readonly nomFichier: string;
}

/**
 * Use case — exporter le brouillon liasse au format CSV (Phase 6 / FIS-05 / D-L6.4).
 *
 * Colonnes : `Annexe;Case;Libellé officiel;Valeur (€);Sources`.
 * - Séparateur principal `;` (Excel français).
 * - Séparateur sources `|` (anti-CSV-injection).
 * - BOM `﻿` pour Excel français.
 * - `Money.enEuros()` formate avec espace insécable U+00A0.
 */
export async function exporterCsvBrouillonLiasse(
  commande: ExporterCsvBrouillonLiasseCommande,
  deps: GenererBrouillonLiasseDeps,
): Promise<ExporterCsvBrouillonLiasse> {
  const dto = await genererBrouillonLiasse(commande, deps);

  const lignes: string[] = [];
  lignes.push(['Annexe', 'Case', 'Libellé officiel', 'Valeur (€)', 'Sources'].join(SEP));
  for (const section of dto.sections) {
    for (const c of section.cases) {
      const annexe = sanitizeCsvCell(section.annexe);
      const numero = sanitizeCsvCell(c.numero);
      const libelle = sanitizeCsvCell(c.libelleOfficiel);
      const valeur = sanitizeCsvCell(c.valeur ? c.valeur.enEuros() : c.mention ?? '—');
      const sources = sanitizeCsvCell(
        (c.sources ?? [])
          .map((s) => `${s.type}:${s.url.split('/').pop() ?? ''}`)
          .join(SEP_SOURCES),
      );
      lignes.push([annexe, numero, libelle, valeur, sources].join(SEP));
    }
  }

  const contenu = BOM + lignes.join('\n');
  const nomFichier = dto.motifRectification
    ? `brouillon-liasse-rectificative-${dto.exercice}.csv`
    : `brouillon-liasse-${dto.exercice}.csv`;

  return { contenu, nomFichier };
}
