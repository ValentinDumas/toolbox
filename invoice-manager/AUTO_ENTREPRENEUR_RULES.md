# Auto-entrepreneur — Règles fiscales, sociales et déclaratives

> Document de référence pour toute logique de calcul, validation ou export
> touchant le profil **auto-entrepreneur** (alias micro-entrepreneur).
>
> **Avertissement :** les seuils, taux et plafonds évoluent chaque année.
> Les valeurs ci-dessous reflètent l'état du droit **applicable au 2026-05-12**,
> vérifié à cette date sur les sources officielles (URSSAF, impots.gouv.fr,
> service-public.fr). Toute valeur utilisée dans le code doit pointer vers
> ce fichier comme source unique de vérité, et toute évolution réglementaire
> doit être répercutée **ici en même temps** que dans le code.
>
> **Sources officielles à consulter en cas de doute :**
> - `https://www.autoentrepreneur.urssaf.fr/` — cotisations, déclarations sociales
> - `https://www.impots.gouv.fr/` — TVA, versement libératoire, 2042-C-PRO
> - `https://entreprendre.service-public.fr/` — vue d'ensemble régime micro
> - `https://bofip.impots.gouv.fr/` — doctrine fiscale officielle (BOFiP)
> - BOI-BIC-DECLA-10, BOI-TVA-DECLA-40 pour les bases TVA / micro
> - Code général des impôts : art. 50-0 (micro-BIC), 102 ter (micro-BNC),
>   293 B (franchise en base de TVA)
> - Code de la sécurité sociale : art. L613-7 (régime micro-social)

---

## 1. Définition et champ d'application

L'**auto-entrepreneur** (terme officiel : *micro-entrepreneur* depuis 2016)
est un entrepreneur individuel qui bénéficie d'un régime simplifié :

- régime fiscal : **micro-BIC** (vente, prestations commerciales/artisanales)
  ou **micro-BNC** (professions libérales, prestations intellectuelles) ;
- régime social : **micro-social simplifié** (cotisations forfaitaires
  proportionnelles au CA encaissé) ;
- comptabilité ultra-allégée (livre des recettes, registre des achats si
  activité de vente) ;
- option possible : **versement libératoire** de l'impôt sur le revenu.

Le statut est conditionné au respect de **plafonds de chiffre d'affaires**
(voir §2). En cas de dépassement deux années consécutives, sortie du régime.

---

## 2. Plafonds de chiffre d'affaires (CA HT encaissé)

Plafonds **revalorisés au 1er janvier 2026** (revalorisation triennale,
source URSSAF) :

| Activité | Plafond CA annuel 2026 | Rappel 2023-2025 |
|---|---|---|
| Vente de marchandises, fourniture de denrées à emporter / consommer sur place, prestations d'hébergement (hors meublé de tourisme non classé) | **203 100 €** | 188 700 € |
| Prestations de services (BIC) et professions libérales (BNC) | **83 600 €** | 77 700 € |
| Location de meublés de tourisme non classés | **15 000 €** | 15 000 € |

**Activité mixte :** plafond global = 203 100 € (2026), **dont** maximum
83 600 € de prestations de services.

**Première année :** plafonds proratisés au nombre de jours d'activité (sauf
exception création en cours d'année — règle à vérifier au cas par cas).

**Sortie du régime :** si dépassement sur **deux années consécutives** →
bascule au régime réel (BIC réel simplifié / déclaration contrôlée BNC) au
1er janvier de l'année suivante.

---

## 3. Régime fiscal — micro-BIC / micro-BNC

### 3.1 Abattements forfaitaires (sans versement libératoire)

Le bénéfice imposable est calculé par l'administration par application d'un
**abattement forfaitaire** sur le CA déclaré (art. 50-0 et 102 ter du CGI) :

| Catégorie | Abattement | Minimum |
|---|---|---|
| Vente de marchandises (BIC vente) | **71 %** | 305 € |
| Prestations de services BIC (artisanat, commerce) | **50 %** | 305 € |
| Professions libérales BNC | **34 %** | 305 € |

→ Bénéfice imposable = CA × (1 − abattement), soumis au barème progressif
de l'IR avec le reste du foyer fiscal.

**Conséquence côté logiciel :** un auto-entrepreneur ne déduit **PAS** ses
charges réelles. L'abattement est forfaitaire et représente l'intégralité
des charges. La distinction « facture déductible / non déductible » n'a
**aucun impact fiscal direct** en micro. Les factures reçues ne servent
qu'à :
- tracer les dépenses pour pilotage de gestion / marge ;
- prouver le caractère professionnel d'un achat en cas de contrôle ;
- alimenter une éventuelle déduction si l'auto-entrepreneur change de
  régime.

### 3.2 Versement libératoire de l'impôt sur le revenu (option)

Option ouverte si le **revenu fiscal de référence (RFR)** de l'avant-dernière
année (N−2) est inférieur à un plafond par part de quotient familial.

**Plafond RFR applicable pour une option exerçable en 2026** (RFR figurant
sur l'avis d'imposition 2024 sur les revenus 2024) :

| Composition du foyer | Plafond RFR 2026 |
|---|---|
| 1 part (célibataire sans enfant) | **29 315 €** |
| 2 parts (couple) | 58 630 € |
| 2,5 parts (couple + 1 enfant) | 73 288 € |
| 3 parts (couple + 2 enfants) | 87 945 € |

Règle : 29 315 € pour la 1ère part, majoré de 50 % par demi-part supplémentaire.

**Date limite pour adhérer au VFL applicable en N :** au plus tard le
**30 septembre N−1** (soit le 30 septembre 2025 pour une application au
1er janvier 2026).

Taux appliqués sur le **CA encaissé** (et non sur le bénéfice) :

| Activité | Taux versement libératoire IR |
|---|---|
| Vente de marchandises | **1,0 %** |
| Prestations de services BIC | **1,7 %** |
| Professions libérales (BNC) | **2,2 %** |

Ce versement est payé en même temps que les cotisations sociales URSSAF
(mensuel ou trimestriel). Il **libère** l'auto-entrepreneur de l'IR sur ces
revenus (mais le CA est tout de même reporté sur la 2042-C-PRO pour le calcul
du RFR du foyer).

### 3.3 Déclaration annuelle de revenus — 2042-C-PRO

Que l'auto-entrepreneur ait opté ou non pour le versement libératoire, il
doit reporter chaque année son **CA annuel encaissé** sur la déclaration
complémentaire **2042-C-PRO**, ventilé par catégorie (vente / services BIC /
BNC). Le service en ligne du site impots.gouv.fr reprend ces lignes.

---

## 4. Régime social — cotisations URSSAF (micro-social)

Les cotisations sociales sont **proportionnelles au CA encaissé** et payées
à l'URSSAF via le portail **autoentrepreneur.urssaf.fr**.

### 4.1 Taux de cotisations sociales 2026 (en vigueur au 1er janvier 2026)

| Activité | Taux cotisations sociales 2026 | Rappel 2025 |
|---|---|---|
| Vente de marchandises, fourniture de denrées, hébergement | **12,3 %** | 12,3 % |
| Prestations de services BIC (artisans, commerçants, location meublée non classée) | **21,2 %** | 21,2 % |
| Prestations BNC affiliées **SSI** (libérales non réglementées) | **25,6 %** ⬆️ | 24,6 % (+1 pt au 01/01/2026) |
| Prestations BNC affiliées **CIPAV** (libérales réglementées : architectes, géomètres-experts, psychologues, ostéopathes, etc.) | **23,2 %** | 23,2 % |
| Location de meublés de tourisme **classés** et chambres d'hôtes | **6,0 %** | 6,0 % |

**Évolution structurelle au 01/01/2026 :** à taux global identique pour la
plupart des activités, la répartition interne change — la part CSG-CRDS
diminue au profit des cotisations contributives qui ouvrent des droits
sociaux individuels (retraite, indemnités journalières). Côté logiciel,
seuls les taux globaux ci-dessus comptent pour le calcul du prélèvement
URSSAF.

**Hausse BNC non réglementé :** +1 point au 01/01/2026 (24,6 → 25,6 %),
suite à la poursuite de la réforme d'harmonisation des cotisations des
indépendants. D'autres hausses progressives sont prévues les années
suivantes — à revérifier chaque 1er janvier.

S'ajoutent des contributions annexes prélevées en même temps :

- **Contribution à la formation professionnelle (CFP)** : 0,1 % (vente),
  0,2 % (libéral BNC), 0,3 % (artisan/services BIC) du CA.
- **Taxe pour frais de chambre consulaire (CCI / CMA)** : variable selon
  activité (commerciale / artisanale / mixte), prélevée par l'URSSAF.

### 4.2 Cadence de déclaration et de paiement

Choix entre **mensuelle** (défaut) et **trimestrielle**, exerçable lors de
la création puis modifiable une fois par an (avant le 31 octobre pour
application N+1).

- Mensuel : déclaration et paiement le dernier jour du mois suivant le
  mois d'encaissement (CA encaissé en janvier → déclaré et payé fin février).
- Trimestriel : 30 avril (T1), 31 juillet (T2), 31 octobre (T3),
  31 janvier N+1 (T4).

**CA à déclarer = CA encaissé sur la période**, et non CA facturé. Une
facture émise non encore payée par le client n'entre **pas** dans le CA
déclaré.

### 4.3 ACRE — Aide à la création / reprise d'entreprise (réforme 2026)

Exonération partielle de cotisations sociales sur les **12 premiers mois
d'activité**, sous conditions d'éligibilité.

**Conditions 2026 :**
- L'ACRE n'est **plus automatique** : elle doit faire l'objet d'une demande
  explicite auprès de l'URSSAF dans les **60 jours** suivant la création
  (auparavant 45 jours).
- Réservée à certains profils éligibles (demandeurs d'emploi, RSA, jeunes,
  bénéficiaires de minima sociaux, repreneurs en QPV, etc. — liste sur
  service-public.fr).

**Taux ACRE — barème dégressif applicable en 2026 :**

| Période de création | Cotisations sociales pendant les 12 premiers mois |
|---|---|
| Création **avant le 1er juillet 2026** | **50 %** du taux normal (exonération de 50 %) |
| Création **à partir du 1er juillet 2026** | **75 %** du taux normal (exonération réduite à 25 %) |

La période d'exonération ne dépasse jamais 12 mois civils à compter de
l'affiliation.

### 4.4 CA nul

Tenu d'effectuer la déclaration même si CA = 0 € sur la période (sinon
pénalité de 58 € par déclaration manquante).

---

## 5. TVA — franchise en base et seuils

**Statut de la réforme (état au 12/05/2026) :** la réforme transposant la
directive UE 2020/285 (seuil unique à 25 000 €) a été **suspendue** par le
gouvernement en 2025, puis une variante (seuil unique 37 500 € / travaux
immobiliers 25 000 €) a été **rejetée par le Sénat lors du PLF 2026**. Les
seuils historiques restent applicables jusqu'à nouvel ordre.

### 5.1 Principe : franchise en base (art. 293 B CGI)

Par défaut, l'auto-entrepreneur bénéficie de la **franchise en base de TVA** :

- il **ne facture pas de TVA** à ses clients ;
- il **ne récupère pas la TVA** sur ses achats ;
- mention obligatoire sur les factures :
  **« TVA non applicable, art. 293 B du CGI »**.

### 5.2 Seuils de franchise en base

Réforme de la franchise unique TVA initialement prévue pour le 1er mars
2025 puis **suspendue** par le gouvernement — les seuils historiques
restent applicables dans l'attente :

| Activité | Seuil de franchise | Seuil majoré (tolérance) |
|---|---|---|
| Vente de marchandises, hébergement | 85 000 € | 93 500 € |
| Prestations de services BIC / BNC | 37 500 € | 41 250 € |

Règles de bascule :

- **Franchise maintenue** tant que le CA N reste ≤ seuil de base.
- **Franchise maintenue jusqu'à fin N** si seuil de base dépassé mais
  seuil majoré non atteint ET seuil de base non dépassé en N−1.
- **Assujettissement à la TVA dès le 1er jour du mois de dépassement** si
  le seuil majoré est franchi.
- Sortie également au 1er janvier N+1 si seuil de base dépassé deux
  années consécutives.

### 5.3 Option pour le paiement de la TVA

L'auto-entrepreneur peut renoncer à la franchise et **opter pour la TVA**
(formulaire à adresser au SIE). Intérêt : récupération de la TVA sur les
achats. Option valable 2 ans, reconduite tacitement.

### 5.4 Conséquences côté logiciel

- Un profil auto-entrepreneur **en franchise** émet des factures à TVA = 0
  et taux = N/A : la mention légale doit apparaître.
- Le récapitulatif TVA est **sans objet** en franchise (déjà neutralisé
  côté code, cf. commit `434ed17`).
- Dès qu'un profil dépasse les seuils ou opte pour la TVA, il doit pouvoir :
  - facturer avec TVA collectée (taux 20 % / 10 % / 5,5 % / 2,1 %) ;
  - tenir un suivi de la TVA déductible sur les achats ;
  - produire les déclarations CA3 / CA12 (à voir, hors scope micro pur).

---

## 6. Cotisation foncière des entreprises (CFE)

- **Exonération totale la première année civile** d'activité.
- À partir de l'année suivante : CFE due dans la commune du local
  professionnel (ou du domicile si pas de local).
- Montant minimum forfaitaire dépendant du CA N−2, fixé par chaque commune
  (barème national encadrant des minima).
- **Exonération permanente** si CA annuel ≤ 5 000 € (revalorisé
  périodiquement).
- Déclaration initiale **1447-C-SD** à déposer avant le 31 décembre de
  l'année de création.

---

## 7. Obligations comptables et facturation

### 7.1 Obligations comptables allégées

L'auto-entrepreneur est dispensé de comptabilité commerciale complète. Il doit
néanmoins tenir :

- un **livre des recettes** chronologique (date, montant, mode de paiement,
  identité du client, référence de la facture, nature de la prestation) ;
- un **registre des achats** chronologique, **uniquement** pour les
  activités de vente / fourniture de denrées / hébergement (date, montant,
  mode de paiement, fournisseur, nature).

Conservation : **10 ans** (art. L123-22 du Code de commerce, applicable à
tous les commerçants y compris auto-entrepreneurs).

### 7.2 Mentions obligatoires sur les factures émises

- Nom et prénom + dénomination commerciale éventuelle
- Adresse professionnelle
- **SIREN / SIRET**
- Code APE
- Numéro de facture (séquentiel, sans rupture)
- Date d'émission
- Date de la prestation / livraison
- Désignation, quantité, prix unitaire HT
- **Mention « TVA non applicable, art. 293 B du CGI »** si en franchise
- Conditions de règlement, taux de pénalités de retard, indemnité forfaitaire
  pour frais de recouvrement (40 €) si client professionnel
- Mention de l'assurance professionnelle obligatoire si applicable (artisans
  du bâtiment notamment : nom assureur, n° contrat, couverture géographique)

### 7.3 Compte bancaire dédié

Obligation d'ouvrir un **compte bancaire dédié à l'activité** si le CA annuel
dépasse **10 000 €** pendant **deux années civiles consécutives**. Pas
nécessairement un compte « professionnel » : un second compte personnel
suffit.

---

## 8. Récapitulatif des calculs pour le logiciel

Pour un auto-entrepreneur sur une période donnée :

```
CA_encaissé             = somme des factures émises ENCAISSÉES sur la période
                          (date de paiement, pas date d'émission)

Cotisations_URSSAF      = CA_encaissé × taux_micro_social (cf. §4.1)
CFP                     = CA_encaissé × taux_CFP        (cf. §4.1)
Versement_libératoire   = CA_encaissé × taux_VFL        (cf. §3.2)
                          uniquement si option exercée

Bénéfice_imposable_IR   = CA_encaissé × (1 − abattement) (cf. §3.1)
                          uniquement si pas d'option versement libératoire
```

**Charges réelles : non utilisées pour le calcul fiscal** en régime micro.
Elles n'apparaissent qu'à titre de pilotage / preuve.

**TVA : neutralisée tant que le profil est en franchise** (cf. §5).

---

## 9. Points d'attention spécifiques côté implémentation

- **Encaissement vs facturation :** toute logique de déclaration URSSAF doit
  s'appuyer sur la **date de paiement** de la facture, pas la date d'émission.
  Champ canonique en base : `invoices.date_paiement` (préexistant, polymorphique
  selon le sens : encaissement pour une pièce émise, règlement pour une pièce
  reçue). Accès domaine via `services.comptabilite.date_encaissement(row)`,
  qui ne retourne la valeur que pour les pièces émises — protégeant ainsi
  le vocabulaire ubiquitaire AE.
- **Plafond mixte :** une activité mixte (vente + services) nécessite un
  contrôle plafond global + sous-plafond services.
- **Cadence URSSAF :** stockée dans le profil (`mensuelle` / `trimestrielle`)
  et alimente l'agenda des déclarations.
- **Versement libératoire :** flag par profil, qui modifie l'agrégation
  fiscale en sortie.
- **Franchise TVA :** flag par profil, neutralise déjà la TVA en sortie
  (cf. commit `434ed17`).
- **ACRE :** flag temporel sur le profil (date de fin) → taux divisés par 2
  pendant la période.
- **CFE :** non calculée automatiquement (montant communal), mais à signaler
  à l'utilisateur en novembre comme rappel de déclaration / paiement.

---

## 10. Sources et mises à jour

À chaque revalorisation annuelle (généralement publiée fin décembre /
janvier) :

1. Vérifier les taux et plafonds sur `autoentrepreneur.urssaf.fr` et
   `impots.gouv.fr`.
2. Mettre à jour les valeurs dans ce fichier **et** dans le code (`config.py`,
   `services/`, tests fiscaux).
3. Ajouter un commit unique : `chore(auto-entrepreneur): mise à jour taux et
   plafonds <année>`.
4. Documenter dans le `CHANGELOG.md` ou `README.md` la date d'effet du
   nouveau barème.
