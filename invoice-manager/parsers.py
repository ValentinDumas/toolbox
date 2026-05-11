"""
parsers.py — Fonctions pures de parsing de texte pour l'extraction de factures.
Pas de DB, pas d'OCR, pas d'I/O fichier.
"""

import re
from datetime import datetime

from constants import MONTHS_FR_LONG

# ── Patterns de numéro de facture ────────────────────────────────────────────

_INVOICE_PATTERNS = [
    r"(?:facture|invoice|n°|ref\b|référence)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_/]{3,})",
    r"(?:ticket|reçu|recu|transaction)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_/]{3,})",
    r"\b(RT\d{8,})\b",
]

# ── Mots à ignorer pour la détection d'émetteur ──────────────────────────────

_EMETTEUR_SKIP = frozenset([
    "tva", "ht", "ttc", "total", "date", "heure", "carte", "siret", "siren",
    "montant", "prix", "quantite", "qte", "description", "article", "facture",
    "merci", "ticket", "caisse", "recu", "reçu", "magasin",
    "pan", "seq", "mode", "type", "nom", "usage", "paiement", "visa",
])

# ── Catégories et déductibilité ───────────────────────────────────────────────

_CATEGORIES = {
    "hébergement":  ["hébergement", "hôtel", "hotel", "airbnb", "ovh", "serveur", "server", "hosting"],
    "transport":    ["sncf", "ratp", "train", "taxi", "uber", "vol", "billet", "transport"],
    "repas":        ["restaurant", "repas", "déjeuner", "dîner", "café", "brasserie"],
    "matériel":     ["ordinateur", "clavier", "souris", "écran", "hardware", "matériel"],
    "téléphonie":   ["orange", "sfr", "bouygues", "free mobile", "téléphone", "mobile", "forfait"],
    "logiciel":     ["adobe", "microsoft", "slack", "notion", "github", "saas", "logiciel", "licence", "abonnement"],
    "formation":    ["formation", "cours", "udemy", "coursera", "conférence", "séminaire"],
    "assurance":    ["assurance", "maif", "axa", "allianz", "mutuelle"],
    "loyer":        ["loyer", "bail", "location bureau"],
    "publicité":    ["google ads", "meta ads", "facebook ads", "publicité", "marketing"],
    "domaine":      ["nom de domaine", "domain", "dns"],
    "comptabilité": ["expert-comptable", "comptable", "comptabilité"],
}

_DEDUCTIBILITY = {
    "hébergement": 1.0, "transport": 1.0, "matériel": 1.0, "téléphonie": 1.0,
    "logiciel": 1.0, "formation": 1.0, "assurance": 1.0, "loyer": 1.0,
    "publicité": 1.0, "domaine": 1.0, "comptabilité": 1.0,
    "repas": 0.5,
    "autres": 0.0,
}

# ── Dates ─────────────────────────────────────────────────────────────────────

def _parse_date(text: str) -> str | None:
    from datetime import date as _date

    current_year = datetime.now().year

    def _valid(y: int, m: int, d: int) -> str | None:
        # Corrige les années OCR proches mais invalides (ex. 2086 → 2026)
        if y > current_year + 1:
            # OCR confond parfois un chiffre (ex. 2086 → 2026 : "0" lu "8")
            # Remplace les 2 derniers chiffres par ceux de l'année courante
            y_corrected = int(str(y)[:2] + str(current_year)[2:])
            if abs(y_corrected - current_year) <= 5:
                y = y_corrected
        try:
            _date(y, m, d)
            return f"{y:04d}-{m:02d}-{d:02d}"
        except ValueError:
            return None

    for m in re.finditer(r"(\d{4})[\/\-](\d{2})[\/\-](\d{2})", text):
        result = _valid(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        if result:
            return result

    for m in re.finditer(r"(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})", text):
        result = _valid(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        if result:
            return result

    for m in re.finditer(r"(\d{1,2})\s+(" + "|".join(MONTHS_FR_LONG) + r")\s+(\d{4})", text, re.I):
        month_num = int(MONTHS_FR_LONG.get(m.group(2).lower(), "0"))
        result = _valid(int(m.group(3)), month_num, int(m.group(1)))
        if result:
            return result

    return None

# ── Montants ──────────────────────────────────────────────────────────────────

def _parse_amount(text: str, keywords: list[str]) -> float | None:
    pattern = "(?:" + "|".join(re.escape(k) for k in keywords) + r")[^\d]*(\d[\d\s]*[\.,]\d{2})"
    match = re.search(pattern, text, re.I)
    if match:
        return float(match.group(1).replace(" ", "").replace(",", "."))
    return None

def _parse_amounts(text: str) -> tuple[float | None, float | None, float | None, float | None]:
    """Returns (ht, tva, ttc, taux_tva)."""
    ttc = _parse_amount(text, ["TTC", "total ttc", "total à payer", "amount due", "montant total", "total eur", "carte bancaire", "carte ba", "cb"])
    ht  = _parse_amount(text, ["total ht", "sous-total", "subtotal", "montant ht"])

    # Ticket caisse format: "TVA XX% <tva_amount> <ht_amount> HT"
    tva_line = re.search(r"TVA\s+[\d,\.\s]+%?\s+(\d+[,\.]\d{2})\s+(\d+[,\.]\d{2})\s+HT", text, re.I)
    if tva_line:
        tva = float(tva_line.group(1).replace(",", "."))
        if not ht:
            ht = float(tva_line.group(2).replace(",", "."))
    else:
        tva = _parse_amount(text, ["TVA", "tax", "vat"])

    if not ht:
        ht = _parse_amount(text, ["HT"])

    if ttc and ht and not tva:
        tva = round(ttc - ht, 2)
    elif ttc and tva and not ht:
        ht = round(ttc - tva, 2)
    elif ht and tva and not ttc:
        ttc = round(ht + tva, 2)

    if not ttc and not ht:
        bare = re.findall(r"[€$£]\s*(\d[\d\s]*[\.,]\d{2})", text)
        if bare:
            ttc = max(float(a.replace(" ", "").replace(",", ".")) for a in bare)

    taux_tva = round((tva / ht) * 100, 1) if ht and tva and ht > 0 else None
    return ht, tva, ttc, taux_tva

# ── Identifiants fiscaux ──────────────────────────────────────────────────────

def _parse_siren(text: str) -> str | None:
    match = re.search(r"\b(\d{3}\s?\d{3}\s?\d{3})\b", text)
    return match.group(1).replace(" ", "") if match else None

def _parse_siret(text: str) -> str | None:
    match = re.search(r"\b(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})\b", text)
    return match.group(1).replace(" ", "") if match else None

def _parse_tva_intracom(text: str) -> str | None:
    match = re.search(r"\b(FR\s*\d{2}\s*\d{9})\b", text, re.I)
    return match.group(1).replace(" ", "").upper() if match else None

# ── Numéro de facture ─────────────────────────────────────────────────────────

def _parse_invoice_number(text: str) -> str | None:
    for pattern in _INVOICE_PATTERNS:
        match = re.search(pattern, text, re.I)
        if match:
            return match.group(1)
    return None

# ── Émetteur ──────────────────────────────────────────────────────────────────

def _parse_emetteur_fallback(text: str) -> str | None:
    for line in text.splitlines()[:8]:
        line = line.strip()
        if not (3 <= len(line) <= 60):
            continue
        if line[-1] in (",", ":", ";"):   # labels "Clé: valeur"
            continue
        if "(" in line:                   # adresses "ROUEN (Riboudet)"
            continue
        alpha = sum(c.isalpha() for c in line)
        if alpha / len(line) < 0.6:
            continue
        words = re.findall(r"[a-zéèêëàâùûîïôœç]+", line.lower())
        if any(w in _EMETTEUR_SKIP for w in words):
            continue
        return line
    return None

# ── Email ─────────────────────────────────────────────────────────────────────

def _parse_email(text: str) -> str | None:
    m = re.search(r"[\w.+-]+@[\w-]+\.[a-z]{2,}", text, re.I)
    return m.group(0) if m else None

# ── Catégorie & mode de paiement ─────────────────────────────────────────────

def _guess_category(text: str) -> str:
    text_l = text.lower()
    for cat, keywords in _CATEGORIES.items():
        if any(k in text_l for k in keywords):
            return cat
    return "autres"

def _guess_payment_mode(text: str) -> str | None:
    text_l = text.lower()
    if any(k in text_l for k in ["virement", "transfer"]):
        return "virement"
    if any(k in text_l for k in ["carte", "cb", "visa", "mastercard"]):
        return "CB"
    if "chèque" in text_l or "cheque" in text_l:
        return "chèque"
    if "prélèvement" in text_l or "prelevement" in text_l or "sepa" in text_l:
        return "prélèvement"
    if "espèce" in text_l or "cash" in text_l:
        return "espèces"
    return None

# ── Type de document ──────────────────────────────────────────────────────────

def _guess_doc_type(text: str, user_siren: str, montant_ttc: float | None) -> str:
    text_lower = text.lower()
    is_avoir = any(k in text_lower for k in ["avoir", "credit note", "note de crédit"])
    user_is_emitter = bool(user_siren and user_siren in text)

    if is_avoir:
        return "avoir_émis" if user_is_emitter else "avoir_reçu"
    if any(k in text_lower for k in ["note de frais", "remboursement de frais"]):
        return "note_de_frais"
    if any(k in text_lower for k in ["devis", "cotation", "quote"]):
        return "devis"
    if any(k in text_lower for k in ["relevé de compte", "extrait de compte"]):
        return "relevé_bancaire"
    if user_is_emitter:
        return "facture_émise"
    if not _parse_invoice_number(text) and (montant_ttc or 0) < 200:
        return "reçu"
    return "facture_reçue"

# ── Émetteur connu ────────────────────────────────────────────────────────────

def _match_known_emitter(text: str, known_emitters: dict, fuzzy_threshold: float = 0.85) -> str | None:
    from difflib import SequenceMatcher
    text_l = text.lower()
    for keyword, name in known_emitters.items():
        kw = keyword.lower()
        # Exact match first
        if kw in text_l:
            return name
        # Fuzzy: slide a window of len(kw) over the text
        kw_length = len(kw)
        for i in range(len(text_l) - kw_length + 1):
            if SequenceMatcher(None, kw, text_l[i:i + kw_length]).ratio() >= fuzzy_threshold:
                return name
    return None

# ── Score de confiance ────────────────────────────────────────────────────────

def _confidence_score(date: str | None, ttc, ht, invoice_num: str | None, fiscal_id: str | None) -> float:
    fields = [date, ttc, ht, invoice_num, fiscal_id]
    return sum(1 for f in fields if f is not None) / len(fields)

# ── Déductibilité ─────────────────────────────────────────────────────────────

def get_deductibility(category: str) -> float:
    return _DEDUCTIBILITY.get(category, 0.0)
