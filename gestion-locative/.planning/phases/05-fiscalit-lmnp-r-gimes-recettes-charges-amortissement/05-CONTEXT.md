# Phase 5 : Fiscalité LMNP — Régimes, Recettes/Charges, Amortissement — Context

**Gathered:** 2026-05-20
**Status:** Ready for planning
**Langue:** Français (project response_language)

<domain>
## Phase Boundary

Phase 5 introduit le **bounded context `Fiscalité`** (et un sous-domaine `Comptabilité` pour les agrégats annuels) et délivre :

1. **Agrégation annuelle des recettes** depuis `Encaissements` (Phase 2) en comptabilité d'encaissement (CGI 50-0 pour micro / tolérance BOFIP-BIC-DECLA-30-40-20 pour réel).
2. **Agrégation annuelle des charges** depuis `Justificatifs` (Phase 4) + `TicketTravaux` (Phase 4) avec qualification fiscale différée (4 catégories : `entretien_reparation`, `amelioration`, `charge_courante_periodique`, `non_deductible`).
3. **Régime micro-BIC** : abattement 50 % longue durée, plancher 305 €, seuil 83 600 € (recettes 2026), option régime réel renouvelable tacitement.
4. **Régime réel** :
   - Charges déductibles imputées par catégorie.
   - **Amortissement par composant** (6 composants BOFIP : terrain non amortissable + gros œuvre 40 ans + toiture/façade 25 ans + installations techniques 20 ans + agencements intérieurs 15 ans + mobilier 7 ans).
   - **Prorata temporis au jour près** sur les exercices d'acquisition et de sortie.
   - **ARD** (Amortissement Réputé Différé) reportable sans limite (CGI art. 39 B).
5. **Détection LMP** (CGI 155 IV) : critère (a) recettes > 23 000 € **ET** critère (b) recettes > revenus actifs du foyer.
6. **Clôture annuelle** d'une `DeclarationAnnuelle` (snapshot par valeur, audit-immuable) avec déclenchement manuel et prérequis vérifiés.
7. **Exports** CSV (pour expert-comptable) et PDF (récap fiscal annuel pour bailleur).
8. **Corrections post-clôture** via `DeclarationCorrigee` (Phase 5) qui alimentera la liasse rectificative Phase 6.

### Hors scope Phase 5

- **Plus-value à la cession** (D-LOCK-3) — reportée V1.1 (SIM-02) ; Phase 5 trace les amortissements gros œuvre cumulés pour préparer la réintégration LF 2025.
- **CFE** (FIS-06, D-LOCK-4) — Phase 6.
- **Liasse 2031-SD + annexes 2033-A à G** (FIS-05) — Phase 6 ; Phase 5 prépare les snapshots fiscaux.
- **Cotisations SSI / TNS** (D-LOCK-5) — hors scope V1.
- **Meublé de tourisme** (Out of Scope REQUIREMENTS.md) — V2.
- **OCR / IA d'auto-qualification** — V2 (CLA-01, D-FIS-G2.7).
- **Pluri-bailleur / SCI / indivision** — V1.1 (CES-01, D-LOCK-2).
- **Calcul d'IR + prélèvements sociaux** — hors scope Phase 5 (Phase 7 dashboard ou V1.1 SIM-01).
- **Bounded context `Financement` / agrégat `Pret`** — V1.1 (D-FIS-G2.10).

</domain>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Vision & priorités produit
- `CLAUDE.md` — Goal LMNP V1, principes directeurs, règles non négociables, hors périmètre.
- `VISION.md` — autonomie utilisateur, local-first, single-user.
- `LOGICIEL_GESTION_LOCATIVE.md` — PRD (cible, MVP, KPIs, roadmap).

### Domaine fiscal LMNP
- `LMNP.md` — base de connaissances fiscales (à amender §2 avec périmètre revenus foyer, §4.1 vérifié seuil 83 600 € 2026, §6 plus-value LF 2025).
- `LOCATION_MEUBLEE_REGLES.md` — règles juridiques meublé (loi 89-462, décret 2015-981 mobilier, EDL).

### Sources juridiques cadre (à citer dans les tests BDD)
- **CGI art. 50-0** — régime micro-BIC (seuils, abattement, plancher 305 €).
- **CGI art. 39** — charges déductibles, amortissements, plafond résultat avant amortissement.
- **CGI art. 39 B** — ARD reportable sans limite.
- **CGI art. 155 IV** — critères LMP (depuis Décision Conseil Constitutionnel n° 2009-587 DC supprimant condition RCS).
- **CGI art. 150 VB III** *(LF 2025 art. 84, loi 2025-127 du 14/02/2025)* — réintégration amortissements gros œuvre dans la PV (applicable 2025-02-15).
- **BOFIP-BIC-AMT-10-20 §100, §110** — répartition des frais d'acquisition au prorata sur composants amortissables.
- **BOFIP-BIC-AMT-20-10** — prorata temporis sur exercice d'acquisition.
- **BOFIP-BIC-CHG-10-10** — pièces justificatives des charges.
- **BOFIP-BIC-CHG-30-40** — charges courantes copropriété, traitement provisions travaux.
- **BOFIP-BIC-CHG-40-60-30** — barème kilométrique BIC.
- **BOFIP-BIC-CHAMP-40-20** — périmètre revenus actifs du foyer.
- **BOFIP-BIC-DECLA-10-30** — option régime réel renouvelable tacitement 1 an.
- **BOFIP-BIC-DECLA-30-30** — comptabilité d'encaissement micro-BIC.
- **BOFIP-BIC-DECLA-30-40-20** — tolérance comptabilité d'encaissement en réel pour LMNP non pro.
- **Décret 87-713** — charges récupérables auprès du locataire (TEOM, eau froide, ascenseur).
- **LF 2025 art. 11 (loi 2025-127 du 14/02/2025)** — abrogation OGA (suppression CGI art. 199 quater B + 1649 quater C à O).

### Vérifications externes effectuées pendant la discussion (LF 2026)
- `https://www.jedeclaremonmeuble.com/lmnp-2026/` — synthèse LF 2026 LMNP (sous-amendement plafonnement amortissement à 2 %/an REJETÉ).
- `https://www.montpellierimmo9.com/actualites/investissement/investissement-locatif-lmnp-changements-2026` — rejet amendement plafonnement.
- `https://www.monmeublesaisonnier.com/blog/micro-bic-lmnp-seuils-abattements-fiscal` — révision triennale seuil 77 700 € (recettes 2025) → 83 600 € (recettes 2026-2028).
- `https://www.expert-comptable-tpe.fr/articles/reduction-impot-frais-comptabilite/` — abrogation OGA LF 2025.
- `https://www.legifiscal.fr/actualites-fiscales/4158-loi-finances-2025-suppression-reduction-impot-accorde-autoentrepreneurs-adherents-oga.html` — détail abrogation OGA.

### Pratiques opposables au projet
- `practices/SOFTWARE_CRAFTSMANSHIP.md` — SOLID, Clean Code, ports/adapters, mesures qualité.
- `practices/DDD.md` — ubiquitous language français, 6 bounded contexts (Fiscalité = nouveau).
- `practices/BDD_PRACTICES.md` — outside-in, **100 % couverture sur la logique fiscale**, scénario dédié par exception du droit.
- `practices/UI_DESIGN.md`, `practices/UX_DESIGN.md`, `practices/ACCESSIBILITY.md` — WCAG 2.1 AA, helpers français, EJS partials.
- `RISKS.md` — R1.1 (surveillance fiscale annuelle), R4.3 (pédagogie fiscale), R3.1 (backup/restore).

### Contexte des phases précédentes
- `.planning/PROJECT.md` — Core value, contraintes (hexagonal, Money BigInt, Temporal.PlainDate, ubiquitous language français).
- `.planning/REQUIREMENTS.md` — FIS-01 (détection LMP), FIS-02 (abattement micro-BIC), FIS-03 (agrégation réel), FIS-04 (amortissement composant). V1.1+ : SIM-01, SIM-02, SIM-03, CLA-01, HIS-01, HIS-02, CES-01.
- `.planning/ROADMAP.md` — Phase 5 §dépendance Phase 2 + 4 ; Phase 6 (liasse 2031 + CFE) consomme Phase 5.
- `.planning/phases/01-activation-bien-locataire-bail/01-LEARNINGS.md` — patterns factory `creer()` + `InvariantViolated`, brand types, builders, repository versDomaine/versRow.
- `.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-*-CONTEXT.md` *(si présents)* — D-67 Bailleur Phase 2, D-60 compensateurs Encaissement, `Money.multiplyByFraction` éprouvé prorata.
- `.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-*-CONTEXT.md` *(si présents)* — pattern `RegleFiscale2026` versionnée par année (IRL versionnée), `Bien.classeDpe`, `appliquerIndexation` use case transactionnel.
- `.planning/phases/04-coffre-documentaire-travaux/04-CONTEXT.md` — D-103 Justificatif rattaché Bien XOR Locataire, D-115 (qualification fiscale différée Phase 5), pivot `ticket_justificatifs` N:N, soft-delete + raison.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (NE PAS RÉ-IMPLÉMENTER)

#### Domaine partagé (`src/domain/_shared/`)
- **`money.ts`** : `Money` VO en `bigint` centimes. Opérations utiles Phase 5 : `additionner`, `soustraire`, `multiplier`, `multiplyByFraction(num, den)` (prorata temporis avec banker's rounding), `multiplyByRatio(ratio)` (taux d'amortissement). Comparateurs `egale`, `lte`, `lt`, `superieurA`. Helper `compensateur()` + `negation()` (pattern D-60 Phase 2 pour les rectifications).
- **`clock.ts`** : port `Clock` pour le déterminisme temporel (essentiel BDD année fiscale). À injecter dans tous les use cases datés.

#### Encaissements (`src/domain/encaissements/`)
- **`Encaissement`** aggregate : `montant: Money`, `date: PlainDate`, `mode`, `annuleLe: PlainDate?` (soft-delete), FK `echeanceId`.
- **`EncaissementRepository.sommePaieeParEcheance(echeanceId)`** : SUM montant_centimes des encaissements actifs (`annule_le IS NULL`). **À étendre Phase 5** : nouvelle méthode `sommeRecettesAnnuelles(bailleurId, annee)` qui agrège sur la chaîne `Encaissement → EcheanceLoyer → Bail → Bailleur`.
- **`EcheanceLoyer`** : snapshot `loyerHc`, `montantCharges`, `total`, `periodeDebut`, `periodeFin`, `bailId`. Phase 5 lit `periodeFin.year` pour rattacher à l'exercice fiscal.

#### Documents (`src/domain/documents/`)
- **`Justificatif`** aggregate : `type` (enum 9 valeurs), `dateDocument: PlainDate`, `montantTtc: Money?`, `bienId | locataireId` (exclusif), `corbeilleLe` (soft-delete 10 ans rétention). Helper `anneeFiscale()` dérive de `dateDocument.year` — **à étendre Phase 5** pour priviligier `datePaiement` quand renseigné.
- **`JustificatifRepository.recherche({ anneeFiscale, bienId, locataireId, type })`** : filtrage facetté. **À étendre Phase 5** avec `qualification_fiscale` et `parent_justificatif_id`.

#### Travaux (`src/domain/travaux/`)
- **`TicketTravaux`** aggregate : `bienId`, `dateOuverture`, `dateCloture`, `statut`, `coutEstimeTtc: Money?`, `coutReelTtc: Money?`, `annuleLe` (soft-delete). D-115 a explicitement différé `natureFiscale` ici.
- **Pivot `ticket_justificatifs`** : `TicketTravauxRepository.listerJustificatifsLies(ticketId)` + `lierJustificatif` / `delierJustificatif`. À réutiliser pour les composants `amelioration` (D-FIS-G1.5) et le calcul de coût agrégé.

#### Identité (`src/domain/identite/`)
- **`Bailleur`** aggregate (D-67 Phase 2) : porteur du nouveau champ `regimeFiscal` (par défaut auto-déduit), `revenusActifsAnnuelsCourant: Money?` (pré-remplissage wizard G3.1), `fiscalite_premier_acces: DateTime?` (G5.4).

#### Patrimoine (`src/domain/patrimoine/`)
- **`Bien`** aggregate : `adresse`, `surface`, `type`, `anneeConstruction`, `lots[]`, `classeDpe` (Phase 3, informationnel pour Phase 5), `diagnostics[]`. **À étendre Phase 5** avec `ValorisationFiscale?` VO + `composants: Composant[]` (collection non bornée).

### Established Patterns (à respecter)

- **Hexagonal DDD strict** — `dependency-cruiser` interdit les imports infra dans `domain/`. Phase 5 expose des ports : `RecettesRepository`, `ChargesRepository`, `TableauAmortissementRepository`, `RegleFiscaleProvider`, `ClockProvider`.
- **Factory `X.creer(props)` + `InvariantViolated`** + brand types pour chaque nouvel agrégat (`Composant`, `ValorisationFiscale`, `DeclarationAnnuelle`, `DeclarationCorrigee`).
- **Copy-on-write immutabilité** — toutes les mutations passent par des factories ou des reconstructeurs (`Bail.modifier`, `Encaissement.annuler`, `Justificatif.mettreEnCorbeille`).
- **Soft-delete + raison** — `annule_le` ou `corbeille_le` + champ `raison_*`. Phase 5 hérite : tout calcul corrigé append-only, pas d'écrasement.
- **Repository `versDomaine(row)` + `versRow(entity)`** mapping bidirectionnel pour SQLite.
- **Builders dans `tests/_builders/`** — créer un `composantBuilder`, `declarationAnnuelleBuilder`, `ticketTravauxBuilder` (étendu) etc.
- **BDD outside-in** : scénario `.feature` Cucumber rouge → unit/integration TDD rouge/vert → scénario vert. **Couverture 100 % fiscale**.
- **EJS partials + layout-debut/fin** + helpers français (`formatEuro`, `formatPlainDate`).
- **Zod aux frontières HTTP** — validation côté adapter Fastify, jamais dans le domaine.

### Integration Points

- **Phase 2 → Phase 5** : lecture `EncaissementRepository` + chaîne `EcheanceLoyer.bail.bailleurId` pour agréger les recettes par bailleur/année.
- **Phase 3 → Phase 5** : lecture `Bien.classeDpe` (informationnel uniquement Phase 5 ; effets indirects en Phase 7 alertes).
- **Phase 4 → Phase 5** : lecture `JustificatifRepository` + `TicketTravauxRepository`. **Extensions Phase 5** : colonnes `qualification_fiscale`, `parent_justificatif_id`, `date_paiement` sur `justificatifs` ; `nature_fiscale` sur `tickets_travaux` ; nouvel `acquisition_mobilier` dans `NatureTicket` enum.
- **Phase 5 → Phase 6** : `DeclarationAnnuelle` + `DeclarationCorrigee` snapshots alimentent la liasse 2031-SD + annexes 2033-A à G. Le calcul de plus-value à la cession (V1.1 SIM-02) consommera les `Composant.amortissementCumule` et la `VNC`.
- **Phase 5 → Phase 7** : `DeclarationAnnuelle` expose des champs "alertes" : seuil micro-BIC franchi, LMP probable, ARD à consommer. Phase 7 (Dashboard & Notifications) lit ces signaux pour les alertes J-30/J-7.

</code_context>

<decisions>
## Implementation Decisions

### Décisions Claude lockées (avant discussion — non négociables)

- **D-LOCK-1** — **Seuils versionnés par année**. `domain/fiscalite/regles/regles-2026.ts` exporte `SEUIL_MICRO_BIC_LONGUE_DUREE = 8_360_000n`, `PLANCHER_ABATTEMENT = 30_500n`, `ABATTEMENT_LONGUE_DUREE = 0.5`, `SEUIL_LMP_RECETTES = 2_300_000n`, `LF_2025_DATE_EFFET = 2025-02-15`, et la table des durées d'amortissement BOFIP. Justification : RISKS.md R1.1 + CLAUDE.md "Fiscal à jour LF 2026". Pattern cohérent avec IRL versionnée Phase 3.
- **D-LOCK-2** — **Phase 5 = single-bailleur, single-foyer V1**. Le régime fiscal est porté par `Bailleur` (D-67 Phase 2 étendu), pas par `Bien`. Les seuils s'apprécient sur toutes les recettes meublées du bailleur (CGI 50-0 et 155 IV s'appliquent au contribuable).
- **D-LOCK-3** — **Plus-value de cession HORS Phase 5**. SIM-02 V1.1. Phase 5 trace uniquement les amortissements gros œuvre cumulés (préparation LF 2025).
- **D-LOCK-4** — **CFE hors Phase 5** (FIS-06 → Phase 6).
- **D-LOCK-5** — **Pas de cotisation SSI / TNS modélisée** (cas LMNP tourisme > 23 000 € hors scope V1).

### G1 — Modèle Composant sur Bien

- **D-FIS-G1.1** — **Composants fixes BOFIP** : 6 composants prédéfinis avec durées d'amortissement canoniques (terrain 0 / gros œuvre 40 ans / toiture-façade 25 ans / installations techniques 20 ans / agencements intérieurs 15 ans / mobilier 7 ans). Saisie : `Composant.montantHt: Money` + `dateAcquisition: PlainDate` par composant. Aligne directement avec liasse 2031 annexe 2033-B.
- **D-FIS-G1.2** — **Mobilier hybride** : initial saisi sur `Bien.composant[mobilier]` au moment de la valorisation, ajouts ultérieurs via `TicketTravaux` avec nouvelle `nature='acquisition_mobilier'` qui crée une cohorte d'amortissement indépendante (chaque ticket = sa propre ligne, prorata temporis indépendant).
- **D-FIS-G1.3** — **Frais d'acquisition (notaire + agence) répartis au prorata BOFIP** sur les composants amortissables (terrain exclu). `quotePart_i = frais_total × (montant_composant_i / Σ montants_amortissables)`. Le dernier composant absorbe l'écart d'arrondi pour Σ quote-part = frais_total.
- **D-FIS-G1.4** — **Écran dédié "Activer la fiscalité réel"** en Phase 5. Le `Bien` reste utilisable sans valorisation pour Phases 1–4 (pas de régression KPI activation Phase 1). Le micro-BIC fonctionne sans valorisation ; le réel l'exige.
- **D-FIS-G1.5** — **Amélioration post-acquisition = nouveau composant additionnel** sur `Bien` avec sa propre `dateAcquisition`, sa propre durée selon le type BOFIP. Origine traçable : `origineKind = 'amelioration', ticketId = …`. Compatible LF 2025 (seuls les composants `gros_oeuvre` initial + ajouts gros œuvre sont sommés pour la réintégration PV).
- **D-FIS-G1.6** — **Prorata temporis au jour près** sur exercices d'acquisition et de sortie : `dotation = annuiteComplete × (joursDetention / 365)`. Réutilise `Money.multiplyByFraction(jours, 365)` éprouvé Phase 2.
- **D-FIS-G1.7** — **ARD reportable visible dès Phase 5 dans un tableau dédié + bandeau pédagogique**. Vue "Tableau d'amortissement & ARD" affiche par exercice : dotation théorique, dotation appliquée (plafonnée), ARD généré, ARD cumulé disponible, ARD consommé. Read-model matérialisé (anti-pattern : pas de recalcul à la volée).
- **D-FIS-G1.8** — **Quote-part terrain : saisie utilisateur libre [0 %, 30 %] + aide contextuelle** sans pré-remplissage (R4.3 pédagogie + autonomie + pas de fausse précision).

### G2 — Qualification fiscale des charges

- **D-FIS-G2.1** — **Qualification différée via écran "Qualifier les charges {année}"** en Phase 5. Pas de migration douloureuse Phase 4. Statut `non_qualifie` par défaut tant que non traité. Compteur "X justificatifs à qualifier" dans le récap fiscal.
- **D-FIS-G2.2** — **Taxonomie à 4 catégories alignée 2033-A** : `entretien_reparation` (charge déductible immédiate, remise en état), `amelioration` (immobilisation amortissable, fonction nouvelle/durée prolongée), `charge_courante_periodique` (assurance, TF nette, frais syndic, intérêts emprunt, frais EC), `non_deductible` (perso, hors fiscal).
- **D-FIS-G2.3** — **Qualification portée par le `TicketTravaux` entier** ; tous les Justificatifs liés héritent (synchronisés à la clôture du ticket). Doctrine BOFIP : "un ensemble de travaux concourant à une même opération se qualifie comme un tout". Le ticket `acquisition_mobilier` force `natureFiscale = amelioration`.
- **D-FIS-G2.4** — **TTC partout** (LMNP V1 non assujetti TVA). `Justificatif.montantTtc` reste nullable Phase 4 ; nouvel invariant : `qualification_fiscale ∈ { entretien_reparation, amelioration, charge_courante_periodique }` ⇒ `montantTtc REQUIRED`. Pas de HT/TVA introduits en V1.
- **D-FIS-G2.5** — **Reclassement libre tant que `DeclarationAnnuelle.statut == brouillon`, bloqué après clôture**. Correction post-clôture → `DeclarationCorrigee` (cf. D-FIS-G4.4). Use case `qualifier-justificatif` lève `DeclarationFigeeException` si clôturée.
- **D-FIS-G2.6** — **Justificatif multi-biens : split obligatoire** à la qualification via `decomposer-justificatif` use case. Le parent reste `non_deductible` (image du document), les enfants `bienId` distinct + `montantTtc = quote-part` + `parent_justificatif_id` (FK self). Invariant : `Σ montantTtc(enfants) = montantTtc(parent)`.
- **D-FIS-G2.7** — **Suggestion déterministe par `TypeJustificatif`** (table fixe : `facture → charge_courante_periodique`, `ticket_caisse → entretien_reparation`, autres → `non_deductible`). Validation 1-clic, jamais auto-application silencieuse. V2 : assistant IA d'auto-qualification (CLA-01).
- **D-FIS-G2.8** — **Coût manuel sans pièce justificative accepté + badge persistant "Sans PJ"**. Le calcul fiscal inclut le coût ; un message orange explique BOFIP-BIC-CHG-10-10 et invite à joindre une pièce annexe. Anti-pattern : ne JAMAIS masquer le badge même en `non_deductible`.
- **D-FIS-G2.9** — **Taxe foncière encodée comme `Justificatif` standard + widget pédagogique TEOM** déclenché par regex sur libellé. Décomposition automatique en TF nette (charge_courante_periodique) et TEOM (non_deductible, récupérable locataire via Phase 2 quittancement). Doctrine décret 87-713.
- **D-FIS-G2.10** — **Intérêts d'emprunt : Justificatif annuel uniquement** (avis bancaire). Pas d'agrégat `Pret` en V1 (différé V1.1 pour SIM-01).
- **D-FIS-G2.11** — **Date de rattachement = `datePaiement`** (fallback `dateDocument`). Phase 5 ajoute `datePaiement: PlainDate?` sur `Justificatif`. Comptabilité d'encaissement unique pour micro + réel (tolérance BOFIP-BIC-DECLA-30-40-20). Cohérence d'année en année exigée.
- **D-FIS-G2.12** — **Loyers irrécouvrables : aucune écriture fiscale** (cohérence stricte avec comptabilité d'encaissement G2.11). Phase 5 ne crée aucun agrégat `PerteSurCreance`. Le suivi métier reste sur Phase 2.
- **D-FIS-G2.13** — **Honoraires EC + cotisation OGA : `charge_courante_periodique` standard, AUCUN widget de réduction d'impôt**. Réduction art. 199 quater B **abrogée** par LF 2025 art. 11 (loi 2025-127). Pas applicable aux exercices 2026+.
- **D-FIS-G2.14** — **Frais de déplacement : Justificatif annuel manuel** selon le barème BOFIP-BIC-CHG-40-60-30. Pas de journal kilométrique modélisé (V1 simple, V1.1 si besoin).
- **D-FIS-G2.15** — **Appel de charges syndic : widget décomposition manuelle à la qualification** en 4 cases (charges courantes / provisions travaux / récupérables locataire / non récupérables). Réutilise `decomposer-justificatif`. Doctrine BOFIP-BIC-CHG-30-40 + décret 87-713.
- **D-FIS-G2.16** — **Provisions pour gros entretien (PGE) : suivi simple via G2.15 + re-classification G2.5** quand l'arrêté annuel post-travaux est reçu. Zéro agrégat `ProvisionTravaux`. Si exercice clôturé : déclaration corrective Phase 6.

### G3 — Bascule LMP : revenus du foyer

- **D-FIS-G3.1** — **Snapshot annuel via wizard de clôture + champ courant sur `Bailleur`** (pré-remplissage). Le profil porte `revenusActifsAnnuelsCourant: Money?`. À la clôture, le wizard demande la valeur pour l'année N, pré-remplie depuis le profil, et fige dans `DeclarationAnnuelle.revenusFoyerSnapshot`. Alerte juste-à-temps si recettes > 23 000 € sans valeur saisie.
- **D-FIS-G3.2** — **Saisie unique "revenus du travail et assimilés du foyer"** + tooltip BOFIP-BIC-CHAMP-40-20 exhaustif (inclus : salaires nets imposables, BNC, BA, BIC autres que LMNP, traitements/pensions, gains gérance ; exclus : revenus fonciers, revenus mobiliers, PV, BIC LMNP objet de la déclaration). Pas de ventilation par catégorie en V1.
- **D-FIS-G3.3** — **Verdict tri-état (LMNP confirmé / Indéterminé / LMP probable)** affiché en bandeau permanent + détail dans récap annuel. Bandeau couleur (vert/orange/rouge) avec lien vers consultation EC en cas de LMP probable. Phase 5 informe, ne prescrit pas d'action (CLAUDE.md hors périmètre).
- **D-FIS-G3.4** — **Évaluation LMNP/LMP indépendante par exercice** (pas de sticky LMP). Aucune base légale après suppression de la condition RCS en 2009 (Conseil Constitutionnel n° 2009-587 DC). Anti-pattern : ne JAMAIS verrouiller LMP sur N+1.

### G4 — Année fiscale : clôture & immutabilité

- **D-FIS-G4.1** — **Clôture manuelle déclenchée par l'utilisateur** + vérification de prérequis bloquants (justificatifs non qualifiés, tickets non clos, revenus foyer renseignés si > 23k€, valorisation Bien si réel). Bouton "Confirmer la clôture" désactivé tant que prérequis KO.
- **D-FIS-G4.2** — **Snapshot par valeur à la clôture** : agrégats fiscaux (recettes, charges, dotations, ARD, statut LMNP/LMP, régime appliqué, composants_snapshot_json) figés en base. Pas de recalcul à la volée. Pour corriger : `DeclarationCorrigee`.
- **D-FIS-G4.3** — **Régime micro-BIC vs réel : auto-choix par défaut + override**. ≥ 83 600 € → réel forcé. < 83 600 € → micro par défaut, option réel possible (1 an renouvelable tacitement, BOFIP-BIC-DECLA-10-30). Comparateur micro/réel pré-affiché en background à la clôture pour < seuil.
- **D-FIS-G4.4** — **`DeclarationCorrigee` modélisée en Phase 5**, liasse rectificative générée en Phase 6. La déclaration originale reste intouchée (audit-trail). N corrections successives supportées avec `motif` et `cree_le` distincts.

### G5 — Zones grises complémentaires

- **D-FIS-G5.1** — **Multi-bien : vue consolidée bailleur en tête + détail par bien**. Seuils micro/LMP appréciés sur le total (D-LOCK-2). Read-model `DeclarationAnnuelleConsolide` matérialisé à la clôture.
- **D-FIS-G5.2** — **Sortie de composant : `dateSortie` + amortissement prorata + VNC conservée**. `motifSortie ∈ { vente, mise_au_rebut, sinistre, autre }`. Préparation V1.1 SIM-02 (PV de cession). Vente du bien entier → tous les composants reçoivent la même `dateSortie`, le `Bien` est soft-deleted.
- **D-FIS-G5.3** — **Exports CSV + PDF récap fiscal annuel dès Phase 5**. CSV pour expert-comptable, PDF synthétique pour archivage bailleur. Réutilise `pdfmake` (Phases 2 + 3). Phase 5 livrable indépendamment de Phase 6.
- **D-FIS-G5.4** — **Onboarding fiscal progressif et optionnel** pour les utilisateurs Phase 1–4. Écran d'accueil "Bienvenue dans Fiscalité LMNP" avec choix "Commencer / Plus tard / Tout ignorer". Bannière persistante "{X} justificatifs à qualifier". Champ `Bailleur.fiscalite_premier_acces` (DateTime?) trace le premier accès.

### Vérifications fiscales effectuées pendant la discussion

- **LF 2026 vérifié** : aucun amortissement retiré du statut LMNP (sous-amendement 2 %/an rejeté). Seuls changements : CSG 9.2 → 10.6 % (hors scope Phase 5), seuil micro-BIC 77 700 → 83 600 € pour recettes 2026-2028.
- **LF 2025 vérifié** : réintégration amortissements gros œuvre dans PV (CGI 150 VB III), applicable 2025-02-15 — capturé en D-LOCK-3.
- **OGA / art. 199 quater B abrogé** par LF 2025 art. 11 — capturé en D-FIS-G2.13.

### Claude's Discretion

Aucune zone laissée à la discrétion totale de Claude. Tous les choix structurels sont tracés (37 décisions explicites + 5 D-LOCK). Les détails d'implémentation purs (nommage des helpers, structure des fichiers EJS, agencement précis des migrations) sont laissés au planner / executor selon les patterns établis Phases 1–4.

</decisions>

<fiscal_rules_locked>
## Règles fiscales lockées pour Phase 5

> **MUST encoder dans `domain/fiscalite/regles/regles-2026.ts` (Money centimes pour les montants, `Temporal.PlainDate` pour les dates).**

| Constante | Valeur 2026 | Source juridique |
|---|---|---|
| `SEUIL_MICRO_BIC_LONGUE_DUREE` | `8_360_000n` centimes (83 600 €) | CGI art. 50-0 (révision triennale ; recettes 2026-2028) |
| `PLANCHER_ABATTEMENT` | `30_500n` centimes (305 €) | CGI art. 50-0 |
| `ABATTEMENT_LONGUE_DUREE` | `50 %` | CGI art. 50-0 |
| `SEUIL_LMP_RECETTES` | `2_300_000n` centimes (23 000 €) | CGI art. 155 IV |
| `DUREE_AMORTISSEMENT_TERRAIN` | non amortissable | CGI art. 39 |
| `DUREE_AMORTISSEMENT_GROS_OEUVRE` | 40 ans | BOFIP-BIC-AMT-20-40 (référence typique LMNP) |
| `DUREE_AMORTISSEMENT_TOITURE_FACADE` | 25 ans | BOFIP |
| `DUREE_AMORTISSEMENT_INSTALLATIONS_TECHNIQUES` | 20 ans | BOFIP |
| `DUREE_AMORTISSEMENT_AGENCEMENTS_INTERIEURS` | 15 ans | BOFIP |
| `DUREE_AMORTISSEMENT_MOBILIER` | 7 ans | BOFIP (souvent 5-10, 7 par défaut) |
| `LF_2025_DATE_EFFET_PV` | `PlainDate.from('2025-02-15')` | LF 2025 art. 84 (loi 2025-127) |
| `ARD_DUREE_REPORT` | sans limite | CGI art. 39 B |

**Cas limites obligatoirement testés en BDD** :

- Recettes = `8_359_999n` (83 599,99 €) → micro éligible.
- Recettes = `8_360_001n` (83 600,01 €) → réel forcé.
- Recettes × 50 % = `30_499n` (304,99 €) → application du plancher 305 €.
- Recettes = `2_299_999n` (22 999,99 €) → LMNP confirmé.
- Recettes = `2_300_001n` (23 000,01 €) ET revenus foyer = `2_300_001n` → LMNP (égalité = non strict supérieur).
- Recettes = `2_400_000n` ET revenus foyer = `2_300_000n` → LMP probable (les deux critères stricts).
- Recettes = `2_400_000n` ET revenus foyer non renseignés → statut `indetermine_revenus_foyer_manquants`.
- Acquisition au 15 mars 2026 d'un composant gros œuvre 200 000 €, exercice 2026 → dotation = 5 000 € × (292/365) = 4 000 € (vérifier arrondi).
- Acquisition + sortie même année (composant détruit au 30 juin) → dotation prorata sur 6 mois.
- Soft-delete d'un encaissement post-clôture → snapshot inchangé (audit-immuable).
- LMNP en N (24 000 € recettes, 30 000 € foyer), LMP en N+1 (24 000 €, 20 000 € foyer), LMNP en N+2 → 3 déclarations indépendantes (pas de sticky LMP).

</fiscal_rules_locked>

<anti_patterns>
## Anti-patterns à éviter Phase 5

1. **Float pour les montants fiscaux.** TOUJOURS `Money` en BigInt centimes. Aucun nombre à virgule flottante dans `domain/fiscalite/`.
2. **Seuils hardcodés.** TOUJOURS passer par `RegleFiscaleProvider` injecté qui résout selon l'année de l'exercice. Versionner `regles-2026.ts`, `regles-2027.ts`, etc.
3. **Recalcul à la volée des agrégats fiscaux à chaque requête UI.** TOUJOURS un read-model matérialisé (`DeclarationAnnuelle` snapshot par valeur).
4. **Hard-delete sur les calculs fiscaux.** TOUJOURS append-only avec `remplace_id` ou `DeclarationCorrigee`. La déclaration originale est immuable.
5. **Invariant cross-aggrégat dans un agrégat.** TOUJOURS orchestrer en use case (ex: la cohérence ticket↔justificatifs lors de la qualification G2.3 vit dans `qualifier-ticket-travaux`, pas dans `TicketTravaux`).
6. **Masquer le badge "Sans PJ" en `non_deductible`.** TOUJOURS visible pour audit.
7. **Sticky LMP** ("une fois LMP, toujours LMP", "verrouillage N ans"). FAUX juridiquement depuis 2009.
8. **Auto-qualification silencieuse** des Justificatifs Phase 1–4. La suggestion défaut (G2.7) ne s'applique qu'à validation utilisateur, jamais en arrière-plan.
9. **Recommandation prescriptive en cas de LMP probable** (ex: "déclare-toi à l'URSSAF"). Phase 5 informe, l'utilisateur consulte un EC.
10. **Inflation de l'enum `TypeJustificatif`** par cas particuliers fiscaux (TF, syndic, intérêts, etc.). TOUJOURS un widget pédagogique à la qualification + decomposer-justificatif si besoin.
11. **Calcul d'IR / prélèvements sociaux** dans Phase 5. Hors scope (Phase 7 ou V1.1).
12. **Migration douloureuse Phase 4** : ne JAMAIS forcer la qualification rétroactive obligatoire — Phase 5 reste optionnelle.

Référence transverse : `practices/BEHAVIOR.md` (sceptique, simplicité, surgical changes).

</anti_patterns>

<specifics>
## Spécificités d'implémentation à retenir

- **Naming français strict** : `Composant`, `ValorisationFiscale`, `DeclarationAnnuelle`, `DeclarationCorrigee`, `RegleFiscale2026`, `TableauAmortissement`, `QualificationFiscaleEnum`, `NatureFiscaleTicket`, `ARD`, `Bailleur`, `Bien`, etc. Jamais d'anglais.
- **Migrations SQLite prévisionnelles Phase 5** (ordre suggéré, à valider par planner) :
  - `0014_phase5_qualification_charges.sql` — étend `justificatifs` (`qualification_fiscale`, `qualifie_par`, `qualifie_le`, `date_paiement`, `parent_justificatif_id`).
  - `0015_phase5_bailleur_fiscalite.sql` — étend `bailleurs` (`revenus_actifs_annuels_courant_centimes`, `fiscalite_premier_acces`).
  - `0016_phase5_declaration_annuelle.sql` — table `declarations_annuelles` (snapshot par valeur).
  - `0017_phase5_declaration_corrigee.sql` — étend `declarations_annuelles` ou crée `declarations_corrigees` (lien parent).
  - `0018_phase5_composant.sql` — table `bien_composant` (FK Bien, type, montant, dates, durée, origine).
  - `0019_phase5_amortissement_exercice.sql` — table `amortissement_exercice` (read-model par bien/année).
  - `0020_phase5_valorisation_fiscale.sql` — table `bien_valorisation_fiscale` (1-1 avec Bien).
  - `0021_phase5_ticket_nature_fiscale.sql` — étend `tickets_travaux` (`nature` enum étendu avec `acquisition_mobilier`, `nature_fiscale`).
- **Cucumber `.feature` minimaux par règle fiscale** (BDD outside-in 100 % fiscale) :
  - `seuil-micro-bic.feature` (3-4 scénarios incluant le seuil exact 83 600 €).
  - `abattement-micro-bic.feature` (50 % + plancher 305 €).
  - `amortissement-composant.feature` (BOFIP par composant + prorata).
  - `frais-acquisition-prorata.feature` (G1.3 + arrondi du dernier composant).
  - `ard-report.feature` (génération + consommation + immuabilité).
  - `lmp-detection.feature` (3 critères tri-état).
  - `cloture-exercice.feature` (prérequis + snapshot).
  - `declaration-corrigee.feature` (création + immutabilité de l'originale).
  - `qualification-charges.feature` (4 catégories + invariant TTC + suggestion).
  - `composant-sortie.feature` (G5.2 prorata + VNC conservée).
  - `multi-bien-consolide.feature` (G5.1 seuils sur total).
- **Helpers UI réutilisables** : tooltip BOFIP générique (lien externe + texte court), widget tri-état (vert/orange/rouge), compteur de prérequis cochés.
- **Tests d'intégration** : `cloturer-exercice.spec.ts` avec scénarios LMNP confirmé / Indéterminé / LMP / multi-correction.

</specifics>

<deferred>
## Idées différées (hors scope Phase 5)

### V1.1 (post-Phase 7)

- **SIM-01** — Simulateur micro vs réel sur plusieurs années. Phase 5 prépare déjà le terrain (D-FIS-G4.3 calcule les deux scénarios).
- **SIM-02** — Simulateur de plus-value à la cession LMNP (LF 2025 art. 84). Phase 5 trace les amortissements gros œuvre cumulés + VNC à la sortie (D-FIS-G5.2).
- **SIM-03** — Alerte de bascule LMNP → LMP + simulation comparative. Phase 5 fournit déjà le verdict (D-FIS-G3.3), V1.1 ajoutera les projections.
- **CES-01** — Indivision, démembrement (usufruit/nue-propriété). Hors scope V1 (D-LOCK-2).
- **HIS-01** — Import historique (5 ans de quittances + état des amortissements). Permet d'amorcer Phase 5 sur un bien acquis avant l'app.
- **HIS-02** — Reporting comparatif fin d'année.
- **Bounded context `Financement` avec agrégat `Pret`** — tableau d'amortissement bancaire + extraction auto des intérêts (D-FIS-G2.10).
- **Agrégat `DeplacementProfessionnel`** + calcul barème kilométrique automatique (D-FIS-G2.14).
- **Agrégat `PerteSurCreance`** pour comptabilité d'engagement optionnelle (D-FIS-G2.12). Couplé à SIM-01.
- **Calcul d'IR + prélèvements sociaux** (PS 18.6 % depuis LF 2026) — Phase 7 dashboard ou V1.1.
- **Sauvegarde / restore** des données fiscales (BAK-01) + chiffrement DB au repos (BAK-02).

### V2

- **CLA-01** — Assistant IA d'auto-qualification fiscale (D-FIS-G2.7). Hors scope V1.1 (= local-first sans LLM). En V2 possiblement LLM local + opt-in cloud.
- **TOU-01** — Meublé de tourisme (loi Le Meur, seuils 15 000 € / abattement 30 %).
- **CES-02 à CES-05** — Bail mobilité / étudiant first-class, colocation solidaire, mixte personnel/locatif, multi-bailleur.
- **EDI-01** — Export EDI-TDFC.
- **EXP-01** — Mode "accompagné par expert-comptable".
- **INS-01** — Intégration INSEE (loyers de référence).

### Hors scope absolu

- **CFE** (FIS-06) — Phase 6 dédiée.
- **Liasse 2031-SD + annexes 2033-A à G** — Phase 6 ; Phase 5 expose les snapshots.
- **Notifications J-30/J-7** — Phase 7 (DAS-02).
- **Cotisations SSI/TNS** (LMP) — D-LOCK-5, hors scope V1.

### Reviewed Todos (not folded)

Aucun todo n'était listé pour Phase 5 (`todo_count = 0`) — discussion partie sur table vierge.

</deferred>

<next_steps>
## Prochaines étapes

```
/clear
/gsd-plan-phase 5
```

Le `gsd-phase-researcher` lira ce CONTEXT.md pour identifier les recherches nécessaires (références BOFIP exactes, BDD existante pour les composants, etc.) avant que le `gsd-planner` ne découpe Phase 5 en plans d'exécution.

**Vagues d'exécution Phase 5 prévisibles** (à valider par le planner) :

1. **Wave 1 — Walking enabler fiscal** : `Bailleur.regimeFiscal` (D-LOCK-2 + G3.1) + `RegleFiscale2026` constantes + `RegleFiscaleProvider` port + `Clock` (réutilisé) + migration `0014` minimale.
2. **Wave 2 — Recettes & charges agrégées** (FIS-03) : `RecettesRepository.sommeRecettesAnnuelles` + `ChargesRepository` + qualification G2.1–G2.4 + UI "Qualifier les charges {année}".
3. **Wave 3 — Composants & amortissement** (FIS-04) : `Composant` aggregate + `ValorisationFiscale` VO + `TableauAmortissement` + ARD + prorata G1.6 + UI G1.4 "Activer fiscalité bien".
4. **Wave 4 — Détection LMP & micro-BIC** (FIS-01 + FIS-02) : abattement micro + bandeau verdict G3.3 + wizard G3.1.
5. **Wave 5 — Clôture & DeclarationCorrigee** (G4) : `DeclarationAnnuelle` snapshot + `DeclarationCorrigee` + prérequis G4.1.
6. **Wave 6 — Multi-bien consolidé** (G5.1) + sortie composant (G5.2) + exports CSV/PDF (G5.3) + onboarding progressif (G5.4).
7. **Wave 7 — UI polish + a11y** (cohérent avec wave 7 Phase 3 IRL).
8. **Wave 8 — Gap closure** (UAT + corrections).

**Mode planification recommandé** : `gsd-plan-phase 5` standard (pas de `--prd` car le contexte est déjà très étoffé via CONTEXT.md ; le researcher ajoutera RESEARCH.md pour valider les références BOFIP et fournir les snippets de code patterns).

</next_steps>

---

*Phase: 5-fiscalit-lmnp-r-gimes-recettes-charges-amortissement*
*Context gathered: 2026-05-20*
*Décisions capturées: 37 (G1: 8, G2: 16, G3: 4, G4: 4, G5: 4) + 5 D-LOCK*
*Vérifications externes: LF 2025/2026/OGA validées via WebSearch durant la discussion*
