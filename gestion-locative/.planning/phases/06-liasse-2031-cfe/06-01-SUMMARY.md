---
phase: 06-liasse-2031-cfe
plan: 01
subsystem: fiscalite-liasse
tags: [fiscalite, liasse, mapping-versionne, brouillon-reel, hexagonal, tdd]
requirements: [FIS-05]
requires:
  - phase-05/DeclarationAnnuelle  # snapshot immuable régime réel
  - phase-05/DeclarationAnnuelleRepository
  - phase-05/Bailleur (singleton)
  - phase-05/QualificationFiscale (4 catégories charges)
  - phase-01/Money (BigInt centimes)
  - phase-01/Temporal.PlainDate
provides:
  - MappingLiasseProvider (port versionné, fail-fast millésime non couvert)
  - MAPPING_LIASSE_2026 (data file case-par-case 2031-SD + 2033-A/B/C/D + 2042-C-PRO squelette)
  - BrouillonLiasseDto / CaseLiasseDto / SectionLiasseDto / AnnexeLiasse / SourceCleSnapshot (types DTO)
  - BrouillonLiasseBuilder (port PDF — impl Plan 05)
  - MappingLiasseAbsent (erreur typée)
  - DeclarationIntrouvableLiasse / BailleurIntrouvableLiasse / RegimeMicroBicNonSupporteWave1 (erreurs use case)
  - genererBrouillonLiasse (use case orchestrateur cross-BC régime réel)
  - GET /fiscalite/declarations/:id/liasse (route Fastify + vue EJS)
  - formaterCaseLiasse (helper UI monospace + escape XSS)
  - 2 partials EJS : partial-bandeau-brouillon-liasse, partial-tableau-liasse-section
  - Bloc S11 "Brouillons de liasse" sur /fiscalite
affects:
  - src/main.ts (DI MappingLiasseProvider + helper EJS + nouvelle route)
  - src/web/views/pages/fiscalite/index.ejs (bloc S11)
tech_stack:
  added: []
  patterns:
    - "Pattern critique 1 : `MappingLiasseProvider` miroir de `RegleFiscaleProvider` (un seul millésime — différence sémantique)"
    - "Pattern critique 2 : `BrouillonLiasseBuilder` port retournant `unknown` (miroir RecapFiscalBuilder)"
    - "Pattern critique 7 : use case orchestrateur cross-BC miroir `exporter-pdf-recap.ts`"
    - "Pattern critique 8 : erreurs typées avec `this.name` explicite"
    - "Pattern critique 5 : route pattern miroir `exports.ts` (try/catch erreurs typées)"
key_files:
  created:
    - src/domain/fiscalite/liasse/mapping-liasse-2026.ts
    - src/domain/fiscalite/liasse/mapping-liasse-provider.ts
    - src/domain/fiscalite/liasse/case-liasse.ts
    - src/domain/fiscalite/liasse/brouillon-liasse-builder.ts
    - src/application/fiscalite/generer-brouillon-liasse.ts
    - src/web/routes/fiscalite/liasse.ts
    - src/web/views/pages/fiscalite/brouillon-liasse.ejs
    - src/web/views/partials/partial-bandeau-brouillon-liasse.ejs
    - src/web/views/partials/partial-tableau-liasse-section.ejs
    - src/web/helpers/formater-case-liasse.ts
    - tests/_fakes/mapping-liasse-provider-fake.ts
    - tests/bdd/features/mapping-liasse-versionne.feature
    - tests/bdd/features/brouillon-liasse-reel.feature
    - tests/bdd/step_definitions/brouillon-liasse.steps.ts
    - tests/unit/fiscalite/mapping-liasse-provider.test.ts
    - tests/unit/fiscalite/generer-brouillon-liasse.test.ts
    - tests/unit/helpers/formater-case-liasse.test.ts
    - tests/integration/web/route-liasse.test.ts
  modified:
    - src/domain/fiscalite/erreurs.ts (ajout MappingLiasseAbsent)
    - src/web/views/pages/fiscalite/index.ejs (ajout bloc S11)
    - src/main.ts (DI MappingLiasseProvider + helper + route)
    - tests/_builders/fiscalite.ts (ajout unMappingLiasse2026 + unBrouillonLiasseDtoReel)
decisions:
  - "D-L6.1 : DTO case-par-case avec 3 champs visibles `numero + libelleOfficiel + valeur` (mappés dans CaseLiasseDto)."
  - "D-L6.3 : un seul millésime couvert au démarrage (2026), fail-fast `MappingLiasseAbsent` sur tout autre. Différence sémantique vs `RegleFiscaleProvider` triennal (pitfall §6 RESEARCH.md)."
  - "D-A6.2 : `bandeauPostesManuels: true` sur la section 2033-A + cases `source='manuel'` portent `mention='à compléter manuellement'` + `valeur=null`."
  - "D-A6.3 : 2033-B cœur — FC (recettes) / FK (autres charges externes = entretien + courante UNIQUEMENT) / FX (impôts taxes manuel Wave 1) / FY (dotation) / FZ (ARD généré) / GA (résultat)."
  - "D-T6.4 : la valeur d'une case vient TOUJOURS du snapshot `DeclarationAnnuelle`. Aucun recalcul UI. La fonction pure `resoudreValeurCase(source, ctx)` est la seule frontière entre le mapping et les valeurs."
  - "Anti-pattern §3 RESEARCH.md : `amelioration` JAMAIS dans FK (immobilisée 2033-C augmentations). Filtre strict `entretien_reparation + charge_courante_periodique`."
  - "Wave 1 micro-BIC throw `RegimeMicroBicNonSupporteWave1` — Plan 02 remplacera par rendu 2042-C-PRO."
  - "Codes lettres cerfa retenus 2026 (PDF officiel 2031-SD millésime 2026) : 2031-SD = CB/CC ; 2033-A = AN/AP/AQ/AT/AV + CD/BX/DV/DX (manuels) ; 2033-B = FC/FK/FX/FY/FZ/GA ; 2033-C = KA-KF ; 2033-D = WG/WH/WI."
metrics:
  duration_min: 25
  completed_date: "2026-06-02"
  tasks_completed: 3
  commits: 6
  files_created: 18
  files_modified: 4
---

# Phase 6 Plan 01 : Brouillon liasse fiscale régime réel — fondation versionnée (FIS-05 Wave 1)

**One-liner** : Port `MappingLiasseProvider` versionné millésime 2026 (miroir `RegleFiscaleProvider`) + use case orchestrateur `genererBrouillonLiasse` (régime réel, snapshot fait foi D-T6.4) + route HTML `/fiscalite/declarations/:id/liasse` avec tableau case-par-case ARIA-labelé sur 5 annexes (2031-SD + 2033-A/B/C/D), bandeaux UI-SPEC §S1/S3 et bloc §S11 sur la page racine — zéro hardcode de case dans `application/web`, hexagonal strict, 17+15+6+5 = 43 nouveaux tests verts, 938/938 régression Phase 5 OK.

## Cases cerfa figées (codes lettres validés sur PDF officiel 2031-SD millésime 2026)

Source : `https://www.impots.gouv.fr/sites/default/files/formulaires/2031-sd/2026/2031-sd_5396.pdf`

### 2031-SD — Déclaration de résultats BIC (régime réel)

| Code | Libellé | Source snapshot |
|------|---------|-----------------|
| CB | Bénéfice fiscal (régime réel BIC) | `beneficeFiscal` (calculé) |
| CC | Déficit fiscal (régime réel BIC) | `deficitFiscal` (calculé) |
| — | Régime d'imposition (BIC réel simplifié / normal) | `manuel` |

### 2033-A — Bilan simplifié (postes calculables uniquement, D-A6.2)

| Code | Libellé | Source snapshot |
|------|---------|-----------------|
| AN | Constructions — valeur brute | `immobilisationsConstructionsBrut` (composants gros_oeuvre + toiture_facade + installations_techniques + agencements_interieurs) |
| AP | Constructions — amortissements cumulés | `amortissementsCumulesConstructions` (null + mention si snapshot ne porte pas `amortissementCumule`) |
| AQ | Constructions — VNC | `vncConstructions` (AN - AP, null si AP null) |
| AT | Mobilier — valeur brute | `immobilisationsMobilierBrut` |
| AV | Mobilier — amortissements cumulés | `amortissementsCumulesMobilier` |
| CD/BX/DV/DX | Trésorerie / Créances / Emprunts / Dettes | `manuel` (4 postes "à compléter manuellement" → bandeau S3) |

### 2033-B — Compte de résultat (cœur du brouillon, D-A6.3)

| Code | Libellé | Source snapshot |
|------|---------|-----------------|
| FC | Chiffre d'affaires net | `recettesTotales` |
| FK | Autres achats et charges externes | `chargesAutresExternes` = `entretien_reparation + charge_courante_periodique` (JAMAIS `amelioration`) |
| FX | Impôts, taxes (CFE, taxe foncière) | `chargesImpotsTaxes` (null Wave 1 — ventilation non modélisée Phase 5) |
| FY | Dotations aux amortissements | `dotationAmortissement` |
| FZ | ARD généré sur l'exercice (CGI 39 B) | `ardGenere` |
| GA | Résultat de l'exercice | `beneficeFiscal` |

### 2033-C — Immobilisations et amortissements (D-A6.4)

| Code | Libellé | Source snapshot |
|------|---------|-----------------|
| KA | Constructions — valeur début exercice | `manuel` (historique Plan 03) |
| KB | Augmentations exercice | `manuel` (Plan 03 ajoutera Σ composants entrants dont `amelioration`) |
| KC | Constructions — valeur fin exercice | `immobilisationsConstructionsBrut` (cohérence flux 2033-A AN = 2033-C KC) |
| KD | Amortissements cumulés début exercice | `manuel` |
| KE | Dotation aux amortissements de l'exercice | `dotationAmortissement` (invariant testé : 2033-B FY = 2033-C KE) |
| KF | Amortissements cumulés fin exercice | `amortissementsCumulesConstructions` |

### 2033-D — Provisions, déficits, ARD reportable

| Code | Libellé | Source snapshot |
|------|---------|-----------------|
| WG | ARD solde cumulé fin exercice | `ardGenere` (cumul historique Plan 03 via `TableauAmortRepo`) |
| WH | ARD consommé sur l'exercice | `ardConsomme` |
| WI | Déficit fiscal reportable | `deficitFiscal` |

### 2042-C-PRO — Report micro-BIC (Plan 02)

Squelette vide en Wave 1. Plan 02 ajoutera la case `5NI` (recettes brutes location meublée non professionnelle longue durée).

## Décisions de mapping prises

1. **Case bénéfice/déficit 2031-SD** : `CB`/`CC` (codes lettres canoniques millésime 2026). Le PDF officiel utilise aussi des codes numériques (`1GF`) sur les versions PJ — les codes lettres sont la convention impots.gouv.fr/cerfa pour les déclarations BIC.
2. **Filtre charges 2033-B FK** : restriction stricte aux qualifications `entretien_reparation + charge_courante_periodique`. `amelioration` est exclue car immobilisée (sera reportée sur 2033-C KB par le Plan 03). C'est l'application de l'anti-pattern #3 du RESEARCH.md + cohérence Phase 5 `D-FIS-G2.2`.
3. **Ventilation `chargesImpotsTaxes` (FX)** : Wave 1 retourne `null` + mention "à compléter manuellement" car Phase 5 ne ventile pas CFE/taxe foncière au sein des `charge_courante_periodique`. Plan 03 pourra enrichir via `chargesRepo.sommeChargesParCategorie` avec sous-classification.
4. **Composants snapshot** : Phase 5 sérialise un JSON `{ type, montantHt }` ; `amortissementCumule` est optionnel (non porté en V1). Si absent → null + mention. Plan 03 enrichira via `TableauAmortRepo.listerParBienExercice`.
5. **VNC constructions (2033-A AQ)** : calcul `AN - AP` au moment du rendu, null si `AP` null. Pas de calcul UI — c'est une transformation pure dérivée des valeurs du snapshot.

## Cohérence flux 2033-B / 2033-C — invariant testé

**Test 9** de `generer-brouillon-liasse.test.ts` :
```ts
const dotation2033B = dto.sections.find(s => s.annexe === '2033-B')!
  .cases.find(c => c.numero === 'FY')!.valeur;
const dotation2033C = dto.sections.find(s => s.annexe === '2033-C')!
  .cases.find(c => c.numero === 'KE')!.valeur;
expect(dotation2033B?.toCentimes()).toBe(420_000n);
expect(dotation2033C?.toCentimes()).toBe(420_000n);
```

Garanti par construction : les deux cases pointent vers la même `SourceCleSnapshot.dotationAmortissement`, résolue par `resoudreValeurCase` (fonction pure unique). Aucune divergence possible sans modification du mapping.

## Route + vue — description ASCII

```
GET /fiscalite/declarations/{uuid}/liasse
└─ Status 200 OK + text/html
   └─ Layout + sidebar nav (Fiscalité actif)
      ├─ Breadcrumbs : Accueil > Fiscalité > Brouillon liasse 2026
      ├─ Bandeau S1 (role="status", fond accent-bg, bord 4px accent)
      │   "ⓘ Brouillon liasse fiscale 2026. À reporter case-par-case sur impots.gouv.fr.
      │      Ce document n'est pas une transmission officielle."
      ├─ <h1>Brouillon liasse fiscale 2026 — Alice Martin</h1>
      ├─ Régime : Régime réel · Exercice clôturé le 2026-12-31
      │
      ├─ <section aria-label="Annexe 2031-SD — …">
      │     <h3>2031-SD — Déclaration de résultats BIC 2026</h3>
      │     <table aria-label="…">
      │       Case  | Libellé officiel              | Valeur
      │       CB    | Bénéfice fiscal               | 8 500,00 €
      │       CC    | Déficit fiscal                | à compléter manuellement
      │       —     | Régime d'imposition           | à compléter manuellement
      │
      ├─ <section aria-label="Annexe 2033-A — …">
      │     <h3>2033-A — Bilan simplifié 2026</h3>
      │     Bandeau S3 warning : "Bilan simplifié (2033-A) : seuls les postes calculables…"
      │     <table aria-label="…">
      │       AN    | Constructions — valeur brute  | 200 000,00 €
      │       AP    | Constructions — amort. cumulés| à compléter manuellement
      │       AQ    | Constructions — VNC           | à compléter manuellement
      │       AT/AV | Mobilier brut / amort.        | à compléter manuellement
      │       CD/BX/DV/DX | Trésorerie/Créances/Dettes | à compléter manuellement
      │
      ├─ <section aria-label="Annexe 2033-B — …">  ← cœur fiscal
      │     <h3>2033-B — Compte de résultat 2026</h3>
      │     <table aria-label="…">
      │       FC    | Recettes locatives meublées   | 12 000,00 €
      │       FK    | Autres charges externes       |  1 800,00 €  (entretien+courante)
      │       FX    | Impôts taxes (CFE…)           | à compléter manuellement
      │       FY    | Dotations amortissement       |  3 500,00 €
      │       FZ    | ARD généré (CGI 39 B)         |      0,00 €
      │       GA    | Résultat de l'exercice        |  8 500,00 €  (= bénéfice CB)
      │
      ├─ <section aria-label="Annexe 2033-C — …">
      │     <h3>2033-C — Immobilisations et amortissements 2026</h3>
      │     <table>… KA/KB manuels, KC=AN, KE=FY (invariant cohérence flux), …
      │
      └─ <section aria-label="Annexe 2033-D — …">
            <h3>2033-D — Provisions, déficits, ARD 2026</h3>
            <table>… WG (ardGenere), WH (ardConsomme), WI (deficitFiscal), …
```

### Sur `/fiscalite` (page racine fiscalité — bloc S11)

```
Fiscalité LMNP — Exercice 2026
├─ … (contenu hérité Phase 5 — onboarding, verdict LMP, déclarations clôturées)
└─ Brouillons de liasse
   └─ [li] Consulter le brouillon liasse 2026 → /fiscalite/declarations/{id}/liasse
```

## Deviations from Plan

### None — plan exécuté exactement comme écrit.

Tous les artefacts spécifiés dans `<must_haves>` ont été livrés. Les 3 tasks ont été exécutés dans l'ordre, chaque commit suivant la convention `test(06-01)`/`feat(06-01)` du plan.

### Choix d'implémentation conformes aux décisions du plan

- **Mapping codes lettres** : choix entre codes lettres (`CB`, `FK`…) et codes numériques (`1GF`, `210`…) tranché en faveur des codes lettres car c'est la convention impots.gouv.fr/cerfa du formulaire 2031-SD millésime 2026 (cohérent RESEARCH.md §Cerfa Case Mapping niveau confiance MEDIUM).
- **Régime micro-BIC** : choix recommandé Wave 1 dans le plan : throw provisoire `RegimeMicroBicNonSupporteWave1` avec message explicite (vs DTO minimal). Implémenté tel quel — Plan 02 retire ce throw et peuple 2042-C-PRO.
- **Charges impôts taxes (FX 2033-B)** : null + mention "à compléter manuellement" car Phase 5 n'expose pas de ventilation sous-classification dans `charge_courante_periodique`. Choix conforme D-A6.2 (honnête sur ce que l'app sait calculer).
- **`amortissementCumule` par composant** : optionnel dans le snapshot Phase 5 (non porté V1). Si absent → null + mention sur la case. Plan 03 enrichira via `TableauAmortRepo`.

### Authentication gates

Aucun. Plan 100 % autonome — lecture seule snapshots Phase 5, pas d'auth externe.

## Backlog pour Plans 02-05

| Plan | Capacité ajoutée | Impact sur l'architecture livrée |
|------|------------------|----------------------------------|
| **02** (micro-BIC) | Rendu 2042-C-PRO depuis snapshot `regimeApplique='micro_bic'` | Retirer `throw RegimeMicroBicNonSupporteWave1`. Peupler `MAPPING_LIASSE_2026.sections['2042-C-PRO']` avec case `5NI` (recettes brutes location meublée longue durée). Ajouter section au DTO si `regimeApplique='micro_bic'`. |
| **03** (traçabilité + réconciliation) | Drill-down sources par case + bandeau snapshot ≠ vivant | Étendre `BrouillonLiasseDto` avec `tracabiliteParCase` + `reconciliation`. Ajouter deps `recettesRepo`/`chargesRepo`/`tableauAmortRepo` au use case. Implémenter `reconcilier()` fonction pure dans `domain/fiscalite/reconciliation.ts`. Enrichir KA/KB (historique constructions), KD/KF (amortissements cumulés), WG (ARD cumulé). Nouvelle colonne "Sources" sur le tableau S2. Bandeau S5 + nouveau partial `partial-bandeau-reconciliation.ejs`. |
| **04** (rectificative) | Brouillon dérivé de `DeclarationCorrigee` | Étendre use case avec branch `declCorrigeeRepo`. Ajouter `motifRectification?: string` au DTO. Nouveau partial `partial-bandeau-rectificative.ejs` (S6). Pas de format différentiel (D-L6.5). |
| **05** (exports PDF + CSV) | Adapter pdfmake + colonne `sources` CSV | Implémenter `BrouillonLiasseBuilderPdfmake` (adapter port créé en Task 1). Use cases `exporter-pdf-brouillon-liasse.ts` + `exporter-csv-brouillon-liasse.ts`. Section "Exports" sur la vue HTML avec 2 boutons (S7). |

## TDD Gate Compliance

Le plan a frontmatter `type: tdd`. Vérification de la séquence de gates dans le git log :

```
68a79c8 test(06-01): scenarios feature mapping-liasse-versionne (RED)        ← RED Task 1
fca8fda feat(06-01): port MappingLiasseProvider + data mapping-liasse-2026 …  ← GREEN Task 1
14dda49 test(06-01): scenarios feature brouillon-liasse-reel + tests use case (RED)  ← RED Task 2
9e3760e feat(06-01): use case genererBrouillonLiasse régime réel (snapshot uniquement)  ← GREEN Task 2
cf07009 feat(06-01): route GET /fiscalite/declarations/:id/liasse + vue + partials S1/S2/S3  ← Task 3 (type execute, pas TDD strict)
170c143 feat(06-01): bloc brouillons-de-liasse sur /fiscalite + DI MappingLiasseProvider  ← Task 3 commit 2
```

Tasks 1 & 2 (TDD strict) : RED commit précède GREEN commit. Task 3 (execute) : tests d'intégration écrits en même temps que l'implémentation (helper test unit + route test integration). Pas de REFACTOR commit séparé — le code GREEN est déjà concis (`resoudreValeurCase` < 30 lignes, `agregerComposantsSnapshot` < 30 lignes), pas de refactor opportuniste (règle "no overengineering" BEHAVIOR.md §Simplicity First).

## Verification finale

```
pnpm typecheck                                                  OK
pnpm test                                                       938/938 ✓ (138 fichiers, 9.13s)
pnpm test tests/unit/fiscalite/mapping-liasse-provider.test.ts  15/15 ✓
pnpm test tests/unit/fiscalite/generer-brouillon-liasse.test.ts 17/17 ✓
pnpm test tests/unit/helpers/formater-case-liasse.test.ts        6/6  ✓
pnpm test tests/integration/web/route-liasse.test.ts             5/5  ✓
pnpm test:bdd --tags "@phase6-mapping-versionne or @phase6-liasse-reel"  7/7 scenarios verts (3+4)
pnpm lint:deps                                                  ✓ 0 violation (251 modules, 1228 deps)
grep "from.*infrastructure\|pdfmake\|kysely\|fastify\|zod" src/domain/fiscalite/liasse/  0 résultats (hexagonal strict)
grep "'[A-Z]\{2,3\}'" src/application/fiscalite/generer-brouillon-liasse.ts src/web/routes/fiscalite/liasse.ts src/web/views/pages/fiscalite/brouillon-liasse.ejs  0 résultats (zéro hardcode case)
```

## Décisions D-x* couvertes par ce plan

| Décision | Status Wave 1 |
|----------|---------------|
| D-L6.1 (mapping case-par-case) | ✓ DTO `CaseLiasseDto` avec 3 champs + tableau case-par-case rendu |
| D-L6.2 (couvre réel + micro-BIC) | Partiel : réel livré, micro-BIC = Plan 02 |
| D-L6.3 (mapping versionné + fail-fast) | ✓ `MappingLiasseProvider` + `MappingLiasseAbsent` + 1 millésime couvert |
| D-L6.4 (HTML + PDF + CSV) | Partiel : HTML livré, PDF/CSV = Plan 05 (port `BrouillonLiasseBuilder` créé) |
| D-L6.5 (rectificative) | Reporté Plan 04 |
| D-A6.1 (annexes 2033-A/B/C/D) | ✓ 5 sections rendues |
| D-A6.2 (postes manuels 2033-A) | ✓ `bandeauPostesManuels` + mention "à compléter manuellement" |
| D-A6.3 (2033-B cœur) | ✓ FC/FK/FX/FY/FZ/GA + filtre strict charges (anti-pattern §3) |
| D-A6.4 (2033-C+D) | Partiel : KE et WG/WH/WI live ; historique KA/KB/KD/KF = Plan 03 |
| D-T6.1 (drill-down) | Reporté Plan 03 |
| D-T6.2 (granularité par case) | Reporté Plan 03 |
| D-T6.3 (read-model agrégation sources vivantes) | Reporté Plan 03 |
| D-T6.4 (snapshot fait foi) | ✓ `resoudreValeurCase` lit uniquement le snapshot |

## Self-Check: PASSED

Fichiers attendus présents :
- ✓ src/domain/fiscalite/liasse/mapping-liasse-2026.ts
- ✓ src/domain/fiscalite/liasse/mapping-liasse-provider.ts
- ✓ src/domain/fiscalite/liasse/case-liasse.ts
- ✓ src/domain/fiscalite/liasse/brouillon-liasse-builder.ts
- ✓ src/application/fiscalite/generer-brouillon-liasse.ts
- ✓ src/web/routes/fiscalite/liasse.ts
- ✓ src/web/views/pages/fiscalite/brouillon-liasse.ejs
- ✓ src/web/views/partials/partial-bandeau-brouillon-liasse.ejs
- ✓ src/web/views/partials/partial-tableau-liasse-section.ejs
- ✓ src/web/helpers/formater-case-liasse.ts
- ✓ tests/_fakes/mapping-liasse-provider-fake.ts
- ✓ tests/bdd/features/mapping-liasse-versionne.feature
- ✓ tests/bdd/features/brouillon-liasse-reel.feature
- ✓ tests/bdd/step_definitions/brouillon-liasse.steps.ts
- ✓ tests/unit/fiscalite/mapping-liasse-provider.test.ts
- ✓ tests/unit/fiscalite/generer-brouillon-liasse.test.ts
- ✓ tests/unit/helpers/formater-case-liasse.test.ts
- ✓ tests/integration/web/route-liasse.test.ts

Commits attendus présents (`git log --oneline | grep 06-01`):
- ✓ 68a79c8 test(06-01) RED Task 1
- ✓ fca8fda feat(06-01) GREEN Task 1
- ✓ 14dda49 test(06-01) RED Task 2
- ✓ 9e3760e feat(06-01) GREEN Task 2
- ✓ cf07009 feat(06-01) Task 3.1 route+vue+partials+helper+tests
- ✓ 170c143 feat(06-01) Task 3.2 DI + bloc S11
