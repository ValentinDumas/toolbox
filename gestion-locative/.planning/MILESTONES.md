# Milestones

## v1.0 MVP LMNP (Shipped: 2026-06-16)

**Phases completed:** 9 phases (1–8 + 5.1 inserted), 54 plans, 33 tasks
**Requirements:** 26/26 v1 requirements satisfied
**Codebase:** ~28 400 LOC TypeScript, 199 fichiers de test
**Timeline:** 2026-05-04 → 2026-06-16 (43 jours), 732 commits (172 `feat`)
**Delivered:** Un logiciel de gestion locative local-first, mono-utilisateur, couvrant le cycle administratif et fiscal complet d'un bailleur LMNP en location meublée longue durée — de l'activation au dashboard d'échéances.

**Key accomplishments:**

- **Activation (Phase 1)** — Wizard SSR 3 étapes (Bien + Lots → Locataire → Bail meublé classique) ; KPI Activation atteint : 1 Bien + 1 Locataire + 1 Bail persistés en une session, sans fiscal.
- **Quittancement (Phase 2)** — Avis d'échéance PDF, encaissements (soft-delete + compensateur), quittances PDF numérotées, page impayés, relances escaladées 3 niveaux (amiable → mise en demeure) canal mailto/PDF.
- **Conformité du bail (Phase 3)** — Diagnostics (DPE/gaz/élec/ERP), EDL contradictoire + inventaire mobilier (12 items décret 2015-981), indexation IRL annuelle avec avenant signable et gel loyer Climat (DPE F/G).
- **Coffre documentaire & travaux (Phase 4)** — Upload justificatifs (PDF/JPG/PNG/HEIC/WebP) avec validation magic-bytes et rétention 10 ans hard-block, recherche facettée, tickets travaux avec pièces jointes N:N.
- **Fiscalité LMNP (Phases 5 + 5.1)** — Régimes micro-BIC vs réel, amortissement par composant (terrain exclu, ARD, plafond résultat), détection bascule LMP (CGI 155 IV), 100 % couverture du domaine `fiscalite/` ; hardening hexagonal (3 ports + 3 adapters pdfmake, domaine pur).
- **Liasse 2031 & CFE (Phase 6)** — Brouillon liasse 2031-SD + annexes 2033-A à G traçables à la source, exports PDF/CSV, suivi déclaratif CFE (1447-C-SD) avec alerte échéance décembre.
- **Dashboard & notifications (Phases 7 + 8)** — Récap synthétique (impayés, actions du jour), alertes J-30/J-7 (CFE, IRL, expiration diagnostics, fin de bail), fiche échéance `GET /echeances/:id` (blocker d'intégration v1.0 fermé).

**Known deferred items at close:** 8 (see STATE.md › Deferred Items) — 3 sessions de debug diagnostiquées (correctifs intégrés en gap-closure), 4 UAT gaps (Phases 02/03/04 = 0 scénario en attente ; Phase 06 = 12 scénarios UAT humaine en pause), 1 verification gap stale (01-08, drift de suivi désormais réconcilié). Aucun ne correspond à une exigence v1 non satisfaite ; l'audit milestone v1.0 est `passed`.

---
