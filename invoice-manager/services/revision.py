"""
services/revision.py — Logique métier du workflow de révision.

Pure domaine : pas de Flask. Utilisé par le blueprint factures.
"""
import json
from datetime import date

from constants import (
    CONFIDENCE_THRESHOLD,
    EMITTED_DOC_TYPES,
    FISCAL_RULES,
    SEUIL_TVA_SIMPLIFIEE_EUR,
    STATUT_A_REVISER,
    STATUT_VALIDE,
)
from services.montants import WARN_TVA_MISMATCH, complete_amounts


def _parse_review_fields(form) -> tuple[dict, dict]:
    """Parse and coerce form fields; return (fields, errors)."""
    fields = {}
    errors = {}

    for field in ("type_document", "émetteur_nom", "numéro_facture",
                  "notes_correction"):
        val = form.get(field, "").strip()
        if val:
            fields[field] = val

    # `catégorie` est le seul champ texte effaçable depuis l'UI : le <select>
    # renvoie toujours une valeur (vide pour « (aucune) »). On distingue donc
    # « champ absent du form » (= ne pas toucher) de « chaîne vide » (= effacer
    # explicitement la colonne en NULL).
    if "catégorie" in form:
        raw = form.get("catégorie", "").strip()
        # Invariant DB : `catégorie` est toujours stocké en minuscules
        # (cf. table category_tva_rates + migration v7). Normalisation au
        # bord, avant validation ou persistance.
        fields["catégorie"] = raw.lower() if raw else None

    # Date : ACL stricte. L'input HTML5 type="date" produit YYYY-MM-DD ;
    # on n'accepte rien d'autre pour préserver l'invariant "exercice_fiscal
    # déductible de date_document[:4]" et éviter qu'une saisie corrompue
    # remonte dans le ledger / export.
    date_val = form.get("date_document", "").strip()
    if date_val:
        try:
            date.fromisoformat(date_val)
            fields["date_document"] = date_val
        except ValueError:
            errors["date_document"] = (
                f"Date invalide — format YYYY-MM-DD attendu (reçu : {date_val})"
            )

    for field in ("montant_ht", "montant_tva", "montant_ttc"):
        val = form.get(field, "").strip()
        if val:
            try:
                fields[field] = float(val.replace(",", "."))
            except ValueError:
                errors[field] = f"Montant invalide : {val}"

    # `taux_tva` est une fraction (0..1). Le <select> du dashboard envoie
    # déjà une valeur dans cette convention ; on rejette toute saisie hors
    # de l'intervalle pour préserver l'invariant DB.
    taux_val = form.get("taux_tva", "").strip()
    if taux_val:
        try:
            taux_f = float(taux_val.replace(",", "."))
            if not (0.0 <= taux_f <= 1.0):
                errors["taux_tva"] = (
                    f"Taux de TVA invalide — fraction entre 0 et 1 attendue (reçu : {taux_val})"
                )
            else:
                fields["taux_tva"] = taux_f
        except ValueError:
            errors["taux_tva"] = f"Taux de TVA invalide : {taux_val}"

    return fields, errors


def _complete_montants(fields: dict, current: dict) -> str | None:
    """Complète HT/TVA/TTC/taux à partir des valeurs connues (fields ∪ current).

    Mutation in-place de `fields` :
    - les valeurs calculées sont écrites uniquement si elles étaient absentes
      des deux sources (jamais d'écrasement d'une valeur saisie ou extraite),
    - en cas d'incohérence (HT + TVA ≠ TTC à ±1c), un message d'avertissement
      est retourné — l'appelant l'utilise pour rétrograder en *à réviser*.
    """
    ht_in   = fields.get("montant_ht",  current.get("montant_ht"))
    tva_in  = fields.get("montant_tva", current.get("montant_tva"))
    ttc_in  = fields.get("montant_ttc", current.get("montant_ttc"))
    taux_in = fields.get("taux_tva",    current.get("taux_tva"))

    result = complete_amounts(
        ht_in, tva_in, ttc_in, taux=taux_in,
        infer_amounts=True, infer_from_rate=True,
    )

    # On n'écrase rien : on ne renseigne que les valeurs dérivées (donc
    # absentes des sources). Cela préserve l'invariant « le document est
    # source de vérité » de VISION.md.
    for short, nom, val in (
        ("ht",   "montant_ht",  result.ht),
        ("tva",  "montant_tva", result.tva),
        ("ttc",  "montant_ttc", result.ttc),
        ("taux", "taux_tva",    result.taux),
    ):
        if short in result.derived and nom not in fields and current.get(nom) is None:
            fields[nom] = val

    if WARN_TVA_MISMATCH in result.warnings:
        return "TVA incohérente avec HT/TTC — vérifiez les montants."
    return None


def _check_taux_manquant_si_grand_montant(
    fields: dict, current: dict, profil_fiscal: str | None,
) -> str | None:
    """Retourne un warning si TTC ≥ seuil simplifié et taux TVA absent.

    Règle fiscale : au-dessus de 150 € TTC, l'art. 242 nonies A ann. II du
    CGI exige une mention explicite du taux et du montant de TVA pour
    ouvrir droit à déduction. Une facture validée dans ce cas sans taux
    renseigné est donc rétrogradée en « à réviser » — l'utilisateur doit
    décider : réclamer une facture conforme ou accepter la non-déduction.

    Court-circuité pour les profils qui ne déduisent pas la TVA de toute
    façon (auto-entrepreneur en franchise, salarié), la règle n'apporte
    rien et bruiterait le workflow.
    """
    if not FISCAL_RULES.get(profil_fiscal, {}).get("tva_déductible", False):
        return None
    ttc = fields.get("montant_ttc", current.get("montant_ttc"))
    taux = fields.get("taux_tva", current.get("taux_tva"))
    if ttc is None or taux is not None:
        return None
    if ttc < SEUIL_TVA_SIMPLIFIEE_EUR:
        return None
    return (
        f"TTC ≥ {SEUIL_TVA_SIMPLIFIEE_EUR:.0f} € sans taux TVA — "
        "TVA non déductible sans mention explicite, item retourné en « À réviser »."
    )


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

    # `catégorie` doit appartenir au référentiel défini dans Paramètres ›
    # Catégories TVA (table category_tva_rates). Le <select> du dashboard
    # rend cette contrainte évidente côté UI ; on la confirme ici contre
    # les soumissions falsifiées ou les anciennes valeurs orphelines.
    if fields.get("catégorie"):
        from db import get_category_tva_rates
        if fields["catégorie"] not in get_category_tva_rates(conn):
            errors["catégorie"] = (
                f"Catégorie inconnue : « {fields['catégorie']} ». "
                "Enregistrez-la dans Paramètres › Catégories TVA avant utilisation."
            )

    # Mention légale française §7.2 AUTO_ENTREPRENEUR_RULES.md : toute pièce
    # émise par l'utilisateur (facture ou avoir émis) doit porter un numéro
    # séquentiel sans rupture. Pas de contrainte pour les pièces reçues
    # (charges), dont le numéro reste informatif.
    type_doc = fields.get("type_document") or current.get("type_document")
    if type_doc in EMITTED_DOC_TYPES:
        num = fields.get("numéro_facture") or current.get("numéro_facture")
        if not num:
            errors["numéro_facture"] = (
                "Numéro de facture requis pour les pièces émises"
            )

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
