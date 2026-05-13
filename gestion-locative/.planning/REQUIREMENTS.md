# Requirements: Gestion locative

**Defined:** 2026-05-13
**Core Value:** Centraliser factures, quittances, baux et échéances pour simplifier les obligations fiscales LMNP (liasse 2031, 2042 C PRO, CFE, amortissements, plus-value LF 2025) — sans cloud, sans délégation.

Domaine fiscal : [LMNP.md](../LMNP.md). Domaine juridique : [LOCATION_MEUBLEE_REGLES.md](../LOCATION_MEUBLEE_REGLES.md).

## v1 Requirements

Périmètre initial. Chaque REQ map vers exactement une phase (cf. Traceability).

### Patrimoine

- [ ] **PAT-01** : L'utilisateur peut créer, éditer, supprimer un `Bien` (adresse, surface, type, année construction).
- [ ] **PAT-02** : L'utilisateur peut gérer plusieurs `Lot`s dans un `Bien` (appartement, parking, cave).
- [ ] **PAT-03** : L'utilisateur peut stocker des `Diagnostic`s (DPE, gaz, élec, ERP) avec date d'émission et date d'expiration calculée selon la durée légale.

### Locatif

- [ ] **LOC-01** : L'utilisateur peut créer une fiche `Locataire` (identité, contact, garant, pièces).
- [ ] **LOC-02** : L'utilisateur peut créer un `Bail` meublé classique (durée 1 an min, loyer hors charges, forfait ou provisions, dépôt ≤ 2 mois HC, clause IRL).
- [ ] **LOC-03** : L'utilisateur peut enregistrer l'`EtatDesLieux` d'entrée et de sortie (contradictoire, `Inventaire` mobilier annexé).
- [ ] **LOC-04** : Le système applique l'indexation IRL à la date anniversaire du bail (génère l'avenant signé).
- [ ] **LOC-05** : Le système bloque toute indexation à la hausse si DPE F ou G (gel loyer Climat).
- [ ] **LOC-06** : Le système vérifie la checklist des 12 éléments de mobilier obligatoire (décret 2015-981) et signale tout manquant comme risque de requalification.

### Encaissements

- [ ] **ENC-01** : L'utilisateur peut générer une `Quittance` PDF pour une période entièrement payée.
- [ ] **ENC-02** : L'utilisateur peut générer un avis d'échéance PDF (`EcheanceLoyer`).
- [ ] **ENC-03** : L'utilisateur peut saisir un `Encaissement` (date, montant, mode, statut) ; les paiements partiels n'émettent pas de quittance.
- [ ] **ENC-04** : Le système calcule les impayés et retards (par locataire, par période).
- [ ] **ENC-05** : L'utilisateur peut déclencher des `Relance`s escaladées (amiable → mise en demeure) avec templates email.

### Fiscalité

- [ ] **FIS-01** : Le système détecte le risque de bascule LMP (recettes annuelles > 23 000 € ET > revenus actifs du foyer) et alerte l'utilisateur.
- [ ] **FIS-02** : Le système calcule l'abattement micro-BIC (50 % longue durée, 30 % tourisme non classé, plancher 305 €) et vérifie le seuil 83 600 €.
- [ ] **FIS-03** : Le système agrège recettes et charges pour le `RegimeFiscal` réel.
- [ ] **FIS-04** : Le système calcule l'amortissement par composant (terrain exclu, ARD reportable, prorata temporis à l'acquisition, plafond résultat avant amortissement).
- [ ] **FIS-05** : Le système prépare le brouillon de la liasse 2031-SD et des annexes 2033-A à G (régime réel).
- [ ] **FIS-06** : Le système trace la déclaration CFE (formulaire 1447-C-SD initial) et alerte sur l'échéance de paiement décembre.

### Documents

- [ ] **DOC-01** : L'utilisateur peut uploader des `Justificatif`s (factures, tickets, baux, EDL, diagnostics).
- [ ] **DOC-02** : L'utilisateur peut rechercher des documents par `Bien`, `Locataire`, ou année fiscale.
- [ ] **DOC-03** : Le système conserve tous les documents pendant 10 ans (rétention légale fiscale).

### Dashboard

- [ ] **DAS-01** : Le dashboard affiche un récap synthétique (impayés, échéances à venir, actions du jour).
- [ ] **DAS-02** : Le système envoie des notifications J-30 et J-7 sur les échéances critiques (CFE, IRL, expiration DPE/gaz/élec, fin de bail).

### Travaux

- [ ] **INC-01** : L'utilisateur peut créer un incident / ticket de travaux avec pièce jointe et coût.

## v2 Requirements

Reportés après V1. Tracés mais hors roadmap actuelle. Cf. [LOGICIEL_GESTION_LOCATIVE.md](../LOGICIEL_GESTION_LOCATIVE.md) §V1.1 et §V2.

### Simulateurs (SIM)

- **SIM-01** : Simulateur micro vs réel — comparaison de l'impôt selon le régime.
- **SIM-02** : Simulateur de plus-value à la cession (anticipation LF 2025 — réintégration des amortissements de gros œuvre).
- **SIM-03** : Alerte de bascule LMNP → LMP + simulation comparative.

### Classification (CLA)

- **CLA-01** : Assistant entretien / amélioration / immobilisation (qualification fiscale des dépenses).

### Historique (HIS)

- **HIS-01** : Import historique (5 ans de quittances + état des amortissements).
- **HIS-02** : Reporting comparatif fin d'année.

### Backup & sécurité (BAK)

- **BAK-01** : Sauvegarde planifiée + restauration testée.
- **BAK-02** : Chiffrement de la DB au repos (SQLCipher).
- **BAK-03** : Politique RGPD formalisée (info locataire, droit à l'effacement, registre).

### Intégrations externes (INS)

- **INS-01** : Intégration INSEE (loyers de référence en zones tendues).

### Cas non standards (CES)

- **CES-01** : Indivision, démembrement (usufruit/nue-propriété).
- **CES-02** : Mixte personnel / locatif sur un même bien.
- **CES-03** : Colocation avec solidarité.
- **CES-04** : Multi-bailleur (SCI familiale, profils bailleur multiples).
- **CES-05** : Bail mobilité / étudiant first-class (types distincts du bail classique).

### Tourisme (TOU)

- **TOU-01** : Meublé de tourisme (seuils, encadrement loi Le Meur).

### Échange administratif (EDI)

- **EDI-01** : Export EDI-TDFC (format de télédéclaration officielle).

### Expert-comptable (EXP)

- **EXP-01** : Mode « accompagné par expert-comptable » (double signature, traçabilité partagée).

## Out of Scope

Exclus explicitement pour prévenir le scope creep. Référence : [CLAUDE.md](../CLAUDE.md) §Hors périmètre et [LOGICIEL_GESTION_LOCATIVE.md](../LOGICIEL_GESTION_LOCATIVE.md) §Hors produit.

| Feature | Raison |
|---|---|
| Location nue / revenus fonciers | Régime fiscal différent (foncier), hors priorité LMNP. |
| SCI à l'IS | Entité juridique différente, comptabilité commerciale, hors single-user. |
| Comptabilité d'agence (multi-user, séquestre, mandat) | Incompatible avec le modèle single-user et local-first. |
| Mise en location (annonces, visites, sélection de dossier) | Hors périmètre — focus admin/fiscal post-mise-en-location. |
| Contentieux et procédures judiciaires | Hors compétence logiciel ; ne se substitue pas à un conseil juridique. |
| Support humain en urgence | Logiciel autonome, pas un service. |
| Cashflow multi-scénario | Différé — pas central pour activation V1. |
| Réseau social / partage public | Hors usage privé du bailleur. |

## Traceability

Quelles phases couvrent quels REQs. **Rempli par `gsd-roadmapper`** lors de la création du ROADMAP.

| Requirement | Phase | Status |
|---|---|---|
| PAT-01 | — | Pending |
| PAT-02 | — | Pending |
| PAT-03 | — | Pending |
| LOC-01 | — | Pending |
| LOC-02 | — | Pending |
| LOC-03 | — | Pending |
| LOC-04 | — | Pending |
| LOC-05 | — | Pending |
| LOC-06 | — | Pending |
| ENC-01 | — | Pending |
| ENC-02 | — | Pending |
| ENC-03 | — | Pending |
| ENC-04 | — | Pending |
| ENC-05 | — | Pending |
| FIS-01 | — | Pending |
| FIS-02 | — | Pending |
| FIS-03 | — | Pending |
| FIS-04 | — | Pending |
| FIS-05 | — | Pending |
| FIS-06 | — | Pending |
| DOC-01 | — | Pending |
| DOC-02 | — | Pending |
| DOC-03 | — | Pending |
| DAS-01 | — | Pending |
| DAS-02 | — | Pending |
| INC-01 | — | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 0 (en attente du roadmapper)
- Unmapped: 26 ⚠️ (sera résolu par `gsd-roadmapper`)

---
*Requirements defined: 2026-05-13*
*Last updated: 2026-05-13 after initial definition*
