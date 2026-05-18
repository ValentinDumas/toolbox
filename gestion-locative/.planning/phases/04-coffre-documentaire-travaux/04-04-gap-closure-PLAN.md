---
phase: 04-coffre-documentaire-travaux
plan: 04
plan_id: "04-04"
type: execute
wave: 4
status: planned
gap_closure: true
source_verification: 04-VERIFICATION.md
created: 2026-05-18
depends_on: ["04-01", "04-02", "04-03"]
files_modified:
  # Domain
  - src/domain/_shared/slug.ts
  - src/domain/documents/erreurs.ts
  # Application
  - src/application/travaux/lire-ticket.ts
  - src/application/documents/uploader-justificatif.ts
  - src/application/documents/valider-magic-bytes.ts
  # Infrastructure
  - src/infrastructure/db/database.ts
  - src/infrastructure/storage/stockage-justificatifs-local.ts
  # Web
  - src/web/helpers/content-disposition.ts
  - src/web/routes/coffre.ts
  # Config
  - .dependency-cruiser.cjs
  # Tests — T1 (PRAGMA + sentinel + setup propagation)
  - tests/integration/db/foreign-keys-sentinel.test.ts
  - tests/_world/monde-phase2.ts
  - tests/_world/monde-phase3.ts
  - tests/_world/monde-phase4.ts
  - tests/integration/repositories/ticket-travaux-repository-sqlite.test.ts
  - tests/integration/repositories/justificatif-repository-sqlite.test.ts
  - tests/integration/repositories/bien-repository-sqlite-diagnostics.test.ts
  - tests/integration/repositories/bail-repository-sqlite.test.ts
  - tests/integration/repositories/bail-repository-sqlite-mobilier.test.ts
  - tests/integration/repositories/bail-indexation-repository-sqlite.test.ts
  - tests/integration/web/relances-mailto.test.ts
  - tests/integration/web/snapshots-phase3.test.ts
  - tests/integration/web/accessibility-phase3.test.ts
  - tests/integration/wizard/wizard-validation-erreurs.test.ts
  - tests/integration/wizard/wizard-skippable.test.ts
  - tests/integration/lifecycle/premier-lancement.test.ts
  - tests/unit/locatif/appliquer-indexation-irl.test.ts
  - tests/unit/locatif/renoncer-indexation-irl.test.ts
  - tests/unit/documents/use-cases.test.ts
  - tests/unit/documents/purger-justificatif.test.ts
  # Tests — T2 (corbeilleLe filter)
  - tests/bdd/features/travaux.feature
  - tests/unit/travaux/use-cases.test.ts
  # Tests — T3 (slug)
  - tests/unit/_shared/slug.test.ts
  # Tests — T4 (RFC 6266 + path-traversal defense)
  - tests/unit/_shared/content-disposition.test.ts
  - tests/integration/storage/stockage-justificatifs-local.test.ts
  # Tests — T5 (magic-bytes WebP/HEIC sub-format)
  - tests/unit/documents/valider-magic-bytes.test.ts
autonomous: true
requirements: [DOC-01, DOC-03, INC-01]
user_setup: []
tags: [phase-4, gap-closure, security-hardening, ddd-purity, defense-in-depth]

closes_gaps:
  - id: "CR-01"
    severity: blocker
    description: "PRAGMA foreign_keys = ON jamais exécuté → cascade D-113 silencieusement désactivée en prod"
  - id: "CR-03"
    severity: blocker
    description: "lire-ticket.ts:50 n'exclut pas les Justificatifs en corbeille → fiche ticket affiche des PJ soft-deleted"
  - id: "CR-06"
    severity: blocker
    description: "uploader-justificatif.ts importe StockageJustificatifsLocal (infra) → viole DDD pureté, depcruise myope"
  - id: "CR-04+CR-05"
    severity: partial
    description: "StockageJustificatifsLocal.ecrire() sans validation défensive slug/ext + Content-Disposition sans RFC 6266"
  - id: "CR-08"
    severity: partial
    description: "Magic-bytes : WebP sous-format VP8/VP8L/VP8X et HEIC box_size non vérifiés"

must_haves:
  truths:
    - "CR-01 closed : `ouvrirDb()` appelle `sqlite.pragma('foreign_keys = ON')` ; une nouvelle helper `activerPragmas(sqlite)` est exportée et utilisée dans tous les tests qui ouvrent `new Database(':memory:')` directement (~17 fichiers identifiés). Le test sentinel `foreign-keys-sentinel.test.ts` ouvre une connexion via `ouvrirDb` et assert `sqlite.pragma('foreign_keys', { simple: true })` retourne `1`. La ligne 271 de `ticket-travaux-repository-sqlite.test.ts` (activation manuelle) est SUPPRIMÉE — la cascade hérite désormais de la setup."
    - "CR-03 closed : `lire-ticket.ts` boucle sur les IDs liés via le pivot N:N et exclut les Justificatifs avec `corbeilleLe !== null`. Un Justificatif soft-deleted N'apparaît PLUS dans `LireTicketResultat.justificatifs`. Un nouveau scénario BDD `@gap-04 @inc-01` et un nouveau test unitaire couvrent ce cas."
    - "CR-06 closed : la fonction `slugify` vit dans `src/domain/_shared/slug.ts` (pure, sans dépendance infra). `StockageJustificatifsLocal.slugify` est SUPPRIMÉE (plus aucun appelant). `uploader-justificatif.ts` n'importe plus `StockageJustificatifsLocal`. La règle dependency-cruiser `no-application-to-infra` (severity: error) est active et passe à 0 violation."
    - "CR-04+CR-05 closed : `StockageJustificatifsLocal.ecrire()` re-valide défensivement `slug` (`^[a-z0-9-]{1,80}$`), `ext` (`^[a-z0-9]{1,5}$`), `annee` (entier 1900–2200) AVANT path.join et assert `cheminAbsolu.startsWith(baseDirResolu + path.sep)` AVANT writeFile (parité avec `lire()`). L'erreur de domaine `CheminInvalide` est levée si la validation échoue. Le helper `encodeFilenameRFC6266()` (NEW `src/web/helpers/content-disposition.ts`) génère un header conforme à RFC 6266 (`filename=\"ASCII\"; filename*=UTF-8''percent-encoded`). `coffre.ts:409-410` utilise ce helper sur `Content-Disposition` au lieu d'interpoler `nomFichierOriginal` brut."
    - "CR-08 closed : `valider-magic-bytes.ts` étend la branche WebP pour vérifier que les bytes 12-15 sont ∈ {`VP8 ` (avec espace), `VP8L`, `VP8X`}. La branche HEIC vérifie que `bytes.readUInt32BE(0)` (box_size) est `>= 16 && <= bytes.length`. Un fichier `RIFF....WEBP` suivi d'un payload arbitraire est désormais rejeté avec `{ ok: false, raison: 'mismatch' }`. Idem un HEIC avec box_size frauduleux."
    - "Pas de régression : 573 tests vitest existants + 111 scénarios BDD existants restent VERTS. Tous les compteurs nouveaux sont additifs : +1 sentinel test (T1) + 1 unit lire-ticket (T2) + 1 BDD travaux (T2) + ~5 unit slug (T3) + ~6 unit content-disposition (T4) + 3 integration storage (T4) + ~6 unit valider-magic-bytes (T5) = total ~22 nouveaux tests. `pnpm typecheck` exit 0, `pnpm depcruise src` exit 0 avec la nouvelle règle."
  artifacts:
    - path: "src/infrastructure/db/database.ts"
      provides: "Helper `activerPragmas(sqlite)` exporté + appel intégré dans `ouvrirDb()` (CR-01)"
      contains: "sqlite.pragma('foreign_keys = ON')"
    - path: "tests/integration/db/foreign-keys-sentinel.test.ts"
      provides: "Test sentinel `pragma_foreign_keys` (CR-01)"
      contains: "foreign_keys"
    - path: "src/application/travaux/lire-ticket.ts"
      provides: "Filtre `corbeilleLe === null` ligne 50 (CR-03)"
      contains: "corbeilleLe === null"
    - path: "src/domain/_shared/slug.ts"
      provides: "Fonction pure `slugify` (CR-06)"
      contains: "export function slugify"
    - path: "src/domain/documents/erreurs.ts"
      provides: "Classe `CheminInvalide` (CR-04)"
      contains: "class CheminInvalide"
    - path: "src/web/helpers/content-disposition.ts"
      provides: "Helper RFC 6266 (CR-05)"
      contains: "encodeFilenameRFC6266"
    - path: ".dependency-cruiser.cjs"
      provides: "Règle `no-application-to-infra` severity:error (CR-06)"
      contains: "no-application-to-infra"
  key_links:
    - from: "src/infrastructure/db/database.ts"
      to: "activerPragmas + sqlite.pragma('foreign_keys = ON')"
      via: "ouvrirDb() appelle activerPragmas après new BetterSqlite3()"
      pattern: "activerPragmas"
    - from: "src/application/documents/uploader-justificatif.ts"
      to: "src/domain/_shared/slug.ts"
      via: "import { slugify } — remplace l'import infra StockageJustificatifsLocal"
      pattern: "from '../../domain/_shared/slug"
    - from: "src/application/travaux/lire-ticket.ts"
      to: "Justificatif.corbeilleLe"
      via: "filtre `j && j.corbeilleLe === null` dans la boucle d'hydratation"
      pattern: "corbeilleLe === null"
    - from: "src/infrastructure/storage/stockage-justificatifs-local.ts"
      to: "CheminInvalide (domain error)"
      via: "throw new CheminInvalide() si slug/ext/annee invalides ou si cheminAbsolu sort de baseDir"
      pattern: "CheminInvalide"
    - from: "src/web/routes/coffre.ts"
      to: "src/web/helpers/content-disposition.ts"
      via: "encodeFilenameRFC6266(j.nomFichierOriginal) sur le header Content-Disposition"
      pattern: "encodeFilenameRFC6266"
    - from: ".dependency-cruiser.cjs"
      to: "src/application/* → src/infrastructure/*"
      via: "Règle forbidden `no-application-to-infra` severity:error"
      pattern: "no-application-to-infra"
---

# Phase 04 — Plan 04 : Gap Closure (defense-in-depth + DDD purity)

Ce plan ferme 5 gaps identifiés par `04-VERIFICATION.md` (3 blockers + 2 partials) qui compromettent les invariants D-109 (rétention 10 ans), D-113 (cascade asymétrique pivot N:N) et la pureté DDD revendiquée par `CLAUDE.md`. Les 4 success criteria du ROADMAP restent observables — ce plan renforce la défense en profondeur sans changer le comportement utilisateur.

**Source des spécifications :** `04-VERIFICATION.md` frontmatter `gaps:` (5 entrées avec `missing:` arrays verbatim).

**Hors périmètre :** WR-02 (compensation soft-delete sur échec disque — devrait hard-delete) et WR-06 (substr index break) sont reportés en `RISKS.md` après ce plan.

## Goal-Backward

Si tous les `must_haves.truths` sont vrais après exécution, alors :
- La cascade D-113 fonctionne en prod (cohérence référentielle SQL effective).
- La rétention 10 ans D-109 a sa défense en profondeur SQL active.
- Aucune classe infra n'est importée depuis `application/` ni `domain/`.
- Les fichiers uploadés ne peuvent plus contenir de payload binaire arbitraire derrière un magic-bytes RIFF/ftyp.
- Le header Content-Disposition est conforme RFC 6266 (UX correcte sur noms français, sécurité contre header injection).
- La défense en profondeur path-traversal côté `ecrire()` rend l'adapter sûr indépendamment des appelants futurs.

## Threat Model (inherited from Phase 4 + new fixes)

| ID | Surface | Threat | Mitigation in this plan |
|---|---|---|---|
| TM-04-A | DB | Op admin DELETE direct sur `tickets_travaux` (D-113 cascade silencieusement skipped) | T1 — PRAGMA foreign_keys = ON par connexion + sentinel test |
| TM-04-B | UI ticket | Lien `/justificatifs/:id` pointant vers PJ en corbeille → 410 silencieux | T2 — filtre corbeilleLe dans lire-ticket |
| TM-04-C | Architecture | Swap d'adapter `StockageJustificatifs` (S3, mémoire) requiert de reimplementer slugify partout | T3 — slugify dans domain/_shared, port reste pur |
| TM-04-D | Upload | Path-traversal via slug malformé (futur use case bypass slugify) | T4 — validation défensive dans ecrire() + check startsWith baseDir |
| TM-04-E | Download | Header injection / UX cassée sur noms non-ASCII | T4 — RFC 6266 encoding |
| TM-04-F | Upload | Fichier RIFF...WEBP+payload arbitraire passe la validation magic-bytes | T5 — vérification sous-format WebP + HEIC box_size |

<tasks>

<task type="auto">
  <name>Task 1 — CR-01 : Activer PRAGMA foreign_keys = ON par connexion + sentinel + propagation tests</name>
  <read_first>
    - src/infrastructure/db/database.ts (ouvrirDb actuel — 17 lignes)
    - tests/integration/repositories/ticket-travaux-repository-sqlite.test.ts (lignes 60-72 setup beforeEach + ligne 271 activation manuelle à retirer)
    - tests/integration/repositories/justificatif-repository-sqlite.test.ts (setup beforeEach)
    - tests/integration/repositories/bien-repository-sqlite-diagnostics.test.ts (setup)
    - tests/integration/repositories/bail-repository-sqlite.test.ts (setup)
    - tests/integration/repositories/bail-repository-sqlite-mobilier.test.ts (setup)
    - tests/integration/repositories/bail-indexation-repository-sqlite.test.ts (setup)
    - tests/integration/web/relances-mailto.test.ts (setup)
    - tests/integration/web/snapshots-phase3.test.ts (setup)
    - tests/integration/web/accessibility-phase3.test.ts (setup)
    - tests/integration/wizard/wizard-validation-erreurs.test.ts (setup)
    - tests/integration/wizard/wizard-skippable.test.ts (setup)
    - tests/integration/lifecycle/premier-lancement.test.ts (setup)
    - tests/unit/locatif/appliquer-indexation-irl.test.ts (setup)
    - tests/unit/locatif/renoncer-indexation-irl.test.ts (setup)
    - tests/unit/documents/use-cases.test.ts (setup)
    - tests/unit/documents/purger-justificatif.test.ts (setup)
    - tests/_world/monde-phase2.ts (BDD world setup)
    - tests/_world/monde-phase3.ts (BDD world setup)
    - tests/_world/monde-phase4.ts (BDD world setup)
    - .planning/phases/04-coffre-documentaire-travaux/04-VERIFICATION.md (gap "Le système empêche toute suppression avant 10 ans (SC-3)")
    - migrations/0001_init.sql (FK references déclarées — pour comprendre quel CASCADE est activé)
    - migrations/0010_phase4_documents_travaux.sql (CASCADE D-113 ticket_justificatifs)
  </read_first>
  <behavior>
    **Avant le fix :** `sqlite.pragma('foreign_keys', { simple: true })` retourne `0` (default SQLite). Une `DELETE FROM tickets_travaux WHERE id = ?` ne supprime PAS les rows correspondantes de `ticket_justificatifs` malgré le `ON DELETE CASCADE` déclaré dans la migration 0010. Tous les tests existants qui le démontrent passent uniquement parce que les FK ne sont pas vérifiées du tout (insertions de Justificatif avec bien_id orphelin acceptées en silence).

    **Après le fix :** chaque connexion SQLite ouverte via `ouvrirDb()` ou via le helper `activerPragmas(sqlite)` retourne `1` sur le PRAGMA. La cascade D-113 fonctionne. Le test cascade existant (lignes 273-287 de ticket-travaux-repository-sqlite.test.ts) continue de passer SANS l'activation manuelle ligne 271 — il hérite désormais du PRAGMA via le beforeEach.

    **Pourquoi PAS de migration :** `PRAGMA foreign_keys` est une directive **per-connection** en SQLite (docs SQLite). Une migration ne peut pas la persister pour les connexions futures. La seule façon correcte est de la définir à chaque ouverture de connexion — d'où le helper dans `database.ts`.

    **Test sentinel :** prouve que `ouvrirDb()` active bien le PRAGMA. Sans ce test, une régression silencieuse (suppression du helper) serait invisible.
  </behavior>
  <action>
    **Étape 1 — Modifier `src/infrastructure/db/database.ts`**

    Ajouter une fonction exportée `activerPragmas`. La doc-comment doit expliquer pourquoi un helper et pas une migration. Modifier `ouvrirDb()` pour l'appeler après `new BetterSqlite3(...)`.

    Structure cible (ne pas dupliquer la logique — `ouvrirDb` appelle `activerPragmas`) :
    ```ts
    /**
     * Active les PRAGMAs SQLite requis par l'application.
     *
     * `foreign_keys = ON` doit être appelé PAR CONNEXION — c'est un setting
     * per-connection en SQLite (cf. https://www.sqlite.org/foreignkeys.html#fk_enable).
     * Une migration ne peut PAS le persister pour les connexions futures.
     *
     * Conséquence : tout code qui ouvre une connexion SQLite (`new BetterSqlite3(...)`)
     * sans passer par `ouvrirDb` DOIT appeler `activerPragmas` explicitement, sous
     * peine de désactiver silencieusement la cascade D-113 et tous les CHECK FK.
     */
    export function activerPragmas(sqlite: BetterSqlite3.Database): void {
      sqlite.pragma('foreign_keys = ON');
    }
    ```

    Modifier `ouvrirDb(cheminFichier)` : juste après `const sqlite = new BetterSqlite3(cheminFichier);`, insérer `activerPragmas(sqlite);`.

    **Étape 2 — Créer `tests/integration/db/foreign-keys-sentinel.test.ts`**

    ```ts
    import { describe, it, expect, afterEach } from 'vitest';
    import { ouvrirDb } from '../../../src/infrastructure/db/database.js';
    import fs from 'node:fs';
    import os from 'node:os';
    import path from 'node:path';

    describe('PRAGMA foreign_keys sentinel (CR-01)', () => {
      let tmpFile: string | null = null;

      afterEach(() => {
        if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        tmpFile = null;
      });

      it("ouvrirDb active PRAGMA foreign_keys = ON sur la connexion ouverte", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gl-fk-sentinel-'));
        tmpFile = path.join(dir, 'db.sqlite');
        const { sqlite } = ouvrirDb(tmpFile);
        const value = sqlite.pragma('foreign_keys', { simple: true });
        expect(value).toBe(1);
        sqlite.close();
      });
    });
    ```

    **Étape 3 — Propagation aux tests qui ouvrent SQLite directement**

    Pour CHAQUE fichier dans `<read_first>` qui contient `new Database(':memory:')` ou `new BetterSqlite3(':memory:')` (~17 fichiers), ajouter juste après la création :
    ```ts
    import { activerPragmas } from '../../../src/infrastructure/db/database.js';
    // ...
    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    ```

    Ajuster les chemins d'import relatifs selon la profondeur (e.g. `../../../src/...` depuis `tests/integration/repositories/`, `../../src/...` depuis `tests/_world/`).

    **Étape 4 — Supprimer l'activation manuelle ligne 271 de `ticket-travaux-repository-sqlite.test.ts`**

    Retirer ces lignes :
    ```ts
    // SQLite ne déclenche pas FK CASCADE sans PRAGMA foreign_keys=ON.
    // On l'active explicitement pour ce test (cohérent avec la décision D-113
    // qui repose sur ON DELETE CASCADE côté SQL).
    sqlite.prepare('PRAGMA foreign_keys = ON').run();
    ```
    Le test cascade hérite désormais du PRAGMA via le beforeEach modifié à l'étape 3.

    **Étape 5 — Commit**
    Message : `fix(04-04): CR-01 activer PRAGMA foreign_keys = ON par connexion + sentinel`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm test -- tests/integration/db/foreign-keys-sentinel.test.ts tests/integration/repositories/ticket-travaux-repository-sqlite.test.ts && grep -c "sqlite.pragma('foreign_keys = ON')" src/infrastructure/db/database.ts && grep -c "PRAGMA foreign_keys = ON" tests/integration/repositories/ticket-travaux-repository-sqlite.test.ts</automated>
  </verify>
  <done>
    - `src/infrastructure/db/database.ts` : `activerPragmas` exporté + appelé dans `ouvrirDb`.
    - `grep -c "sqlite.pragma('foreign_keys = ON')" src/infrastructure/db/database.ts` retourne 1.
    - `tests/integration/db/foreign-keys-sentinel.test.ts` créé et VERT.
    - `grep -c "PRAGMA foreign_keys = ON" tests/integration/repositories/ticket-travaux-repository-sqlite.test.ts` retourne 0 (manuel retiré).
    - 17 fichiers tests propagés (compte exact peut varier — vérifier avec grep que tous les `new Database(':memory:')` qui n'utilisent PAS ouvrirDb font activerPragmas).
    - `pnpm test` global VERT : 573 existants + 1 sentinel = 574 minimum.
    - 1 commit créé.
  </done>
</task>

<task type="auto">
  <name>Task 2 — CR-03 : Filtrer `corbeilleLe === null` dans `lire-ticket` + BDD + unit</name>
  <read_first>
    - src/application/travaux/lire-ticket.ts (ligne 50 — la ligne à corriger)
    - src/domain/documents/justificatif.ts (propriété `corbeilleLe`)
    - src/application/documents/mettre-justificatif-en-corbeille.ts (use case soft-delete — comportement actuel)
    - src/web/routes/coffre.ts (lignes 395-419 — GET /justificatifs/:id/fichier qui retourne 410 si corbeilleLe !== null, donc le lien actuel est cassé)
    - src/web/views/pages/travaux/detail.ejs (consommateur de `justificatifs[]`)
    - tests/bdd/features/travaux.feature (scénarios @inc-01 existants — pour pattern)
    - tests/bdd/step_definitions/travaux.steps.ts (steps existants — réutiliser)
    - tests/bdd/step_definitions/coffre.steps.ts (step "mettre justificatif en corbeille" déjà défini ?)
    - tests/unit/travaux/use-cases.test.ts (pattern de test existant)
    - .planning/phases/04-coffre-documentaire-travaux/04-VERIFICATION.md (gap "Sur la fiche d'un ticket de travaux...")
  </read_first>
  <behavior>
    **Avant :** `lire-ticket.ts:50` fait `if (j) justificatifs.push(j)` — inclut tous les Justificatifs trouvés via le pivot, y compris ceux avec `corbeilleLe !== null`. La fiche ticket affiche donc des PJ soft-deleted avec un lien `/justificatifs/:id/fichier` qui retourne `410 Gone`.

    **Après :** `lire-ticket.ts:50` fait `if (j && j.corbeilleLe === null) justificatifs.push(j)`. Les pivots `ticket_justificatifs` restent intacts (cohérent avec D-113 inverse : pas de cascade quand Justificatif est touché — la rétention 10 ans prime) ; seul l'affichage filtre. Le scénario BDD prouve le comportement bout-en-bout : créer ticket + attach PJ + mettre PJ en corbeille → fiche ticket n'affiche plus la PJ.

    **Note D-113 cohérence :** ce filtre est purement applicatif (lecture). La pivot row reste en DB pour audit/historique. Si on hard-purge le Justificatif après 10 ans, la pivot reste orpheline — pas un problème car la lecture filtre déjà sur l'existence (`if (j && ...)`) et la requête `trouverParId` retournera null sur un Justificatif hard-deleted. Pas de nettoyage nécessaire.
  </behavior>
  <action>
    **Étape 1 — Modifier `src/application/travaux/lire-ticket.ts:50`**

    Remplacer :
    ```ts
    if (j) justificatifs.push(j);
    ```
    par :
    ```ts
    if (j && j.corbeilleLe === null) justificatifs.push(j);
    ```

    Optionnel (lisibilité) : déclarer `const justificatifsActifs: Justificatif[] = []` au lieu de réutiliser `justificatifs`. Pas nécessaire — on garde la diff minimale.

    **Étape 2 — Ajouter test unitaire `tests/unit/travaux/use-cases.test.ts`**

    Ajouter dans le describe `lireTicket` existant (ou créer le describe si absent) :
    ```ts
    it("filtre les Justificatifs en corbeille (CR-03)", async () => {
      const t = TicketTravaux.creer(unTicketTravauxValide({ bienId }), TODAY);
      const jActif = uneJustificatifValide({ bienId, titre: 'PJ active' });
      // Construire un Justificatif soft-deleted via le constructeur ou mettreEnCorbeille
      const jBase = uneJustificatifValide({ bienId, titre: 'PJ corbeille' });
      const jCorbeille = jBase.mettreEnCorbeille('test', TODAY);

      const ticketRepo = {
        trouverParId: vi.fn().mockResolvedValue(t),
        listerJustificatifsLies: vi.fn().mockResolvedValue([jActif.id, jCorbeille.id]),
      } as unknown as TicketTravauxRepository;
      const justifRepo = {
        trouverParId: vi.fn(async (id) => id === jActif.id ? jActif : jCorbeille),
      } as unknown as JustificatifRepository;
      const bienRepo = {
        trouverParId: vi.fn().mockResolvedValue(unBien),
      } as unknown as BienRepository;

      const res = await lireTicket({ id: t.id }, { ticketRepo, bienRepo, justificatifRepo: justifRepo });
      expect(res.justificatifs).toHaveLength(1);
      expect(res.justificatifs[0].id).toBe(jActif.id);
    });
    ```
    Ajuster les imports + mocks selon le pattern existant.

    **Étape 3 — Ajouter scénario BDD `tests/bdd/features/travaux.feature`**

    Réutiliser les step patterns existants (`Étant donné un Bien...`, `Quand je crée un ticket...`, `Quand je mets le justificatif "X" en corbeille`, `Alors la fiche du ticket "Y" n'affiche pas "X"`). Si un step est manquant, l'ajouter dans `tests/bdd/step_definitions/travaux.steps.ts` ou `coffre.steps.ts` selon la responsabilité.

    Scénario cible (tag `@gap-04 @inc-01`) :
    ```gherkin
    @gap-04 @inc-01
    Scénario: Une PJ mise en corbeille n'apparaît plus sur la fiche du ticket (CR-03)
      Étant donné un Bien avec un Lot
      Et un ticket "Réparation chaudière" rattaché à ce Bien
      Et un justificatif "facture-chaudiere.pdf" rattaché à ce ticket
      Quand je mets le justificatif "facture-chaudiere.pdf" en corbeille
      Et je consulte la fiche du ticket "Réparation chaudière"
      Alors la fiche du ticket n'affiche pas "facture-chaudiere.pdf"
      Et la section "Pièces jointes" du ticket est vide
    ```

    **Étape 4 — Commit**
    Message : `fix(04-04): CR-03 filtrer Justificatifs en corbeille sur fiche ticket`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm test -- tests/unit/travaux/use-cases.test.ts && pnpm cucumber-js --tags "@gap-04" && grep -c "corbeilleLe === null" src/application/travaux/lire-ticket.ts</automated>
  </verify>
  <done>
    - `grep -c "corbeilleLe === null" src/application/travaux/lire-ticket.ts` retourne 1.
    - Test unitaire CR-03 VERT.
    - Scénario BDD `@gap-04 @inc-01` VERT.
    - Pas de régression : 36 scénarios `@phase4` existants restent verts (37 total avec le nouveau).
    - 1 commit créé.
  </done>
</task>

<task type="auto">
  <name>Task 3 — CR-06 : Déplacer `slugify` dans `domain/_shared` + règle dependency-cruiser `no-application-to-infra`</name>
  <read_first>
    - src/infrastructure/storage/stockage-justificatifs-local.ts (lignes 109-123 — static slugify à déplacer)
    - src/application/documents/uploader-justificatif.ts (ligne 29 import + ligne 154 appel)
    - src/domain/_shared/ (lister fichiers existants pour pattern — clock.ts, money.ts, etc.)
    - .dependency-cruiser.cjs (config actuelle — rules `no-domain-to-infra`, `no-application-to-web` existantes)
    - .planning/phases/04-coffre-documentaire-travaux/04-VERIFICATION.md (gap "Le domaine application ne dépend pas de l'infrastructure")
    - CLAUDE.md (règle non-négociable "Domaine pur")
    - tests/unit/ (chercher un test existant pour le pattern slugify ; si absent → créer dans `tests/unit/_shared/slug.test.ts`)
  </read_first>
  <behavior>
    **Avant :** `slugify` est un membre statique de la classe `StockageJustificatifsLocal` (infra). `uploader-justificatif.ts` (application) importe la classe entière juste pour appeler la méthode statique. Trois conséquences :
    1. Violation hexagonale `application/ → infrastructure/` (silencieuse car non couverte par depcruise).
    2. Swap d'adapter (S3, mémoire pour tests) impose de reimplementer slugify ailleurs.
    3. Le linter architectural ne peut pas attraper les futures violations similaires.

    **Après :**
    - `slugify` est une fonction pure dans `src/domain/_shared/slug.ts` (no-import-tier — peut être utilisée par domain, application, infrastructure, web indistinctement).
    - `StockageJustificatifsLocal` ne contient plus de `slugify` (statique supprimée — pas d'appelant interne).
    - `uploader-justificatif.ts` importe `slugify` depuis `domain/_shared`.
    - La règle dependency-cruiser `no-application-to-infra` (severity: error) est ACTIVE. `pnpm depcruise src` exit 0 — aucune autre violation latente n'existe (la seule était CR-06).
  </behavior>
  <action>
    **Étape 1 — Créer `src/domain/_shared/slug.ts`**

    Copier la logique verbatim depuis `stockage-justificatifs-local.ts:113-123` :
    ```ts
    /**
     * Slugifie une chaîne en `[a-z0-9-]` uniquement, max 80 chars,
     * fallback "document" si vide après normalisation (DP-27).
     *
     * Fonction pure — sans dépendance technique. Utilisable depuis domain,
     * application, infrastructure ou web indistinctement.
     */
    export function slugify(input: string): string {
      const slug = input
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80)
        .replace(/^-|-$/g, '');
      return slug.length > 0 ? slug : 'document';
    }
    ```

    **Étape 2 — Modifier `src/application/documents/uploader-justificatif.ts`**

    Ligne 29 : remplacer
    ```ts
    import { StockageJustificatifsLocal } from '../../infrastructure/storage/stockage-justificatifs-local.js';
    ```
    par
    ```ts
    import { slugify } from '../../domain/_shared/slug.js';
    ```

    Ligne 154 : remplacer
    ```ts
    const slug = StockageJustificatifsLocal.slugify(commande.titre);
    ```
    par
    ```ts
    const slug = slugify(commande.titre);
    ```

    **Étape 3 — Supprimer `slugify` de `src/infrastructure/storage/stockage-justificatifs-local.ts`**

    Retirer entièrement les lignes 109-123 (la méthode statique `slugify` + son doc-comment). Le reste du fichier est inchangé.

    Vérifier qu'aucun autre appelant n'utilise `StockageJustificatifsLocal.slugify` :
    ```
    grep -rn "StockageJustificatifsLocal\.slugify\|StockageJustificatifsLocal\b" --include='*.ts' src/ tests/
    ```
    Attendu après fix : 1 occurrence dans `main.ts` (instanciation `new StockageJustificatifsLocal(baseDir)`), 0 dans `application/` et `tests/`.

    **Étape 4 — Ajouter règle dependency-cruiser**

    Modifier `.dependency-cruiser.cjs` — ajouter dans le tableau `forbidden` :
    ```js
    {
      name: 'no-application-to-infra',
      comment:
        'La couche application ne doit pas dépendre de la couche infrastructure (ports & adapters strict — CLAUDE.md).',
      severity: 'error',
      from: {
        path: '^src/application',
      },
      to: {
        path: '^src/infrastructure',
      },
    },
    ```
    Garder l'ordre alphabétique ou logique (après `no-application-to-web`).

    **Étape 5 — Créer `tests/unit/_shared/slug.test.ts`**

    ```ts
    import { describe, it, expect } from 'vitest';
    import { slugify } from '../../../src/domain/_shared/slug.js';

    describe('slugify (DP-27)', () => {
      it('lowercase + drop accents', () => {
        expect(slugify('Été à Paris')).toBe('ete-a-paris');
      });
      it('remplace non-alphanum par -', () => {
        expect(slugify('A.B C_D-E')).toBe('a-b-c-d-e');
      });
      it('trim les - en début/fin', () => {
        expect(slugify('--foo--')).toBe('foo');
      });
      it('coupe à 80 chars', () => {
        const input = 'a'.repeat(120);
        expect(slugify(input)).toHaveLength(80);
      });
      it('fallback "document" si vide après normalisation', () => {
        expect(slugify('---')).toBe('document');
        expect(slugify('   ')).toBe('document');
        expect(slugify('!@#$')).toBe('document');
      });
    });
    ```

    **Étape 6 — Vérifier dependency-cruiser**

    Lancer `pnpm depcruise src --config .dependency-cruiser.cjs`. Attendu : 0 violation. Si une autre violation latente apparaît (e.g. un test legacy ou un autre import infra dans application), la corriger ou ouvrir un follow-up — NE PAS désactiver la règle.

    **Étape 7 — Commit**
    Message : `fix(04-04): CR-06 déplacer slugify dans domain/_shared + règle no-application-to-infra`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm test -- tests/unit/_shared/slug.test.ts && pnpm depcruise src --config .dependency-cruiser.cjs && ! grep -rn "StockageJustificatifsLocal\.slugify" --include='*.ts' src/ tests/ && ! grep -rn "import.*StockageJustificatifsLocal" --include='*.ts' src/application/</automated>
  </verify>
  <done>
    - `src/domain/_shared/slug.ts` créé avec fonction pure `slugify`.
    - `src/infrastructure/storage/stockage-justificatifs-local.ts` : méthode statique `slugify` supprimée.
    - `src/application/documents/uploader-justificatif.ts` : import + appel mis à jour.
    - `.dependency-cruiser.cjs` : règle `no-application-to-infra` (severity: error) ajoutée.
    - `pnpm depcruise src` exit 0 (avec nouvelle règle active).
    - `grep "StockageJustificatifsLocal\.slugify" src/ tests/` retourne 0 hit.
    - `grep "import.*StockageJustificatifsLocal" src/application/` retourne 0 hit.
    - Test unit slug VERT (5 cas).
    - Pas de régression `pnpm test`.
    - 1 commit créé.
  </done>
</task>

<task type="auto">
  <name>Task 4 — CR-04+CR-05 : Validation défensive `ecrire()` + Content-Disposition RFC 6266</name>
  <read_first>
    - src/infrastructure/storage/stockage-justificatifs-local.ts (méthode ecrire lignes 19-37 + lire lignes 39-83 pour le pattern startsWith déjà appliqué là)
    - src/domain/documents/erreurs.ts (pattern des classes d'erreur existantes — FichierIntrouvable, etc.)
    - src/web/routes/coffre.ts (lignes 395-419 — GET /justificatifs/:id/fichier où le header est construit)
    - src/web/helpers/ (vérifier si dossier existe ; sinon le créer)
    - tests/integration/storage/stockage-justificatifs-local.test.ts (pattern existant pour les tests ecrire/lire/supprimer)
    - tests/unit/ (chercher un test sur un autre helper web pour le pattern)
    - .planning/phases/04-coffre-documentaire-travaux/04-VERIFICATION.md (gaps CR-04 + CR-05)
  </read_first>
  <behavior>
    **CR-04 (path-traversal défensif) — avant :** `ecrire(annee, justificatifId, slug, ext, bytes)` interpole slug/ext directement dans `path.join(...)`. Aucun caller actuel ne passe de valeurs malicieuses (uploader fait `slugify()` + `EXT_PAR_MIME[mime]`), mais un futur caller (e.g. attach depuis ticket dual-mode, import legacy, batch CLI) pourrait passer un slug `../../etc/passwd` ou un ext `..%2f`. L'invariant "anti path-traversal" n'est pas porté par l'adapter.

    **CR-04 — après :** `ecrire()` valide défensivement AVANT path.join :
    - `slug` : `/^[a-z0-9-]{1,80}$/` (cohérent avec ce que `slugify` produit)
    - `ext` : `/^[a-z0-9]{1,5}$/` (cohérent avec `EXT_PAR_MIME` : `pdf|jpg|png|webp`)
    - `annee` : entier dans [1900, 2200]

    Et APRÈS path.join, vérifie que `path.resolve(this.baseDir, cheminRelatif).startsWith(path.resolve(this.baseDir) + path.sep)` — parité avec `lire()`. Tout fail → `throw new CheminInvalide()`.

    **CR-05 (RFC 6266) — avant :** `coffre.ts:409-410` fait
    ```ts
    .header('Content-Disposition', `attachment; filename="${j.nomFichierOriginal}"`)
    ```
    Si `nomFichierOriginal` contient `"`, `\`, ou des caractères non-ASCII (`été.pdf`, `rapport "Q1".pdf`), le header est cassé : guillemets non échappés, encodage non standard. Fastify peut bloquer le response splitting mais le header reste invalide UX-wise (le navigateur ne sait pas quoi faire).

    **CR-05 — après :** un helper `encodeFilenameRFC6266(filename)` génère
    ```
    attachment; filename="ascii-fallback"; filename*=UTF-8''percent-encoded
    ```
    où :
    - `ascii-fallback` = normalisation NFD + drop des combining marks + remplacement des `"` et `\` par `_` (sécurité parsing).
    - `percent-encoded` = `encodeURIComponent` sur le nom original.

    Le navigateur lit `filename*=UTF-8''...` en priorité (RFC 8187) ; les vieux clients fallback sur `filename="..."`.
  </behavior>
  <action>
    **Étape 1 — Ajouter `CheminInvalide` dans `src/domain/documents/erreurs.ts`**

    À la fin du fichier (ou en ordre alphabétique avec les autres) :
    ```ts
    export class CheminInvalide extends Error {
      constructor() {
        super('Chemin de stockage invalide.');
        this.name = 'CheminInvalide';
      }
    }
    ```

    **Étape 2 — Modifier `src/infrastructure/storage/stockage-justificatifs-local.ts:19-37` (`ecrire`)**

    Au début de `ecrire`, avant toute opération :
    ```ts
    const SLUG_RE = /^[a-z0-9-]{1,80}$/;
    const EXT_RE = /^[a-z0-9]{1,5}$/;
    if (!Number.isInteger(annee) || annee < 1900 || annee > 2200) {
      throw new CheminInvalide();
    }
    if (!SLUG_RE.test(slug)) {
      throw new CheminInvalide();
    }
    const extNetto = ext.startsWith('.') ? ext.slice(1) : ext;
    if (!EXT_RE.test(extNetto)) {
      throw new CheminInvalide();
    }
    ```

    Puis après `const cheminAbsolu = path.join(this.baseDir, cheminRelatif);`, AJOUTER :
    ```ts
    const baseDirResolu = path.resolve(this.baseDir);
    const cheminAbsoluResolu = path.resolve(cheminAbsolu);
    if (
      !cheminAbsoluResolu.startsWith(baseDirResolu + path.sep) &&
      cheminAbsoluResolu !== baseDirResolu
    ) {
      throw new CheminInvalide();
    }
    ```
    (Pattern copié verbatim de `lire()` lignes 47-52.)

    Ajouter l'import de `CheminInvalide` en haut du fichier.

    **Étape 3 — Créer `src/web/helpers/content-disposition.ts`**

    ```ts
    /**
     * Encode un Content-Disposition `attachment` conforme à RFC 6266 + RFC 8187.
     *
     * Génère :
     *   attachment; filename="<ascii-fallback>"; filename*=UTF-8''<percent-encoded>
     *
     * Le navigateur lit `filename*` en priorité ; les anciens clients tombent
     * sur `filename`. L'ASCII fallback est NFD-normalisé puis purgé des combining
     * marks et des caractères `"`/`\` (qui casseraient le parsing du header).
     */
    export function encodeFilenameRFC6266(filename: string): string {
      const asciiFallback = filename
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^\x20-\x7E]/g, '_')
        .replace(/["\\]/g, '_');
      const percentEncoded = encodeURIComponent(filename);
      return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${percentEncoded}`;
    }
    ```

    **Étape 4 — Utiliser le helper dans `src/web/routes/coffre.ts`**

    Ligne 408-411, remplacer :
    ```ts
    .header(
      'Content-Disposition',
      `attachment; filename="${j.nomFichierOriginal}"`,
    )
    ```
    par :
    ```ts
    .header('Content-Disposition', encodeFilenameRFC6266(j.nomFichierOriginal))
    ```

    Ajouter l'import en haut du fichier :
    ```ts
    import { encodeFilenameRFC6266 } from '../helpers/content-disposition.js';
    ```

    **Étape 5 — Tests unitaires `tests/unit/_shared/content-disposition.test.ts`**

    ```ts
    import { describe, it, expect } from 'vitest';
    import { encodeFilenameRFC6266 } from '../../../src/web/helpers/content-disposition.js';

    describe('encodeFilenameRFC6266 (CR-05)', () => {
      it('ASCII sans accents', () => {
        expect(encodeFilenameRFC6266('facture.pdf')).toBe(
          'attachment; filename="facture.pdf"; filename*=UTF-8\'\'facture.pdf',
        );
      });
      it('accents : drop dans le fallback, percent-encode dans filename*', () => {
        const out = encodeFilenameRFC6266('été.pdf');
        expect(out).toContain('filename="ete.pdf"');
        expect(out).toContain("filename*=UTF-8''%C3%A9t%C3%A9.pdf");
      });
      it('guillemets et backslash purgés du fallback', () => {
        const out = encodeFilenameRFC6266('rapport "Q1".pdf');
        expect(out).toMatch(/filename="rapport _Q1_\.pdf"/);
      });
      it('caractères non-ASCII non-diacritique remplacés par _', () => {
        const out = encodeFilenameRFC6266('日本語.pdf');
        expect(out).toContain('filename="___.pdf"');
        expect(out).toContain("filename*=UTF-8''");
      });
    });
    ```

    **Étape 6 — Tests integration `tests/integration/storage/stockage-justificatifs-local.test.ts`**

    Ajouter un describe pour les validations défensives :
    ```ts
    describe('CR-04 — validation défensive ecrire()', () => {
      it('refuse slug avec ../', async () => {
        await expect(
          stockage.ecrire(2026, 'jid-1', '../etc/passwd', 'pdf', Buffer.from('x')),
        ).rejects.toBeInstanceOf(CheminInvalide);
      });
      it('refuse ext malformée', async () => {
        await expect(
          stockage.ecrire(2026, 'jid-1', 'ok', '../', Buffer.from('x')),
        ).rejects.toBeInstanceOf(CheminInvalide);
      });
      it('refuse annee invalide', async () => {
        await expect(
          stockage.ecrire(-1, 'jid-1', 'ok', 'pdf', Buffer.from('x')),
        ).rejects.toBeInstanceOf(CheminInvalide);
        await expect(
          stockage.ecrire(NaN, 'jid-1', 'ok', 'pdf', Buffer.from('x')),
        ).rejects.toBeInstanceOf(CheminInvalide);
      });
    });
    ```

    **Étape 7 — Commit**
    Message : `fix(04-04): CR-04+CR-05 path-traversal défensif + Content-Disposition RFC 6266`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm test -- tests/unit/_shared/content-disposition.test.ts tests/integration/storage/stockage-justificatifs-local.test.ts && grep -c "encodeFilenameRFC6266" src/web/routes/coffre.ts && grep -c "CheminInvalide" src/infrastructure/storage/stockage-justificatifs-local.ts</automated>
  </verify>
  <done>
    - `src/domain/documents/erreurs.ts` : classe `CheminInvalide` ajoutée.
    - `src/infrastructure/storage/stockage-justificatifs-local.ts` : `ecrire()` valide slug/ext/annee + startsWith baseDir. `grep "CheminInvalide"` retourne ≥ 3.
    - `src/web/helpers/content-disposition.ts` créé avec `encodeFilenameRFC6266`.
    - `src/web/routes/coffre.ts` : utilise le helper. `grep "encodeFilenameRFC6266" src/web/routes/coffre.ts` retourne 1.
    - 4 tests unit RFC 6266 VERTS + 3 tests integration `ecrire()` VERTS.
    - Pas de régression `pnpm test`.
    - 1 commit créé.
  </done>
</task>

<task type="auto">
  <name>Task 5 — CR-08 : Vérifier WebP sous-format VP8/VP8L/VP8X + HEIC box_size</name>
  <read_first>
    - src/application/documents/valider-magic-bytes.ts (lignes 69-96 — branches WebP et HEIC à étendre)
    - tests/unit/documents/valider-magic-bytes.test.ts (pattern existant — tests par format)
    - .planning/phases/04-coffre-documentaire-travaux/04-VERIFICATION.md (gap CR-08)
    - Référence WebP RIFF subType : https://developers.google.com/speed/webp/docs/riff_container (offset 12-15 = 'VP8 ' | 'VP8L' | 'VP8X')
    - Référence HEIC box format : ISO/IEC 14496-12 (box_size = UInt32BE offset 0)
  </read_first>
  <behavior>
    **Avant :** `detecterMagic` accepte tout fichier `RIFF...WEBP` (12 octets vérifiés), même sans sous-format VP8 valide. Un fichier `RIFF\x00\x00\x00\x00WEBP<binaire-arbitraire>` est validé. Idem pour HEIC : `ftyp` + brand valide à l'offset 4-11 suffit, le box_size (UInt32BE offset 0) n'est pas inspecté.

    **Après :**
    - **WebP** : après match `RIFF...WEBP`, on lit `bytes.subarray(12, 16).toString('ascii')` et on accepte uniquement les 3 sous-formats officiels :
      - `'VP8 '` (4 chars, **avec espace final** — lossy)
      - `'VP8L'` (lossless)
      - `'VP8X'` (extended)
      Tout autre sous-format → `detecte = null` → résultat `{ ok: false, raison: 'format-non-accepte' }`.
    - **HEIC** : avant de matcher `ftyp`, lire `boxSize = bytes.readUInt32BE(0)` et vérifier `boxSize >= 16 && boxSize <= bytes.length`. Sinon → `null`.

    **Impact tests existants :** les buffers de test HEIC dans la suite existante doivent commencer par un box_size plausible (24 ou 32). Si l'helper de test (`_builders/documents.ts` ?) construit des buffers, vérifier qu'il pose un box_size valide. Si nécessaire, mettre à jour le builder en même temps.
  </behavior>
  <action>
    **Étape 1 — Modifier la branche WebP dans `src/application/documents/valider-magic-bytes.ts:69-82`**

    Remplacer le bloc `if (...) return 'image/webp';` actuel par :
    ```ts
    // WebP : "RIFF" (0..3) + "WEBP" (8..11) + subType (12..15) ∈ {'VP8 ', 'VP8L', 'VP8X'}
    if (
      bytes.length >= 16 &&
      bytes[0] === 0x52 && // R
      bytes[1] === 0x49 && // I
      bytes[2] === 0x46 && // F
      bytes[3] === 0x46 && // F
      bytes[8] === 0x57 && // W
      bytes[9] === 0x45 && // E
      bytes[10] === 0x42 && // B
      bytes[11] === 0x50   // P
    ) {
      const subType = bytes.subarray(12, 16).toString('ascii');
      if (subType === 'VP8 ' || subType === 'VP8L' || subType === 'VP8X') {
        return 'image/webp';
      }
      // RIFF...WEBP sans sous-format VP8 valide → null (rejeté)
      return null;
    }
    ```

    **Étape 2 — Modifier la branche HEIC dans le même fichier (lignes 84-96)**

    Remplacer par :
    ```ts
    // HEIC : box_size (0..3 UInt32BE) >= 16 && <= bytes.length, puis "ftyp" (4..7) + brand (8..11) ∈ HEIC_BRANDS
    if (bytes.length >= 12) {
      const boxSize = bytes.readUInt32BE(0);
      if (
        boxSize >= 16 &&
        boxSize <= bytes.length &&
        bytes[4] === 0x66 && // f
        bytes[5] === 0x74 && // t
        bytes[6] === 0x79 && // y
        bytes[7] === 0x70    // p
      ) {
        const brand = bytes.subarray(8, 12).toString('ascii');
        if (HEIC_BRANDS.has(brand)) {
          return 'image/heic';
        }
      }
    }
    ```

    **Étape 3 — Tests unitaires `tests/unit/documents/valider-magic-bytes.test.ts`**

    Ajouter dans le describe existant :
    ```ts
    describe('CR-08 — WebP sous-format', () => {
      const RIFF = Buffer.from([0x52, 0x49, 0x46, 0x46]);
      const SIZE = Buffer.from([0x00, 0x00, 0x00, 0x10]); // 16 bytes (placeholder size)
      const WEBP = Buffer.from('WEBP', 'ascii');

      it('accepte VP8  (lossy)', () => {
        const buf = Buffer.concat([RIFF, SIZE, WEBP, Buffer.from('VP8 ', 'ascii')]);
        expect(validerMagicBytes(buf, 'image/webp')).toEqual({ ok: true, mimeFinal: 'image/webp' });
      });
      it('accepte VP8L (lossless)', () => {
        const buf = Buffer.concat([RIFF, SIZE, WEBP, Buffer.from('VP8L', 'ascii')]);
        expect(validerMagicBytes(buf, 'image/webp')).toEqual({ ok: true, mimeFinal: 'image/webp' });
      });
      it('accepte VP8X (extended)', () => {
        const buf = Buffer.concat([RIFF, SIZE, WEBP, Buffer.from('VP8X', 'ascii')]);
        expect(validerMagicBytes(buf, 'image/webp')).toEqual({ ok: true, mimeFinal: 'image/webp' });
      });
      it('rejette RIFF+WEBP sans sous-format VP8 valide (CR-08 hybride)', () => {
        const buf = Buffer.concat([RIFF, SIZE, WEBP, Buffer.from('XXXX', 'ascii'), Buffer.alloc(1024)]);
        expect(validerMagicBytes(buf, 'image/webp')).toEqual({ ok: false, raison: 'format-non-accepte' });
      });
    });

    describe('CR-08 — HEIC box_size', () => {
      const FTYP = Buffer.from([0x66, 0x74, 0x79, 0x70]); // 'ftyp'
      const BRAND_HEIC = Buffer.from('heic', 'ascii');

      it('rejette box_size = 0 (anormal)', () => {
        const buf = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x00]), FTYP, BRAND_HEIC]);
        expect(validerMagicBytes(buf, 'image/heic')).toEqual({ ok: false, raison: 'format-non-accepte' });
      });
      it('rejette box_size > bytes.length', () => {
        // box_size = 9999 mais buffer ne fait que 12 bytes
        const buf = Buffer.concat([Buffer.from([0x00, 0x00, 0x27, 0x0F]), FTYP, BRAND_HEIC]);
        expect(validerMagicBytes(buf, 'image/heic')).toEqual({ ok: false, raison: 'format-non-accepte' });
      });
      it('accepte box_size = 24 plausible (HEIC valide)', () => {
        const buf = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), FTYP, BRAND_HEIC, Buffer.alloc(12)]);
        expect(validerMagicBytes(buf, 'image/heic')).toEqual({ ok: true, mimeFinal: 'image/heic' });
      });
    });
    ```

    **Étape 4 — Vérifier que les builders/fixtures HEIC existants restent compatibles**

    `grep -rn "HEIC\|heic\|brand" tests/` — pour chaque builder qui construit un buffer HEIC, vérifier qu'il commence par un `box_size` ≥ 16. Si nécessaire, mettre à jour. Pour le test integration `convertisseur-image-sharp.test.ts` (Phase 4 Wave 1), l'AVIF/HEIC forgé via sharp doit déjà avoir un box_size valide — vérifier au runtime.

    **Étape 5 — Commit**
    Message : `fix(04-04): CR-08 magic-bytes WebP sous-format VP8 + HEIC box_size`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm test -- tests/unit/documents/valider-magic-bytes.test.ts && grep -c "VP8" src/application/documents/valider-magic-bytes.ts && grep -c "readUInt32BE" src/application/documents/valider-magic-bytes.ts</automated>
  </verify>
  <done>
    - `src/application/documents/valider-magic-bytes.ts` : branche WebP vérifie subType ∈ {VP8 , VP8L, VP8X}, branche HEIC vérifie box_size.
    - `grep -c "VP8" src/application/documents/valider-magic-bytes.ts` retourne ≥ 3 (les 3 sous-formats).
    - `grep -c "readUInt32BE" src/application/documents/valider-magic-bytes.ts` retourne ≥ 1.
    - 7 nouveaux tests unit VERTS (4 WebP + 3 HEIC).
    - Pas de régression : tous les tests Phase 4 existants (validation magic-bytes par format) restent verts.
    - 1 commit créé.
  </done>
</task>

</tasks>

## Verification globale (orchestrateur — `gsd-verifier`)

Après les 5 tasks committés, la verifier re-run doit retourner `status: passed` avec :

- `gaps_closed: [CR-01, CR-03, CR-06, CR-04+CR-05, CR-08]`
- `gaps_remaining: []`
- `regressions: []`

Checks programmatiques :

| Check | Commande | Attendu |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Tests unit + integration | `pnpm test` | ≥ 595 tests verts (573 existants + ~22 nouveaux) |
| Tests BDD | `pnpm test:bdd` | ≥ 112 scénarios verts (111 existants + 1 `@gap-04`) |
| Dependency cruiser | `pnpm depcruise src --config .dependency-cruiser.cjs` | 0 violation avec règle `no-application-to-infra` active |
| PRAGMA dans code | `grep -c "sqlite.pragma('foreign_keys = ON')" src/infrastructure/db/database.ts` | ≥ 1 |
| Pas d'activation manuelle dans test cascade | `grep -c "PRAGMA foreign_keys = ON" tests/integration/repositories/ticket-travaux-repository-sqlite.test.ts` | 0 |
| Slugify déplacé | `grep -rn "StockageJustificatifsLocal\.slugify" --include='*.ts' src/ tests/` | 0 hit |
| Application n'importe plus infra storage | `grep -rn "import.*StockageJustificatifsLocal" --include='*.ts' src/application/` | 0 hit |
| Filtre corbeilleLe actif | `grep -c "corbeilleLe === null" src/application/travaux/lire-ticket.ts` | 1 |
| Header RFC 6266 | `grep -c "encodeFilenameRFC6266" src/web/routes/coffre.ts` | ≥ 1 |
| WebP subType | `grep -E "'VP8 '\|VP8L\|VP8X" src/application/documents/valider-magic-bytes.ts` | ≥ 3 matches |
| HEIC box_size | `grep "readUInt32BE" src/application/documents/valider-magic-bytes.ts` | ≥ 1 match |

Si toutes les vérifications passent, la verifier marquera Phase 04 comme `[x]` complete dans ROADMAP.md et avancera STATE.md vers Phase 05.

## Notes de vigilance pendant l'exécution

1. **T1 — propagation tests** : ~17 fichiers identifiés via `grep "new Database(':memory:')\|new BetterSqlite3(':memory:')"`. L'executor doit lister exhaustivement avant modification — la liste dans `files_modified` est un floor, pas un ceiling. Si un test n'utilise pas de FK CASCADE, l'ajout d'`activerPragmas` ne change rien fonctionnellement mais reste recommandé pour cohérence.

2. **T3 — règle dependency-cruiser** : si une violation latente apparaît (autre que `uploader-justificatif.ts`), STOP et la signaler. NE PAS désactiver la règle. La règle est `severity: error` — toute violation = build red. Si fix non-trivial, ouvrir un follow-up.

3. **T5 — fixtures HEIC** : les buffers HEIC existants dans `tests/_builders/documents.ts` et `tests/integration/image/convertisseur-image-sharp.test.ts` doivent avoir un box_size ≥ 16. Si la fix CR-08 casse un test existant, mettre à jour la fixture (pas désactiver le test).

4. **Ordre des tasks** : séquentiel (1→2→3→4→5). T3 (slugify move) touche `uploader-justificatif.ts` et `stockage-justificatifs-local.ts` ; T4 retouche `stockage-justificatifs-local.ts` pour la validation défensive — l'executor doit séquencer pour éviter conflits.

5. **Hors périmètre rappel** : WR-02 (compensation soft-delete) et WR-06 (substr index) sont NON inclus dans ce plan. Si l'executor remarque une opportunité de les traiter, NE PAS le faire — RISKS.md les trackera après cette gap-closure.
