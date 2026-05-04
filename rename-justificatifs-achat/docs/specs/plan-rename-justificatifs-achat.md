# Plan — rename-justificatifs-achat

## Objectif

Renommer automatiquement des PDFs de justificatifs d'achat SNCF Connect au format :
`justificatif_achat_<DATE>_<PRIX>_<REF>.pdf`

Exemples :
- `justificatif_achat_20260330_18-50TTC_2668453920-20260330.pdf`
- `justificatif_achat_20260316_10-00TTC_2668453920-20260316.pdf`

---

## Structure des dossiers

```
justificatif-achat/
├── inbox/    ← PDFs bruts déposés ici (non modifiés)
├── output/   ← PDFs renommés générés ici (créé automatiquement par --real)
├── rename-justificatifs-achat.py
└── README.md
```

**Principe** : le script lit `inbox/`, écrit dans `output/` via `shutil.copy2`. Les sources ne sont jamais modifiées.

---

## Modes d'exécution

| Mode | Comportement |
|---|---|
| `--dry-run` (défaut) | Affiche les renommages prévus, ne touche rien |
| `--real` | Copie les fichiers renommés dans `output/` |

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

### 1. Date

Priorité décroissante :
0. **Date de voyage** (ligne `Aller`/`Retour`/`Departure`/`Return`) → `Aller 02/04/2026` → `20260402` ← priorité max
1. Date numérique avec contexte (`du`, `le`, `date`) → `30/03/2026` → `20260330`
2. Date en lettres avec contexte → `le 30 mars 2026` → `20260330`
3. Date en lettres sans contexte → `30 mars 2026` → `20260330`
4. Date numérique seule → `30/03/2026` → `20260330`
5. **Fallback** : date ISO extraite de la référence → `N°2668453920-20260330` → `20260330`

**Pourquoi la priorité 0** : les PDFs SNCF Connect récents contiennent "Document édité le : DD/MM/YYYY" (date de génération du PDF, pas du voyage). Sans cette priorité, les patterns inférieurs attrapent la mauvaise date.

**Avantage du fallback REF** : même si aucune date n'est lisible dans le corps du document, la référence contient toujours la date en suffixe ISO.

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
rename-justificatifs-achat.py
│
├── extract_text(path)      → str
│   ├── pdfplumber (texte natif)
│   └── pdf2image + pytesseract (fallback OCR)
├── parse_fields(text)      → Fields
│   ├── _parse_date(text)   → "20260330" | None
│   ├── _parse_amount(text) → "18-50TTC" | None
│   └── _parse_ref(text)    → "2668453920-20260330" | None
└── process_file(...)       → copie ou simule
```

---

## Comportement en cas d'échec d'extraction

| Situation | `--dry-run` | `--real` |
|---|---|---|
| Champ manquant | Affiche `[MANQUANT]`, continue | Ne copie pas, erreur explicite |
| Fichier cible déjà existant dans `output/` | — | Demande confirmation (o/N) ; si >3 conflits, propose « remplacer tous » |
| PDF illisible en natif | Bascule OCR automatiquement | idem |

---

## État d'implémentation

- [x] Script `rename-justificatifs-achat.py` créé
- [x] `extract_text()` avec fallback OCR
- [x] `_parse_date()` — 6 niveaux de priorité (0 = Aller/Departure, 5 = fallback REF)
- [x] `_parse_amount()` — priorité `€` avant le chiffre, fallbacks `€` après
- [x] `_parse_ref()` — pattern `N°<ID>-<YYYYMMDD>`
- [x] `process_file()` — dry-run vs réel, inbox → output
- [x] Dossier `inbox/` créé et PDFs déplacés dedans
- [x] Testé sur 19 justificatifs d'achat réels (19/19 extraits avec succès)
