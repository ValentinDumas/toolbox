# OCR Amélioration (Preprocessing + EasyOCR fallback) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Améliorer la qualité OCR sur photos difficiles (éclairage inégal, angle, flou) via un preprocessing renforcé en 4 étapes et un fallback EasyOCR optionnel.

**Architecture:** Deux phases en cascade dans `extract.py` : (1) `_preprocess_image` remplacée par un pipeline bilateral denoise → perspective correction → adaptive binarization → deskew ; (2) `extract_text_image` invoque EasyOCR si la confiance Tesseract est en dessous d'un seuil configurable. EasyOCR est chargé paresseusement (lazy import) pour ne pas pénaliser les cas simples.

**Tech Stack:** OpenCV (`opencv-python-headless`), Tesseract (`pytesseract`), EasyOCR (`easyocr`) — optionnel, Pillow, NumPy. Tout le reste (DB, dashboard, parsers) est non modifié.

---

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `extract.py` | Ajoute `_order_points`, `_correct_perspective`, `_tesseract_confidence`, `_get_easyocr_reader` ; remplace `_preprocess_image` ; met à jour `extract_text_image` et `extract_text` |
| `config.py` | Ajoute `ocr_preprocess`, `ocr_easyocr_fallback`, `ocr_easyocr_threshold` dans `DEFAULT_CONFIG["extraction"]` |
| `config.toml` | Ajoute les 2 nouvelles clés EasyOCR |
| `config.toml.example` | Idem + commentaires |
| `tests/test_extract.py` | Ajoute `TestTesseractConfidence`, `TestCorrectPerspective`, `TestPreprocessImage`, `TestEasyOCRFallback` |
| `README.md` | Met à jour table config, section FAQ OCR, section dépendances |

---

## Task 1 : Config — nouvelles clés DEFAULT_CONFIG

**Files:**
- Modify: `config.py`
- Modify: `config.toml`
- Modify: `config.toml.example`

- [ ] **Step 1 : Write the failing test**

Dans `tests/test_config.py`, ajouter à la fin :

```python
class TestNewOCRConfigKeys:
    def test_defaults_present(self):
        from config import DEFAULT_CONFIG
        ext = DEFAULT_CONFIG["extraction"]
        assert "ocr_preprocess" in ext
        assert ext["ocr_preprocess"] is True
        assert "ocr_easyocr_fallback" in ext
        assert ext["ocr_easyocr_fallback"] is False
        assert "ocr_easyocr_threshold" in ext
        assert ext["ocr_easyocr_threshold"] == 0.4

    def test_easyocr_keys_merged_from_toml(self, tmp_path):
        from config import load_config
        cfg_file = tmp_path / "config.toml"
        cfg_file.write_text('[extraction]\nocr_easyocr_fallback = true\nocr_easyocr_threshold = 0.3\n')
        cfg = load_config(cfg_file)
        assert cfg["extraction"]["ocr_easyocr_fallback"] is True
        assert cfg["extraction"]["ocr_easyocr_threshold"] == 0.3
```

- [ ] **Step 2 : Run to verify it fails**

```bash
cd /Users/valentinshodo/Projects/toolbox/invoice-manager
pytest tests/test_config.py::TestNewOCRConfigKeys -v
```

Expected: FAIL — `AssertionError: assert 'ocr_preprocess' in {...}`

- [ ] **Step 3 : Update DEFAULT_CONFIG in `config.py`**

Remplacer le bloc `"extraction"` dans `DEFAULT_CONFIG` :

```python
DEFAULT_CONFIG: dict = {
    "extraction": {
        "backend": "local",
        "confidence_threshold": 0.8,
        "ocr_lang": "fra+eng",
        "ocr_dpi": 300,
        "ocr_preprocess": True,
        "ocr_easyocr_fallback": False,
        "ocr_easyocr_threshold": 0.4,
    },
    # reste inchangé
```

- [ ] **Step 4 : Ajouter les clés dans `config.toml`**

Dans la section `[extraction]`, après `ocr_preprocess = true`, ajouter :

```toml
ocr_easyocr_fallback = false
ocr_easyocr_threshold = 0.4
```

- [ ] **Step 5 : Ajouter les clés dans `config.toml.example`**

Après le bloc `ocr_preprocess` (ligne ~37), ajouter :

```toml
# Fallback EasyOCR si Tesseract retourne un résultat de faible qualité.
# Nécessite : pip install easyocr
# Plus lent (3–8s/image) mais bien meilleur sur photos difficiles.
ocr_easyocr_fallback = false

# Seuil de déclenchement EasyOCR (0.0–1.0).
# Proxy = ratio alphanumérique dans le texte Tesseract.
# 0.4 = moins de 40 % de caractères alphanumériques → texte probablement bruité.
ocr_easyocr_threshold = 0.4
```

- [ ] **Step 6 : Run tests to verify they pass**

```bash
pytest tests/test_config.py::TestNewOCRConfigKeys -v
```

Expected: PASS (2 tests)

- [ ] **Step 7 : Commit**

```bash
git add config.py config.toml config.toml.example tests/test_config.py
git commit -m "feat(ocr): add ocr_easyocr_fallback and ocr_easyocr_threshold config keys"
```

---

## Task 2 : `_tesseract_confidence` — proxy de qualité Tesseract

**Files:**
- Modify: `extract.py` (après `_parse_email`, avant `_confidence_score`)
- Modify: `tests/test_extract.py`

- [ ] **Step 1 : Write the failing test**

Ajouter dans `tests/test_extract.py` :

```python
class TestTesseractConfidence:
    def test_empty_string_returns_zero(self):
        assert ex._tesseract_confidence("") == 0.0

    def test_all_alphanum(self):
        assert ex._tesseract_confidence("abc123") == 1.0

    def test_mixed(self):
        # "abc!!!" → 3 alphanum / 6 total = 0.5
        result = ex._tesseract_confidence("abc!!!")
        assert abs(result - 0.5) < 0.001

    def test_only_noise(self):
        # "~~~|||" → 0 alphanum
        assert ex._tesseract_confidence("~~~|||") == 0.0

    def test_realistic_good_text(self):
        # Texte OCR correct : beaucoup d'alphanum
        t = "Total TTC 129,46 EUR Facture FR76061464"
        result = ex._tesseract_confidence(t)
        assert result > 0.5

    def test_realistic_noisy_text(self):
        # Texte OCR bruité : beaucoup de ponctuation/symboles
        t = "||~~ !!@# $%^ &*()"
        result = ex._tesseract_confidence(t)
        assert result < 0.3
```

- [ ] **Step 2 : Run to verify it fails**

```bash
pytest tests/test_extract.py::TestTesseractConfidence -v
```

Expected: FAIL — `AttributeError: module 'extract' has no attribute '_tesseract_confidence'`

- [ ] **Step 3 : Implement `_tesseract_confidence` dans `extract.py`**

Insérer après `_parse_email` (avant `_confidence_score`) :

```python
def _tesseract_confidence(text: str) -> float:
    if not text:
        return 0.0
    alphanum = sum(c.isalnum() for c in text)
    return alphanum / len(text)
```

- [ ] **Step 4 : Run to verify they pass**

```bash
pytest tests/test_extract.py::TestTesseractConfidence -v
```

Expected: PASS (6 tests)

- [ ] **Step 5 : Commit**

```bash
git add extract.py tests/test_extract.py
git commit -m "feat(ocr): add _tesseract_confidence proxy (alphanum ratio)"
```

---

## Task 3 : Preprocessing renforcé — `_correct_perspective` + `_preprocess_image`

**Files:**
- Modify: `extract.py` (remplacer `_preprocess_image`, ajouter `_order_points` et `_correct_perspective`)
- Modify: `tests/test_extract.py`

- [ ] **Step 1 : Write the failing tests**

Ajouter dans `tests/test_extract.py` :

```python
class TestCorrectPerspective:
    def _blank_bgr(self, h=200, w=100):
        import numpy as np
        return np.ones((h, w, 3), dtype=np.uint8) * 200

    def test_returns_array_no_contour(self):
        import numpy as np
        arr = self._blank_bgr()
        result = ex._correct_perspective(arr)
        assert isinstance(result, np.ndarray)
        assert result.shape[2] == 3  # still BGR

    def test_no_crash_on_tiny_image(self):
        import numpy as np
        arr = np.zeros((10, 10, 3), dtype=np.uint8)
        result = ex._correct_perspective(arr)
        assert result.shape == arr.shape


class TestPreprocessImage:
    def _white_pil(self, w=80, h=120):
        from PIL import Image
        return Image.new("RGB", (w, h), color=(240, 240, 240))

    def test_returns_pil_image(self):
        from PIL import Image
        img = self._white_pil()
        result = ex._preprocess_image(img)
        assert isinstance(result, Image.Image)

    def test_does_not_crash_on_small_image(self):
        from PIL import Image
        img = Image.new("RGB", (20, 20), color=(200, 200, 200))
        result = ex._preprocess_image(img)
        assert isinstance(result, Image.Image)

    def test_output_size_reasonable(self):
        from PIL import Image
        img = self._white_pil(80, 120)
        result = ex._preprocess_image(img)
        # After perspective + deskew, size shouldn't explode
        assert result.width > 0 and result.height > 0
```

- [ ] **Step 2 : Run to verify they fail**

```bash
pytest tests/test_extract.py::TestCorrectPerspective tests/test_extract.py::TestPreprocessImage -v
```

Expected: `TestCorrectPerspective` → FAIL (AttributeError) ; `TestPreprocessImage` → peut passer partiellement (l'ancienne implémentation renvoie une PIL Image)

- [ ] **Step 3 : Ajouter `_order_points` dans `extract.py`**

Insérer avant `_deskew` :

```python
def _order_points(pts):
    import numpy as np
    rect = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]   # top-left
    rect[2] = pts[np.argmax(s)]   # bottom-right
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # top-right
    rect[3] = pts[np.argmax(diff)]  # bottom-left
    return rect
```

- [ ] **Step 4 : Ajouter `_correct_perspective` dans `extract.py`**

Insérer après `_order_points` :

```python
def _correct_perspective(arr):
    import cv2
    import numpy as np
    h, w = arr.shape[:2]
    gray = cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 75, 200)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return arr
    for cnt in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if len(approx) != 4:
            continue
        if cv2.contourArea(approx) < 0.2 * h * w:
            continue
        pts = approx.reshape(4, 2).astype(np.float32)
        rect = _order_points(pts)
        widthA  = np.linalg.norm(rect[2] - rect[3])
        widthB  = np.linalg.norm(rect[1] - rect[0])
        heightA = np.linalg.norm(rect[1] - rect[2])
        heightB = np.linalg.norm(rect[0] - rect[3])
        maxW = max(int(widthA), int(widthB), 1)
        maxH = max(int(heightA), int(heightB), 1)
        dst = np.array([[0, 0], [maxW - 1, 0], [maxW - 1, maxH - 1], [0, maxH - 1]], dtype=np.float32)
        M = cv2.getPerspectiveTransform(rect, dst)
        return cv2.warpPerspective(arr, M, (maxW, maxH))
    return arr
```

- [ ] **Step 5 : Remplacer `_preprocess_image` dans `extract.py`**

Remplacer la fonction existante par :

```python
def _preprocess_image(img):
    import cv2
    import numpy as np
    from PIL import ImageOps
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass
    try:
        arr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        # Step 1: bilateral denoise — removes grain without blurring text edges
        arr = cv2.bilateralFilter(arr, d=9, sigmaColor=75, sigmaSpace=75)
        # Step 2: perspective correction (skips gracefully if no document quad found)
        arr = _correct_perspective(arr)
        # Step 3: adaptive binarization — handles uneven lighting and shadows
        gray = cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
        gray = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            blockSize=25, C=11,
        )
        arr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        # Step 4: deskew
        arr = _deskew(arr)
        img = __import__("PIL.Image", fromlist=["Image"]).Image.fromarray(
            cv2.cvtColor(arr, cv2.COLOR_BGR2RGB)
        )
    except Exception:
        pass
    return img
```

- [ ] **Step 6 : Run tests to verify they pass**

```bash
pytest tests/test_extract.py::TestCorrectPerspective tests/test_extract.py::TestPreprocessImage -v
```

Expected: PASS (5 tests)

- [ ] **Step 7 : Run full suite to catch regressions**

```bash
pytest tests/test_extract.py -v
```

Expected: tous les tests existants passent.

- [ ] **Step 8 : Commit**

```bash
git add extract.py tests/test_extract.py
git commit -m "feat(ocr): strengthen preprocessing — bilateral denoise, perspective correction, adaptive binarization"
```

---

## Task 4 : EasyOCR fallback — `_get_easyocr_reader` + `extract_text_image`

**Files:**
- Modify: `extract.py`
- Modify: `tests/test_extract.py`

- [ ] **Step 1 : Write the failing tests**

Ajouter dans `tests/test_extract.py` :

```python
class TestEasyOCRFallback:
    def test_tesseract_confidence_above_threshold_no_easyocr(self, tmp_path):
        """EasyOCR must NOT be called when Tesseract confidence is sufficient."""
        img_path = tmp_path / "test.png"
        from PIL import Image
        Image.new("RGB", (100, 50), "white").save(img_path)

        with patch("extract.pytesseract") as mock_tess, \
             patch("extract._get_easyocr_reader") as mock_get:
            mock_tess.image_to_string.return_value = "Total TTC 50,00 EUR Facture"
            result = ex.extract_text_image(
                img_path, "fra", 300,
                preprocess=False,
                easyocr_fallback=True,
                easyocr_threshold=0.4,
            )
        assert "Total" in result
        mock_get.assert_not_called()

    def test_low_confidence_triggers_easyocr(self, tmp_path, monkeypatch):
        """EasyOCR is called and its result used when Tesseract confidence < threshold."""
        img_path = tmp_path / "test.png"
        from PIL import Image
        Image.new("RGB", (100, 50), "white").save(img_path)

        mock_reader = MagicMock()
        mock_reader.readtext.return_value = ["Total TTC", "129,46 EUR", "Facture OVH"]

        with patch("extract.pytesseract") as mock_tess, \
             patch("extract._get_easyocr_reader", return_value=mock_reader):
            mock_tess.image_to_string.return_value = "~~||~~"  # noise — confidence ≈ 0
            result = ex.extract_text_image(
                img_path, "fra", 300,
                preprocess=False,
                easyocr_fallback=True,
                easyocr_threshold=0.4,
            )
        assert "Total TTC" in result

    def test_easyocr_disabled_by_default(self, tmp_path):
        """With easyocr_fallback=False (default), EasyOCR is never imported."""
        img_path = tmp_path / "test.png"
        from PIL import Image
        Image.new("RGB", (100, 50), "white").save(img_path)

        with patch("extract.pytesseract") as mock_tess, \
             patch("extract._get_easyocr_reader") as mock_get:
            mock_tess.image_to_string.return_value = "~~||~~"
            ex.extract_text_image(img_path, "fra", 300, preprocess=False)
            mock_get.assert_not_called()
```

Mettre à jour l'import `unittest.mock` en haut de `test_extract.py` :

```python
from unittest.mock import patch, MagicMock
```

(remplace `from unittest.mock import patch` si déjà présent)

- [ ] **Step 2 : Run to verify they fail**

```bash
pytest tests/test_extract.py::TestEasyOCRFallback -v
```

Expected: FAIL — `TypeError: extract_text_image() got unexpected keyword argument 'easyocr_fallback'`

- [ ] **Step 3 : Ajouter `_get_easyocr_reader` dans `extract.py`**

Insérer après `_tesseract_confidence` (avant `_confidence_score`) :

```python
_easyocr_reader = None

def _get_easyocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        import easyocr
        _easyocr_reader = easyocr.Reader(["fr", "en"], gpu=False)
    return _easyocr_reader
```

- [ ] **Step 4 : Mettre à jour `extract_text_image` dans `extract.py`**

Remplacer la signature et le corps :

```python
def extract_text_image(
    path: Path,
    ocr_lang: str,
    ocr_dpi: int,
    preprocess: bool = True,
    easyocr_fallback: bool = False,
    easyocr_threshold: float = 0.4,
) -> str:
    import pytesseract
    from PIL import Image
    if path.suffix.lower() in {".heic", ".heif"}:
        from pillow_heif import register_heif_opener
        register_heif_opener()
    img = Image.open(path).convert("RGB")
    if preprocess:
        img = _preprocess_image(img)
    text = pytesseract.image_to_string(img, lang=ocr_lang, config="--psm 3")
    if not _parse_date(text):
        text_psm6 = pytesseract.image_to_string(img, lang=ocr_lang, config="--psm 6")
        text = text + "\n" + text_psm6
    if easyocr_fallback and _tesseract_confidence(text) < easyocr_threshold:
        import numpy as np
        reader = _get_easyocr_reader()
        easy_lines = reader.readtext(np.array(img), detail=0)
        text_easy = "\n".join(easy_lines)
        if len(text_easy) > len(text):
            text = text_easy
    return text.strip()
```

- [ ] **Step 5 : Mettre à jour `extract_text` dans `extract.py`**

Remplacer le bloc image dans `extract_text` :

```python
def extract_text(path: Path, cfg: dict) -> str:
    lang = cfg["extraction"]["ocr_lang"]
    dpi = cfg["extraction"]["ocr_dpi"]
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return extract_text_pdf(path, lang, dpi)
    if suffix in {".jpg", ".jpeg", ".png", ".tiff", ".bmp", ".webp", ".heic", ".heif"}:
        preprocess = cfg["extraction"].get("ocr_preprocess", True)
        easyocr_fallback = cfg["extraction"].get("ocr_easyocr_fallback", False)
        easyocr_threshold = cfg["extraction"].get("ocr_easyocr_threshold", 0.4)
        return extract_text_image(
            path, lang, dpi,
            preprocess=preprocess,
            easyocr_fallback=easyocr_fallback,
            easyocr_threshold=easyocr_threshold,
        )
    raise ValueError(f"Format non supporté : {suffix}")
```

- [ ] **Step 6 : Run tests to verify they pass**

```bash
pytest tests/test_extract.py::TestEasyOCRFallback -v
```

Expected: PASS (3 tests)

- [ ] **Step 7 : Run full suite**

```bash
pytest tests/test_extract.py -v
```

Expected: tous les tests passent.

- [ ] **Step 8 : Commit**

```bash
git add extract.py tests/test_extract.py
git commit -m "feat(ocr): add EasyOCR fallback for low-confidence Tesseract results"
```

---

## Task 5 : README — mise à jour

**Files:**
- Modify: `README.md`

- [ ] **Step 1 : Mettre à jour la table de configuration (autour de la ligne 109)**

Ajouter 3 lignes après `extraction.ocr_dpi` :

```markdown
| `extraction.ocr_preprocess` | `true` | Preprocessing image (denoise, perspective, binarisation, deskew) |
| `extraction.ocr_easyocr_fallback` | `false` | Fallback EasyOCR si confiance Tesseract insuffisante (`pip install easyocr`) |
| `extraction.ocr_easyocr_threshold` | `0.4` | Seuil de déclenchement EasyOCR (ratio alphanumérique, 0–1) |
```

- [ ] **Step 2 : Mettre à jour la section FAQ OCR (autour de la ligne 576)**

Remplacer la description du pré-traitement et la liste de conseils :

```markdown
### L'OCR donne de mauvais résultats sur mes photos de tickets

Le pipeline applique automatiquement un pré-traitement sur toutes les images en 4 étapes : dénoise bilateral (retire le grain sans flouter les contours), correction de perspective (redresse les tickets pris en angle), binarisation adaptative gaussienne (gère l'éclairage inégal et les ombres), et deskew. Deux passes Tesseract (PSM 3 + PSM 6) sont essayées si aucune date n'est détectée.

Si les résultats restent insuffisants :
- Vérifie que `ocr_preprocess = true` est dans `config.toml`
- Augmente la résolution : `ocr_dpi = 400`
- Assure-toi que `tesseract-lang` est installé (`brew install tesseract-lang`)
- Active le fallback EasyOCR pour les photos vraiment difficiles :
  ```bash
  pip install easyocr
  ```
  Puis dans `config.toml` :
  ```toml
  ocr_easyocr_fallback = true
  ocr_easyocr_threshold = 0.4  # déclencher si < 40 % alphanumérique
  ```
  EasyOCR est plus lent (3–8s/image) mais bien meilleur sur fond complexe et texte incliné.
- Les items avec confiance < 0.8 atterrissent automatiquement en section "À réviser" dans le dashboard pour correction manuelle — le texte OCR brut y est visible pour diagnostiquer
```

- [ ] **Step 3 : Mettre à jour la section dépendances Python (autour de la ligne 26)**

Ajouter une note optionnelle sous la commande pip existante :

```markdown
```bash
pip install pdfplumber pdf2image pytesseract Pillow openpyxl pillow-heif opencv-python-headless numpy
```

Optionnel — fallback OCR sur photos difficiles :
```bash
pip install easyocr
```
```

- [ ] **Step 4 : Commit**

```bash
git add README.md
git commit -m "docs(invoice-manager): update README for enhanced OCR preprocessing and EasyOCR fallback"
```

---

## Vérification finale

- [ ] **Run full test suite**

```bash
pytest -v
```

Expected: tous les tests passent, aucune régression.

- [ ] **Smoke test manuel (optionnel — si une photo est disponible dans `input/`)**

```bash
python3 extract.py --input input/
```

Vérifier dans le dashboard ou dans `data/invoices.db` que `texte_brut` contient un texte cohérent.
