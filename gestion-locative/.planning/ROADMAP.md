# Roadmap: Gestion locative

## Milestones

- ✅ **v1.0 MVP LMNP** — Phases 1–8 (+ 5.1 inserted) (shipped 2026-06-16)
- 🚧 **v1.1 Durcissement & mise en main** — Phases 9–12 (started 2026-06-16)

Full v1.0 phase details archived in [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).

## Phases

<details>
<summary>✅ v1.0 MVP LMNP (Phases 1–8 + 5.1) — SHIPPED 2026-06-16</summary>

- [x] Phase 1: Activation — Bien, Locataire, Bail (8/8 plans) — completed 2026-05-16
- [x] Phase 2: Quittancement — Échéances, Encaissements, Relances (7/7 plans) — completed 2026-05-16
- [x] Phase 3: Conformité du bail — Diagnostics, EDL, IRL, Mobilier (5/5 plans) — completed 2026-05-19
- [x] Phase 4: Coffre documentaire & Travaux (4/4 plans) — completed 2026-05-20
- [x] Phase 5: Fiscalité LMNP — Régimes, Recettes/Charges, Amortissement (8/8 plans) — completed 2026-05-22
- [x] Phase 5.1: Hardening hexagonal (INSERTED) (1/1 plan) — completed 2026-05-22
- [x] Phase 6: Liasse 2031 & CFE (7/7 plans) — completed 2026-06-02
- [x] Phase 7: Dashboard & Notifications d'échéances (8/8 plans) — completed 2026-06-16
- [x] Phase 8: Gap closure — Fiche échéance & réconciliation tracking (1/1 plan) — completed 2026-06-16

</details>

### v1.1 Durcissement & mise en main (Phases 9–12)

- [ ] **Phase 9: Finition qualité — clôture UAT & réconciliation des statuts** - Exécuter les 12 scénarios d'UAT liasse 2031/CFE et réconcilier les statuts stale
- [ ] **Phase 10: Dette technique — consolidation & atomicité** - Consolider partials CFE, unifier `calculerAlertesIrl`, poser la transaction Kysely enveloppante
- [ ] **Phase 11: Sauvegarde & sécurité des données** - Chiffrement SQLCipher, backup/restore vérifié, conformité RGPD
- [ ] **Phase 12: Packaging & mise en main** - Binaire installable natif + auto-launch navigateur

## Phase Details

### Phase 9: Finition qualité — clôture UAT & réconciliation des statuts
**Goal**: Clore le reliquat de qualité v1.0 — la liasse 2031/CFE est validée par UAT humaine et aucun statut de suivi n'est fantôme.
**Depends on**: Nothing (clôture du backlog v1.0, sans dépendance code)
**Requirements**: QUA-01, QUA-02
**Success Criteria** (what must be TRUE):
  1. Les 12 scénarios d'UAT humaine de la liasse 2031/CFE (Phase 06) ont été exécutés et sont tous au vert.
  2. Chaque écart constaté pendant l'UAT a un correctif livré et le scénario correspondant repassé au vert (0 scénario en attente).
  3. Les statuts d'UAT des Phases 02/03/04 reflètent l'état réel (clos, 0 scénario fantôme).
  4. Les sessions de debug g1/g4/g8 sont marquées `resolved`, cohérentes avec les correctifs déjà livrés.
**Plans**: TBD

### Phase 10: Dette technique — consolidation & atomicité
**Goal**: Éponger la dette technique connue de v1.0 sous couverture de test existante, sans changement de comportement observable.
**Depends on**: Phase 9 (backlog qualité clos avant de toucher au code interne)
**Requirements**: DET-01, DET-02, DET-03
**Success Criteria** (what must be TRUE):
  1. Il n'existe plus qu'un seul partiel CFE réutilisable ; l'affichage CFE est identique avant/après (aucune régression).
  2. L'enrichissement des alertes IRL passe par un chemin unique `calculerAlertesIrl`, couvert par les scénarios existants restés au vert.
  3. Les écritures multi-tables sont enveloppées dans une transaction Kysely : un échec partiel déclenche un rollback complet (atomicité vérifiée par scénario).
  4. La suite de tests complète reste verte et sous le seuil de durée (< 30 s).
**Plans**: TBD
**UI hint**: yes

### Phase 11: Sauvegarde & sécurité des données
**Goal**: Sécuriser les données du bailleur — base chiffrée au repos, sauvegarde/restauration vérifiée, traitement RGPD-conforme.
**Depends on**: Phase 10 (code interne consolidé avant durcissement infra)
**Requirements**: BAK-02, BAK-01, BAK-03
**Success Criteria** (what must be TRUE):
  1. La base SQLite est chiffrée au repos (SQLCipher) ; son ouverture exige une passphrase et échoue sans elle.
  2. L'utilisateur peut déclencher une sauvegarde de la base chiffrée **et** du dossier `documents/` en une action.
  3. L'utilisateur peut restaurer une sauvegarde ; la restauration est validée par un contrôle d'intégrité qui détecte une archive corrompue.
  4. La conformité RGPD est opérable : note d'information locataire générée, droit à l'effacement exécutable, registre de traitement disponible.
**Plans**: TBD
**UI hint**: yes

> **Note de séquençage** : BAK-02 (chiffrement SQLCipher) est traité **avant** BAK-01 (backup/restore) à l'intérieur de la phase — la sauvegarde et le contrôle d'intégrité doivent porter sur une base chiffrée. La passphrase d'ouverture conditionne aussi la restauration.

### Phase 12: Packaging & mise en main
**Goal**: Rendre le logiciel installable et utilisable par un bailleur non-dev — binaire natif, sans toolchain, auto-launch navigateur.
**Depends on**: Phase 11 (le packaging emballe le build final durci et chiffré)
**Requirements**: PKG-01, PKG-02
**Success Criteria** (what must be TRUE):
  1. L'utilisateur installe le logiciel via un binaire natif (DMG / MSI / AppImage) sans `node` ni `pnpm` présents sur la machine.
  2. Le binaire embarque le runtime et les assets — il démarre sans étape de build, et crée/ouvre la base (chiffrée) au premier lancement.
  3. Au lancement, le logiciel ouvre automatiquement l'interface dans le navigateur par défaut.
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Activation — Bien, Locataire, Bail | v1.0 | 8/8 | Complete | 2026-05-16 |
| 2. Quittancement — Échéances, Encaissements, Relances | v1.0 | 7/7 | Complete | 2026-05-16 |
| 3. Conformité du bail — Diagnostics, EDL, IRL, Mobilier | v1.0 | 5/5 | Complete | 2026-05-19 |
| 4. Coffre documentaire & Travaux | v1.0 | 4/4 | Complete | 2026-05-20 |
| 5. Fiscalité LMNP — Régimes, Recettes/Charges, Amortissement | v1.0 | 8/8 | Complete | 2026-05-22 |
| 5.1. Hardening hexagonal | v1.0 | 1/1 | Complete | 2026-05-22 |
| 6. Liasse 2031 & CFE | v1.0 | 7/7 | Complete | 2026-06-02 |
| 7. Dashboard & Notifications d'échéances | v1.0 | 8/8 | Complete | 2026-06-16 |
| 8. Gap closure — Fiche échéance & tracking | v1.0 | 1/1 | Complete | 2026-06-16 |
| 9. Finition qualité — clôture UAT & réconciliation | v1.1 | 0/TBD | Not started | - |
| 10. Dette technique — consolidation & atomicité | v1.1 | 0/TBD | Not started | - |
| 11. Sauvegarde & sécurité des données | v1.1 | 0/TBD | Not started | - |
| 12. Packaging & mise en main | v1.1 | 0/TBD | Not started | - |
