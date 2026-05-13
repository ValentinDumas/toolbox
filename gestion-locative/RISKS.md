# RISKS — Risques et angles d'attaque

> Registre des risques pour la priorité V1 (LMNP en location meublée longue durée).
> Mis à jour à chaque revue produit, changement législatif ou retour utilisateur.
>
> **Légende statut :**
> - **V1** — à traiter dans le MVP, non négociable.
> - **V1.1** — post-MVP rapide (premier trimestre après V1).
> - **V2** — différé, à acter dans le PRD.
> - **Continu** — processus permanent, pas un livrable.

## Top 5 prioritaires (à intégrer V1)

1. **R3.1 Backup planifié + export complet** — la DB SQLite locale est un point unique de défaillance.
2. **R1.2 Tableau d'amortissement historisé** — sans amortissements gros œuvre cumulés depuis l'origine, pas d'anticipation PV (LF 2025).
3. **R2.1 Alertes d'échéance** — diagnostics, IRL, CFE, seuils micro/réel, seuils LMNP/LMP.
4. **R1.3 Snapshot annuel immuable** post-déclaration (reproductibilité audit fiscal).
5. **R5.1 Maintenance des règles fiscales** — doc daté, golden tests, revue annuelle planifiée.

---

## 1. Risques fiscaux

### R1.1 — Veille législative annuelle

**Description** : chaque loi de finances modifie seuils, abattements, règles. Sans veille, le logiciel devient faux en quelques mois.
**Impact si ignoré** : calculs erronés, déclarations refusées ou redressement.
**Mitigation** :
- Doc [LMNP.md](LMNP.md) **datée** (en-tête), revue **chaque janvier** post-publication PLF.
- Code source : règles fiscales **versionnées** (`RegleFiscale2026`, `RegleFiscale2027`...) et appliquées en fonction de l'année d'exercice.
- ADR (Architecture Decision Record) par changement légal majeur.
- Golden tests : un jeu de cas réels par exercice, à re-valider après chaque mise à jour.

**Statut** : **Continu** + V1 (poser l'architecture de versioning des règles).

### R1.2 — Anticipation de la plus-value (suivi historique)

**Description** : depuis LF 2025 (art. 84), le calcul de PV LMNP réintègre les amortissements gros œuvre cumulés. Si on n'a pas la donnée depuis l'origine, on ne peut **ni anticiper ni reconstituer** la PV à la cession.
**Impact** : surprise fiscale au moment de vendre, ou impossible de simuler.
**Mitigation** :
- Tableau d'amortissement **par composant** dès la V1, avec historique cumulé depuis date de mise en service.
- Import initial : permettre la saisie d'un **état des amortissements antérieurs** (cas d'un bailleur existant qui démarre l'outil).
- Simulateur PV intégré à la V1 (au moins en lecture, pas forcément interactif).

**Statut** : **V1** (architecture + saisie) ; simulateur **V1.1**.

### R1.3 — Reproductibilité d'une déclaration (audit fiscal)

**Description** : un contrôle fiscal en N+3 sur l'exercice N exige de retrouver l'**état exact** des données et des règles appliquées.
**Impact** : impossibilité de défendre la déclaration, charge de preuve à la charge du bailleur.
**Mitigation** :
- **Snapshot annuel immuable** au moment de l'export 2031 : DB lock + dump signé (hash).
- Ledger append-only des opérations comptables (cf. principe « audit-friendly » de [VISION.md](VISION.md)).
- Versioning des règles fiscales appliquées au moment du snapshot.

**Statut** : **V1**.

### R1.4 — Distinction entretien / amélioration / immobilisation

**Description** : peinture = charge directe ; salle de bain refaite = immobilisation amortie sur 10-15 ans. Mauvaise classification = redressement.
**Impact** : erreur structurelle d'amortissement, déclaration incohérente sur la durée.
**Mitigation** :
- Assistant de classification au moment du dépôt de facture (questions guidées + règles métier).
- Validation manuelle obligatoire (l'algo propose, l'utilisateur tranche).
- Documentation interne (rattachée à la facture) du raisonnement de classification.

**Statut** : **V1.1** (V1 = manuel pur, V1.1 = assistant).

### R1.5 — Validation pré-export (sanity checks)

**Description** : avant de signer une 2031 ou de remplir une 2042 C PRO, il faut un **garde-fou** sur la cohérence des chiffres.
**Impact** : déclaration erronée signée par l'utilisateur.
**Mitigation** :
- Suite de checks pré-export : recettes vs seuils, abattement appliqué, terrain non amorti, somme amortissements ≤ valeur d'acquisition, dates cohérentes, etc.
- Rapport de validation imprimable.

**Statut** : **V1**.

### R1.6 — Bascule LMNP ↔ LMP

**Description** : recettes > 23 000 € **ET** > revenus d'activité du foyer = bascule LMP automatique (CGI 155 IV). Régime fiscal différent (PS → SSI, plus-value pro, etc.).
**Impact** : bailleur qui ignore qu'il a basculé = déclaration inadaptée.
**Mitigation** :
- Saisie des « autres revenus d'activité du foyer » (estimation utilisateur).
- Alerte préventive dès qu'un seuil est franchi à 80 %.
- Simulation comparative LMNP vs LMP.

**Statut** : alerte **V1**, simulation **V1.1**.

### R1.7 — Bascule micro ↔ réel

**Description** : l'option pour le réel est valable un an, renouvelée tacitement, dénonçable. Le choix optimal varie selon charges et amortissements.
**Impact** : régime sous-optimal sur plusieurs années (impôt en trop ou administration en moins).
**Mitigation** :
- Simulateur micro vs réel sur la base des données saisies.
- Alerte à la fin d'année : « ton réel aurait été X € vs micro Y € — penses-tu à l'option pour N+1 ? »

**Statut** : **V1.1**.

---

## 2. Risques juridiques (location meublée)

### R2.1 — Alertes d'échéance critiques

**Description** : DPE 10 ans, gaz/élec 6 ans, ERP 6 mois, IRL annuelle, CFE décembre, fin de bail, fin de bail mobilité, congé bailleur (3 mois avant), etc.
**Impact** : relocation nulle (diagnostic expiré), perte de revenu (IRL non appliquée), pénalité (CFE non payée).
**Mitigation** :
- Calendrier centralisé d'échéances dans le tableau de bord.
- Notifications J-30 et J-7 (cf. MVP du [PRD](LOGICIEL_GESTION_LOCATIVE.md)).
- Génération automatique des actes à signer (avenant IRL, etc.).

**Statut** : **V1**.

### R2.2 — Calendrier passoires énergétiques (loi Climat)

**Description** : G interdit relocation depuis 2025, F en 2028, E en 2034. Gel du loyer si F/G.
**Impact** : impossibilité de relouer un bien sans rénovation préalable.
**Mitigation** :
- Affichage clair du DPE et du statut « relocable » / « gelé » / « interdit à venir ».
- Projection des deadlines par bien.

**Statut** : **V1**.

### R2.3 — Cas non standards

**Description** : indivision, démembrement (usufruit/nue-propriété), bien mixte personnel/loué, changement d'affectation en cours d'année, colocation avec solidarité.
**Impact** : modèle de données incapable de représenter la situation réelle.
**Mitigation** :
- Périmètre V1 explicitement limité au **bailleur unique, lots distincts, locataire principal**.
- Document `LOGICIEL_GESTION_LOCATIVE.md` (section périmètre étendu) liste ces cas comme V2.
- Modèle de données conçu pour permettre l'extension (cf. [DDD.md](DDD.md) — bounded contexts).

**Statut** : V1 = hors périmètre documenté ; **V2** = support.

### R2.4 — Encadrement zones tendues

**Description** : la liste des communes en zone tendue évolue (Marseille en 2026, etc.). Loyer de référence INSEE.
**Impact** : loyer non conforme, contestation possible.
**Mitigation** :
- Table des communes en zone tendue **versionnée**, mise à jour annuelle.
- Saisie manuelle du loyer de référence en V1 (intégration INSEE en V1.1).

**Statut** : V1 = saisie manuelle ; **V1.1** = automatique.

---

## 3. Risques techniques (local-first)

### R3.1 — Backup et restauration

**Description** : DB SQLite locale = **point unique de défaillance**. Disque mort, fichier corrompu, mauvaise manip = données perdues, y compris **10 ans de factures** à conserver légalement.
**Impact** : perte irrécupérable, dossier impossible à reconstituer en cas de contrôle.
**Mitigation** :
- **Export complet** chiffré périodique (ZIP DB + justificatifs) vers emplacement utilisateur (USB, cloud perso, etc.).
- Sauvegarde planifiée configurable (quotidien / hebdo).
- Restauration testée (« restore drill ») documentée.
- Hash d'intégrité pour vérifier qu'un export n'a pas été altéré.

**Statut** : **V1** (export manuel) ; planification **V1.1**.

### R3.2 — Migrations de schéma SQLite

**Description** : version V1.2 → V1.3 = changement de schéma. Sur 10 ans, plusieurs dizaines de migrations.
**Impact** : perte de données silencieuse, incohérences post-migration.
**Mitigation** :
- Runner de migrations versionnées (à voir si on s'inspire du pattern déjà en place dans `invoice-manager`).
- Sauvegarde automatique **avant** chaque migration.
- Migrations idempotentes et **réversibles** quand possible.
- Tests de migration sur DB de production anonymisée.

**Statut** : **V1**.

### R3.3 — RGPD (locataires)

**Description** : nom, adresse, IBAN, pièces d'identité de locataires = données personnelles. Même en local, certaines obligations s'appliquent (information du locataire, droit d'accès, droit à l'effacement après fin du bail + conservations légales).
**Impact** : non-conformité, contentieux en cas de plainte d'un locataire.
**Mitigation** :
- Mention d'information du locataire dans le bail généré.
- Fonction « effacement après période de conservation légale ».
- Pas de transmission externe sans consentement (cohérent avec local-first).
- Documenter la politique RGPD dans un addendum `RGPD.md` ou section dédiée.

**Statut** : V1 = local-first par défaut ; politique formalisée **V1.1**.

### R3.4 — Sécurité de la base au repos

**Description** : DB en clair sur le disque. Vol du laptop = toutes les données accessibles.
**Impact** : exfiltration, atteinte à la vie privée des locataires.
**Mitigation** :
- Mot de passe au démarrage (au moins UI gate).
- Chiffrement DB au repos (SQLCipher ou équivalent).
- Verrouillage automatique après inactivité.

**Statut** : **V1.1** (V1 = mot de passe UI ; V1.1 = chiffrement).

### R3.5 — OCR et correction humaine

**Description** : OCR sur factures = 5-10 % d'erreurs typiques (montant, date, fournisseur).
**Impact** : amortissements faux, totaux faux, déclaration faussée.
**Mitigation** :
- Workflow obligatoire de **validation humaine** post-OCR.
- Affichage du champ extrait à côté de l'image source.
- Historique des corrections (déjà présent dans `invoice-manager` selon les commits récents — réutiliser le pattern).

**Statut** : **V1**.

### R3.6 — Quittance : numérotation, intégrité, conservation

**Description** : numérotation séquentielle stable sur 10 ans, sans gap ni doublon. PDF immuable.
**Impact** : contestation par locataire, contrôle administratif compromis.
**Mitigation** :
- Séquence de numérotation par bailleur + année.
- Génération PDF déterministe (même entrée → même hash).
- Stockage immuable (append-only).

**Statut** : **V1**.

---

## 4. Risques UX / produit

### R4.1 — Onboarding avec historique existant

**Description** : un bailleur en LMNP depuis 5 ans veut migrer vers cet outil. Comment importer 5 ans de quittances, charges, amortissements ?
**Impact** : si le démarrage exige tout ressaisir, adoption nulle.
**Mitigation** :
- Import CSV / Excel avec mapping guidé.
- Saisie initiale rapide : « état au 1er janvier N » plutôt que toute l'histoire.
- Mode « démarrage simplifié » : juste recettes/charges agrégées N-1, détail à partir de N.

**Statut** : **V1.1**.

### R4.2 — Aide à la décision (simulateurs)

**Description** : choix micro vs réel, anticipation PV, anticipation bascule LMP, scénarios travaux. Différenciation forte vs concurrence (Indy, Decla.fr, JeDéclareMonMeublé).
**Impact** : sans aide, l'outil est un classeur numérique — pas un outil de pilotage.
**Mitigation** :
- Simulateurs intégrés (cf. R1.2, R1.6, R1.7).
- Reporting comparatif en fin d'exercice.

**Statut** : **V1.1**.

### R4.3 — Pédagogie fiscale contextuelle

**Description** : l'utilisateur n'est pas expert. Un simple « abattement micro-BIC 50 % » sans contexte est anxiogène.
**Impact** : peur de se tromper → abandon, ou déclaration faussée.
**Mitigation** :
- Glossaire actif lié à [LMNP.md](LMNP.md) (info-bulles, panneaux d'aide).
- Wording vulgarisé dans l'UI, terme officiel en sous-titre.
- Disclaimers clairs : « ce calcul n'engage pas la responsabilité du logiciel ».

**Statut** : **V1**.

### R4.4 — Export pour expert-comptable

**Description** : certains bailleurs déléguent la liasse à un EC. Format d'échange standardisé ?
**Impact** : friction avec le tiers de confiance habituel du bailleur.
**Mitigation** :
- Export CSV/Excel structuré + dossier de justificatifs zippé.
- Format EDI-TDFC à étudier en V2 (norme officielle de transmission liasse).

**Statut** : V1 = export CSV ; **V2** = EDI-TDFC.

---

## 5. Maintien dans le temps

### R5.1 — Maintenance des règles fiscales

**Description** : [LMNP.md](LMNP.md) et [LOCATION_MEUBLEE_REGLES.md](LOCATION_MEUBLEE_REGLES.md) seront périmés en janvier 2027. Le code aussi.
**Impact** : logiciel obsolète, calculs erronés, perte de confiance.
**Mitigation** :
- **Revue annuelle planifiée** en janvier post-PLF (ticket récurrent).
- **ADR par changement** légal majeur.
- **Golden tests** sur cas réels, mis à jour à chaque revue.
- En-tête de chaque doc métier : date de dernière revue + texte référent.

**Statut** : **Continu**.

### R5.2 — Tests de régression fiscale

**Description** : après mise à jour des règles, valider que les déclarations passées restent reproductibles et les projections futures cohérentes.
**Impact** : régression silencieuse sur un calcul critique.
**Mitigation** :
- Golden tests = cas réels figés en JSON + résultat attendu.
- Suite « legal-regression » exécutée à chaque PR + en CI hebdomadaire.

**Statut** : **V1** (mise en place du framework de golden tests).

### R5.3 — Confiance utilisateur

**Description** : confier sa fiscalité à un outil solo = barrière psychologique forte.
**Impact** : adoption faible, ou usage partiel (l'utilisateur double-vérifie ailleurs).
**Mitigation** :
- Disclaimers clairs sur la responsabilité.
- Mode « accompagné par expert-comptable » (export R4.4).
- Traçabilité des décisions (qui a saisi quoi, quand, modifié comment).
- Documentation transparente des sources (CGI, BOFIP, etc.) directement dans l'UI.

**Statut** : **V1** (disclaimers + traçabilité) ; mode EC **V2**.

---

## Process de revue

- **Revue annuelle** : janvier, post-PLF. Mise à jour `LMNP.md`, `LOCATION_MEUBLEE_REGLES.md`, `RISKS.md` (statuts, nouveaux risques) et golden tests.
- **Revue ad hoc** : après tout incident utilisateur ou retour d'expérience.
- **Revue de risque par feature** : avant chaque sprint, identifier si un risque ouvert est touché par la feature en cours.

Chaque mise à jour du registre fait l'objet d'un commit `docs(risks): ...` avec changelog en en-tête de section concernée.
