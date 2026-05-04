# Plan — curate-justificatifs-achat

## Objectif

Organiser automatiquement des PDFs de justificatifs d'achat SNCF Connect au format :
`justificatif_achat_<DATES>_<PRIX>_<REF>[_<N>].pdf`

1 PDF = 1 commande. Une commande peut contenir plusieurs tickets sur plusieurs jours. `<DATES>` représente la période réelle couverte.

Exemples :
- `justificatif_achat_20260316_10-00TTC_2012890177-20260315.pdf` (1 ticket, 1 jour)
- `justificatif_achat_20260423-20260424_57-00TTC_1480540391-20260504.pdf` (4 tickets, 2 jours)

---

## Structure des dossiers

```
justificatif-achat/
├── inbox/    ← PDFs bruts déposés ici (non modifiés)
├── output/   ← PDFs organisés (vidé et recréé à chaque --real)
├── curate-justificatifs-achat.py
└── README.md
```

**Principe** : `inbox/` est la source de vérité. `output/` est une zone de sortie pure — vidée puis régénérée intégralement à chaque `--real`. Les sources ne sont jamais modifiées.

---

## Modes d'exécution

| Mode | Comportement |
|---|---|
| `--dry-run` (défaut) | Affiche les noms générés, ne touche rien |
| `--real` | Vide `output/` (confirmation utilisateur), puis copie les fichiers organisés |

---

## Extraction du texte PDF

### Stratégie (fiable, gratuite, sans API)

1. **Tentative 1 — texte natif** : `pdfplumber` lit le texte embarqué dans le PDF (rapide, précis).
2. **Tentative 2 — OCR en RAM** : si le texte est vide ou illisible, convertir les pages en images en mémoire (`pdf2image` + `Pillow`) puis passer `pytesseract` (Tesseract local, gratuit).

---

## Structure de PDF reconnue (SNCF Connect — justificatif d'achat)

```
JUSTIFICATIF D'ACHAT
Paris, le 30/03/2026
...
€18,50
...
N°2668453920-20260330
```

Spécificités :
- Le symbole `€` est placé **avant** le montant (contrairement aux justificatifs de voyage)
- La référence est préfixée par `N°` et suit le format `<ID numérique>-<YYYYMMDD>`

---

## Données à extraire

### 1. Dates de la commande

`_parse_date` collecte **toutes** les dates de tickets via `finditer` sur le pattern `Aller/Retour/Departure/Return DD/MM/YYYY`, les déduplique et les trie.

| Résultat | Format retourné | Exemple |
|---|---|---|
| 1 seul jour | `YYYYMMDD` | `20260316` |
| Plusieurs jours | `YYYYMMDD-YYYYMMDD` (premier-dernier) | `20260423-20260424` |

Priorité décroissante si le pattern Aller/Retour ne trouve rien :
1. Date numérique avec contexte (`du`, `le`, `date`) → `30/03/2026` → `20260330`
2. Date en lettres avec contexte → `le 30 mars 2026` → `20260330`
3. Date en lettres sans contexte → `30 mars 2026` → `20260330`
4. Date numérique seule → `30/03/2026` → `20260330`
5. **Fallback** : date ISO extraite de la référence → `N°2668453920-20260330` → `20260330`

**Pourquoi `finditer` au lieu de `search`** : une commande multi-tickets contient plusieurs lignes `Aller XX/XX/XXXX`. `search` ne prenait que la première — on manquait les jours suivants.

**Avantage du fallback REF** : même si aucune date n'est lisible dans le corps, la référence contient toujours la date en suffixe ISO.

### 2. Montant TTC

Priorité décroissante :
1. `€` avant montant décimal → `€18,50` ou `€ 18,50` → `18-50TTC`
2. `€` avant montant entier → `€18` → `18-00TTC`
3. Fallback `€` après, ligne `total`/`montant` → `18,50 €` → `18-50TTC`
4. Fallback `€` après, premier montant trouvé → `18,50 €` → `18-50TTC`

**Piège potentiel** : présence de montants multiples dans le document (prix unitaire, total, TVA). Prioriser `€` avant le chiffre correspond au format observé sur les justificatifs d'achat SNCF Connect.

### 3. Référence

1. Pattern `N°<ID>-<YYYYMMDD>` → retire le `N°`, garde `<ID>-<YYYYMMDD>`
   - Ex : `N°2668453920-20260330` → `2668453920-20260330`
2. Fallback : `N°` suivi d'un identifiant numérique long (≥8 chiffres)

**Différence avec voyage** : pas de code alphanumérique court (type `D56QEJ`) — la référence achat est un long identifiant numérique suffixé de la date.

---

## Structure du script

```
curate-justificatifs-achat.py
│
├── deduplicate_sources(files)  → list[Path]   [passe 1 — avant extraction]
├── extract_text(path)          → str
│   ├── pdfplumber (texte natif)
│   └── pdf2image + pytesseract (fallback OCR)
├── parse_fields(text)          → Fields
│   ├── _parse_date(text)       → "20260330" | None
│   ├── _parse_amount(text)     → "18-50TTC" | None
│   └── _parse_ref(text)        → "2668453920-20260330" | None
├── resolve_conflicts(parsed)   → list          [passe 2 — après extraction]
├── wipe_output(output_dir)     → None          [--real uniquement]
└── process_file(...)           → copie ou simule
```

---

## Comportement en cas d'échec d'extraction

| Situation | `--dry-run` | `--real` |
|---|---|---|
| Champ manquant | Affiche `[MANQUANT]`, continue | Ne copie pas, erreur explicite |
| PDF illisible en natif | Bascule OCR automatiquement | idem |

---

## Déduplication — deux passes

### Passe 1 — sources identiques (`deduplicate_sources`)

Appelée **avant l'extraction PDF**, sur la liste des fichiers sources.

**Algorithme** :
1. Calculer le checksum MD5 de chaque fichier source
2. Grouper par checksum
3. Pour chaque groupe de taille > 1 : afficher `[DOUBLON SOURCE]`, garder le plus ancien (tri primaire : `st_birthtime`, tri secondaire : `st_mtime`), ignorer les autres

**Avantage performance** : les doublons sont éliminés avant l'extraction (pdfplumber / OCR), donc aucune lecture inutile.

### Passe 2 — noms cibles identiques (`resolve_conflicts`)

Appelée **après extraction**, sur la liste des `(path, fields)`.

**Algorithme** :
1. Grouper les fichiers valides par nom cible calculé
2. Pour chaque groupe de taille > 1 :
   - Calculer le checksum MD5
   - **Identiques** → doublon résiduel, garder le premier, ignorer les autres
   - **Différents** → trier par date de création, numéroter `_1`, `_2`, … en suffixe

**Format résultant avec compteur** :
- `justificatif_achat_20260327_18-50TTC_2668453920-20260330_1.pdf`
- `justificatif_achat_20260327_18-50TTC_2668453920-20260330_2.pdf`

---

## Gestion de output/

`wipe_output()` est appelée en début de `--real` (uniquement quand `output_dir == OUTPUT`, pas en mode fichier unique) :
1. Compte les fichiers existants
2. Affiche `[OUTPUT] 'output/' sera vidé (N fichier(s)) avant regénération.`
3. Demande confirmation `[o/N]` — quitte si refusé
4. `shutil.rmtree` + `mkdir`

**Résultat** : `output/` est toujours en sync exact avec `inbox/`. Aucun fichier mort possible.

---

## État d'implémentation

- [x] Script `curate-justificatifs-achat.py` créé (renommé depuis `rename-`)
- [x] `extract_text()` avec fallback OCR
- [x] `_parse_date()` — `finditer` sur Aller/Retour → plage multi-jours ; fallbacks contexte/lettres/numérique/REF
- [x] `_parse_amount()` — priorité `€` avant le chiffre, fallbacks `€` après
- [x] `_parse_ref()` — pattern `N°<ID>-<YYYYMMDD>`
- [x] `deduplicate_sources()` — passe 1 : élimination des sources identiques (MD5) avant extraction
- [x] `resolve_conflicts()` — passe 2 : noms cibles identiques → checksum + numérotation par date de création
- [x] `wipe_output()` — vidage de output/ avec confirmation avant regénération
- [x] `process_file()` — dry-run vs réel, simplifié (pas de gestion de conflits output)
- [x] Dossier `inbox/` créé et PDFs déplacés dedans
- [x] Testé sur 19 justificatifs d'achat réels (19/19 extraits avec succès)
