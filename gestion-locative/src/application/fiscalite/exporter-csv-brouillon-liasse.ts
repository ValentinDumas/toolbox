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
 * Colonnes : `Annexe;Case;Libellé officiel;Valeur (€);Valeur (brut);Sources`.
 * - Séparateur principal `;` (Excel français).
 * - Séparateur sources `|` (anti-CSV-injection).
 * - BOM `﻿` pour Excel français.
 * - `Money.enEuros()` formate avec espace insécable U+00A0 (lecture humaine).
 * - `Valeur (brut)` = valeur numérique brute (point décimal, sans séparateur de milliers
 *   ni symbole, ex. `12000.00`) — exploitable comme nombre par Excel/LibreOffice (expert-comptable).
 *   Vide pour les cases sans valeur (mention « à compléter manuellement », `—`).
 */
export async function exporterCsvBrouillonLiasse(
  commande: ExporterCsvBrouillonLiasseCommande,
  deps: GenererBrouillonLiasseDeps,
): Promise<ExporterCsvBrouillonLiasse> {
  const dto = await genererBrouillonLiasse(commande, deps);

  const lignes: string[] = [];
  lignes.push(
    ['Annexe', 'Case', 'Libellé officiel', 'Valeur (€)', 'Valeur (brut)', 'Sources'].join(SEP),
  );
  for (const section of dto.sections) {
    for (const c of section.cases) {
      const annexe = sanitizeCsvCell(section.annexe);
      const numero = sanitizeCsvCell(c.numero);
      const libelle = sanitizeCsvCell(c.libelleOfficiel);
      const valeur = sanitizeCsvCell(c.valeur ? c.valeur.enEuros() : c.mention ?? '—');
      // Valeur numérique brute pour exploitation tableur : point décimal, sans séparateur
      // de milliers ni symbole. Vide quand la case n'a pas de valeur calculée.
      const valeurBrute = sanitizeCsvCell(
        c.valeur ? (c.valeur.toSqliteInteger() / 100).toFixed(2) : '',
      );
      const sources = sanitizeCsvCell(
        (c.sources ?? [])
          .map((s) => `${s.type}:${s.url.split('/').pop() ?? ''}`)
          .join(SEP_SOURCES),
      );
      lignes.push([annexe, numero, libelle, valeur, valeurBrute, sources].join(SEP));
    }
  }

  const contenu = BOM + lignes.join('\n');
  const nomFichier = dto.motifRectification
    ? `brouillon-liasse-rectificative-${dto.exercice}.csv`
    : `brouillon-liasse-${dto.exercice}.csv`;

  return { contenu, nomFichier };
}
