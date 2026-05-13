# PRD — Logiciel de gestion locative

> Product Requirements Document · 2026-05-13
> Voir [VISION.md](VISION.md) pour la vision produit.

## 1. Cible

Propriétaires bailleurs gérant **eux-mêmes** un ou plusieurs biens :

- particuliers en LMNP (priorité V1),
- SCI familiales,
- petits portefeuilles (1 à 10 lots).

**Hors cible** : agences immobilières, gestionnaires délégués, foncières professionnelles.

Besoin partagé : un outil simple pour **suivre loyers, documents, locataires, échéances**, sans passer par une structure humaine qui prend la responsabilité complète.

## 2. Problèmes utilisateurs

- Temps perdu sur les tâches répétitives : quittances, relances, indexation IRL, archivage des baux, suivi des charges, gestion des incidents.
- Manque de **visibilité temps réel** sur l'état des paiements, des documents à jour et des actions en attente.
- Risque d'oublis et erreurs administratives, multipliés en multi-biens.
- Absence d'un **point central** pour préparer la déclaration fiscale (2031 LMNP, 2042 C PRO).
- Difficulté à anticiper la **plus-value** à la cession (amortissements pratiqués cumulés depuis la LF 2025).

## 3. Promesse

Rendre la gestion locative **plus simple, plus fiable, plus autonome** — sans remplacer le bailleur dans sa responsabilité.

Valeur clé : **gain de temps avec meilleur contrôle**. Pas de délégation complète.

## 4. Périmètre MVP

| Module | Détail |
|---|---|
| Biens et lots | Créer / éditer / supprimer un bien, ses lots, ses diagnostics. |
| Locataires et baux | Fiche locataire, bail, échéances, indexation IRL automatique. |
| Quittances & avis d'échéance | Génération PDF, modèles, envoi mail ou dépôt local. |
| Suivi des loyers | Encaissements, retards, rapprochement bancaire manuel. |
| Relances | Modèles courriels, étapes (amiable → mise en demeure). |
| Documents | Dépôt et consultation (bail, EDL, factures, tickets). |
| Tableau de bord | Synthèse paiements, actions en retard, échéances à venir. |
| Incidents / travaux | Ticket basique avec pièces jointes et coût. |
| Notifications | Rappels d'échéances clés (loyer, taxe foncière, CFE, révision IRL). |
| Centralisation fiscale LMNP | Agrégation recettes / charges, préparation de la liasse 2031. |

## 5. Hors périmètre

- Mise en location (annonces, visites, sélection de dossier).
- Rédaction de bail "assistée" complexe (au-delà d'un modèle pré-rempli).
- État des lieux dynamique avec photos guidées et signatures.
- Contentieux et procédures juridiques.
- Prise en charge humaine des urgences.
- Comptabilité d'agence (multi-utilisateur, séquestre, mandats).
- Cashflow prévisionnel multi-scénarios.

## 6. Principes UX

- **Une question par écran** : « qui doit payer quoi ? », « qu'est-ce qui est en retard ? ».
- **Actions en peu d'étapes**, modèles prêts à l'emploi.
- **Statuts clairs** : à jour / en retard / à venir / archivé.
- **Hiérarchie visuelle forte** : l'urgent saute aux yeux.
- **Rassurant** : intuitif et stable, compréhensible sans expertise technique.

## 7. KPIs

| Catégorie | Indicateur |
|---|---|
| Activation | Création d'au moins 1 bien + 1 locataire + 1 bail dans la première session |
| Usage | Fréquence d'utilisation mensuelle |
| Adoption | Nombre de biens gérés |
| Productivité | Temps moyen pour accomplir une tâche clé (quittance, relance) |
| Fiabilité | Taux de documents générés / taux de relances déclenchées |
| Rétention | Rétention J30 / J90 |
| Complétude | Taux de complétude des dossiers locatifs (bail + EDL + DPE) |

Bon signal produit : retour **mensuel** pour le suivi loyers et échéances, sans support excessif.

## 8. Vision produit

> Permettre aux bailleurs de gérer leurs locations de manière autonome en automatisant l'administratif récurrent, en centralisant les informations et en réduisant le risque d'oubli.

- **Différenciation** : outil de pilotage simple, **pas service de délégation**.
- **Succès attendu** : moins de temps passé sur la gestion courante, plus de fiabilité documentaire, meilleure visibilité sur le portefeuille.

## 9. Roadmap MVP proposée

1. **Sprint 1** — Socle : biens, lots, locataires, baux, schéma SQLite, exports CSV.
2. **Sprint 2** — Quittances et avis d'échéance : PDF, modèles, envoi.
3. **Sprint 3** — Suivi des loyers : encaissements, retards, rapprochement.
4. **Sprint 4** — Documents : upload, OCR factures/tickets, tagging.
5. **Sprint 5** — Tableau de bord + notifications.
6. **Sprint 6** — Préparation fiscale LMNP : agrégation, tableau d'amortissement, export vers liasse 2031.

## 10. Références d'inspiration

- [Manda](https://www.manda.fr/gestion-locative/en-ligne) — gestion en ligne avec délégation humaine.
- [Rentila](https://www.rentila.com/blog/2025/12/meilleur-logiciel-de-gestion-locative/) — logiciel de gestion pour bailleurs.
- [ImmobilierLoyer](https://www.immobilierloyer.com/pour-qui.php) — segmentation des bailleurs.
- [Reassurez-moi](https://reassurez-moi.fr/guide/partenaires/manda) — positionnement délégation.

Notre positionnement : **outil local, autonome, focalisé LMNP — pas service délégué.**
