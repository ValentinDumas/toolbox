---
phase: 05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 67
files_reviewed_list:
  - src/application/fiscalite/activer-fiscalite-bien.ts
  - src/application/fiscalite/calculer-amortissement.ts
  - src/application/fiscalite/calculer-micro-bic.ts
  - src/application/fiscalite/choisir-regime.ts
  - src/application/fiscalite/cloturer-exercice.ts
  - src/application/fiscalite/collecter-prerequis-cloture.ts
  - src/application/fiscalite/creer-declaration-corrigee.ts
  - src/application/fiscalite/decomposer-justificatif.ts
  - src/application/fiscalite/detecter-bascule-lmp.ts
  - src/application/fiscalite/exporter-csv-fiscal.ts
  - src/application/fiscalite/exporter-pdf-recap.ts
  - src/application/fiscalite/lister-justificatifs-non-qualifies.ts
  - src/application/fiscalite/lister-vue-consolidee.ts
  - src/application/fiscalite/qualifier-justificatif.ts
  - src/application/fiscalite/qualifier-ticket-travaux.ts
  - src/application/fiscalite/recalculer-tableau-amortissement.ts
  - src/application/fiscalite/repartir-frais-acquisition.ts
  - src/application/fiscalite/saisir-revenus-foyer.ts
  - src/application/fiscalite/sortir-composant.ts
  - src/application/fiscalite/suggerer-qualification.ts
  - src/domain/_shared/identifiants.ts
  - src/domain/documents/justificatif-repository.ts
  - src/domain/documents/justificatif.ts
  - src/domain/fiscalite/amortissement-exercice.ts
  - src/domain/fiscalite/ard.ts
  - src/domain/fiscalite/charges-repository.ts
  - src/domain/fiscalite/composant-repository.ts
  - src/domain/fiscalite/composant.ts
  - src/domain/fiscalite/declaration-annuelle-repository.ts
  - src/domain/fiscalite/declaration-annuelle.ts
  - src/domain/fiscalite/declaration-corrigee.ts
  - src/domain/fiscalite/erreurs.ts
  - src/domain/fiscalite/qualification-fiscale.ts
  - src/domain/fiscalite/recettes-repository.ts
  - src/domain/fiscalite/regles/regle-fiscale-provider.ts
  - src/domain/fiscalite/regles/regles-2026.ts
  - src/domain/fiscalite/tableau-amortissement-repository.ts
  - src/domain/fiscalite/tableau-amortissement.ts
  - src/domain/fiscalite/valorisation-fiscale.ts
  - src/domain/fiscalite/verdict-lmp.ts
  - src/domain/identite/bailleur.ts
  - src/domain/travaux/ticket-travaux-repository.ts
  - src/domain/travaux/ticket-travaux.ts
  - src/helpers/format-categorie-charge.ts
  - src/helpers/format-pourcentage.ts
  - src/helpers/format-verdict-lmp.ts
  - src/infrastructure/pdf/recap-fiscal-doc-def.ts
  - src/infrastructure/repositories/charges-repository-sqlite.ts
  - src/infrastructure/repositories/composant-repository-sqlite.ts
  - src/infrastructure/repositories/declaration-annuelle-repository-sqlite.ts
  - src/infrastructure/repositories/declaration-corrigee-repository-sqlite.ts
  - src/infrastructure/repositories/justificatif-repository-sqlite.ts
  - src/infrastructure/repositories/recettes-repository-sqlite.ts
  - src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts
  - src/infrastructure/repositories/ticket-travaux-repository-sqlite.ts
  - src/main.ts
  - src/web/routes/fiscalite/amortissement.ts
  - src/web/routes/fiscalite/cloture.ts
  - src/web/routes/fiscalite/composants.ts
  - src/web/routes/fiscalite/exports.ts
  - src/web/routes/fiscalite/multi-bien.ts
  - src/web/routes/fiscalite/onboarding.ts
  - src/web/routes/fiscalite/qualification.ts
  - src/web/routes/fiscalite/racine.ts
  - src/web/routes/fiscalite/revenus-foyer.ts
  - src/web/schemas/fiscalite-schemas.ts
findings:
  critical: 6
  warning: 10
  info: 3
  total: 19
status: issues_found
---

# Phase 5 : Rapport de revue de code — Fiscalité LMNP

**Reviewé :** 2026-05-21
**Profondeur :** standard
**Fichiers reviewés :** 67
**Statut :** issues_found

## Résumé

La phase 5 implémente la logique fiscale LMNP (régimes micro-BIC / réel, recettes, charges, amortissement BOFIP, ARD, bascule LMP, déclaration annuelle, correction). L'architecture hexagonale est globalement respectée : le domaine est pur, les adaptateurs SQLite utilisent Kysely avec des requêtes paramétrées, les Money sont bien en BigInt centimes. Les calculs fiscaux purs (micro-BIC, amortissement, détection LMP) sont corrects au regard du CGI.

Six défauts bloquants sont identifiés, dont deux problèmes de précision arithmétique BigInt dans les repositories qui peuvent produire des montants fiscaux erronés, un double comptage d'ARD dans le cas multi-biens en `cloturerExercice`, une injection de règles 2026 codée en dur dans `DeclarationAnnuelleRepositorySqlite` (rompt l'évolution vers 2029+), un bailleurId vide passé silencieusement dans `registerFiscaliteMultiBienRoute`, et une possible division par zéro non protégée dans `joursDansExercice`.

## Issues critiques

### CR-01 : Perte de précision BigInt dans les repositories de recettes et de charges — montants fiscaux erronés

**Fichier :** `src/infrastructure/repositories/recettes-repository-sqlite.ts:47` et `src/infrastructure/repositories/charges-repository-sqlite.ts:65,111`

**Issue :** SQLite retourne `SUM()` en tant que `number` JavaScript (flottant 64 bits). Le code fait `BigInt(Math.round(total))` mais `total` est déjà un `number` — si la somme dépasse 2^53 centimes (~ 90 000 milliards d'euros), la valeur est tronquée silencieusement avant même le `BigInt()`. Même en deçà, `SUM()` peut produire des erreurs d'arrondi flottant qui se propagent dans `BigInt(Math.round(...))` : 1 + 1 centimes peut donner 1.9999... → arrondi à 1, produisant 1 centime au lieu de 2.

En pratique, pour les montants courants d'un bailleur LMNP (< 100 000 €), la perte est nulle. Mais la règle du projet est « jamais de float pour les montants fiscaux ». Le pattern correct consiste à utiliser `CAST(SUM(col) AS INTEGER)` côté SQL (SQLite stocke les entiers en INTEGER natif) et à relire le résultat directement en `BigInt`.

**Fix :**
```typescript
// recettes-repository-sqlite.ts — remplacer la query par :
.select((eb) => eb.fn.sum<string>('e.montant_centimes').as('total'))
// ...
const total = result?.total ?? '0';
return Money.fromCentimes(BigInt(total));

// OU ajouter côté SQL :
// SELECT CAST(SUM(montant_centimes) AS INTEGER) AS total
```

---

### CR-02 : REGLES_2026 codé en dur dans DeclarationAnnuelleRepositorySqlite — bascule triennale impossible

**Fichier :** `src/infrastructure/repositories/declaration-annuelle-repository-sqlite.ts:141`

**Issue :** `versDomaine()` injecte `seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES` lors de la reconstruction des `DeclarationAnnuelle` depuis SQLite. Cela signifie qu'une déclaration 2027 ou 2028 (pourtant couverte par les mêmes règles) sera correctement gérée, mais une déclaration 2029 — si d'autres règles sont introduites avec un seuil différent — sera reconstruite avec le mauvais seuil de 23 000 €. L'invariant D-FIS-G3.1 pourrait être réappelé à tort (ou pas assez) lors de la relecture.

Plus grave : le commentaire dans le code reconnaît ce défaut (`En V1, on utilise REGLES_2026`) mais le laisse en place sans mécanisme de correction. Quand la révision triennale 2029 arrivera, toutes les déclarations antérieures seront relues avec les mauvaises règles si le seuil change.

La `DeclarationAnnuelle` devrait stocker le seuil LMP utilisé à la clôture, ou la colonne `exercice` doit être passée au `RegleFiscaleProvider` pour résoudre les règles au bon millésime.

**Fix :**
```typescript
// Option A : stocker seuil_lmp_centimes dans la table et relire depuis la row
seuilLmpRecettes: Money.fromCentimes(BigInt(row.seuil_lmp_recettes_centimes)),

// Option B (sans migration) : utiliser l'exercice de la row pour résoudre les règles
// (nécessite d'injecter RegleFiscaleProvider dans le repository — violera DIP si hardcodé)
// → Option A préférable

// Si la migration n'est pas possible immédiatement, au minimum :
seuilLmpRecettes: regleFiscaleProvider.pour(row.exercice).SEUIL_LMP_RECETTES,
```

---

### CR-03 : Double comptage de l'ARD dans cloturerExercice en cas de multi-biens

**Fichier :** `src/application/fiscalite/cloturer-exercice.ts:225-238`

**Issue :** Quand il y a N biens actifs avec composants, le code crée N lignes `SYNTHESE_BIEN`, chacune avec `ardCumuleDisponible: tableau.ardCumuleEnSortie`. Mais `tableau.ardCumuleEnSortie` est le total GLOBAL de tous les biens. La méthode `dernierArdCumuleBailleur` dans `tableau-amortissement-repository-sqlite.ts:142` fait `SUM(ard_cumule_disponible_centimes)` sur toutes les SYNTHESE_BIEN — ce qui, pour 2 biens, retournera `2 × ardCumuleEnSortie` à l'exercice suivant. L'ARD est doublé (ou N-tuplé) à chaque exercice dès qu'il y a plus d'un bien.

Le commentaire dans le code (`// Simplification V1 : une SYNTHESE_BIEN par bien avec ardCumuleDisponible = ardCumuleEnSortie total`) reconnaît la simplification mais en appelle à `dernierArdCumuleBailleur` qui SUM toutes les lignes. Le comportement est donc erroné dès 2 biens.

**Fix :**
```typescript
// Option : une seule SYNTHESE_BIEN par exercice (pas par bienId) :
// Créer une SYNTHESE_BIEN avec un bienId sentinelle / nul ou le premier bienId,
// et stocker ardCumuleEnSortie une seule fois.
// OU : stocker l'ARD par bien (proportionnel) mais additionner lors de la lecture.
// La solution la plus simple en V1 mono-bailleur :
if (biensIds.length > 0) {
  amortissementExercicesLignes.push(
    AmortissementExercice.creer({
      bienId: biensIds[0]!, // un seul porteur
      composantId: null,
      exercice,
      typeLigne: 'SYNTHESE_BIEN',
      dotationTheorique: Money.zero(),
      dotationAppliquee: Money.zero(),
      ardGenere: Money.zero(),
      ardCumuleDisponible: tableau.ardCumuleEnSortie,
      ardConsomme: tableau.ardConsomme,
    }),
  );
}
```

---

### CR-04 : Possible résultat négatif silencieux dans `joursDansExercice` — crash ARD non protégé

**Fichier :** `src/application/fiscalite/calculer-amortissement.ts:104`

**Issue :** `joursDansExercice` calcule `jours = BigInt(jourDebut.until(dateSortieEffective).days) + 1n`. La méthode `until()` peut retourner 0 jour si `jourDebut === dateSortieEffective` (composant acquis et sorti le même jour) — ce qui donne `jours = 1n`, correct. Mais si un composant a `dateAcquisition` dans l'exercice ET `dateSortie` dans l'exercice antérieur (invariant D-FIS-G5.2 normalement protégé), `until()` retourne un nombre de jours négatif, et `BigInt(négative) + 1n` produit `0n` ou une valeur négative. `Money.multiplyByFraction(0n, 365n)` donne `Money.zero()`, ce qui ne crash pas mais ne génère aucune dotation — silencieusement faux.

`estActifPourExercice` est censé filtrer ces cas avant d'appeler `joursDansExercice`, mais il n'y a aucune assertion défensive dans `joursDansExercice` lui-même. Si `estActifPourExercice` est contourné (appel direct en test, ou futur refactoring), le résultat est silencieusement incorrect.

**Fix :**
```typescript
export function joursDansExercice(composant: Composant, exercice: number): bigint {
  // ... calcul existant ...
  const jours = BigInt(jourDebut.until(dateSortieEffective).days) + 1n;
  if (jours <= 0n) {
    throw new Error(
      `Invariant violé : joursDansExercice <= 0 pour composant ${composant.id} exercice ${exercice}. ` +
      `Appelez estActifPourExercice avant joursDansExercice.`
    );
  }
  return jours;
}
```

---

### CR-05 : bailleurId vide (`''`) passé silencieusement à listerVueConsolidee

**Fichier :** `src/web/routes/fiscalite/multi-bien.ts:61`

**Issue :** `const bailleurId = bailleur?.id ?? ('' as BailleurId);` — si le bailleur est absent, un identifiant vide est créé avec un cast de type forcé et passé à `listerVueConsolidee`. L'use case utilise ce `bailleurId` pour `sommeRecettesAnnuelles` et `sommeChargesParCategorie`. En V1, ces méthodes ignorent le paramètre (`_bailleurId`), donc le résultat est en pratique correct — mais c'est une bombe à retardement : quand le filtre bailleur_id sera activé en V1.1, cette route retournera silencieusement zéro pour toutes les recettes et charges plutôt qu'une erreur.

De plus, `listerVueConsolidee` fait un double lookup bailleur (la route le récupère, puis l'use case refait `bailleurRepo.trouver()`), mais n'est pas en mesure de détecter que le `bailleurId` fourni est invalide.

**Fix :**
```typescript
const bailleur = await bailleurRepo.trouver();
if (!bailleur) {
  return reply.redirect('/bailleur');
}
// Puis passer bailleur.id directement — pas de ?? ''
```

---

### CR-06 : Dépendance de l'infra vers le domaine fiscal concret dans exporter-pdf-recap

**Fichier :** `src/application/fiscalite/exporter-pdf-recap.ts:26`

**Issue :** L'use case `exporter-pdf-recap.ts` (couche application) importe directement `construireRecapFiscal` depuis `src/infrastructure/pdf/recap-fiscal-doc-def.ts`. La couche application dépend de la couche infrastructure — violation de la règle hexagonale du projet (DIP : les use cases ne doivent dépendre que d'abstractions/ports). Si l'implémentation PDF change (pdfmake → weasyprint, ou docx), l'use case doit être modifié.

```
src/application/fiscalite/exporter-pdf-recap.ts
  └─ import { construireRecapFiscal } from '../../infrastructure/pdf/recap-fiscal-doc-def.js'
```

**Fix :** Extraire un port `RecapFiscalBuilder` en domaine ou application et injecter l'implémentation :
```typescript
// Dans l'interface use case (application/) :
export interface RecapFiscalBuilder {
  construire(
    decl: DeclarationAnnuelle,
    bailleur: Bailleur,
    biens: Bien[],
    tableauxAmort: AmortissementExercice[],
  ): unknown; // TDocumentDefinitions ou opaque
}

// L'use case reçoit RecapFiscalBuilder injecté — l'infrastructure implémente.
```

---

## Avertissements

### WR-01 : Prorata temporis basé sur 365 jours fixes — erreur sur les années bissextiles

**Fichier :** `src/application/fiscalite/calculer-amortissement.ts:155`

**Issue :** Le calcul `dotation = montantHt × (jours / 365) ÷ dureeAns` divise toujours par 365, même pour une année bissextile (366 jours). Pour un composant actif toute l'année 2028 (366 jours), la dotation sera 366/365 de l'annuité — soit 0,27 % de trop. Pour un bien à 300 000 € en gros-oeuvre (40 ans), l'écart est environ 20 €/an. Ce n'est pas critique pour V1 mais constitue une inexactitude fiscale documentée.

**Fix :**
```typescript
// Calculer le nombre total de jours de l'exercice (365 ou 366)
const debutExercice = Temporal.PlainDate.from(`${exercice}-01-01`);
const finExercice = Temporal.PlainDate.from(`${exercice}-12-31`);
const joursExercice = BigInt(debutExercice.until(finExercice).days) + 1n;

// Remplacer 365n par joursExercice dans multiplyByFraction
dotationTheorique = c.montantHt
  .multiplyByFraction(jours, joursExercice)
  .multiplyByRatio(1n, BigInt(dureeAns));
```

---

### WR-02 : Règles fiscales hardcodées dans recalculerTableauAmortissement (RegleFiscale2026 concrète)

**Fichier :** `src/application/fiscalite/lister-vue-consolidee.ts:82` et `src/application/fiscalite/recalculer-tableau-amortissement.ts:43`

**Issue :** `ListerVueConsolideeDeps` reçoit `regleFiscale: RegleFiscale2026` — le type concret, pas `RegleFiscaleProvider`. Cela force l'appelant à passer `REGLES_2026` directement (ce que fait `multi-bien.ts:50`) et rend impossible l'utilisation de règles par exercice. Si l'exercice demandé est 2029 et que `REGLES_2029` a des seuils différents, `listerVueConsolidee` utilisera les mauvaises règles sans erreur.

**Fix :**
```typescript
// Remplacer dans ListerVueConsolideeDeps :
regleFiscale: RegleFiscaleProvider; // pas RegleFiscale2026

// Dans l'use case :
const regles = deps.regleFiscale.pour(exercice);
// passer regles (typé RegleFiscale2026) aux sous-appels
```

---

### WR-03 : Conversion euro→centime via `Math.round(euros * 100)` — risque d'arrondi flottant

**Fichier :** `src/web/routes/fiscalite/composants.ts:128-130`, `src/application/fiscalite/creer-declaration-corrigee.ts:92`, `src/application/fiscalite/saisir-revenus-foyer.ts:55`

**Issue :** Le pattern `BigInt(Math.round(euros * 100))` souffre de l'imprécision flottante : `149.99 * 100 = 14998.999999999998`, arrondi à 14999 (correct ici), mais `0.1 * 100 = 10.000000000000002`, arrondi à 10 (correct), mais `2.675 * 100 = 267.49999999999994`, arrondi à 267 au lieu de 268. Pour des montants fiscaux saisis en euros par l'utilisateur, l'erreur de centime est rare mais possible.

`saisir-revenus-foyer.ts:55` utilise `Money.fromEuros(commande.revenusActifsAnnuelsCourantEuros)` — si cette méthode utilise le même pattern, le problème est transféré. Les routes de composants et `creer-declaration-corrigee.ts` font la conversion directement.

**Fix :** Utiliser `parseFloat(euros.toFixed(2)) * 100` ou la méthode `Money.fromEuros()` si elle est sécurisée :
```typescript
// Conversion fiable sans flottant intermédiaire :
function eurosVersCentimes(euros: number): bigint {
  const str = euros.toFixed(2); // "149.99"
  const [intPart, decPart = '00'] = str.split('.');
  return BigInt(intPart!) * 100n + BigInt(decPart.padEnd(2, '0').slice(0, 2));
}
```

---

### WR-04 : Silent catch dans GET /biens/:bienId/fiscalite/amortissement — masque RegleFiscaleAbsente

**Fichier :** `src/web/routes/fiscalite/amortissement.ts:121-124`

**Issue :** Le bloc `catch {}` (vide) absorbe toutes les exceptions, y compris `RegleFiscaleAbsente` et les erreurs d'infrastructure. La variable `tableau` est alors `null` et la vue est rendue comme si le calcul retournait zéro. L'utilisateur ne voit aucun message d'erreur — il croit que ses amortissements sont à zéro.

**Fix :**
```typescript
try {
  tableau = await recalculerTableauAmortissement(/* ... */);
} catch (err) {
  req.log.error({ err }, 'Erreur recalcul amortissement');
  if (err instanceof RegleFiscaleAbsente) {
    return reply.code(400).send(`Règles fiscales indisponibles pour l'exercice ${exercice}.`);
  }
  tableau = null; // affichage dégradé avec message d'erreur dans la vue
  erreurMessage = err instanceof Error ? err.message : 'Erreur interne';
}
```

---

### WR-05 : Date LF 2025 incorrecte dans regles-2026.ts — 14 février vs 15 février

**Fichier :** `src/domain/fiscalite/regles/regles-2026.ts:115`

**Issue :** `LF_2025_DATE_EFFET_PV: Temporal.PlainDate.from('2025-02-15')` — la loi 2025-127 a été publiée au Journal Officiel du **14 février 2025** (date de promulgation). Utiliser le 15 exclurait silencieusement les cessions du 14 février 2025 de la réintégration des amortissements, produisant une plus-value sous-estimée pour les cas rares mais légaux.

Le commentaire indique lui-même `loi 2025-127 du 14/02/2025` mais la constante est fixée au 15.

**Fix :**
```typescript
LF_2025_DATE_EFFET_PV: Temporal.PlainDate.from('2025-02-14'),
```

---

### WR-06 : `collecterPrerequisCloture` ne vérifie pas la valorisation fiscale pour le régime réel déjà choisi (seulement si recettes > seuil micro)

**Fichier :** `src/application/fiscalite/collecter-prerequis-cloture.ts:101`

**Issue :** La vérification de la valorisation fiscale (`trouverParBien`) n'est déclenchée que si `recettes.superieurA(regles.SEUIL_MICRO_BIC_LONGUE_DUREE)`. Si le bailleur a choisi `regimeChoisi='reel'` (option sous le seuil — BOFIP-BIC-DECLA-10-30) et que ses recettes sont inférieures à 83 600 €, la vérification n'a pas lieu. Il pourrait clôturer en régime réel sans valorisation fiscale active, produisant une `DeclarationAnnuelle` avec `composantsSnapshot='[]'` qui violerait l'invariant `DeclarationAnnuelle.creer` (ligne 111-117) — mais seulement à la clôture, pas en amont dans le wizard.

**Fix :**
```typescript
// Remplacer :
if (recettes.superieurA(regles.SEUIL_MICRO_BIC_LONGUE_DUREE)) {
// Par :
const regimeEffectif = choisirRegime(recettes, regimeChoisi, regles);
if (regimeEffectif === 'reel' || recettes.superieurA(regles.SEUIL_MICRO_BIC_LONGUE_DUREE)) {
```
Note : `collecterPrerequisCloture` ne reçoit pas `regimeChoisi` dans sa signature actuelle — il faudrait l'ajouter.

---

### WR-07 : Race condition dans le dernier ArdCumuleBailleur — pas de verrou sur `exercice`

**Fichier :** `src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts:139-154`

**Issue :** `dernierArdCumuleBailleur(bailleurId, exercice - 1)` filtre `WHERE exercice = exerciceMax`. Si deux clôtures d'exercices différents sont lancées en parallèle (e.g., clôture 2026 et 2027 quasi-simultanément), la clôture 2027 peut lire l'ARD de 2026 avant que la clôture 2026 ait persisté sa `SYNTHESE_BIEN` — retournant `Money.zero()` (premier exercice) et perdant l'ARD cross-exercice. SQLite sérialise les écritures mais pas les lectures — le scénario est possible si deux requêtes HTTP arrivent en moins de quelques ms.

Pour V1 mono-utilisateur, la probabilité est faible mais non nulle (double-submit). La transaction dans `cloturerExercice` protège l'insertion, mais pas le `SELECT` ARD précédant la transaction.

**Fix :** Déplacer le lookup `ardCumuleEnEntree` à l'intérieur de la transaction Kysely :
```typescript
await db.transaction().execute(async (trx) => {
  const ardCumuleEnEntree = await repos.tableauAmortRepo.dernierArdCumuleBailleur(
    bailleurId, exercice - 1, trx,
  );
  // ... recalcul avec ardCumuleEnEntree ...
  await repos.declRepo.enregistrer(declaration, trx);
  await repos.tableauAmortRepo.enregistrerBatch(amortissementExercicesLignes, trx);
});
```

---

### WR-08 : `versDomaine` dans `TicketTravauxRepositorySqlite` appelle `TicketTravaux.creer()` avec `today` = `date_ouverture` — contourne la validation temporelle

**Fichier :** `src/infrastructure/repositories/ticket-travaux-repository-sqlite.ts:205-209`

**Issue :** `TicketTravaux.creer(props, row.date_ouverture ? Temporal.PlainDate.from(row.date_ouverture) : Temporal.PlainDate.from('1900-01-01'))` — le `today` passé est la `date_ouverture` du ticket lui-même. L'invariant `dateOuverture <= today` sera toujours vrai car `dateOuverture === today`. Pour les tickets clôturés avec une `dateCloture` < `dateOuverture` (données corrompues), aucune exception n'est levée lors de la reconstruction depuis SQLite. Cela masque la corruption silencieusement.

De plus, si `date_ouverture` est null (données historiques), le fallback `'1900-01-01'` passe l'invariant car toute date > 1900, mais produit un ticket avec une date d'ouverture fondamentalement incorrecte.

**Fix :** Ne pas passer `today` au moment de la reconstruction depuis DB — le domaine ne doit pas revalider les invariants temporels lors d'une reconstitution. Utiliser un constructeur séparé ou une factory de reconstitution (pattern `rehydrater`) sans validation temporelle.

---

### WR-09 : CSV injection partielle — les champs libres texte ne sont pas sanitisés

**Fichier :** `src/application/fiscalite/exporter-csv-fiscal.ts:67`

**Issue :** Le commentaire JSDoc mentionne que la protection contre l'injection CSV couvre les valeurs monétaires (via `Money.enEuros()` qui produit `"800,50 €"` — jamais de préfixe `=,@,+,-`). Cependant, la ligne `lignes.push(`Régime fiscal${SEP}${decl.regimeApplique}${SEP}`)` et `lignes.push(`Statut LMNP/LMP${SEP}${decl.statutLmnpLmp}${SEP}`)` insèrent des chaînes provenant d'enums contrôlés — pas de risque ici.

Mais si des futures colonnes incluent `decl.bailleurId` ou d'autres champs libres sans sanitisation, le risque sera introduit silencieusement. L'absence d'une fonction centralisée `sanitizeCsvCell()` laisse la protection dépendante de la vigilance individuelle.

**Fix :** Ajouter une helper de sanitisation CSV :
```typescript
function celleCsv(valeur: string): string {
  // Échappe les guillemets et préfixes dangereux
  if (/^[=+\-@\t\r]/.test(valeur)) {
    return `'${valeur.replace(/"/g, '""')}'`;
  }
  return valeur.replace(/"/g, '""');
}
```

---

### WR-10 : `new Date().toISOString()` dans les `versRow` des repositories — `Date()` interdit pour les dates fiscales

**Fichier :** `src/infrastructure/repositories/composant-repository-sqlite.ts:197`, `src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts:171`

**Issue :** `cree_le: new Date().toISOString()` utilise l'objet `Date` JavaScript natif, que le projet interdit explicitement pour les dates fiscales au profit de `@js-temporal/polyfill`. Pour `cree_le` — champ technique de traçage de l'insertion — l'impact fiscal est nul. Mais c'est une violation de la règle du projet qui peut induire des contributeurs à penser que `new Date()` est acceptable dans certains contextes.

**Fix :**
```typescript
import { Temporal } from '@js-temporal/polyfill';
cree_le: Temporal.Now.plainDateTimeISO().toString(),
```

---

## Info

### IN-01 : Duplication de la logique `deserializeCharges` entre deux repositories

**Fichier :** `src/infrastructure/repositories/declaration-annuelle-repository-sqlite.ts:153-171` et `src/infrastructure/repositories/declaration-corrigee-repository-sqlite.ts:132-148`

**Issue :** La méthode privée `deserializeCharges(json: string)` est dupliquée à l'identique dans `DeclarationAnnuelleRepositorySqlite` et `DeclarationCorrigeeRepositorySqlite`. Si une nouvelle catégorie de qualification est ajoutée (ex : `non_imputable`), il faudra mettre à jour les deux endroits.

**Fix :** Extraire dans un module partagé `src/infrastructure/repositories/charges-serializer.ts`.

---

### IN-02 : Label `attribut non negociable` dans la route GET /fiscalite/composants — `InvariantViolated` expose des détails internes à l'utilisateur

**Fichier :** `src/web/routes/fiscalite/composants.ts:264`

**Issue :** `erreurs: { _global: err.message }` passe le message brut de `InvariantViolated` directement au template EJS. Ces messages contiennent des références internes (`D-FIS-G5.2`, `D-FIS-G1.1`) lisibles par un utilisateur technique. Ce n'est pas un problème de sécurité pour une app mono-utilisateur locale, mais dégrade l'UX.

**Fix :** Mapper les `InvariantViolated` vers des messages utilisateur français sans référence interne.

---

### IN-03 : `LF_2025_DATE_EFFET_PV` dans regles-2026.ts n'est pas utilisé dans le code de Phase 5

**Fichier :** `src/domain/fiscalite/regles/regles-2026.ts:115`

**Issue :** La constante `LF_2025_DATE_EFFET_PV` est définie et documentée mais aucun use case de Phase 5 ne l'utilise pour filtrer les amortissements gros-oeuvre dans le calcul de plus-value. Le commentaire indique `(préparation SIM-02 V1.1)`, ce qui est correct, mais la constante est testée dans les specs comme si elle était fonctionnelle. C'est du code déclaratif sans consommateur — à clarifier en ADR ou en TODO tracé.

**Fix :** Ajouter un `// TODO SIM-02 V1.1 : utiliser LF_2025_DATE_EFFET_PV dans le calcul de plus-value` au point d'utilisation futur, et marquer la constante comme `@internal / reserved for SIM-02`.

---

_Reviewé : 2026-05-21_
_Reviewer : Claude (gsd-code-reviewer)_
_Profondeur : standard_
