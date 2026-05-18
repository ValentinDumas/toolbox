# Roadmap: Gestion locative

## Overview

Construire un logiciel de gestion locative local-first, mono-utilisateur, pour un bailleur LMNP en location meublée longue durée. La roadmap est découpée en **slices verticaux MVP** : chaque phase livre un parcours utilisateur de bout en bout, indépendamment shippable et observable. Le parcours démarre par l'**activation** (créer 1 Bien + 1 Locataire + 1 Bail en première session — sans fiscal), puis ajoute progressivement le **quittancement**, la **conformité juridique du bail** (diagnostics, IRL, DPE freeze, mobilier), le **coffre documentaire et travaux**, puis empile la **logique fiscale LMNP** (régimes, amortissement, liasse 2031, CFE), avant de coiffer l'ensemble d'un **dashboard et de notifications** d'échéances.

Chaque phase respecte les dépendances DDD (Bien avant Bail ; Bail avant Encaissement ; Encaissement avant Fiscalité ; aggregations avant Dashboard) et l'ubiquitous language français. Aucune phase horizontale (pas de "phase DB" ou "phase UI" séparée) — domaine, adapters et UI livrés ensemble par tranche métier.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Activation — Bien, Locataire, Bail** - L'utilisateur peut créer son premier dossier locatif complet en une session, sans aucune logique fiscale.
- [ ] **Phase 2: Quittancement — Échéances, Encaissements, Relances** - L'utilisateur peut générer avis d'échéance et quittances, suivre les paiements et déclencher des relances escaladées.
- [ ] **Phase 3: Conformité du bail — Diagnostics, EDL, IRL, Mobilier** - Le système garantit la conformité juridique du bail meublé (DPE/gaz/élec, EDL contradictoire, indexation IRL avec gel DPE F/G, checklist mobilier décret 2015-981).
- [ ] **Phase 4: Coffre documentaire & Travaux** - L'utilisateur peut centraliser ses justificatifs (10 ans de rétention) et tracer les tickets d'incidents/travaux avec pièces jointes et coûts.
- [ ] **Phase 5: Fiscalité LMNP — Régimes, Recettes/Charges, Amortissement** - Le système agrège recettes/charges, calcule l'abattement micro-BIC, l'amortissement par composant et alerte sur la bascule LMP.
- [ ] **Phase 6: Liasse 2031 & CFE** - L'utilisateur peut générer le brouillon de la liasse 2031-SD avec annexes 2033-A à G et tracer sa déclaration CFE (1447-C-SD).
- [ ] **Phase 7: Dashboard & Notifications d'échéances** - L'utilisateur dispose d'un récap synthétique (impayés, actions du jour) et reçoit des notifications J-30 / J-7 sur les échéances critiques (CFE, IRL, diagnostics, fin de bail).

## Phase Details

### Phase 1: Activation — Bien, Locataire, Bail
**Goal**: L'utilisateur peut créer 1 Bien (avec ses Lots), 1 Locataire, et 1 Bail meublé classique en première session, et le voir persisté localement.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: PAT-01, PAT-02, LOC-01, LOC-02
**Success Criteria** (what must be TRUE):
  1. L'utilisateur peut créer, éditer et supprimer un `Bien` (adresse, surface, type, année construction) et persister la donnée localement (SQLite).
  2. L'utilisateur peut ajouter, éditer et supprimer plusieurs `Lot`s sur un `Bien` (appartement, parking, cave).
  3. L'utilisateur peut créer une fiche `Locataire` (identité, contact). _Note V1 : le garant relève du `Cautionnement` porté par le `Bail` (D-33). Les pièces justificatives sont différées Phase 4 — Coffre documentaire (D-32)._
  4. L'utilisateur peut créer un `Bail` meublé classique (durée 1 an min, loyer HC, forfait ou provisions, dépôt ≤ 2 mois HC, clause IRL) reliant un `Bien`/`Lot` à un `Locataire`.
  5. KPI Activation : un utilisateur ouvrant l'app pour la première fois peut, en une session unique, aboutir à 1 Bien + 1 Locataire + 1 Bail visibles dans une liste persistée.
  6. L'utilisateur peut interrompre le wizard après l'étape Bien ou Locataire et reprendre plus tard via les listes — `meta.wizard_complete` est posé et la sortie est tracée dans les logs (`event: wizard_complete, step: bien|locataire`).
**Plans:** 8/8 plans executed
Plans:
- [x] 01-01-project-init-PLAN.md — Scaffolding TS/pnpm/Vitest/Cucumber/ESLint/dependency-cruiser/Mise (wave 0)
- [x] 01-02-walking-skeleton-PLAN.md — Walking Skeleton bout-en-bout : Fastify + SQLite + 1 Bien + 1 Lot via formulaire minimal (wave 1, PAT-01)
- [x] 01-03-patrimoine-crud-PLAN.md — CRUD Bien + N-Lots (PAT-01, PAT-02) (wave 2)
- [x] 01-04-locataire-crud-PLAN.md — CRUD Locataire (LOC-01) (wave 3)
- [x] 01-05-bail-classique-PLAN.md — Bail meublé classique + VOs Money/IRL/Cautionnement (LOC-02) (wave 4)
- [x] 01-06-activation-wizard-PLAN.md — Wizard 3 étapes premier lancement + session (wave 5)
- [x] 01-07-ui-polish-PLAN.md — Partials EJS + helpers format français + audit a11y (wave 6)
- [x] 01-08-gap-closure-uat-p02-PLAN.md — Fermeture gaps UAT P02 : validation inline G1 + wizard skippable G2 (wave 7)
**UI hint:** yes

### Phase 2: Quittancement — Échéances, Encaissements, Relances
**Goal**: L'utilisateur peut piloter le cycle complet de perception du loyer sur un bail existant : émettre l'avis d'échéance, encaisser, quittancer, identifier les retards, relancer.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: ENC-01, ENC-02, ENC-03, ENC-04, ENC-05
**Success Criteria** (what must be TRUE):
  1. L'utilisateur peut générer un avis d'échéance PDF (`EcheanceLoyer`) à partir d'un `Bail` actif.
  2. L'utilisateur peut saisir un `Encaissement` (date, montant, mode, statut) ; un paiement partiel **n'émet pas** de `Quittance`.
  3. L'utilisateur peut générer une `Quittance` PDF uniquement pour une période entièrement payée.
  4. Le système calcule et affiche les impayés et retards par locataire et par période.
  5. L'utilisateur peut déclencher des `Relance`s escaladées (amiable → mise en demeure) avec templates email.
**Plans:** 7/7 plans complete
Plans:
- [x] 02-01-PLAN.md — Walking enabler : Profil bailleur (D-67) + extension Bail (actif_depuis, jour_echeance) + Clock + migration 0002 (wave 1, enabler)
- [x] 02-02-PLAN.md — Avis d'échéance PDF (ENC-02) + génération EcheanceLoyer à l'activation + prorata 1ère/dernière (wave 2)
- [x] 02-03-PLAN.md — Saisie Encaissement + soft-delete + compensateur + warnings sur-paiement / date hors plage (ENC-03) (wave 3)
- [x] 02-04-PLAN.md — Émission Quittance PDF persistée + numérotation AAAA-NNN atomique + warning quittance invalidée (ENC-01) (wave 4)
- [x] 02-05-PLAN.md — Page Impayés + calcul dérivé (statut/jours retard) + filtre locataire (ENC-04) (wave 5)
- [x] 02-06-PLAN.md — Relances 3 niveaux escaladées (amiable / ferme / mise en demeure) + canal hybride mailto/PDF + chaînage strict (ENC-05) (wave 6)
- [x] 02-07-gap-closure-PLAN.md — Gap closure UAT P02 (G3..G8) : vue globale /echeances, filtres bail/statut, CTA Émettre quittance, canal email mailto, regression PDF (wave 7)
**UI hint:** yes

### Phase 3: Conformité du bail — Diagnostics, EDL, IRL, Mobilier
**Goal**: Le système garantit la conformité juridique du bail meublé : diagnostics à jour, EDL contradictoire, indexation IRL annuelle (avec gel loyer Climat si DPE F/G), checklist mobilier décret 2015-981.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: PAT-03, LOC-03, LOC-04, LOC-05, LOC-06
**Success Criteria** (what must be TRUE):
  1. L'utilisateur peut stocker des `Diagnostic`s (DPE, gaz, élec, ERP) avec date d'émission et date d'expiration calculée selon la durée légale.
  2. L'utilisateur peut enregistrer l'`EtatDesLieux` d'entrée et de sortie (contradictoire) avec son `Inventaire` mobilier annexé.
  3. À la date anniversaire du `Bail`, le système propose et applique l'indexation IRL et génère l'avenant d'indexation signable.
  4. Le système **refuse** toute indexation à la hausse si le DPE du `Bien` est classé F ou G (gel loyer Climat) et explique le motif.
  5. À la création/édition d'un `Bail` meublé, le système vérifie la checklist des 12 éléments de mobilier obligatoire (décret 2015-981) et signale tout manquant comme risque de requalification.
**Plans:** 5 plans
Plans:
- [x] 03-01-diagnostics-PLAN.md — Vertical slice PAT-03 (Diagnostics sous-agrégat Bien + classeDpe + table dédiée + 3 helpers) (wave 1)
- [x] 03-02-edl-mobilier-PLAN.md — Vertical slice LOC-03 + LOC-06 (EtatDesLieux + InventaireItem 12 items décret 2015-981 + Bail.mobilier + comparerInventaires) (wave 2)
- [x] 03-03-irl-simulation-PLAN.md — Vertical slice LOC-04 simulation + LOC-05 gel (Money.multiplyByRatio + Bail.dateAnniversaireProchaine + Bail.simulerIndexation + wizard étapes 2-3 + gel-loyer.ejs) (wave 3)
- [x] 03-04-irl-apply-avenant-PLAN.md — Vertical slice LOC-04 apply (BailIndexation append-only + Bail.appliquerIndexation + use case transactionnel 5 effets + PDF avenant pdfmake) (wave 4)
- [x] 03-05-ui-polish-a11y-PLAN.md — Cross-cutting audit WCAG 2.1 AA + print stylesheet + snapshot tests + checkpoint human-verify (wave 5)
**UI hint:** yes

### Phase 4: Coffre documentaire & Travaux
**Goal**: L'utilisateur peut centraliser tous ses justificatifs (factures, tickets, baux, EDL, diagnostics) avec rétention 10 ans, les retrouver par contexte (Bien / Locataire / année), et tracer les tickets travaux avec pièce jointe et coût.
**Mode:** mvp
**Depends on**: Phases 1, 2, 3
**Requirements**: DOC-01, DOC-02, DOC-03, INC-01
**Success Criteria** (what must be TRUE):
  1. L'utilisateur peut uploader des `Justificatif`s (factures, tickets, baux, EDL, diagnostics) et les rattacher à un `Bien` et/ou un `Locataire`.
  2. L'utilisateur peut rechercher et filtrer des documents par `Bien`, `Locataire` ou année fiscale et accéder à la pièce d'origine.
  3. Le système conserve tous les documents au moins 10 ans (rétention légale fiscale) et empêche toute suppression avant ce délai (ou la matérialise comme corbeille).
  4. L'utilisateur peut créer un ticket d'incident / travaux rattaché à un `Bien` avec pièce jointe et coût saisi.
**Plans:** 3 plans
Plans:
- [ ] 04-PLAN-1-walking-enabler.md — Walking enabler + DOC-01 thin slice (Justificatif BC + ports StockageJustificatifs/ConvertisseurImage + upload + view + soft-delete + migration 0010 globale) (wave 1, DOC-01 + DOC-03 gate)
- [ ] 04-PLAN-2-documents-extras.md — Recherche facettée + Corbeille + Purge gate 10 ans + Modifier metadata + fiches augmentées Bien (Documents) + Locataire (Documents D-120) (wave 2, DOC-01 extras + DOC-02 + DOC-03 UX)
- [ ] 04-PLAN-3-travaux.md — Travaux BC + N:N PJ ticket_justificatifs + section Travaux fiche Bien (wave 3, INC-01)
**UI hint:** yes

### Phase 5: Fiscalité LMNP — Régimes, Recettes/Charges, Amortissement
**Goal**: Le système agrège recettes et charges sur l'exercice, calcule l'abattement micro-BIC, l'amortissement par composant en régime réel, et alerte sur le risque de bascule LMNP → LMP.
**Mode:** mvp
**Depends on**: Phases 2, 4
**Requirements**: FIS-01, FIS-02, FIS-03, FIS-04
**Success Criteria** (what must be TRUE):
  1. Le système agrège les recettes (via `Encaissement`s) et les charges (via `Justificatif`s rattachés) du `RegimeFiscal` réel sur une année fiscale donnée.
  2. Le système calcule l'abattement micro-BIC (50 % longue durée, 30 % tourisme non classé, plancher 305 €) et signale le franchissement du seuil 83 600 €.
  3. Le système calcule l'amortissement par composant en régime réel : terrain exclu, prorata temporis à l'acquisition, ARD reportable, **plafonné au résultat avant amortissement**.
  4. Le système détecte le risque de bascule LMP (recettes annuelles > 23 000 € **ET** > revenus actifs du foyer) et alerte explicitement l'utilisateur.
  5. Toute la logique fiscale de cette phase est couverte à 100 % par des scénarios BDD (chaque exception du droit a son scénario dédié) — vérifiable via le rapport de couverture du domaine `fiscalite/`.
**Plans**: TBD
**UI hint:** yes

### Phase 6: Liasse 2031 & CFE
**Goal**: L'utilisateur peut produire le brouillon de la liasse 2031-SD avec annexes 2033-A à G à partir des données fiscales agrégées, et tracer sa déclaration CFE (1447-C-SD) avec alerte sur l'échéance de paiement de décembre.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: FIS-05, FIS-06
**Success Criteria** (what must be TRUE):
  1. L'utilisateur peut générer un brouillon de la liasse 2031-SD (cerfa) accompagné de ses annexes 2033-A à G, exportable (PDF/CSV).
  2. Les montants de la liasse sont **traçables** à la source (chaque ligne renvoie aux `Encaissement`s, `Justificatif`s et `TableauAmortissement` qui la justifient).
  3. L'utilisateur peut enregistrer sa déclaration CFE initiale (formulaire 1447-C-SD) sur un `Bien` et marquer son statut.
  4. Le système alerte l'utilisateur à l'approche de l'échéance de paiement CFE (décembre) sur le `Bien` concerné.
**Plans**: TBD
**UI hint:** yes

### Phase 7: Dashboard & Notifications d'échéances
**Goal**: L'utilisateur dispose d'une vue synthétique des actions à mener (impayés, échéances à venir, action du jour) et reçoit des notifications J-30 et J-7 sur toutes les échéances critiques agrégées par les phases précédentes.
**Mode:** mvp
**Depends on**: Phases 2, 3, 6
**Requirements**: DAS-01, DAS-02
**Success Criteria** (what must be TRUE):
  1. Le dashboard affiche en un coup d'œil les impayés ouverts, les échéances de loyer à venir et les actions du jour (relances dues, indexations IRL imminentes).
  2. Le dashboard rend visible la **hiérarchie d'urgence** (en retard / à venir / à jour) sans nécessiter de drill-down pour qualifier la priorité.
  3. Le système notifie l'utilisateur à J-30 et J-7 sur chaque échéance critique : paiement CFE, révision IRL annuelle, expiration DPE / gaz / élec, fin de bail.
  4. Une notification déclenchée renvoie en un clic vers l'écran d'action correspondant (régler CFE, lancer l'indexation, renouveler diagnostic, préparer renouvellement bail).
**Plans**: TBD
**UI hint:** yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Activation — Bien, Locataire, Bail | 8/8 | Complete | 2026-05-16 |
| 2. Quittancement — Échéances, Encaissements, Relances | 7/7 | Complete | 2026-05-16 |
| 3. Conformité du bail — Diagnostics, EDL, IRL, Mobilier | 0/5 | Planned | - |
| 4. Coffre documentaire & Travaux | 0/3 | Planned | - |
| 5. Fiscalité LMNP — Régimes, Recettes/Charges, Amortissement | 0/TBD | Not started | - |
| 6. Liasse 2031 & CFE | 0/TBD | Not started | - |
| 7. Dashboard & Notifications d'échéances | 0/TBD | Not started | - |
