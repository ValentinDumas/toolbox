# Phase 11: Sauvegarde & sécurité des données - Context

**Gathered:** 2026-10-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Sécuriser les données du bailleur, sans nouvelle capacité métier :

- **BAK-02** — base SQLite chiffrée au repos (SQLCipher) ; ouverture impossible sans passphrase.
- **BAK-01** — sauvegarde en une action (base chiffrée + dossier `documents/`) et restauration validée par un contrôle d'intégrité qui rejette une archive corrompue.
- **BAK-03** — conformité RGPD opérable : note d'information locataire, droit à l'effacement exécutable, registre de traitement.

Séquençage imposé par la roadmap : BAK-02 avant BAK-01 (la sauvegarde porte sur une base chiffrée), BAK-03 indépendant.

</domain>

<decisions>
## Implementation Decisions

> L'user a délégué l'arbitrage de toutes les zones grises (« tranche tout »). Les décisions ci-dessous sont celles de Claude, à challenger à la relecture du plan — les plus engageantes portent une note de réversibilité.

### Passphrase — saisie et cycle de vie (BAK-02)

- **D-01 : Écran de déverrouillage web.** Le serveur démarre **verrouillé** : tant que la base n'est pas ouverte, toute route redirige vers `/deverrouiller` (formulaire passphrase). La clé dérivée vit **en mémoire du process uniquement** — jamais écrite sur disque, jamais loggée, jamais en session/cookie. Choix motivé par la Phase 12 (binaire + ouverture auto du navigateur) : pas de terminal, cross-platform, pas de dépendance au trousseau OS.
- **D-02 : Chiffrement par enveloppe (clé maîtresse + clé de secours).** La base est chiffrée par une **clé maîtresse aléatoire 256 bits** passée en clé brute à SQLCipher. Un fichier compagnon (`cle.json`, à côté de `db.sqlite`) contient cette clé maîtresse chiffrée (AES-256-GCM) deux fois : sous une clé dérivée de la passphrase (KDF mémoire-dure — scrypt de `node:crypto` ou Argon2id, choix au researcher) et sous une **clé de secours** générée à la création, affichée **une seule fois** (format lisible, à imprimer/recopier). — **Reversibility:** one-way — le format de `cle.json` et la dérivation sont lus par chaque ouverture et chaque restauration d'archive ; en changer impose une migration des bases et des sauvegardes existantes.
  - Pourquoi : oublier la passphrase sans secours = perte des données **et** des sauvegardes (chiffrées par la même clé) — inacceptable pour 10 ans de pièces à conserver (RISKS R3.1). L'enveloppe rend aussi la réinitialisation de passphrase triviale (re-wrap, pas de rekey de la base).
- **D-03 : Réinitialisation par clé de secours.** Sur l'écran de déverrouillage, lien « Passphrase oubliée » → saisie de la clé de secours → définition d'une nouvelle passphrase (re-wrap). Pas d'autre canal de récupération.
- **D-04 : Premier lancement et migration de la base en clair.** Base absente → écran de création (passphrase + confirmation, longueur minimale 12 caractères, pas d'autre règle de composition) puis affichage de la clé de secours avec case « je l'ai conservée » obligatoire. Base existante **en clair** (installations v1.0) → même parcours, puis migration : export chiffré (`sqlcipher_export` ou équivalent) dans un fichier temporaire, vérification (`PRAGMA integrity_check` + comptage de lignes par table identique), renommage atomique, suppression du fichier en clair. — **Reversibility:** one-way — après suppression du fichier en clair, la seule voie de retour est la passphrase ou la clé de secours.
  - Limite assumée et affichée : la suppression n'est pas un effacement sécurisé (SSD/APFS) ; recommander FileVault/BitLocker dans le texte d'aide.
- **D-05 : Choix du pilote SQLite délégué à la recherche.** `better-sqlite3` standard ne supporte pas SQLCipher. Le researcher compare les variantes compatibles (ex. `better-sqlite3-multiple-ciphers`) sur : compatibilité Kysely/`SqliteDialect`, binaires précompilés macOS/Windows/Linux (contrainte Phase 12), maintenance. Les tests existants (`:memory:`) doivent continuer à tourner sans clé.

### Périmètre du chiffrement

- **D-06 : `documents/` reste en clair sur disque ; l'archive de sauvegarde est entièrement chiffrée.** Chiffrer `documents/` au repos toucherait tous les adaptateurs de stockage (lecture/écriture PDF, justificatifs, avenants) sans figurer dans les critères de succès. L'exposition principale est l'archive qui quitte la machine (clé USB, cloud perso) : elle est chiffrée (D-08). Le contenu de `documents/` est moins sensible qu'anticipé — vérifié dans le code : ni pièce d'identité ni IBAN stockés, seulement des PDF nominatifs (quittances, avenants) et des justificatifs de charges.

### Sauvegarde (BAK-01)

- **D-07 : Déclenchement manuel, téléchargement navigateur.** Page « Sauvegarde » (navigation principale ou paramètres) avec un bouton « Sauvegarder maintenant » qui produit l'archive et la sert en téléchargement — l'user la range où il veut (USB, cloud perso). Pas de champ « dossier de destination » (le navigateur ne peut pas choisir un dossier serveur, et un chemin saisi à la main est hostile pour un non-dev).
- **D-08 : Format d'archive.** Un seul fichier `gestion-locative-sauvegarde-AAAA-MM-JJ-HHmm.glbak` : en-tête en clair (magic, version de format, `cle.json` embarqué) + charge utile chiffrée AES-256-GCM sous une clé dérivée de la clé maîtresse, contenant : copie cohérente de la base (backup API SQLite / `VACUUM INTO`, jamais une copie de fichier à chaud), `documents/` complet, `manifest.json` (version de format, version applicative, version de schéma, date, SHA-256 par fichier). — **Reversibility:** one-way — toute archive émise doit rester restaurable par les versions futures ; changer le format exige un lecteur de l'ancien format à vie.
- **D-09 : Sauvegarde automatique avant migration de schéma.** Avant d'appliquer une migration en attente, écrire une archive dans `<dossier données>/sauvegardes/` (même format), rétention des **5 plus récentes**. Mitigation RISKS R3.2, même code que D-07. La migration en clair → chiffré (D-04) n'en produit pas (ce serait une copie en clair).

### Restauration (BAK-01)

- **D-10 : Restauration par upload, vérification complète avant tout effet.** Upload de l'archive depuis la page Sauvegarde → déchiffrement (demande la passphrase **de l'archive** ou sa clé de secours, via le `cle.json` embarqué) → vérification dans un dossier temporaire : tag GCM, SHA-256 de chaque fichier vs manifest, `PRAGMA integrity_check`, version de schéma ≤ version courante. Tout échec → refus avec message explicite, **aucune modification** de l'état courant.
- **D-11 : Bascule sûre.** Si la vérification passe : archive de sécurité automatique de l'état courant dans `sauvegardes/` (D-09), remplacement atomique base + `cle.json` + `documents/`, migrations de schéma si l'archive est plus ancienne, puis retour à l'écran de déverrouillage (la base restaurée garde sa propre passphrase). Archive de schéma plus récent que l'application → refus.
- **D-12 : Témoin d'intégrité testé.** Le scénario « archive corrompue » (octet modifié, fichier tronqué, manifest falsifié) est un cas BDD obligatoire, de même que « restore drill » aller-retour sauvegarde → restauration → données identiques.

### RGPD (BAK-03)

- **D-13 : Effacement = anonymisation + suppression du non-nécessaire, conservation de la pièce comptable.** Action « Effacer les données personnelles » sur la fiche locataire, possible seulement si **aucun bail n'est en cours** (le domaine n'a pas de statut « résilié » explicite — le researcher détermine le prédicat de fin de bail à partir de `bail.ts` / `alerte-fin-bail.ts`). Effet : champs d'identité du `Locataire` remplacés (nom/prénom → « Locataire anonymisé », email, téléphone, adresse, date/lieu de naissance, nationalité vidés ou neutralisés) ; montants, dates, échéances, encaissements et écritures fiscales **conservés** (obligation légale). Les PDF déjà émis (quittances, avenants, baux) restent conservés jusqu'à expiration de leur durée légale (`LOCATION_MEUBLEE_REGLES.md` §11) — l'écran le dit explicitement. Confirmation obligatoire, action irréversible, tracée dans le ledger. — **Reversibility:** one-way — l'anonymisation détruit la donnée par construction.
- **D-14 : Pas de purge automatique des PDF à échéance de conservation en V1.1.** L'écran d'effacement affiche les dates de fin de conservation par document ; la purge reste manuelle via le coffre existant.
- **D-15 : Note d'information locataire = PDF généré.** Généré depuis la fiche bail/locataire avec le pipeline PDF existant (même famille que quittance/avenant) : identité du bailleur (responsable de traitement), finalités, bases légales (exécution du contrat, obligation légale), catégories de données, durées de conservation, destinataires (aucun hors obligations légales), droits (accès, rectification, effacement, limitation, opposition), réclamation CNIL. Texte versionné dans le code, sources citées (RGPD art. 13).
- **D-16 : Registre de traitement = page + PDF/CSV.** Une fiche de traitement unique « Gestion locative » au format du modèle CNIL simplifié (RGPD art. 30), pré-remplie avec l'identité du bailleur et les catégories de données réellement stockées (vérifiées sur le schéma). Export PDF, cohérent avec le principe audit-friendly.
- **D-17 : Documentation.** `RGPD.md` à la racine (mitigation R3.3), référencé depuis `CLAUDE.md` et `README.md` ; mise à jour de `RISKS.md` (statuts R3.1–R3.4) dans le même commit que le code.

### Claude's Discretion

L'user a délégué l'ensemble des arbitrages (« tranche tout »). Laissés au planner/researcher : choix du KDF et de ses paramètres, choix du pilote SQLCipher (D-05), format de la clé de secours (groupes de caractères, mots), emplacement exact de la page Sauvegarde dans la navigation, libellés UI (dans le respect de `practices/UX_DESIGN.md` et `practices/ACCESSIBILITY.md`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Périmètre et exigences
- `.planning/ROADMAP.md` §Phase 11 — goal, 4 critères de succès, note de séquençage BAK-02 → BAK-01.
- `.planning/REQUIREMENTS.md` — BAK-01, BAK-02, BAK-03.
- `.planning/PROJECT.md` — principes local-first / mono-user, Key Decisions.

### Risques
- `RISKS.md` §R3.1 (backup/restauration, hash d'intégrité, restore drill), §R3.2 (sauvegarde avant migration), §R3.3 (RGPD locataires), §R3.4 (chiffrement au repos, verrouillage).

### Conservation légale et données
- `LOCATION_MEUBLEE_REGLES.md` §11 — durées de conservation par document (base des dates affichées en D-13/D-14).
- `LMNP.md` — obligations fiscales qui imposent la conservation des données comptables.

### Pratiques opposables
- `practices/BDD_PRACTICES.md` — scénarios obligatoires (D-12), cycle outside-in.
- `practices/DDD.md` — domaine pur : le chiffrement et l'archive sont des adaptateurs, l'anonymisation est une opération du domaine `Locataire`.
- `practices/UX_DESIGN.md`, `practices/ACCESSIBILITY.md`, `practices/UI_DESIGN.md` — écran de déverrouillage, création de passphrase, affichage de la clé de secours, confirmation d'effacement.
- `practices/SOFTWARE_CRAFTSMANSHIP.md` — gates CI.

### Sources externes à citer (researcher)
- RGPD art. 13 (information), art. 17 (effacement), art. 30 (registre) ; modèle de registre CNIL.
- Documentation SQLCipher (`PRAGMA key` en clé brute, `sqlcipher_export`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/infrastructure/db/database.ts` — `ouvrirDb`, `cheminBaseParDefaut` (macOS `~/Library/Application Support/gestion-locative/db.sqlite`, Windows `%APPDATA%`, Linux `~/.local/share`), `activerPragmas`, `appliquerToutesMigrations` : point d'insertion de `PRAGMA key` et de la sauvegarde pré-migration.
- `src/infrastructure/storage/stockage-fichier-local.ts`, `stockage-justificatifs-local.ts` — racine `documents/` (`GESTION_LOCATIVE_DATA_DIR`) à inclure dans l'archive.
- Pipeline PDF (`src/infrastructure/pdf/`, builders du domaine comme `avenant-irl-builder.ts`) — à réutiliser pour la note d'information et le registre.
- `LocataireRepository.supprimer` existe déjà ; l'anonymisation est une nouvelle opération, pas une suppression.

### Established Patterns
- Use cases applicatifs avec `db.transaction().execute` pour l'atomicité (Phase 10) — à suivre pour l'anonymisation.
- Tests d'intégration HTTP via `creerApp(db, { clock })` + `app.inject` (`tests/integration/web/`).
- Domaine pur sans import technique (`.dependency-cruiser.cjs`, `lint:deps`).

### Integration Points
- `src/main.ts` ouvre la base **au démarrage**, applique les migrations puis construit l'app avec `creerApp(db, …)`. D-01 impose un démarrage en deux temps : serveur verrouillé (sans base) → déverrouillage → ouverture, migrations (avec D-09), câblage des repos. Le CLI `migrate` (`main.ts`) doit aussi demander la passphrase ou être retiré.
- `verifierDejaLance` (lock de process) reste avant le déverrouillage.
- Tous les tests construisent des bases `:memory:` sans clé : le chiffrement doit rester optionnel au niveau adaptateur (clé fournie ou non), obligatoire au niveau de l'application lancée.

</code_context>

<specifics>
## Specific Ideas

- Nom d'archive conforme à la convention de nommage de l'user : kebab-case, date ISO en suffixe (`gestion-locative-sauvegarde-2026-10-27-1205.glbak`).
- La clé de secours s'affiche une fois, avec une invitation à l'imprimer ; la case « je l'ai conservée » bloque la suite.

</specifics>

<deferred>
## Deferred Ideas

- Sauvegarde **planifiée** (quotidienne/hebdo, mentionnée dans `PROJECT.md` et R3.1) — hors critères de succès ; nouvelle capacité.
- Alerte dashboard « dernière sauvegarde il y a plus de N jours » — nouvelle capacité (dashboard Phase 7).
- Verrouillage automatique après inactivité et verrouillage manuel (R3.4).
- Changement volontaire de passphrase depuis les paramètres (le re-wrap de D-03 rend la chose triviale plus tard).
- Mémorisation de la passphrase dans le trousseau OS.
- Chiffrement de `documents/` au repos.
- Purge automatique des documents à échéance de conservation légale.

</deferred>

---

*Phase: 11-sauvegarde-s-curit-des-donn-es*
*Context gathered: 2026-10-27*
