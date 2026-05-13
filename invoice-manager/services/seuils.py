"""
services/seuils.py — Détection des seuils réglementaires AE.

Couvre les deux familles de seuils :
- plafonds micro-entreprise (§2) : sortie du régime si dépassés deux années
  consécutives ;
- seuils franchise en base TVA (§5.2) : bascule à la TVA si dépassement du
  seuil majoré ou dépassement du seuil simple deux années consécutives.

Service pur : pas de DB, pas de Flask. L'appelant fournit les CA agrégés.
"""
from __future__ import annotations

from constants import (
    PLAFOND_CA_AE_2026,
    SEUIL_ALERTE_CA,
    SEUIL_DEPASSEMENT_CA,
    SEUIL_FRANCHISE_TVA_2026,
)

# ── Plafonds micro-entreprise ─────────────────────────────────────────────────

STATUT_PLAFOND_OK            = "ok"
STATUT_PLAFOND_ALERTE        = "alerte"
STATUT_PLAFOND_DEPASSEMENT   = "dépassement"


def evaluer_plafond_ca(
    ca_vente: float = 0.0,
    ca_services: float = 0.0,
    activite: str | None = None,
) -> dict:
    """Évalue où se situe le CA par rapport au plafond micro.

    Activité simple (`activite` ∈ ACTIVITES_AE) : un seul plafond.
    Activité mixte (`activite=None` ou "mixte") : plafond global vente +
    sous-plafond services (§2). Statut renvoyé = pire des deux.

    Retour : {
        "statut": "ok" | "alerte" | "dépassement",
        "details": [ {"libellé", "ca", "plafond", "ratio", "statut"}, ... ],
    }
    """
    details = []

    def _statut(ratio: float) -> str:
        if ratio >= SEUIL_DEPASSEMENT_CA:
            return STATUT_PLAFOND_DEPASSEMENT
        if ratio >= SEUIL_ALERTE_CA:
            return STATUT_PLAFOND_ALERTE
        return STATUT_PLAFOND_OK

    if activite and activite != "mixte":
        plafond = PLAFOND_CA_AE_2026.get(activite)
        if plafond is None:
            raise ValueError(f"Activité inconnue pour plafond CA : {activite!r}")
        ca = ca_vente + ca_services
        ratio = ca / plafond if plafond else 0.0
        details.append({
            "libellé": activite, "ca": ca, "plafond": plafond,
            "ratio": ratio, "statut": _statut(ratio),
        })
    else:
        # Mixte : plafond global (somme des deux CA) + sous-plafond services.
        ca_total = ca_vente + ca_services
        p_global = PLAFOND_CA_AE_2026["mixte_global"]
        p_serv = PLAFOND_CA_AE_2026["mixte_services"]
        details.append({
            "libellé": "global (vente + services)",
            "ca": ca_total, "plafond": p_global,
            "ratio": ca_total / p_global, "statut": _statut(ca_total / p_global),
        })
        details.append({
            "libellé": "sous-plafond services",
            "ca": ca_services, "plafond": p_serv,
            "ratio": ca_services / p_serv, "statut": _statut(ca_services / p_serv),
        })

    ordre = [STATUT_PLAFOND_OK, STATUT_PLAFOND_ALERTE, STATUT_PLAFOND_DEPASSEMENT]
    pire = max(details, key=lambda d: ordre.index(d["statut"]))["statut"]
    return {"statut": pire, "details": details}


# ── Franchise en base TVA ─────────────────────────────────────────────────────

STATUT_TVA_FRANCHISE_OK              = "franchise_ok"
STATUT_TVA_SEUIL_FRANCHI             = "seuil_franchi_attention"
STATUT_TVA_SEUIL_MAJORE_FRANCHI      = "seuil_majore_franchi"
STATUT_TVA_SORTIE_RECOMMANDEE        = "sortie_de_franchise_recommandee"


def evaluer_franchise_tva(historique_ca: dict[int, float], activite: str) -> dict:
    """Évalue la franchise TVA d'un AE pour l'année la plus récente.

    `historique_ca` : {année: ca_total}. La fonction inspecte l'année max +
    l'année précédente pour appliquer la règle des deux années consécutives
    (§5.2).

    Règles :
    - CA année courante > seuil majoré → sortie immédiate (effet le mois
      du dépassement, mais on remonte un signal `seuil_majore_franchi`).
    - CA N et CA N-1 tous deux > seuil simple → `sortie_de_franchise_recommandee`
      pour l'année N+1.
    - CA année courante > seuil simple (sans antécédent) → avertissement
      `seuil_franchi_attention`.
    - Sinon `franchise_ok`.

    Retour : {"statut", "annee", "ca", "seuil", "seuil_majore"}.
    """
    if not historique_ca:
        return {"statut": STATUT_TVA_FRANCHISE_OK, "annee": None, "ca": 0.0,
                "seuil": None, "seuil_majore": None}

    seuils = SEUIL_FRANCHISE_TVA_2026.get(activite)
    if seuils is None:
        raise ValueError(f"Activité inconnue pour seuils TVA : {activite!r}")

    annee = max(historique_ca.keys())
    ca_n = historique_ca[annee]
    ca_n_1 = historique_ca.get(annee - 1, 0.0)

    if ca_n > seuils["seuil_majore"]:
        statut = STATUT_TVA_SEUIL_MAJORE_FRANCHI
    elif ca_n > seuils["seuil"] and ca_n_1 > seuils["seuil"]:
        statut = STATUT_TVA_SORTIE_RECOMMANDEE
    elif ca_n > seuils["seuil"]:
        statut = STATUT_TVA_SEUIL_FRANCHI
    else:
        statut = STATUT_TVA_FRANCHISE_OK

    return {
        "statut": statut, "annee": annee, "ca": ca_n,
        "seuil": seuils["seuil"], "seuil_majore": seuils["seuil_majore"],
    }
