/**
 * Use case `genererBrouillonLiasse` — Phase 6 / FIS-05 / Plan 06-01 Task 2.
 *
 * **Wave 1 — fondation régime réel.** Plans 02-05 ajoutent :
 *   - Plan 02 : micro-BIC (rendu 2042-C-PRO) → supprime `RegimeMicroBicNonSupporteWave1`.
 *   - Plan 03 : traçabilité par case (drill-down sources vivantes + réconciliation).
 *   - Plan 04 : rectificative depuis `DeclarationCorrigee` + bandeau motif.
 *   - Plan 05 : exports PDF/CSV (réutilise DTO via `BrouillonLiasseBuilder` port).
 *
 * Pattern miroir : `application/fiscalite/exporter-pdf-recap.ts` (orchestration
 * cross-BC). RESEARCH.md Pattern critique 7.
 *
 * Sources / décisions implémentées :
 *   - D-L6.1 : case-par-case orchestré via mapping (numero + libellé + valeur).
 *   - D-L6.3 : provider versionné + fail-fast `MappingLiasseAbsent` propagé.
 *   - D-T6.4 : valeurs depuis snapshot uniquement. Aucun recalcul UI.
 *   - D-A6.2 : `bandeauPostesManuels: true` sur 2033-A + mention sur cases manuelles.
 *   - D-A6.3 : 2033-B = cœur (recettes + charges qualifiées + dotation + résultat).
 *   - D-A6.4 : 2033-C (composants snapshot) + 2033-D (ARD via `ardGenere/Consomme`).
 *   - Anti-pattern §3 RESEARCH.md : `amelioration` immobilisé → JAMAIS sur la case
 *     "Autres charges externes" de la 2033-B (filtre strict entretien + courante).
 */

import { Money } from '../../domain/_shared/money.js';
import type { DeclarationAnnuelleId } from '../../domain/_shared/identifiants.js';
import type { DeclarationAnnuelle } from '../../domain/fiscalite/declaration-annuelle.js';
import type { DeclarationAnnuelleRepository } from '../../domain/fiscalite/declaration-annuelle-repository.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { MappingLiasseProvider } from '../../domain/fiscalite/liasse/mapping-liasse-provider.js';
import type {
  AnnexeLiasse,
  BrouillonLiasseDto,
  CaseLiasseDef,
  CaseLiasseDto,
  SectionLiasseDto,
  SourceCleSnapshot,
} from '../../domain/fiscalite/liasse/case-liasse.js';

/** Annexes rendues en régime réel (2031-SD + bilan/résultat/immobilisations/déficits). */
const ANNEXES_REEL: ReadonlyArray<AnnexeLiasse> = [
  '2031-SD',
  '2033-A',
  '2033-B',
  '2033-C',
  '2033-D',
] as const;

/** Annexes rendues en régime micro-BIC (Plan 06-02 — D-L6.2). */
const ANNEXES_MICRO: ReadonlyArray<AnnexeLiasse> = ['2042-C-PRO'] as const;

/** Libellés affichables des annexes (titre `<h3>` de chaque section S2 UI-SPEC). */
const TITRES_ANNEXES: Readonly<Record<AnnexeLiasse, string>> = {
  '2031-SD': "2031-SD — Déclaration de résultats BIC",
  '2033-A': "2033-A — Bilan simplifié",
  '2033-B': "2033-B — Compte de résultat",
  '2033-C': "2033-C — Immobilisations et amortissements",
  '2033-D': "2033-D — Provisions, déficits, ARD",
  '2042-C-PRO': "2042-C-PRO — Report micro-BIC",
};

/** Mention par défaut affichée sur les cases dont la valeur ne peut être calculée Wave 1. */
const MENTION_MANUELLE = 'à compléter manuellement';

/**
 * Levée si la déclaration cible est introuvable côté repository.
 * Pattern miroir `DeclarationIntrouvable` d'`exporter-csv-fiscal.ts`.
 */
export class DeclarationIntrouvableLiasse extends Error {
  constructor(public readonly declarationId: string) {
    super(`Déclaration introuvable pour brouillon liasse : ${declarationId}`);
    this.name = 'DeclarationIntrouvableLiasse';
  }
}

/**
 * Levée si le bailleur singleton n'est pas configuré.
 * Pattern miroir `BailleurIntrouvable` d'`exporter-pdf-recap.ts`.
 */
export class BailleurIntrouvableLiasse extends Error {
  constructor() {
    super('Bailleur introuvable — profil non configuré (brouillon liasse)');
    this.name = 'BailleurIntrouvableLiasse';
  }
}

/**
 * @deprecated Plan 06-02 — micro-BIC est désormais supporté (D-L6.2). Conservé
 * pour la rétro-compatibilité des imports nommés. Plus jamais levée.
 */
export class RegimeMicroBicNonSupporteWave1 extends Error {
  constructor() {
    super('Régime micro-BIC : brouillon disponible Plan 02 (FIS-05 micro)');
    this.name = 'RegimeMicroBicNonSupporteWave1';
  }
}

export interface GenererBrouillonLiasseCommande {
  readonly declarationId: DeclarationAnnuelleId;
}

export interface GenererBrouillonLiasseDeps {
  readonly declRepo: DeclarationAnnuelleRepository;
  readonly bailleurRepo: BailleurRepository;
  readonly mappingProvider: MappingLiasseProvider;
}

interface ComposantSnapshotItem {
  readonly type: string;
  readonly montantHt: number;
  readonly amortissementCumule?: number;
}

interface AgregatsComposants {
  readonly constructionsBrut: Money;
  readonly mobilierBrut: Money;
  readonly amortissementsConstructions: Money | null;
  readonly amortissementsMobilier: Money | null;
}

const TYPES_CONSTRUCTIONS = new Set([
  'gros_oeuvre',
  'toiture_facade',
  'installations_techniques',
  'agencements_interieurs',
]);

/**
 * Agrège les composants du snapshot par grandes catégories cerfa 2033-A/C.
 *
 * Le snapshot est une chaîne JSON sérialisée immuable (D-FIS-G4.2). On le parse
 * tolérant aux composants partiels — si `amortissementCumule` n'est pas porté
 * par Phase 5, on retourne `null` et la case 2033-A correspondante est marquée
 * "à compléter manuellement" (D-A6.2 honnête).
 */
function agregerComposantsSnapshot(decl: DeclarationAnnuelle): AgregatsComposants {
  let composants: ReadonlyArray<ComposantSnapshotItem> = [];
  try {
    const parsed = JSON.parse(decl.composantsSnapshot);
    if (Array.isArray(parsed)) {
      composants = parsed as ComposantSnapshotItem[];
    }
  } catch {
    composants = [];
  }

  const additionner = (arr: ReadonlyArray<number>): Money =>
    arr.reduce<Money>((acc, n) => acc.additionner(Money.fromCentimes(BigInt(n))), Money.zero());

  const constructions = composants.filter((c) => TYPES_CONSTRUCTIONS.has(c.type));
  const mobilier = composants.filter((c) => c.type === 'mobilier');

  const constructionsBrut = additionner(constructions.map((c) => c.montantHt));
  const mobilierBrut = additionner(mobilier.map((c) => c.montantHt));

  const auMoinsUnAmort = (arr: ReadonlyArray<ComposantSnapshotItem>): boolean =>
    arr.some((c) => typeof c.amortissementCumule === 'number');

  const amortissementsConstructions = auMoinsUnAmort(constructions)
    ? additionner(constructions.map((c) => c.amortissementCumule ?? 0))
    : null;
  const amortissementsMobilier = auMoinsUnAmort(mobilier)
    ? additionner(mobilier.map((c) => c.amortissementCumule ?? 0))
    : null;

  return {
    constructionsBrut,
    mobilierBrut,
    amortissementsConstructions,
    amortissementsMobilier,
  };
}

/**
 * Calcule le résultat fiscal à partir du snapshot uniquement (D-T6.4).
 *
 * Formule simplifiée Wave 1 (cohérente avec `exporter-csv-fiscal.ts` Phase 5) :
 *   `résultat = recettes - (Σ charges qualifiées) - dotation + ardConsomme - ardGenere`
 *
 * Détail :
 *   - On agrège TOUTES les catégories `ChargesQualifieesParCategorie` car
 *     `cloturer-exercice` (Phase 5) a déjà filtré les non-déductibles à l'écriture.
 *   - Bénéfice positif → `beneficeFiscal` (CB), `deficitFiscal` (CC) → null.
 *   - Sinon → `deficitFiscal` porte `|résultat|`, `beneficeFiscal` → null.
 */
function calculerResultatFiscal(decl: DeclarationAnnuelle): {
  beneficeFiscal: Money | null;
  deficitFiscal: Money | null;
} {
  const charges = decl.chargesQualifieesParCategorie;
  const sommeCharges = Object.values(charges).reduce<Money>(
    (acc, m) => acc.additionner(m),
    Money.zero(),
  );

  // Tout en centimes BigInt pour gérer le signe sans casser l'invariant Money positif.
  const recettesCent = decl.recettesTotales.centimes;
  const chargesCent = sommeCharges.centimes;
  const dotationCent = decl.dotationAmortissement.centimes;
  const ardGenereCent = decl.ardGenere.centimes;
  const ardConsommeCent = decl.ardConsomme.centimes;

  const resultat = recettesCent - chargesCent - dotationCent + ardConsommeCent - ardGenereCent;

  if (resultat >= 0n) {
    return {
      beneficeFiscal: Money.fromCentimes(resultat),
      deficitFiscal: null,
    };
  }
  return {
    beneficeFiscal: null,
    deficitFiscal: Money.fromCentimes(-resultat),
  };
}

/**
 * Somme les charges réellement reportables sur la case "FK — Autres achats et
 * charges externes" de la 2033-B (D-A6.3 + anti-pattern §3 RESEARCH.md).
 *
 * **Filtre strict :** `entretien_reparation + charge_courante_periodique`.
 * `amelioration` est IMMOBILISÉE (2033-C augmentations exercice), JAMAIS sur
 * 2033-B. `non_deductible` et `non_qualifie` ne reportent nulle part.
 */
function chargesAutresExternesPour(decl: DeclarationAnnuelle): Money {
  const c = decl.chargesQualifieesParCategorie;
  return c.entretien_reparation.additionner(c.charge_courante_periodique);
}

interface ContexteResolution {
  readonly decl: DeclarationAnnuelle;
  readonly composants: AgregatsComposants;
  readonly beneficeFiscal: Money | null;
  readonly deficitFiscal: Money | null;
}

/**
 * Résout la valeur d'une case en fonction de sa clé `source` (D-T6.4).
 *
 * Switch sur `SourceCleSnapshot` — chaque clé pointe vers UN champ explicite du
 * snapshot ou un calcul dérivé pur. Aucun nom de variable libre — toute
 * extension nécessite l'ajout d'une clé au type union (anti-pattern §1).
 *
 * Retourne `null` pour les cases dont la valeur n'est pas modélisée Wave 1
 * (`manuel` + postes 2033-A sans amortissement cumulé exposé par Phase 5).
 */
function resoudreValeurCase(
  source: SourceCleSnapshot,
  ctx: ContexteResolution,
): Money | null {
  switch (source) {
    case 'recettesTotales':
      return ctx.decl.recettesTotales;
    case 'beneficeFiscal':
      return ctx.beneficeFiscal;
    case 'deficitFiscal':
      return ctx.deficitFiscal;
    case 'dotationAmortissement':
      return ctx.decl.dotationAmortissement;
    case 'ardGenere':
      return ctx.decl.ardGenere;
    case 'ardConsomme':
      return ctx.decl.ardConsomme;
    case 'chargesAutresExternes':
      return chargesAutresExternesPour(ctx.decl);
    case 'chargesImpotsTaxes':
      // Wave 1 : pas de ventilation CFE/taxe foncière dans le snapshot Phase 5 →
      // null + mention "à compléter manuellement" (D-A6.2 honnête).
      return null;
    case 'immobilisationsConstructionsBrut':
      return ctx.composants.constructionsBrut.toCentimes() === 0n
        ? null
        : ctx.composants.constructionsBrut;
    case 'immobilisationsMobilierBrut':
      return ctx.composants.mobilierBrut.toCentimes() === 0n
        ? null
        : ctx.composants.mobilierBrut;
    case 'amortissementsCumulesConstructions':
      return ctx.composants.amortissementsConstructions;
    case 'amortissementsCumulesMobilier':
      return ctx.composants.amortissementsMobilier;
    case 'vncConstructions': {
      const brut = ctx.composants.constructionsBrut;
      const amort = ctx.composants.amortissementsConstructions;
      if (brut.toCentimes() === 0n || amort === null) return null;
      // VNC = Brut - Amortissements cumulés (jamais négatif côté Phase 5).
      if (brut.centimes < amort.centimes) return null;
      return brut.soustraire(amort);
    }
    case 'manuel':
      return null;
  }
}

function construireCaseDto(def: CaseLiasseDef, ctx: ContexteResolution): CaseLiasseDto {
  const valeur = resoudreValeurCase(def.source, ctx);
  const mention = valeur === null && def.source !== 'beneficeFiscal' && def.source !== 'deficitFiscal'
    ? MENTION_MANUELLE
    : undefined;
  return {
    numero: def.numero,
    libelleOfficiel: def.libelleOfficiel,
    annexe: def.annexe,
    valeur,
    ...(mention ? { mention } : {}),
  };
}

function construireSectionDto(
  annexe: AnnexeLiasse,
  defs: ReadonlyArray<CaseLiasseDef>,
  ctx: ContexteResolution,
  exercice: number,
): SectionLiasseDto {
  const cases = defs.map((d) => construireCaseDto(d, ctx));
  const titre = `${TITRES_ANNEXES[annexe]} ${exercice}`;
  if (annexe === '2033-A') {
    return { titre, annexe, cases, bandeauPostesManuels: true };
  }
  return { titre, annexe, cases };
}

/**
 * Génère le brouillon liasse pour une `DeclarationAnnuelle` clôturée en régime réel.
 *
 * @throws DeclarationIntrouvableLiasse si la déclaration n'existe pas
 * @throws BailleurIntrouvableLiasse si le bailleur singleton n'est pas configuré
 * @throws RegimeMicroBicNonSupporteWave1 si `regimeApplique='micro_bic'` (Plan 02)
 * @throws MappingLiasseAbsent si le millésime n'est pas couvert (D-L6.3, propagé)
 */
export async function genererBrouillonLiasse(
  commande: GenererBrouillonLiasseCommande,
  deps: GenererBrouillonLiasseDeps,
): Promise<BrouillonLiasseDto> {
  const { declarationId } = commande;
  const { declRepo, bailleurRepo, mappingProvider } = deps;

  // 1. Charger le snapshot — source unique de vérité pour les valeurs (D-T6.4).
  const decl = await declRepo.trouverParId(declarationId);
  if (decl === null) {
    throw new DeclarationIntrouvableLiasse(declarationId);
  }

  // 2. Charger le bailleur singleton (mention sur le brouillon).
  const bailleur = await bailleurRepo.trouver();
  if (bailleur === null) {
    throw new BailleurIntrouvableLiasse();
  }

  // 3. Résoudre le mapping millésimé (fail-fast `MappingLiasseAbsent` propagé).
  const mapping = mappingProvider.pour(decl.exercice);

  // 4. Préparer le contexte pur (snapshot → agrégats + résultat fiscal).
  const composants = agregerComposantsSnapshot(decl);
  const { beneficeFiscal, deficitFiscal } = calculerResultatFiscal(decl);
  const ctx: ContexteResolution = { decl, composants, beneficeFiscal, deficitFiscal };

  // 5. Annexes rendues selon le régime (D-L6.2).
  const annexes: ReadonlyArray<AnnexeLiasse> =
    decl.regimeApplique === 'micro_bic' ? ANNEXES_MICRO : ANNEXES_REEL;
  const sections = annexes.map((annexe) =>
    construireSectionDto(annexe, mapping.sections[annexe], ctx, decl.exercice),
  );

  // 6. DTO racine.
  return {
    exercice: decl.exercice,
    regimeApplique: decl.regimeApplique,
    bailleurNom: bailleur.nomComplet,
    sections,
    clotureLe: decl.clotureLe,
  };
}
