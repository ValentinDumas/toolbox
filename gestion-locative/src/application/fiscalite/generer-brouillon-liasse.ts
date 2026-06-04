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
import type { DeclarationAnnuelleId, DeclarationCorrigeeId } from '../../domain/_shared/identifiants.js';
import { DeclarationAnnuelle } from '../../domain/fiscalite/declaration-annuelle.js';
import type { DeclarationAnnuelleRepository, DeclarationCorrigeeRepository } from '../../domain/fiscalite/declaration-annuelle-repository.js';
import { REGLES_2026 } from '../../domain/fiscalite/regles/regles-2026.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { RecettesRepository } from '../../domain/fiscalite/recettes-repository.js';
import type { ChargesRepository } from '../../domain/fiscalite/charges-repository.js';
import type { TableauAmortissementRepository } from '../../domain/fiscalite/tableau-amortissement-repository.js';
import type { MappingLiasseProvider } from '../../domain/fiscalite/liasse/mapping-liasse-provider.js';
import { reconcilier, type ResultatReconciliation } from '../../domain/fiscalite/reconciliation.js';
import type {
  AnnexeLiasse,
  BrouillonLiasseDto,
  CaseLiasseDef,
  SourceDto,
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

export type GenererBrouillonLiasseCommande =
  | { readonly declarationId: DeclarationAnnuelleId }
  | { readonly declarationCorrigeeId: DeclarationCorrigeeId };

export interface GenererBrouillonLiasseDeps {
  readonly declRepo: DeclarationAnnuelleRepository;
  readonly bailleurRepo: BailleurRepository;
  readonly mappingProvider: MappingLiasseProvider;
  /** Plan 06-03 — facultatifs : si fournis, la réconciliation + les sources sont calculées. */
  readonly recettesRepo?: RecettesRepository;
  readonly chargesRepo?: ChargesRepository;
  readonly tableauAmortRepo?: TableauAmortissementRepository;
  readonly bienRepo?: BienRepository;
  /** Plan 06-04 — facultatif, requis pour la commande `{ declarationCorrigeeId }`. */
  readonly declCorrigeeRepo?: DeclarationCorrigeeRepository;
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
async function calculerReconciliationEtSources(
  decl: DeclarationAnnuelle,
  ctx: ContexteResolution,
  deps: GenererBrouillonLiasseDeps,
): Promise<{
  reconciliation?: ResultatReconciliation;
  sourcesParCase: Map<string, ReadonlyArray<SourceDto>>;
}> {
  const sourcesParCase = new Map<string, ReadonlyArray<SourceDto>>();
  if (!deps.recettesRepo || !deps.chargesRepo || !deps.tableauAmortRepo || !deps.bienRepo) {
    return { sourcesParCase };
  }
  // 1) Agréger les sources vivantes.
  const sommeRecettesVivante = await deps.recettesRepo.sommeRecettesAnnuelles(
    decl.bailleurId,
    decl.exercice,
  );
  const chargesVivantes = await deps.chargesRepo.sommeChargesParCategorie(
    decl.bailleurId,
    decl.exercice,
  );
  const chargesAutresExternesVivantes = chargesVivantes.entretien_reparation.additionner(
    chargesVivantes.charge_courante_periodique,
  );

  const biens = await deps.bienRepo.listerTous();
  const tableauxParBien = await Promise.all(
    biens.map(async (b) => ({
      bien: b,
      lignes: await deps.tableauAmortRepo!.listerParBienExercice(b.id, decl.exercice),
    })),
  );
  const dotationVivante = tableauxParBien.reduce<Money>((acc, t) => {
    const sumBien = t.lignes
      .filter((l) => l.typeLigne === 'COMPOSANT')
      .reduce<Money>((a, l) => a.additionner(l.dotationAppliquee), Money.zero());
    return acc.additionner(sumBien);
  }, Money.zero());

  // 2) Construire snapshotMap + sourcesVivantesMap pour les cases mappées.
  const snapshotMap = new Map<string, Money>();
  const vivantMap = new Map<string, Money>();
  const mapping = deps.mappingProvider.pour(decl.exercice);
  for (const annexeCases of Object.values(mapping.sections)) {
    for (const def of annexeCases) {
      const vSnapshot = resoudreValeurCase(def.source, ctx);
      if (vSnapshot === null) continue;
      let vVivante: Money | null = null;
      const detail: SourceDto[] = [];
      if (def.source === 'recettesTotales') {
        vVivante = sommeRecettesVivante;
        detail.push({
          type: 'recette',
          label: `Encaissements ${decl.exercice} (cumulés)`,
          url: `/encaissements?annee=${decl.exercice}`,
          montant: sommeRecettesVivante,
        });
      } else if (def.source === 'chargesAutresExternes') {
        vVivante = chargesAutresExternesVivantes;
        detail.push({
          type: 'charge',
          label: `Charges déductibles ${decl.exercice} (entretien + charges courantes)`,
          url: `/coffre?annee=${decl.exercice}`,
          montant: chargesAutresExternesVivantes,
        });
      } else if (def.source === 'dotationAmortissement') {
        vVivante = dotationVivante;
        for (const { bien, lignes } of tableauxParBien) {
          const sumBien = lignes
            .filter((l) => l.typeLigne === 'COMPOSANT')
            .reduce<Money>((a, l) => a.additionner(l.dotationAppliquee), Money.zero());
          if (sumBien.toCentimes() > 0n) {
            detail.push({
              type: 'amortissement',
              label: `Amortissement ${decl.exercice} — ${bien.adresse.enLigne()}`,
              url: `/biens/${bien.id}/fiscalite/amortissement/${decl.exercice}`,
              montant: sumBien,
            });
          }
        }
      }
      if (vVivante !== null) {
        snapshotMap.set(def.caseId, vSnapshot);
        vivantMap.set(def.caseId, vVivante);
        if (detail.length > 0) {
          sourcesParCase.set(def.caseId, detail);
        }
      }
    }
  }

  const reconciliation = reconcilier(snapshotMap, vivantMap);
  return { reconciliation, sourcesParCase };
}

/**
 * Construit un snapshot DeclarationAnnuelle-like à partir d'une DeclarationCorrigee
 * + sa déclaration originale (Plan 06-04 / D-L6.5).
 *
 * La corrigée ne porte pas `bailleurId`, `exercice`, `composantsSnapshot`, `clotureLe` —
 * ces champs viennent de l'originale (append-only Phase 5).
 */
async function chargerDepuisCorrigee(
  declarationCorrigeeId: DeclarationCorrigeeId,
  deps: GenererBrouillonLiasseDeps,
): Promise<{ decl: DeclarationAnnuelle; declarationOriginaleId: DeclarationAnnuelleId; motif: string }> {
  if (!deps.declCorrigeeRepo) {
    throw new Error('declCorrigeeRepo dep manquante pour la commande declarationCorrigeeId');
  }
  const corr = await deps.declCorrigeeRepo.trouverParId(declarationCorrigeeId);
  if (corr === null) {
    throw new DeclarationIntrouvableLiasse(declarationCorrigeeId);
  }
  const originale = await deps.declRepo.trouverParId(corr.declarationOriginaleId);
  if (originale === null) {
    throw new DeclarationIntrouvableLiasse(corr.declarationOriginaleId);
  }
  const declSynth = DeclarationAnnuelle.creer({
    id: corr.id as unknown as DeclarationAnnuelleId,
    bailleurId: originale.bailleurId,
    exercice: originale.exercice,
    regimeApplique: corr.regimeApplique,
    recettesTotales: corr.recettesTotales,
    chargesQualifieesParCategorie: corr.chargesQualifieesParCategorie,
    dotationAmortissement: corr.dotationAmortissement,
    ardGenere: corr.ardGenere,
    ardConsomme: corr.ardConsomme,
    revenusFoyerSnapshot: corr.revenusFoyerSnapshot,
    statutLmnpLmp: corr.statutLmnpLmp,
    composantsSnapshot: originale.composantsSnapshot,
    clotureLe: originale.clotureLe,
    seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
  });
  return { decl: declSynth, declarationOriginaleId: corr.declarationOriginaleId, motif: corr.motif };
}

export async function genererBrouillonLiasse(
  commande: GenererBrouillonLiasseCommande,
  deps: GenererBrouillonLiasseDeps,
): Promise<BrouillonLiasseDto> {
  const { declRepo, bailleurRepo, mappingProvider } = deps;

  let decl: DeclarationAnnuelle;
  let motifRectification: string | undefined;
  let urlOriginale: string | undefined;

  if ('declarationCorrigeeId' in commande) {
    const r = await chargerDepuisCorrigee(commande.declarationCorrigeeId, deps);
    decl = r.decl;
    motifRectification = r.motif;
    urlOriginale = `/fiscalite/declarations/${r.declarationOriginaleId}/liasse`;
  } else {
    // 1. Charger le snapshot — source unique de vérité pour les valeurs (D-T6.4).
    const loaded = await declRepo.trouverParId(commande.declarationId);
    if (loaded === null) {
      throw new DeclarationIntrouvableLiasse(commande.declarationId);
    }
    decl = loaded;
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

  // 6. Plan 06-03 — Calcul réconciliation + agrégation sources si deps fournies.
  const { reconciliation, sourcesParCase } = await calculerReconciliationEtSources(decl, ctx, deps);

  const sections = annexes.map((annexe) => {
    const def = mapping.sections[annexe];
    const cases = def.map((d): CaseLiasseDto => {
      const baseCase = construireCaseDto(d, ctx);
      const sources = sourcesParCase.get(d.caseId);
      return sources ? { ...baseCase, sources } : baseCase;
    });
    const titre = `${TITRES_ANNEXES[annexe]} ${decl.exercice}`;
    return annexe === '2033-A'
      ? { titre, annexe, cases, bandeauPostesManuels: true }
      : { titre, annexe, cases };
  });

  // 7. DTO racine.
  return {
    exercice: decl.exercice,
    regimeApplique: decl.regimeApplique,
    bailleurNom: bailleur.nomComplet,
    sections,
    clotureLe: decl.clotureLe,
    ...(reconciliation ? { reconciliation } : {}),
    ...(motifRectification ? { motifRectification } : {}),
    ...(urlOriginale ? { urlOriginale } : {}),
  };
}
