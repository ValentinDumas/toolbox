---
status: resolved
phase: 04-coffre-documentaire-travaux
source: [04-VERIFICATION.md]
started: 2026-05-18T18:57:00+02:00
updated: 2026-05-19T15:15:00+02:00
total: 3
passed: 1
issues: 0
pending: 2
gaps_closed_by:
  - 04-05-gap-closure-uat
  - 04-06-gap-closure-uat-test2
gaps_closed: ["G-HEIC-01", "G-HEIC-02", "G-UX-01", "G-UX-02", "G-UX-03", "G-UX-02-bis", "G-DATE-01"]
note: "7 gaps fermés en code (04-05 commits ba3db3d..f3f6083 + 04-06 commits 9a56b74..5d8da0d). Test 1 passed E2E. Test 2 (filtre corbeille) + Test 3 (cascade D-113 prod) restent pending — instructions step-by-step ci-dessous."
---

# Phase 04 — Human UAT (smoke tests post-gap-closure)

Smoke tests à exécuter en navigateur réel pour valider les angles morts non couverts par les tests automatisés post-`04-04-gap-closure`. Compile les 3 cas avec les étapes complètes + le statut courant + les bugs remontés à corriger.

## Préparation (1 fois)

```bash
# Depuis gestion-locative/
pnpm db:migrate      # crée la DB si absente + applique migrations 0001 → 0010
pnpm dev             # démarre Fastify sur http://127.0.0.1:7878
```

Configuration runtime :
- Port : `7878` (env `PORT` dans `.env`)
- DB SQLite : `~/Library/Application Support/gestion-locative/gestion-locative.db` (macOS)

Si DB vide, créer d'abord **1 Bien + 1 Locataire + 1 Bail** via le wizard d'activation pour avoir un contexte rattachable.

---

## Test 1 — Upload PJ avec nom accentué + download (CR-05 + CR-08)

**But** : prouver que `Content-Disposition` RFC 6266 fonctionne en navigateur réel ET que la validation magic-bytes WebP/HEIC est durcie en E2E.

**Statut courant : `issues` — exécuté partiellement, bugs remontés.**

### Étapes

1. Préparer un fichier nommé avec accents :
   ```bash
   cp /tmp/quelconque.pdf "/tmp/Reçu été 2026.pdf"
   ```
2. Ouvrir `http://127.0.0.1:7878/coffre/upload`
3. Upload `Reçu été 2026.pdf` :
   - Type : **Facture**
   - Année fiscale : **2026**
   - Rattacher à un Bien
   - Soumettre
4. Devrais être redirigé vers la liste avec le PJ visible.
5. Cliquer sur le PJ → fiche `/justificatifs/:id`.
6. Cliquer sur "Télécharger" ou ouvrir `/justificatifs/:id/fichier` dans un nouvel onglet.
7. **Vérifier dans le download manager du navigateur** : le fichier doit s'enregistrer comme `Reçu été 2026.pdf` (accents corrects, pas `Re_u _t_ 2026.pdf`).
8. Inspecter le header brut :
   ```bash
   curl -sI http://127.0.0.1:7878/justificatifs/<ID>/fichier | grep -i content-disposition
   ```
   Attendu : `Content-Disposition: attachment; filename="Recu ete 2026.pdf"; filename*=UTF-8''Re%C3%A7u%20%C3%A9t%C3%A9%202026.pdf`
9. Tester HEIC :
   - Upload un `.heic` iPhone → doit être accepté + converti en JPEG.
10. Tester négatif WebP corrompu :
    ```bash
    printf 'RIFF\x00\x00\x00\x00WEBPGARBAGEPAYLOAD' > /tmp/fake.webp
    ```
    Upload → doit être **rejeté** avec message magic-bytes.

### Résultat (2026-05-19 09:05)

**Statut final : ✅ PASSED après G-HEIC-01/02 + UX fixes (commits ba3db3d → ab121a7) + rebuild sharp avec libvips global (brew vips 8.18.2 + SHARP_FORCE_GLOBAL_LIBVIPS=1).**

- Étapes 1-8 (caractères spéciaux + RFC 6266) : ✅ confirmé
- Étape 9 (HEIC iPhone réel) : ✅ converti en JPEG sans erreur (G-HEIC-01 + G-HEIC-02 E2E)
- Étape 10 (WebP corrompu) : ✅ rejeté magic-bytes

---

## Test 2 — Ticket travaux + PJ + corbeille (CR-03)

**But** : prouver que la fiche ticket filtre les Justificatifs en corbeille en runtime UI.

**Statut courant : `pending` — création OK, attache PJ partielle (bug HEIC), filtre corbeille pas vérifié.**

### Étapes

1. Ouvrir la fiche d'un Bien `/biens/:id` → "Travaux" → "Nouveau ticket" (ou `/travaux/nouveau?bien=<ID>`).
2. Créer un ticket :
   - Titre : "Test CR-03 corbeille"
   - Description : "Smoke test"
   - Coût estimé : 100€
   - Soumettre.
3. Sur la fiche du ticket `/travaux/:id`, attacher une **PJ existante** via le formulaire dual-mode :
   - Option "Attacher PJ existante" → sélectionner le justificatif uploadé au Test 1.
   - Soumettre.
4. **Baseline** : la PJ doit apparaître dans la section "Pièces jointes".
5. Aller sur la fiche de la PJ `/justificatifs/<ID>` → "Mettre en corbeille" (POST `/justificatifs/:id/corbeille`).
6. **Retourner sur la fiche ticket** `/travaux/<TICKET_ID>` (recharger).
7. **Attendu** : la PJ a **disparu** de la section "Pièces jointes".
8. Vérif DB (la pivot reste intacte) :
   ```bash
   sqlite3 ~/Library/Application\ Support/gestion-locative/gestion-locative.db \
     "SELECT ticket_id, justificatif_id FROM ticket_justificatifs WHERE ticket_id='<TICKET_ID>';"
   ```
   Attendu : la row existe encore (rétention D-113 prime).

### Résultat partiel (2026-05-19 09:21)

- Étape 1-2 (création ticket) : **OK**
- Étape 3 (attache PJ via upload nouveau HEIC) : ✅ **OK** après G-HEIC-01/02 + brew vips
- Étape 3 bis (attache PJ existante, caractères spéciaux) : ✅ OK
- Étapes 4-8 (filtre corbeille) : **pending** — non encore testé (étapes détaillées section "Suite — Comment tester le filtre corbeille E2E" ci-dessous)

**Bugs supplémentaires remontés pendant Test 2 (à ajouter en gaps) :**
- **G-UX-02-bis** : le form d'upload PJ sur fiche ticket (`POST /travaux/:id/justificatifs` mode `upload nouveau`) souffre du même bug G-UX-02 — pas de garde "fichier vide" + pas de message d'erreur visible côté UI. Extension du fix G-UX-02 au form ticket.
- **G-DATE-01** : `dateOuverture` du form création ticket accepte une date future (futur > today). Doit être bloqué côté validation Zod serveur ET côté HTML5 (`<input type="date" max="<today>">`) pour feedback immédiat. Cohérent avec les autres dates métier qui ne sont jamais > aujourd'hui (échéance, encaissement…).

---

## Test 3 — Cascade D-113 SQL en prod (CR-01)

**But** : prouver que `PRAGMA foreign_keys = ON` est effectif sur la DB applicative — pas seulement en `:memory:` côté tests.

**Statut courant : `pending` — non démarré.**

### Étapes

1. Sur la DB du test 2, noter le ticket_id et au moins une row de pivot :
   ```bash
   DB=~/Library/Application\ Support/gestion-locative/gestion-locative.db
   sqlite3 "$DB" "SELECT id FROM tickets_travaux LIMIT 1;"
   # → copier l'ID, exemple : abc-123
   sqlite3 "$DB" "SELECT ticket_id, justificatif_id FROM ticket_justificatifs WHERE ticket_id='abc-123';"
   # → confirmer qu'il y a au moins une row
   ```
2. Vérifier le PRAGMA via ouverture *applicative* (pas via `sqlite3` CLI qui n'active pas le PRAGMA). Script Node :
   ```bash
   cd /Users/valentinshodo/Projects/toolbox/gestion-locative
   pnpm tsx -e "
     import { ouvrirDb, cheminBaseParDefaut } from './src/infrastructure/db/database.js';
     const { sqlite } = ouvrirDb(cheminBaseParDefaut());
     console.log('foreign_keys =', sqlite.pragma('foreign_keys', { simple: true }));
     sqlite.close();
   "
   ```
   Attendu : `foreign_keys = 1` (avant CR-01 : `0`).
3. Test cascade en vrai — depuis l'app arrêtée (libérer le lock SQLite) :
   ```bash
   pnpm tsx -e "
     import { ouvrirDb, cheminBaseParDefaut } from './src/infrastructure/db/database.js';
     const { sqlite } = ouvrirDb(cheminBaseParDefaut());
     const before = sqlite.prepare(\"SELECT COUNT(*) as n FROM ticket_justificatifs WHERE ticket_id=?\").get('<TICKET_ID>');
     console.log('pivot rows avant DELETE :', before.n);
     sqlite.prepare(\"DELETE FROM tickets_travaux WHERE id=?\").run('<TICKET_ID>');
     const after = sqlite.prepare(\"SELECT COUNT(*) as n FROM ticket_justificatifs WHERE ticket_id=?\").get('<TICKET_ID>');
     console.log('pivot rows après DELETE :', after.n);
     sqlite.close();
   "
   ```
   Attendu : `avant = N`, `après = 0`. Avant CR-01 : `après = N` (cascade non déclenchée).

### Résultat (2026-05-19)

Non démarré.

---

## Summary

| Test | Statut | Note |
|------|--------|------|
| 1. Upload PJ accents + HEIC + WebP corrompu | ✅ passed | E2E OK après brew vips + SHARP_FORCE_GLOBAL_LIBVIPS=1 |
| 2. Ticket travaux + PJ + corbeille | pending | Re-tester après fix 04-05 |
| 3. Cascade D-113 SQL en prod | pending | Non démarré |

**total :** 3 | **passed :** 1 | **issues :** 0 | **pending :** 2 | **skipped :** 0 | **blocked :** 0

---

## Gaps (à fixer dans une prochaine itération — futur plan 04-05 ou 04-06)

### G-HEIC-01 — (Bug) Import HEIC : message "format invalide" alors que le fichier EST HEIC

**Severity :** blocker (SC-1 partiellement cassé)
**Source :** Test 1 étape 9, Test 2 étape 3
**Symptôme observé :** "Affiche un message d'erreur qui demande d'importer un des formats même si le format est HEIC au lieu de l'importer sans erreur."
**Surface suspectée :**
- Validation MIME côté front (`<input accept="...">`) ?
- Ou validation magic-bytes côté serveur (`src/application/documents/valider-magic-bytes.ts`) qui retourne mismatch alors que le HEIC est valide ?
- Cf. CR-08 : la validation HEIC vérifie box_size + `ftyp` + brand ∈ {`heic`, `heix`, `mif1`, …}. Si le fichier réel a un brand exotique (ex: `heif`, `mif2`), il est rejeté.

**Action proposée :**
- Reproduire avec un HEIC iPhone récent, logger `bytes.subarray(0, 16).toString('hex')` côté `valider-magic-bytes`
- Élargir la liste `HEIC_BRANDS` si nécessaire OU ajouter le brand manquant
- Couvrir avec un test unitaire utilisant le HEIC reproduit comme fixture

### G-HEIC-02 — (Bug) Conversion HEIC → JPEG échoue : libheif sans plugin de décodage

**Severity :** blocker (SC-1 partiellement cassé)
**Source :** Test 1 étape 9
**Symptôme observé :** "Conversion HEIC → JPEG échouée : source: bad seek to 1784270 heif: Error while loading plugin: No decoding plugin installed for this compression format (11.6003)"
**Surface suspectée :**
- `src/infrastructure/image/convertisseur-image-sharp.ts` utilise `sharp` qui s'appuie sur `libvips` → `libheif` → plugin de décodage HEVC (généralement `libheif-plugin-libde265` ou `libheif-plugin-aom`).
- Sur macOS via Homebrew, `libheif` est souvent installé SANS les plugins de codec — d'où le message "No decoding plugin installed for this compression format".

**Action proposée :**
- Installer le plugin manquant : `brew install libheif libde265` (ou `aom`).
- Recompiler `sharp` ou utiliser une version qui embarque libheif statique (cf. https://sharp.pixelplumbing.com/install#prebuilt-binaries).
- Ajouter dans `README.md` une section "Dépendances système" mentionnant `libheif` + plugin de décodage.
- Plus tard, écrire un fallback gracieux : si la conversion HEIC échoue, soit (a) accepter le HEIC tel quel et le stocker sans prévisualisation JPEG, soit (b) rejeter explicitement avec un message clair ("HEIC non supporté sur ce poste — convertir en JPEG manuellement").

### G-UX-01 — Radio "À rattacher" ne grise pas le champ opposé

**Severity :** minor (UX, pas un bug fonctionnel)
**Source :** Test 1 étape 3
**Symptôme observé :** "Dans coffre/upload, si on sélectionne la valeur du radio button champ « À rattacher », alors : Un bien → griser le champ Locataire. Un locataire → griser le champ Bien."
**Surface suspectée :**
- `src/web/views/pages/coffre/upload.ejs` + JS inline ou progressif côté `partial-upload-form.ejs`.

**Action proposée :**
- Ajouter un handler `change` sur les radios `name="rattachement"` qui toggle `disabled` sur les `<select>` Bien et Locataire.
- Refléter visuellement (`opacity: 0.5` + `cursor: not-allowed`).
- Test E2E (Playwright ou snapshot d'attribut `disabled` côté Vitest+JSDOM).

### G-UX-02 — Pas de message d'erreur sous le champ fichier vide

**Severity :** minor (UX, validation)
**Source :** Test 1
**Symptôme observé :** "Il manque un message d'erreur de validation sous le champ d'import de fichier quand on tente de valider le formulaire sans importer de fichier."
**Surface suspectée :**
- Route `POST /coffre/upload` retourne déjà `erreurs.fichier = 'Aucun fichier reçu.'` (vérifié dans `coffre.ts:190+`), mais `pages/coffre/upload.ejs` n'affiche peut-être pas ce message au bon endroit.

**Action proposée :**
- Vérifier le rendu de `erreurs.fichier` dans `upload.ejs` — ajouter un bloc `<% if (erreurs.fichier) { %>...<% } %>` sous l'input.
- Couvrir par un test integration : POST `/coffre/upload` sans fichier → vérifier que la réponse HTML contient le texte d'erreur attaché à l'input.

### G-UX-03 — Bouton "Ajouter un document" dupliqué sur `/coffre`

**Severity :** minor (UX, cosmétique)
**Source :** Test 1
**Symptôme observé :** "Le bouton ajouter un document est dupliqué (sur la page précédente (/coffre))."
**Surface suspectée :**
- `src/web/views/pages/coffre/liste.ejs` rend probablement le bouton 2× (header + état vide ?).

**Action proposée :**
- Inspecter `liste.ejs` et `partial-coffre-*.ejs` — supprimer le doublon ou conditionner l'affichage (header seulement OU empty-state seulement).
- Snapshot test pour éviter régression.

### G-UX-02-bis — Pas de message d'erreur fichier vide sur form ticket PJ (extension G-UX-02)

**Severity :** minor (UX, validation — extension)
**Source :** Test 2 (2026-05-19)
**Symptôme observé :** "Même comportement de validation que Test1 pour le coffre upload de fichier (pas d'ajout sans fichier importé possible, affichage du message d'erreur)" — sur le form ticket PJ dual-mode.
**Surface suspectée :**
- Route `POST /travaux/:id/justificatifs` mode `upload nouveau` n'a pas la garde `fichierBuffer.length === 0` ajoutée par 04-05 sur `POST /coffre/upload`.
- Partial `src/web/views/partials/partial-ticket-pj-section.ejs` ne rend probablement pas `erreurs.fichier` sous l'input.

**Action proposée :**
- Appliquer le même pattern 04-05 T3 : durcir la route `travaux.ts:323+` (`fichierBuffer.length === 0` → 400 + `erreurs.fichier = 'Aucun fichier reçu.'`).
- Vérifier que le partial `partial-ticket-pj-section.ejs` rend `erreurs.fichier` sous l'input fichier.
- Tests : 2 integration analogues à `coffre-upload-erreurs.test.ts` (POST `/travaux/:id/justificatifs` sans fichier + fichier vide).

### G-DATE-01 — Date future acceptée sur form création ticket

**Severity :** minor (validation métier manquante)
**Source :** Test 2 (2026-05-19)
**Symptôme observé :** "Future date doit être un message d'erreur de validation, ou bien de warning pré-validation. Ne pas permettre l'enregistrement / validation du form si la date n'est pas conforme."
**Surface suspectée :**
- Schema Zod `ticket-travaux-schemas.ts` accepte `dateOuverture` sans contrainte `<= today`.
- Form `src/web/views/pages/travaux/creer.ejs` (ou nom équivalent) : `<input type="date">` sans attribut `max`.

**Action proposée :**
- **Domain** : ajouter invariant `TicketTravaux.creer()` qui rejette `dateOuverture > clock.today()` (lever `DateFutureInterdite` ou règle existante).
- **Application** : `creer-ticket-travaux.ts` propage l'erreur domain.
- **HTTP (Zod)** : raffinement schema `dateOuverture: z.string().refine(d => Temporal.PlainDate.from(d).since(clock.today()).days <= 0, { message: '...' })`.
- **HTML5 front** : `<input type="date" max="<%= today %>">` pour feedback immédiat navigateur.
- **Tests** : 1 BDD `@gap-uat-date @inc-01` ("Un ticket avec dateOuverture future est rejeté") + 1 integration HTTP (POST date future → 400 + erreur visible).
- **Cohérence** : appliquer le même pattern à `dateCloture` (`POST /travaux/:id/clore`) si pas déjà fait, et auditer les autres formulaires de date métier (échéance, encaissement) — déjà couverts probablement, à vérifier.

---

## Suite — Comment tester le filtre corbeille E2E (CR-03, étapes 4-8 du Test 2)

Pré-requis : avoir au moins **1 Bien**, **1 ticket travaux** sur ce Bien, **2 Justificatifs uploadés** dont au moins un sera attaché au ticket. Si tu n'as pas encore créé le ticket :

### Pas-à-pas (≈ 5 minutes)

1. **Créer un Justificatif "test corbeille"** :
   - Ouvre `http://127.0.0.1:7878/coffre/upload`
   - Upload un PDF quelconque (titre : `Test corbeille CR-03`, type : `facture`, rattacher au Bien)
   - Soumettre → tu arrives sur la fiche du Justificatif. **Note l'ID dans l'URL** (`/justificatifs/<JUSTIF_ID>`).

2. **Créer un ticket travaux + attacher la PJ existante** :
   - Ouvre `/biens/<BIEN_ID>` (fiche du Bien)
   - Section "Travaux" → "Nouveau ticket" (ou directement `/travaux/nouveau?bienId=<BIEN_ID>`)
   - Titre : `Test CR-03 — filtre corbeille`, description : `Smoke test`, coût estimé : `100`
   - Soumettre → tu arrives sur la fiche ticket. **Note l'ID dans l'URL** (`/travaux/<TICKET_ID>`).
   - Sur la fiche ticket, descend à la section "Pièces jointes" → bouton "Ajouter PJ"
   - Mode "Attacher PJ existante" → sélectionne le Justificatif `Test corbeille CR-03`
   - Soumettre → la PJ apparaît dans la section "Pièces jointes" du ticket. ✅ **Baseline confirmée**.

3. **Mettre le Justificatif en corbeille** :
   - Ouvre `/justificatifs/<JUSTIF_ID>` (fiche du Justificatif)
   - Clique sur "Mettre en corbeille" (POST `/justificatifs/:id/corbeille`)
   - Tu es redirigé vers `/coffre` ou `/coffre/corbeille` selon UI → vérifie que le doc est bien dans la corbeille (`/coffre/corbeille` doit lister le Justificatif).

4. **Recharger la fiche ticket** :
   - Retourne sur `/travaux/<TICKET_ID>` (recharge la page, Cmd+R)
   - **Attendu (CR-03 fix appliqué)** : la section "Pièces jointes" du ticket n'affiche **plus** le Justificatif en corbeille.
   - **Si avant le fix** : la PJ resterait visible avec un lien `/justificatifs/<JUSTIF_ID>/fichier` qui renvoie 410 Gone → UX cassée. C'est exactement ce que `04-04` CR-03 a fermé.

5. **Vérification DB (la pivot reste intacte — D-113 inverse : rétention prime)** :
   ```bash
   sqlite3 ~/Library/Application\ Support/gestion-locative/gestion-locative.db \
     "SELECT ticket_id, justificatif_id FROM ticket_justificatifs WHERE ticket_id='<TICKET_ID>';"
   ```
   - **Attendu** : la row existe encore (le lien pivot N:N n'est pas supprimé quand la PJ est soft-deleted ; c'est cohérent avec D-113 — la rétention 10 ans prime sur la cascade pivot).
   - Si tu restores le Justificatif depuis la corbeille (`POST /justificatifs/<JUSTIF_ID>/restaurer`), il réapparaît automatiquement sur la fiche ticket grâce au filtre `corbeilleLe === null` côté `lire-ticket.ts:50`.

### Comment ça marche techniquement

- Le filtre est dans `src/application/travaux/lire-ticket.ts:50` : `if (j && j.corbeilleLe === null) justificatifs.push(j);` (ajouté par commit `2b63e70`).
- La pivot SQL `ticket_justificatifs` n'est PAS modifiée par `mettreJustificatifEnCorbeille` — seul le champ `corbeille_le` du Justificatif est rempli.
- Lecture `lire-ticket` : N:N → boucle sur les IDs liés → pour chaque ID, `justificatifRepo.trouverParId()` → filtre `corbeilleLe === null` côté applicatif.
- Test BDD : `tests/bdd/features/travaux.feature` scénario `@gap-04 @inc-01` (ajouté par 04-04).

---

## Suite recommandée (post Test 2 partiel)

1. ✅ Phase 4 SC-1 désormais E2E validé pour HEIC iPhone (Test 1).
2. **Reste à fermer** : 2 nouveaux gaps remontés (G-UX-02-bis, G-DATE-01) — créer un mini plan `04-06-gap-closure-uat-test2` ou les rouler dans un plan futur. Sévérité minor → pas bloquant Phase 5 si l'utilisateur les tolère temporairement (les 2 sont des durcissements de validation, pas des fonctionnalités cassées).
3. **À tester encore** :
   - Test 2 étapes 4-8 : filtre corbeille (cf. § "Comment tester le filtre corbeille E2E" ci-dessus, ~5 min)
   - Test 3 : cascade D-113 SQL en prod (cf. UAT §Test 3, ~10 min)
4. **Une fois Test 2 + Test 3 verts** : Phase 4 totalement bouclée. Phase 5 (Fiscalité LMNP) débloquée.
