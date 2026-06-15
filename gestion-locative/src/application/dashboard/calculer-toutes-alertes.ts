/**
 * Use case agrégateur — calculerToutesAlertes (Phase 7 / DAS-02 / D-AL-02 / D-AL-04).
 *
 * Agrège les 4 sources d'alerte (CFE, IRL, diagnostic, fin de bail) en un seul
 * tableau Alerte[] trié ASC par joursRestants (plus urgent en premier).
 *
 * Responsabilités :
 *   - Charger les 4 repos sources en LECTURE SEULE (aucune mutation d'agrégat).
 *   - Appeler les 4 fonctions pures domaine créées en 07-01/07-02/07-03.
 *   - Calculer le filtre IRL « exercice courant » (D-SRC-03) :
 *       `indexationsParBail: Map<BailId, boolean>` via dernierePourBail + dateEffet.year.
 *       `true` = une indexation est déjà présente pour l'exercice courant → ne pas alerter.
 *       Le domaine (alerte-irl.ts) ne touche JAMAIS un repository (contrat 07-02 verrouillé).
 *   - Fusionner et trier ASC GLOBALEMENT toutes les alertes.
 *
 * Pattern Clock-driven (D-CFE6.5) :
 *   `maintenant = deps.clock.aujourdhui()` — appelé UNE seule fois.
 *   INTERDIT : new Date(), Temporal.Now, setInterval, setTimeout, cron.
 *
 * Aucun import depuis src/infrastructure/ ni Fastify.
 * Le wiring DI réel (repos concrets) est branché par la route GET / (plan 07-05).
 */

import type { BailId } from '../../domain/_shared/identifiants.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { Alerte } from '../../domain/_shared/alerte.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { DeclarationCfeRepository } from '../../domain/fiscalite/cfe/declaration-cfe-repository.js';
import type { BailIndexationRepository } from '../../domain/locatif/bail-indexation-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import { calculerAlertesCfe } from '../../domain/fiscalite/cfe/alerte-cfe-j30.js';
import { calculerAlertesIrl } from '../../domain/locatif/alerte-irl.js';
import { calculerAlertesFinBail } from '../../domain/locatif/alerte-fin-bail.js';
import { calculerAlertesDiagnostic } from '../../domain/patrimoine/alerte-diagnostic.js';

export interface CalculerToutesAlertesDeps {
  cfeRepo: DeclarationCfeRepository;
  bienRepo: BienRepository;
  bailRepo: BailRepository;
  bailIndexationRepo: BailIndexationRepository;
  locataireRepo: LocataireRepository;
  clock: Clock;
}

/**
 * Agrège les 4 sources d'alerte et retourne un Alerte[] trié ASC par joursRestants.
 *
 * @param deps - Dépendances injectées (repos domaine + clock).
 * @returns Tableau trié par urgence croissante (le plus urgent en premier).
 */
export async function calculerToutesAlertes(
  deps: CalculerToutesAlertesDeps,
): Promise<Alerte[]> {
  // Clock-driven : date lue UNE fois, jamais new Date() ni Temporal.Now
  const maintenant = deps.clock.aujourdhui();

  // Chargement des collections en parallèle
  const [biens, baux, locataires] = await Promise.all([
    deps.bienRepo.listerTous(),
    deps.bailRepo.listerTous(),
    deps.locataireRepo.listerTous(),
  ]);

  // Map BailId → nom complet du locataire (résolution par le use case — le domaine ne touche aucun repo)
  const locatairesParId = new Map(locataires.map((l) => [l.id, l]));
  const nomLocataireParBail = new Map<BailId, string>(
    baux
      .filter((bail) => locatairesParId.has(bail.locataireId))
      .map((bail) => {
        const loc = locatairesParId.get(bail.locataireId)!;
        return [bail.id, `${loc.prenom} ${loc.nom}`] as [BailId, string];
      }),
  );

  // CFE : DeclarationCfeRepository n'a pas de listerTous → agrégation par bien
  const listesCfe = await Promise.all(biens.map((b) => deps.cfeRepo.listerParBien(b.id)));
  const declarations = listesCfe.flat();

  // Filtre IRL exercice courant (D-SRC-03) : précalculé ici, le domaine ne touche aucun repo
  const indexationsParBail = new Map<BailId, boolean>();
  await Promise.all(
    baux.map(async (bail) => {
      const derniere = await deps.bailIndexationRepo.dernierePourBail(bail.id);
      const aDejaExerciceCourant = derniere !== null && derniere.dateEffet.year === maintenant.year;
      indexationsParBail.set(bail.id, aDejaExerciceCourant);
    }),
  );

  // Appel des 4 fonctions pures domaine
  const alertesCfe = calculerAlertesCfe(declarations, maintenant);
  const alertesIrl = calculerAlertesIrl(baux, biens, indexationsParBail, maintenant, nomLocataireParBail);
  const alertesDiag = calculerAlertesDiagnostic(biens, maintenant);
  const alertesFinBail = calculerAlertesFinBail(baux, maintenant, nomLocataireParBail);

  // Fusion + tri ASC global (toutes sources confondues)
  const toutes = [...alertesCfe, ...alertesIrl, ...alertesDiag, ...alertesFinBail];
  toutes.sort((a, b) => a.joursRestants - b.joursRestants);
  return toutes;
}
