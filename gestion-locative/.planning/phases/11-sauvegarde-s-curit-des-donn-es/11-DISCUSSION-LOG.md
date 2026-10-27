# Phase 11: Sauvegarde & sécurité des données - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-27
**Phase:** 11-sauvegarde-s-curit-des-donn-es
**Areas discussed:** aucune en interactif — arbitrage délégué

---

## Sélection des zones

| Option | Description | Selected |
|--------|-------------|----------|
| Passphrase : saisie et cycle de vie | Écran web / trousseau / terminal ; oubli ; migration de la base en clair ; verrouillage | |
| Périmètre du chiffrement | `documents/` chiffré sur disque, dans l'archive, ou pas | |
| Sauvegarde : déclenchement et destination | Manuel vs planifié, dossier vs téléchargement, rétention, avant migration | |
| RGPD : effacement vs conservation | Anonymisation vs suppression, déclencheur, format note et registre | |

**User's choice:** « tranche tout »
**Notes:** toutes les zones tranchées par Claude, décisions D-01 à D-17 dans `11-CONTEXT.md`.

## Alternatives écartées par Claude

- Passphrase : trousseau OS (non cross-platform, reporté) ; saisie terminal (incompatible avec le binaire Phase 12) ; passphrase seule sans clé de secours (perte des données et des sauvegardes en cas d'oubli).
- Chiffrement : `documents/` chiffré sur disque (refonte de tous les adaptateurs de stockage, hors critères).
- Sauvegarde : dossier de destination saisi (hostile non-dev) ; sauvegarde planifiée (nouvelle capacité).
- RGPD : suppression physique du locataire (casse la conservation comptable légale).

## Claude's Discretion

Toutes les zones. Détails laissés au researcher/planner : KDF et paramètres, pilote SQLCipher, format de la clé de secours, placement de la page Sauvegarde, libellés.

## Deferred Ideas

Sauvegarde planifiée ; alerte « dernière sauvegarde » ; verrouillage auto/manuel ; changement volontaire de passphrase ; trousseau OS ; chiffrement de `documents/` au repos ; purge automatique à échéance de conservation.
