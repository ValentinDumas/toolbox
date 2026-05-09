# Spec — Amélioration OCR photos (Phase 2A + 2B)

**Date :** 2026-05-09
**Statut :** validé

## Problème

Le pipeline OCR actuel (CLAHE + deskew + Tesseract psm3/6) ne suffit pas sur les photos difficiles : éclairage inégal, angle de prise de vue marqué, flou, ticket froissé. Les erreurs observées couvrent les trois cas : chiffres mal lus, mots tronqués, zones entières non détectées.

## Approche retenue : deux phases en cascade

```
photo → preprocessing renforcé → Tesseract
  si confiance Tesseract < ocr_easyocr_threshold → EasyOCR
  résultat = texte avec la meilleure confiance
```

---

## Phase 1 — Preprocessing renforcé (`_preprocess_image`)

Remplacement du preprocessing actuel par un pipeline en 4 étapes :

1. **EXIF transpose** — déjà présent, conservé
2. **Dénoise bilateral** (`cv2.bilateralFilter`) — retire le grain et le bruit JPEG sans flouter les contours du texte. Paramètres : `d=9, sigmaColor=75, sigmaSpace=75`
3. **Correction de perspective** — détecter le contour principal du document (ticket, facture) via `cv2.findContours` + approximation polygonale, puis redresser par transformation homographique (`cv2.getPerspectiveTransform`). Si aucun contour quadrilatère détecté, skip sans erreur.
4. **Binarisation adaptative gaussienne** — remplace CLAHE. Seuil local calculé par région (fenêtre 25px), robuste sur fond non uniforme et ombres portées. `cv2.adaptiveThreshold(ADAPTIVE_THRESH_GAUSSIAN_C, THRESH_BINARY, blockSize=25, C=11)`.
5. **Deskew** — déjà présent, conservé, appliqué après binarisation.

**Sortie :** image PIL en niveaux de gris binarisée, prête pour Tesseract.

**Condition de skip :** si `ocr_preprocess = false` dans config, aucune des étapes ci-dessus n'est appliquée (comportement inchangé).

---

## Phase 2 — Fallback EasyOCR (`extract_text_image`)

EasyOCR est invoqué uniquement si la confiance Tesseract est insuffisante, évaluée par un proxy simple : ratio de caractères alphanumériques dans le texte extrait (seuil configurable).

**Proxy de confiance Tesseract :**
```python
def _tesseract_confidence(text: str) -> float:
    if not text:
        return 0.0
    alphanum = sum(c.isalnum() for c in text)
    return alphanum / len(text)
```

**Logique de fallback :**
```python
text_tess = pytesseract.image_to_string(img, ...)
if ocr_easyocr_fallback and _tesseract_confidence(text_tess) < ocr_easyocr_threshold:
    import easyocr
    reader = easyocr.Reader(["fr", "en"], gpu=False)
    result = reader.readtext(np.array(img), detail=0)
    text_easy = "\n".join(result)
    text = text_easy if len(text_easy) > len(text_tess) else text_tess
else:
    text = text_tess
```

`easyocr.Reader` est instancié à la demande (lazy) pour éviter l'import lourd sur les cas simples.

---

## Configuration (`config.toml` / `config.toml.example`)

Deux nouvelles clés dans `[extraction]` :

```toml
# Fallback EasyOCR si Tesseract retourne un résultat de faible qualité.
# Nécessite : pip install easyocr
# Plus lent (3–8s/image) mais bien meilleur sur photos difficiles.
ocr_easyocr_fallback = false

# Seuil de confiance Tesseract en dessous duquel EasyOCR est déclenché.
# Proxy = ratio alphanumérique dans le texte extrait (0.0–1.0).
ocr_easyocr_threshold = 0.4
```

Défaut `false` : EasyOCR ne se déclenche que si explicitement activé.

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `extract.py` | `_preprocess_image` remplacée, `extract_text_image` + `_tesseract_confidence` ajoutées |
| `config.toml` | 2 nouvelles clés ajoutées |
| `config.toml.example` | idem + commentaires |
| `config.py` | `DEFAULT_CONFIG` mis à jour avec les 2 nouvelles clés |
| `README.md` | Section OCR mise à jour |

---

## Hors scope

- Modification des parsers (`_parse_date`, `_parse_amounts`, etc.)
- Modification de la DB ou du dashboard
- Intégration Claude Vision (option C, explicitement rejetée)
