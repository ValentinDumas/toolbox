---
phase: 05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement
plan: 11
type: execute
wave: 1
depends_on: []
files_modified:
  - src/domain/fiscalite/recap-fiscal-builder.ts
  - src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts
  - src/application/fiscalite/exporter-pdf-recap.ts
  - src/main.ts
  - src/web/routes/fiscalite/exports.ts
  - tests/integration/fiscalite/exporter-pdf-recap.test.ts
autonomous: true
gap_closure: true
requirements:
  - FIS-04
tags:
  - fiscalite
  - hexagonal
  - port-adapter
  - ddd
  - pdf

must_haves:
  truths:
    - "La couche application (src/application/fiscalite/exporter-pdf-recap.ts) ne contient AUCUN import depuis src/infrastructure/ — la regle non-negociable hexagonale CLAUDE.md est respectee (CR-06 ferme)"
    - "L'interface RecapFiscalBuilder vit dans src/domain/fiscalite/ et est consommee par injection dans exporterPdfRecap"
    - "L'adapter RecapFiscalBuilderPdfmake vit dans src/infrastructure/pdf/ et implemente RecapFiscalBuilder en wrappant construireRecapFiscal"
    - "Le DI dans main.ts instancie RecapFiscalBuilderPdfmake et l'injecte aux routes fiscalite/exports"
    - "Le test d'integration exporter-pdf-recap.test.ts passe le port via deps, generant toujours un PDF valide (magic bytes %PDF, taille > 1000 octets, nom recap-fiscal-{exercice}.pdf)"
    - "La signature `construire(decl, bailleur, biens, tableauxAmort): unknown` du port mirroir le pattern PdfRenderer.genererBuffer(docDef: unknown) — domaine pur, pas de fuite TDocumentDefinitions"
  artifacts:
    - path: "src/domain/fiscalite/recap-fiscal-builder.ts"
      provides: "Interface port RecapFiscalBuilder cote domaine (jamais d'import infra)"
      contains: "export interface RecapFiscalBuilder"
    - path: "src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts"
      provides: "Adapter pdfmake qui wrap construireRecapFiscal et implemente RecapFiscalBuilder"
      contains: "implements RecapFiscalBuilder"
    - path: "src/application/fiscalite/exporter-pdf-recap.ts"
      provides: "Use case exporter PDF utilisant le port RecapFiscalBuilder injecte (aucun import infra)"
      contains: "RecapFiscalBuilder"
      forbids: "from '../../infrastructure"
    - path: "src/main.ts"
      provides: "DI : instanciation de RecapFiscalBuilderPdfmake + injection dans registerFiscaliteExportsRoutes"
      contains: "RecapFiscalBuilderPdfmake"
    - path: "src/web/routes/fiscalite/exports.ts"
      provides: "Route Fastify recoit recapFiscalBuilder dans ExportsDeps et le propage a exporterPdfRecap"
      contains: "recapFiscalBuilder"
    - path: "tests/integration/fiscalite/exporter-pdf-recap.test.ts"
      provides: "Test integration injecte RecapFiscalBuilderPdfmake dans deps"
      contains: "RecapFiscalBuilderPdfmake"
  key_links:
    - from: "src/application/fiscalite/exporter-pdf-recap.ts"
      to: "src/domain/fiscalite/recap-fiscal-builder.ts"
      via: "import type { RecapFiscalBuilder } from '../../domain/fiscalite/recap-fiscal-builder.js'"
      pattern: "from '../../domain/fiscalite/recap-fiscal-builder"
    - from: "src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts"
      to: "src/infrastructure/pdf/recap-fiscal-doc-def.ts"
      via: "wrapper du construireRecapFiscal existant"
      pattern: "construireRecapFiscal"
    - from: "src/main.ts"
      to: "registerFiscaliteExportsRoutes"
      via: "new RecapFiscalBuilderPdfmake() injecte dans deps"
      pattern: "RecapFiscalBuilderPdfmake"
---

<objective>
Gap closure CR-06 du verifier 2026-05-21 (BLOCKER) : `src/application/fiscalite/exporter-pdf-recap.ts:26` importe directement `construireRecapFiscal` depuis `src/infrastructure/pdf/recap-fiscal-doc-def.ts`. C'est une violation directe de la regle non-negociable de CLAUDE.md ("Domaine pur : aucun import technique [...] dans le coeur du domaine — ports & adapters strict"). La couche application doit dependre d'interfaces (ports), pas d'implementations concretes infrastructure.

Fix : extraire un port `RecapFiscalBuilder` dans `src/domain/fiscalite/` (pattern miroir de `PdfRenderer` deja en place dans `src/domain/encaissements/pdf-renderer.ts` — signature `genererBuffer(docDef: unknown): Promise<Buffer>` accepte `unknown` pour eviter la fuite du type `TDocumentDefinitions` de pdfmake dans le domaine). Creer un adapter `RecapFiscalBuilderPdfmake` dans `src/infrastructure/pdf/` qui wrap `construireRecapFiscal`. Injecter via DI le port dans `exporterPdfRecap`. Mettre a jour `main.ts` + routes + tests integration.

Purpose : la regle hexagonale non-negociable CLAUDE.md (5e principe directeur, opposable via practices/DDD.md) etait FAILED dans 05-VERIFICATION.md (ligne "Regle non-negociable DDD hexagonal" - FAILED). Sans ce fix, l'objectif "100% des regles non-negociables respectees" est inatteignable, et toute future modification de la couche PDF cassera la couche application (couplage direct).

Output :
- 2 nouveaux fichiers (port domaine + adapter infrastructure).
- 1 fichier application modifie (signature deps + appel via le port).
- 2 fichiers infrastructure modifies (main.ts DI + route exports.ts propagation).
- 1 fichier test modifie (injection de l'adapter dans le call sous test).
- L'application boote (pnpm dev) sans erreur de DI. Le test integration genere toujours un PDF valide.
- AUCUN import `from '../../infrastructure/...'` ne subsiste dans `src/application/fiscalite/exporter-pdf-recap.ts`.
</objective>

<execution_context>
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/workflows/execute-plan.md
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-VERIFICATION.md
@.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-CONTEXT.md
@.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-PATTERNS.md
@CLAUDE.md
@practices/DDD.md
@practices/SOFTWARE_CRAFTSMANSHIP.md

<interfaces>
Pattern miroir cote domaine (a repliquer exactement, voir src/domain/encaissements/pdf-renderer.ts) :

L'interface PdfRenderer expose `genererBuffer(docDef: unknown): Promise<Buffer>`. Le commentaire JSDoc explique : "Le domaine reste pur : il passe un `unknown` pour eviter d'importer le type `TDocumentDefinitions` de pdfmake (package infrastructure). L'adapter infrastructure caste vers `TDocumentDefinitions` a l'entree."

Le nouveau port RecapFiscalBuilder suit le meme pattern. Sa signature : `construire(decl: DeclarationAnnuelle, bailleur: Bailleur, biens: Bien[], tableauxAmort: AmortissementExercice[]): unknown` — types d'entree sont tous des agregats/VO du domaine (DeclarationAnnuelle, Bailleur, Bien, AmortissementExercice), type de sortie `unknown` (le builder cree une TDocumentDefinitions cote infra mais le domaine ignore ce type).

Adapter pattern (a repliquer, voir src/infrastructure/pdf/pdf-renderer-pdfmake.ts) :
- Import `RecapFiscalBuilder` depuis `'../../domain/fiscalite/recap-fiscal-builder.js'`
- Import `construireRecapFiscal` depuis `'./recap-fiscal-doc-def.js'`
- Classe `RecapFiscalBuilderPdfmake implements RecapFiscalBuilder`
- Methode `construire(decl, bailleur, biens, tableauxAmort): unknown` qui delegue a `return construireRecapFiscal(decl, bailleur, biens, tableauxAmort);`

Signature `exporterPdfRecap` apres modification :
- ExporterPdfRecapDeps gagne `recapFiscalBuilder: RecapFiscalBuilder`
- L94 actuelle (`const docDef = construireRecapFiscal(decl, bailleur, biens, tableauxAmort);`) devient `const docDef = deps.recapFiscalBuilder.construire(decl, bailleur, biens, tableauxAmort);`
- L26 actuelle (`import { construireRecapFiscal } from '../../infrastructure/pdf/recap-fiscal-doc-def.js'`) est SUPPRIMEE
- Ajout d'un `import type { RecapFiscalBuilder } from '../../domain/fiscalite/recap-fiscal-builder.js'`

Signature `registerFiscaliteExportsRoutes` :
- ExportsDeps gagne `recapFiscalBuilder: RecapFiscalBuilder`
- L51 (destructuring `const { declRepo, bailleurRepo, bienRepo, tableauAmortRepo, pdfRenderer } = deps;`) devient `const { declRepo, bailleurRepo, bienRepo, tableauAmortRepo, pdfRenderer, recapFiscalBuilder } = deps;`
- L92-95 (call a exporterPdfRecap) propage le nouveau port dans deps : `{ declRepo, bailleurRepo, bienRepo, tableauAmortRepo, recapFiscalBuilder }`

DI dans main.ts :
- Au niveau du wiring (autour de L161 ou la classe `PdfRendererPdfmake` est instanciee), ajouter `const recapFiscalBuilder = new RecapFiscalBuilderPdfmake();` apres l'instanciation de pdfRenderer.
- Dans le call `await registerFiscaliteExportsRoutes(app, {...})` (autour de L404), ajouter `recapFiscalBuilder,` dans l'objet deps.

Test integration :
- L'appel actuel a `exporterPdfRecap({ declarationId: declId }, { declRepo, bailleurRepo, bienRepo, tableauAmortRepo }, pdfRenderer)` devient `exporterPdfRecap({ declarationId: declId }, { declRepo, bailleurRepo, bienRepo, tableauAmortRepo, recapFiscalBuilder: new RecapFiscalBuilderPdfmake() }, pdfRenderer)`.
- Import : `import { RecapFiscalBuilderPdfmake } from '../../../src/infrastructure/pdf/recap-fiscal-builder-pdfmake.js';`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 : Creer le port RecapFiscalBuilder + l'adapter pdfmake + mettre a jour exporterPdfRecap</name>
  <files>src/domain/fiscalite/recap-fiscal-builder.ts, src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts, src/application/fiscalite/exporter-pdf-recap.ts</files>

  <read_first>
    <file>src/domain/encaissements/pdf-renderer.ts</file>
    <file>src/infrastructure/pdf/pdf-renderer-pdfmake.ts</file>
    <file>src/application/fiscalite/exporter-pdf-recap.ts</file>
    <file>src/infrastructure/pdf/recap-fiscal-doc-def.ts</file>
    <file>src/domain/fiscalite/declaration-annuelle.ts</file>
    <file>src/domain/identite/bailleur.ts</file>
    <file>src/domain/patrimoine/bien.ts</file>
    <file>src/domain/fiscalite/amortissement-exercice.ts</file>
    <file>CLAUDE.md</file>
    <file>practices/DDD.md</file>
    <file>.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-VERIFICATION.md</file>
  </read_first>

  <behavior>
    1. Creation d'un fichier `src/domain/fiscalite/recap-fiscal-builder.ts` qui exporte une interface TypeScript `RecapFiscalBuilder` avec une seule methode `construire(decl: DeclarationAnnuelle, bailleur: Bailleur, biens: Bien[], tableauxAmort: AmortissementExercice[]): unknown`. AUCUN import depuis `src/infrastructure/`, AUCUN import du package `pdfmake`.

    2. Creation d'un fichier `src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts` qui exporte une classe `RecapFiscalBuilderPdfmake implements RecapFiscalBuilder`. Sa methode `construire(decl, bailleur, biens, tableauxAmort)` retourne `construireRecapFiscal(decl, bailleur, biens, tableauxAmort)` (delegation pure). Imports : le port depuis le domaine + `construireRecapFiscal` depuis `./recap-fiscal-doc-def.js`.

    3. Modification de `src/application/fiscalite/exporter-pdf-recap.ts` :
       - Suppression de L26 (`import { construireRecapFiscal } from '../../infrastructure/pdf/recap-fiscal-doc-def.js';`)
       - Ajout d'un `import type { RecapFiscalBuilder } from '../../domain/fiscalite/recap-fiscal-builder.js';`
       - Ajout du champ `recapFiscalBuilder: RecapFiscalBuilder;` dans `ExporterPdfRecapDeps` (apres `tableauAmortRepo`)
       - Modification du destructuring (L70) pour inclure `recapFiscalBuilder`
       - Modification de L94 : `const docDef = deps.recapFiscalBuilder.construire(decl, bailleur, biens, tableauxAmort);` au lieu de l'appel direct a `construireRecapFiscal`

    4. Apres modification : `grep -rn "from.*infrastructure" src/application/fiscalite/exporter-pdf-recap.ts` retourne 0 — la couche application n'importe plus aucun module infrastructure (le type `PdfRenderer` est deja un port du domaine, pas de souci la-dessus).
  </behavior>

  <action>
    Creer `src/domain/fiscalite/recap-fiscal-builder.ts` avec :
    - JSDoc d'entete expliquant le port (regle CLAUDE.md hexagonale, miroir de PdfRenderer).
    - `import type { DeclarationAnnuelle } from './declaration-annuelle.js';`
    - `import type { Bailleur } from '../identite/bailleur.js';`
    - `import type { Bien } from '../patrimoine/bien.js';`
    - `import type { AmortissementExercice } from './amortissement-exercice.js';`
    - `export interface RecapFiscalBuilder { construire(decl: DeclarationAnnuelle, bailleur: Bailleur, biens: Bien[], tableauxAmort: AmortissementExercice[]): unknown; }`
    - Commentaire JSDoc sur le retour `unknown` : "Le type concret est `TDocumentDefinitions` (pdfmake), volontairement masque pour preserver la purete du domaine (CLAUDE.md regle hexagonale, mirroir de PdfRenderer.genererBuffer)."

    Creer `src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts` avec :
    - JSDoc d'entete expliquant l'adapter.
    - `import type { RecapFiscalBuilder } from '../../domain/fiscalite/recap-fiscal-builder.js';`
    - `import type { DeclarationAnnuelle } from '../../domain/fiscalite/declaration-annuelle.js';`
    - `import type { Bailleur } from '../../domain/identite/bailleur.js';`
    - `import type { Bien } from '../../domain/patrimoine/bien.js';`
    - `import type { AmortissementExercice } from '../../domain/fiscalite/amortissement-exercice.js';`
    - `import { construireRecapFiscal } from './recap-fiscal-doc-def.js';`
    - `export class RecapFiscalBuilderPdfmake implements RecapFiscalBuilder { construire(decl: DeclarationAnnuelle, bailleur: Bailleur, biens: Bien[], tableauxAmort: AmortissementExercice[]): unknown { return construireRecapFiscal(decl, bailleur, biens, tableauxAmort); } }`

    Modifier `src/application/fiscalite/exporter-pdf-recap.ts` :
    - Localiser et supprimer L26 (`import { construireRecapFiscal } from '../../infrastructure/pdf/recap-fiscal-doc-def.js';`).
    - Ajouter dans la zone d'imports (apres `import type { PdfRenderer } from '../../domain/encaissements/pdf-renderer.js';`) : `import type { RecapFiscalBuilder } from '../../domain/fiscalite/recap-fiscal-builder.js';`
    - Dans `ExporterPdfRecapDeps` (L46-51), ajouter le champ `recapFiscalBuilder: RecapFiscalBuilder;` apres `tableauAmortRepo: TableauAmortissementRepository;`.
    - L70 (destructuring) : ajouter `recapFiscalBuilder` a la liste destructuree : `const { declRepo, bailleurRepo, bienRepo, tableauAmortRepo, recapFiscalBuilder } = deps;`. Si la version destructuree n'est pas conservee dans la nouvelle implementation (delegation directe via `deps.recapFiscalBuilder.construire(...)`), c'est aussi acceptable — le critere est que L94 utilise soit `recapFiscalBuilder.construire(...)` soit `deps.recapFiscalBuilder.construire(...)`.
    - L94 : remplacer `const docDef = construireRecapFiscal(decl, bailleur, biens, tableauxAmort);` par `const docDef = deps.recapFiscalBuilder.construire(decl, bailleur, biens, tableauxAmort);` (ou variante destructuree equivalente).

    NE PAS toucher au signature publique de la fonction `exporterPdfRecap` autre que l'ajout du champ deps. Le 3e parametre `pdfRenderer: PdfRenderer` reste inchange.
  </action>

  <verify>
    <automated>pnpm typecheck 2>&1 | tee /tmp/05-11-task1-tsc.log ; grep -rn "from.*infrastructure" src/application/fiscalite/exporter-pdf-recap.ts ; test -f src/domain/fiscalite/recap-fiscal-builder.ts && echo "port OK" ; test -f src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts && echo "adapter OK"</automated>
  </verify>

  <acceptance_criteria>
    - `test -f src/domain/fiscalite/recap-fiscal-builder.ts` exit code 0
    - `test -f src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts` exit code 0
    - `grep -c "export interface RecapFiscalBuilder" src/domain/fiscalite/recap-fiscal-builder.ts` retourne 1
    - `grep -c "implements RecapFiscalBuilder" src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts` retourne 1
    - `grep -c "from '../../infrastructure" src/application/fiscalite/exporter-pdf-recap.ts` retourne 0
    - `grep -c "from.*infrastructure" src/application/fiscalite/exporter-pdf-recap.ts` retourne 0
    - `grep -c "RecapFiscalBuilder" src/application/fiscalite/exporter-pdf-recap.ts` retourne >= 2 (import type + champ deps)
    - `grep -c "deps.recapFiscalBuilder.construire\|recapFiscalBuilder.construire" src/application/fiscalite/exporter-pdf-recap.ts` retourne >= 1
    - `grep -c "construireRecapFiscal" src/application/fiscalite/exporter-pdf-recap.ts` retourne 0 (plus de reference directe a la fonction infra)
    - `grep -c "from.*infrastructure\|from 'pdfmake" src/domain/fiscalite/recap-fiscal-builder.ts` retourne 0 (le port reste pur)
    - `pnpm typecheck` exit code 0 (la modification de ExporterPdfRecapDeps casse temporairement les appelants — typecheck reste 0 SEULEMENT apres Task 2 ET Task 3 ; en attendant, `pnpm typecheck` ICI peut renvoyer des erreurs sur main.ts et exports.ts qui seront resolues par les taches suivantes)
  </acceptance_criteria>

  <done>
    Le port domaine + l'adapter infra existent et compilent. exporter-pdf-recap.ts utilise le port via deps. Le grep "from .../infrastructure" dans la couche application retourne 0. Le typecheck global peut encore signaler des erreurs DI dans main.ts/exports.ts/test (a resoudre Tasks 2-3).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 : Propager le port dans la route exports + DI main.ts</name>
  <files>src/web/routes/fiscalite/exports.ts, src/main.ts</files>

  <read_first>
    <file>src/web/routes/fiscalite/exports.ts</file>
    <file>src/main.ts</file>
    <file>src/domain/fiscalite/recap-fiscal-builder.ts</file>
    <file>src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts</file>
    <file>src/application/fiscalite/exporter-pdf-recap.ts</file>
  </read_first>

  <behavior>
    1. `src/web/routes/fiscalite/exports.ts` :
       - L'interface `ExportsDeps` gagne `recapFiscalBuilder: RecapFiscalBuilder` (avec import du type depuis le domaine).
       - Le destructuring L51 inclut `recapFiscalBuilder`.
       - L'appel a `exporterPdfRecap` L91-95 propage `recapFiscalBuilder` dans l'objet deps passe en 2e parametre.

    2. `src/main.ts` :
       - L'adapter `RecapFiscalBuilderPdfmake` est importe.
       - Une instance `const recapFiscalBuilder = new RecapFiscalBuilderPdfmake();` est creee dans la zone wiring (apres `const pdfRenderer = new PdfRendererPdfmake();` L161).
       - L'appel `await registerFiscaliteExportsRoutes(app, {...})` (autour de L404) inclut `recapFiscalBuilder` dans l'objet deps.

    3. Aucune regression de typecheck. L'app boote `pnpm dev` sans erreur de DI (acceptable de ne pas tester `pnpm dev` en CI — `pnpm typecheck` + tests integration sont suffisants).
  </behavior>

  <action>
    Dans `src/web/routes/fiscalite/exports.ts` :
    - Ajouter dans la zone d'imports (apres `import type { PdfRenderer } from '../../../domain/encaissements/pdf-renderer.js';` L18) : `import type { RecapFiscalBuilder } from '../../../domain/fiscalite/recap-fiscal-builder.js';`
    - Dans l'interface `ExportsDeps` (L30-36), ajouter le champ `recapFiscalBuilder: RecapFiscalBuilder;` apres `pdfRenderer: PdfRenderer;`.
    - L51 : ajouter `recapFiscalBuilder` dans le destructuring : `const { declRepo, bailleurRepo, bienRepo, tableauAmortRepo, pdfRenderer, recapFiscalBuilder } = deps;`.
    - L91-95 (call a exporterPdfRecap) : ajouter `recapFiscalBuilder` dans l'objet passe en 2e parametre : `{ declRepo, bailleurRepo, bienRepo, tableauAmortRepo, recapFiscalBuilder }`. Le 3e parametre `pdfRenderer` reste inchange.

    Dans `src/main.ts` :
    - Ajouter dans la zone d'imports (a cote de l'import de `PdfRendererPdfmake`) : `import { RecapFiscalBuilderPdfmake } from './infrastructure/pdf/recap-fiscal-builder-pdfmake.js';` (utiliser le chemin relatif coherent avec les autres imports).
    - Apres L161 (`const pdfRenderer = new PdfRendererPdfmake();`) ajouter : `const recapFiscalBuilder = new RecapFiscalBuilderPdfmake();`.
    - Dans le call `await registerFiscaliteExportsRoutes(app, {...})` (autour de L404, l'objet deps liste actuellement declRepo, bailleurRepo, bienRepo, tableauAmortRepo, pdfRenderer) : ajouter `recapFiscalBuilder,` apres `pdfRenderer,` (cle/valeur shorthand : la variable a le meme nom que la cle de l'interface).

    NE PAS modifier les autres appels (encaissements, indexations, etc.) qui n'utilisent pas le port RecapFiscalBuilder. NE PAS modifier la signature publique de `registerFiscaliteExportsRoutes` autre que l'ajout du champ deps.
  </action>

  <verify>
    <automated>pnpm typecheck 2>&1 | tee /tmp/05-11-task2-tsc.log ; grep -c "RecapFiscalBuilderPdfmake" src/main.ts ; grep -c "recapFiscalBuilder" src/web/routes/fiscalite/exports.ts</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "RecapFiscalBuilderPdfmake" src/main.ts` retourne >= 2 (import + new)
    - `grep -c "recapFiscalBuilder" src/main.ts` retourne >= 2 (var + passage dans deps)
    - `grep -c "import.*RecapFiscalBuilder" src/web/routes/fiscalite/exports.ts` retourne >= 1
    - `grep -c "recapFiscalBuilder" src/web/routes/fiscalite/exports.ts` retourne >= 3 (interface + destructuring + propagation)
    - `pnpm typecheck` exit code 0 (la chaine DI complete est maintenant coherente entre Task 1 modifs + Task 2 modifs)
  </acceptance_criteria>

  <done>
    Le port est cable de bout en bout dans la DI : main.ts instancie l'adapter, la route le destructure et le propage. `pnpm typecheck` passe a 0 erreur.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3 : Mettre a jour le test integration exporter-pdf-recap + verifier la suite complete</name>
  <files>tests/integration/fiscalite/exporter-pdf-recap.test.ts</files>

  <read_first>
    <file>tests/integration/fiscalite/exporter-pdf-recap.test.ts</file>
    <file>src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts</file>
    <file>src/application/fiscalite/exporter-pdf-recap.ts</file>
  </read_first>

  <behavior>
    - L'appel a `exporterPdfRecap` dans le test integre inclut le port `recapFiscalBuilder: new RecapFiscalBuilderPdfmake()` dans deps.
    - Le test passe en GREEN : magic bytes %PDF, taille > 1000 octets, nom de fichier `recap-fiscal-${EXERCICE}.pdf`.
    - La suite complete reste verte (`pnpm test -- --run` exit 0).
    - Aucun autre test n'utilise `exporter-pdf-recap` directement (verifier en grep, sinon les mettre a jour de la meme facon).
  </behavior>

  <action>
    Dans `tests/integration/fiscalite/exporter-pdf-recap.test.ts` :
    - Ajouter l'import : `import { RecapFiscalBuilderPdfmake } from '../../../src/infrastructure/pdf/recap-fiscal-builder-pdfmake.js';` (apres les autres imports `PdfRendererPdfmake` etc.).
    - Dans le `it(...)` L104, instancier l'adapter : `const recapFiscalBuilder = new RecapFiscalBuilderPdfmake();` (a cote de `const pdfRenderer = new PdfRendererPdfmake();`).
    - L111-115 (call a exporterPdfRecap) : ajouter `recapFiscalBuilder` dans l'objet deps : `{ declRepo, bailleurRepo, bienRepo, tableauAmortRepo, recapFiscalBuilder }`. Le 3e parametre `pdfRenderer` reste inchange.

    Avant de cloturer la tache, verifier qu'aucun autre fichier de test n'instancie `exporterPdfRecap` via `grep -rn "exporterPdfRecap" tests/ --include="*.ts" --include="*.tsx"`. Si d'autres tests le font, propager le meme fix (ajout de `recapFiscalBuilder` dans deps).

    Verification finale apres modifs :
    1. `pnpm typecheck` → exit 0
    2. `pnpm test tests/integration/fiscalite/exporter-pdf-recap.test.ts -- --run` → exit 0
    3. `pnpm test -- --run` → exit 0 (suite complete, 888+ tests verts)
    4. `grep -rn "from.*infrastructure" src/application/fiscalite/` → uniquement les imports type-only `Kysely<DB>` qui sont annotes "acceptable" dans 05-VERIFICATION.md L32 (cloturer-exercice.ts, activer-fiscalite-bien.ts, creer-declaration-corrigee.ts). Le grep ne doit PAS faire apparaitre `from '../../infrastructure/pdf/recap-fiscal-doc-def'`.
  </action>

  <verify>
    <automated>pnpm typecheck 2>&1 | tee /tmp/05-11-task3-tsc.log ; pnpm test tests/integration/fiscalite/exporter-pdf-recap.test.ts -- --run 2>&1 | tee /tmp/05-11-task3-itest.log ; pnpm test -- --run 2>&1 | tail -40 | tee /tmp/05-11-task3-all.log ; grep -rn "from.*infrastructure" src/application/fiscalite/exporter-pdf-recap.ts</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "RecapFiscalBuilderPdfmake" tests/integration/fiscalite/exporter-pdf-recap.test.ts` retourne >= 2 (import + instance)
    - `grep -rn "from.*infrastructure" src/application/fiscalite/exporter-pdf-recap.ts` retourne 0 lignes
    - `grep -rn "from.*infrastructure/pdf/recap-fiscal-doc-def" src/application src/domain` retourne 0 lignes (aucun module application ou domain n'importe plus la fonction infra directement)
    - `pnpm typecheck` exit code 0
    - `pnpm test tests/integration/fiscalite/exporter-pdf-recap.test.ts -- --run` exit code 0
    - `pnpm test -- --run` exit code 0 (suite complete verte, 888+ tests)
    - Le buffer PDF retourne par le test commence par `%PDF` et fait > 1000 octets (assertions deja en place L118-120)
    - Le nom du fichier retourne est `recap-fiscal-2026.pdf` (assertion L122)
  </acceptance_criteria>

  <done>
    Le test integration injecte l'adapter pdfmake via le port. Le PDF est toujours genere correctement. La suite complete est verte. Aucun module application n'importe plus de module infrastructure pdf concret. La regle hexagonale non-negociable CLAUDE.md est respectee.
  </done>
</task>

</tasks>

<verification>
1. Existence des nouveaux fichiers :
   ```
   test -f src/domain/fiscalite/recap-fiscal-builder.ts
   test -f src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts
   # attendu : exit 0 pour les deux
   ```

2. Disparition de la violation hexagonale :
   ```
   grep -rn "from.*infrastructure/pdf/recap-fiscal-doc-def" src/application src/domain
   # attendu : 0 resultat
   grep -rn "from.*infrastructure" src/application/fiscalite/exporter-pdf-recap.ts
   # attendu : 0 resultat (le PdfRenderer est un port domaine, pas un import infra)
   ```

3. Le port reste pur (aucune fuite pdfmake dans le domaine) :
   ```
   grep -rn "from 'pdfmake\|from \"pdfmake\|from.*infrastructure" src/domain/fiscalite/recap-fiscal-builder.ts
   # attendu : 0 resultat
   ```

4. DI complete dans main.ts :
   ```
   grep -n "RecapFiscalBuilderPdfmake" src/main.ts
   # attendu : >= 2 lignes (import + instance)
   ```

5. Suite complete + typecheck :
   ```
   pnpm typecheck
   pnpm test -- --run
   # attendu : exit 0 pour les deux
   ```

6. Test integration exporter-pdf-recap PASSED :
   ```
   pnpm test tests/integration/fiscalite/exporter-pdf-recap.test.ts -- --run
   # attendu : exit 0, PDF buffer valide
   ```

7. Re-verification du gap CR-06 dans 05-VERIFICATION.md :
   - Le gap "La couche application ne depend d'aucune implementation infrastructure concrete" doit pouvoir basculer de `failed` a `verified` quand le verifier sera relance.
</verification>

<success_criteria>
- CR-06 du verifier (05-VERIFICATION.md, gap 3) ferme : la couche application n'importe plus d'implementation concrete infrastructure pour le builder PDF recap.
- Regle non-negociable CLAUDE.md (Ports & Adapters strict) respectee : un nouveau port `RecapFiscalBuilder` vit dans le domaine, un adapter `RecapFiscalBuilderPdfmake` vit dans l'infrastructure, et le use case `exporterPdfRecap` recoit le port via DI.
- Pattern miroir de `PdfRenderer` (deja en place dans le projet) : type `unknown` en retour de `construire` pour ne pas faire fuiter `TDocumentDefinitions` (pdfmake) dans le domaine.
- DI complete dans main.ts (instanciation + injection dans `registerFiscaliteExportsRoutes`).
- Route Fastify `exports.ts` propage le port.
- Test integration `exporter-pdf-recap.test.ts` mis a jour pour injecter l'adapter, PDF toujours valide.
- Suite complete verte (`pnpm test -- --run` exit 0). Typecheck propre (`pnpm typecheck` exit 0).
- Aucune autre signature publique modifiee.
</success_criteria>

<output>
Apres completion, creer `.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-11-gap-recap-fiscal-port-hexa-SUMMARY.md` listant :
1. Diff du nouveau port `src/domain/fiscalite/recap-fiscal-builder.ts` (signature complete + JSDoc).
2. Diff du nouvel adapter `src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts`.
3. Diff de `exporter-pdf-recap.ts` (suppression import infra + ajout port + appel via deps).
4. Diff de `main.ts` (import + instance + injection).
5. Diff de `exports.ts` (interface + destructuring + propagation).
6. Diff de `exporter-pdf-recap.test.ts` (import + instance + injection).
7. Resultat de pnpm typecheck + pnpm test.
8. Statut attendu du verifier sur le gap 3 (CR-06).
</output>
