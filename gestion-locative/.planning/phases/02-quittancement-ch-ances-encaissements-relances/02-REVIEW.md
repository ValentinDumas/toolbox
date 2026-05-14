---
phase: 02-quittancement-ch-ances-encaissements-relances
reviewed: 2026-05-14T22:30:00Z
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
  - src/web/schemas/relance-schemas.ts
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
  critical: 1
  warning: 4
  info: 6
  total: 11
status: issues_found
---

# Phase 2: Code Review Report (Re-Review #2)

**Reviewed:** 2026-05-14T22:30:00Z
**Depth:** standard
**Files Reviewed:** 117
**Status:** issues_found

## Summary

Re-review après application des fixes (REVIEW-FIX iteration 1). **Excellente progression** : 19 sur 20 findings traités, dont l'intégralité des Critical (CR-01 à CR-07). Les fixes appliqués sont structurellement corrects et préservent l'architecture hexagonale.

**Confirmation des fixes propres :**
- **CR-01** (`modifier-bail-actif`) : matching strict par `Set<periodeDebut.toString()>` + invariant check — robuste face aux gaps et au changement de `jourEcheance`.
- **CR-02** (PDF transactionnel) : compensation via `Quittance.annuler` copy-on-write en cas d'erreur PDF/disque — la quittance est marquée annulée pour préserver l'invariant audit "row active ⇒ PDF présent".
- **CR-03** (transaction Kysely + race compteur) : type `DbOrTrx = Kysely<DB> | Transaction<DB>` propre + UPSERT atomique `INSERT … ON CONFLICT DO UPDATE SET valeur = CAST(meta.valeur+1 AS TEXT) RETURNING valeur`.
- **CR-04** (`trouverParId` soft-deletes) : filtrage retiré, conforme à D-60/D-74.
- **CR-05** (recalcul statut annulée) : early return si `echeance.statut === 'annulee'`.
- **CR-06** (erreurs typées) : `BailIntrouvable`, `LocataireIntrouvable`, `BienIntrouvable` dédiés.
- **CR-07** (CSP) : headers `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy` ajoutés via hook `onSend`.
- **WR-01 à WR-13** : duck-typing supprimé, `pdfRenderer` injecté en singleton, path traversal blindé via `fs.realpath`+null-byte, troncature mailto safe, `Money.toSqliteInteger()` avec assert, `Pick<Bail, …>`, UPSERT bailleur, Encaissement 0€ rejeté, Zod schema relances, 404 quittance, slicing filename safe, migration 0002 transactionnelle.

**Nouveaux findings ou résidus après fix :**

1. **WR-05 partiellement appliqué (1 Critical résiduel)** : `bail-repository-sqlite.ts:48-51` utilise toujours `Number(bail.loyerHc.toCentimes())` dans la clause `doUpdateSet` du UPSERT. Le fix WR-05 a remplacé l'idiome dans `.values()` mais a oublié `.doUpdateSet()`. Conséquence : le chemin de mise à jour (utilisé par `modifierBailActif` qui appelle `bailRepo.enregistrer(bailModifie)`) **contourne** l'assert `MAX_SAFE_INTEGER`. Régression directe.

2. **IN-01 / IN-02 non appliqués** : la branche morte dans `activer-bail.ts:126-130` (vue de l'algorithme : 2 branches identiques pour `actifDepuis.day === 1`) et les imports dynamiques inutiles dans `baux.ts:563-566` sont toujours présents.

3. **`ActiviteBailDetectorSqlite` ne tient pas sa docstring** : la docstring stipule que l'extension 02-03/02-04 doit chaîner les checks sur `encaissement` et `quittance`. L'implémentation se limite au count `echeance_loyer WHERE annule_le IS NULL`. Risque concret : si toutes les échéances d'un bail sont soft-deleted, le détecteur retourne `false` même si encaissements/quittances persistent — la suppression hard-delete laisserait des orphelins (FK CASCADE inexistant).

4. **Compensation CR-02 best-effort silencieuse** : si la génération PDF échoue ET que la compensation `quittance.annuler() + repo.enregistrer()` échoue aussi, l'erreur d'annulation est swallowed (`catch {}` ligne 164-166). La quittance reste alors active en BDD avec un PDF inexistant. Le commentaire reconnaît le compromis mais aucun log ni alerting — invisible pour l'opérateur.

5. **Couverture de tests des nouveaux invariants** : WR-08 (Encaissement 0€), CR-05 (recalcul préservant `annulee`), WR-04 (troncature `%XX`) ne sont pas couverts par des tests dédiés.

6. **Dead code** : `listerQuittances` use case exporté mais non importé ; `compterParBail` repo method non utilisée.

## Critical Issues

### CR-01: `bail-repository-sqlite.enregistrer` — WR-05 fix incomplet, l'UPSERT du chemin de mise à jour ignore l'assert overflow

**File:** `src/infrastructure/repositories/bail-repository-sqlite.ts:48,50,51`
**Issue:** Le fix WR-05 a remplacé `Number(bail.loyerHc.toCentimes())` par `bail.loyerHc.toSqliteInteger()` dans la clause `.values(...)` (lignes 32-35), mais **a oublié de remplacer aussi les 3 lignes équivalentes dans la clause `.doUpdateSet(...)`** :

```typescript
.onConflict((oc) =>
  oc.column('id').doUpdateSet({
    locataire_id: bail.locataireId,
    bien_id: bail.bienId,
    date_debut: bail.dateDebut.toString(),
    duree_mois: bail.dureeMois,
    loyer_hc: Number(bail.loyerHc.toCentimes()),          // ← BUG (était à corriger WR-05)
    mode_charges: bail.modeCharges,
    montant_charges: Number(bail.montantCharges.toCentimes()),  // ← BUG
    depot_garantie: Number(bail.depotGarantie.toCentimes()),    // ← BUG
    // ...
  }),
)
```

Conséquence : le **chemin de mise à jour** (déclenché par UPSERT sur `id` existant — utilisé notamment par `modifierBailActif.ts:98 → bailRepo.enregistrer(bailModifie)` quand le bail est régénéré, et par toute autre mise à jour de bail existant) bypass complètement l'assert `MAX_SAFE_INTEGER` de `toSqliteInteger()`. Pour un bail dont le loyer dépasserait `2^53` centimes (90 milliards d'euros — théorique mais possible avec compensateurs négatifs cumulés sur les autres tables), la valeur est silencieusement tronquée aux 2^53 voisins.

Le bug est **identique** au défaut original WR-05 — fix partiel.

**Fix:**
```typescript
.onConflict((oc) =>
  oc.column('id').doUpdateSet({
    locataire_id: bail.locataireId,
    bien_id: bail.bienId,
    date_debut: bail.dateDebut.toString(),
    duree_mois: bail.dureeMois,
    loyer_hc: bail.loyerHc.toSqliteInteger(),
    mode_charges: bail.modeCharges,
    montant_charges: bail.montantCharges.toSqliteInteger(),
    depot_garantie: bail.depotGarantie.toSqliteInteger(),
    irl_trimestre: bail.irlReference.trimestre,
    irl_valeur: bail.irlReference.valeur,
    cautionnement: cautionnementJson,
    actif_depuis: bail.actifDepuis?.toString() ?? null,
    jour_echeance: bail.jourEcheance,
    modifie_le: new Date().toISOString(),
  }),
)
```

## Warnings

### WR-01: `ActiviteBailDetectorSqlite` — contredit sa propre docstring et laisse des orphelins potentiels

**File:** `src/infrastructure/repositories/activite-bail-detector-sqlite.ts:21-35`
**Issue:** Le docstring annonce (lignes 13-15) :
- 02-02 : `count(echeance_loyer WHERE bail_id = ?)`
- 02-03 : `+ count(encaissement via echeance)`
- 02-04 : `+ count(quittance via echeance)`

L'implémentation se limite au 1er check, avec en plus le filtre `annule_le IS NULL` qui exclut les échéances soft-deleted :
```typescript
.where('bail_id', '=', bailId)
.where('annule_le', 'is', null)  // ← Exclut les échéances annulées
```

Scénario réel : si un opérateur annule TOUTES les échéances d'un bail (cas légitime D-60), `aDeLActivite` retourne `false` → `supprimerBail` accepte la hard-delete → encaissements + quittances liés à ces échéances soft-deleted restent en BDD avec `bail_id` orphelin (les FK SQL `REFERENCES echeance_loyer(id)` empêchent la suppression de l'échéance mais pas du bail).

Le commentaire ligne 33 dit "Plans 02-03 et 02-04 étendront avec encaissement + quittance" mais la phase 02 est complétée (cf 2742e13 "verify and mark complete — 5/5 must-haves"). Soit le commentaire est un artefact historique et il faut compléter, soit la docstring est obsolète et il faut documenter le compromis.

**Fix:** étendre la requête OR avec encaissement + quittance (court-circuit dès qu'une activité est détectée) :
```typescript
async aDeLActivite(bailId: BailId): Promise<boolean> {
  // 02-02 : echeance_loyer
  const rEch = await this.db
    .selectFrom('echeance_loyer')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('bail_id', '=', bailId)
    // Inclut les annulées : audit-friendly (D-60)
    .executeTakeFirst();
  if (Number(rEch?.n ?? 0) > 0) return true;

  // 02-03 : encaissements via echeances (inclut soft-deleted)
  const rEnc = await this.db
    .selectFrom('encaissement')
    .innerJoin('echeance_loyer', 'echeance_loyer.id', 'encaissement.echeance_id')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('echeance_loyer.bail_id', '=', bailId)
    .executeTakeFirst();
  if (Number(rEnc?.n ?? 0) > 0) return true;

  // 02-04 : quittances via echeances
  const rQui = await this.db
    .selectFrom('quittance')
    .innerJoin('echeance_loyer', 'echeance_loyer.id', 'quittance.echeance_id')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('echeance_loyer.bail_id', '=', bailId)
    .executeTakeFirst();
  return Number(rQui?.n ?? 0) > 0;
}
```

À défaut d'étendre, retirer le filtre `annule_le IS NULL` ligne 27 pour inclure les échéances soft-deleted (le bail garde activity tant qu'il a touché à `echeance_loyer`).

---

### WR-02: `generer-quittance.ts` compensation silencieuse — pas de log, pas d'alerte

**File:** `src/application/encaissements/generer-quittance.ts:156-168`
**Issue:**
```typescript
} catch (err) {
  try {
    const quittanceAnnulee = quittance!.annuler(
      `Erreur génération PDF: ${err instanceof Error ? err.message : String(err)}`,
      clock.aujourdhui(),
    );
    await repos.quittanceRepo.enregistrer(quittanceAnnulee);
  } catch {
    // L'annulation échoue — on laisse l'erreur initiale remonter (best-effort).
  }
  throw err;
}
```

Si BOTH l'écriture PDF échoue ET la compensation échoue (catch interne avale silencieusement), on remonte l'erreur PDF mais l'invariant "row active ⇒ PDF présent" est **violé sans trace**. L'opérateur n'a aucun moyen de détecter l'incohérence (pas de log d'erreur de compensation, pas de système d'alerte ni de file d'attente de reprise).

Conséquence : `/quittances/:id/pdf` retournera 404 alors que la quittance "existe" en base. C'est exactement le scénario que CR-02 cherchait à prévenir, juste reporté à un cas plus rare (double-erreur).

**Fix:** Logger explicitement la compensation ratée pour qu'un humain puisse intervenir.
```typescript
} catch (err) {
  try {
    const quittanceAnnulee = quittance!.annuler(/* … */);
    await repos.quittanceRepo.enregistrer(quittanceAnnulee);
  } catch (compErr) {
    // CRITIQUE : double erreur. Logger explicitement — l'invariant audit
    // "quittance active ⇒ PDF présent" est violé. Action manuelle requise.
    console.error(
      `[CRITICAL] generer-quittance compensation failed for quittance ${quittance!.id} (${quittance!.numero}). ` +
      `Original error: ${err instanceof Error ? err.message : String(err)}. ` +
      `Compensation error: ${compErr instanceof Error ? compErr.message : String(compErr)}. ` +
      `Manual cleanup required: UPDATE quittance SET annulee_le = … WHERE id = '${quittance!.id}'`,
    );
  }
  throw err;
}
```

À défaut, l'opérateur devrait pouvoir relancer une "regen" de PDF depuis la fiche quittance (helper qui re-rend le PDF depuis l'état BDD existant — déjà ~implémenté pour les relances PDF).

---

### WR-03: `recalculer-statut-echeance.ts` — erreur générique non typée pour échéance introuvable

**File:** `src/application/encaissements/recalculer-statut-echeance.ts:36-38`
**Issue:**
```typescript
if (!echeance) {
  throw new Error(`Échéance introuvable : ${echeanceId}`);
}
```

Une `EcheanceLoyerIntrouvable` typée existe déjà (`src/domain/encaissements/erreurs.ts:1-6`). Le use case `creer-encaissement.ts:47` et `enregistrer-relance.ts:69` lèvent déjà cette erreur typée. Le caller `annulerEncaissement` (line 49 de `annuler-encaissement.ts`) ne peut pas distinguer cette cause via `instanceof` — c'est exactement le pattern CR-06 dénoncé.

**Fix:**
```typescript
import { EcheanceLoyerIntrouvable } from '../../domain/encaissements/erreurs.js';
// ...
if (!echeance) {
  throw new EcheanceLoyerIntrouvable(String(echeanceId));
}
```

---

### WR-04: IN-01 + IN-02 non appliqués (résiduel)

**File:** `src/application/encaissements/activer-bail.ts:126-130`, `src/web/routes/baux.ts:563-566`

**Issue 1 (activer-bail.ts) :** Branche morte conservée :
```typescript
if (actifDepuis.day === 1 && i === dureeMois - 1) {
  // Bail d'1 mois entier commençant le 1er
  periodeFin = actifDepuis.with({ day: actifDepuis.daysInMonth });
  loyerPeriode = loyerHc;
  chargesPeriode = montantCharges;
} else if (actifDepuis.day === 1) {
  // 1er du mois → mois plein
  periodeFin = actifDepuis.with({ day: actifDepuis.daysInMonth });
  loyerPeriode = loyerHc;
  chargesPeriode = montantCharges;
}
```

`Bail.creer` impose `dureeMois >= 12` (D-35). Donc `i === 0 && i === dureeMois - 1` est impossible (exigerait `dureeMois === 1`). Les 2 branches produisent en plus le même calcul — duplication pure.

**Issue 2 (baux.ts) :** Imports dynamiques inutiles à chaque POST :
```typescript
const { Temporal: _T } = await import('@js-temporal/polyfill');
const { Money: _M } = await import('../../domain/_shared/money.js');
const { IRL: _IRL } = await import('../../domain/_shared/irl.js');
const { Adresse: _Addr } = await import('../../domain/_shared/adresse.js');
```

Ces modules sont déjà importés statiquement en tête de `baux.ts` (lignes 1, 8, 9, 10). Les imports dynamiques ajoutent un await à chaque modification de bail actif et créent une confusion sur la frontière `_M`/`Money`.

**Fix:**

Pour activer-bail.ts, supprimer la 1re branche (lignes 126-130) :
```typescript
if (i === 0) {
  periodeDebut = actifDepuis;
  if (actifDepuis.day === 1) {
    periodeFin = actifDepuis.with({ day: actifDepuis.daysInMonth });
    loyerPeriode = loyerHc;
    chargesPeriode = montantCharges;
  } else {
    // Milieu de mois → prorata
    // …
  }
}
```

Pour baux.ts, supprimer les imports dynamiques et utiliser `Temporal`, `Money`, `IRL`, `Adresse`, `Cautionnement` déjà importés statiquement.

## Info

### IN-01: Test coverage gap — WR-08 (Encaissement.creer rejette 0€)

**File:** `tests/unit/encaissements/encaissement.test.ts`
**Issue:** Le fix WR-08 ajoute l'invariant "un Encaissement ne peut pas être de 0 €" mais aucun test ne couvre ce scénario. Risque de régression silencieuse — un futur refactor de `Encaissement.creer` pourrait retirer le check sans déclencher de test rouge.
**Fix:**
```typescript
it('rejette montant = 0 €', () => {
  expect(() =>
    Encaissement.creer({ ...propsValide(), montant: Money.zero() }),
  ).toThrow(InvariantViolated);
});
```

---

### IN-02: Test coverage gap — CR-05 (recalculerStatutEcheance préserve 'annulee')

**File:** `tests/unit/encaissements/recalculer-statut-echeance.test.ts`
**Issue:** Aucun test ne vérifie que `recalculerStatutEcheance` sur une échéance déjà `annulee` retourne `{ statut: 'annulee', ... }` sans persister un autre statut.
**Fix:**
```typescript
it('CR-05: échéance déjà annulée → preserve statut annulee, pas de mettreAJourStatut', async () => {
  const echeance = creerEcheance(TOTAL);
  // Forcer statut 'annulee' via stub
  const { echeanceLoyerRepo, encaissementRepo } = creerRepos(
    { ...echeance, statut: 'annulee' } as EcheanceLoyer,
    Money.fromEuros(700),
  );
  const mettreAJourSpy = vi.spyOn(echeanceLoyerRepo, 'mettreAJourStatut');
  const result = await recalculerStatutEcheance(echeance.id, echeanceLoyerRepo as never, encaissementRepo as never);
  expect(result.statut).toBe('annulee');
  expect(result.surPaiement).toBeNull();
  expect(mettreAJourSpy).not.toHaveBeenCalled();
});
```

---

### IN-03: Test coverage gap — WR-04 (build-mailto truncation au milieu de %XX)

**File:** `tests/unit/helpers/build-mailto.test.ts`
**Issue:** Le fix WR-04 ajoute une protection contre la troncature au milieu d'une séquence percent-encoded. Aucun test ne couvre ce cas pathologique (caractère accentué tombant pile à la position limite).
**Fix:**
```typescript
it('WR-04: troncature recule si elle tomberait au milieu d\'un %XX', () => {
  // Construire un body qui force la coupe à tomber sur un caractère accentué
  // (encode en 3 chars : %C3%A9 pour 'é'). Padding pour aligner avec LIMITE_CORPS.
  const padding = 'A'.repeat(1880);
  const uri = buildMailto({
    to: 'test@example.fr',
    subject: 'Test',
    body: padding + 'éééééééééééé', // 12 'é' = 36 chars encodés
  });
  const bodyMatch = uri.match(/&body=(.+)$/);
  expect(bodyMatch).toBeTruthy();
  // Le body doit être décodable sans erreur
  expect(() => decodeURIComponent(bodyMatch![1])).not.toThrow();
});
```

---

### IN-04: Dead code — `listerQuittances` use case et `compterParBail` repo method jamais appelés

**File:** `src/application/encaissements/lister-quittances.ts`, `src/domain/encaissements/echeance-loyer-repository.ts:26`, `src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts:109-118`
**Issue:**
- `listerQuittances` est exporté mais aucune route ne l'importe. Le route `/quittances` GET appelle directement `opts.quittanceRepo.listerToutes(...)` (cf `web/routes/quittances.ts:50`).
- `compterParBail` est dans l'interface `EcheanceLoyerRepository` et implémenté dans le sqlite adapter, mais seuls les stubs de test l'utilisent. Aucun code de production ne l'appelle.

Pas un bug, mais un code smell qui dérive l'API du domaine. Si on veut un jour étendre la couverture des tests par mock surface, `compterParBail` est utilisable ; sinon supprimable.

**Fix:** Soit supprimer (`rm src/application/encaissements/lister-quittances.ts` + retirer `compterParBail` de l'interface), soit câbler l'appel dans la route `/quittances`.

---

### IN-05: Migration 0002 — commentaire de DEFAULT 1 + CHECK manque la subtilité SQLite 3.31

**File:** `migrations/0002_phase2_bailleur_bail_ext.sql:10-11`
**Issue:** Le commentaire explique "DEFAULT 1 garantit que la contrainte CHECK passe pour toutes les rangées existantes" — correct. Mais il ne mentionne pas que `ALTER TABLE ... ADD COLUMN ... CHECK(...)` n'est supporté qu'à partir de SQLite 3.31 (released 2020-01-22). En environnement de test ou OS avec SQLite plus ancien, l'instruction échouera.

Le `package.json` épingle `better-sqlite3 ^11.x` qui bundle SQLite ≥ 3.42 — pas de risque en pratique. Mais le commentaire devrait noter la dépendance pour les opérateurs qui pourraient utiliser un autre adapter (turso, libsql).

**Fix:** ajouter une ligne de commentaire :
```sql
-- Requiert SQLite ≥ 3.31 (DEFAULT + CHECK sur ALTER TABLE). better-sqlite3 ^11 bundle ≥ 3.42 — OK.
```

---

### IN-06: `creer-encaissement.ts` — Bail typé `unknown` dans stubs de test, perte de signalement

**File:** `tests/unit/encaissements/creer-encaissement.test.ts:59`
**Issue:** Le stub `creerStubBailRepo` retourne `bail as unknown` (et le caller `as never`) ce qui prive le test de type-checking. Si la signature de `Bail` change, les stubs continueront de compiler.

Hors scope V1 (test seulement), mais à fixer pour V1.1 — recréer un Bail réel via `unBailValide()` builder dans les tests.

---

_Reviewed: 2026-05-14T22:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: re-review #2 après application des fixes (REVIEW-FIX iteration 1)_
