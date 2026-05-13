"""
services/urssaf.py — Calculs URSSAF auto-entrepreneur.

Service de domaine pur : pas de DB, pas de Flask. Convertit un CA encaissé
et une activité en cotisations sociales + CFP, conformément à
AUTO_ENTREPRENEUR_RULES.md §4.1 + §4.3.

Le module ne gère ni la persistance des déclarations (cf. #133) ni
l'export du récapitulatif (cf. #134) — uniquement les règles de calcul,
testables en isolation.
"""
from __future__ import annotations

import calendar
import sqlite3
from datetime import date, datetime

from constants import (
    ABATTEMENT_AE_2026,
    ABATTEMENT_MINIMUM_EUR,
    TAUX_URSSAF_AE_2026,
    TAUX_VFL_AE_2026,
)

# Cadences URSSAF supportées (cf. AUTO_ENTREPRENEUR_RULES.md §4.2).
CADENCE_MENSUELLE     = "mensuelle"
CADENCE_TRIMESTRIELLE = "trimestrielle"

STATUT_PERIODE_A_DECLARER = "à_déclarer"
STATUT_PERIODE_DECLAREE   = "déclarée"


def _last_day(year: int, month: int) -> date:
    return date(year, month, calendar.monthrange(year, month)[1])


def generate_periods(year: int, cadence: str) -> list[dict]:
    """Liste les périodes URSSAF d'une année selon la cadence du profil.

    Règle métier AUTO_ENTREPRENEUR_RULES.md §4.2 :
    - mensuelle : 12 périodes, déclaration/paiement = dernier jour du mois
      *suivant* l'encaissement (CA janvier → déclaré fin février).
    - trimestrielle : 4 périodes, échéances 30/04, 31/07, 31/10, 31/01 N+1.

    Retour : liste de dicts `{period_key, label, start, end, deadline}` triés
    chronologiquement. `period_key` est l'identifiant stable utilisé en DB.
    """
    if cadence == CADENCE_MENSUELLE:
        periods = []
        mois_fr = ["", "janvier", "février", "mars", "avril", "mai", "juin",
                   "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
        for month in range(1, 13):
            start = date(year, month, 1)
            end = _last_day(year, month)
            # Échéance = dernier jour du mois suivant l'encaissement.
            if month == 12:
                deadline = _last_day(year + 1, 1)
            else:
                deadline = _last_day(year, month + 1)
            periods.append({
                "period_key": f"{year:04d}-M{month:02d}",
                "label": f"{mois_fr[month].capitalize()} {year}",
                "start": start.isoformat(),
                "end": end.isoformat(),
                "deadline": deadline.isoformat(),
            })
        return periods

    if cadence == CADENCE_TRIMESTRIELLE:
        deadlines = {
            1: date(year, 4, 30),
            2: date(year, 7, 31),
            3: date(year, 10, 31),
            4: date(year + 1, 1, 31),
        }
        periods = []
        for tr in range(1, 5):
            month_start = (tr - 1) * 3 + 1
            month_end = month_start + 2
            start = date(year, month_start, 1)
            end = _last_day(year, month_end)
            periods.append({
                "period_key": f"{year:04d}-T{tr}",
                "label": f"T{tr} {year}",
                "start": start.isoformat(),
                "end": end.isoformat(),
                "deadline": deadlines[tr].isoformat(),
            })
        return periods

    raise ValueError(f"Cadence URSSAF inconnue : {cadence!r}")


def get_declared_periods(conn: sqlite3.Connection) -> dict[str, str]:
    """Retourne {period_key: marked_at} pour toutes les périodes déclarées."""
    rows = conn.execute(
        "SELECT period_key, marked_at FROM urssaf_declarations"
    ).fetchall()
    return {row["period_key"]: row["marked_at"] for row in rows}


def mark_period_declared(
    conn: sqlite3.Connection, period_key: str, *, actor: str = "user",
) -> None:
    """Marque une période comme déclarée (transition d'état append-only)."""
    now = datetime.now().isoformat(timespec="seconds")
    conn.execute(
        "INSERT OR REPLACE INTO urssaf_declarations (period_key, marked_at, marked_by) "
        "VALUES (?, ?, ?)",
        (period_key, now, actor),
    )
    conn.commit()


def unmark_period_declared(conn: sqlite3.Connection, period_key: str) -> None:
    """Annule la déclaration d'une période (correction d'erreur de saisie)."""
    conn.execute(
        "DELETE FROM urssaf_declarations WHERE period_key=?", (period_key,)
    )
    conn.commit()


def compute_cotisations(
    ca: float,
    activite: str,
    *,
    acre_factor: float = 1.0,
) -> dict:
    """Calcule les cotisations URSSAF d'un auto-entrepreneur pour une période.

    Règle métier AUTO_ENTREPRENEUR_RULES.md §4.1 + §4.3 :
    - cotisations sociales = CA encaissé × taux activité
    - CFP                  = CA encaissé × taux CFP activité
    - ACRE                 = multiplie le taux cotisations sociales par
                             `acre_factor` (0,5 avant 01/07/2026, 0,75 après,
                             1,0 hors ACRE). Cf. §4.3.

    La CFP n'est **pas** réduite par l'ACRE — l'allègement vise les cotisations
    sociales contributives, pas la contribution formation professionnelle.

    Arguments :
        ca           : CA encaissé sur la période (≥ 0).
        activite     : clé de `TAUX_URSSAF_AE_2026` ("vente", "service_bic",
                       "service_bnc_ssi", "service_bnc_cipav",
                       "meuble_tourisme_classe").
        acre_factor  : multiplicateur du taux cotisations sociales (1.0 = hors
                       ACRE, 0.5 = exonération 50 %, 0.75 = exonération 25 %).

    Retour : {
        "cotisations_sociales": float,
        "cfp":                  float,
        "total":                float,
        "taux_cotisations_applique": float,
        "taux_cfp_applique":         float,
    }

    Lève KeyError si `activite` est inconnue — c'est intentionnel : le caller
    doit avoir validé la valeur depuis `ACTIVITES_AE` au préalable.
    """
    taux = TAUX_URSSAF_AE_2026[activite]
    taux_cot = taux["taux_cotisations"] * acre_factor
    taux_cfp = taux["taux_cfp"]

    cotisations = round(ca * taux_cot, 2)
    cfp = round(ca * taux_cfp, 2)

    return {
        "cotisations_sociales": cotisations,
        "cfp": cfp,
        "total": round(cotisations + cfp, 2),
        "taux_cotisations_applique": taux_cot,
        "taux_cfp_applique": taux_cfp,
    }


def acre_factor_for(profile: dict, period_end: str) -> float:
    """Retourne le facteur ACRE applicable à une période (§4.3).

    Règles 2026 :
    - profil sans ACRE actif         → 1.0 (taux normal)
    - période *après* acre_date_fin  → 1.0
    - sinon : 0.5 si l'ACRE a démarré avant le 01/07/2026, 0.75 sinon.

    On déduit la date de création de l'AE depuis `acre_date_fin` : la
    période d'exonération est de 12 mois civils (§4.3), donc création =
    date_fin − 12 mois (approximation suffisante pour décider du palier).

    `period_end` : borne ISO de la période évaluée (YYYY-MM-DD). Si la
    période chevauche acre_date_fin, on coupe au mois — ACRE s'applique
    aux périodes qui s'achèvent **au plus tard** à acre_date_fin.
    """
    if not profile.get("acre_actif"):
        return 1.0
    date_fin = profile.get("acre_date_fin")
    if not date_fin:
        return 1.0
    try:
        fin = date.fromisoformat(date_fin)
        end = date.fromisoformat(period_end)
    except ValueError:
        return 1.0
    if end > fin:
        return 1.0
    # Création = date_fin − 12 mois (approx année calendaire).
    creation_avant_juillet_2026 = fin <= date(2027, 6, 30)
    return 0.5 if creation_avant_juillet_2026 else 0.75


def compute_beneficie_imposable(ca: float, activite: str) -> dict:
    """Calcule la base IR d'un AE sans VFL (§3.1).

    Bénéfice = max(CA × (1 − abattement), CA − 305 €). Le min forfaitaire
    plafonne l'abattement quand le CA est très faible.

    Retour : {abattement_taux, abattement_montant, beneficie_imposable}.
    """
    taux = ABATTEMENT_AE_2026[activite]
    abattement_theorique = ca * taux
    abattement_applique = min(abattement_theorique, max(ca - ABATTEMENT_MINIMUM_EUR, 0.0))
    return {
        "abattement_taux": taux,
        "abattement_montant": round(abattement_applique, 2),
        "beneficie_imposable": round(ca - abattement_applique, 2),
    }


def compute_vfl(ca: float, activite: str) -> dict:
    """Calcule le versement libératoire de l'IR sur le CA encaissé (§3.2).

    Option à n'appliquer que si le profil a `versement_liberatoire=1`.
    Le VFL est prélevé en même temps que les cotisations URSSAF.

    Retour : {"vfl": float, "taux_applique": float}.
    """
    taux = TAUX_VFL_AE_2026[activite]
    return {"vfl": round(ca * taux, 2), "taux_applique": taux}
