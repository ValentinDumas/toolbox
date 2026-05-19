---
phase: 04-coffre-documentaire-travaux
plan: 05
plan_id: "04-05"
type: execute
wave: 5
status: planned
gap_closure: true
source_uat: 04-HUMAN-UAT.md
created: 2026-05-19
depends_on: ["04-01", "04-02", "04-03", "04-04"]
files_modified:
  # Domain
  - src/domain/documents/erreurs.ts
  # Application
  - src/application/documents/valider-magic-bytes.ts
  # Infrastructure
  - src/infrastructure/image/convertisseur-image-sharp.ts
  # Web routes
  - src/web/routes/coffre.ts
  # Web views
  - src/web/views/pages/coffre/upload.ejs
  - src/web/views/pages/coffre/liste.ejs
  # Docs
  - README.md
  - RISKS.md
  # Tests
  - tests/unit/documents/valider-magic-bytes.test.ts
  - tests/integration/image/convertisseur-image-sharp.test.ts
  - tests/integration/web/coffre-upload-erreurs.test.ts
  - tests/integration/web/coffre-empty-state-no-duplicate-cta.test.ts
  - tests/integration/web/upload-form-rattachement-toggle.test.ts
autonomous: true
requirements: [DOC-01, INC-01]
user_setup:
  - service: libheif
    why: "Conversion HEIC → JPEG côté serveur (D-105). sharp/libvips charge libheif au runtime ; sans plugin de décodage HEVC le décodage HEIC échoue (G-HEIC-02)."
    env_vars: []
    dashboard_config:
      - task: "Installer libheif + plugin de décodage HEVC (macOS)"
        location: "brew install libheif libde265"
      - task: "Installer libheif + plugin de décodage HEVC (Debian/Ubuntu)"
        location: "sudo apt install libheif1 libheif-dev libde265-0"
      - task: "Installer libheif + plugin de décodage HEVC (Fedora/RHEL)"
        location: "sudo dnf install libheif libheif-devel libde265"
tags: [phase-4, gap-closure, uat, heic, ux-fixes]

closes_gaps:
  - id: "G-HEIC-01"
    severity: blocker
    description: "Import HEIC rejeté avec « format invalide » alors que le fichier EST un HEIC iPhone valide — soupçon : brand exotique non listé dans HEIC_BRANDS ou box_size avec largesize ISOBMFF non géré."
  - id: "G-HEIC-02"
    severity: blocker
    description: "Conversion HEIC → JPEG échoue : « source: bad seek to 1784270 heif: Error while loading plugin: No decoding plugin installed for this compression format (11.6003) ». libheif présent mais sans plugin de décodage HEVC (libheif-plugin-libde265 ou libheif-plugin-aom)."
  - id: "G-UX-01"
    severity: minor
    description: "Sur /coffre/upload, radio « À rattacher » doit griser le champ opposé : radio Bien → grise select Locataire ; radio Locataire → grise select Bien ; radio Bien et Locataire → garde les deux actifs."
  - id: "G-UX-02"
    severity: minor
    description: "Pas de message d'erreur sous l'input fichier quand on submit le formulaire d'upload vide. La route renvoie erreurs.fichier mais l'EJS ne le rend visiblement pas en E2E (cause réelle : multipart envoie un fichier vide non détecté par !data côté route)."
  - id: "G-UX-03"
    severity: minor
    description: "Bouton « Ajouter un document » dupliqué sur /coffre : visible dans le header de page + dans l'empty-state quand le coffre est vide."

must_haves:
  truths:
    - "G-HEIC-01 closed : un HEIC iPhone récent est ACCEPTÉ par validerMagicBytes. La fonction detecterMagic gère : (a) liste HEIC_BRANDS élargie avec mif2, msf2, avif, avis, 1pic, mfsm, j2ki, j2is ; (b) box_size=1 (large box ISO/IEC 14496-12 §4.2, largesize en UInt64BE offset 8-15, brand offset 16-19). Logger d'empreinte hex activé via env GSD_DEBUG_MAGIC_BYTES=1 pour reproduction future."
    - "G-HEIC-02 closed : ConvertisseurImageSharp catche regex /No decoding plugin installed|bad seek|libheif: Error while loading plugin/i et lève ConversionHeicIndisponible (nouvelle erreur domain dans src/domain/documents/erreurs.ts). Route POST /coffre/upload renvoie HTTP 503 avec erreurs.fichier = 'HEIC non supporté sur ce poste. Convertissez via Aperçu/Photos avant l upload, ou installez le plugin libheif (cf. README).' README.md contient section « Dépendances système » documentant brew install libheif libde265 (macOS) + apt + dnf équivalents. RISKS.md référence G-HEIC-02 comme R6.1 V1."
    - "G-UX-01 closed : sur /coffre/upload, sélectionner radio rattachement=bien désactive #locataireId (disabled + classe .field-disabled opacity 0.5). Radio=locataire désactive #bienId. Radio=bien_et_locataire ré-active les deux. Script vanilla inline en fin de upload.ejs, addEventListener('change'). État initial réconcilié au DOMContentLoaded depuis valeurs.rattachement (ré-affichage après erreur Zod serveur)."
    - "G-UX-02 closed : un POST /coffre/upload sans fichier OU avec un fichier vide (multipart part vide, 0 octet) retourne 400 avec la vue upload.ejs et erreurs.fichier = 'Aucun fichier reçu.' visible sous l input (id=fichier-error, aria-invalid=true). Route durcit la détection : if (!data) || après toBuffer si fichierBuffer.length === 0. Test integration coffre-upload-erreurs.test.ts couvre les 2 cas."
    - "G-UX-03 closed : sur /coffre quand total === 0 && !filtresActifs, le bouton « Ajouter un document » apparaît UNE seule fois (dans empty-state). Le header omet le bouton dans ce cas. Test snapshot coffre-empty-state-no-duplicate-cta.test.ts asserte qu il n y a qu UNE occurrence de href=/coffre/upload role=button. Quand total > 0 OU filtresActifs, le bouton du header est conservé."
    - "Pas de régression : tous les tests Phase 4 existants (594 unit/integration + 112 BDD post-04-04) restent VERTS. pnpm tsc --noEmit exit 0. pnpm depcruise src --config .dependency-cruiser.cjs exit 0. README.md à jour (CLAUDE.md §Documentation hygiene)."
  artifacts:
    - path: "src/application/documents/valider-magic-bytes.ts"
      provides: "HEIC_BRANDS élargi + large box (box_size=1) + logger empreinte"
      contains: "mif2"
    - path: "src/domain/documents/erreurs.ts"
      provides: "Classe ConversionHeicIndisponible"
      contains: "ConversionHeicIndisponible"
    - path: "src/infrastructure/image/convertisseur-image-sharp.ts"
      provides: "Catch libheif plugin error → throw ConversionHeicIndisponible"
      contains: "ConversionHeicIndisponible"
    - path: "src/web/routes/coffre.ts"
      provides: "Handler 503 ConversionHeicIndisponible + détection fichier vide"
      contains: "ConversionHeicIndisponible"
    - path: "src/web/views/pages/coffre/upload.ejs"
      provides: "Script vanilla toggle radio → select disabled"
      contains: "applyState"
    - path: "src/web/views/pages/coffre/liste.ejs"
      provides: "Pas de bouton dupliqué quand coffre vide"
      contains: "filtresActifs"
    - path: "README.md"
      provides: "Section Dépendances système (libheif + libde265)"
      contains: "libheif"
    - path: "RISKS.md"
      provides: "Entrée R6.1 dépendance système libheif"
      contains: "R6.1"
  key_links:
    - from: "src/application/documents/valider-magic-bytes.ts"
      to: "HEIC_BRANDS étendu + large box parsing"
      via: "si box_size === 1 alors largesize = readBigUInt64BE(8) + brand offset 16-19 ; sinon comme avant"
      pattern: "large box|readBigUInt64BE|mif2"
    - from: "src/infrastructure/image/convertisseur-image-sharp.ts"
      to: "ConversionHeicIndisponible"
      via: "catch (err) si regex match → throw new ConversionHeicIndisponible(message)"
      pattern: "ConversionHeicIndisponible"
    - from: "src/web/routes/coffre.ts"
      to: "503 ConversionHeicIndisponible"
      via: "if (err instanceof ConversionHeicIndisponible) return reply.code(503).view(...)"
      pattern: "ConversionHeicIndisponible"
    - from: "src/web/views/pages/coffre/upload.ejs"
      to: "toggle disabled select"
      via: "addEventListener('change') sur radios[name=rattachement] qui mute select#bienId.disabled et select#locataireId.disabled"
      pattern: "applyState|field-disabled"
    - from: "src/web/views/pages/coffre/liste.ejs"
      to: "header sans bouton en empty-state initial"
      via: "if (total > 0 || filtresActifs) afficher bouton header sinon empty-state porte CTA seul"
      pattern: "total > 0 \\|\\| filtresActifs"
    - from: "README.md"
      to: "section Dépendances système"
      via: "doc brew install libheif libde265 + apt + dnf équivalents + lien RISKS.md R6.1"
      pattern: "libheif"
---

# Phase 04 — Plan 05 : Gap Closure UAT (HEIC + UX upload)

Ce plan ferme 5 gaps remontés par smoke test manuel post-04-04 (`04-HUMAN-UAT.md`). Deux blockers HEIC + trois UX. Les 4 success criteria du ROADMAP Phase 4 restent observables — ce plan **rend SC-1 (« uploader des Justificatifs ») fonctionnel en E2E pour les utilisateurs iPhone**.

**Source des spécifications :** `04-HUMAN-UAT.md` §Gaps (G-HEIC-01..02 + G-UX-01..03).

**Hors périmètre :** WR-02 (compensation soft-delete) et WR-06 (substr index) restent reportés. Le pattern G-UX-02 (message erreur fichier) sera étendu au formulaire d'attache PJ sur fiche ticket (`partial-ticket-pj-section.ejs`) en V1.1 — hors scope UAT actuel qui cible strictement `/coffre/upload`.

## Goal-Backward

Si tous les `must_haves.truths` sont vrais après exécution, alors :
- Un bailleur LMNP avec iPhone peut uploader une facture photographiée HEIC sans erreur fallacieuse (G-HEIC-01).
- Si l'environnement manque le plugin libheif, l'erreur est claire + actionable (G-HEIC-02).
- Le formulaire d'upload donne un feedback visuel immédiat : champ pertinent grisé (G-UX-01), erreur affichée précisément (G-UX-02), un seul CTA principal (G-UX-03).
- La doc utilisateur (`README.md`) liste les deps système, alignée sur D-105 et la contrainte plugin.

## Threat Model

| ID | Surface | Threat | Mitigation |
|---|---|---|---|
| TM-04-G | Upload | HEIC valide rejeté par over-restrictive box_size check (04-04 CR-08) | T1 — brands élargis + large box + logger empreinte |
| TM-04-H | Upload | Conversion HEIC silencieusement cassée par dep système absente | T1+T2 — ConversionHeicIndisponible + 503 + doc README |
| TM-04-I | Upload UI | Bug client (radio ne grise pas) → ambiguïté visuelle | T3 — JS progressif vanilla sans framework |
| TM-04-J | Upload UI | Submit silencieusement échoué côté serveur (fichier vide non détecté) | T3 — durcir route + test integration |
| TM-04-K | Coffre liste | Confusion UX double CTA (Hick) | T4 — empty-state porte CTA seul |

## Pyramide de tests prévue par tâche

| Tâche | Unit | Integration | BDD | Snapshot |
|---|---|---|---|---|
| T1 (HEIC val + conv) | 4 (brands, large box, logger on/off) | 2 (sharp passe-through + fallback erreur) | — | — |
| T2 (README) | — | — | — | — |
| T3 (UX form) | — | 2 (POST sans fichier, POST fichier vide) + 1 (toggle JS via JSDOM ou regex HTML) | — | 1 |
| T4 (UX liste) | — | 1 (GET /coffre empty → 1 seul CTA) | — | 1 |

Total nouveau : ~12 tests.

<tasks>

<task type="auto">
  <name>Task 1 — G-HEIC-01 + G-HEIC-02 : Validation HEIC élargie + fallback gracieux conversion</name>
  <read_first>
    - src/application/documents/valider-magic-bytes.ts (lignes 22-32 HEIC_BRANDS + 89-105 branche HEIC)
    - src/infrastructure/image/convertisseur-image-sharp.ts (39 lignes — try/catch sharp)
    - src/domain/documents/erreurs.ts (pattern classes erreur existantes)
    - src/domain/documents/convertisseur-image.ts (port — interface ConvertisseurImage + types MimeTypeImage)
    - src/web/routes/coffre.ts (lignes 290-355 — handlers d'erreur POST /coffre/upload)
    - src/application/documents/uploader-justificatif.ts (lignes 120-160 — flux magic-bytes → conversion → écriture)
    - tests/unit/documents/valider-magic-bytes.test.ts (helpers magicHeic() étendu par 04-04 à 24 bytes box_size=24)
    - .planning/phases/04-coffre-documentaire-travaux/04-HUMAN-UAT.md (gaps G-HEIC-01 et G-HEIC-02 verbatim)
    - .planning/phases/04-coffre-documentaire-travaux/04-CONTEXT.md (D-105)
    - Référence ISO/IEC 14496-12 §4.2 : si box_size === 1 alors largesize sur UInt64BE offset 8-15
  </read_first>
  <behavior>
    **Avant G-HEIC-01 :** HEIC_BRANDS contient 9 brands. Le test 04-04 CR-08 a durci box_size >= 16 && <= bytes.length. **Cause probable** : (a) brand iPhone non listé (mif2 ISOBMFF fréquent), OU (b) ftyp box avec box_size === 1 (large box ISO/IEC 14496-12 §4.2, vraie taille en UInt64BE offset 8-15). Le check rejette box_size === 1 car 1 < 16. Sans logger empreinte, impossible de trancher.

    **Avant G-HEIC-02 :** ConvertisseurImageSharp catche toute erreur sharp et la propage en `Error("Conversion HEIC → JPEG échouée : ...")`. La route ne handle pas cette erreur générique → 500 opaque.

    **Après G-HEIC-01 :**
    - HEIC_BRANDS += {mif2, msf2, avif, avis, 1pic, mfsm, j2ki, j2is}.
    - Branche HEIC : si box_size === 1, lire largesize = readBigUInt64BE(8) + brand offset 16-19. Vérifier largesize >= 16n && <= BigInt(bytes.length).
    - Logger empreinte hex via process.env.GSD_DEBUG_MAGIC_BYTES === '1' au début de detecterMagic : console.error('[magic-bytes] empreinte=', bytes.subarray(0, 24).toString('hex')).

    **Après G-HEIC-02 :**
    - Nouvelle erreur domain ConversionHeicIndisponible dans src/domain/documents/erreurs.ts.
    - ConvertisseurImageSharp : regex /No decoding plugin installed|bad seek|libheif: Error while loading plugin/i sur err.message → throw new ConversionHeicIndisponible(message). Sinon → propager générique actuel.
    - Route POST /coffre/upload : handler instanceof ConversionHeicIndisponible → 503 + erreurs.fichier = 'HEIC non supporté sur ce poste. Convertissez en JPEG (Aperçu/Photos) avant l upload, ou installez libheif (cf. README §Dépendances système).'

    **Pourquoi 503 et pas 415 :** le fichier EST un format supporté, c'est la pipeline serveur qui est temporairement HS. 503 sémantiquement correct.
  </behavior>
  <action>
    **1. Élargir HEIC_BRANDS** dans `valider-magic-bytes.ts:22-32` — ajouter `'mif2'`, `'msf2'`, `'avif'`, `'avis'`, `'1pic'`, `'mfsm'`, `'j2ki'`, `'j2is'`.

    **2. Supporter large box** : remplacer la branche HEIC actuelle par :
    ```ts
    if (bytes.length >= 12) {
      const boxSize = bytes.readUInt32BE(0);
      const ftypMatch =
        bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
      if (ftypMatch) {
        if (boxSize === 1 && bytes.length >= 20) {
          const largeSize = bytes.readBigUInt64BE(8);
          if (largeSize >= 16n && largeSize <= BigInt(bytes.length)) {
            const brand = bytes.subarray(16, 20).toString('ascii');
            if (HEIC_BRANDS.has(brand)) return 'image/heic';
          }
        } else if (boxSize >= 16 && boxSize <= bytes.length) {
          const brand = bytes.subarray(8, 12).toString('ascii');
          if (HEIC_BRANDS.has(brand)) return 'image/heic';
        }
      }
    }
    ```

    **3. Logger empreinte** : au tout début de detecterMagic après le check length < 4 :
    ```ts
    if (process.env.GSD_DEBUG_MAGIC_BYTES === '1') {
      // eslint-disable-next-line no-console
      console.error('[magic-bytes] empreinte=', bytes.subarray(0, 24).toString('hex'));
    }
    ```

    **4. Nouvelle erreur** dans `src/domain/documents/erreurs.ts` :
    ```ts
    export class ConversionHeicIndisponible extends Error {
      constructor(detailTechnique: string) {
        super('HEIC non supporté sur ce poste — installez libheif + libde265 (cf. README §Dépendances système). Détail : ' + detailTechnique);
        this.name = 'ConversionHeicIndisponible';
      }
    }
    ```

    **5. Modifier `convertisseur-image-sharp.ts`** : importer ConversionHeicIndisponible, dans le catch :
    ```ts
    if (/No decoding plugin installed|bad seek|libheif: Error while loading plugin/i.test(message)) {
      throw new ConversionHeicIndisponible(message);
    }
    throw new Error(`Conversion HEIC → JPEG échouée : ${message}`);
    ```

    **6. Modifier `coffre.ts`** : importer ConversionHeicIndisponible, dans le catch POST /coffre/upload, AVANT le throw final :
    ```ts
    if (err instanceof ConversionHeicIndisponible) {
      return reply.code(503).view('pages/coffre/upload.ejs', {
        biens, locataires, navActive: 'coffre',
        erreurs: { fichier: "HEIC non supporté sur ce poste. Convertissez votre fichier en JPEG (Aperçu/Photos sur macOS) avant l'upload, ou installez le plugin libheif (cf. README §Dépendances système)." },
        valeurs,
      });
    }
    ```

    **7. Mettre à jour RISKS.md** : ajouter R6.1 « Dépendance système libheif pour HEIC » avec description / impact / mitigation (cf. behavior).

    **8. Tests unitaires `valider-magic-bytes.test.ts`** — ajouter 3 describes :
    - `'G-HEIC-01 — brands ISOBMFF élargis'` : `it.each(['mif2', 'msf2', 'avif', 'avis', '1pic', 'mfsm', 'j2ki', 'j2is'])` qui construit buffer 24 bytes (box_size=24 + ftyp + brand + padding) et asserte ok=true.
    - `'G-HEIC-01 — large box'` : 2 tests (largesize valide → accepté, largesize > bytes.length → rejeté).
    - `'G-HEIC-01 — logger empreinte'` : 2 tests avec vi.spyOn(console, 'error'), GSD_DEBUG_MAGIC_BYTES=1 → appelé / unset → non appelé.

    **9. Test integration `convertisseur-image-sharp.test.ts`** (créer si absent) — utiliser vi.mock('sharp') pour simuler erreur libheif :
    ```ts
    vi.mock('sharp', () => ({
      default: vi.fn(() => ({
        jpeg: vi.fn().mockReturnValue({
          toBuffer: vi.fn().mockRejectedValue(new Error('source: bad seek\nheif: Error while loading plugin: No decoding plugin installed for this compression format (11.6003)')),
        }),
      })),
    }));
    ```
    Puis 2 tests : passe-through JPEG inchangé / HEIC sans plugin → instanceof ConversionHeicIndisponible.

    **10. Commit** : `fix(04-05): G-HEIC-01 + G-HEIC-02 — brands élargis, large box, fallback ConversionHeicIndisponible`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm test -- tests/unit/documents/valider-magic-bytes.test.ts tests/integration/image/convertisseur-image-sharp.test.ts && grep -E "mif2|msf2|avif|avis|1pic" src/application/documents/valider-magic-bytes.ts | wc -l && grep -c "readBigUInt64BE" src/application/documents/valider-magic-bytes.ts && grep -c "ConversionHeicIndisponible" src/domain/documents/erreurs.ts && grep -c "ConversionHeicIndisponible" src/infrastructure/image/convertisseur-image-sharp.ts && grep -c "ConversionHeicIndisponible" src/web/routes/coffre.ts && grep -c "GSD_DEBUG_MAGIC_BYTES" src/application/documents/valider-magic-bytes.ts && grep -c "R6.1" RISKS.md</automated>
  </verify>
  <acceptance_criteria>
    - HEIC_BRANDS ≥ 17 brands.
    - Branche HEIC supporte large box (grep readBigUInt64BE ≥ 1).
    - Logger empreinte présent (grep GSD_DEBUG_MAGIC_BYTES ≥ 1).
    - ConversionHeicIndisponible exportée + utilisée dans 3 fichiers (erreurs.ts, convertisseur-image-sharp.ts, coffre.ts).
    - Route renvoie HTTP 503 quand instanceof ConversionHeicIndisponible.
    - RISKS.md R6.1 ajouté.
    - 6 nouveaux tests verts (4 unit + 2 integration).
    - Pas de régression (594 + 6 = 600 tests verts).
  </acceptance_criteria>
  <done>
    - 5 fichiers source modifiés + RISKS.md + 2 fichiers tests.
    - Tous les grep checks passent.
    - 1 commit créé.
  </done>
</task>

<task type="auto">
  <name>Task 2 — G-HEIC-02 doc : README section Dépendances système</name>
  <read_first>
    - README.md (état actuel)
    - CLAUDE.md (§Documentation hygiene)
    - RISKS.md (R6.1 ajouté en T1)
    - .planning/phases/04-coffre-documentaire-travaux/04-CONTEXT.md (D-105)
  </read_first>
  <behavior>
    **Avant :** README.md n'a pas de section dédiée aux deps système. L'utilisateur qui clone le projet et fait pnpm install n'a aucune indication que libheif + libde265 sont nécessaires. Premier upload HEIC → erreur cryptique (ou désormais 503 clair grâce à T1).

    **Après :** README.md contient une section « ## Dépendances système » (placée après installation) listant les commandes par OS. Pointer vers RISKS.md §R6.1.

    **Pourquoi pas postinstall script :** brew/apt requiert sudo / interactivité, pollue CI cross-OS. Doc plus appropriée.
  </behavior>
  <action>
    **1. Lire l'état actuel de README.md** — vérifier structure existante. Pure addition, pas de modification des sections existantes.

    **2. Insérer section après installation** :
    ```markdown
    ## Dépendances système

    Certaines fonctionnalités reposent sur des bibliothèques natives non installées par `pnpm install`.

    ### Conversion HEIC → JPEG

    La conversion HEIC (photos iPhone) en JPEG côté serveur (D-105) utilise `sharp` → `libvips` → `libheif`. Sur Homebrew et les distributions Linux courantes, `libheif` est livré sans plugin de décodage HEVC par défaut.

    **macOS (Homebrew) :**
    ```bash
    brew install libheif libde265
    ```

    **Debian / Ubuntu :**
    ```bash
    sudo apt install libheif1 libheif-dev libde265-0
    ```

    **Fedora / RHEL :**
    ```bash
    sudo dnf install libheif libheif-devel libde265
    ```

    Si ces dépendances sont absentes, l'upload d'un HEIC retournera **HTTP 503** avec un message indiquant la procédure.

    Smoke test post-installation :
    ```bash
    pnpm tsx -e "import sharp from 'sharp'; import fs from 'node:fs'; const buf = fs.readFileSync('/chemin/vers/photo.heic'); sharp(buf).jpeg().toBuffer().then(() => console.log('OK')).catch(e => console.error('KO:', e.message));"
    ```

    Voir `RISKS.md` §R6.1 pour la mitigation détaillée.
    ```

    **3. Commit** : `docs(04-05): G-HEIC-02 — section Dépendances système README + lien RISKS R6.1`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && grep -c "libheif" README.md && grep -c "libde265" README.md && grep -c "Dépendances système" README.md && grep -c "R6.1" README.md</automated>
  </verify>
  <acceptance_criteria>
    - README.md contient section « Dépendances système » mentionnant libheif + libde265.
    - Section couvre macOS (brew) + Debian/Ubuntu (apt) + Fedora/RHEL (dnf).
    - Référence à RISKS.md §R6.1 présente.
    - Pas de modification du reste du README.
  </acceptance_criteria>
  <done>
    - README.md modifié uniquement par addition.
    - grep "libheif" README.md ≥ 2.
    - 1 commit créé.
  </done>
</task>

<task type="auto">
  <name>Task 3 — G-UX-01 + G-UX-02 : Toggle radio rattachement + détection fichier vide</name>
  <read_first>
    - src/web/views/pages/coffre/upload.ejs (forme actuelle — pas de script)
    - src/web/views/partials/partial-upload-form.ejs (3 radios rattachement + select bienId + select locataireId — rend déjà erreurs.fichier ligne 29-31)
    - src/web/routes/coffre.ts (lignes 197-219 — détection !data multipart)
    - src/web/views/partials/layout-debut.ejs et layout-fin.ejs (structure HTML pour placement script)
    - practices/UX_DESIGN.md (Hick / Fitts)
    - practices/ACCESSIBILITY.md (disabled + aria + contrast)
    - tests/integration/web/ (pattern Fastify inject + cheerio ou regex)
    - tests/helpers/ (chercher build-app.ts ou équivalent pour bootstrap Fastify in-memory)
  </read_first>
  <behavior>
    **G-UX-01 avant :** 3 radios `rattachement` (bien | locataire | bien_et_locataire) décorrélés des selects bienId/locataireId. Utilisateur peut remplir des champs incohérents (sélectionner radio=bien et remplir locataireId) → erreur Zod après submit. Sans grisage visuel, ambiguïté.

    **G-UX-01 après :** script vanilla inline (~25 lignes) au DOMContentLoaded : lit l'état initial de input[name=rattachement]:checked, active/désactive les selects via .disabled + classe CSS .field-disabled (opacity 0.5 + pointer-events none). Sur change, ré-évaluer. Aucun radio coché → les deux désactivés.

    **G-UX-02 avant :** la vue rend erreurs.fichier (partial-upload-form.ejs:29-31). Le bug : multipart envoie un part `fichier` vide (l'input n'a pas été rempli mais le form passe), `!data` est false, `toBuffer()` retourne Buffer vide, validerMagicBytes retourne {ok:false, raison:'format-non-accepte'} → message générique non spécifique au cas « pas de fichier ».

    **G-UX-02 après :** dans `coffre.ts` POST handler, après `fichierBuffer = await data.toBuffer()`, ajouter check `if (fichierBuffer.length === 0)` → return 400 avec erreurs.fichier = 'Aucun fichier reçu.' Cohérent avec le rendu existant du partial.

    **Pourquoi pas modifier le partial :** rendu HTML EST déjà correct. Bug est dans la route — masquer dans le partial est mauvaise pratique.
  </behavior>
  <action>
    **1. Modifier `upload.ejs`** — ajouter avant `<%- include('../../partials/layout-fin') %>` :
    ```ejs
    <style>
      .field-disabled { opacity: 0.5; pointer-events: none; }
    </style>
    <script type="module">
      (function () {
        const $bien = document.getElementById('bienId');
        const $locataire = document.getElementById('locataireId');
        const $fieldBien = $bien ? $bien.closest('.field') : null;
        const $fieldLocataire = $locataire ? $locataire.closest('.field') : null;
        const radios = document.querySelectorAll('input[name="rattachement"]');

        function applyState(value) {
          const bienActif = value === 'bien' || value === 'bien_et_locataire';
          const locataireActif = value === 'locataire' || value === 'bien_et_locataire';
          if ($bien) {
            $bien.disabled = !bienActif;
            if ($fieldBien) $fieldBien.classList.toggle('field-disabled', !bienActif);
          }
          if ($locataire) {
            $locataire.disabled = !locataireActif;
            if ($fieldLocataire) $fieldLocataire.classList.toggle('field-disabled', !locataireActif);
          }
        }

        radios.forEach(function (radio) {
          radio.addEventListener('change', function (e) { applyState(e.target.value); });
        });

        const checked = Array.from(radios).find(function (r) { return r.checked; });
        applyState(checked ? checked.value : null);
      })();
    </script>
    ```

    **2. Modifier `coffre.ts` POST /coffre/upload** — après `fichierBuffer = await data.toBuffer();`, ajouter :
    ```ts
    if (fichierBuffer.length === 0) {
      const biens = await opts.bienRepo.listerTous();
      const locataires = await opts.locataireRepo.listerTous();
      return reply.code(400).view('pages/coffre/upload.ejs', {
        biens, locataires, navActive: 'coffre',
        erreurs: { fichier: 'Aucun fichier reçu.' },
        valeurs: {},
      });
    }
    ```

    **3. Test integration `tests/integration/web/coffre-upload-erreurs.test.ts`** — Fastify inject avec FormData :
    ```ts
    import { describe, it, expect } from 'vitest';
    import FormData from 'form-data';
    import { build } from '../../helpers/build-app.js'; // ou adapter pattern existant

    describe('G-UX-02 — message erreur fichier vide visible', () => {
      it('POST /coffre/upload sans fichier multipart → 400 + erreur rendue', async () => {
        const app = await build();
        const form = new FormData();
        form.append('titre', 'Test');
        form.append('type', 'facture');
        form.append('dateDocument', '2026-05-19');
        form.append('rattachement', 'bien');

        const res = await app.inject({
          method: 'POST',
          url: '/coffre/upload',
          headers: form.getHeaders(),
          payload: form.getBuffer(),
        });

        expect(res.statusCode).toBe(400);
        expect(res.body).toContain('Aucun fichier reçu');
        expect(res.body).toContain('id="fichier-error"');
        expect(res.body).toMatch(/aria-invalid="true"/);
      });

      it('POST /coffre/upload avec fichier vide (0 octets) → 400 + erreur rendue', async () => {
        const app = await build();
        const form = new FormData();
        form.append('titre', 'Test');
        form.append('type', 'facture');
        form.append('dateDocument', '2026-05-19');
        form.append('rattachement', 'bien');
        form.append('fichier', Buffer.from(''), { filename: 'vide.pdf', contentType: 'application/pdf' });

        const res = await app.inject({
          method: 'POST',
          url: '/coffre/upload',
          headers: form.getHeaders(),
          payload: form.getBuffer(),
        });

        expect(res.statusCode).toBe(400);
        expect(res.body).toContain('Aucun fichier reçu');
      });
    });
    ```

    **4. Test integration `tests/integration/web/upload-form-rattachement-toggle.test.ts`** — vérifier présence script + classes :
    ```ts
    import { describe, it, expect } from 'vitest';
    import { build } from '../../helpers/build-app.js';

    describe('G-UX-01 — toggle radio rattachement', () => {
      it('GET /coffre/upload contient le script applyState et le style .field-disabled', async () => {
        const app = await build();
        const res = await app.inject({ method: 'GET', url: '/coffre/upload' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('field-disabled');
        expect(res.body).toContain('applyState');
        expect(res.body).toContain("input[name=\"rattachement\"]");
      });
    });
    ```
    Note : un test JSDOM full DOM est possible si jsdom est disponible — sinon ce test « marqueurs présents » suffit (smoke prouvable + l'EJS étant pur HTML statique, la régression serait visible).

    **5. Commit** : `fix(04-05): G-UX-01 + G-UX-02 — toggle radio rattachement + détection fichier vide`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm test -- tests/integration/web/upload-form-rattachement-toggle.test.ts tests/integration/web/coffre-upload-erreurs.test.ts && grep -c "applyState" src/web/views/pages/coffre/upload.ejs && grep -c "field-disabled" src/web/views/pages/coffre/upload.ejs && grep -c "fichierBuffer.length === 0" src/web/routes/coffre.ts</automated>
  </verify>
  <acceptance_criteria>
    - upload.ejs contient script applyState + style .field-disabled.
    - coffre.ts POST handler durci sur fichierBuffer.length === 0.
    - 3 nouveaux tests verts (2 integration coffre-upload-erreurs + 1 integration toggle).
    - Pas de régression.
  </acceptance_criteria>
  <done>
    - 2 fichiers source modifiés (upload.ejs + coffre.ts) + 2 fichiers tests créés.
    - Tous grep checks passent.
    - 1 commit créé.
  </done>
</task>

<task type="auto">
  <name>Task 4 — G-UX-03 : Pas de bouton « Ajouter un document » dupliqué sur /coffre vide</name>
  <read_first>
    - src/web/views/pages/coffre/liste.ejs (header ligne 10-18 + empty-state ligne 60-66)
    - src/web/views/partials/empty-state.ejs (rend ctaLabel/ctaUrl conditionnellement)
    - practices/UX_DESIGN.md (Hick — réduire choix simultanés)
    - tests/integration/web/ (pattern Fastify inject + assertion HTML)
  </read_first>
  <behavior>
    **Avant :** sur `/coffre`, le header (ligne 16) rend `<a href="/coffre/upload" role="button">Ajouter un document</a>`. Quand `total === 0 && !filtresActifs`, l'empty-state ligne 60-66 ajoute aussi un CTA via `ctaLabel/ctaUrl`. Résultat : 2 boutons « Ajouter un document » visibles simultanément. Violation Hick (UX_DESIGN.md) — confusion utilisateur sur lequel utiliser.

    **Après :** sur empty-state initial (total === 0 && !filtresActifs), le bouton du header est masqué. L'empty-state porte le CTA seul (pattern : action principale au centre, position attendue par l'utilisateur découvrant l'app). Quand total > 0 OU filtresActifs, le bouton du header est conservé (action toujours accessible quand contenu existe). État empty-filtré (total === 0 && filtresActifs) : bouton header présent + empty-state SANS CTA (déjà le cas actuellement).
  </behavior>
  <action>
    **1. Modifier `liste.ejs` header** lignes 10-18. Encapsuler le bouton dans un `if (total > 0 || filtresActifs)` :
    ```ejs
    <header style="display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
      <h1>Coffre documentaire</h1>
      <div style="display: flex; gap: 1rem; align-items: center;">
        <% if (locals.nbCorbeille > 0) { %>
          <a href="/coffre/corbeille">Corbeille (<%= locals.nbCorbeille %>)</a>
        <% } %>
        <% if (total > 0 || filtresActifs) { %>
          <a href="/coffre/upload" role="button">Ajouter un document</a>
        <% } %>
      </div>
    </header>
    ```

    Note : `total` et `filtresActifs` sont calculés lignes 28-35 dans la balise `<%`. Il faut donc déplacer ces calculs AVANT le header — ou rendre les locals déjà calculés côté route. **Choix le plus simple** : déplacer le calcul `filtresActifs` au-dessus du `<header>` (extraire le bloc `<% const filtres = locals.filtres || {}; const filtresActifs = ...; %>` en début de fichier).

    **2. Test integration `tests/integration/web/coffre-empty-state-no-duplicate-cta.test.ts`** :
    ```ts
    import { describe, it, expect } from 'vitest';
    import { build } from '../../helpers/build-app.js';

    describe('G-UX-03 — pas de bouton dupliqué', () => {
      it('GET /coffre coffre vide → 1 seul lien /coffre/upload', async () => {
        const app = await build(); // DB vide
        const res = await app.inject({ method: 'GET', url: '/coffre' });
        expect(res.statusCode).toBe(200);
        const matches = res.body.match(/href="\/coffre\/upload"[^>]*role="button"/g) || [];
        expect(matches.length).toBe(1);
      });

      it('GET /coffre avec documents → bouton header présent', async () => {
        const app = await build();
        // Précondition : insérer 1 justificatif via helper de test (ou builder)
        // ... (selon helpers existants)
        const res = await app.inject({ method: 'GET', url: '/coffre' });
        const matches = res.body.match(/href="\/coffre\/upload"[^>]*role="button"/g) || [];
        expect(matches.length).toBeGreaterThanOrEqual(1);
      });

      it('GET /coffre avec filtres actifs mais aucun résultat → bouton header présent', async () => {
        const app = await build();
        const res = await app.inject({ method: 'GET', url: '/coffre?search=inexistant' });
        const matches = res.body.match(/href="\/coffre\/upload"[^>]*role="button"/g) || [];
        expect(matches.length).toBeGreaterThanOrEqual(1);
      });
    });
    ```

    **3. Commit** : `fix(04-05): G-UX-03 — masquer bouton header sur coffre vide (empty-state porte CTA seul)`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm test -- tests/integration/web/coffre-empty-state-no-duplicate-cta.test.ts && grep -c "total > 0 || filtresActifs" src/web/views/pages/coffre/liste.ejs</automated>
  </verify>
  <acceptance_criteria>
    - liste.ejs contient `if (total > 0 || filtresActifs)` avant le bouton header.
    - Empty-state initial : 1 seul lien `/coffre/upload role="button"` dans l'HTML.
    - Empty-state filtré : header garde son bouton, empty-state n'a pas de CTA (état déjà correct).
    - 3 tests integration verts.
  </acceptance_criteria>
  <done>
    - liste.ejs modifié avec garde conditionnelle.
    - 1 fichier test créé.
    - 1 commit créé.
  </done>
</task>

</tasks>

## Verification globale (orchestrateur — `gsd-verifier`)

Après les 4 tasks committés, la verifier re-run doit retourner `status: passed` avec :
- `gaps_closed: [G-HEIC-01, G-HEIC-02, G-UX-01, G-UX-02, G-UX-03]`
- `gaps_remaining: []`
- `regressions: []`

Checks programmatiques :

| Check | Commande | Attendu |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Tests unit + integration | `pnpm test` | ≥ 606 tests verts (594 existants + ~12 nouveaux) |
| Tests BDD | `pnpm test:bdd` | ≥ 112 scénarios verts (inchangé — pas de nouveau scénario UAT) |
| Depcruise | `pnpm depcruise src --config .dependency-cruiser.cjs` | 0 violation (état post-04-04 préservé) |
| HEIC brands élargis | `grep -E "'mif2'\|'msf2'\|'avif'\|'avis'\|'1pic'" src/application/documents/valider-magic-bytes.ts` | ≥ 5 matches |
| Large box | `grep "readBigUInt64BE" src/application/documents/valider-magic-bytes.ts` | ≥ 1 |
| Logger empreinte | `grep "GSD_DEBUG_MAGIC_BYTES" src/application/documents/valider-magic-bytes.ts` | ≥ 1 |
| ConversionHeicIndisponible présente | `grep -rln "ConversionHeicIndisponible" src/` | 3 fichiers (erreurs.ts, convertisseur-image-sharp.ts, coffre.ts) |
| Doc README | `grep "libheif" README.md` | ≥ 2 |
| RISKS R6.1 | `grep "R6.1" RISKS.md` | ≥ 1 |
| Toggle JS | `grep "applyState" src/web/views/pages/coffre/upload.ejs` | ≥ 1 |
| Fichier vide guard | `grep "fichierBuffer.length === 0" src/web/routes/coffre.ts` | 1 |
| Bouton header conditionnel | `grep "total > 0 \\|\\| filtresActifs" src/web/views/pages/coffre/liste.ejs` | ≥ 1 |

Si toutes les vérifications passent, la verifier marquera la Phase 04 comme `[x]` complete dans ROADMAP.md et avancera STATE.md vers Phase 05.

## Notes de vigilance pendant l'exécution

1. **T1 — fixtures HEIC existantes** : `magicHeic()` mis à jour par 04-04 (24 bytes box_size=24 + brand heic). Le nouveau cas large box ne casse pas l'existant (boxSize=24 ≠ 1). Les nouveaux tests ajoutent des cas distincts. Vérifier qu'aucun helper de test HEIC ne génère par accident box_size === 1.

2. **T1 — test integration ConvertisseurImageSharp avec vi.mock('sharp')** : ne pas oublier de reset le mock entre tests pour éviter cross-pollution (`vi.unmock` ou `vi.resetModules()`). Si le projet n'utilise pas vi.mock pour les modules natifs ailleurs, valider d'abord la compatibilité avec la config vitest existante.

3. **T2 — README hygiene** : ne PAS modifier les sections existantes. Pure addition pour éviter des conflits sur des sections en cours de revue ailleurs. Si une section « Installation » existe, ajouter « Dépendances système » juste après.

4. **T3 — JS inline vs CSP** : si le projet a un header Content-Security-Policy strict (script-src 'self'), le script inline sera bloqué. Vérifier la config Fastify Helmet ou équivalent. Si CSP strict, basculer le script dans un fichier statique servi via `/public/coffre-upload.js`. Pour V1, le projet ne semble pas avoir CSP strict (Pico.css + EJS classique). À vérifier en cas de doute.

5. **T3 — extension à `partial-ticket-pj-section.ejs`** : le formulaire d'attache PJ sur fiche ticket utilise un partial différent (`partial-ticket-pj-section.ejs`) qui ne rend PAS les erreurs.fichier visibles. **Hors scope UAT** mais à tracker pour V1.1 : appliquer le même pattern (rendre erreurs.fichier dans le partial + durcir la route `travaux.ts` POST /travaux/:id/justificatifs avec le même check `fichierBuffer.length === 0`).

6. **T3 — `helpers/build-app.ts`** : si ce helper n'existe pas dans le projet, créer un harness minimal qui démarre Fastify avec les plugins requis (multipart, view, session) et un repo SQLite in-memory. Pattern Phase 1 likely already established — vérifier `tests/integration/web/relances-mailto.test.ts` ou `snapshots-phase3.test.ts` pour le pattern bootstrap.

7. **T4 — déplacement du calcul `filtresActifs` dans liste.ejs** : actuellement à la ligne 28-35 (dans un bloc `<%` AVANT le tableau). Si on le déplace AU-DESSUS du header, vérifier que `locals.filtres` est bien disponible — c'est le cas (passé par la route coffre.ts:139-146).

8. **Ordre des tasks** : T1 → T2 (T2 référence ConversionHeicIndisponible créé en T1) → T3 (indépendant de T1/T2) → T4 (indépendant). T1 et T2 forment une paire logique (code + doc). T3 et T4 sont des fix UX indépendants. Possibilité de paralléliser T2/T3/T4 après T1, mais séquentiel est plus simple pour un seul executor.

9. **Pas de scénario BDD ajouté** : les bugs UAT sont des comportements UI/code que les BDD existants couvrent fonctionnellement (upload, recherche, ticket). Ajouter un BDD pour chaque bug UX serait sur-engineering — les tests integration HTTP suffisent. Si le checker post-execution demande BDD, justifier par cette logique.

10. **Hors périmètre rappel** : WR-02, WR-06 toujours différés. Drag&drop + multi-upload V2 priorité HAUTE. Étendre G-UX-02 au form ticket PJ → V1.1.

