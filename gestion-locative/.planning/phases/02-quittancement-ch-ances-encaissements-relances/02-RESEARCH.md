# Phase 2: Quittancement — Échéances, Encaissements, Relances - Research

**Researched:** 2026-05-14
**Domain:** Node.js ESM / TypeScript — pdfmake PDF generation, mailto URI, SQLite soft-delete, BigInt prorata, DDD singleton, Cucumber Clock injection
**Confidence:** HIGH (stack Phase 1 vérifiée in-codebase ; pdfmake API vérifiée via GitHub source ; RFC 6068 citée ; algorithmes vérifiés en runtime Node.js)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- DV-01 → DV-07 (PROJECT.md / Phase 1) : LMNP location meublée longue durée uniquement, local-first SQLite, DDD hexagonal strict (domaine pur), ubiquitous language français, BDD outside-in 100 % couverture fiscale, MVP vertical slices, 6 bounded contexts.
- D-01 → D-27 (Phase 1) : Web local SSR (Fastify + EJS), TypeScript strict, Node 22 LTS, better-sqlite3 + Kysely, Vitest, @cucumber/cucumber-js, fast-check, Money bigint centimes maison, Temporal API, Zod + fastify-type-provider-zod, pdfmake, Pico.css, ESLint + Prettier + dependency-cruiser, pnpm.
- D-44 → D-50 (Phase 1) : Standards UI/UX/A11y opposables (WCAG 2.1 AA, spacing 8 px, forms 1 colonne, destructive = confirmation).
- D-51 : `Bail.actif_depuis: PlainDate | null` ajouté par ALTER.
- D-52 : Génération auto `EcheanceLoyer` à l'activation, pour toute la durée du bail.
- D-53 : `Bail.jour_echeance: 1..28`.
- D-54 : `EcheanceLoyer` snapshot complet (pas de JOIN pour quittance).
- D-55 : Statut `EcheanceLoyer` = `en_attente | partiellement_payee | payee | annulee` ; "en retard" est un dérivé, non stocké.
- D-56 : Prorata 1ère/dernière échéance via `Money.multiplyByFraction`.
- D-57 : Cardinalité N:1 (`Encaissement.echeance_id`).
- D-58 : `mode: virement | cheque | especes | prelevement | autre`.
- D-59 : Sur-paiement accepté + warning visible, pas de report auto.
- D-60 : Soft-delete + compensateur — pas d'UPDATE/DELETE destructif.
- D-61 : Date encaissement permissive avec warnings.
- D-62 : Pas d'enum statut sur `Encaissement` V1.
- D-63 : Quittance = émission manuelle, PDF persisté local.
- D-64 : Numérotation `AAAA-NNN`, reset annuel, compteur en table `meta`.
- D-65 : Correction post-émission : `Quittance.annulee_le` + warning ; PDF originaux jamais écrasés.
- D-66 : Avis d'échéance = on-the-fly sans persistance.
- D-67 : `Bailleur` agrégat singleton (`{ id, nom_complet, adresse }`) — placement `domain/identite/` vs `_shared/` à trancher par le planner.
- D-68 : 3 niveaux relance : J+10 (amiable), J+30 (ferme), J+60 (mise en demeure).
- D-69 : Canal hybride — mailto niveaux 1-2, PDF imprimable niveau 3.
- D-70 : Templates relances = fichiers EJS dans `templates/relances/`.
- D-71 : Suggestion contextuelle + chaînage strict (impossible de sauter au niveau 3).
- D-72 : Activation rétroactive permissive ; warning si > 2 ans.
- D-73 : Modification bail actif = confirmation modale + régénération échéances futures non payées seulement.
- D-74 : Suppression bail avec activité refusée ; désactivation proposée.

### Claude's Discretion
- Convention exacte des routes Fastify.
- Structure des partials EJS Phase 2.
- Helpers de format (`formatPeriode`, `formatNumeroQuittance`).
- Découpage migrations SQLite.
- Encoding mailto UTF-8 / line breaks.
- Politique d'arrondi prorata (recommandation : banker's sur résultat final centimes).

### Deferred Ideas (OUT OF SCOPE)
- IRL active / révision auto, gel DPE → Phase 3.
- Coffre documentaire → Phase 4.
- Charges déductibles, micro-BIC, amortissement → Phase 5.
- Liasse 2031, CFE → Phase 6.
- Dashboard, notifications → Phase 7.
- Résiliation anticipée, indemnités post-résiliation, compensation sur dépôt de garantie → V2.
- Multi-bailleur, SCI → jamais.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENC-01 | Générer une `Quittance` PDF pour période entièrement payée | Topics 1, 7 : pdfmake layout + mentions légales loi 89 art. 21 |
| ENC-02 | Générer un avis d'échéance PDF | Topic 1 : pdfmake, route Fastify buffer download |
| ENC-03 | Saisir un `Encaissement` ; paiements partiels n'émettent pas de quittance | Topics 3, 4 : soft-delete + compensateur, Money.multiplyByFraction, invariant ENC-03 |
| ENC-04 | Calculer impayés et retards (par locataire, par période) | Topic 3 : agrégat actifs via Kysely WHERE annule_le IS NULL |
| ENC-05 | Déclencher `Relance`s escaladées avec templates email | Topics 2, 6 : mailto URI, Clock injection J+10/J+30/J+60, templates EJS |
</phase_requirements>

---

## Summary

La Phase 2 introduit le cycle complet de perception du loyer : génération d'échéances, saisie d'encaissements, quittancement PDF, calcul d'impayés, et relances escaladées. Le stack Phase 1 (Fastify ESM + Kysely + better-sqlite3 + pdfmake + Temporal) est conservé intégralement — aucun nouvel outil majeur n'est requis.

Cinq défis techniques nécessitent un guidage précis : (1) **pdfmake en ESM** — le package est CommonJS ; l'import depuis un projet `"type":"module"` nécessite `createRequire`. (2) **BigInt prorata** — l'algorithme banker's rounding sur BigInt est implémentable en pur TypeScript sans library tierce, avec des propriétés fast-check testables. (3) **Soft-delete + compensateur** — le calcul de la somme des `Encaissement` actifs doit être effectué en use case (pas en trigger DB) pour rester conforme à l'architecture hexagonale. (4) **Singleton Bailleur** — la combinaison d'une colonne `singleton_marker TEXT UNIQUE` (DB) et d'une vérification use case (domain) est la meilleure approche. (5) **Clock injection** — le port `Clock` n'existe pas en Phase 1 ; il doit être créé dans `domain/_shared/` et injecté via le Cucumber World.

**Recommandation principale :** Démarrer Phase 2 par un plan "walking skeleton" qui étend Bail (ALTER), crée le port `PdfRenderer`, le port `Clock`, et le World Cucumber Phase 2 — avant d'implémenter les quatre nouveaux agrégats en waves parallèles.

---

## Architectural Responsibility Map

| Capability | Tier primaire | Tier secondaire | Rationale |
|------------|--------------|----------------|-----------|
| Génération `EcheanceLoyer` à l'activation | Domain (use case `activerBail`) | Infrastructure (SQLite — insertions en batch) | Règles métier (prorata, snapshot complet) appartiennent au domaine |
| Calcul statut "en retard" | Domain (dérivé pur) | Web (calcul à la route GET) | Statut non stocké — `statut != 'payee' && jour_echeance_attendue < today` |
| Émission PDF quittance | Infrastructure (adapter `PdfRenderer`) | Domain (port `PdfRenderer`) | La génération PDF est technique ; le port garantit la pureté du domaine |
| Construction URI mailto | Web (helper pur `buildMailto`) | — | Pas de logique métier ; pur formatage de chaîne |
| Suggestion niveau relance | Domain (use case `calculerRelanceDisponible`) | Web (route GET injecte la suggestion) | Dépend de `Clock` et règles J+X — appartient au domaine |
| Compteur quittance annuel | Infrastructure (table `meta` SQLite) | Domain (port compteur) | Persistence pure ; le domaine valide l'invariant de séquentialité |
| Singleton Bailleur | Infrastructure (contrainte UNIQUE SQLite) + Domain (use case count avant insert) | — | Double barrière : DB contre race condition, use case pour l'invariant DDD |
| Soft-delete + compensateur | Domain (Money.negation, invariant somme) | Infrastructure (WHERE annule_le IS NULL) | Le calcul de solde appartient au domaine ; le filtre SQL est infrastructure |

---

## Standard Stack

### Core (inchangée Phase 1, vérifiée in-codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdfmake | 0.3.8 [VERIFIED: npm registry] | Génération PDF déclaratif | Décision D-19 Phase 1 — JSON doc definition, A4, Helvetica built-in, getBuffer() Promise |
| @types/pdfmake | 0.3.2 [VERIFIED: npm registry] | Types TypeScript pdfmake | Aligné sur pdfmake 0.3.x |
| kysely | 0.28.2 [VERIFIED: package.json] | Query builder type-safe SQLite | Phase 1 — aggregate SUM, WHERE IS NULL, groupBy |
| better-sqlite3 | 11.9.1 [VERIFIED: package.json] | Driver SQLite synchrone | Phase 1 — migrations brutes sqlite.exec() |
| fast-check | 4.8.0 [VERIFIED: npm registry] | Property-based testing | Phase 1 — `fc.bigInt()` pour prorata commutativité |
| @fast-check/vitest | 0.4.1 [VERIFIED: npm registry] | Intégration fast-check + Vitest | `test.prop([fc.bigInt(), ...])` pattern |
| @js-temporal/polyfill | 0.5.0 [VERIFIED: package.json] | Dates sans timezone | Phase 1 — Temporal.PlainDate roundtrip SQLite |

### Supporting (Phase 2)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:url (createRequire) | built-in Node 22 | Import pdfmake CJS depuis ESM | Dans `infrastructure/pdf/pdf-renderer-pdfmake.ts` uniquement |

### Alternatives Considérées

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdfmake (CJS via createRequire) | @bundled-es-modules/pdfmake | Paquet miroir non officiel — pas publié sur npm au 2026-05-14 [VERIFIED: npm registry retourne "not found"] |
| pdfmake | puppeteer | 200 Mo Chromium — écarté D-19 Phase 1 |
| Money.multiplyByFraction (maison) | decimal.js / big.js | Dependencies externes non nécessaires ; BigInt pur suffit pour l'algorithme banker's [VERIFIED: algorithme testé en Node.js runtime] |

**Installation Phase 2 :**
```bash
pnpm add @types/pdfmake
pnpm add @fast-check/vitest --save-dev
```
Note : `pdfmake` est déjà en dépendance Phase 1 (D-19), mais n'a jamais été utilisé (D-36 l'avait reporté). C'est la Phase 2 qui l'active.

---

## Findings

### Topic 1 — pdfmake : patterns idiomatiques TypeScript, polices, layout A4, route Fastify

**Source vérifiée :** GitHub source `bpampuch/pdfmake` (OutputDocument.js, OutputDocumentServer.js, base.js, standardfonts.js) [VERIFIED: GitHub API]

#### Import depuis un projet ESM (`"type":"module"`)

pdfmake 0.3.8 est un package CommonJS pur (package.json : `"type": undefined`, `"main": "js/index.js"`). Dans un projet Node.js ESM, l'import se fait via `createRequire` :

```typescript
// src/infrastructure/pdf/pdf-renderer-pdfmake.ts
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmake = require('pdfmake') as {
  addFonts: (fonts: Record<string, unknown>) => void;
  createPdf: (docDef: TDocumentDefinitions) => { getBuffer: () => Promise<Buffer> };
  setUrlAccessPolicy: (cb: (url: string) => boolean) => void;
  setLocalAccessPolicy: (cb: (path: string) => boolean) => void;
};
import type { TDocumentDefinitions, Style } from 'pdfmake/interfaces';
```

Le cast TypeScript est nécessaire car `@types/pdfmake` expose les types mais pas le module CommonJS directement.

#### Polices standard Helvetica (sans embedding)

Les polices Standard-14 (Helvetica, Times, Courier) sont intégrées dans tout reader PDF — elles **ne s'embarquent pas dans le fichier**. Limitation connue : **ANSI uniquement (pas d'accents français)**. Pour les accents (`é`, `è`, `ê`, `à`…), il faut soit (a) encoder les caractères, soit (b) utiliser une police TTF (Roboto par exemple). La recommandation pour ce projet est **Roboto** ou une police système qui supporte UTF-8.

```typescript
// Recommandé pour le français (accents)
const Roboto = {
  Roboto: {
    normal: Buffer.from(/* chemin TTF relatif à l'app dir */ ...),
    bold: Buffer.from(...)
  }
};
pdfmake.addFonts(Roboto);

// Si Helvetica suffit (documents courts en majuscule — RARE en LMNP)
pdfmake.addFonts({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
});
```

**Décision recommandée pour le planner :** Utiliser Roboto embedddé (TTF bundlé avec l'app dans `src/infrastructure/pdf/fonts/`). Évite le problème des accents français dans les PDFs légaux (adresses, noms, "Établi conformément à…").

Configurer les accès dans le code infra (requis par pdfmake 0.3 en mode serveur, sinon `console.warn`) :
```typescript
pdfmake.setUrlAccessPolicy(() => false);    // Pas d'accès URL externe
pdfmake.setLocalAccessPolicy(() => true);   // Accès local pour les polices
```

#### API `getBuffer()` — injection dans une route Fastify

`getBuffer()` retourne `Promise<Buffer>`. Le pattern pour une route Fastify :

```typescript
// src/infrastructure/pdf/pdf-renderer-pdfmake.ts
export class PdfRendererPdfmake implements PdfRenderer {
  async genererBuffer(docDef: TDocumentDefinitions): Promise<Buffer> {
    return pdfmake.createPdf(docDef).getBuffer();
  }
}

// src/web/routes/echeances.ts — route Fastify
fastify.get('/echeances/:id/avis-pdf', async (request, reply) => {
  const echeance = await echeanceLoyerRepo.trouverParId(id);
  const buffer = await pdfRenderer.genererBuffer(construireAvisEcheance(echeance, bailleur, locataire));
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `attachment; filename="avis-loyer-${periode}-bail-${idCourt}.pdf"`)
    .send(buffer);
});
```

#### Structure JSON A4 — Avis d'échéance (ENC-02, D-66)

```typescript
const docAvisEcheance: TDocumentDefinitions = {
  pageSize: 'A4',
  pageMargins: [56, 56, 56, 56], // 2 cm ≈ 56pt
  defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.4 },
  styles: {
    titreSection: { fontSize: 14, bold: true },
    sousTitre: { fontSize: 12 },
    labelBloc: { bold: true },
    totalLigne: { bold: true, fontSize: 12 },
  },
  content: [
    {
      columns: [
        { text: [{ text: "AVIS D'ÉCHÉANCE DE LOYER\n", style: 'titreSection' }, { text: `Période : ${periode}`, style: 'sousTitre' }] },
        { text: `Généré le ${dateGeneration}`, alignment: 'right', fontSize: 10 },
      ],
    },
    { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 483, y2: 4, lineWidth: 1 }], margin: [0, 8, 0, 8] },
    {
      columns: [
        { stack: [{ text: 'Bailleur', style: 'labelBloc' }, bailleur.nomComplet, bailleur.adresse.rue, `${bailleur.adresse.codePostal} ${bailleur.adresse.ville}`] },
        { stack: [{ text: 'Locataire', style: 'labelBloc' }, `${locataire.prenom} ${locataire.nom}`, adresseBien.rue, `${adresseBien.codePostal} ${adresseBien.ville}`] },
      ],
    },
    { margin: [0, 16, 0, 0],
      table: {
        widths: ['*', 'auto'],
        body: [
          [{ text: 'Désignation', bold: true, fillColor: '#f3f4f6' }, { text: 'Montant', bold: true, fillColor: '#f3f4f6', alignment: 'right' }],
          ['Loyer hors charges', { text: echeance.loyerHc.enEuros(), alignment: 'right' }],
          [`Charges (${echeance.modeCharges})`, { text: echeance.montantCharges.enEuros(), alignment: 'right' }],
          [{ text: 'Total à régler', bold: true }, { text: echeance.total.enEuros(), alignment: 'right', bold: true, fontSize: 12 }],
        ],
      },
      layout: 'lightHorizontalLines',
    },
    { text: `À régler avant le ${echeance.jourEcheanceAttendue}.`, margin: [0, 16, 0, 0] },
    { text: 'Document non opposable — à titre indicatif.', italics: true, fontSize: 9, margin: [0, 8, 0, 0] },
  ],
};
```

#### Structure JSON A4 — Quittance de loyer (ENC-01, D-63)

Mentions légales obligatoires loi 89 art. 21 — toutes présentes :

```typescript
const docQuittance: TDocumentDefinitions = {
  pageSize: 'A4',
  pageMargins: [56, 56, 56, 56],
  defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.4 },
  footer: (currentPage, pageCount) => ({
    text: `Document établi conformément à l'article 21 de la loi n° 89-462 du 6 juillet 1989. Quittance n° ${quittance.numero} — non cessible — à conserver. Page ${currentPage}/${pageCount}.`,
    fontSize: 8, margin: [56, 0, 56, 0], alignment: 'center',
  }),
  content: [
    { text: `QUITTANCE DE LOYER N° ${quittance.numero}`, style: 'titre', alignment: 'center' },
    { text: `du ${formatDateFr(echeance.periodeDebut)} au ${formatDateFr(echeance.periodeFin)}`, alignment: 'center', margin: [0, 4, 0, 16] },
    {
      columns: [
        { stack: [{ text: 'Le bailleur', bold: true }, bailleur.nomComplet, bailleur.adresse.rue, `${bailleur.adresse.codePostal} ${bailleur.adresse.ville}`] },
        { stack: [{ text: 'Au locataire', bold: true }, `${locataire.prenom} ${locataire.nom}`, adresseBien.rue, `${adresseBien.codePostal} ${adresseBien.ville}`] },
      ],
    },
    { margin: [0, 16, 0, 0],
      table: {
        widths: ['*', 'auto'],
        body: [
          [{ text: 'Désignation', bold: true, fillColor: '#f3f4f6' }, { text: 'Montant', bold: true, fillColor: '#f3f4f6', alignment: 'right' }],
          ['Loyer principal hors charges', { text: echeance.loyerHc.enEuros(), alignment: 'right' }],
          [`Charges locatives (${echeance.modeCharges})`, { text: echeance.montantCharges.enEuros(), alignment: 'right' }],
          [{ text: 'Total encaissé', bold: true }, { text: echeance.total.enEuros(), alignment: 'right', bold: true }],
        ],
      },
      layout: 'lightHorizontalLines',
    },
    {
      text: `Le bailleur déclare avoir reçu de ${locataire.prenom} ${locataire.nom} la somme de ${echeance.total.enEuros()} au titre du loyer et des charges pour la période du ${formatDateFr(echeance.periodeDebut)} au ${formatDateFr(echeance.periodeFin)}. Tous comptes apurés.`,
      italics: true, margin: [0, 16, 0, 16],
    },
    { columns: [
        { text: `Fait le ${formatDateFr(quittance.emiseLE)}, à ${bailleur.adresse.ville}` },
        { text: 'Signature du bailleur :', margin: [0, 0, 0, 40] },
    ]},
  ],
  styles: { titre: { fontSize: 16, bold: true } },
};
```

---

### Topic 7 — Mise en demeure PDF : canevas exact (D-68/D-69 niveau 3)

**Sources légales :** Code civil art. 1344 (mise en demeure par courrier avec accusé de réception) [CITED: legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041541] ; pratique pré-judiciaire française.

Mentions obligatoires dans la mise en demeure de payer un loyer :
1. Identité et coordonnées complètes du bailleur (expéditeur)
2. Identité et adresse du locataire (destinataire)
3. Référence précise du bail (date de signature, adresse du bien, montant mensuel)
4. Détail de la créance (période(s) impayée(s), montant par période, total)
5. Délai accordé pour régularisation (pratique : 8 jours à compter de réception)
6. Conséquences possibles (voies de droit — sans menace abusive, sans référence au commandement de payer qui est hors-scope)
7. Lieu et date d'émission + signature

```typescript
const docMiseEnDemeure: TDocumentDefinitions = {
  pageSize: 'A4',
  pageMargins: [56, 56, 56, 72],
  defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.5 },
  footer: (currentPage, pageCount) => ({
    text: `Ce courrier doit être envoyé en lettre recommandée avec accusé de réception (AR). Page ${currentPage}/${pageCount}.`,
    fontSize: 8, margin: [56, 0, 56, 0], alignment: 'center', italics: true,
  }),
  content: [
    // Bloc bailleur (expéditeur — en haut à gauche)
    { stack: [
        { text: bailleur.nomComplet, bold: true },
        bailleur.adresse.rue,
        `${bailleur.adresse.codePostal} ${bailleur.adresse.ville}`,
      ], margin: [0, 0, 0, 16],
    },
    // Bloc locataire (destinataire — à droite)
    { columns: [
        { text: '' },
        { stack: [
            { text: `${locataire.prenom} ${locataire.nom}`, bold: true },
            adresseBien.rue,
            `${adresseBien.codePostal} ${adresseBien.ville}`,
          ],
        },
      ], margin: [0, 0, 0, 32],
    },
    // Titre centré
    { text: 'MISE EN DEMEURE DE PAYER', fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 24] },
    // Référence bail
    { text: `Bail meublé du ${formatDateFr(bail.dateDebut)} — Bien : ${adresseBien.rue}, ${adresseBien.codePostal} ${adresseBien.ville}`, margin: [0, 0, 0, 4] },
    { text: `Durée : ${bail.dureeMois} mois — Loyer mensuel : ${bail.loyerHc.enEuros()} HC + ${bail.montantCharges.enEuros()} charges.`, margin: [0, 0, 0, 16] },
    // Corps juridique
    { text: `Par la présente, je vous mets en demeure de régler, dans un délai de 8 (huit) jours à compter de la réception de ce courrier, la somme de ${montantTotalDu.enEuros()} correspondant au loyer impayé de la période ${periodeImpayee}.`, margin: [0, 0, 0, 12] },
    { text: `À défaut de règlement dans ce délai, je me verrai contraint(e) d'engager toutes les voies de droit nécessaires au recouvrement de cette créance.`, margin: [0, 0, 0, 16] },
    // Tableau détail impayé
    { table: {
        widths: ['*', 'auto'],
        body: [
          [{ text: 'Période', bold: true, fillColor: '#f3f4f6' }, { text: 'Montant dû', bold: true, fillColor: '#f3f4f6', alignment: 'right' }],
          ...lignesImpayees.map(l => [l.periode, { text: l.montant.enEuros(), alignment: 'right' }]),
          [{ text: 'Total', bold: true }, { text: montantTotalDu.enEuros(), alignment: 'right', bold: true }],
        ],
      }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 24],
    },
    // Clôture
    { text: `Fait le ${formatDateFr(today)}, à ${bailleur.adresse.ville}.`, margin: [0, 0, 0, 40] },
    { text: 'Signature :', margin: [0, 0, 0, 40] },
  ],
};
```

---

### Topic 2 — Génération mailto: en Node.js

**Source :** RFC 6068 §6 [CITED: https://www.rfc-editor.org/rfc/rfc6068] ; comportement documenté cross-plateforme [CITED: https://geeklog.adamwilson.info/article/96/There-is-a-maximum-length-on-mailto-links-on-windows]

#### Règles d'encodage

- Tous les caractères non-ASCII (accents français) : encoder en UTF-8 d'abord, puis percent-encode chaque octet → `encodeURIComponent` le fait nativement en JS.
- Espaces : `%20` (pas `+` dans les URIs).
- Sauts de ligne dans le corps (`body`) : **`%0D%0A`** (CRLF) — les clients mail Windows (Outlook) ignorent `%0A` seul et le traitent comme un espace.
- L'encodage `encodeURIComponent` gère automatiquement les accents mais PAS les CRLF — remplacer `\n` par `%0D%0A` **après** l'encodage du reste.

#### Signature TypeScript recommandée

```typescript
// src/helpers/build-mailto.ts
export interface MailtoParams {
  to: string;
  subject: string;
  body: string;
  cc?: string;
}

/**
 * Construit un URI mailto: conforme RFC 6068.
 * - Accents encodés en percent-encoding UTF-8 (encodeURIComponent natif).
 * - Sauts de ligne → %0D%0A (CRLF, compatible Windows Outlook).
 * - Corps tronqué à 1900 caractères encodés si dépassement (limite pratique ~2000 chars total).
 */
export function buildMailto(params: MailtoParams): string {
  const encoderCorps = (body: string): string =>
    encodeURIComponent(body).replaceAll('%0A', '%0D%0A');

  const subject = encodeURIComponent(params.subject);
  const cc = params.cc ? `&cc=${encodeURIComponent(params.cc)}` : '';

  let bodyEncode = encoderCorps(params.body);
  // Limite conservatrice 1900 chars encodés pour le corps
  // (URI totale ~ to + subject + 'mailto:?subject=&body=' ≈ 100 chars overhead)
  const LIMITE_CORPS = 1900;
  if (bodyEncode.length > LIMITE_CORPS) {
    const mention = encoderCorps('\n\n[Message tronqué — voir courrier joint si nécessaire]');
    bodyEncode = bodyEncode.substring(0, LIMITE_CORPS - mention.length) + mention;
  }

  return `mailto:${params.to}?subject=${subject}${cc}&body=${bodyEncode}`;
}
```

#### Limites de longueur par plateforme

| Plateforme | Limite pratique URI mailto |
|-----------|---------------------------|
| Windows Outlook + Chrome/Firefox/Edge | ~2046 chars [CITED: geeklog.adamwilson.info] |
| Windows Mail | ~2046 chars |
| Apple Mail + Safari | ~2083 chars (limite URL IE10) |
| Thunderbird (tous OS) | ~variable, généralement > 4000 |

**Recommandation :** Limiter à 2000 chars totaux (to + subject + cc + body encodés). Tronquer le body avec mention explicite si dépassé.

---

### Topic 3 — Soft-delete + compensateur en Kysely

**Source :** Architecture DDD hexagonale — CONTEXT.md D-60 ; Kysely API [CITED: https://kysely-org.github.io/kysely-apidoc]

#### Principe

- `Encaissement.annule_le: TEXT | null` — null = actif, valeur ISO = annulé.
- Correction d'un montant erroné : Encaissement compensateur avec `montant` négatif (Money.negation — à ajouter sur `Money`).
- **Pas de trigger DB** (contraire à DDD hexagonal — la logique métier reste dans le domaine).
- **Pas de view SQL** (contraire à l'architecture : les views créent une dépendance infra implicite difficile à tester).
- **Pattern recommandé : calcul dans le use case / repository** via query agrégée Kysely.

#### Query Kysely — somme des encaissements actifs par échéance

```typescript
// Dans EncaissementRepositorySqlite
async sommePaieeParEcheance(echeanceId: EcheanceLoyerId): Promise<Money> {
  const result = await this.db
    .selectFrom('encaissement')
    .select((eb) => [
      eb.fn.sum('montant_centimes').as('total'),
    ])
    .where('echeance_id', '=', echeanceId)
    .where('annule_le', 'is', null)          // Exclut les annulés
    .executeTakeFirst();

  const total = result?.total ?? 0;
  return Money.fromCentimes(BigInt(total as number));
}

// Recalcul du statut après chaque création/annulation d'Encaissement
// (dans le use case — pas dans l'agrégat EcheanceLoyer directement)
async recalculerStatutEcheance(echeanceId: EcheanceLoyerId): Promise<void> {
  const echeance = await this.echeanceLoyerRepo.trouverParId(echeanceId);
  const sommePaiee = await this.encaissementRepo.sommePaieeParEcheance(echeanceId);
  
  let nouveauStatut: StatutEcheance;
  if (sommePaiee.egale(Money.zero())) {
    nouveauStatut = 'en_attente';
  } else if (sommePaiee.lte(echeance.total)) {
    nouveauStatut = sommePaiee.egale(echeance.total) ? 'payee' : 'partiellement_payee';
  } else {
    nouveauStatut = 'payee'; // Sur-paiement → payee + warning (D-59)
  }
  
  await this.echeanceLoyerRepo.mettreAJourStatut(echeanceId, nouveauStatut);
}
```

**Money.negation** — à ajouter sur `Money` pour les encaissements compensateurs :

```typescript
// Extension Money — centimes négatifs pour les compensateurs uniquement
static fromCentimesSignes(n: bigint): Money {
  // Permettre les négatifs uniquement pour les compensateurs
  return new Money(n); // constructeur privé → factory spéciale
}

negation(): Money {
  return Money.fromCentimesSignes(-this.centimes);
}
```

**Important :** Le type `Money` Phase 1 refuse les négatifs dans `fromCentimes`. L'approche compensateur nécessite une décision du planner : soit (a) un type `MoneySigné` distinct pour les compensateurs, soit (b) stocker le montant en valeur absolue + un flag `type: 'credit' | 'debit'`, soit (c) accepter les centimes négatifs dans un factory `Money.compensateur(positif: Money)`. La recommandation est l'option (c) — factory dédiée avec nom explicite qui documente l'intention.

---

### Topic 4 — BigInt fractions / prorata Money

**Source :** Algorithme validé en runtime Node.js [VERIFIED: exécution locale] ; fast-check API [CITED: https://fast-check.dev/]

#### Algorithme banker's rounding sur BigInt pur

```typescript
// Extension de money.ts — src/domain/_shared/money.ts
/**
 * Multiplie ce montant par une fraction (num/den) avec arrondi banker's (round-half-to-even).
 * Usage : prorata 1ère/dernière échéance.
 * Ex : 85050 centimes * 15 / 31 = 41153 centimes
 *
 * Banker's rounding : quand le reste est exactement la moitié,
 * arrondit vers le chiffre pair le plus proche (évite le biais systématique).
 */
multiplyByFraction(num: bigint, den: bigint, mode: 'banker' | 'floor' | 'ceil' = 'banker'): Money {
  if (den <= 0n) throw new InvariantViolated('Le dénominateur du prorata doit être positif');
  if (num < 0n || num > den) throw new InvariantViolated('La fraction de prorata doit être entre 0 et 1');

  const produit = this.centimes * num;
  const quotient = produit / den;
  const reste = produit % den;

  if (mode === 'floor') return Money.fromCentimes(quotient);
  if (mode === 'ceil') return Money.fromCentimes(reste > 0n ? quotient + 1n : quotient);

  // Banker's rounding
  const deuxFois = reste * 2n;
  if (deuxFois === den) {
    // Exactement la moitié → arrondit vers le chiffre pair
    return Money.fromCentimes(quotient % 2n === 0n ? quotient : quotient + 1n);
  }
  return Money.fromCentimes(deuxFois > den ? quotient + 1n : quotient);
}
```

#### Calcul du prorata première échéance

```typescript
// Dans le use case activerBail — génération EcheanceLoyer
function calculerProrataPremiereEcheance(
  loyerHc: Money,
  montantCharges: Money,
  dateDebut: Temporal.PlainDate,
  jourEcheance: number,
): { loyerHc: Money; montantCharges: Money; periodeDebut: Temporal.PlainDate; periodeFin: Temporal.PlainDate } {
  const joursInMois = BigInt(dateDebut.daysInMonth);
  const jourDebutOccupation = BigInt(dateDebut.day);
  const joursOccupes = joursInMois - jourDebutOccupation + 1n;

  return {
    loyerHc: loyerHc.multiplyByFraction(joursOccupes, joursInMois),
    montantCharges: montantCharges.multiplyByFraction(joursOccupes, joursInMois),
    periodeDebut: dateDebut,
    periodeFin: dateDebut.with({ day: dateDebut.daysInMonth }),
  };
}
```

**Cas février** : `Temporal.PlainDate.daysInMonth` gère automatiquement les années bissextiles (28 ou 29 jours). `jourEcheance` étant plafonné à 28 (D-53), il n'y a jamais de jour invalide.

#### Tests fast-check obligatoires

```typescript
// tests/unit/_shared/money.test.ts — à ajouter
import fc from 'fast-check';

describe('Money.multiplyByFraction — propriétés', () => {
  test('prorata d\'un mois entier = montant total', () => {
    fc.assert(fc.property(
      fc.bigInt({ min: 1n, max: 1_000_000_000n }), // centimes loyer
      fc.integer({ min: 28, max: 31 }),             // jours dans le mois
      (centimes, jours) => {
        const m = Money.fromCentimes(centimes);
        const prorata = m.multiplyByFraction(BigInt(jours), BigInt(jours));
        return prorata.egale(m);
      }
    ));
  });

  test('somme prorata(j jours) + prorata(N-j jours) ≤ total + 1 centime (erreur d\'arrondi max)', () => {
    fc.assert(fc.property(
      fc.bigInt({ min: 1n, max: 1_000_000_000n }),
      fc.integer({ min: 28, max: 31 }),
      fc.integer({ min: 1, max: 27 }),
      (centimes, jours, split) => {
        const m = Money.fromCentimes(centimes);
        const N = BigInt(jours);
        const j = BigInt(split);
        const p1 = m.multiplyByFraction(j, N);
        const p2 = m.multiplyByFraction(N - j, N);
        const somme = p1.additionner(p2).toCentimes();
        // Banker's rounding peut perdre au max 1 centime
        return somme >= centimes - 1n && somme <= centimes + 1n;
      }
    ));
  });
});
```

---

### Topic 5 — Singleton Bailleur

**Source :** SQLite CREATE TABLE docs [CITED: https://www.sqlite.org/lang_createtable.html] ; DDD hexagonal patterns [CITED: DDD.md projet]

#### Comparaison des 3 approches

| Approche | DB enforcement | Use case | Recommandation |
|----------|---------------|---------|----------------|
| `CHECK (id = 'BAILLEUR_UNIQUE')` | Oui — SQLite rejette id ≠ fixe | Compte avant insert | Fonctionne, mais id non-UUID — rompt le pattern brand types |
| `singleton_marker TEXT UNIQUE DEFAULT 'unique_bailleur'` | Oui — UNIQUE sur valeur constante | Peut omettre le count (DB rejette) | **Recommandé** — id reste UUID, contrainte lisible |
| Use case count avant insert seulement | Non (pas de guard DB) | Count + InvariantViolated | Insuffisant en théorie (race condition), mais mono-process SQLite évite le problème |

**Recommandation planner :** Double barrière légère.

```sql
-- Migration 0002 — dans 0002_phase2_init.sql
CREATE TABLE IF NOT EXISTS bailleur (
  id               TEXT PRIMARY KEY,
  singleton_marker TEXT NOT NULL DEFAULT 'unique_bailleur',
  nom_complet      TEXT NOT NULL,
  rue              TEXT NOT NULL,
  code_postal      TEXT NOT NULL,
  ville            TEXT NOT NULL,
  cree_le          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (singleton_marker)
);
```

```typescript
// Use case creerOuMettreAJourBailleur
async function creerOuMettreAJourBailleur(
  bailleurRepo: BailleurRepository,
  props: BailleurProps,
): Promise<Bailleur> {
  const existant = await bailleurRepo.trouver();
  if (existant) {
    return bailleurRepo.mettreAJour(existant.id, props);
  }
  const bailleur = Bailleur.creer(props);
  await bailleurRepo.enregistrer(bailleur);
  return bailleur;
}
```

**Argument DDD :** L'invariant "1 seul bailleur" est un règle du domaine (mono-user V1) — il doit être exprimé dans le use case. La contrainte UNIQUE SQLite est la filet de sécurité infra qui garantit la cohérence même si le use case est contourné (test direct DB, migration data, etc.).

**Mono-process SQLite** : better-sqlite3 est synchrone et mono-connexion. Il n'y a aucune race condition possible — le count use case suffit en pratique. La contrainte DB reste défensable pour l'audit.

---

### Topic 6 — Cucumber Clock injection

**Source :** Codebase Phase 1 inspectée [VERIFIED: grep src/ tests/] ; BDD_PRACTICES.md projet.

#### État Phase 1

Le port `Clock` **n'existe pas** dans la codebase Phase 1. Aucun `Clock`, `aujourdhui`, ni abstraction de date dans `src/domain/`. Les routes utilisent `new Date().toISOString()` directement dans les repositories (ex: `bail-repository-sqlite.ts` line 54 : `modifie_le: new Date().toISOString()`).

Phase 2 doit introduire le port `Clock` dans `domain/_shared/` — indispensable pour les seuils J+10/J+30/J+60 (D-71).

#### Interface Clock recommandée

```typescript
// src/domain/_shared/clock.ts
import { Temporal } from '@js-temporal/polyfill';

/**
 * Port Clock — abstraction de la date courante.
 * Indispensable pour les seuils de relance (J+10, J+30, J+60 — D-68/D-71).
 * L'implémentation réelle lit Temporal.Now.plainDateISO().
 * L'implémentation de test (ClockFixe) prend une date fixe — déterminisme BDD.
 */
export interface Clock {
  aujourdhui(): Temporal.PlainDate;
}

/** Implémentation de production — lit la date système. */
export class ClockSysteme implements Clock {
  aujourdhui(): Temporal.PlainDate {
    return Temporal.Now.plainDateISO();
  }
}

/** Implémentation de test — date fixe pour le déterminisme BDD/unit. */
export class ClockFixe implements Clock {
  constructor(private readonly date: Temporal.PlainDate) {}

  aujourdhui(): Temporal.PlainDate {
    return this.date;
  }

  /** Factory raccourcie pour les tests. */
  static du(isoDate: string): ClockFixe {
    return new ClockFixe(Temporal.PlainDate.from(isoDate));
  }
}
```

#### Cucumber World Phase 2

```typescript
// tests/_world/monde-phase2.ts
import { World } from '@cucumber/cucumber';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { creerApp } from '../../src/main.js';
import { ClockFixe } from '../../src/domain/_shared/clock.js';
import type { DB } from '../../src/infrastructure/db/kysely-types.js';

export interface MondePhase2 extends World {
  app: Awaited<ReturnType<typeof creerApp>> | null;
  db: Kysely<DB> | null;
  clock: ClockFixe;
  dernierStatut: number;
  derniereUrl: string;
  dernierCorps: string;
  cookies: Record<string, string>;
}

// Dans le Before hook du feature :
Before(async function (this: MondePhase2) {
  process.env['SESSION_SECRET'] = 'test-secret-for-cucumber-tests-32chars!!';
  const sqlite = new Database(':memory:');
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  // Date fixe par défaut — les steps peuvent la surcharger
  this.clock = ClockFixe.du('2026-05-01');
  this.app = await creerApp(this.db, { clock: this.clock });
  // ...
});
```

Le `Clock` est injecté dans `creerApp()` — la factory Fastify reçoit une `ConnexionDb` + options (dont `clock`). Cela propage le clock vers tous les use cases via l'injection de dépendances (pas de singleton global).

**Step Cucumber pour surcharger la date :**

```gherkin
Given la date système est "2026-06-15"
```

```typescript
Given('la date système est {string}', function (this: MondePhase2, isoDate: string) {
  this.clock = ClockFixe.du(isoDate);
  // Réinjecter dans l'app si déjà initialisée
});
```

---

## Architecture Patterns

### System Architecture Diagram

```
[Navigateur utilisateur]
       │ GET/POST HTTP (Fastify SSR)
       ▼
[Web Layer — Fastify routes]
       │ Valide (Zod) ── Injecte (Clock, PdfRenderer ports)
       ▼
[Application Layer — Use Cases]
  activerBail()        creerEncaissement()
  genererQuittance()   calculerRelanceDisponible()
  creerOuMAJBailleur() annulerEncaissement()
       │ Appelle
       ▼
[Domain Layer — Agrégats purs]
  Bail             EcheanceLoyer      Encaissement
  Quittance        Relance            Bailleur
  Money            PlainDate          Clock (port)
                                      PdfRenderer (port)
       │ Via ports (repositories)
       ▼
[Infrastructure Layer]
  SQLite (Kysely)       PdfMake adapter
  BailRepositorySqlite  PdfRendererPdfmake
  EcheanceLoyerRepo     buildMailto() helper
  EncaissementRepo      formatPeriode() helper
  QuittanceRepo         ClockSysteme
  RelanceRepo
  BailleurRepo
  Compteur quittance (table meta)
  Stockage fichiers PDF (~/Library/.../quittances/)
```

### Recommended Project Structure

```
src/
├── domain/
│   ├── _shared/
│   │   ├── money.ts         # Extension : multiplyByFraction, negation (compensateur)
│   │   ├── clock.ts         # NOUVEAU : port Clock + ClockSysteme + ClockFixe
│   │   ├── identifiants.ts  # Extension : EcheanceLoyerId, EncaissementId, QuittanceId, RelanceId, BailleurId
│   │   ├── adresse.ts       # Réutilisé tel quel (Bailleur.adresse)
│   │   └── erreurs.ts       # Réutilisé + nouveaux: EcheanceIntrouvable, BailleurAbsent, etc.
│   ├── encaissements/       # NOUVEAU bounded context
│   │   ├── echeance-loyer.ts
│   │   ├── echeance-loyer-repository.ts
│   │   ├── encaissement.ts
│   │   ├── encaissement-repository.ts
│   │   ├── quittance.ts
│   │   ├── quittance-repository.ts
│   │   ├── relance.ts
│   │   ├── relance-repository.ts
│   │   ├── pdf-renderer.ts  # Port PdfRenderer (domain)
│   │   └── erreurs.ts
│   ├── identite/            # NOUVEAU bounded context (recommandé vs _shared — D-67 DP-07)
│   │   ├── bailleur.ts
│   │   ├── bailleur-repository.ts
│   │   └── erreurs.ts
│   └── locatif/
│       └── bail.ts          # Extension : actif_depuis, jour_echeance, activer()
├── application/
│   ├── encaissements/
│   │   ├── activer-bail.ts
│   │   ├── creer-encaissement.ts
│   │   ├── annuler-encaissement.ts
│   │   ├── generer-quittance.ts
│   │   ├── annuler-quittance.ts
│   │   ├── calculer-relance-disponible.ts
│   │   └── enregistrer-relance.ts
│   └── identite/
│       └── creer-ou-maj-bailleur.ts
├── infrastructure/
│   ├── pdf/
│   │   ├── pdf-renderer-pdfmake.ts  # Adapter pdfmake (createRequire CJS)
│   │   └── fonts/                   # Roboto TTF (encodé ou chargé depuis node_modules)
│   ├── storage/
│   │   └── stockage-fichier-local.ts  # Persistance PDF quittances ~/Library/...
│   └── repositories/
│       ├── echeance-loyer-repository-sqlite.ts
│       ├── encaissement-repository-sqlite.ts
│       ├── quittance-repository-sqlite.ts
│       ├── relance-repository-sqlite.ts
│       └── bailleur-repository-sqlite.ts
├── helpers/
│   ├── format-date.ts       # Réutilisé
│   ├── format-money.ts      # Réutilisé
│   ├── format-periode.ts    # NOUVEAU : PlainDate → "mai 2026"
│   ├── format-numero-quittance.ts  # NOUVEAU : (annee, n) → "2026-042"
│   └── build-mailto.ts      # NOUVEAU : buildMailto(params) → string
└── web/
    ├── routes/
    │   ├── baux.ts          # Extension : POST /baux/:id/activer, GET /baux/:id/echeances
    │   ├── echeances.ts     # NOUVEAU
    │   ├── encaissements.ts # NOUVEAU
    │   ├── quittances.ts    # NOUVEAU
    │   ├── impayes.ts       # NOUVEAU (lecture seule)
    │   ├── relances.ts      # NOUVEAU
    │   └── bailleur.ts      # NOUVEAU
    └── views/pages/
        ├── baux/activer.ejs
        ├── echeances/liste.ejs, fiche.ejs
        ├── encaissements/liste.ejs, formulaire.ejs, fiche.ejs
        ├── quittances/liste.ejs, fiche.ejs
        ├── impayes/liste.ejs
        ├── relances/liste.ejs
        └── bailleur/profil.ejs

templates/
└── relances/                # HORS src/ — contenus textuels EJS
    ├── 01-amiable.ejs
    ├── 02-ferme.ejs
    └── 03-mise-en-demeure.ejs

tests/
├── _builders/
│   └── encaissements.ts     # NOUVEAU : unEcheanceLoyerValide, unEncaissementValide, etc.
├── _world/
│   └── monde-phase2.ts      # NOUVEAU : World avec ClockFixe
├── bdd/features/
│   ├── quittancement.feature
│   ├── relances.feature
│   └── bailleur.feature
├── unit/
│   ├── _shared/money.test.ts     # Extension : multiplyByFraction fast-check
│   ├── encaissements/            # NOUVEAU
│   └── identite/                 # NOUVEAU
└── integration/
    └── repositories/             # NOUVEAU : EcheanceLoyer, Encaissement, Quittance, Relance, Bailleur
```

### Pattern — Extension Bail avec activer()

```typescript
// Méthode à ajouter sur l'agrégat Bail (copy-on-write Phase 1 pattern)
activer(actifDepuis: Temporal.PlainDate, jourEcheance: number): Bail {
  if (jourEcheance < 1 || jourEcheance > 28) {
    throw new InvariantViolated('Le jour d\'échéance doit être entre 1 et 28 (D-53)');
  }
  return Bail.creer({ ...this.toProps(), actifDepuis, jourEcheance });
}
```

### Anti-Patterns à Éviter

- **Ne pas mettre la logique de calcul du statut dans un trigger SQLite** : contraire à l'architecture hexagonale — le statut recalculé en use case.
- **Ne pas utiliser `Temporal.Now.plainDateISO()` directement dans les use cases** : passer par le port `Clock` pour le déterminisme des tests.
- **Ne pas appeler `createPdf().getBuffer()` depuis le domaine** : le port `PdfRenderer` est dans le domaine, l'adapter pdfmake est en infrastructure.
- **Ne pas concaténer le body mailto sans encodeURIComponent** : les accents français corrompent l'URI et certains clients mail planteront silencieusement.
- **Ne pas utiliser `ZodEffects.omit()`** : si un schéma Zod de formulaire d'encaissement a un `.superRefine()`, recréer le sous-schéma dérivé (Phase 1 LEARNING).

---

## Don't Hand-Roll

| Problème | Ne pas construire | Utiliser | Raison |
|---------|-----------------|---------|--------|
| Pagination / layout PDF | Layout engine maison | pdfmake document definition JSON | Gestion page break, headers/footers, tables multi-colonnes — beaucoup d'edge cases |
| Encodage mailto | Concaténation string manuelle | `encodeURIComponent` + remplacement `%0A→%0D%0A` | RFC 6068 compliance, accents UTF-8, portabilité cross-OS |
| Arrondi financier sur fraction | `Math.round(loyer * jours / total)` | `Money.multiplyByFraction(BigInt, BigInt, 'banker')` | Drifts flottants, biais systématique (ne jamais passer par `number` pour l'arrondi) |
| Numérotation séquentielle | Compteur en mémoire | Table `meta` SQLite (`compteur_quittance_2026`) | Persistence entre redémarrages, audit |
| Validation date encaissement | Regex string | `Temporal.PlainDate.from()` + comparaison Temporal | Gestion correcte des mois courts, bisextiles, comparaisons calendaires |
| Import pdfmake en ESM | Réécrire en ESM | `createRequire(import.meta.url)` | pdfmake 0.3.8 est CJS pur — pas d'alternative ESM officielle sur npm |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.4 + @cucumber/cucumber 11.3.0 + fast-check 4.8.0 |
| Config file | `vitest.config.ts` (existant Phase 1) |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test:bdd && pnpm test:cov` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENC-01 | Générer quittance PDF si statut `payee` | Cucumber BDD | `pnpm test:bdd -- --tags @enc-01` | ❌ Wave 0 |
| ENC-01 | Profil bailleur absent → redirect `/bailleur` | Cucumber BDD | idem | ❌ Wave 0 |
| ENC-02 | Avis d'échéance PDF on-the-fly | Integration (route Fastify) | `pnpm test -- -t avis-pdf` | ❌ Wave 0 |
| ENC-03 | Encaissement partiel → statut `partiellement_payee` | Cucumber BDD | `pnpm test:bdd -- --tags @enc-03` | ❌ Wave 0 |
| ENC-03 | Encaissement exact → statut `payee` | Cucumber BDD | idem | ❌ Wave 0 |
| ENC-03 | Sur-paiement → statut `payee` + warning | Unit + Integration | `pnpm test -- -t sur-paiement` | ❌ Wave 0 |
| ENC-04 | Impayés : échéances non payées après `jour_echeance_attendue` | Unit (dérivé Clock) | `pnpm test -- -t impayes` | ❌ Wave 0 |
| ENC-05 | Relance niveau 1 disponible à J+10 (Clock injecté) | Cucumber BDD | `pnpm test:bdd -- --tags @enc-05` | ❌ Wave 0 |
| ENC-05 | Chaînage strict : niveau 3 impossible sans niveau 2 | Unit | `pnpm test -- -t chainageRelance` | ❌ Wave 0 |
| D-56 | Prorata 1ère/dernière échéance — commutativité | fast-check | `pnpm test -- -t prorata` | ❌ Wave 0 |
| D-60 | Soft-delete : somme exclut les annulés | Integration (Kysely) | `pnpm test -- -t soft-delete` | ❌ Wave 0 |
| D-64 | Numérotation séquentielle annuelle `AAAA-NNN` | Integration | `pnpm test -- -t numerotation` | ❌ Wave 0 |
| D-67 | Singleton Bailleur : 2e insert rejeté | Integration | `pnpm test -- -t singleton-bailleur` | ❌ Wave 0 |
| D-72 | Activation rétroactive > 2 ans : warning visible | Cucumber BDD | `pnpm test:bdd -- --tags @d-72` | ❌ Wave 0 |

### Invariants Critiques × Niveau de Test

| Invariant | Agrégat | Niveau | Justification |
|----------|---------|-------|---------------|
| Prorata 1ère/dernière échéance : somme ≤ total + 1 centime | Money + EcheanceLoyer | **fast-check** | Propriété mathématique — vérifie des milliers de valeurs |
| Prorata mois entier = loyer total | Money | **fast-check** | Identité : ×(N/N) = ×1 |
| Paiement partiel n'émet pas Quittance (ENC-03) | EcheanceLoyer + Quittance | **Cucumber** | Scénario BDD complet (saisie encaissement → vérifier bouton absent) |
| Sur-paiement : statut bascule `payee` (D-59) | EcheanceLoyer | **Unit** + **Integration** | Unit : invariant domaine pur ; Integration : persistance via Kysely |
| Soft-delete + compensateur : somme exclut les annulés (D-60) | Encaissement | **Unit** (Money.negation) + **Integration** (Kysely WHERE annule_le IS NULL) | Double vérification domaine + DB |
| Activation rétroactive génère N échéances `en_attente` (D-72) | Bail → EcheanceLoyer | **Cucumber** | Scénario end-to-end : activer bail → vérifier count échéances |
| Chaînage strict relances (impossible sauter niveau 3) (D-71) | Relance | **Unit** | Règle pure domaine — use case `calculerRelanceDisponible` |
| Singleton Bailleur (D-67) | Bailleur | **Integration** | Vérifier que 2e insert lève `InvariantViolated` (use case) ET erreur SQLite (UNIQUE) |
| Numérotation séquentielle annuelle (D-64) | Quittance | **Integration** | Vérifier `2026-001`, `2026-002`, reset `2027-001` — mono-user, pas de concurrence |
| Quittance invalidée si encaissement annulé post-émission (D-65) | Quittance + Encaissement | **Integration** | Annuler encaissement → vérifier flag `annulee_le` sur quittance + warning UI |
| Date encaissement permissive + warnings (D-61) | Encaissement | **Unit** | Warnings à J > today+90 et J < bail.dateDebut — pas de reject |
| Modification bail actif : écrase uniquement les `en_attente` (D-73) | Bail + EcheanceLoyer | **Cucumber** | Scénario : créer encaissement → modifier bail → vérifier que payée reste intacte |

### Sampling Rate

- **Par commit de plan :** `pnpm test`
- **Par merge de wave :** `pnpm test:bdd && pnpm test:cov`
- **Phase gate :** Suite complète verte avant `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/bdd/features/quittancement.feature` — couvre ENC-01 à ENC-04
- [ ] `tests/bdd/features/relances.feature` — couvre ENC-05 + D-71/D-72
- [ ] `tests/bdd/features/bailleur.feature` — couvre D-67 singleton
- [ ] `tests/_world/monde-phase2.ts` — World Cucumber avec ClockFixe
- [ ] `tests/_builders/encaissements.ts` — builders Phase 2
- [ ] `tests/unit/_shared/money.test.ts` — extension fast-check pour multiplyByFraction
- [ ] Migration `src/infrastructure/db/migrations/0002_phase2_init.sql`

---

## Common Pitfalls

### Pitfall 1 — pdfmake ESM : "createPdf is not a function"

**Ce qui se passe :** `import pdfmake from 'pdfmake'` ou `import { createPdf } from 'pdfmake'` échoue dans un projet `"type":"module"` — pdfmake 0.3.8 n'a aucun export ESM.

**Pourquoi :** Le package.json de pdfmake n'a pas de champ `"exports"` ni `"module"`. Node.js ESM ne peut pas l'importer nativement.

**Solution :** `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); const pdfmake = require('pdfmake');`

**Warning à supprimer :** pdfmake logue `console.warn` si `setUrlAccessPolicy` et `setLocalAccessPolicy` ne sont pas définis en mode serveur. Toujours les configurer dans l'adapter.

### Pitfall 2 — Polices Helvetica : pas d'accents français

**Ce qui se passe :** Les caractères `é`, `è`, `ê`, `à`, `ç`, `ù` apparaissent comme des rectangles ou sont omis dans le PDF.

**Pourquoi :** Les polices Standard-14 (Helvetica, Times…) n'encodent que l'ANSI code page (anglais). Les noms et adresses français nécessitent une police TTF supportant UTF-8.

**Solution :** Utiliser Roboto ou toute autre police TTF avec les glyphes latins complets. Bundler les fichiers .ttf dans `src/infrastructure/pdf/fonts/`.

**Vérification :** Tester avec un nom contenant `é` (ex: `René Dupré`) + adresse avec `é` ou `è`.

### Pitfall 3 — mailto : accents perdus ou URL corrompue

**Ce qui se passe :** Le brouillon email s'ouvre avec des caractères `?` ou des codes hexadécimaux bruts à la place des accents.

**Pourquoi :** Soit les caractères ne sont pas percent-encodés, soit un `+` remplace les espaces (format form-encoded, pas URI-encoded).

**Solution :** `encodeURIComponent(text)` — jamais de `text.replace(/ /g, '+')`. Pour les sauts de ligne : `.replace(/%0A/g, '%0D%0A')` après `encodeURIComponent`.

### Pitfall 4 — mailto > 2000 chars : lien silencieusement ignoré sur Windows

**Ce qui se passe :** Sur Windows, cliquer sur le lien de relance ne fait rien — pas d'erreur.

**Pourquoi :** Windows Mail et Outlook tronquent silencieusement les URIs mailto au-delà de ~2046 chars [CITED: geeklog.adamwilson.info].

**Solution :** Limiter le corps encodé à 1900 chars et ajouter une mention de troncature. Tester avec un locataire dont le prénom + nom + adresse occupent beaucoup de place.

### Pitfall 5 — Money.soustraire() avec encaissement compensateur négatif

**Ce qui se passe :** `Money.fromCentimes(-500n)` lève `InvariantViolated` car Phase 1 refuse les négatifs.

**Pourquoi :** Le VO Money Phase 1 est strictement positif — conçu pour les loyers, pas les corrections.

**Solution :** Ajouter une factory `Money.compensateur(positif: Money): Money` qui crée un Money à centimes négatifs (sans passer par `fromCentimes`). Utiliser ce type uniquement pour les encaissements compensateurs. La somme des encaissements actifs additionne un positif + un négatif = solde net.

### Pitfall 6 — ZodEffects + .omit() (réplication Phase 1)

**Ce qui se passe :** Un schéma Zod avec `.superRefine()` (ex: validation croisée `mode_charges === 'provisions' → charges > 0`) ne supporte pas `.omit()` ou `.partial()`.

**Solution :** Recréer le schéma dérivé explicitement sans utiliser `.omit()` sur le schéma raffiné.

### Pitfall 7 — Temporal.PlainDate et `daysInMonth` pour le prorata de février

**Ce qui se passe :** Un prorata calculé avec 28 fixe pour février échoue les années bissextiles (29 jours).

**Solution :** Toujours utiliser `Temporal.PlainDate.daysInMonth` — la propriété retourne la valeur correcte selon l'année. Le `jourEcheance` plafonné à 28 (D-53) évite les dates invalides.

### Pitfall 8 — Régénération des types Kysely après migration ALTER

**Ce qui se passe :** Les nouvelles colonnes `actif_depuis` et `jour_echeance` sur `bail` + les nouvelles tables ne sont pas connues de Kysely → erreurs TypeScript.

**Solution :** Mettre à jour `kysely-types.ts` manuellement après chaque migration ALTER ou ajout de table. Inclure dans le plan 1 (walking skeleton Phase 2).

---

## Recommandations

### DP-07 — Placement agrégat Bailleur

**Recommandation : `domain/identite/`** (plutôt que `domain/_shared/`).

Argumentaire : le concept `Bailleur` grandira (SIRET, statut juridique en Phase 5/6, éventuellement adresse de correspondance distincte de l'adresse principale). Le BC `identite/` est explicitement mentionné dans le CONTEXT.md (D-67) et PROJECT.md. Le placer dans `_shared/` signifierait que tout BC peut en dépendre sans passer par un use case — contraire à l'isolation DDD. `_shared/` doit rester limité aux VOs et ports vraiment transverses (Money, Adresse, Clock, InvariantViolated).

### DP-08 — Storage compteur quittances

**Recommandation : table `meta`** (clé `compteur_quittance_2026`, valeur `'42'`).

Pattern déjà établi Phase 1 (clé `wizard_complete`). Cohérent avec le schéma existant. Pas de table dédiée — YAGNI.

```sql
-- Dans la transaction de génération quittance
SELECT valeur FROM meta WHERE cle = 'compteur_quittance_2026' FOR UPDATE; -- pas de SERIAL en SQLite
UPDATE meta SET valeur = CAST(CAST(valeur AS INTEGER) + 1 AS TEXT) WHERE cle = 'compteur_quittance_2026';
-- (ou INSERT ON CONFLICT si première quittance de l'année)
```

### DP-10 — Mécanisme Money.multiplyByFraction

**Recommandation :** Méthode sur la classe `Money` existante, pas de library tierce. Algorithme banker's rounding pure BigInt (voir Topic 4 ci-dessus). Signature : `multiplyByFraction(num: bigint, den: bigint, mode: 'banker' | 'floor' | 'ceil' = 'banker'): Money`.

### DP-12 — Scheduling relances

**Recommandation :** Calcul pur à la demande dans la route GET (pas de cron). La route `GET /echeances/:id` appelle `calculerRelanceDisponible(echeance, relancesExistantes, clock.aujourdhui())` qui retourne le niveau disponible ou null. Pas de state persisté autre que les `Relance` déjà enregistrées.

### DP-13 — Format PDF

Voir les définitions JSON complètes dans les sections Topics 1 et 7 ci-dessus.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-----------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v20.20.1 (env CI) / Node 22 LTS (prod) | — |
| pdfmake | ENC-01, ENC-02, D-69 niveau 3 | Via npm (pas encore installé en prod — D-36 le reportait) | 0.3.8 | — |
| @types/pdfmake | TypeScript pdfmake | À installer | 0.3.2 | — |
| @fast-check/vitest | Tests prorata | À installer | 0.4.1 | fast-check seul (API légèrement différente) |
| Roboto TTF | Polices PDF accents | À bundler depuis npm (`fontsource-roboto` ou copie manuelle) | — | Helvetica (ANSI seulement — pas recommandé pour le français) |
| ~/Library/.../gestion-locative/documents/ | Persistance PDF quittances | Créé au premier usage | — | — |

**Dépendances bloquantes :** aucune — toutes les dépendances sont disponibles sur npm ou intégrables.

**Actions Wave 0 :**
```bash
pnpm add @types/pdfmake
pnpm add @fast-check/vitest --save-dev
# Bundler Roboto TTF : récupérer Roboto-Regular.ttf et Roboto-Medium.ttf
# depuis https://fonts.google.com/specimen/Roboto ou npm fontsource
```

---

## Security Domain

> `security_enforcement` non explicitement désactivé dans config.json — section incluse.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | non | Mono-user local, pas d'auth |
| V3 Session Management | oui (Fastify session existante Phase 1) | @fastify/session — déjà en place |
| V4 Access Control | non | Single-user — pas de rôles |
| V5 Input Validation | oui | Zod + fastify-type-provider-zod (montant encaissement, dates, mode) |
| V6 Cryptography | non (PDF non chiffré V1) | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Injection SQL dans les queries Kysely | Tampering | Kysely paramétré — jamais de `sql.raw()` avec input utilisateur |
| Fichier PDF écrasé (path traversal dans nom de fichier) | Tampering | Sanitiser `quittance.numero` et `locataire.nom` avant d'en faire un nom de fichier — utiliser uniquement `[A-Za-z0-9_-]` |
| URI mailto avec contenu malveillant | Spoofing | `encodeURIComponent` prévient l'injection de headers email (`To:`, `Subject:` dans le body) |
| Dépôt de garantie > 2 × loyer HC (fraude) | Tampering | Invariant déjà en place sur `Bail` Phase 1 |
| Encaissement à date antérieure au bail (fraude rétroactive) | Tampering | Warning non-bloquant D-61 — suffisant pour le usage mono-user |

---

## Open Questions (RESOLVED)

1. **RESOLVED — 02-02 :** **Police PDF pour les accents français**
   - Ce que l'on sait : Helvetica Standard-14 est ANSI uniquement — les accents français ne s'affichent pas.
   - Ce qui est flou : Le planner doit choisir la police TTF (Roboto recommandé) et décider comment la bundler (dans `src/infrastructure/pdf/fonts/` en binaire, ou chargée depuis `node_modules/fontsource-roboto`).
   - Recommandation : Roboto depuis `@fontsource/roboto` (npm) — dépendance claire, pas de binaire commité.
   - **Décision plan 02-02 :** `@fontsource/roboto` adopté en dépendance npm. Chargement des TTF (`Roboto-Regular`, `Roboto-Medium`) au boot de l'adapter `PdfRendererPdfmake` via `fs.readFileSync` depuis `node_modules/@fontsource/roboto/files/`. Aucun binaire commité.

2. **RESOLVED — 02-03 :** **Money.negation pour les compensateurs**
   - Ce que l'on sait : `Money.fromCentimes` refuse les négatifs (Phase 1 design).
   - Ce qui est flou : Le planner doit trancher entre (a) `Money.compensateur(positif)` factory privée, (b) type `MoneySigné` distinct, (c) stocker le montant en valeur absolue + champ `type: 'credit'|'debit'`.
   - Recommandation : Option (a) — factory explicite nommée `Money.compensateur(positif: Money)` qui retourne un Money à centimes négatifs. Sémantiquement clair, pas de nouveau type.
   - **Décision plan 02-03 :** Option (a) adoptée. `Money.compensateur(positif: Money): Money` factory statique utilise le constructeur privé pour bypasser `fromCentimes` (qui rejette les négatifs). Méthode d'instance `negation()` ajoutée comme alias d'ergonomie. Méthode `estNegatif()` pour les helpers de présentation. Tests : double négation idempotente (`compensateur(compensateur(x)) === x`).

3. **RESOLVED — 02-04 :** **Stockage path des PDF quittances**
   - Ce que l'on sait : D-63 spécifie `~/Library/.../gestion-locative/documents/quittances/{annee}/`.
   - Ce qui est flou : La table `quittance` doit-elle stocker le chemin absolu ou relatif ? En cas de déplacement du dossier user, les liens se brisent.
   - Recommandation : Stocker le chemin relatif depuis `baseDir` (lui-même configurable via env var ou config) — le planner doit confirmer.
   - **Décision plan 02-04 :** Chemin relatif depuis `baseDir` adopté. `baseDir` résolu via `process.env.GESTION_LOCATIVE_DATA_DIR ?? path.join(os.homedir(), 'Library/Application Support/gestion-locative/documents')`. Table `quittance.chemin_fichier_relatif` stocke `quittances/{annee}/{nomFichier}`. L'utilisateur peut déplacer le dossier sans casser les liens (env var mise à jour). `StockageFichierLocal.lireQuittance` vérifie `resolved.startsWith(baseDir)` contre path traversal.

---

## Assumptions Log

| # | Claim | Section | Risk si Faux |
|---|-------|---------|--------------|
| A1 | `@bundled-es-modules/pdfmake` n'est pas publié sur npm | Standard Stack | Si publié, simplifie l'import ESM — vérifier `npm view @bundled-es-modules/pdfmake` avant le plan |
| A2 | La police Roboto intègre tous les glyphes latins français (é, è, ê, à, ç…) | Topic 1 | Si incomplète, choisir une autre police TTF (ex: Noto Sans) |
| A3 | `Temporal.Now.plainDateISO()` retourne la date locale sans fuseau (compatible avec `PlainDate`) | Topic 6 | Si retourne une date UTC différente de la date locale → utiliser `Temporal.Now.plainDateISO('Europe/Paris')` |

---

## Sources

### Primary (HIGH confidence)
- GitHub `bpampuch/pdfmake` — `src/OutputDocument.js`, `src/OutputDocumentServer.js`, `src/base.js`, `examples/standardfonts.js`, `standard-fonts/Helvetica.js` [VERIFIED: GitHub API]
- npm registry — pdfmake 0.3.8, @types/pdfmake 0.3.2, fast-check 4.8.0, @fast-check/vitest 0.4.1 [VERIFIED: npm view]
- Codebase Phase 1 — `money.ts`, `bail.ts`, `bail-repository-sqlite.ts`, `kysely-types.ts`, `activation.steps.ts` [VERIFIED: Read tool]
- Node.js runtime — algorithme banker's rounding BigInt testé [VERIFIED: exécution locale]

### Secondary (MEDIUM confidence)
- RFC 6068 §6 — encodage mailto URI [CITED: https://www.rfc-editor.org/rfc/rfc6068]
- `geeklog.adamwilson.info` — limites longueur mailto par plateforme [CITED: https://geeklog.adamwilson.info/article/96/There-is-a-maximum-length-on-mailto-links-on-windows]
- pdfmake docs 0.3 — server-side methods [CITED: https://pdfmake.github.io/docs/0.3/getting-started/server-side/methods/]
- pdfmake docs 0.3 — standard 14 fonts [CITED: https://pdfmake.github.io/docs/0.3/fonts/standard-14-fonts/]
- Kysely API — AggregateFunctionBuilder, SUM, WHERE IS NULL [CITED: https://kysely-org.github.io/kysely-apidoc]
- fast-check API — `fc.bigInt()`, `test.prop()` avec Vitest [CITED: https://fast-check.dev/]

### Tertiary (LOW confidence — à valider)
- SQLite singleton UNIQUE marker pattern — déduit de la documentation SQLite + pattern bricklen.github.io (article PostgreSQL adapté) [ASSUMED pour la combinaison SQLite + DDD]
- Comportement `Temporal.Now.plainDateISO()` sans fuseau explicite en France — cohérent avec le comportement observé en Phase 1 mais non testé en environnement production [ASSUMED]

---

## Metadata

**Confidence breakdown :**
- Standard stack : HIGH — versions npm vérifiées, code Phase 1 inspecté
- Architecture patterns : HIGH — patterns Phase 1 appliqués directement
- pdfmake API : HIGH — source GitHub lue directement
- mailto encoding : HIGH — RFC 6068 + test comportement documenté
- Algorithmes BigInt : HIGH — validés en runtime Node.js
- Pitfalls : HIGH — tous issus de Phase 1 LEARNINGS ou documentation officielle

**Research date :** 2026-05-14
**Valid until :** 2026-06-14 (pdfmake et fast-check versionnés explicitement — stable 30 jours)

---

## RESEARCH COMPLETE

**Phase :** 2 — Quittancement, Échéances, Encaissements, Relances
**Confidence :** HIGH

### Key Findings

- **pdfmake en ESM :** Import via `createRequire(import.meta.url)` obligatoire (CJS pur). Roboto TTF requis pour les accents français (Helvetica = ANSI uniquement). `getBuffer()` retourne `Promise<Buffer>` — injecté directement dans la réponse Fastify.
- **mailto URI :** `encodeURIComponent` pour les accents, `%0D%0A` (CRLF) pour les sauts de ligne Windows Outlook, corps limité à 1900 chars encodés pour rester sous la limite 2046 chars Windows.
- **Soft-delete + compensateur :** Calcul de somme en use case (Kysely `WHERE annule_le IS NULL`) — pas de trigger ni de view. `Money.compensateur(positif)` factory pour les encaissements négatifs.
- **BigInt prorata :** Algorithme banker's rounding pur BigInt sans library tierce, validé en runtime. Tests fast-check : commutativité + somme ≤ total + 1 centime.
- **Port Clock absent en Phase 1 :** À créer dans `domain/_shared/clock.ts` avec `ClockSysteme` + `ClockFixe`. Injecter dans `creerApp()` et propager aux use cases de relance.

### File Created
`.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-RESEARCH.md`

### Open Actions pour le Planner
- Trancher police PDF (Roboto via `@fontsource/roboto` recommandé).
- Trancher `Money.compensateur()` vs `MoneySigné` pour les encaissements négatifs.
- Trancher placement `Bailleur` : `domain/identite/` (recommandé) vs `domain/_shared/`.
- Définir le path de stockage des PDF quittances (chemin relatif depuis `baseDir` recommandé).
