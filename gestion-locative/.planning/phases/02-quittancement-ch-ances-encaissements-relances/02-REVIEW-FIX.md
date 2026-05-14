---
phase: 02-quittancement-ch-ances-encaissements-relances
fixed_at: 2026-05-14T21:37:00Z
review_path: .planning/phases/02-quittancement-ch-ances-encaissements-relances/02-REVIEW.md
iteration: 1
findings_in_scope: 20
fixed: 19
skipped: 1
status: partial
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-05-14T21:37:00Z
**Source review:** .planning/phases/02-quittancement-ch-ances-encaissements-relances/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 20 (7 Critical + 13 Warning)
- Fixed: 19
- Skipped: 1 (WR-09 — test couverture déjà présente)

Tests post-fix : 229/229 vitest + 36/36 cucumber BDD passent. Typecheck clean.

## Fixed Issues

### CR-01: `modifier-bail-actif` régénère mal les échéances futures

**Files modified:** `src/application/locatif/modifier-bail-actif.ts`
**Commit:** 58fdd96
**Applied fix:** Remplacé le slice-par-index par un matching strict via `Set<periodeDebut.toString()>`. Les périodes supprimées sont collectées AVANT la suppression, puis on filtre les échéances régénérées qui correspondent exactement à ces périodes. Garde-fou ajouté : `InvariantViolated` si le compte ne correspond pas. Robuste face aux périodes non-contiguës et au changement de `jourEcheance`.

---

### CR-02: PDF écrit hors transaction — corruption en cas de crash

**Files modified:** `src/application/encaissements/generer-quittance.ts`
**Commit:** 5d96c62
**Applied fix:** Encapsulé la génération PDF + écriture disque dans un `try/catch`. En cas d'échec, la quittance est annulée (copy-on-write `Quittance.annuler`) pour cohérence audit — pas de ligne BDD orpheline pointant vers un PDF inexistant. Le numéro est "brûlé" mais c'est un compromis acceptable (audit > densité).
**Note logique :** la compensation préserve l'invariant "quittance active ⇒ PDF présent". Vérifier manuellement le chemin de récupération (ex : panne disque réelle) avant production.

---

### CR-03: Transaction Kysely non propagée + race condition compteur

**Files modified:** `src/infrastructure/repositories/quittance-repository-sqlite.ts`
**Commit:** 03b0630
**Applied fix:** Type `DbOrTrx = Kysely<DB> | Transaction<DB>` introduit (Transaction étend Kysely en Kysely 0.28+). `enregistrer()` et `prochainNumero()` utilisent désormais `trxArg ?? this.db` proprement. `prochainNumero` migré vers un UPSERT atomique `INSERT ... ON CONFLICT DO UPDATE SET valeur = CAST(... AS TEXT) RETURNING valeur` (SQLite ≥ 3.35) — élimine la race SELECT-puis-UPDATE.

---

### CR-04: `trouverParId` exclut silencieusement les échéances annulées

**Files modified:** `src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts`
**Commit:** 0ed7ec2
**Applied fix:** Supprimé le filtre `where('annule_le', 'is', null)` du `trouverParId`. Le filtrage reste légitime sur les listes (`listerParBail`, `listerNonPayees`). Les callers doivent inspecter `echeance.statut === 'annulee'` pour décider. Conforme à D-60/D-74 (soft-delete audit-friendly).

---

### CR-05: `recalculerStatutEcheance` peut écraser le statut `annulee`

**Files modified:** `src/application/encaissements/recalculer-statut-echeance.ts`
**Commit:** e7e364c
**Applied fix:** Early return si `echeance.statut === 'annulee'`. Un recalcul ne ressuscite jamais une échéance annulée — l'état est terminal. Bloque aussi le TOCTOU entre creer-encaissement et annulation.

---

### CR-06: Erreurs typées incorrectement dans `enregistrer-relance`

**Files modified:** `src/application/encaissements/enregistrer-relance.ts`
**Commit:** 371cb65
**Applied fix:** Imports + utilisation des erreurs domaines dédiées : `BailIntrouvable` (locatif), `LocataireIntrouvable` (locatif), `BienIntrouvable` (patrimoine) au lieu d'`EcheanceLoyerIntrouvable`. Le caller peut désormais distinguer la cause via `instanceof`.

---

### CR-07: EJS XSS — durcissement defense-in-depth

**Files modified:** `src/main.ts`
**Commit:** cb60101
**Applied fix:** Ajout d'un hook `onSend` global posant les headers de sécurité : Content-Security-Policy (`default-src 'self'; script-src 'self' 'unsafe-inline'; ...`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`. `'unsafe-inline'` est conservé pour les `<script>` inline existants (modifier.ejs, fiche.ejs). Couplé à IN-05 si on bascule vers des scripts externes (nonce mode).
**Note :** la revue cite des lignes inexistantes (detail.ejs:233 — le fichier fait 117 lignes ; echeances.ts:255 — le fichier fait 216 lignes). Audit du code actuel : `<%= %>` (escape) utilisé partout sur les chaînes utilisateur, `<%- %>` uniquement sur `include(...)`. Pas de XSS réel exploitable identifié, la CSP est une défense en profondeur.

---

### WR-01: Duck-typing sur Bail dans `creer-encaissement`

**Files modified:** `src/application/encaissements/creer-encaissement.ts`
**Commit:** 3c6999a
**Applied fix:** Supprimé les casts `(bail as { actifDepuis: unknown })` et `(bail as { dateDebut: Temporal.PlainDate })`. La classe `Bail` expose déjà ces champs typés.

---

### WR-02: `PdfRendererPdfmake` double instanciation

**Files modified:** `src/web/routes/relances.ts`, `src/main.ts`
**Commit:** 13f9150
**Applied fix:** Le plugin relances accepte désormais `pdfRenderer: PdfRenderer` via `opts` (DI singleton). main.ts passe l'instance unique. Évite la double-configuration de pdfmake font state.

---

### WR-03: Protection path traversal incomplète

**Files modified:** `src/infrastructure/storage/stockage-fichier-local.ts`
**Commit:** e3550d9
**Applied fix:** Trois protections empilées dans `lireQuittance` : (1) rejet immédiat des NULL bytes (`\0`), (2) check `startsWith(baseDir)` sur le chemin résolu, (3) `fs.realpath()` pour résoudre les symlinks, puis check renouvelé. Bloque les symlinks pointant hors de `baseDir`.

---

### WR-04: Troncature mailto au milieu d'une séquence %XX

**Files modified:** `src/helpers/build-mailto.ts`
**Commit:** e995901
**Applied fix:** Avant de tronquer, recule de 1-2 caractères si on est au milieu d'une séquence `%XX` (i.e. si `bodyEnc[limite-1]` ou `bodyEnc[limite-2]` est `'%'`). Évite un URI malformé que `decodeURIComponent` rejetterait côté client.

---

### WR-05: `Money.toJSON()` overflow MAX_SAFE_INTEGER

**Files modified:** `src/domain/_shared/money.ts`, `src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts`, `src/infrastructure/repositories/bail-repository-sqlite.ts`, `src/infrastructure/repositories/encaissement-repository-sqlite.ts`
**Commit:** 6afbc59
**Applied fix:** (1) `toJSON()` assert sur `[MIN_SAFE_INTEGER, MAX_SAFE_INTEGER]` (couvre négatifs/compensateurs). (2) Nouvelle méthode `Money.toSqliteInteger()` qui fait le même check, à utiliser pour le stockage SQLite. (3) Migration des 3 repos (Number(toCentimes()) → toSqliteInteger()). Stockage en TEXT pour montants > 90 milliards d'euros documenté comme suite (RISKS.md).

---

### WR-06: `genererEcheancesPour` duck-typed signature

**Files modified:** `src/application/encaissements/activer-bail.ts`
**Commit:** ccbbfd9
**Applied fix:** Signature typée via `Pick<Bail, 'id' | 'dureeMois' | 'loyerHc' | 'montantCharges' | 'modeCharges' | 'bienId' | 'locataireId'>` exporté sous `ContratBailPourGeneration`. Élimine les imports inline `import('../../...')` et le cast `bail.id as BailId`. Garantit que tout caller partage le contrat Bail.

---

### WR-07: Bailleur enregistrer non-idempotent

**Files modified:** `src/infrastructure/repositories/bailleur-repository-sqlite.ts`
**Commit:** fcc9c69
**Applied fix:** `INSERT INTO bailleur ... ON CONFLICT (singleton_marker) DO UPDATE SET ...` — UPSERT idempotent. Bloque la race TOCTOU entre `trouver()` et `enregistrer()` dans `creer-ou-maj-bailleur`.

---

### WR-08: Encaissement de 0€ accepté par le domaine

**Files modified:** `src/domain/encaissements/encaissement.ts`
**Commit:** 0ff54c1
**Applied fix:** `Encaissement.creer` jette `InvariantViolated` si `props.montant.egale(Money.zero())`. Cohérence avec Zod qui refuse déjà 0€ côté web.

---

### WR-10: POST /relances sans validation Zod

**Files modified:** `src/web/routes/relances.ts`, `src/web/schemas/relance-schemas.ts` (nouveau)
**Commit:** 0cfb5a3
**Applied fix:** Nouveau schéma `relanceFormSchema` (UUID v4 + niveau coerce 1-3). La route POST utilise `safeParse` avec 400 si invalide. Pattern aligné sur les autres routes.

---

### WR-11: Annulation quittance pas de re-fetch / 500 silencieux

**Files modified:** `src/web/routes/quittances.ts`
**Commit:** 136b159
**Applied fix:** Check `if (!quittance) return reply.code(404)` avant d'appeler `annulerQuittance`. Empêche `QuittanceIntrouvable` de remonter en 500.

---

### WR-12: Slicing filename avec replace no-op

**Files modified:** `src/web/routes/echeances.ts`
**Commit:** da9037f
**Applied fix:** Supprimé le `replace('-', '-')` (no-op). Ajouté garde `id.length >= 8 ? id.substring(0, 8) : id` pour éviter un idCourt vide si l'id est trop court.

---

### WR-13: Migration 0002 non atomique

**Files modified:** `migrations/0002_phase2_bailleur_bail_ext.sql`
**Commit:** 1bf455e
**Applied fix:** Entouré la migration par `BEGIN TRANSACTION; ... COMMIT;`. Si le 2ᵉ ALTER échoue (panne disque), la base reste cohérente. Documenté que `DEFAULT 1` garantit que la contrainte CHECK passe pour toutes les rangées existantes.

## Skipped Issues

### WR-09: `multiplyByFraction(0n)` couverture de test

**File:** `src/domain/_shared/money.ts:121-150`
**Reason:** Test déjà présent. Vérifié dans `tests/unit/_shared/money.test.ts:165-169` — `it('multiplyByFraction(0n, 31n) retourne Money.zero()')`. Aucune action requise.
**Original issue:** La validation `if (num < 0n || num > den)` accepte `num === 0n` → `Money.zero()`. Aucun test explicite ne le couvre.

---

_Fixed: 2026-05-14T21:37:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
