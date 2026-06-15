/**
 * Alertes révision IRL J-30 — Phase 7 / DAS-02 / Plan 07-02.
 *
 * Produit des Alerte[] unifiés (contrat D-AL-01) pour les baux actifs dont
 * la date d'anniversaire tombe dans la fenêtre forward-only [0, +30] jours (D-SRC-02).
 * Note : dateAnniversaireProchaine retourne TOUJOURS une date strictement future
 * (j >= 1). La borne basse j >= -30 est conservée comme garde défensive inatteignable en V1.
 *
 * Filtres appliqués (D-SRC-03) :
 *   1. bail.actifDepuis !== null → bail jamais activé ignoré.
 *   2. bien.estGelLoyer() → bien classé DPE F ou G, gel Climat (D-78/D-92).
 *   3. indexationsParBail.get(bail.id) === true → indexation déjà présente sur
 *      l'exercice courant (D-SRC-03 IRL). Ce flag est pré-calculé par le use
 *      case 07-04 (`calculerToutesAlertes`) à partir du BailIndexationRepository.
 *      Le domaine ne touche JAMAIS un repository.
 *
 * Source canonique de la date d'anniversaire : bail.dateAnniversaireProchaine(maintenant)
 * (D-91, LOC-04 DP-20 Phase 3).
 *
 * Pattern Clock-driven (anti-cron) : `maintenant` est TOUJOURS passé en argument.
 * Ce module n'accède JAMAIS à Temporal.Now, à un Clock ou à une infrastructure.
 * Le Clock est injecté au point d'entrée (use case 07-04).
 *
 * Aucun import technique : seuls @js-temporal/polyfill, domaine _shared et
 * domaine locatif/patrimoine sont autorisés (dependency-cruiser Phase 5.1).
 */

import { Temporal } from '@js-temporal/polyfill';

import type { Alerte } from '../_shared/alerte.js';
import { joursAvantEcheance } from '../_shared/alerte.js';
import type { BailId } from '../_shared/identifiants.js';
import type { Bien } from '../patrimoine/bien.js';

import type { Bail } from './bail.js';

/** Fenêtre d'alerte IRL : forward-only [0, +30] (D-SRC-02). Même valeur que CFE. */
const FENETRE_ALERTE_JOURS = 30;

/**
 * Vrai si la révision IRL du bail doit déclencher une alerte.
 *
 * @param bail                             Bail à évaluer (lu en readonly).
 * @param bien                             Bien associé (lu en readonly).
 * @param indexationDejaPresenteExerciceCourant  true = indexation déjà enregistrée
 *                                         sur l'exercice courant (D-SRC-03 IRL).
 *                                         Responsabilité du use case 07-04.
 * @param maintenant                       Date courante (injectée via Clock).
 */
export function estAlerteIrlActive(
  bail: Bail,
  bien: Bien,
  indexationDejaPresenteExerciceCourant: boolean,
  maintenant: Temporal.PlainDate,
): boolean {
  if (bail.actifDepuis === null) return false; // D-SRC-03 — bail jamais activé
  if (bien.estGelLoyer()) return false; // gel Climat F/G (D-78/D-92)
  if (indexationDejaPresenteExerciceCourant) return false; // D-SRC-03 IRL
  const dateAnniversaire = bail.dateAnniversaireProchaine(maintenant); // D-91
  const j = joursAvantEcheance(dateAnniversaire, maintenant);
  return j <= FENETRE_ALERTE_JOURS && j >= -30; // fenêtre forward-only [0,+30] ; borne -30 défensive (inatteignable en V1)
}

/**
 * Retourne la liste triée des Alerte[] (type='irl') pour les baux éligibles.
 *
 * - Baux orphelins (bienId absent de `biens`) : ignorés silencieusement.
 * - Tri : joursRestants ASC (plus urgent en premier).
 * - urlAction : `/baux/{bailId}/indexer` (route Phase 7).
 * - source.extra.adresseBien : données déjà affichées Phase 1/3 (T-07-05 accept).
 *
 * @param baux             Liste des baux (readonly — aucune mutation).
 * @param biens            Liste des biens (readonly — aucune mutation).
 * @param indexationsParBail  Map bailId → bool (true = déjà indexé exercice courant).
 *                         Construite par le use case 07-04.
 * @param maintenant             Date courante (injectée via Clock).
 * @param nomLocataireParBail    Map optionnelle BailId → nom complet du locataire.
 *                               Construite par le use case (jamais un repo dans le domaine).
 */
export function calculerAlertesIrl(
  baux: readonly Bail[],
  biens: readonly Bien[],
  indexationsParBail: Map<BailId, boolean>,
  maintenant: Temporal.PlainDate,
  nomLocataireParBail?: Map<BailId, string>,
): Alerte[] {
  const biensParId = new Map(biens.map((b) => [b.id, b]));
  const alertes: Alerte[] = [];

  for (const bail of baux) {
    const bien = biensParId.get(bail.bienId);
    if (!bien) continue; // bail orphelin ignoré silencieusement

    const aDeja = indexationsParBail.get(bail.id) ?? false;
    if (!estAlerteIrlActive(bail, bien, aDeja, maintenant)) continue;

    const dateAnniversaire = bail.dateAnniversaireProchaine(maintenant);
    alertes.push({
      type: 'irl',
      joursRestants: joursAvantEcheance(dateAnniversaire, maintenant),
      dateEcheance: dateAnniversaire,
      libelle: 'Révision IRL',
      urlAction: `/baux/${bail.id}/indexer`,
      source: {
        type: 'irl',
        refId: bail.id,
        bienId: bien.id,
        extra: {
          adresseBien: bien.adresse.rue,
          nomLocataire: nomLocataireParBail?.get(bail.id) ?? '',
        },
      },
    });
  }

  alertes.sort((a, b) => a.joursRestants - b.joursRestants);
  return alertes;
}
