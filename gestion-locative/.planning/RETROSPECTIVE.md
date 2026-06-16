# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP LMNP

**Shipped:** 2026-06-16
**Phases:** 9 (1–8 + 5.1 inserted) | **Plans:** 54 | **Tasks:** 33

### What Was Built
- Cycle locatif complet : activation (Bien/Locataire/Bail), quittancement (avis, encaissements, quittances, relances escaladées), conformité du bail meublé (diagnostics, EDL, IRL + gel DPE F/G, mobilier décret 2015-981).
- Chaîne fiscale LMNP : régimes micro-BIC vs réel, amortissement par composant, détection bascule LMP, liasse 2031-SD + annexes 2033, suivi CFE — couverture 100 % du domaine `fiscalite/`.
- Coffre documentaire (rétention 10 ans, validation magic-bytes), travaux, dashboard d'échéances avec notifications J-30/J-7 et fiche échéance.

### What Worked
- **Vertical MVP slices** : chaque phase shippable de bout en bout, sans phase horizontale « DB » ou « UI ». L'activation a livré de la valeur observable dès la Phase 1.
- **BDD outside-in + 100 % couverture fiscale** : chaque exception du droit (gel Climat, plafond amortissement, plancher micro-BIC, bascule LMP) a son scénario dédié — la logique fiscale a tenu sans régression.
- **Domaine pur / hexagonal** : la discipline ports & adapters a permis un hardening ciblé (Phase 5.1) sans toucher au métier.
- **Gap-closure phases** : Phase 8 a fermé proprement le seul blocker d'intégration cross-phase (`GET /echeances/:id`) remonté par l'audit milestone.

### What Was Inefficient
- **Drift de suivi** : REQUIREMENTS.md, la table Progress ROADMAP et les frontmatter SUMMARY ont divergé de l'état disque — corrigé en bloc par Phase 8. La vérification par phase n'a pas détecté un dead-link cross-phase (P2↔P7).
- **UAT humaine en retard** : 12 scénarios d'UAT Phase 06 (liasse/CFE) restés en pause à la clôture ; statuts de sessions de debug jamais repassés à `resolved` malgré les correctifs livrés.
- **Doublons résiduels** : 2 partials CFE, 2 patterns d'enrichissement `calculerAlertesIrl` — dette acceptée mais à consolider.

### Patterns Established
- Calculateurs domaine purs alimentés par des données résolues dans le use case (ex. `Map<BailId,string>` nomLocataire injectée en argument optionnel — le domaine ne touche jamais un repo).
- Append-only pour les corrections (DeclarationCorrigee, BailIndexation) — audit-friendly.
- Numérotation atomique (quittances AAAA-NNN), Content-Disposition RFC 6266, magic-bytes pour les uploads.

### Key Lessons
1. La vérification par phase ne capture pas les liens morts cross-phase ; un audit milestone d'intégration de bout en bout reste nécessaire avant clôture.
2. Réconcilier le suivi (REQUIREMENTS/ROADMAP/frontmatter) en continu, pas en fin de milestone — le drift coûte une phase de gap-closure dédiée.
3. L'UAT humaine doit être planifiée comme un gate, pas comme un reliquat optionnel.

### Cost Observations
- Model mix : non instrumenté ce milestone.
- Notable : 732 commits / 172 `feat` sur 43 jours — cadence soutenue portée par les slices verticaux.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.0 | 9 | Établissement du flux GSD (discuss → plan → execute → verify) + phases de gap-closure/hardening insérées à la demande. |

### Cumulative Quality

| Milestone | Test files | Coverage | LOC |
|-----------|-----------|----------|-----|
| v1.0 | 199 | 100 % domaine `fiscalite/` | ~28 400 TS |

### Top Lessons (Verified Across Milestones)

1. (à confirmer sur v1.1) Réconcilier le suivi en continu plutôt qu'en fin de milestone.
