import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { EncaissementRepository } from '../../domain/encaissements/encaissement-repository.js';
import type { RelanceRepository } from '../../domain/encaissements/relance-repository.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { PdfRenderer } from '../../domain/encaissements/pdf-renderer.js';
import type { TemplateRenderer } from '../../domain/encaissements/template-renderer.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { NiveauRelance } from '../../domain/encaissements/relance.js';
import type { EcheanceLoyerId, RelanceId } from '../../domain/_shared/identifiants.js';
import { Relance } from '../../domain/encaissements/relance.js';
import { calculerRelanceDisponible } from './calculer-relance-disponible.js';
import { buildMailto } from '../../helpers/build-mailto.js';
import { extraireSujet, extraireCorps } from '../../domain/encaissements/template-renderer.js';
import { construireMiseEnDemeure } from '../../infrastructure/pdf/mise-en-demeure-doc-def.js';
import {
  EcheanceLoyerIntrouvable,
  RelanceNiveauNonDisponible,
} from '../../domain/encaissements/erreurs.js';
import { BailleurAbsent } from '../../domain/identite/erreurs.js';
import { formatPeriode } from '../../helpers/format-periode.js';
import { formatDate } from '../../helpers/format-date.js';

interface Repos {
  relanceRepo: RelanceRepository;
  echeanceLoyerRepo: EcheanceLoyerRepository;
  encaissementRepo: EncaissementRepository;
  bailRepo: BailRepository;
  locataireRepo: LocataireRepository;
  bienRepo: BienRepository;
  bailleurRepo: BailleurRepository;
}

interface ResultatEnregistrerRelance {
  relanceId: RelanceId;
  canal: 'email' | 'pdf';
  mailtoUri?: string;
  pdfBuffer?: Buffer;
}

/**
 * Use case ENC-05 — Enregistrement d'une Relance.
 *
 * Prérequis :
 * 1. Niveau disponible selon calculerRelanceDisponible (chaînage strict D-71)
 * 2. Bailleur renseigné (mentions légales obligatoires)
 * 3. Locataire + bail + bien trouvables
 *
 * Canal :
 * - niveaux 1-2 → URI mailto: (RFC 6068 via buildMailto)
 * - niveau 3 → PDF imprimable (pdfmake, LR/AR par la poste D-69)
 *
 * NOTE : aucun import fs ni ejs depuis ce fichier — port TemplateRenderer injecté (M4 hexagonal).
 */
export async function enregistrerRelance(
  commande: { echeanceId: EcheanceLoyerId | string; niveau: NiveauRelance },
  repos: Repos,
  templateRenderer: TemplateRenderer,
  pdfRenderer: PdfRenderer,
  clock: Clock,
): Promise<ResultatEnregistrerRelance> {
  // 1. Lookup échéance
  const echeance = await repos.echeanceLoyerRepo.trouverParId(commande.echeanceId);
  if (!echeance) {
    throw new EcheanceLoyerIntrouvable(String(commande.echeanceId));
  }

  // 2. Lookup relances existantes pour vérifier le chaînage
  const relancesExistantes = await repos.relanceRepo.listerParEcheance(commande.echeanceId);

  // 3. Vérifier le niveau disponible (chaînage strict D-71)
  const niveauDisponible = calculerRelanceDisponible(echeance, relancesExistantes, clock.aujourdhui());
  if (niveauDisponible !== commande.niveau) {
    throw new RelanceNiveauNonDisponible(commande.niveau, niveauDisponible);
  }

  // 4. Lookup bailleur (requis pour toutes les relances — contenu du message)
  const bailleur = await repos.bailleurRepo.trouver();
  if (!bailleur) {
    throw new BailleurAbsent();
  }

  // 5. Lookup bail + locataire + bien
  const bail = await repos.bailRepo.trouverParId(echeance.bailId);
  if (!bail) {
    throw new EcheanceLoyerIntrouvable(`Bail introuvable pour l'échéance ${String(commande.echeanceId)}`);
  }

  const locataire = await repos.locataireRepo.trouverParId(bail.locataireId);
  if (!locataire) {
    throw new EcheanceLoyerIntrouvable(`Locataire introuvable pour le bail ${bail.id}`);
  }

  const bien = await repos.bienRepo.trouverParId(bail.bienId);
  if (!bien) {
    throw new EcheanceLoyerIntrouvable(`Bien introuvable pour le bail ${bail.id}`);
  }

  // 6. Calcul montant dû
  const sommePaiee = await repos.encaissementRepo.sommePaieeParEcheance(echeance.id);
  const resteDu = echeance.total.soustraire(sommePaiee);

  // 7. Variables template
  const adresseLocataire = `${locataire.adresseActuelle.rue}, ${locataire.adresseActuelle.codePostal} ${locataire.adresseActuelle.ville}`;
  const adresseBailleur = `${bailleur.adresse.rue}, ${bailleur.adresse.codePostal} ${bailleur.adresse.ville}`;
  const variables = {
    prenom_locataire: locataire.prenom,
    nom_locataire: locataire.nom,
    adresse_locataire: adresseLocataire,
    periode_impayee: formatPeriode(echeance.periodeDebut),
    montant_du: resteDu.enEuros(),
    date_echeance_initiale: formatDate(echeance.jourEcheanceAttendue),
    nom_bailleur: bailleur.nomComplet,
    adresse_bailleur: adresseBailleur,
  };

  // 8. Rendu du template (M4 — TemplateRenderer injecté, pas d'import fs/ejs dans application/)
  const contenuRendu = templateRenderer.rendre(commande.niveau, variables);

  // 9. Canal selon niveau
  const canal: 'email' | 'pdf' = commande.niveau === 3 ? 'pdf' : 'email';

  // 10. Calcul mailtoUri AVANT Relance.creer (pour le snapshot)
  let mailtoUri: string | null = null;
  if (canal === 'email') {
    const sujet = extraireSujet(contenuRendu);
    const corps = extraireCorps(contenuRendu);
    mailtoUri = buildMailto({ to: locataire.email, subject: sujet, body: corps });
  }

  // 11. Snapshot contenu (D-69 audit-friendly)
  const contenuSnapshot = JSON.stringify({
    variables,
    contenuRendu,
    mailtoUri,
    version: 'v1' as const,
  });

  // 12. Créer + enregistrer la Relance
  const relance = Relance.creer({
    echeanceId: echeance.id,
    niveau: commande.niveau,
    canal,
    envoyeeLe: clock.aujourdhui(),
    contenuSnapshot,
  });

  await repos.relanceRepo.enregistrer(relance);

  // 13. Retourner selon canal
  if (canal === 'email') {
    return { relanceId: relance.id, canal: 'email', mailtoUri: mailtoUri! };
  } else {
    // niveau 3 — générer PDF à la volée (non persisté D-66 cohérence)
    const encaissementsLies = await repos.encaissementRepo.listerParEcheance(echeance.id);
    const docDef = construireMiseEnDemeure(
      echeance,
      encaissementsLies,
      bailleur,
      locataire,
      bien,
      bien.adresse,
      bail,
      resteDu,
      clock.aujourdhui(),
    );
    const pdfBuffer = await pdfRenderer.genererBuffer(docDef);
    return { relanceId: relance.id, canal: 'pdf', pdfBuffer };
  }
}
