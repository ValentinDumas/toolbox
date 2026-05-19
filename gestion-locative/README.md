# Gestion locative

Logiciel de gestion locative **local-first**, **mono-utilisateur**, pour un propriétaire bailleur particulier qui gère son administratif et ses biens immobiliers en autonomie — sans cloud obligatoire, sans délégation, sans multi-utilisateur. V1 ciblée : **LMNP en location meublée longue durée**.

> Vision détaillée : [VISION.md](VISION.md). PRD complet : [LOGICIEL_GESTION_LOCATIVE.md](LOGICIEL_GESTION_LOCATIVE.md).

## Architecture

DDD hexagonal strict — le domaine est pur (aucun import infrastructure / web / ORM). Ports définis dans le domaine, implémentés par les adapters.

**Bounded contexts identifiés** (cf. [practices/DDD.md](practices/DDD.md)) :

| Context | Statut | Responsabilité | Agrégats principaux |
|---|---|---|---|
| Patrimoine | V1 | Biens, lots, diagnostics (DPE, gaz, élec, ERP) | `Bien`, `Lot`, `Diagnostic` |
| Locatif | V1 | Locataires, baux meublés, EDL, indexation IRL | `Bail`, `Locataire`, `EtatDesLieux`, `BailIndexation` |
| Encaissements | V1 | Échéances, paiements, quittances, relances | `EcheanceLoyer`, `Encaissement`, `Quittance`, `Relance` |
| **Documents** (Phase 4) | V1 | Coffre documentaire, soft-delete + rétention 10 ans | `Justificatif` |
| **Travaux** (Phase 4) | V1 | Tickets travaux, pièces jointes N:N | `TicketTravaux` |
| Fiscalité | Phase 5 | Régimes (micro-BIC / réel), liasse 2031, plus-value | `DeclarationAnnuelle`, `RegimeFiscal` |

## Stack

- **Langage / runtime** : TypeScript strict, Node 22 LTS
- **Web** : Fastify 5 + `@fastify/view` (EJS) + Pico.css (UI sobre, WCAG 2.1 AA)
- **Persistance** : SQLite via `better-sqlite3` + Kysely (typed queries, migrations SQL versionnées)
- **Domaine** : `@js-temporal/polyfill` pour les dates (PlainDate, deterministic via Clock port)
- **Validation** : Zod côté HTTP (défense en profondeur avec invariants domaine)
- **Tests** : Vitest (unit + integration) + Cucumber.js (BDD outside-in)
- **Fichiers** : `sharp` (conversion HEIC → JPEG) + `@fastify/multipart` (upload)
- **Documents** : `pdfmake` (génération PDF)

## Features V1

| Phase | Statut | Périmètre |
|---|---|---|
| Phase 1 — Activation | Complete | Bien / Locataire / Bail (wizard 3 étapes), diagnostics, EDL, indexation IRL (LOC-04) |
| Phase 2 — Quittancement | Complete | Échéances mensuelles, encaissements (avec compensateurs), quittances PDF, relances |
| Phase 3 — Conformité du bail | Complete | EDL contradictoire, mobilier décret 2015-981, gel DPE F/G, révision IRL |
| **Phase 4 — Coffre & Travaux** | Complete | DOC-01 upload Justificatif + DOC-02 recherche facettée + DOC-03 rétention 10 ans (hard-block purge) + INC-01 tickets travaux avec PJ N:N |
| Phase 5 — Fiscalité | Planned | Brouillon liasse 2031, amortissement par composant, micro-BIC / réel, CFE, plus-value LF 2025 |
| Phase 6 — Dashboard & alertes | Planned | Impayés, échéances, notifications J-30 / J-7 (CFE, IRL, diagnostics) |

## Routes web

### Phase 4 — Coffre documentaire (DOC-01 + DOC-02 + DOC-03)

| Méthode | URL | Description |
|---|---|---|
| GET | `/coffre` | Liste filtrée du coffre (search + bien + locataire + année + type, pagination 20) |
| GET | `/coffre/upload` | Formulaire upload |
| POST | `/coffre/upload` | Upload Justificatif (multipart, PDF / JPG / PNG / HEIC / WebP, max 50 Mo, magic-bytes validés, HEIC converti JPEG) |
| GET | `/coffre/corbeille` | Liste soft-deleted + restaurer + purger conditionnelle (gate 10 ans D-109) |
| GET | `/justificatifs/:id` | Fiche détail |
| GET | `/justificatifs/:id/fichier` | Download du fichier physique |
| GET | `/justificatifs/:id/modifier` | Formulaire édition metadata (titre, type, date, montant, notes — fichier immutable) |
| POST | `/justificatifs/:id/modifier` | Persister édition metadata |
| POST | `/justificatifs/:id/corbeille` | Soft-delete |
| POST | `/justificatifs/:id/restaurer` | Restauration depuis corbeille |
| POST | `/justificatifs/:id/purger` | Hard-delete (refusé avant 10 ans — D-109 hard-block + verbatim UI-6.2) |

### Phase 4 — Travaux (INC-01)

| Méthode | URL | Description |
|---|---|---|
| GET | `/biens/:id/travaux` | Liste des tickets travaux d'un Bien |
| GET | `/travaux/nouveau?bienId=:id` | Formulaire création |
| POST | `/biens/:id/travaux` | Créer un ticket (titre / description / dateOuverture / coutEstime?) |
| GET | `/travaux/:id` | Fiche ticket (méta + PJ + clôture inline) |
| POST | `/travaux/:id/clore` | Transition vers statut `clos` (date + coût réel obligatoires) |
| POST | `/travaux/:id/annuler` | Soft-delete ticket (annule_le + raison) |
| POST | `/travaux/:id/justificatifs` | Ajouter PJ — dual-mode : upload nouveau Justificatif OU attach existant (cohérence bienId vérifiée) |
| POST | `/travaux/:id/justificatifs/:jid/delier` | Retirer une PJ du ticket (D-113 cascade asymétrique — le Justificatif reste) |

## Stockage local

Les fichiers physiques (PDF, images converties JPEG, quittances) sont stockés sous :

```
~/Library/Application Support/gestion-locative/documents/justificatifs/{annee}/{id}-{slug}.{ext}
```

(macOS — chemin équivalent sous Linux/Windows.) Le dossier de stockage est configurable via `GESTION_LOCATIVE_DATA_DIR`.

La base SQLite est stockée à part :

```
~/Library/Application Support/gestion-locative/db.sqlite
```

## Dépendances système

Certaines fonctionnalités reposent sur des bibliothèques natives non installées par `pnpm install`.

### Conversion HEIC → JPEG

La conversion HEIC (photos iPhone) en JPEG côté serveur (D-105) utilise `sharp` → `libvips` → `libheif`. Sur macOS (Homebrew) et la plupart des distributions Linux, `libheif` est livré **sans** plugin de décodage HEVC par défaut.

**macOS (Homebrew) :**

```bash
brew install libheif libde265
```

**Debian / Ubuntu :**

```bash
sudo apt install libheif1 libheif-dev libde265-0
```

**Fedora / RHEL :**

```bash
sudo dnf install libheif libheif-devel libde265
```

Si ces dépendances sont absentes, l'upload d'un HEIC retournera **HTTP 503** avec un message indiquant la procédure d'installation.

Smoke test post-installation :

```bash
pnpm tsx -e "import sharp from 'sharp'; import fs from 'node:fs'; const buf = fs.readFileSync('/chemin/vers/photo.heic'); sharp(buf).jpeg().toBuffer().then(() => console.log('OK')).catch(e => console.error('KO:', e.message));"
```

Voir `RISKS.md` §R6.1 pour la mitigation détaillée et l'analyse de risque.

## Rétention légale

**10 ans** sur les justificatifs (art. L102 B + L169 LPF — exercices déficitaires LMNP).

La purge est bloquée tant que `today < creeLe + 10 ans` (gate stricte côté domaine : `Justificatif.peutEtrePurge(today)`). UI verbatim UI-6.2 : *« Conservation légale obligatoire jusqu'au {date}. Vous pourrez purger ce document à partir de cette date. »*. Le bouton « Purger définitivement » est rendu avec `aria-disabled="true"` + `title="Disponible le {date}"` avant l'échéance (WCAG 2.5.5 + 1.4.13).

La soft-delete (corbeille) est réversible librement — D-109 préserve la trace audit-friendly via `corbeille_le` + `raison_corbeille`.

## Commandes utiles

| Commande | Description |
|---|---|
| `pnpm dev` | Démarrage en mode watch (port 7878 par défaut) |
| `pnpm start` | Démarrage en mode standalone |
| `pnpm db:migrate` | Applique les migrations SQL (idempotent) |
| `pnpm build` | Compile TypeScript |
| `pnpm typecheck` | `tsc --noEmit` (lint type) |
| `pnpm lint` | ESLint sur `src` + `tests` |
| `pnpm lint:deps` | dependency-cruiser (gardes hexagonal architecture) |
| `pnpm test` | Vitest unit + integration |
| `pnpm test:bdd` | Cucumber.js BDD outside-in |
| `pnpm test:bdd --tags @phase4` | Exécute les scénarios Phase 4 uniquement (36 verts) |
| `pnpm test:cov` | Coverage v8 (100 % requis sur `src/domain/**`) |

## Tests

- **Unit + integration** : `pnpm vitest run` → 572 tests verts.
- **BDD** : `pnpm cucumber-js` → 111 scénarios verts (Phase 1/2/3 + Phase 4 = 36 scénarios `@phase4`).
- **Coverage** : 100 % sur `src/domain/**` (gate CI), ≥ 80 % global hors `main.ts` / EJS.

## Documents de référence

| Document | Rôle |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Instructions Claude par session (entrée projet) |
| [VISION.md](VISION.md) | Vision produit |
| [LOGICIEL_GESTION_LOCATIVE.md](LOGICIEL_GESTION_LOCATIVE.md) | PRD complet (cible, MVP, KPIs, roadmap) |
| [RISKS.md](RISKS.md) | Registre des risques fiscal / juridique / technique |
| [LMNP.md](LMNP.md) | Base de connaissances fiscales LMNP (CGI, BOFIP, seuils 2026) |
| [LOCATION_MEUBLEE_REGLES.md](LOCATION_MEUBLEE_REGLES.md) | Règles juridiques (loi 89, décret 2015-981, EDL) |
| [practices/DDD.md](practices/DDD.md) | Pratiques DDD (ubiquitous language, bounded contexts) |
| [practices/BDD_PRACTICES.md](practices/BDD_PRACTICES.md) | BDD outside-in (testing top priority) |
| [practices/SOFTWARE_CRAFTSMANSHIP.md](practices/SOFTWARE_CRAFTSMANSHIP.md) | SOLID, Clean Code, refactoring, mesures qualité |
| [practices/UI_DESIGN.md](practices/UI_DESIGN.md) | Gestalt, hiérarchie visuelle, design system 8 px |
| [practices/UX_DESIGN.md](practices/UX_DESIGN.md) | Hick / Fitts / Miller / Jakob / Doherty laws |
| [practices/ACCESSIBILITY.md](practices/ACCESSIBILITY.md) | WCAG 2.1 AA, ARIA, keyboard nav, contraste |
