# Requirements: Gestion locative — v1.1 Durcissement & mise en main

**Defined:** 2026-06-16
**Core Value:** Centraliser factures, quittances, baux et échéances pour simplifier les obligations fiscales LMNP — sans cloud, sans délégation, sans multi-utilisateur.

Milestone de **finition et durcissement** de v1.0 : aucune nouvelle capacité métier. On clôt les reliquats de qualité, on éponge la dette technique connue, on sécurise les données (backup/restore, chiffrement, RGPD) et on rend le logiciel installable par un bailleur non-dev.

Domaine fiscal : [LMNP.md](../LMNP.md). Domaine juridique : [LOCATION_MEUBLEE_REGLES.md](../LOCATION_MEUBLEE_REGLES.md). Risques : [RISKS.md](../RISKS.md).

## v1.1 Requirements

Chaque REQ map vers exactement une phase (cf. Traceability, remplie par `gsd-roadmapper`).

### Qualité / finition (QUA)

- [ ] **QUA-01** : Les 12 scénarios d'UAT humaine de la liasse 2031 / CFE (Phase 06, en pause à la clôture v1.0) sont exécutés ; chaque écart constaté est corrigé et le scénario repassé au vert.
- [ ] **QUA-02** : Les statuts d'UAT et de sessions de debug restés *stale* (Phases 02, 03, 04 + sessions g1/g4/g8) sont réconciliés avec l'état réel (résolu / clos), sans scénario en attente fantôme.

### Dette technique (DET)

- [x] **DET-01** : Les 2 partials CFE en double sont consolidés en un seul partiel réutilisable, sans régression d'affichage.
- [x] **DET-02** : Les 2 patterns d'enrichissement `calculerAlertesIrl` sont unifiés en un seul chemin, couvert par les scénarios existants.
- [x] **DET-03** : La transaction Kysely enveloppante (D-94) est posée sur les écritures multi-tables, garantissant l'atomicité (rollback sur échec partiel).

### Sauvegarde & sécurité des données (BAK)

- [ ] **BAK-01** : L'utilisateur peut déclencher une sauvegarde (base SQLite + dossier `documents/`) et restaurer une sauvegarde, la restauration étant vérifiée par un contrôle d'intégrité.
- [ ] **BAK-02** : La base SQLite est chiffrée au repos (SQLCipher) ; son ouverture requiert une passphrase.
- [ ] **BAK-03** : Le logiciel formalise la conformité RGPD du traitement des données locataires : note d'information locataire, droit à l'effacement opérable, registre de traitement.

### Packaging & mise en main (PKG)

- [ ] **PKG-01** : L'utilisateur peut installer le logiciel via un binaire natif (DMG / MSI / AppImage) sans toolchain de développement (`node`, `pnpm`).
- [ ] **PKG-02** : Au lancement, le logiciel ouvre automatiquement l'interface dans le navigateur par défaut.

## Future Requirements

Reportés en v1.2+ — approfondissements de l'existant identifiés mais hors scope de ce cycle de durcissement. Inventaire complet issu du scan des phases v1.0.

### Documents intelligents (DOC+)

- **DOCX-01** : OCR factures — extraction auto TVA / fournisseur / montant (agrégat `ExtractionOCR`, nommé dans PROJECT.md, non construit en v1.0).
- **DOCX-02** : Catégorisation automatique des justificatifs (règles / ML sur OCR).
- **DOCX-03** : Recherche full-text dans le contenu des PDF (FTS5 + texte OCR).
- **DOCX-04** : Drag & drop + multi-upload (flaggé *V2 priorité HAUTE* en Phase 4).
- **DOCX-05** : Conversion HEIC → JPG côté serveur ; fusion auto multi-pages PDF.
- **DOCX-06** : Dépenses récurrentes (assurance, taxe foncière) avec justificatif attendu.

### Décision fiscale (SIM / CLA)

- **SIM-01** : Simulateur micro-BIC vs réel.
- **SIM-02** : Simulateur de plus-value à la cession (réintégration amortissements LF 2025 ; agrégat `CalculPlusValue` nommé dans le Core Value, non livré en v1.0).
- **SIM-03** : Alerte de bascule LMNP → LMP + simulation comparative.
- **FIS-IR-01** : Calcul IR + prélèvements sociaux (dashboard fiscal complet).
- **CLA-01** : Assistant de qualification des charges (entretien / amélioration / immobilisation).
- **FIS-LIA-01** : Liasse différentielle (rectificatives) ; déclaration modificative CFE 1447-M-SD ; drill-down par encaissement ; export EDI-TDFC.

### Automatisation IRL (INS)

- **INS-01** : INSEE — récupération automatique de la valeur IRL (supprime la saisie manuelle de l'indice) ; override du template d'avenant.

### Encaissements (ENC+)

- **ENCX-01** : Report automatique du trop-perçu sur l'échéance suivante.
- **ENCX-02** : SMTP optionnel pour les relances (au lieu de `mailto`) ; override des templates de relance.
- **ENCX-03** : Export CSV des encaissements / quittances par année fiscale.
- **ENCX-04** : Rapprochement bancaire (import OFX / CSV).

### Dashboard & notifications (DAS+)

- **DASX-01** : Snooze / dismiss persistant des alertes ; fenêtres J-X configurables ; canal email de rappel.
- **DASX-02** : Widgets KPI globaux (recettes, dotation aux amortissements) ; layout 2 colonnes ; notification J-30/J-7 sur justificatifs proches de 10 ans.

### Conformité du bail (LOC+)

- **LOCX-01** : Calcul du montant de retenue sur dépôt de garantie depuis les warnings d'EDL ; vue diff EDL entrée/sortie côte-à-côte.
- **LOCX-02** : Procédure huissier sur EDL (enum vs booléen) ; gestion des items d'inventaire en base (CRUD).

## Out of Scope

Exclusions explicites (inchangées depuis v1.0) — extensions de périmètre, jamais dans la trajectoire LMNP single-user. Référence : [CLAUDE.md](../CLAUDE.md) §Hors périmètre.

| Feature | Raison |
|---|---|
| Location nue / revenus fonciers | Régime fiscal différent (foncier), hors priorité LMNP. |
| SCI à l'IS | Entité juridique différente, comptabilité commerciale, hors single-user. |
| Meublé de tourisme (loi Le Meur) | Seuils micro-BIC distincts, encadrement spécifique. |
| Bail mobilité / étudiant first-class | Types distincts du bail classique — reportés V2 (extension de périmètre, pas un approfondissement). |
| Multi-bailleur / SCI familiale / agence | Incompatible avec le modèle single-user et local-first. |
| Indivision, démembrement, colocation solidaire, mixte perso/locatif | Cas non standards — extension de périmètre, hors trajectoire de durcissement. |
| Mode accompagné expert-comptable (EXP-01) | Double signature / workflow partagé — sort du single-user. |
| Contentieux et procédures judiciaires | Hors compétence logiciel. |
| Sync cloud / notifications push OS / intégration calendrier | Hors local-first ou hors périmètre sobre. |

## Traceability

Quelles phases couvrent quels REQs. Rempli par `gsd-roadmapper` à la création du ROADMAP — chaque REQ map vers **exactement une** phase. Numérotation **continue** depuis v1.0 (dernière phase = 8 → v1.1 démarre à la phase 9).

| Requirement | Phase | Status |
|---|---|---|
| QUA-01 | Phase 9 | Pending |
| QUA-02 | Phase 9 | Pending |
| DET-01 | Phase 10 | Complete |
| DET-02 | Phase 10 | Complete |
| DET-03 | Phase 10 | Complete |
| BAK-01 | Phase 11 | Pending |
| BAK-02 | Phase 11 | Pending |
| BAK-03 | Phase 11 | Pending |
| PKG-01 | Phase 12 | Pending |
| PKG-02 | Phase 12 | Pending |

**Coverage:**
- v1.1 requirements: 10 total
- Mapped to phases: 10 ✓
- Unmapped: 0

---
*Requirements defined: 2026-06-16 — milestone v1.1 Durcissement & mise en main*
