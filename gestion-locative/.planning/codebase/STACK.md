# STACK — Planning state

> **État** : pré-code, stack non décidée.
> Mapping dérivé des docs `.md` existantes. À régénérer une fois la stack choisie.

## Décidé

- **Persistance** : SQLite locale (cohérent avec local-first single-user — cf. [VISION.md](../../VISION.md)).
- **Déploiement** : local, mono-utilisateur, pas de cloud obligatoire.
- **Couche fiscale** : règles **versionnées** par exercice (cf. [RISKS.md R1.1](../../RISKS.md)).

## À décider

| Couche | Options | Choix |
|---|---|---|
| Langage cœur | Python · TypeScript · Rust | **non décidé** |
| Runtime UI | Desktop (Electron / Tauri / Egui) · Web local (FastAPI + frontend) · CLI | **non décidé** |
| Test runner | pytest · vitest · cargo test | dépend du langage |
| BDD framework | pytest-bdd · cucumber-js · cucumber-rs | dépend du langage |
| Property-based | hypothesis · fast-check · proptest | dépend du langage |
| OCR | Tesseract · Donut · service hébergé | **non décidé** |
| Génération PDF | reportlab · weasyprint · pdf-lib · typst | dépend du langage |
| ORM ou raw SQL | aucune dépendance interdite dans le domaine | adapter only |

## Contraintes structurantes

- **Domaine pur** : aucun import technique dans `domain/` ([DDD.md §5](../../DDD.md)).
- **Linter** : zéro warning ([SOFTWARE_CRAFTSMANSHIP.md §8](../../SOFTWARE_CRAFTSMANSHIP.md)).
- **Couverture** : ≥ 80 % global, **100 % logique fiscale**.
- **Suite unit ≤ 30 s**, totale ≤ 2 min, **0 flaky**.

## Mise à jour

À régénérer dès que la stack est figée (probablement après sprint 0 / spike).
