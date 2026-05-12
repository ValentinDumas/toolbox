"""
services/revision.py — Logique métier du workflow de révision.

Pure domaine : pas de Flask. Utilisé par le blueprint factures.
"""
import json

from constants import CONFIDENCE_THRESHOLD, STATUT_A_REVISER, STATUT_VALIDE


def _parse_review_fields(form) -> tuple[dict, dict]:
    """Parse and coerce form fields; return (fields, errors)."""
    fields = {}
    for field in ("type_document", "émetteur_nom", "numéro_facture",
                  "catégorie", "date_document", "notes_correction"):
        val = form.get(field, "").strip()
        if val:
            fields[field] = val

    errors = {}
    for field in ("montant_ht", "montant_tva", "montant_ttc"):
        val = form.get(field, "").strip()
        if val:
            try:
                fields[field] = float(val.replace(",", "."))
            except ValueError:
                errors[field] = f"Montant invalide : {val}"

    return fields, errors


def _validate_review_fields(fields: dict, current: dict, conn, item_id) -> dict:
    """Validate business rules; return errors dict (empty = valid)."""
    errors = {}

    has_date = fields.get("date_document") or conn.execute(
        "SELECT date_document FROM invoices WHERE id=? AND date_document IS NOT NULL", (item_id,)
    ).fetchone()
    if not has_date:
        errors["date_document"] = "Date du document requise pour apparaître dans le ledger"

    has_amount = (
        fields.get("montant_ht") is not None
        or fields.get("montant_ttc") is not None
        or current.get("montant_ht") is not None
        or current.get("montant_ttc") is not None
    )
    if not has_amount:
        errors["montant_ht"] = "Au moins un montant (HT ou TTC) est requis"

    has_emitter = fields.get("émetteur_nom") or current.get("émetteur_nom")
    if not has_emitter:
        errors["émetteur_nom"] = "Émetteur requis pour identifier la contrepartie"

    return errors


def _recompute_confidence(fields: dict, current: dict) -> tuple[float, str | None]:
    """Recalculate confidence score; return (new_confidence, warning_message_or_None)."""
    from parsers import confidence_score

    date_val   = fields.get("date_document")  or current.get("date_document")
    ttc_val    = fields.get("montant_ttc")    or current.get("montant_ttc")
    ht_val     = fields.get("montant_ht")     or current.get("montant_ht")
    num_val    = fields.get("numéro_facture") or current.get("numéro_facture")
    fiscal_val = current.get("émetteur_siren") or current.get("émetteur_tva_intracom")
    confidence = round(confidence_score(date_val, ttc_val, ht_val, num_val, fiscal_val), 2)

    warning = None
    if current["statut_révision"] == STATUT_VALIDE and confidence < CONFIDENCE_THRESHOLD:
        pct = int(confidence * 100)
        warning = f"Confiance recalculée à {pct}% — item retourné en « À réviser »."

    return confidence, warning


def _build_corrections_log(fields: dict, current: dict, now: str, warning: str | None) -> dict:
    """Enrich fields with audit metadata; return updated fields dict."""

    already_validated = current["statut_révision"] == STATUT_VALIDE

    date_doc = fields.get("date_document") or current.get("date_document")
    if date_doc:
        try:
            fields["exercice_fiscal"] = int(str(date_doc)[:4])
        except (ValueError, IndexError):
            pass

    eur = fields.get("montant_ttc") or fields.get("montant_ht")
    if eur is not None:
        fields["montant_eur"] = eur

    if warning:
        fields["statut_révision"] = STATUT_A_REVISER

    if already_validated:
        log = json.loads(current.get("corrections_log") or "[]")
        for champ, new_val in fields.items():
            old_val = current.get(champ)
            if old_val != new_val:
                log.append({"ts": now, "champ": champ, "avant": old_val, "après": new_val})
        fields["corrections_log"] = json.dumps(log, ensure_ascii=False)
        fields["date_révision"] = now
    else:
        fields["statut_révision"] = STATUT_VALIDE
        fields["révisé_par"] = "user"
        fields["date_révision"] = now
        fields["validé_le"] = now

    return fields


def _persist_invoice(conn, item_id: str, fields: dict) -> None:
    """Write updated fields to the invoices table."""
    set_clause = ", ".join(f'"{k}" = ?' for k in fields)
    conn.execute(
        f"UPDATE invoices SET {set_clause} WHERE id = ?",
        list(fields.values()) + [item_id],
    )
    conn.commit()
