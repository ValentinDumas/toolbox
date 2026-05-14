---
phase: 02-quittancement-ch-ances-encaissements-relances
reviewed: 2026-05-14T10:00:00Z
depth: standard
files_reviewed: 117
files_reviewed_list:
  - migrations/0002_phase2_bailleur_bail_ext.sql
  - migrations/0003_phase2_echeance_loyer.sql
  - migrations/0004_phase2_encaissement.sql
  - migrations/0005_phase2_quittance.sql
  - migrations/0006_phase2_relance.sql
  - src/application/encaissements/activer-bail.ts
  - src/application/encaissements/annuler-encaissement.ts
  - src/application/encaissements/annuler-quittance.ts
  - src/application/encaissements/calculer-relance-disponible.ts
  - src/application/encaissements/creer-encaissement.ts
  - src/application/encaissements/enregistrer-relance.ts
  - src/application/encaissements/generer-quittance.ts
  - src/application/encaissements/lister-echeances.ts
  - src/application/encaissements/lister-encaissements.ts
  - src/application/encaissements/lister-quittances.ts
  - src/application/encaissements/lister-relances.ts
  - src/application/encaissements/recalculer-statut-echeance.ts
  - src/application/identite/creer-ou-maj-bailleur.ts
  - src/application/locatif/desactiver-bail.ts
  - src/application/locatif/modifier-bail-actif.ts
  - src/application/locatif/supprimer-bail.ts
  - src/domain/_shared/clock.ts
  - src/domain/_shared/identifiants.ts
  - src/domain/_shared/money.ts
  - src/domain/encaissements/echeance-loyer-repository.ts
  - src/domain/encaissements/echeance-loyer.ts
  - src/domain/encaissements/encaissement-repository.ts
  - src/domain/encaissements/encaissement.ts
  - src/domain/encaissements/erreurs.ts
  - src/domain/encaissements/impaye.ts
  - src/domain/encaissements/pdf-renderer.ts
  - src/domain/encaissements/quittance-repository.ts
  - src/domain/encaissements/quittance.ts
  - src/domain/encaissements/relance-repository.ts
  - src/domain/encaissements/relance.ts
  - src/domain/encaissements/template-renderer.ts
  - src/domain/identite/bailleur-repository.ts
  - src/domain/identite/bailleur.ts
  - src/domain/identite/erreurs.ts
  - src/domain/locatif/activite-bail-detector.ts
  - src/domain/locatif/bail.ts
  - src/helpers/build-mailto.ts
  - src/helpers/format-numero-quittance.ts
  - src/helpers/format-periode.ts
  - src/infrastructure/db/database.ts
  - src/infrastructure/db/kysely-types.ts
  - src/infrastructure/pdf/avis-echeance-doc-def.ts
  - src/infrastructure/pdf/mise-en-demeure-doc-def.ts
  - src/infrastructure/pdf/pdf-renderer-pdfmake.ts
  - src/infrastructure/pdf/quittance-doc-def.ts
  - src/infrastructure/repositories/activite-bail-detector-sqlite.ts
  - src/infrastructure/repositories/bail-repository-sqlite.ts
  - src/infrastructure/repositories/bailleur-repository-sqlite.ts
  - src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts
  - src/infrastructure/repositories/encaissement-repository-sqlite.ts
  - src/infrastructure/repositories/quittance-repository-sqlite.ts
  - src/infrastructure/repositories/relance-repository-sqlite.ts
  - src/infrastructure/storage/stockage-fichier-local.ts
  - src/infrastructure/templates/template-renderer-ejs.ts
  - src/main.ts
  - src/web/routes/bailleur.ts
  - src/web/routes/baux.ts
  - src/web/routes/echeances.ts
  - src/web/routes/encaissements.ts
  - src/web/routes/impayes.ts
  - src/web/routes/quittances.ts
  - src/web/routes/relances.ts
  - src/web/routes/wizard.ts
  - src/web/schemas/bailleur-schemas.ts
  - src/web/schemas/encaissement-schemas.ts
  - src/web/schemas/quittance-schemas.ts
  - src/web/views/pages/bailleur/profil.ejs
  - src/web/views/pages/baux/activer.ejs
  - src/web/views/pages/baux/detail.ejs
  - src/web/views/pages/baux/modifier.ejs
  - src/web/views/pages/echeances/liste.ejs
  - src/web/views/pages/encaissements/fiche.ejs
  - src/web/views/pages/encaissements/formulaire.ejs
  - src/web/views/pages/encaissements/liste.ejs
  - src/web/views/pages/impayes/liste.ejs
  - src/web/views/pages/quittances/fiche.ejs
  - src/web/views/pages/quittances/liste.ejs
  - src/web/views/pages/relances/liste.ejs
  - src/web/views/partials/banniere-warning.ejs
  - src/web/views/partials/relance-action.ejs
  - src/web/views/partials/sidebar-nav.ejs
  - src/web/views/partials/warning-live.ejs
  - templates/relances/01-amiable.ejs
  - templates/relances/02-ferme.ejs
  - templates/relances/03-mise-en-demeure.ejs
  - tests/_builders/encaissements.ts
  - tests/_builders/identite.ts
  - tests/_builders/locatif.ts
  - tests/_world/monde-phase2.ts
  - tests/bdd/features/bailleur.feature
  - tests/bdd/features/enc02-activation-bail.feature
  - tests/bdd/features/encaissements.feature
  - tests/bdd/features/modifier-bail-actif.feature
  - tests/bdd/features/quittancement.feature
  - tests/bdd/features/quittances.feature
  - tests/bdd/features/relances.feature
  - tests/bdd/step_definitions/activation.steps.ts
  - tests/bdd/step_definitions/bailleur.steps.ts
  - tests/bdd/step_definitions/quittancement.steps.ts
  - tests/bdd/step_definitions/quittances.steps.ts
  - tests/bdd/step_definitions/relances.steps.ts
  - tests/integration/pdf/mise-en-demeure.test.ts
  - tests/integration/pdf/quittance.test.ts
  - tests/integration/repositories/bail-repository-sqlite.test.ts
  - tests/integration/repositories/bailleur-repository-sqlite.test.ts
  - tests/integration/repositories/bien-repository-sqlite.test.ts
  - tests/integration/repositories/echeance-loyer-repository-sqlite.test.ts
  - tests/integration/repositories/encaissement-repository-sqlite.test.ts
  - tests/integration/repositories/locataire-repository-sqlite.test.ts
  - tests/integration/repositories/quittance-repository-sqlite.test.ts
  - tests/integration/repositories/relance-repository-sqlite.test.ts
  - tests/integration/storage/stockage-fichier-local.test.ts
  - tests/unit/_shared/clock.test.ts
  - tests/unit/encaissements/annuler-encaissement.test.ts
  - tests/unit/encaissements/calculer-relance-disponible.test.ts
  - tests/unit/encaissements/creer-encaissement.test.ts
  - tests/unit/encaissements/encaissement.test.ts
  - tests/unit/encaissements/enregistrer-relance.test.ts
  - tests/unit/encaissements/generer-quittance.test.ts
  - tests/unit/encaissements/lister-impayes.test.ts
  - tests/unit/encaissements/quittance.test.ts
  - tests/unit/encaissements/recalculer-statut-echeance.test.ts
  - tests/unit/encaissements/relance.test.ts
  - tests/unit/helpers/build-mailto.test.ts
  - tests/unit/helpers/format-numero-quittance.test.ts
  - tests/unit/identite/bailleur.test.ts
  - tests/unit/locatif/bail.test.ts
  - tests/unit/locatif/desactiver-bail.test.ts
  - tests/unit/locatif/modifier-bail-actif.test.ts
  - tests/unit/locatif/supprimer-bail.test.ts
findings:
  critical: 7
  warning: 13
  info: 6
  total: 26
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-05-14T10:00:00Z
**Depth:** standard
**Files Reviewed:** 117
**Status:** issues_found

## Summary

Phase 2 livre l'activation des baux, la génération des échéances, les encaissements (avec compensateurs), les quittances PDF, le suivi des impayés et les relances escaladées. L'architecture hexagonale est globalement respectée et la couverture de tests est solide.

Cependant, l'examen a relevé **plusieurs défauts critiques** :
- Une **incohérence majeure dans la régénération des échéances futures** (`modifier-bail-actif`) qui peut produire des doublons de périodes ou des trous.
- Une **course condition / atomicité brisée** dans `genererQuittance` : la quittance est INSÉRÉE en transaction puis le PDF est écrit hors-transaction. En cas de crash, on a une ligne BDD pointant vers un fichier inexistant.
- Une **transaction Kysely détournée** : `genererQuittance` passe le `trx` au repo mais le repo l'ignore et utilise `this.db` au lieu du `trx`. Toute la transactionnalité repose donc sur l'illusion.
- **Sérialisation invalide de Money en HTTP-friendly** : `Money.toJSON()` retourne `Number(centimes)` qui silently overflows pour des montants > 2^53, mais retourne un negative number pour les compensateurs sans le documenter.
- **Le clock fixe est ignoré pour les générations on-the-fly** : `bailRepo` typecasts perdent `actifDepuis` (cf CR-03).
- **Le filtre sur `echeance.annule_le` côté `trouverParId` exclut silencieusement les échéances annulées**, ce qui contredit le besoin d'audit (D-60 / D-74).
- **L'incrément du compteur de quittances n'est PAS atomique** (sélectionner-puis-update sans LOCK), ce qui peut produire des numéros dupliqués sous concurrence.

Côté warnings, on note plusieurs duck-typing dangereux sur le `Bail` (`as { actifDepuis: unknown }`), une **double instanciation de `PdfRendererPdfmake`** (singleton pdfmake module-level state pollué), un **path traversal partiellement protégé** dans `stockage-fichier-local`, et plusieurs **EJS rendus avec `<%- %>` sur des données utilisateur** (XSS potentiel via les messages d'erreur).

## Critical Issues

### CR-01: `modifier-bail-actif` régénère mal les échéances futures — risque de doublons ou de trous

**File:** `src/application/locatif/modifier-bail-actif.ts:101-119`
**Issue:** L'algorithme régénère via `genererEcheancesPour(bailModifie, bailModifie.actifDepuis!, bailModifie.jourEcheance)` qui produit `dureeMois` échéances couvrant TOUT le bail depuis `actifDepuis`. Puis le code prend "les `aRegenererIds.length` dernières" via `slice(toutesLesEcheances.length - nbARegenerer)`.

Ce raccourci suppose que :
1. Les ids supprimés sont strictement les `N-aPreserverCount` dernières dans l'ordre de génération.
2. La structure de génération est identique entre l'ancien et le nouveau bail (mêmes dates de début, durée, jourEcheance).

Or :
- Si `bail.actifDepuis` n'a PAS changé mais que `jourEcheance` change (D-53), `jour_echeance_attendue` doit être recalculé pour toutes les périodes, y compris celles préservées — ce que fait pas la logique : on préserve l'ancienne `jourEcheanceAttendue`.
- Si une `partiellement_payee` du passé est préservée tandis que les périodes futures sont régénérées, l'index calculé par `slice(...)` peut être incorrect quand certaines périodes intermédiaires sont préservées (ex : 5 échéances futures non-payées mais une période 09 préservée car partiellement_payee avec encaissement → on supprime 4 ids, on régénère les 4 dernières → la période 09 a maintenant 2 versions).
- En cas de gap (préservée non-contiguë), le slice ne correspond plus aux périodes supprimées.

**Fix:**
```typescript
// Régénérer en faisant correspondre périodes exactement : régénérer toutes les périodes,
// puis filtrer par dates aRegenerer (matching strict periodeDebut → periodeFin), pas par index.
const toutesLesEcheances = genererEcheancesPour(bailModifie, bailModifie.actifDepuis!, bailModifie.jourEcheance);

// Préserver le set des periodeDebut supprimées (collecté avant suppression)
const periodesSupprimees = new Set(
  echeances
    .filter((e) => aRegenererIds.includes(e.id))
    .map((e) => e.periodeDebut.toString()),
);

const nouvellesEcheances = toutesLesEcheances.filter((e) =>
  periodesSupprimees.has(e.periodeDebut.toString()),
);

if (nouvellesEcheances.length !== aRegenererIds.length) {
  throw new InvariantViolated('Mismatch entre périodes supprimées et régénérées');
}
```

---

### CR-02: `generer-quittance` — PDF écrit hors transaction → corruption en cas de crash

**File:** `src/application/encaissements/generer-quittance.ts:114-147`
**Issue:** La transaction Kysely encadre uniquement `prochainNumero` + `quittanceRepo.enregistrer`. Le rendu PDF (`pdfRenderer.genererBuffer`) et l'écriture disque (`stockage.ecrireQuittance`) sont effectués HORS transaction (lignes 145-147).

Conséquences :
1. Si le PDF rendering échoue (mémoire, fonts) → la quittance est déjà en base avec `chemin_fichier_relatif` pointant vers un fichier inexistant.
2. Si l'écriture disque échoue (disque plein, permissions) → idem.
3. Le `/quittances/:id/pdf` retournera 404 alors que la quittance "existe" en base — le compteur numero a déjà été incrémenté.

Le commentaire en ligne 56 ("Écriture PDF hors transaction (compromis acceptable — voir spec)") montre que c'est un choix conscient, mais sans compensation (suppression de la ligne BDD si l'écriture disque échoue) c'est un bug. La quittance "fantôme" reste comptée dans le compteur annuel.

**Fix:** Rendre le PDF AVANT la transaction et l'écrire APRÈS (idempotent) avec rollback explicite en cas d'échec :
```typescript
// 1. Calculer le PDF avant la transaction
const docDefPreview = construireQuittance(echeance, bailleur, locataire, adresseBien, '0000-000', clock.aujourdhui(), bail.modeCharges);
// (preview docDef ne fixe pas le numero — qui sera connu seulement après prochainNumero)

// 2. Transaction : alloc numero + insert quittance row
await db.transaction().execute(async (trx) => {
  numero = await repos.quittanceRepo.prochainNumero(annee, trx);
  // ... build quittance ...
  await repos.quittanceRepo.enregistrer(quittance, trx);
});

// 3. Génération PDF + écriture disque APRÈS commit
try {
  const docDef = construireQuittance(echeance, bailleur, locataire, adresseBien, quittance.numero, clock.aujourdhui(), bail.modeCharges);
  const buffer = await pdfRenderer.genererBuffer(docDef);
  await stockage.ecrireQuittance(annee, nomFichierFinal, buffer);
} catch (err) {
  // Compensation : marquer la quittance comme annulee_le (et le PDF orphelin)
  await repos.quittanceRepo.enregistrer(
    quittance.annuler('Erreur génération PDF', clock.aujourdhui()),
  );
  throw err;
}
```

---

### CR-03: `generer-quittance.ts` — la transaction Kysely n'est PAS atomique : `quittanceRepo.enregistrer` ignore `trx`

**File:** `src/infrastructure/repositories/quittance-repository-sqlite.ts:23-43`, `src/infrastructure/repositories/quittance-repository-sqlite.ts:84-112`, `src/application/encaissements/generer-quittance.ts:118-131`
**Issue:** Le use case `generer-quittance.ts` ouvre une transaction et passe `trx` à `prochainNumero` et `enregistrer`. **Mais les deux méthodes du repository utilisent `(trxArg as Kysely<DB> | undefined) ?? this.db`** où `this.db` est l'instance globale, pas le `trx`.

Pire : dans `prochainNumero` (ligne 88), si on utilise `trx` Kysely, on ne peut pas le typecaster en `Kysely<DB>` — un `Transaction<DB>` Kysely a une API similaire mais c'est un type différent. Le typecast hide le bug : en pratique, `trx` peut quand même fonctionner en runtime car les méthodes `selectFrom/insertInto` sont compatibles. Mais l'intention de coder un fallback safe est trompeuse — si `trx` est `undefined`, on utilise `this.db` SANS transaction, et il n'y a aucun warning.

Cela rend la "transaction atomique" annoncée en commentaire (`Transaction atomique : incrément compteur + INSERT quittance`) **non-atomique en pratique** quand le repository tombe sur `this.db`.

Test integration `T15b: prochainNumero(2026) quand meta.valeur=42 → "2026-043"` passe l'argument `trx=undefined`, donc utilise `this.db`. Sous concurrence (ou erreur entre SELECT et UPDATE), deux requêtes peuvent lire la même valeur et écrire le même numéro — la contrainte `UNIQUE(numero)` lèvera mais le compteur sera désynchronisé.

**Fix:**
1. Faire de `prochainNumero` une vraie opération atomique SQL : `INSERT ... ON CONFLICT DO UPDATE SET valeur = valeur + 1 RETURNING valeur` (PostgreSQL) ou pour SQLite : utiliser un UPSERT atomique avec `RETURNING`.
2. Garantir que `trxArg` est utilisé dans le repo. Si l'API Kysely ne le permet pas (different types), repenser le pattern (passer un `dbOrTrx: Kysely<DB> | Transaction<DB>`).

```typescript
// Atomic via UPSERT with RETURNING (better-sqlite3 supports RETURNING since SQLite 3.35)
async prochainNumero(annee: number, trxArg?: Transaction<DB>): Promise<string> {
  const db = trxArg ?? this.db;
  const cle = `compteur_quittance_${annee}`;
  
  const row = await db
    .insertInto('meta')
    .values({ cle, valeur: '1' })
    .onConflict((oc) =>
      oc.column('cle').doUpdateSet({
        valeur: sql`CAST(CAST(meta.valeur AS INTEGER) + 1 AS TEXT)`,
      }),
    )
    .returning('valeur')
    .executeTakeFirstOrThrow();
  
  return formatNumeroQuittance(annee, Number(row.valeur));
}
```

---

### CR-04: `echeance-loyer-repository-sqlite.trouverParId` exclut silencieusement les échéances annulées

**File:** `src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts:52-62`
**Issue:** `trouverParId` filtre par `annule_le IS NULL` :
```typescript
const row = await this.db
  .selectFrom('echeance_loyer')
  .selectAll()
  .where('id', '=', id)
  .where('annule_le', 'is', null)  // BUG : exclut les annulées
  .executeTakeFirst();
```

Conséquences :
- Côté `quittances.ts:200-213` (route GET `/quittances/:id`) : `echeanceLoyerRepo.trouverParId(quittance.echeanceId)` retourne `null` pour une échéance annulée, alors qu'on veut afficher la quittance + un warning "échéance annulée".
- Côté `recalculer-statut-echeance.ts:30-39` : si une échéance est annulée et qu'un compensateur arrive, l'opération `Promise.all` retourne `echeance=null` → `throw new Error("Échéance introuvable")` au lieu d'un traitement gracieux.
- Côté `enregistrerRelance` et `annulerEncaissement` : impossible de manipuler une échéance soft-deleted pour audit.

**D-60 / D-74** stipulent que le soft-delete doit préserver l'historique pour l'audit. Le filtrage côté `trouverParId` est incorrect ; il devrait être côté `listerParBail` (où c'est légitime) mais pas côté lookup par id.

**Fix:**
```typescript
async trouverParId(id: EcheanceLoyerId | string): Promise<EcheanceLoyer | null> {
  const row = await this.db
    .selectFrom('echeance_loyer')
    .selectAll()
    .where('id', '=', id)
    // Pas de filtre annule_le — laissez le caller décider
    .executeTakeFirst();
  if (!row) return null;
  return this.versDomaine(row as EcheanceLoyerRow);
}
```

Et faire de même pour `Encaissement` et `Quittance` si applicable.

---

### CR-05: `recalculer-statut-echeance` ne met PAS le statut à `payee` si echeance a déjà statut `annulee`

**File:** `src/application/encaissements/recalculer-statut-echeance.ts:31-58`
**Issue:** Le use case appelle systématiquement `mettreAJourStatut`, même quand l'échéance est `annulee`. La logique :
```typescript
if (sommePaiee.estNegatif() || sommePaiee.egale(Money.zero())) {
  statut = 'en_attente';  // BUG : peut écraser 'annulee' → 'en_attente'
} else if (...) {
  statut = 'partiellement_payee';
} ...

await echeanceLoyerRepo.mettreAJourStatut(echeanceId, statut);
```

Conséquence : Si on annule un encaissement lié à une échéance déjà annulée (cas impossible en cas idéal, mais permis par le schéma), le statut de l'échéance bascule de `annulee` → `en_attente`. Idem si on encaisse un compensateur sur une échéance annulée — `creer-encaissement.ts` la rejette via `EcheanceAnnulee`, mais si l'annulation arrive entre le check et la persistence (TOCTOU), on peut atteindre cet état.

**Fix:** Préserver le statut `annulee` dans `recalculer-statut-echeance` :
```typescript
if (echeance.statut === 'annulee') {
  // Ne pas écraser le statut annulé — recalcul non pertinent
  return { statut: 'annulee', sommePaiee, surPaiement: null };
}
```

---

### CR-06: `enregistrer-relance.ts` lance des `EcheanceLoyerIntrouvable` pour bail/locataire/bien manquants — typage faux

**File:** `src/application/encaissements/enregistrer-relance.ts:87-99`
**Issue:**
```typescript
const bail = await repos.bailRepo.trouverParId(echeance.bailId);
if (!bail) {
  throw new EcheanceLoyerIntrouvable(`Bail introuvable pour l'échéance ${String(commande.echeanceId)}`);
}

const locataire = await repos.locataireRepo.trouverParId(bail.locataireId);
if (!locataire) {
  throw new EcheanceLoyerIntrouvable(`Locataire introuvable pour le bail ${bail.id}`);
}

const bien = await repos.bienRepo.trouverParId(bail.bienId);
if (!bien) {
  throw new EcheanceLoyerIntrouvable(`Bien introuvable pour le bail ${bail.id}`);
}
```

Trois erreurs distinctes (bail, locataire, bien introuvables) sont mappées à la même exception `EcheanceLoyerIntrouvable`. Conséquence : impossible pour le caller de distinguer la cause via `instanceof`. La route `/relances` (relances.ts:114-119) ne catche que `RelanceNiveauNonDisponible`, les autres erreurs remontent en 500 — perte d'information utilisateur.

Pire, le message d'erreur dans `enregistrer-relance.ts:88` est misleading : "Bail introuvable pour l'échéance" est lancé comme une `EcheanceLoyerIntrouvable`. Du point de vue HTTP/logs, c'est trompeur.

**Fix:** Créer des erreurs domaines dédiées (`BailIntrouvable`, `LocataireIntrouvable`, `BienIntrouvable`) ou — si on veut un seul type, utiliser `InvariantViolated` avec un message clair, pas réutiliser le type d'une autre entité.

```typescript
import { BailIntrouvable } from '../../domain/locatif/erreurs.js';
import { LocataireIntrouvable } from '../../domain/locatif/erreurs.js';
// ...
if (!bail) throw new BailIntrouvable(echeance.bailId);
if (!locataire) throw new LocataireIntrouvable(bail.locataireId);
if (!bien) throw new BienIntrouvable(bail.bienId);
```

---

### CR-07: `EJS XSS` — `banniere-warning.ejs` rend `<%= message %>` mais des call sites le passent en HTML

**File:** `src/web/views/partials/banniere-warning.ejs:3`, `src/web/views/pages/baux/detail.ejs:233`, `src/web/routes/baux.ts:233`
**Issue:** Bien que la majorité des call sites utilisent `<%= %>` (escape), certains messages d'erreur sont construits par concaténation de chaînes contrôlées partiellement par l'utilisateur :

```typescript
// src/web/routes/baux.ts:233
return reply.code(404).send('Ce bail n\'existe pas ou a été supprimé. <a href="/baux">Retour aux baux</a>');

// src/web/routes/quittances.ts:128
return reply.code(404).send('Quittance introuvable. <a href="/quittances">Retour</a>');

// src/web/routes/echeances.ts:194
return reply.code(400).send('Profil bailleur non renseigné. <a href="/bailleur">Renseigner le profil</a>');
```

Ces routes appellent `reply.send(string)` avec du HTML inline mais sans `reply.type('text/html')`. Fastify default content-type est `text/html` pour les strings → OK pour le rendu, mais ces réponses court-circuitent le système de view layouts et de sécurité (pas de CSP, pas d'encodage automatique). Si à terme on injecte une partie utilisateur dans ces messages, on a un vecteur XSS direct.

Plus immédiat : dans `src/web/routes/echeances.ts:255-256` :
```typescript
if (query['avertissement']) {
  banniereWarning = decodeURIComponent(query['avertissement']);
}
```

Le warning vient d'un query param attaquant-contrôlable, puis est rendu via `<%= locals.banniereWarning %>` (line 19 de `warning-live.ejs` qui utilise `<%= %>`). Cela escape HTML → safe pour XSS direct. **Mais** : tout caller qui change `<%= %>` en `<%- %>` (ou inverse) sur ce partial introduit un XSS reflected via `?avertissement=<script>...`.

**Fix:**
1. Toujours utiliser `<%= %>` (escape) pour les chaînes utilisateur, jamais `<%- %>`.
2. Audit des `reply.send(htmlString)` : déplacer vers des views avec `reply.view(...)` ou au moins ajouter `reply.type('text/html')`.
3. Ajouter un header `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'` (les EJS contiennent des `<script>` inline dans modifier.ejs:170, fiche.ejs:75, etc. — soit nonce, soit `'unsafe-inline'` documenté).

## Warnings

### WR-01: `bail-repository-sqlite.ts` — duck-typing dangereux dans `creer-encaissement.ts:62,73`

**File:** `src/application/encaissements/creer-encaissement.ts:62,73`
**Issue:**
```typescript
if ((bail as { actifDepuis: unknown }).actifDepuis === null) {
  throw new BailNonActif(bail.id);
}
// ...
const bailDateDebut = (bail as { dateDebut: Temporal.PlainDate }).dateDebut;
```

Le `bail` retourné par `bailRepo.trouverParId()` est de type `Bail | null`. La classe `Bail` expose déjà `actifDepuis` et `dateDebut` typés (cf `bail.ts:81,91`). Ces casts `as { ... }` sont inutiles et masquent le type réel. Si plus tard `Bail` change le nom du champ, ces casts ne lèveront pas d'erreur de compilation.

**Fix:**
```typescript
if (bail.actifDepuis === null) {
  throw new BailNonActif(bail.id);
}
// ...
const bailDateDebut = bail.dateDebut;
```

---

### WR-02: `PdfRendererPdfmake` — singleton module-level state, font config global

**File:** `src/infrastructure/pdf/pdf-renderer-pdfmake.ts:19-32`, `src/web/routes/relances.ts:40`
**Issue:** Le module `pdf-renderer-pdfmake.ts` appelle `pdfMakeLib.addFonts(...)` et `pdfMakeLib.setUrlAccessPolicy(...)` au top-level (lignes 22-32). Ces configurations sont des side-effects au moment du `import`. En cas de double instanciation (`new PdfRendererPdfmake()` dans `main.ts:115` ET dans `relances.ts:40`), pdfmake-lib étant un require'd module CJS, les fonts sont réassignées 2 fois mais c'est idempotent.

**Plus problématique** : `relances.ts` crée un `new PdfRendererPdfmake()` à chaque appel de plugin alors que `main.ts` en injecte déjà un dans le contexte de l'app. Côté DI hexagonal, ces deux instances coexistent et la confusion peut amener à des configurations divergentes (font path absolu différent).

**Fix:** Utiliser le `pdfRenderer` injecté via `opts` dans `relances.ts:40` au lieu de le réinstancier :
```typescript
// relances.ts — plugin signature
export async function plugin(
  app: FastifyInstance,
  opts: {
    relanceRepo: RelanceRepository;
    // ...
    pdfRenderer: PdfRenderer;  // ← injecter ici
  },
): Promise<void> {
  // const pdfRenderer = new PdfRendererPdfmake();  ← supprimer
}
```

---

### WR-03: `stockage-fichier-local.ts` — protection path traversal incomplète sur `lireQuittance`

**File:** `src/infrastructure/storage/stockage-fichier-local.ts:34-53`
**Issue:** La vérification :
```typescript
if (!cheminAbsolu.startsWith(baseDirResolu + path.sep) && cheminAbsolu !== baseDirResolu) {
  throw new FichierIntrouvable(cheminRelatif);
}
```

bloque les traversées sortantes (`../../../etc/passwd`), mais ne bloque PAS :
- Les liens symboliques pointant hors de `baseDir` (un attacker avec write access pourrait créer un symlink `quittances/2026/x.pdf → /etc/passwd` puis appeler `/quittances/:id/pdf`).
- Les caractères de contrôle dans le path (NULL byte, BOM) — ces caractères peuvent passer `path.resolve` mais déclencher des comportements bizarres dans `fs.readFile`.

**Fix:** Utiliser `fs.realpath()` après resolve pour résoudre les symlinks, puis comparer :
```typescript
const cheminAbsolu = path.resolve(this.baseDir, cheminRelatif);
const baseDirResolu = await fs.realpath(this.baseDir);
let cheminReel: string;
try {
  cheminReel = await fs.realpath(cheminAbsolu);
} catch (err: unknown) {
  const nodeErr = err as NodeJS.ErrnoException;
  if (nodeErr.code === 'ENOENT') throw new FichierIntrouvable(cheminRelatif);
  throw err;
}
if (!cheminReel.startsWith(baseDirResolu + path.sep)) {
  throw new FichierIntrouvable(cheminRelatif);
}
```

---

### WR-04: `build-mailto.ts` — troncature potentiellement coupée au milieu d'une séquence percent-encoded

**File:** `src/helpers/build-mailto.ts:27-31`
**Issue:**
```typescript
if (bodyEnc.length > LIMITE_CORPS) {
  const mentionEnc = encodeURIComponent(MENTION_TRONQUEE).replaceAll('%0A', '%0D%0A');
  const limite = LIMITE_CORPS - mentionEnc.length;
  bodyFinal = bodyEnc.substring(0, limite) + mentionEnc;
}
```

Si `bodyEnc` se termine au milieu d'une séquence `%XX` (ex : on coupe à `%C3` sans le `%A9` qui ferait `é` en UTF-8), l'URI devient malformé et `decodeURIComponent` côté client client jettera ou affichera mal. Edge case rare (la mention "[Message tronqué...]" est ajoutée juste après), mais possible si le tronquage tombe exactement entre `%` et `XX`.

**Fix:** Reculer la troncation pour éviter de couper une séquence percent-encoded :
```typescript
let limite = LIMITE_CORPS - mentionEnc.length;
// Reculer si on est au milieu d'une séquence %XX
while (limite > 0 && (bodyEnc[limite - 1] === '%' || bodyEnc[limite - 2] === '%')) {
  limite--;
}
bodyFinal = bodyEnc.substring(0, limite) + mentionEnc;
```

---

### WR-05: `Money.toJSON()` retourne `Number(centimes)` — overflow silencieux et NaN sur compensateurs > MAX_SAFE_INTEGER

**File:** `src/domain/_shared/money.ts:77-79`
**Issue:**
```typescript
toJSON(): number {
  return Number(this.centimes);
}
```

`bigint → number` est lossy pour valeurs > `2^53` (9 × 10^15 centimes = 90 milliards d'euros). Le commentaire en ligne 5 reconnaît ce trade-off pour les positifs, mais ne dit rien sur les compensateurs négatifs. Or `Money.compensateur(Money.fromCentimes(10n)).toJSON() === -10` est valide, mais à `Money.fromCentimes(2n**53n)` on perd la précision.

Plus subtil : `enregistrement` en BDD passe par `Number(e.montant.toCentimes())` (echeance-loyer-repository-sqlite.ts:122 et autres) avec des `Math.round` qui n'arrondissent rien (bigint converti est déjà entier). Si jamais le montant dépasse MAX_SAFE_INTEGER, le `Number(...)` arrondit aux 2^53 voisins et le `Math.round` masque l'erreur. La contrainte SQLite `CHECK (loyer_hc >= 0)` ne lèvera pas, mais la valeur stockée sera tronquée.

**Fix court terme:** Ajouter un assert au moment du `Number(bigint)` :
```typescript
private static toSqliteCentimes(m: Money): number {
  const c = m.toCentimes();
  if (c > Number.MAX_SAFE_INTEGER || c < Number.MIN_SAFE_INTEGER) {
    throw new InvariantViolated(`Montant > MAX_SAFE_INTEGER : ${c}`);
  }
  return Number(c);
}
```

**Fix idéal:** Stocker en TEXT ou en BLOB pour préserver bigint exact. Hors scope V1 mais à documenter dans `RISKS.md`.

---

### WR-06: `activer-bail.ts` — `(bail as { id: string, ... })` typage faux dans `genererEcheancesPour`

**File:** `src/application/encaissements/activer-bail.ts:93-99`
**Issue:** La signature de `genererEcheancesPour` prend un objet "duck-typé" :
```typescript
export function genererEcheancesPour(
  bail: { id: string; dureeMois: number; loyerHc: Money; montantCharges: Money; modeCharges: 'forfait' | 'provisions'; bienId: string; locataireId: string },
  // ...
)
```

Pourquoi ne pas typer `bail: Bail` directement ? Le contrat est plus faible que nécessaire — un appelant pourrait passer un objet incompatible (ex : un `BailMinimal` sans tous les invariants). Bonus : `bail.id as BailId` (ligne 99) caste sans vérification UUID.

**Fix:** Utiliser directement le type `Bail` du domaine :
```typescript
import type { Bail } from '../../domain/locatif/bail.js';
export function genererEcheancesPour(
  bail: Pick<Bail, 'id' | 'dureeMois' | 'loyerHc' | 'montantCharges' | 'modeCharges' | 'bienId' | 'locataireId'>,
  actifDepuis: Temporal.PlainDate,
  jourEcheance: number,
): EcheanceLoyer[] { ... }
```

---

### WR-07: `bailleur-repository-sqlite.enregistrer` ne gère pas le conflit `UNIQUE(singleton_marker)`

**File:** `src/infrastructure/repositories/bailleur-repository-sqlite.ts:22-34`
**Issue:** `enregistrer` fait un `INSERT INTO bailleur VALUES (...)` sans `ON CONFLICT`. Si un bailleur existe déjà, l'INSERT lèvera `SQLITE_CONSTRAINT_UNIQUE` à cause de `UNIQUE(singleton_marker)`. Le use case `creer-ou-maj-bailleur.ts` orchestre lookup-then-insert-or-update, mais cela laisse une TOCTOU race (window entre `trouver()` et `enregistrer()` où un autre process insert).

C'est un cas peu probable (single-user local-first par design), mais l'erreur de contrainte UNIQUE remonte en 500 plutôt qu'en upsert idempotent.

**Fix:**
```typescript
async enregistrer(bailleur: Bailleur): Promise<void> {
  await this.db
    .insertInto('bailleur')
    .values({ /* ... */ })
    .onConflict((oc) =>
      oc.column('singleton_marker').doUpdateSet({
        nom_complet: bailleur.nomComplet,
        rue: bailleur.adresse.rue,
        code_postal: bailleur.adresse.codePostal,
        ville: bailleur.adresse.ville,
        modifie_le: new Date().toISOString(),
      }),
    )
    .execute();
}
```

---

### WR-08: `creer-encaissement.ts` — pas de validation que `commande.montantCentimesPositifs >= 0n`

**File:** `src/application/encaissements/creer-encaissement.ts:67-68`
**Issue:**
```typescript
const positif = Money.fromCentimes(commande.montantCentimesPositifs);
const montant = commande.signe === 'compensateur' ? Money.compensateur(positif) : positif;
```

`Money.fromCentimes` lève si `n < 0n`, ce qui protège. Mais le schéma Zod côté web (`encaissement-schemas.ts:6-7`) accepte `n > 0` strictement positif, donc pas zéro. Le domain peut accepter zéro via direct API. Question : un encaissement de 0€ a-t-il un sens métier ? Non, jamais. Pourtant, le domain `Encaissement.creer` ne le rejette pas.

Cohérence cassée : Zod refuse 0€, domain accepte. Un appelant non-web pourrait créer un Encaissement à 0€.

**Fix:** Ajouter une invariant au niveau du domain :
```typescript
// encaissement.ts dans Encaissement.creer
if (props.montant.egale(Money.zero())) {
  throw new InvariantViolated('Un Encaissement ne peut pas être de 0 €');
}
```

---

### WR-09: `Money.multiplyByFraction` accepte `num = 0n` qui retourne `Money.zero()` — comportement OK mais asymétrique

**File:** `src/domain/_shared/money.ts:121-150`
**Issue:** La validation `if (num < 0n || num > den)` accepte `num === 0n` → `Money.zero()`. Acceptable car prorata 0 = 0€. Mais aucun test explicite ne le couvre (cf `multiplyByFraction` mentioné nulle part dans tests/unit/money.test.ts non lu). Risque de regression silencieuse.

**Fix:** Ajouter un test unitaire `multiplyByFraction(0n, 30n)` returns `Money.zero()`. Mineur — c'est une couverture de test, pas un bug.

---

### WR-10: `web/routes/relances.ts:79-83` — pas de validation Zod pour POST /relances

**File:** `src/web/routes/relances.ts:76-83`
**Issue:**
```typescript
app.post('/relances', async (req, reply) => {
  const body = req.body as { echeanceId?: string; niveau?: string };
  const echeanceId = body.echeanceId;
  const niveauRaw = parseInt(body.niveau ?? '', 10);

  if (!echeanceId || ![1, 2, 3].includes(niveauRaw)) {
    return reply.code(400).send('Paramètres invalides.');
  }
```

Aucune validation que `echeanceId` est un UUID v4 (le repo accepte n'importe quelle string, ce qui peut amener à des comportements imprévus). Pas de schéma Zod comme dans les autres routes (`encaissement-schemas.ts`, etc.).

**Fix:** Créer `src/web/schemas/relance-schemas.ts` et appliquer comme dans les autres routes :
```typescript
export const relanceFormSchema = z.object({
  echeanceId: z.string().uuid('Sélectionnez une échéance valide'),
  niveau: z.coerce.number().int().min(1).max(3),
});
```

---

### WR-11: `web/routes/quittances.ts:188-209` — pas de re-fetch post-annulation pour éviter race

**File:** `src/web/routes/quittances.ts:200-210`
**Issue:**
```typescript
const quittance = await opts.quittanceRepo.trouverParId(id as QuittanceId);
const numeroSauvegarde = quittance?.numero ?? id;

await annulerQuittance(
  { id: id as QuittanceId, raison: parsed.data.raison },
  opts.quittanceRepo,
  opts.clock,
);
```

`numeroSauvegarde = quittance?.numero ?? id` : si `quittance` est null mais qu'on continue à `annulerQuittance`, le use case lèvera `QuittanceIntrouvable` qui ne sera **pas** catché → le caller voit une 500 au lieu d'une 404. Le pattern `quittance?.` masque l'erreur jusqu'au use case.

**Fix:**
```typescript
const quittance = await opts.quittanceRepo.trouverParId(id as QuittanceId);
if (!quittance) {
  return reply.code(404).send('Quittance introuvable.');
}
const numeroSauvegarde = quittance.numero;
// ... continue ...
```

---

### WR-12: `web/routes/echeances.ts:206-208` — slicing fragile pour générer filename

**File:** `src/web/routes/echeances.ts:206-208`
**Issue:**
```typescript
const periode = echeance.periodeDebut.toString().substring(0, 7).replace('-', '-');
const idCourt = id.substring(0, 8);
const filename = `avis-echeance-${periode}-${idCourt}.pdf`;
```

Le `.replace('-', '-')` est un no-op (replace `-` par `-`) — probablement un copier-coller. `idCourt = id.substring(0, 8)` n'a pas de validation que `id` est un UUID v4 — si quelqu'un manipule l'URL avec un id court, le filename devient `avis-echeance-2026-05-x.pdf` avec un idCourt partiel sans suffixe.

**Fix:**
```typescript
const periode = echeance.periodeDebut.toString().substring(0, 7);  // YYYY-MM
const idCourt = id.length >= 8 ? id.substring(0, 8) : id;
const filename = `avis-echeance-${periode}-${idCourt}.pdf`;
```

---

### WR-13: Migrations 0002 — `ALTER TABLE bail ADD COLUMN actif_depuis TEXT NULL` puis `ADD COLUMN jour_echeance INTEGER NOT NULL DEFAULT 1`

**File:** `migrations/0002_phase2_bailleur_bail_ext.sql:8-10`
**Issue:** L'ajout de `jour_echeance INTEGER NOT NULL DEFAULT 1 CHECK (...)` sur une table existante :
1. SQLite supporte cela depuis la version 3.31 (`generated columns` et `DEFAULT` constants). Si le runtime est < 3.31, échec silencieux.
2. La contrainte CHECK est attachée à la colonne MAIS le `CHECK` doit s'évaluer sur les **anciennes rangées** avec `jour_echeance = 1` par défaut. OK ici car 1 ∈ [1, 28]. Mais le commentaire ne le précise pas — devrait documenter "DEFAULT 1 garantit que CHECK passe pour toutes les rangées existantes".

Plus problématique : la migration n'est **pas atomique**. Les deux `ALTER TABLE` sont deux statements séparés. Si la 2ème échoue (ex : panne disque entre les deux), on a `actif_depuis` ajouté sans `jour_echeance` → DB dans un état incohérent.

**Fix:**
```sql
BEGIN TRANSACTION;
ALTER TABLE bail ADD COLUMN actif_depuis TEXT NULL;
ALTER TABLE bail ADD COLUMN jour_echeance INTEGER NOT NULL DEFAULT 1
  CHECK (jour_echeance >= 1 AND jour_echeance <= 28);
COMMIT;
```

Note : `better-sqlite3.exec` peut déjà encapsuler en transaction implicite par défaut — à vérifier.

## Info

### IN-01: `src/application/encaissements/activer-bail.ts:117-126` — branche dead-code

**File:** `src/application/encaissements/activer-bail.ts:117-126`
**Issue:** La branche `if (actifDepuis.day === 1 && i === dureeMois - 1)` est identique à la branche suivante `if (actifDepuis.day === 1)`. La condition `&& i === dureeMois - 1` n'amène pas à un comportement différent.

**Fix:** Supprimer la première branche (lignes 117-122).

---

### IN-02: `src/web/routes/baux.ts:563-571` — dynamic import inutile dans handler

**File:** `src/web/routes/baux.ts:563-571`
**Issue:** Dans `POST /baux/:id/modifier-actif`, les imports dynamiques au runtime :
```typescript
const { Temporal: _T } = await import('@js-temporal/polyfill');
const { Money: _M } = await import('../../domain/_shared/money.js');
const { IRL: _IRL } = await import('../../domain/_shared/irl.js');
const { Adresse: _Addr } = await import('../../domain/_shared/adresse.js');
```

Ces modules sont déjà importés statiquement en tête de fichier (lignes 1, 8, 9, 10). Le `await import()` ajoute latence à chaque POST.

**Fix:** Utiliser les imports déjà disponibles, supprimer les `await import(...)`.

---

### IN-03: Templates relances — mentions de fallback "Cordialement" non personnalisable

**File:** `templates/relances/01-amiable.ejs:14`, `templates/relances/02-ferme.ejs:13`
**Issue:** Le bailleur n'a pas de "civilité" (Monsieur/Madame) ni de "fonction" dans le profil. Les templates terminent par "Cordialement, <%= nom_bailleur %>" sans option de personnalisation. Acceptable en V1, à noter pour V1.1.

**Fix:** Hors scope. À documenter dans `RISKS.md` ou backlog.

---

### IN-04: `src/domain/encaissements/quittance.ts:11-12` — regex numero accepte sequences > 1000

**File:** `src/domain/encaissements/quittance.ts:11-12`
**Issue:**
```typescript
const NUMERO_REGEX = /^\d{4}-\d{3,}$/;
```

Accepte `2026-001` mais aussi `2026-1234567890`. Le format légal n'a pas de borne supérieure stricte, donc OK, mais la régex `\d{3,}` peut amener à un comportement étrange si jamais le compteur dépasse 999 (l'attribution suivante après `2026-999` serait `2026-1000`, qui passe). Le `formatNumeroQuittance` lui padding à 3 chars minimum, OK.

**Fix:** Mineur. Documenter dans le PRD : "compteur 0001-9999 par année".

---

### IN-05: `src/web/views/pages/baux/modifier.ejs:170-187` — JS inline avec `IIFE` répétée

**File:** `src/web/views/pages/baux/modifier.ejs:170-187`, `src/web/views/pages/quittances/fiche.ejs:100-109`, `src/web/views/pages/encaissements/fiche.ejs:75-84`
**Issue:** Pattern `(function() { ... })();` répété dans 3 fiches. Le code est identique modulo `dialog-` id. Duplication.

**Fix:** Externaliser dans `/public/js/dialog-handler.js` avec attribut `data-dialog-target` :
```js
document.querySelectorAll('[data-open-dialog]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const id = btn.dataset.openDialog;
    document.getElementById(id).showModal();
  });
});
```

---

### IN-06: `src/main.ts:241` — `import.meta.url === \`file://${process.argv[1]}\`` ne marche pas sur Windows

**File:** `src/main.ts:241-243`, `src/infrastructure/db/database.ts:122-124`
**Issue:**
```typescript
if (import.meta.url === `file://${process.argv[1]}`) {
  await demarrer();
}
```

`import.meta.url` utilise toujours des `/` (POSIX style URL), mais `process.argv[1]` utilise `\` sur Windows. La comparaison échoue silencieusement sur Windows → le démarrage CLI ne fonctionne pas.

**Fix:**
```typescript
import { fileURLToPath } from 'node:url';
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  await demarrer();
}
```

Hors scope V1 (local-first macOS/Linux), à noter pour Windows.

---

_Reviewed: 2026-05-14T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
