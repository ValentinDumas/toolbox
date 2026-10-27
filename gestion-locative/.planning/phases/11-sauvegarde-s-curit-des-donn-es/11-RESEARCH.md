# Phase 11: Sauvegarde & sécurité des données - Research

**Researched:** 2026-10-27
**Domain:** chiffrement SQLite au repos (SQLite3MultipleCiphers), enveloppe de clé, archive chiffrée, RGPD bailleur particulier
**Confidence:** HIGH sur pilote/crypto (sources primaires + exécution locale), MEDIUM sur durées légales RGPD

## User Constraints

Copié de `11-CONTEXT.md` — le planner DOIT les honorer.

### Locked Decisions
- **D-01** Écran de déverrouillage web ; serveur démarre verrouillé ; toute route → `/deverrouiller` ; clé en mémoire du process uniquement (jamais disque/log/session/cookie).
- **D-02** Enveloppe : clé maîtresse aléatoire 256 bits passée en clé brute ; `cle.json` à côté de `db.sqlite` contient la clé maîtresse chiffrée AES-256-GCM deux fois (sous KDF(passphrase) et sous clé de secours affichée une seule fois). One-way.
- **D-03** « Passphrase oubliée » → clé de secours → nouvelle passphrase (re-wrap). Aucun autre canal.
- **D-04** Base absente → création (passphrase + confirmation, ≥ 12 caractères, aucune autre règle) puis clé de secours avec case « je l'ai conservée » obligatoire. Base en clair existante → même parcours puis migration vérifiée (integrity_check + comptage par table), renommage atomique, suppression du clair. Limite affichée : pas d'effacement sécurisé, recommander FileVault/BitLocker. One-way.
- **D-05** Pilote SQLCipher délégué à la recherche (tranché ci-dessous) ; les tests `:memory:` tournent sans clé.
- **D-06** `documents/` reste en clair sur disque ; l'archive est entièrement chiffrée.
- **D-07** Sauvegarde manuelle, téléchargement navigateur, pas de champ dossier.
- **D-08** Archive unique `gestion-locative-sauvegarde-AAAA-MM-JJ-HHmm.glbak` : en-tête clair (magic, version, `cle.json` embarqué) + charge chiffrée sous clé dérivée de la clé maîtresse : copie cohérente de la base, `documents/`, `manifest.json` (version format, version app, version schéma, date, SHA-256 par fichier). One-way.
- **D-09** Archive automatique avant migration de schéma dans `<dossier données>/sauvegardes/`, rétention 5 ; pas pour la migration clair → chiffré.
- **D-10** Restauration par upload, passphrase **de l'archive** ou sa clé de secours, vérification complète en dossier temporaire (tag, SHA-256 vs manifest, integrity_check, version schéma ≤ courante) ; tout échec → refus, aucune modification.
- **D-11** Bascule : archive de sécurité de l'état courant, remplacement atomique base + `cle.json` + `documents/`, migrations si archive plus ancienne, retour à l'écran de déverrouillage ; schéma plus récent → refus.
- **D-12** BDD obligatoires : archive corrompue (octet modifié, tronquée, manifest falsifié) + restore drill aller-retour.
- **D-13** Effacement = anonymisation (identité neutralisée) seulement si aucun bail en cours ; montants/dates/écritures conservés ; PDF émis conservés jusqu'à leur durée légale (affiché) ; confirmation, irréversible, tracé. One-way.
- **D-14** Pas de purge automatique des PDF ; l'écran affiche les dates de fin de conservation ; purge manuelle via le coffre.
- **D-15** Note d'information locataire = PDF généré par le pipeline existant (RGPD art. 13), texte versionné, sources citées.
- **D-16** Registre = page + PDF/CSV, fiche unique au format CNIL simplifié (art. 30), pré-remplie.
- **D-17** `RGPD.md` racine, référencé dans `CLAUDE.md` et `README.md` ; `RISKS.md` R3.1–R3.4 mis à jour dans le même commit.

### Claude's Discretion
KDF et paramètres, pilote (D-05), format de clé de secours, emplacement de la page Sauvegarde, libellés UI (UX_DESIGN, ACCESSIBILITY).

### Deferred Ideas (hors périmètre)
Sauvegarde planifiée, alerte « dernière sauvegarde », verrouillage auto/manuel, changement volontaire de passphrase, trousseau OS, chiffrement de `documents/`, purge automatique à échéance.

## Summary

`better-sqlite3-multiple-ciphers` (bs3mc) 13.0.3 est un remplaçant direct de `better-sqlite3` sous Kysely `SqliteDialect` (seuls `close()` et `prepare()` sont utilisés), embarque SQLite3MultipleCiphers 2.4.0, des binaires Node-API précompilés pour les 4 cibles Phase 12 dans le tarball, sans script d'installation. Le schéma `sqlcipher` en `legacy=4` produit de vrais fichiers SQLCipher 4 (honore le libellé « SQLCipher » des critères de succès et offre une issue de secours via l'outil `sqlcipher`).

Deux recettes de CONTEXT ne sont pas réalisables telles quelles : `sqlcipher_export()` n'existe pas dans SQLite3MC (D-04 → `VACUUM INTO` + `PRAGMA rekey`), et l'API backup de better-sqlite3 échoue sur une base chiffrée (D-08 → `VACUUM INTO` uniquement, qui produit une copie chiffrée sous la même clé maîtresse). Un mauvais `PRAGMA key` ne lève rien : l'erreur `SQLITE_NOTADB` n'apparaît qu'à la première requête et est indiscernable d'une corruption — le message « passphrase incorrecte » doit donc venir de l'échec du déchiffrement GCM de `cle.json`, jamais de SQLite.

Node 22 n'a pas `crypto.argon2` (ajouté en 24.7.0) : KDF = `crypto.scrypt` N=2^17, r=8, p=1, `maxmem` 256 MiB (181 ms mesurés), paramètres stockés dans `cle.json` pour migrer vers Argon2id plus tard. Archive : AES-256-GCM en segments de 64 KiB (construction STREAM type age/Tink) sous clé HKDF par archive, conteneur maison à préfixe de longueur (pas de `tar` : 15 advisories ; `tar-stream` SUS).

**Primary recommendation:** bs3mc 13.0.3 via alias pnpm `better-sqlite3` (zéro churn sur 73 imports), clé brute par `pragma`, enveloppe AES-256-GCM + scrypt dans `cle.json`, clé de secours 12 mots BIP-39 français (`@scure/bip39`), archive STREAM-GCM + conteneur maison, connexion commutable sous Kysely pour le démarrage verrouillé.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Règle passphrase (≥ 12), nommage/rétention/compatibilité de schéma des archives, manifeste | domain (`src/domain/sauvegarde/`, `src/domain/securite/`) | — | Règles pures, couverture 100 % exigée |
| Prédicat bail en cours, anonymisation `Locataire`, dates de fin de conservation | domain (`src/domain/locatif/`) | application (use case transactionnel) | Ubiquitous language, domaine pur |
| Contenu note d'information (art. 13) et fiche registre (art. 30) | domain (`src/domain/rgpd/`) | infrastructure/pdf (doc-defs pdfmake), web (CSV) | Texte versionné testable sans pdfmake |
| Ouverture chiffrée, enveloppe de clé, clé de secours, archive `.glbak` | infrastructure (`src/infrastructure/chiffrement/`, `src/infrastructure/sauvegarde/`) | — | node:crypto / fs / SQLite = adaptateurs (dependency-cruiser interdit au domaine) |
| Démarrage verrouillé, déverrouillage, sauvegarde/restauration | web (routes) → infrastructure | — | Précédent : `racine.ts` appelle `infrastructure/lifecycle` directement |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3-multiple-ciphers | 13.0.3 (2026-08-07) | SQLite + SQLite3MC 2.4.0, chiffrement transparent | API better-sqlite3 identique, Node-API prebuilt 4 plateformes, MIT, maintenu par l'auteur de better-sqlite3 [VERIFIED: npm, GitHub releases] |
| @scure/bip39 | (npm view à l'install) | clé de secours 128 bits ↔ 12 mots, liste française, checksum | Lib auditée, sans dépendance native [VERIFIED: package-legitimacy OK] |
| node:crypto (intégré) | Node 22.22.3 | scrypt, AES-256-GCM, HKDF, SHA-256, randomBytes | Pas de dépendance ; pas d'Argon2 avant Node 24.7 [VERIFIED: exécution locale] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bs3mc 13.0.3 + correctif types | 13.0.4-beta.0 (types corrigés) | Bêta en production : refusé |
| scrypt | `argon2` / `@node-rs/argon2` / `hash-wasm` | Binaire natif supplémentaire (pas de darwin-x64 pour `argon2`) ou async WASM non maintenu depuis 2024 |
| conteneur maison | `tar` 7.5.22 / `tar-stream` 3.2.2 / `yazl`+`yauzl` | `tar` : 15 advisories (traversal) ; `tar-stream` SUS (version trop récente) ; zip : 2 libs callback |
| BIP-39 français | Crockford Base32 + symbole de contrôle mod-37 | Repli sans dépendance si `@scure/bip39` refusé |
| `@journeyapps/sqlcipher`, `@signalapp/better-sqlite3`, `node:sqlite` | — | API async incompatible Kysely sync / build node-gyp / pas de chiffrement |

**Installation (alias = imports `better-sqlite3` inchangés) :**
```bash
pnpm add better-sqlite3@npm:better-sqlite3-multiple-ciphers@13.0.3 @scure/bip39
```
`@types/better-sqlite3` reste en devDependency : le paquet aliasé n'expose pas `types` dans son `exports` (TS7016 sous NodeNext, PR #141 non publiée en stable) → TypeScript retombe sur `@types/better-sqlite3`. Conséquence : n'utiliser que `db.pragma(...)` pour la clé (pas `db.key()`, absent des types DefinitelyTyped).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| better-sqlite3-multiple-ciphers | npm | 13.0.3 du 2026-08-07, projet depuis 2021 | 65k/sem | github.com/m4heshd/better-sqlite3-multiple-ciphers | [OK] | Approved |
| @scure/bip39 | npm | plusieurs années | élevé | github.com/paulmillr/scure-bip39 | [OK] | Approved |
| @scure/base | npm | — | — | github.com/paulmillr/scure-base | [OK] | Approved (dépendance transitive) |
| tar-stream | npm | 3.2.2 du 2026-10-02 | — | github.com/mafintosh/tar-stream | [SUS] | Non retenu |
| hash-wasm, argon2, tar, yazl, yauzl, @journeyapps/sqlcipher | npm | — | — | — | [OK] | Comparés seulement, non installés |
| @node-rs/argon2 | npm | 2026-10-06 | — | — | [SUS] | Non retenu |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** tar-stream, @node-rs/argon2 — aucun n'est installé.

## Architecture Patterns

### System Architecture Diagram

```
navigateur ──HTTP──▶ Fastify onRequest
                      ├─ garde origine (POST/PUT/DELETE : Origin/Host locaux sinon 403)
                      └─ verrou : base fermée ? → 303 /deverrouiller (exempte /deverrouiller*, /styles, /scripts, assets)
/deverrouiller ──▶ PorteBase.deverrouiller(passphrase)
     cle.json ──scrypt+GCM unwrap──▶ clé maîtresse (échec tag = "passphrase incorrecte")
     db.sqlite ──pragma cipher/legacy/key──▶ sonde SELECT (NOTADB = cle.json ≠ base ou corruption)
     migrations en attente ? ──oui──▶ archive pré-migration (D-09, rétention 5) ──▶ appliquerToutesMigrations
     ConnexionCommutable.brancher(handle) ──▶ Kysely (créé une fois au boot) sert les routes
/sauvegarde ──▶ VACUUM INTO tmp (copie chiffrée cohérente) + documents/ + manifest
     ──conteneur maison──▶ STREAM AES-256-GCM (clé HKDF(clé maîtresse, sel)) ──▶ .glbak téléchargé
/sauvegarde/restaurer (upload) ──▶ en-tête + cle.json embarqué ──unwrap (passphrase archive ou secours)──▶
     déchiffrement segment par segment dans tmp ──▶ chemins sûrs, SHA-256 vs manifest, ensemble exact,
     integrity_check, version schéma ≤ courante ──ok──▶ archive de sécurité de l'état courant
     ──▶ PorteBase.verrouiller() ──▶ renommages atomiques ──▶ écran de déverrouillage
```

### Recommended Project Structure
```
src/domain/securite/          # politique passphrase (longueur ≥ 12)
src/domain/sauvegarde/        # manifeste, nommage archive, rétention, compatibilité schéma
src/domain/rgpd/              # contenu note art. 13, fiche registre art. 30, durées de conservation
src/domain/locatif/           # + anonymisation Locataire, prédicat bail en cours
src/application/locatif/      # + effacer-donnees-personnelles-locataire.ts (transaction)
src/infrastructure/chiffrement/  # base-chiffree.ts, enveloppe-cle.ts, cle-secours.ts, connexion-commutable.ts, porte-base.ts
src/infrastructure/sauvegarde/   # conteneur.ts, flux-chiffre.ts, archive-glbak.ts, service-sauvegarde.ts, restauration.ts
src/web/routes/               # deverrouillage.ts, sauvegarde.ts, rgpd.ts (+ locataires.ts)
```

### Pattern 1: Ouverture chiffrée
Ordre impératif, hors transaction, rien avant la clé (depuis SQLite 3.48 tout SELECT lit le fichier) :
`pragma("cipher='sqlcipher'")` → `pragma('legacy=4')` → `pragma(\`key="x'${hex}'"\`)` après assertion `/^[0-9a-f]{64}$/` (sinon traité silencieusement comme passphrase PBKDF2) → sonde `SELECT count(*) FROM sqlite_master` (map `SQLITE_NOTADB`) → `journal_mode=WAL`, `foreign_keys=ON` (via `activerPragmas`), `temp_store=MEMORY` (fichiers temporaires non chiffrés avant SQLite3MC 2.6) → assertion `SELECT sqlite3mc_version()` non nul (garde contre un autre build SQLite chargé dans le process). Bases `:memory:` sans clé inchangées.

### Pattern 2: Migration clair → chiffré (D-04)
`wal_checkpoint(TRUNCATE)` → `VACUUM INTO '<tmp>'` (copie claire) → ouvrir tmp, `journal_mode=DELETE`, pragmas cipher, `PRAGMA rekey="x'…'"` hors transaction → rouvrir avec la clé, `integrity_check` = ok, comptage de lignes identique par table → `journal_mode=WAL` → `fs.renameSync` atomique → suppression du clair + `-wal` + `-shm`. Vérifier que l'en-tête du fichier final n'est pas `SQLite format 3\0`.

### Pattern 3: Enveloppe `cle.json` v1
`{ v:1, cipher:"sqlcipher", legacy:4, kdf:{alg:"scrypt",N:131072,r:8,p:1,sel}, enveloppes:{ passphrase:{iv,tag,ct}, secours:{sel,iv,tag,ct} } }` (base64). KEK passphrase = `scrypt(passphrase.normalize('NFC'), sel16, 32, {N:2**17,r:8,p:1,maxmem:256*2**20})` (async). KEK secours = `hkdfSync('sha256', entropie128, sel32, 'gestion-locative/recovery-kek/v1', 32)`. Wrap AES-256-GCM, IV 12 octets aléatoire, `authTagLength:16`, AAD = octets canoniques de `{v, nom d'enveloppe, paramètres KDF}`. Nouveaux sel et IV à chaque re-wrap. Écriture atomique (tmp + rename).

### Pattern 4: Archive `.glbak` v1
En-tête clair : magic `GLBAK\0`, version u16, longueur + octets de `cle.json`, sel HKDF 32 octets, taille de segment. Clé charge = `hkdfSync('sha256', cléMaîtresse, sel, 'gestion-locative/glbak/v1/payload', 32)`. Charge : segments 64 KiB AES-256-GCM, nonce = compteur 11 octets big-endian + 1 octet drapeau dernier segment, AAD = SHA-256(en-tête) ; EOF sans segment final valide = erreur. Conteneur : enregistrements `u8 type | u16 longueur | chemin (NFC, posix, relatif) | u64 taille | octets`, `manifest.json` en dernier, puis marqueur de fin. Lecture : chemins `..`, absolus, lettres de lecteur, NUL refusés ; ensemble extrait == manifest ; SHA-256 calculé à l'écriture.

### Pattern 5: Connexion commutable (démarrage verrouillé)
Kysely `SqliteDialect` n'appelle que `prepare()` et `close()`. Un adaptateur `ConnexionCommutable` implémente ces deux méthodes en déléguant au handle courant et lève `BaseVerrouillee` sans handle. Kysely est construit une fois au boot ; `creerApp(db)` reste inchangé ; déverrouiller = `brancher(handle)`, restaurer = `debrancher()`. Vérifié : `RuntimeDriver.init` remet `#initPromise` à undefined en cas d'échec (`node_modules/kysely/dist/esm/driver/runtime-driver.js:31`) et `SqliteDriver.init` accepte une fonction `database` paresseuse.

### Anti-Patterns to Avoid
- `db.backup()` sur base chiffrée : échoue (« backup is not supported with incompatible source and target databases »).
- Écrire `db.serialize()` sur disque : image **déchiffrée**.
- `VACUUM INTO 'file:…?key=…'` : URIs désactivées dans ce build.
- Déduire « passphrase incorrecte » d'une erreur SQLite.
- Exploiter la sortie de `decipher.update()` avant `final()`/segment authentifié.
- Clé hex ≠ 64 caractères : traitée comme passphrase sans erreur.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chiffrement de pages SQLite | chiffrement applicatif des colonnes | SQLite3MC (bs3mc) | WAL, index, journaux couverts |
| KDF | itérations SHA maison | `crypto.scrypt` paramètres OWASP | Résistance mémoire |
| Encodage clé de secours + checksum | liste de mots maison | `@scure/bip39` liste française | Checksum, mots uniques sur 4 lettres |
| AEAD streaming | GCM unique sur fichier entier | construction STREAM (age/Tink) | Authenticité par segment, troncature détectée, pas de plafond 64 GiB |

**Key insight:** le conteneur est volontairement maison (5 champs, synchrone) car les libs tar portent la surface d'attaque (traversal) que la restauration doit justement fermer ; le reste de la crypto vient de `node:crypto` et de libs auditées.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `db.sqlite` en clair des installations v1.0 (`cheminBaseParDefaut()`), `-wal`/`-shm` | Migration D-04 au premier déverrouillage |
| Live service config | Aucun — vérifié (app locale, pas de service) | — |
| OS-registered state | Pidfile `gestion-locative.pid` (dossier de la base) | `verifierDejaLance` reste avant le verrou |
| Secrets/env vars | `SESSION_SECRET` (inchangé) ; nouvelle clé jamais en env | — |
| Build artifacts | `node_modules/better-sqlite3` (binaire v11) | Réinstaller via alias ; suite complète |
| Chemins | `documents/` = `GESTION_LOCATIVE_DATA_DIR` ou défaut **macOS codé en dur** dans `creerApp` (main.ts §167-185, deux fois), base = `cheminBaseParDefaut()` (par plateforme) | Calculer une seule fois `dossierDocuments` dans `demarrer` et le passer aux stockages + sauvegarde |

## Codebase Findings (vérifiés)

- `src/main.ts` `demarrer()` : `verifierDejaLance` → `ouvrirDb` → `appliquerToutesMigrations` → `creerApp(db)` → `listen`. Deux CLI `migrate` (dans `demarrer` et `database.ts interfaceCli`, script `db:migrate`) ouvrent la base sans clé → à retirer (les migrations tournent au déverrouillage), `package.json` et README à mettre à jour.
- Version de schéma = migrations appliquées dans `meta` (`migration_<fichier>.sql` = `appliquee`) ; dernière migration livrée : `0023_phase6_declaration_cfe.sql` → prochaine `0024_…`.
- **CSRF absent** : `@fastify/csrf-protection` est en dépendance et cité dans des commentaires (`fiscalite/qualification.ts:57`, `revenus-foyer.ts:9`) mais jamais enregistré. Les nouvelles routes destructrices (restauration, effacement, réinitialisation) imposent une garde `Origin`/`Host` (anti-CSRF + DNS rebinding) sur les méthodes non sûres.
- `Locataire.creer` valide email/nationalité/date passée/lieu ; le repository réhydrate via `creer` ; toutes les colonnes d'identité sont `NOT NULL` (`0001_init.sql:33`). Anonymisation = valeurs neutres conformes aux invariants + colonne `anonymise_le` (patron `annule_le`/`supprime_le` déjà présent), pas de reconstruction de table.
- Aucun ledger d'opérations n'existe (grep `ledger|journal` vide) : la trace D-13 = `anonymise_le` sur la ligne + affichage sur la fiche.
- Prédicat « bail en cours » (D-13) : un meublé se reconduit tacitement (`LOCATION_MEUBLEE_REGLES.md` §3) donc `dateFinBail` ne prouve pas la fin. Retenu : `bail.actifDepuis !== null && edlRepo.trouverActifParBailEtType(bailId,'sortie') === null`. Date de fin effective = `dateEdl` de l'EDL de sortie.
- `purgerJustificatif` refuse avant 10 ans (`PurgeAvantDixAnsRefusee`) : l'effacement ne supprime pas de justificatif (cohérent D-14).
- Garant (`Cautionnement.garant` : nom, prénom, email, téléphone, adresse) = donnée personnelle hors D-13 : non traité, signalé (Open Questions).
- Pipeline PDF : port domaine `XxxBuilder.construire(...) : unknown` + `*-doc-def.ts` + `*-builder-pdfmake.ts` + `PdfRendererPdfmake.genererBuffer` ; route renvoie `Content-Disposition: attachment`.
- Tests : vitest (`tests/unit`, `tests/integration`), cucumber (`tests/bdd/features`, `step_definitions`, mondes `tests/_world/monde-phase*.ts` construisant `creerApp` sur `:memory:`), couverture domaine 100 % (`vitest.config.ts`).

## Common Pitfalls

### Pitfall 1: clé silencieusement ignorée
**What goes wrong:** base créée en clair alors qu'on croit chiffrer. **Why:** hex mal formé ou autre build SQLite chargé. **How to avoid:** assertion regex, `sqlite3mc_version()`, test d'intégration qui relit l'en-tête du fichier (≠ `SQLite format 3\0`). **Warning signs:** `strings db.sqlite` montre des noms de tables.

### Pitfall 2: rekey en mode WAL ou en transaction
**How to avoid:** `journal_mode=DELETE` avant `rekey` sur une base en clair ; jamais dans `db.transaction()`.

### Pitfall 3: fichiers temporaires en clair
**How to avoid:** `PRAGMA temp_store=MEMORY` à chaque ouverture.

### Pitfall 4: `maxmem` scrypt
**What goes wrong:** `ERR_CRYPTO_INVALID_SCRYPT_PARAMS` avec N=2^17. **How to avoid:** `maxmem: 256 * 2**20`.

### Pitfall 5: montée de version better-sqlite3 11 → 13
**How to avoid:** suite complète (`pnpm test`, `pnpm test:bdd`, `pnpm typecheck`) juste après l'alias ; aucun autre changement dans la même tâche.

### Pitfall 6: Linux glibc
bs3mc 13 exige glibc ≥ 2.35 (Ubuntu 22.04+) — à reporter dans les prérequis Phase 12.

## Code Examples

Sources : SQLite3MC config_sql_pragmas, Node crypto docs.
```typescript
// ouverture (Pattern 1)
sqlite.pragma("cipher='sqlcipher'");
sqlite.pragma('legacy=4');
sqlite.pragma(`key="x'${cleHex}'"`);
sqlite.prepare('SELECT count(*) FROM sqlite_master').get(); // SQLITE_NOTADB si mauvaise clé/corruption
// KDF
const kek = await scryptAsync(passphrase.normalize('NFC'), sel, 32, { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 2 ** 20 });
// GCM
const c = createCipheriv('aes-256-gcm', kek, iv, { authTagLength: 16 }); c.setAAD(aad);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| bs3mc prebuild-install/node-gyp (v11-12) | binaires Node-API dans le tarball (v13) | 2026 | Packaging Phase 12 sans toolchain |
| scrypt | Argon2id natif (`crypto.argon2`) | Node 24.7 | `cle.json` versionne le KDF pour migrer |
| GCM `authTagLength` implicite | `authTagLength:16` obligatoire | déprécié Node 22, interdit Node 26 | Toujours le passer |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `node:sqlite` sans chiffrement | Stack | Faible |
| A2 | `VACUUM INTO` hérite clé + schéma en WAL avec legacy=4 | Pattern 4 | Moyen — test d'intégration : rouvrir la copie avec la clé + en-tête ≠ clair |
| A3 | En-tête `SQLite format 3\0` ⇔ fichier en clair | Pattern 2 | Faible |
| A4 | Node Linux officiel n'exporte pas de symboles `sqlite3_*` concurrents | Pitfall 1 | Moyen — couvert par l'assertion `sqlite3mc_version()` |
| A5 | LMNP non commerçant : L123-22 (10 ans) non opposable, LPF L102 B (6 ans) l'est ; le code garde 10 ans par prudence | RGPD | Faible/juridique |
| A6 | Gestion locative = traitement non occasionnel ⇒ registre art. 30 requis | RGPD | Faible |
| A7 | Normalisation NFC de la passphrase évite les écarts macOS/Windows | Pattern 3 | Faible |

## Open Questions

1. **Anonymisation vs pseudonymisation (CNIL référentiel §57).**
   - What we know : neutraliser l'identité en gardant montants et liens = pseudonymisation au sens CNIL ; conservation justifiée par art. 17.3(b) (obligation légale) et 17.3(e) (contentieux).
   - Recommendation : libellés UI et `RGPD.md` disent « données d'identité effacées, pièces comptables conservées (art. 17.3 b/e) » ; afficher la date de fin de conservation. Pas de nouveau périmètre.
2. **Garant (cautionnement).** Données personnelles d'un tiers stockées sur le Bail, hors D-13. Recommendation : ne pas l'inclure (décision verrouillée limitée au Locataire), le documenter comme limite dans `RGPD.md`, à confirmer par l'user.
3. **Compléments art. 13 à D-15.** La note doit aussi couvrir : droit à la portabilité, caractère contractuel/légal de la fourniture des données et conséquence d'un refus (13.2.e), absence de décision automatisée (13.2.f), intérêt légitime si invoqué (recouvrement d'impayés, 6.1.f). Recommendation : les inclure — exigence de l'article cité par D-15, pas une extension.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | tout | ✓ | 22.22.3 | — |
| pnpm | install | ✓ | 9.15.9 | — |
| better-sqlite3-multiple-ciphers | BAK-02 | à installer | 13.0.3 | — |
| @scure/bip39 | D-02/D-03 | à installer | stable | Crockford Base32 + mod-37 |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3 + @cucumber/cucumber 11 |
| Config file | `vitest.config.ts`, `cucumber.json` |
| Quick run command | `pnpm vitest run tests/unit tests/integration` |
| Full suite command | `pnpm typecheck && pnpm test && pnpm test:bdd && pnpm lint:deps` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BAK-02 | base chiffrée, ouverture sans clé/avec mauvaise clé échoue, migration clair → chiffré vérifiée | integration | `pnpm vitest run tests/integration/chiffrement` | ❌ Wave 0 |
| BAK-02 | enveloppe, scrypt, clé de secours, re-wrap | integration | `pnpm vitest run tests/integration/chiffrement` | ❌ |
| BAK-02 | démarrage verrouillé, création, déverrouillage, passphrase oubliée | bdd | `pnpm test:bdd -- tests/bdd/features/deverrouillage.feature` | ❌ |
| BAK-01 | manifeste, nommage, rétention, compatibilité schéma | unit | `pnpm vitest run tests/unit/sauvegarde` | ❌ |
| BAK-01 | archive corrompue (octet, troncature, manifest falsifié) refusée sans effet ; restore drill | bdd + integration | `pnpm test:bdd -- tests/bdd/features/sauvegarde.feature` | ❌ |
| BAK-03 | anonymisation refusée si bail en cours, comptabilité conservée | unit + bdd | `pnpm vitest run tests/unit/locatif` ; `pnpm test:bdd -- tests/bdd/features/rgpd.feature` | ❌ |
| BAK-03 | note d'information et registre générés (PDF magic bytes, CSV) | integration | `pnpm vitest run tests/integration/pdf` | partiel (`brouillon-liasse-magic-bytes.test.ts` comme modèle) |

### Sampling Rate
- **Per task commit:** quick run command
- **Per wave merge:** full suite command
- **Phase gate:** full suite vert avant `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/integration/chiffrement/` (nouveau dossier)
- [ ] `tests/unit/sauvegarde/` (nouveau dossier)
- [ ] `tests/_world/monde-phase11.ts` (monde BDD avec dossier temporaire, base chiffrée réelle)

## Security Domain

### Applicable ASVS Categories (L1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (passphrase locale) | scrypt OWASP, longueur ≥ 12, pas de règle de composition (NIST 800-63B) |
| V3 Session Management | partiel | clé en mémoire du process seulement ; aucun secret en session/cookie |
| V4 Access Control | yes | verrou global onRequest tant que la base est fermée |
| V5 Input Validation | yes | zod sur formulaires ; chemins d'archive validés (traversal) ; taille d'upload bornée |
| V6 Cryptography | yes | SQLite3MC, node:crypto AES-256-GCM/scrypt/HKDF, jamais de crypto maison |
| V13/V14 Config | yes | garde Origin/Host (CSRF, DNS rebinding), écoute 127.0.0.1 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSRF / DNS rebinding vers 127.0.0.1 (restauration, effacement, reset) | Tampering/Spoofing | Garde Origin + Host sur méthodes non sûres |
| Traversal dans l'archive (`../`, absolu) | Tampering/Elevation | validation de chemin + ensemble exact du manifest |
| Archive altérée/tronquée | Tampering | STREAM-GCM, segment final obligatoire, SHA-256 par fichier |
| Fuite de clé (logs, disque, session) | Information disclosure | clé en mémoire, logger pino sans corps de requête, tests grep |
| Brute force passphrase hors ligne sur `cle.json` | Information disclosure | scrypt N=2^17 ; recommandation FileVault/BitLocker |
| Fichiers temporaires SQLite en clair | Information disclosure | `temp_store=MEMORY` |

## Planning Notes (orchestrateur, 2026-10-27)

Exécution choisie par l'user : planner inline (agent-guard refuse les sous-agents qui écrivent), `gsd-plan-checker` en sous-agent. Gates passés : UI (frontend, pas de UI-SPEC, non bloquant), drifts ignorés, assumption-delta non détecté, schema-gate sans ORM détecté, Nyquist non requis (research désactivé en config). Sonde de cas limites : 3 exigences `unclassified` → à traiter en hypothèses signalées + truths écrits à la main. Calibration estimate : factor 1, confidence low.

Découpage proposé (vagues sans fichier partagé) :
- **Vague 1** — 11-01 pilote + ouverture chiffrée + migration clair→chiffré (BAK-02, tdd) · 11-02 enveloppe `cle.json` + clé de secours + règle passphrase (BAK-02, tdd) · 11-05 domaine sauvegarde + codec `.glbak` (BAK-01, tdd) · 11-08 anonymisation domaine + use case + migration 0024 (BAK-03, tdd) · 11-10 note d'information + registre + `RGPD.md`/`RISKS.md`/docs (BAK-03 ; touche main.ts, sidebar-nav)
- **Vague 2** — 11-03 démarrage verrouillé + déverrouillage + création/migration + garde Origin/Host + retrait CLI migrate (BAK-02 ; main.ts)
- **Vague 3** — 11-04 passphrase oubliée + BDD déverrouillage/a11y (routes/vues deverrouillage seulement) · 11-06 sauvegarde en une action + pré-migration D-09 (main.ts, sidebar-nav, routes/sauvegarde)
- **Vague 4** — 11-07 restauration vérifiée + bascule + BDD corruption/drill (pas de main.ts) · 11-09 effacement côté UI + écran des dates de conservation + BDD (main.ts, routes/locataires)

## Sources

### Primary (HIGH confidence)
- SQLite3MC docs (pragmas, legacy, FAQ, temp files) https://utelle.github.io/SQLite3MultipleCiphers/ et source v2.4.0
- bs3mc releases/issues https://github.com/m4heshd/better-sqlite3-multiple-ciphers ; npm view 13.0.3
- SQLite `VACUUM INTO` https://sqlite.org/lang_vacuum.html
- Node crypto https://nodejs.org/api/crypto.html (v22 et main)
- NIST SP 800-38D ; OWASP Password Storage Cheat Sheet ; age spec (C2SP) ; Tink AES-GCM-HKDF streaming
- RGPD art. 2, 13, 17, 30 (CNIL) ; CNIL délibération n° 2021-057 du 6 mai 2021 (référentiel gestion locative) ; modèle de registre simplifié CNIL (ODS)
- Loi 89-462 art. 7-1, 25-3 (Légifrance) ; BOFiP BOI-BIC-DECLA-30-10-20-30 (LPF L102 B)

### Secondary
- BIP-39 et liste française https://github.com/bitcoin/bips ; Crockford Base32 ; BitLocker/1Password/Bitwarden (précédents de clé de secours)
