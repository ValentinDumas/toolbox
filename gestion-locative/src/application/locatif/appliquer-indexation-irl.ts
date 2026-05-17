import { Temporal } from '@js-temporal/polyfill';
import type { Kysely } from 'kysely';

import type { DB } from '../../infrastructure/db/kysely-types.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { EncaissementRepository } from '../../domain/encaissements/encaissement-repository.js';
import type { BailIndexationRepository } from '../../domain/locatif/bail-indexation-repository.js';
import { BailIndexation } from '../../domain/locatif/bail-indexation.js';
import { Money } from '../../domain/_shared/money.js';
import { IRL } from '../../domain/_shared/irl.js';
import type {
  BailId,
  BailIndexationId,
  EcheanceLoyerId,
} from '../../domain/_shared/identifiants.js';
import type { Clock } from '../../domain/_shared/clock.js';
import { BailIntrouvable, GelLoyerClimatActif } from '../../domain/locatif/erreurs.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import { BailleurAbsent } from '../../domain/identite/erreurs.js';
import { LocataireIntrouvable } from '../../domain/locatif/erreurs.js';
import { genererEcheancesPour } from '../encaissements/activer-bail.js';
import { construireAvenantIRL } from '../../infrastructure/pdf/avenant-irl-doc-def.js';

export interface AppliquerIndexationIRLCommande {
  bailId: BailId;
  irlTrimestre: string;
  irlValeur: string;
  dateEffet?: Temporal.PlainDate;
}

export interface AppliquerIndexationIRLResult {
  bailIndexationId: BailIndexationId;
  nouveauLoyerHc: Money;
  echeancesRegenerees: number;
  cheminFichierRelatifAvenant: string;
}

interface Repos {
  bailRepo: BailRepository;
  bienRepo: BienRepository;
  locataireRepo: LocataireRepository;
  bailleurRepo: BailleurRepository;
  echeanceLoyerRepo: EcheanceLoyerRepository;
  encaissementRepo: EncaissementRepository;
  bailIndexationRepo: BailIndexationRepository;
}

interface PdfRendererLike {
  genererBuffer(docDef: unknown): Promise<Buffer>;
}

interface StockageLike {
  ecrireAvenant(annee: number, nomFichier: string, buffer: Buffer): Promise<string>;
}

interface Infra {
  pdfRenderer: PdfRendererLike;
  stockage: StockageLike;
  clock: Clock;
}

/**
 * Use case LOC-04 apply (D-94).
 *
 * Orchestration des 5 effets de l'application d'une indexation IRL :
 *   1. Pivot du Bail (loyerHc + irlReference) via `Bail.appliquerIndexation`.
 *   2. Régénération des échéances futures sans encaissement actif (D-73) avec
 *      le nouveau loyer.
 *   3. Insertion d'une ligne `bail_indexations` append-only (D-96).
 *   4. Génération du PDF avenant loi 89 art. 17-1 (D-93) — hors transaction.
 *   5. Écriture du fichier PDF immutable (flag wx, D-63).
 *
 * Defense en profondeur (T-03-04-01) : check `bien.estGelLoyer()` AVANT
 * toute écriture — throw `GelLoyerClimatActif` sans laisser de trace.
 *
 * Compensation : si la génération ou l'écriture du PDF échoue après le commit
 * DB, l'avenant manque sur disque mais `BailIndexation` est déjà persisté
 * (append-only, ne peut pas être rollback). On log CRITICAL et on re-throw —
 * la route GET /baux/:id/avenant/:annee gérera l'absence de fichier.
 */
export async function appliquerIndexationIRL(
  commande: AppliquerIndexationIRLCommande,
  repos: Repos,
  infra: Infra,
  db: Kysely<DB>,
): Promise<AppliquerIndexationIRLResult> {
  // 1. Lookups
  const bail = await repos.bailRepo.trouverParId(commande.bailId);
  if (!bail) throw new BailIntrouvable(commande.bailId);

  const bien = await repos.bienRepo.trouverParId(bail.bienId);
  if (!bien) throw new BienIntrouvable(bail.bienId);

  const locataire = await repos.locataireRepo.trouverParId(bail.locataireId);
  if (!locataire) throw new LocataireIntrouvable(bail.locataireId);

  const bailleur = await repos.bailleurRepo.trouver();
  if (!bailleur) throw new BailleurAbsent();

  // 2. Construire IRL nouveau
  const irlNouveau = IRL.creer({
    trimestre: commande.irlTrimestre,
    valeur: commande.irlValeur,
  });

  // 3. Pre-condition gel Climat (defense en profondeur LOC-05)
  if (bien.estGelLoyer()) {
    throw new GelLoyerClimatActif(bail.id, bien.classeDpe as 'F' | 'G');
  }

  // 4. Simuler pour récupérer le nouveau loyer (déjà sait que gelLoyer=false ici)
  const sim = bail.simulerIndexation(irlNouveau, bien.classeDpe);

  // 5. Date d'effet : par défaut = anniversaire le plus récent atteint
  const today = infra.clock.aujourdhui();
  const dateEffet =
    commande.dateEffet ?? bail.dateAnniversaireProchaine(today).subtract({ years: 1 });

  // 6. Pivot du Bail (copy-on-write) + persist
  const bailModifie = bail.appliquerIndexation(irlNouveau, dateEffet);
  await repos.bailRepo.enregistrer(bailModifie);

  // 7. Régénération des échéances futures (pattern D-73) :
  //    - statut ∈ {'en_attente', 'partiellement_payee'}
  //    - periodeDebut >= dateEffet
  //    - pas d'encaissement actif
  const echeancesBail = await repos.echeanceLoyerRepo.listerParBail(bail.id);
  const aRegenerer: { id: EcheanceLoyerId; periodeDebut: Temporal.PlainDate }[] = [];
  for (const e of echeancesBail) {
    if (e.statut !== 'en_attente' && e.statut !== 'partiellement_payee') continue;
    if (Temporal.PlainDate.compare(e.periodeDebut, dateEffet) < 0) continue;
    const encaissements = await repos.encaissementRepo.listerParEcheance(e.id, {
      inclureAnnules: false,
    });
    if (encaissements.length > 0) continue;
    aRegenerer.push({ id: e.id as EcheanceLoyerId, periodeDebut: e.periodeDebut });
  }

  let echeancesRegenereesCount = 0;
  if (aRegenerer.length > 0) {
    await repos.echeanceLoyerRepo.supprimerLot(aRegenerer.map((e) => e.id));
    if (bailModifie.actifDepuis !== null) {
      const nouvelles = genererEcheancesPour(
        bailModifie,
        bailModifie.actifDepuis,
        bailModifie.jourEcheance,
      );
      const aRegenererSet = new Set(aRegenerer.map((e) => e.periodeDebut.toString()));
      const nouvellesFiltrees = nouvelles.filter((n) =>
        aRegenererSet.has(n.periodeDebut.toString()),
      );
      if (nouvellesFiltrees.length > 0) {
        await repos.echeanceLoyerRepo.enregistrerBatch(nouvellesFiltrees);
        echeancesRegenereesCount = nouvellesFiltrees.length;
      }
    }
  }

  // 8. Append-only BailIndexation
  const bailIndexation = BailIndexation.creer({
    bailId: bail.id,
    dateEffet,
    irlAvant: bail.irlReference,
    irlApres: irlNouveau,
    loyerAvant: bail.loyerHc,
    loyerApres: sim.nouveauLoyerHc,
    indexationAppliquee: true,
    raisonNonApplication: null,
  });
  await repos.bailIndexationRepo.enregistrer(bailIndexation);

  // 9. Hors transaction : PDF avenant + écriture fichier (avec compensation log)
  const annee = dateEffet.year;
  const bailIdCourt = bail.id.slice(0, 8);
  const nomFichier = `avenant-${bailIdCourt}-${dateEffet.toString()}.pdf`;

  let cheminRelatif: string;
  try {
    const docDef = construireAvenantIRL(
      bailModifie,
      locataire,
      bailleur,
      irlNouveau,
      bail.irlReference,
      bail.loyerHc,
      sim.nouveauLoyerHc,
      dateEffet,
    );
    const buffer = await infra.pdfRenderer.genererBuffer(docDef);
    cheminRelatif = await infra.stockage.ecrireAvenant(annee, nomFichier, buffer);
  } catch (err) {

    console.error(
      `[CRITICAL] appliquerIndexationIRL: avenant PDF échec pour bail ${bail.id} ` +
        `dateEffet ${dateEffet.toString()}. BailIndexation ${bailIndexation.id} déjà commit. ` +
        `Régénérer via GET /baux/${bail.id}/avenant/${annee}. ` +
        `Cause : ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }

  // Avoid unused-warning on `db` arg (réservé pour transaction future).
  void db;

  return {
    bailIndexationId: bailIndexation.id,
    nouveauLoyerHc: sim.nouveauLoyerHc,
    echeancesRegenerees: echeancesRegenereesCount,
    cheminFichierRelatifAvenant: cheminRelatif,
  };
}
