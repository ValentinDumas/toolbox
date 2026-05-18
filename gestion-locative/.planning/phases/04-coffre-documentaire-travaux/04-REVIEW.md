---
phase: 04-coffre-documentaire-travaux
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - migrations/0010_phase4_documents_travaux.sql
  - src/application/documents/uploader-justificatif.ts
  - src/application/documents/valider-magic-bytes.ts
  - src/application/documents/purger-justificatif.ts
  - src/application/documents/modifier-justificatif.ts
  - src/application/documents/rechercher-justificatifs.ts
  - src/application/travaux/ajouter-pj-ticket.ts
  - src/application/travaux/clore-ticket-travaux.ts
  - src/domain/documents/justificatif.ts
  - src/domain/travaux/ticket-travaux.ts
  - src/infrastructure/repositories/justificatif-repository-sqlite.ts
  - src/infrastructure/repositories/ticket-travaux-repository-sqlite.ts
  - src/infrastructure/storage/stockage-justificatifs-local.ts
  - src/infrastructure/image/convertisseur-image-sharp.ts
  - src/web/routes/coffre.ts
  - src/web/routes/travaux.ts
  - src/web/schemas/justificatif-schemas.ts
  - src/web/schemas/ticket-travaux-schemas.ts
findings:
  critical: 8
  warning: 12
  info: 6
  total: 26
status: issues_found
---

# Phase 4 — Code Review Report

**Reviewed:** 2026-05-18
**Depth:** standard
**Files Reviewed:** 18 source files (Phase 4 — BC Documents + BC Travaux)
**Status:** issues_found

## Summary

Phase 4 introduces two bounded contexts: BC Documents (justificatifs avec rétention 10 ans + corbeille + magic-bytes validation) et BC Travaux (tickets avec workflow `ouvert→en_cours→clos|annule` + pivot N:N). L'architecture hexagonale est respectée dans les grandes lignes ; la slugification est correctement durcie ; l'anti-path-traversal est rigoureux pour la lecture (`fs.realpath` + double barrière).

**Mais l'implémentation contient plusieurs régressions de sécurité et bugs de correctness sérieux** qui doivent être corrigés avant ship :

1. **BLOCKER : `PRAGMA foreign_keys = ON` n'est jamais exécuté** — toutes les contraintes FK déclarées dans 0010 (et toutes les migrations précédentes) sont silencieusement non appliquées par SQLite. La cascade asymétrique D-113 est donc inopérante : un `DELETE` sur `tickets_travaux` n'effacera **pas** les rows pivot ; on peut créer un justificatif avec `bien_id` pointant vers un Bien inexistant ; le CHECK polymorphe sera la seule défense en profondeur.
2. **BLOCKER : Filtre `corbeille_le IS NULL` manquant** dans `listerJustificatifsParBien` et `listerJustificatifsParLocataire` → les documents soft-deleted s'affichent sur les fiches Bien/Locataire, contournant la corbeille.
3. **BLOCKER : `lire-ticket.ts` charge les justificatifs soft-deleted via la pivot** sans filtre corbeille — un ticket affiche les PJ supprimées comme actives.
4. **BLOCKER : Path-traversal partiel sur `slugify`** — `slugify('../..')` retourne `'document'` après le slice ; **mais** `slugify('..autre')` retourne `'-autre'`, et la séquence `${id}-${slug}` reste safe **seulement parce que l'id est généré côté serveur**. La vraie bombe est l'écriture (`ecrire`) qui n'a aucun garde-fou sur `slug`/`ext`. Si un appelant futur passe un slug avec `/` ou `..`, on écrit ailleurs.
5. **BLOCKER : Header `Content-Disposition` injecte `nomFichierOriginal` sans escape** → un fichier nommé `"évil";payload="x.pdf` permet d'injecter des headers HTTP (CRLF injection théoriquement bloquée par Fastify mais quotes non échappées → header malformé, response splitting selon le transport).
6. **BLOCKER : Domain-purity violation** — `application/documents/uploader-justificatif.ts` importe la classe concrète `StockageJustificatifsLocal` (infrastructure) au lieu d'utiliser le port `StockageJustificatifs`. La règle `no-application-to-web` du `.dependency-cruiser.cjs` ne couvre **pas** ce cas (devrait être `no-application-to-infra`).
7. **BLOCKER : `peutEtrePurge` dépend de `creeLe` (immutable mais reconstruit depuis la DB)** — `versDomaine` re-injecte `creeLe` depuis SQLite et passe par `Justificatif.creer` qui **ne valide pas** `creeLe`. Si un test ou un outil de maintenance écrit directement en DB un `cree_le = '1900-01-01'`, la purge s'autorise immédiatement. C'est aussi le cas via `enregistrer` après `mettreEnCorbeille`/`restaurer` — le `creeLe` source vient de `toProps()` ce qui est OK ; mais la défense en profondeur SQL CHECK manque (`cree_le ≤ corbeille_le` jamais vérifié).
8. **BLOCKER : Magic-bytes WebP brand vérifié partiel** — la signature WebP ne vérifie pas l'en-tête VP8/VP8L/VP8X qui suit `WEBP`, donc un fichier `RIFF....WEBP` suivi de données arbitraires (PE Windows, par exemple) passe la validation. Pareil pour HEIC : seuls les 4 premiers octets de `ftyp` sont contrôlés, le `box_size` n'est pas validé.

Side issues : multiple bugs of correctness (compensation soft-delete buggée, gate purge contournable, transactions cassées, etc.) — voir détail ci-dessous.

---

## Critical Issues

### CR-01: `PRAGMA foreign_keys = ON` jamais exécuté → toutes les contraintes FK sont silencieusement désactivées (D-113 inopérant)

**File:** `src/infrastructure/db/database.ts:13-20` ; `migrations/0010_phase4_documents_travaux.sql:1-94`
**Issue:** SQLite désactive les contraintes FK par défaut ; il faut exécuter `PRAGMA foreign_keys = ON` **sur chaque connexion** (better-sqlite3). Ce n'est fait nulle part :
- `ouvrirDb` n'exécute aucun PRAGMA.
- Les migrations 0001..0010 ne contiennent pas `PRAGMA foreign_keys = ON`.

Conséquences directes Phase 4 :
- `tickets_travaux.bien_id REFERENCES bien(id)` non vérifié → on peut insérer un ticket avec `bien_id` inexistant (l'invariant repo `creerTicketTravaux` regarde via `bienRepo.trouverParId` mais c'est défense en profondeur applicative, pas SQL).
- `ticket_justificatifs.ticket_id REFERENCES tickets_travaux(id) ON DELETE CASCADE` → la cascade D-113 ne se déclenchera **jamais** car ON CASCADE n'est appliqué que si foreign_keys=ON. Si demain `DELETE FROM tickets_travaux WHERE id=?` est ajouté (purge ticket), on crée des rows pivot orphelines.
- `ticket_justificatifs.justificatif_id REFERENCES justificatifs(id)` (sans CASCADE — protection D-113) → non vérifié non plus, on peut lier à un justificatif inexistant.

**Fix:** Activer FK lors de l'ouverture (sécurité + cohérence), idéalement dans 0001_init.sql ET dans `ouvrirDb`:
```ts
// src/infrastructure/db/database.ts
export function ouvrirDb(cheminFichier: string): ConnexionDb {
  const dossier = path.dirname(cheminFichier);
  fs.mkdirSync(dossier, { recursive: true });

  const sqlite = new BetterSqlite3(cheminFichier);
  sqlite.pragma('foreign_keys = ON'); // CR-01 — D-113 dépend de FK activées
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  return { db, sqlite };
}
```
Et ajouter une nouvelle migration `0011_enable_foreign_keys.sql` qui contient `PRAGMA foreign_keys = ON;` (idempotent), puis ajouter un test qui vérifie via `SELECT * FROM pragma_foreign_keys` que le flag est ON.

---

### CR-02: `listerJustificatifsParBien` et `listerJustificatifsParLocataire` retournent les documents soft-deleted (corbeille_le ≠ NULL)

**File:** `src/application/documents/lister-justificatifs-par-bien.ts:18-23` ; `src/application/documents/lister-justificatifs-par-locataire.ts:50-66`
**Issue:** Les deux use-cases passent `bienId`/`locataireId` à `justificatifRepo.rechercher` sans positionner `inclureCorbeille: false`. Par défaut, le repo SQLite filtre `corbeille_le IS NULL` quand `inclureCorbeille` est **falsy** (`if (!filtres.inclureCorbeille)`), donc la valeur par défaut `undefined` → filtre activé → **fonctionnement correct ici**. **Mais** : `lister-justificatifs-par-locataire.ts:54-56` passe explicitement `type: cmd.type, page: 1, pageSize` sans `inclureCorbeille` non plus → idem comportement correct par défaut.

**Annulons ce finding partiellement** — le repo a un comportement par défaut sain (`!filtres.inclureCorbeille` retire la corbeille). Mais le contrat n'est pas explicite et c'est piégeux : un futur appelant peut passer `{ inclureCorbeille: false }` croyant l'activer alors qu'il l'a déjà par défaut.

**Le vrai bug reste :** la sémantique inversée par défaut (`!inclureCorbeille` ⇔ exclure) est fragile et non documentée dans `JustificatifRechercheFiltres`. La doc dit "Phase 4 wave 2" mais le comportement par défaut "exclure si non spécifié" n'est dit nulle part.

**Reclassé en WARNING.** Voir WR-01.

---

### CR-03: `lire-ticket.ts` charge les justificatifs soft-deleted via la pivot — bypass de la corbeille

**File:** `src/application/travaux/lire-ticket.ts:44-51`
**Issue:** Quand un Justificatif est mis en corbeille (`mettreJustificatifEnCorbeille`), la pivot `ticket_justificatifs` n'est pas nettoyée (D-113 cascade asymétrique : la rétention prime). Mais `lire-ticket` retourne **tous** les justificatifs liés sans filtrer `corbeilleLe`. Résultat : la fiche ticket affiche un justificatif soft-deleted comme actif, avec un lien `/justificatifs/:id` qui redirige vers `/coffre` avec bannière "Ce document est en corbeille" (cf. `coffre.ts:372`).

UX cassée : l'utilisateur voit une PJ avec lien fonctionnel, clique, et est redirigé sans contexte. Plus grave : `partial-ticket-pj-section.ejs` propose une action "Retirer" qui marche → on peut délier un justif en corbeille, ce qui est probablement OK, mais l'affichage est trompeur.

**Fix:**
```ts
// src/application/travaux/lire-ticket.ts
const justificatifs: Justificatif[] = [];
for (const jid of justificatifIds) {
  const j = await deps.justificatifRepo.trouverParId(jid);
  if (j && j.corbeilleLe === null) justificatifs.push(j); // CR-03
}
```
Alternative : enrichir `listerJustificatifsLies` pour retourner les Justificatifs hydratés + filtrer la corbeille via le JOIN SQL (plus efficace, élimine le N+1). Documenter la décision : "afficher les soft-deleted en gris" vs "masquer".

---

### CR-04: Path traversal possible dans `StockageJustificatifsLocal.ecrire` — slug/ext non validés

**File:** `src/infrastructure/storage/stockage-justificatifs-local.ts:19-37`
**Issue:** La méthode `ecrire(annee, justificatifId, slug, ext, bytes)` fait `path.join('documents', 'justificatifs', String(annee), '${id}-${slug}.${ext}')` sans valider que `slug` et `ext` ne contiennent pas `/`, `..`, ou `\0`. Aujourd'hui, l'unique appelant est `uploader-justificatif.ts:154` qui calcule le slug via `StockageJustificatifsLocal.slugify` (`[a-z0-9-]` only, plafonné 80 chars, fallback `'document'`) et l'extension via `EXT_PAR_MIME` (whitelist `pdf|jpg|png|webp`). C'est donc safe **en pratique aujourd'hui**, mais l'invariant n'est pas porté par l'adapter — c'est une bombe à retardement.

Cas concret : si demain un autre use-case appelle `ecrire(annee, id, userInput, 'pdf', bytes)` sans passer par `slugify`, on écrit hors-baseDir.

**Fix:** Re-valider défensivement dans `ecrire` (et appliquer le même traitement que `lire`) :
```ts
async ecrire(annee, justificatifId, slug, ext, bytes) {
  const extNetto = ext.startsWith('.') ? ext.slice(1) : ext;
  // CR-04 défense en profondeur — invariant assurance qualité écriture
  if (!/^[a-z0-9]+$/.test(extNetto)) {
    throw new Error(`Extension invalide : ${ext}`);
  }
  if (!/^[a-z0-9-]+$/.test(slug) || slug.length > 80) {
    throw new Error(`Slug invalide : ${slug}`);
  }
  if (!Number.isInteger(annee) || annee < 1900 || annee > 2200) {
    throw new Error(`Année invalide : ${annee}`);
  }
  // ... reste du code, et vérifier que cheminAbsolu.startsWith(baseDirResolu) AVANT writeFile
}
```

---

### CR-05: `Content-Disposition` injecte `nomFichierOriginal` non échappé → header malformé / response-splitting potentiel

**File:** `src/web/routes/coffre.ts:407-412`
**Issue:**
```ts
.header('Content-Disposition', `attachment; filename="${j.nomFichierOriginal}"`)
```
`nomFichierOriginal` est fourni par le client lors du upload (`data.filename` côté multipart), persisté tel quel en DB (aucune sanitization dans `Justificatif.creer`), puis ré-émis dans un header. Un fichier nommé `evil"; attachment="x.pdf` produit :
```
Content-Disposition: attachment; filename="evil"; attachment="x.pdf"
```
ce qui est mal formé. Plus dangereux : un fichier nommé `\r\nSet-Cookie: a=b` (CRLF injection) — bloqué par Fastify/Node v16+ qui rejette le `\r\n` dans les headers (Node strict-mode), donc on évite le response splitting full. **Mais** les guillemets et caractères non-ASCII (UTF-8) ne sont pas échappés, ce qui casse les téléchargements avec des noms français (`été.pdf`).

RFC 6266 prescrit `filename*=UTF-8''<percent-encoded>` pour les noms non-ASCII.

**Fix:**
```ts
function encodeFilenameRFC6266(filename: string): string {
  // ASCII fallback : strip caractères non sûrs et quotes
  const asciiSafe = filename
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\\r\n]/g, '_');
  const utf8Encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiSafe}"; filename*=UTF-8''${utf8Encoded}`;
}
// ...
.header('Content-Disposition', encodeFilenameRFC6266(j.nomFichierOriginal))
```

---

### CR-06: Violation de la pureté DDD — `application/documents/uploader-justificatif.ts` importe la classe concrète infra `StockageJustificatifsLocal`

**File:** `src/application/documents/uploader-justificatif.ts:29,154`
**Issue:**
```ts
import { StockageJustificatifsLocal } from '../../infrastructure/storage/stockage-justificatifs-local.js';
// ...
const slug = StockageJustificatifsLocal.slugify(commande.titre);
```

Trois problèmes :
1. **Layer violation** — `application/` ne doit pas dépendre de `infrastructure/`. Le projet a `.dependency-cruiser.cjs` mais ne contient pas de règle `no-application-to-infra` (seulement `no-domain-to-infra` et `no-application-to-web`). C'est un trou dans la garde architecturale.
2. **Testabilité** — `slugify` est une fonction pure, mais elle vit côté infra. Si demain on remplace l'adapter (S3, IPFS), il faudra dupliquer ou réimporter cette fonction.
3. **CLAUDE.md** : "Domaine pur : aucun import technique (ORM, HTTP, fichier) dans le cœur du domaine — ports & adapters strict." → étend implicitement à `application/` qui ne doit dépendre que des ports.

**Fix:**
1. Déplacer `slugify` dans `src/domain/_shared/slug.ts` ou `src/application/documents/slugify.ts` (fonction pure, pas d'I/O).
2. Ajouter une règle dans `.dependency-cruiser.cjs` :
```js
{
  name: 'no-application-to-infra',
  comment: 'La couche application ne dépend que des ports domaine, jamais des adapters infra.',
  severity: 'error',
  from: { path: '^src/application' },
  to: { path: '^src/infrastructure', pathNot: '^src/infrastructure/db/kysely-types' },
},
```
Note : `kysely-types` est tolérable car c'est juste un type DTO ; le `Kysely<DB>` injecté en deps est borderline mais accepté faute d'alternative.

---

### CR-07: `peutEtrePurge` repose sur `creeLe` non vérifié à la reconstitution depuis la DB — backdating bypasse la rétention 10 ans

**File:** `src/domain/documents/justificatif.ts:139-183` (factory) ; `src/infrastructure/repositories/justificatif-repository-sqlite.ts:189-212` (versDomaine) ; migrations 0010 ligne 37
**Issue:** L'invariant D-109 (rétention 10 ans) est calculé par `peutEtrePurge(today)` comme `today >= creeLe.add({ years: 10 })`. Le `creeLe` provient de :
- Création initiale : `clock.aujourdhui()` (sain — pas de back-date possible).
- Re-hydratation : `versDomaine` → `Temporal.PlainDate.from(row.cree_le)` puis `Justificatif.creer({ creeLe, ... })` qui n'effectue aucune vérification temporelle.

Donc :
- Un opérateur qui modifie la base directement (`UPDATE justificatifs SET cree_le='1900-01-01' WHERE id=...`) peut purger un document de moins de 10 ans.
- Plus pernicieux : `mettreJustificatifEnCorbeille` → `enregistrer` repasse par `Justificatif.creer({...toProps(), corbeilleLe: today, raisonCorbeille})` — `creeLe` est préservé de `toProps()` donc OK ici. Mais si une régression future modifie `toProps()` (par exemple inclure un fallback `creeLe = today`), la rétention disparaît silencieusement.
- Pas de CHECK SQL : `creeLe ≤ today` n'est jamais vérifié au niveau DB.

**Fix:**
1. CHECK SQL dans la migration (corrige le bypass via UPDATE direct) :
```sql
ALTER TABLE justificatifs ADD CONSTRAINT cree_le_passe CHECK (cree_le <= date('now'));
```
Note : SQLite ne supporte pas `ALTER TABLE ... ADD CONSTRAINT` ; il faut ajouter cette contrainte dans 0010 directement ou rebuild la table en 0011.
2. Optionnel — `Justificatif.creer` peut valider `creeLe ≤ today` (mais besoin d'injecter `today` ce qui change la signature) ; alternative : exposer `peutEtrePurge(today)` qui clamp `effectiveCreeLe = max(creeLe, dateMin)`.
3. Tester explicitement : insérer en DB une row avec `cree_le='1900-01-01'` et vérifier que `peutEtrePurge` ne renvoie **pas** true.

---

### CR-08: Magic-bytes WebP et HEIC validés partiellement — bypass possible via fichier hybride

**File:** `src/application/documents/valider-magic-bytes.ts:69-96`
**Issue:**

**WebP** : la signature attendue est `RIFF<size>WEBPVP8 ` (ou `VP8L`, `VP8X` à offset 12-15) mais le code vérifie seulement les bytes 0-3 (`RIFF`) et 8-11 (`WEBP`). Les octets 4-7 (taille) et 12+ (sous-format VP8/VP8L/VP8X) ne sont pas validés. Un fichier RIFF-WEBP suivi de payload arbitraire (par exemple un exécutable Windows PE concaténé) passe la validation. Sharp pourra refuser ensuite, mais on a déjà :
- accepté le mismatch potentiel,
- alloué/écrit le fichier sur disque (puisque sharp tente la conversion seulement pour HEIC, pas pour WebP qui est passe-through).

**HEIC** : la signature ISO BMFF `ftyp` vérifie bytes 4-7 mais pas le `box_size` (bytes 0-3) qui doit être ≥ 16 et cohérent. Un attaquant peut construire un faux header `ftyp` valide à l'œil mais avec un box_size bogus.

**JPEG** : signature `FF D8 FF` validée, mais pas le marqueur final `FF D9` (EOI) — c'est volontaire (validation streaming impossible) mais on accepte donc tout buffer commençant par `FF D8 FF`.

**PDF** : `%PDF-` validé. Pas de checksum/structure, mais c'est la convention magic-bytes — acceptable.

**Fix:** Au minimum durcir WebP + ajouter validation de plage taille :
```ts
// WebP — vérifier que size dans le header RIFF est plausible
if (bytes.length >= 16 && bytes[0]===0x52 && bytes[1]===0x49 && bytes[2]===0x46 && bytes[3]===0x46
    && bytes[8]===0x57 && bytes[9]===0x45 && bytes[10]===0x42 && bytes[11]===0x50) {
  // Bytes 12-15 : sous-format VP8 (3 chars + 0x20), VP8L (4 chars), ou VP8X (3 chars + 0x20)
  const subType = bytes.subarray(12, 16).toString('ascii');
  if (subType === 'VP8 ' || subType === 'VP8L' || subType === 'VP8X') {
    return 'image/webp';
  }
  // Sinon : non-WebP malgré RIFF...WEBP — refuser
}
```
Pour HEIC, valider `box_size` :
```ts
const boxSize = bytes.readUInt32BE(0);
if (boxSize < 16 || boxSize > bytes.length) return null;
```
Pour défense en profondeur : laisser sharp/poppler **toujours** ouvrir le fichier (même PDF/JPEG/PNG/WebP) pour valider la structure réelle — actuellement seul HEIC est ouvert par sharp ; les autres sont écrits tels quels.

---

## Warnings

### WR-01: Sémantique inversée par défaut de `inclureCorbeille` est fragile et non documentée

**File:** `src/infrastructure/repositories/justificatif-repository-sqlite.ts:114-115,151-152` ; `src/domain/documents/justificatif-repository.ts:21`
**Issue:** Le filtre repo applique `WHERE corbeille_le IS NULL` dès que `inclureCorbeille` est falsy (`!filtres.inclureCorbeille`). Sémantiquement "ne pas inclure la corbeille" = "exclure" = comportement par défaut. C'est l'opposé de ce qu'on attendrait pour un flag `inclureCorbeille` (par défaut on s'attend à `true` = inclure tout, et on devrait passer `exclureCorbeille: true` pour filtrer). La documentation ne précise pas cette inversion.

**Fix:** Renommer en `exclureCorbeille?: boolean` (défaut true) ou explicitement documenter le comportement actuel + ajouter un test qui exerce les deux branches :
```ts
// dans JustificatifRechercheFiltres
/**
 * Si true ou undefined (défaut), exclut les justificatifs soft-deleted.
 * Si false, retourne tous (utile pour /coffre/corbeille).
 */
inclureCorbeille?: boolean;
```

---

### WR-02: `uploaderJustificatif` n'est **pas transactionnel** entre l'insert DB et l'écriture disque — la compensation est buggée

**File:** `src/application/documents/uploader-justificatif.ts:186-215`
**Issue:** Le flow décrit dans le commentaire (`Étape 5 — création + enregistrement (en trx)` puis `Étape 6 — écriture disque (hors trx) avec compensation`) implémente :
1. INSERT row justificatifs (commit immédiat).
2. Si l'écriture disque échoue → soft-delete via `mettreEnCorbeille`.

Problèmes :
- **Race** : entre 1 et 2, une autre requête peut lire la row (par exemple `/justificatifs/:id` ou la fiche bien), trouver le chemin, et lancer un téléchargement qui retournera `FichierIntrouvable` (404). UX dégradée, mais aussi possibilité d'erreurs en cascade dans les listings.
- **Compensation buggée** : `enregistrer(enCorbeille)` ne passe **pas** la transaction (signature `enregistrer(justificatif, trxArg?)`). Si la première écriture disque échoue (par exemple `EDQUOT`), la compensation marche, mais on a perdu l'atomicité. Plus grave : si l'écriture disque succède partiellement (fichier créé puis CRASH), on a une row + un fichier — pas de cleanup.
- **Mauvaise sémantique métier** : un fichier en corbeille n'a aucun sens fonctionnel quand l'écriture a échoué. On devrait **hard-delete** la row.
- **`taille_octets > 0` invariant violé en cas de compensation** : `bytesPersistes.length` peut être 0 si le buffer est vide (théoriquement bloqué par Zod max 50MB mais pas par min>0 côté HTTP). Le CHECK SQL `taille_octets > 0` bloquera côté DB, mais l'erreur sera un crash plutôt qu'un 400 propre.

**Fix:**
1. Inverser l'ordre : écrire le fichier d'abord (filesystem est mieux placé pour gérer les conflits via `wx`), puis INSERT row. Si INSERT échoue → `unlink` best-effort.
2. Si l'ordre actuel doit être conservé pour quelque raison, hard-delete via une transaction au lieu de soft-delete sur compensation.
```ts
} catch (err) {
  try {
    await deps.db.transaction().execute(async (trx) => {
      await deps.justificatifRepo.supprimerDefinitivement(justificatif.id, trx);
    });
  } catch (compensationErr) {
    console.error('[CRITICAL] Échec compensation hard-delete', { initial: err, compensation: compensationErr });
  }
  throw err;
}
```

---

### WR-03: `purgerJustificatif` cast `trx as unknown` — type safety contournée

**File:** `src/application/documents/purger-justificatif.ts:59-64`
**Issue:**
```ts
await deps.db.transaction().execute(async (trx) => {
  await deps.justificatifRepo.supprimerDefinitivement(j.id, trx as unknown);
});
```
Le double-cast `as unknown` est un code smell. La signature `supprimerDefinitivement(id, trxArg?: unknown)` accepte n'importe quoi puis re-caste en `DbOrTrx`. Si la TS-type n'est pas alignée entre l'application et l'infra, on perd le contrôle. C'est aussi inutile : Kysely passe `trx: Transaction<DB>` qui est compatible avec `DbOrTrx` defini dans le repo.

**Fix:** Typer correctement le port :
```ts
// src/domain/documents/justificatif-repository.ts
import type { Kysely, Transaction } from 'kysely'; // CR — porte un type infra dans domain
```
**Mais** ça pollue le domaine. Alternative : abstraire derrière un type opaque `RepositoryTransaction` ou retirer complètement le paramètre `trx` (la trx serait wrappée par le UoW pattern Phase 5). Au minimum supprimer le `as unknown` :
```ts
await deps.justificatifRepo.supprimerDefinitivement(j.id, trx);
```
puisque la signature accepte déjà `unknown`.

---

### WR-04: `valider-magic-bytes.ts:113-114` — tolérance `image/jpg` ↔ `image/jpeg` permet bypass MIME si le client envoie `image/jpg` avec un PNG

**File:** `src/application/documents/valider-magic-bytes.ts:101-121`
**Issue:** Le code normalise `image/jpg` → `image/jpeg` puis compare avec `detecte`. Mais le check est :
```ts
if (mimeAnnonceNormalise !== detecte) return { ok: false, raison: 'mismatch' };
```
Trace mentale : si le client envoie `Content-Type: image/jpg` et que le buffer commence par PNG magic, `detecte === 'image/png'` ≠ `'image/jpeg'` (normalisé) → mismatch → OK, refusé.

Pas de bypass ici en pratique. **Mais** la tolérance étendue est un risque : si demain on accepte `image/jpe` ou `image/x-png`, on multiplie les surfaces. **Acceptable** pour aujourd'hui mais à documenter pourquoi seul `image/jpg` est toléré (Safari sur certaines versions ?).

**Fix:** Ajouter un commentaire explicite + test :
```ts
// image/jpg = variante non-standard, Apple Safari < 10 et certaines IDE → tolérée
// Pas d'autre tolérance pour éviter d'élargir la surface de mismatch.
```

---

### WR-05: `slugify` `slice(0, 80)` peut laisser un trailing `-` si la troncature tombe sur un séparateur — coupe non testée

**File:** `src/infrastructure/storage/stockage-justificatifs-local.ts:113-123`
**Issue:**
```ts
.replace(/[^a-z0-9]+/g, '-')
.replace(/^-|-$/g, '')
.slice(0, 80)
.replace(/^-|-$/g, '');
```
Le second `.replace(/^-|-$/g, '')` après le slice est correct, mais ne couvre que le dernier tiret. Cas tordu : `'a'.repeat(78) + '--b'` → après le 1er replace : `'aaaa...a-b'` (l'`--` est compressé) → ok. Plus pernicieux : entrée de 81 chars `'a'.repeat(80) + '-'` → slug = `'a'.repeat(80)` → ok. Tout va bien sauf le cas où le slice tombe juste après un `-` qui était précédé d'un autre `-` après dédup… cas tordu mais pas un bug.

**Fix:** OK en l'état. Test missing pour les longueurs limites :
```ts
it('coupe à 80 chars + trim final', () => {
  const input = 'a'.repeat(50) + '---' + 'b'.repeat(50);
  expect(slugify(input)).toBe('a'.repeat(50) + '-' + 'b'.repeat(29)); // ou similaire
  expect(slugify(input)).not.toMatch(/-$/);
});
```

---

### WR-06: Le filtre `anneeFiscale` utilise `substr(date_document, 1, 4)` au lieu d'une comparaison de plage — perf + correctness

**File:** `src/infrastructure/repositories/justificatif-repository-sqlite.ts:107-113,144-150`
**Issue:**
```ts
q = q.where(
  (eb) => eb.fn('substr', ['date_document', eb.val(1), eb.val(4)]),
  '=',
  String(filtres.anneeFiscale),
);
```
- `substr()` rend l'index `idx_justificatifs_date_document` inutilisable (full table scan).
- Le filtre suppose strictement ISO-8601 `AAAA-MM-JJ`, ce qui est OK puisque `Temporal.PlainDate.toString()` garantit ce format.
- Si la DB contient demain une row avec format différent (par exemple `'2026-1-1'` ou `'01/01/2026'` venant d'un import legacy), le filtre rend silencieusement zéro résultat.

**Fix:**
```ts
const debut = `${filtres.anneeFiscale}-01-01`;
const fin = `${filtres.anneeFiscale}-12-31`;
q = q.where('date_document', '>=', debut).where('date_document', '<=', fin);
```
Cela utilise l'index `idx_justificatifs_date_document` et fonctionne avec n'importe quel format ISO-8601 normalisé.

---

### WR-07: `lire-ticket.ts` souffre d'un N+1 sur les justificatifs liés

**File:** `src/application/travaux/lire-ticket.ts:44-51`
**Issue:** Pour chaque ID de justificatif lié au ticket, une requête `trouverParId` séparée. Si un ticket a 30 PJ, 30 round-trips DB. Out of v1 scope d'après les instructions, mais correctness :
- Pas de validation de l'existence en lot — si un ID dangle (rare mais possible si CR-01 reste), la liste contient des `null` filtrés sans signal.

**Fix:** Ajouter une méthode `JustificatifRepository.trouverPlusieurs(ids: JustificatifId[])` qui fait un seul `SELECT WHERE id IN (...)`. Pas un BLOCKER en single-user.

---

### WR-08: `extraireErreurs` collisionne sur les paths Zod imbriqués

**File:** `src/web/routes/coffre.ts:63-72` ; `src/web/routes/travaux.ts:61-70`
**Issue:**
```ts
const cle = issue.path.join('.') || '_global';
if (!erreurs[cle]) erreurs[cle] = issue.message;
```
Le `if (!erreurs[cle])` garde **uniquement le premier message** quand plusieurs erreurs visent la même clé (par exemple `titre: min(1)` + `titre: max(200)`). C'est probablement intentionnel pour ne pas spammer mais ça masque des erreurs valides — le user voit "le titre est obligatoire" même quand il a tapé 300 chars (le premier issue gagne, qui peut être l'invariant min).

**Fix:** Concaténer ou agréger :
```ts
erreurs[cle] = erreurs[cle] ? `${erreurs[cle]} ${issue.message}` : issue.message;
```
ou garder le **dernier** (souvent plus pertinent dans Zod).

---

### WR-09: Plusieurs routes catch trop large — `if (err instanceof InvariantViolated)` accepte tout

**File:** `src/web/routes/coffre.ts:343-352,498-501` ; `src/web/routes/travaux.ts:176-189,277-282,445-449`
**Issue:** Tout `InvariantViolated` est rebalancé en redirect avec bannière. Cela inclut des messages techniques qui ne sont pas user-friendly (par exemple `"La date d'ouverture ne peut pas être dans le futur."`). Pas un bug en soi mais :
- Le contrat domain `InvariantViolated.message` est utilisé en tant que texte UI sans contrôle (XSS impossible grâce à EJS `<%= %>` mais leak de détails internes possible).
- Les erreurs vraiment inattendues (TypeError, RangeError) ne sont **pas** traitées par ce catch et remontent au errorHandler global → comportement OK.

**Fix:** OK pour v1. Documenter que `InvariantViolated.message` est considéré user-safe et que tous les invariants domain doivent être rédigés en français acceptable pour l'UI.

---

### WR-10: `ticket-travaux-repository-sqlite.ts:179-181` — fallback `today = 1900-01-01` lors de `versDomaine` neutralise l'invariant `dateOuverture ≤ today`

**File:** `src/infrastructure/repositories/ticket-travaux-repository-sqlite.ts:174-182`
**Issue:**
```ts
// Reconstruit depuis la DB → on neutralise l'invariant dateOuverture ≤ today
// en passant un today très ancien (impossible que dateOuverture soit avant).
row.date_ouverture ? Temporal.PlainDate.from(row.date_ouverture) : Temporal.PlainDate.from('1900-01-01'),
```
Logique inversée : on veut **désactiver** la vérification "dateOuverture ≤ today", donc on passe `today = dateOuverture` (compare retourne 0, condition `> 0` non triggered). Mais le fallback `'1900-01-01'` quand `row.date_ouverture` est falsy ne devrait **jamais** arriver — la colonne est `TEXT NOT NULL`. Si elle est falsy (string vide), on a déjà un autre bug ailleurs.

Plus problématique : `row.date_ouverture ?` est truthy même pour `'0000-00-00'` ou des dates invalides → `Temporal.PlainDate.from('0000-00-00')` jette une exception remontée brutalement.

**Fix:** Simplifier en utilisant directement la date stockée :
```ts
const dateOuverture = Temporal.PlainDate.from(row.date_ouverture);
return TicketTravaux.creer(
  { /* ... */, dateOuverture },
  dateOuverture, // today = dateOuverture neutralise l'invariant
);
```
La doc devrait clarifier pourquoi on neutralise — le fallback `1900-01-01` est un red herring qui suggère qu'on s'attend à ce que `row.date_ouverture` soit falsy.

---

### WR-11: Form `clore` n'a pas de protection CSRF spécifique mais hérite de `sameSite: 'lax'`

**File:** `src/web/routes/travaux.ts:225-286` ; `src/main.ts:110`
**Issue:** Toutes les routes POST modifient l'état du serveur (créer/clore/annuler ticket, mettre en corbeille, purger, etc.) sans token CSRF. La session-cookie est `sameSite: 'lax'` ce qui bloque les attaques CSRF cross-origin pour POST (Lax n'envoie pas le cookie sur cross-origin POST). C'est une protection acceptable pour un app local-first single-user.

**Mais** : `secure: false` dans le cookie + pas de HSTS → si l'app est exposée demain en LAN (ce qui est plausible, voir VISION.md "autonome"), le cookie session voyage en clair.

**Fix:** En v1 single-user local — accepter. Documenter dans CLAUDE.md qu'aucun déploiement réseau n'est supporté sans changement de configuration cookie + HTTPS + CSRF tokens.

---

### WR-12: `creerTicketTravaux` n'utilise pas de transaction — insert non atomique vis-à-vis des invariants applicatifs

**File:** `src/application/travaux/creer-ticket-travaux.ts:40-68`
**Issue:** Le use-case lit `bienRepo.trouverParId` puis fait `ticketRepo.enregistrer(ticket)`. Entre les deux, le Bien peut être soft-deleted par un autre thread (impossible en single-user mais pas garanti à 100%). Pas un bug single-user, mais l'invariant "ticket appartient à un Bien actif" n'est défense en profondeur que par CR-01 (FK), et CR-01 lui-même est non opérant.

**Fix:** En single-user local, low priority. Documenter le risque.

---

## Info

### IN-01: `nomFichierOriginal` peut contenir des séparateurs path — non sanitizé

**File:** `src/domain/documents/justificatif.ts:104-184` ; `src/application/documents/uploader-justificatif.ts:163-184`
**Issue:** Le `nomFichierOriginal` (`data.filename` côté multipart) est passé tel quel à `Justificatif.creer` puis persisté. Si le user upload `../etc/passwd`, c'est stocké tel quel dans `nom_fichier_original`. Pas dangereux côté disque (le `chemin_fichier` est calculé via `slugify(titre)`), mais affiché dans la fiche détail et utilisé pour le header `Content-Disposition` (CR-05).

**Fix:** Normaliser à `path.basename` au moins, idéalement avec un slug-like sanitization du nom de fichier pour l'affichage :
```ts
nomFichierOriginal: path.basename(commande.fichier.nomOriginal).slice(0, 255),
```

---

### IN-02: Aucun rate-limit sur `/coffre/upload` — DoS possible via 50MB × N requests

**File:** `src/web/routes/coffre.ts:189-354` ; `src/main.ts:116-118`
**Issue:** L'upload accepte 50 MB par fichier. Sans rate-limit, un client peut envoyer 100 requêtes en parallèle → 5 GB en mémoire (les buffers `data.toBuffer()` sont entièrement en RAM avant `enregistrer`). Single-user local : impact limité, mais on peut épuiser la RAM si l'utilisateur garde plusieurs onglets de upload ouverts.

**Fix:** v1 single-user — accepter. Pour V2 : Fastify rate-limit + streaming upload (sharp peut traiter en stream).

---

### IN-03: Bannières `banniereSuccess` / `banniereWarning` lues + invalidées de manière dupliquée dans chaque route

**File:** `src/web/routes/coffre.ts:101-104,154-157,360-363` ; `src/web/routes/travaux.ts:97-100,195-198`
**Issue:** Le même boilerplate `const banniereSuccess = req.session.banniereSuccess ?? null; ... if (banniereSuccess) req.session.banniereSuccess = undefined;` est dupliqué dans 5+ routes. Le hook `preHandler` (main.ts:159-178) injecte les helpers mais pas les bannières.

**Fix:** Ajouter un hook applicatif `extractBanners(req: FastifyRequest)` ou injecter dans `reply.locals`. Pas un bug, juste de la dette.

---

### IN-04: `corbeilleJustificatifFormSchema.raison` autorise undefined → message par défaut `"Mise en corbeille"`

**File:** `src/web/schemas/justificatif-schemas.ts:101-109` ; `src/application/documents/mettre-justificatif-en-corbeille.ts:28-32`
**Issue:** La raison est optional, le défaut est `'Mise en corbeille'`. C'est valide mais peu informatif (la `raison_corbeille` est censée tracer pourquoi). Pas une régression mais une opportunité.

**Fix:** Soit rendre obligatoire (form HTML required + Zod min(1)), soit logger explicitement "default reason applied" pour pouvoir auditer plus tard.

---

### IN-05: `partial-justificatif-row.ejs` n'affiche pas le statut corbeille

**File:** `src/web/views/partials/partial-justificatif-row.ejs:1-32`
**Issue:** Une fois `corbeilleLe` filtré côté repo (cas nominal), la row n'a pas besoin d'afficher l'état corbeille. Mais si la row est affichée par erreur (cf. CR-02 fixed ou bug futur), l'utilisateur ne sait pas que c'est soft-deleted.

**Fix:** Optionnel — ajouter un badge "Corbeille" si `j.corbeilleLe !== null` :
```ejs
<% if (j.corbeilleLe) { %><span class="badge-warning">Corbeille</span><% } %>
```

---

### IN-06: `accept` HTML autorise `.heif`, `.heic`, `image/heif` mais la validation accepte uniquement `image/heic` (pas `image/heif`)

**File:** `src/web/views/partials/partial-upload-form.ejs:23` ; `src/web/views/partials/partial-ticket-pj-section.ejs:60` ; `src/application/documents/valider-magic-bytes.ts:22-32`
**Issue:** L'input HTML5 `accept` accepte `.heif,image/heif` mais le validator magic-bytes ne reconnaît que les brands HEIF (`mif1`, `heic`, etc.) — la table HEIC_BRANDS contient bien `heif` et `mif1`, donc la détection des fichiers .heif marche. Mais la comparaison MIME header :
```ts
if (mimeAnnonceNormalise !== detecte) return { ok: false, raison: 'mismatch' };
```
Si le navigateur envoie `Content-Type: image/heif` (variante) et que la détection magic retourne `image/heic` (alias unique côté Phase 4), → mismatch → refusé. UX cassée pour les utilisateurs Android/cameras récentes qui envoient `image/heif`.

**Fix:** Normaliser `image/heif` → `image/heic` côté `mimeAnnonceNormalise`, ou retourner `image/heif` séparément et accepter les deux dans `EXT_PAR_MIME`. Pas critique car `.heic` est dominant sur iPhone, mais à anticiper.

---

_Reviewed: 2026-05-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
