---
phase: 6
slug: liasse-2031-cfe
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Brouillon liasse 2031-SD + annexes 2033-A/B/C/D + 2042 C PRO + suivi CFE 1447-C-SD + alerte J-30. 100% couverture obligatoire sur logique fiscale (mapping case-par-case, réconciliation snapshot/vivant).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.x (unit + integration) + Cucumber.js 11.x (BDD outside-in) + fast-check 3.x (property-based) |
| **Config file** | `vitest.config.ts`, `cucumber.cjs` (à confirmer via le repo Phase 5) |
| **Quick run command** | `pnpm test -- --run` (vitest non-watch) |
| **Full suite command** | `pnpm test && pnpm test:bdd && pnpm typecheck && pnpm lint && pnpm depcruise` |
| **Estimated runtime** | ~30 secondes (target SOFTWARE_CRAFTSMANSHIP.md : suite < 30 s) |

---

## Sampling Rate

- **After every task commit:** `pnpm test -- --run <fichier-touché>`
- **After every plan wave:** `pnpm test && pnpm test:bdd`
- **Before `/gsd-verify-work`:** Full suite + `pnpm depcruise` (zéro import technique dans `src/domain/`) doivent être verts
- **Max feedback latency:** 30 secondes (gate CI)

---

## Per-Task Verification Map

Voir RESEARCH.md §Validation Architecture (Nyquist) — 37 scénarios BDD ventilés sur 7 features. Détail rempli par chaque PLAN.md (tâches `<automated>`) au moment du planning. Référentiel des features :

| Feature | Scénarios | Couvre |
|---------|-----------|--------|
| `brouillon-liasse-reel.feature` | ~8 | Mapping 2031-SD + 2033-A/B/C/D depuis snapshot régime réel |
| `brouillon-liasse-micro.feature` | ~3 | Mapping 2042 C PRO depuis snapshot micro-BIC |
| `liasse-rectificative.feature` | ~3 | Génération depuis `DeclarationCorrigee` + bandeau motif |
| `liasse-tracabilite.feature` | ~6 | Drill-down case → sources + réconciliation snapshot/vivant |
| `mapping-liasse-versionne.feature` | ~3 | Fail-fast année non couverte (port `MappingLiasseProvider`) |
| `cfe-suivi-declaratif.feature` | ~6 | Statuts CFE + exonération première année (CGI art. 1478 II) |
| `cfe-alerte-echeance.feature` | ~8 | Banner J-30 décembre via `Clock` (déterministe) |

Propriétés fast-check (5 minimum) :
1. **Réconciliation idempotente** — `Σ(sources_vivantes) = snapshot.valeur` pour tout snapshot non corrigé.
2. **Mapping bijectif** — chaque `caseId` du provider est unique, chaque libellé officiel non vide.
3. **Money centimes intégrité** — pour toute valeur de case, `valeur = bigint` et `bigint >= 0n` (sauf déficit reportable).
4. **Alerte CFE monotonie** — pour `now1 < now2 < dateEcheance`, `delta_jours(now1) > delta_jours(now2)`.
5. **Versioning fail-fast** — pour tout `annee ∉ ANNEES_COUVERTES`, `MappingLiasseProvider.mapping(annee)` lance `InvariantViolated`.

Chaque PLAN.md remplit le tableau `Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status` lors de la génération.

---

## Wave 0 Requirements

- [ ] `tests/_builders/fiscalite.ts` — étendre avec `declarationCfeBuilder()`, `mappingLiasseBuilder()`, fixtures cerfa 2026.
- [ ] `tests/_fakes/mapping-liasse-provider-fake.ts` — fake en mémoire (miroir de `regle-fiscale-provider-fake.ts`).
- [ ] `tests/_fakes/clock-fake.ts` — réutilisé (déjà créé Phase 3 pour banner IRL).
- [ ] `tests/features/` — créer les 7 `.feature` listées ci-dessus (squelettes vides Wave 0).
- [ ] `vitest.config.ts` & `cucumber.cjs` — vérifier inclusion glob `src/domain/fiscalite/liasse/**` + `src/domain/fiscalite/cfe/**`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Concordance visuelle PDF brouillon liasse vs cerfa officiel 2031-SD millésime 2026 | FIS-05 | Validation graphique (mise en page pdfmake, ordre des cases, libellés exacts) impossible à automatiser fiablement | 1. Générer un brouillon réel via `/fiscalite/declarations/:id/liasse.pdf`. 2. Comparer côte-à-côte avec PDF cerfa officiel téléchargé sur impots.gouv.fr. 3. Vérifier chaque case (numéro + libellé) figure dans le bon ordre. |
| Banner CFE J-30 visible sur fiche `Bien` au bon moment | FIS-06 | Comportement contextuel UI (apparition/disparition selon `Clock`) ; test E2E couvre le calcul, validation perçue manuelle | 1. Setter `Clock` à `2026-11-15` (J-30 hypothétique pour échéance 15/12). 2. Visiter `/biens/:id`. 3. Vérifier présence banner avec libellé + lien vers `/fiscalite/cfe/:id`. 4. Vérifier disparition après mise à jour du statut → `payee`. |
| Audit-friendliness drill-down → sources vivantes | FIS-05 (traçabilité D-T6.x) | UX de navigation expert-comptable, non scriptable | 1. Cliquer une case avec sources. 2. Vérifier liste lisible (encaissements / justificatifs / lignes amortissement) avec montants + dates + IDs cliquables. 3. Vérifier badge réconciliation si Σ ≠ snapshot. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (builders, fakes, features squelettes)
- [ ] No watch-mode flags (`--run` obligatoire en CI)
- [ ] Feedback latency < 30 s
- [ ] `nyquist_compliant: true` set in frontmatter
- [ ] 100 % couverture sur `src/domain/fiscalite/liasse/**` + `src/domain/fiscalite/cfe/**` (gate BDD_PRACTICES.md)
- [ ] dependency-cruiser vert (zéro import technique dans `src/domain/`)

**Approval:** pending
