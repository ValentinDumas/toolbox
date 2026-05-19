---
status: resolved
phase: 04-coffre-documentaire-travaux
source: [04-VERIFICATION.md]
started: 2026-05-18T18:57:00+02:00
updated: 2026-05-19T08:32:00+02:00
total: 3
passed: 0
issues: 2
pending: 1
gaps_closed_by: 04-05-gap-closure-uat
gaps_closed: ["G-HEIC-01", "G-HEIC-02", "G-UX-01", "G-UX-02", "G-UX-03"]
note: "5 gaps fermés en code par plan 04-05 (commits ba3db3d, e7845d3, 3eed2e8, ab121a7, f3f6083). Re-smoke test manuel des étapes pending recommandé pour confirmer E2E sur HEIC iPhone réel."
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

### Résultat partiel (2026-05-19)

- Étape 1-2 (création ticket) : **OK**
- Étape 3 (attache PJ via upload nouveau HEIC) : **ÉCHEC** — voir bugs ci-dessous (même problème que Test 1)
- Étape 3 bis (attache PJ existante, caractères spéciaux) : **OK**
- Étapes 4-8 (filtre corbeille) : non testé (bloqué)

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

---

## Suite recommandée

1. **Ne PAS avancer sur Phase 5 tant que G-HEIC-01 et G-HEIC-02 ne sont pas tranchés** — SC-1 "uploader des Justificatifs" est partiellement cassé en E2E.
2. Décision à prendre :
   - **Option A** : créer un plan `04-05-gap-closure-uat` qui fixe les 5 gaps ci-dessus (HEIC + 3 UX).
   - **Option B** : déclarer HEIC hors-périmètre V1 (cf. RISKS.md), ajouter un message clair "HEIC non supporté" dans l'UI, fixer uniquement les 3 gaps UX.
3. Une fois fixé, reprendre les étapes pending des 3 tests :
   - Test 1 : étapes 1-8 (accents + RFC 6266) + 10 (WebP corrompu)
   - Test 2 : étape 3 (attache PJ via upload) + étapes 4-8 (corbeille)
   - Test 3 : intégralement
