# language: fr
@a11y-phase3 @phase3
Fonctionnalité: Accessibilité WCAG 2.1 AA Phase 3 (plan 03-05)

  Audit a11y end-to-end : navigation clavier wizard IRL, focus management
  gel-loyer, fieldset/legend mobilier, sidebar aria-current="page" actif.

  Contexte:
    Etant donné l'application a11y-phase3 est prête avec clock fixe "2026-05-15"

  Scénario: Navigation clavier wizard IRL — inputs et boutons natifs
    Etant donné un Bien a11y-phase3 avec DPE "D"
    Et un Bail a11y-phase3 indexable date_debut "2025-05-01" loyer_hc 800 irl_ref "2024-T4"/142.06
    Quand le bailleur ouvre GET /baux/:id/indexer (a11y-phase3)
    Alors la page a11y-phase3 contient l'input id="irl_trimestre"
    Et la page a11y-phase3 contient au moins un <button type="submit"> natif

  Scénario: Focus management gel-loyer — role=alert + autofocus + tabindex=-1
    Etant donné un Bien a11y-phase3 avec DPE "F"
    Et un Bail a11y-phase3 indexable date_debut "2025-05-01" loyer_hc 800 irl_ref "2024-T4"/142.06
    Quand le bailleur ouvre GET /baux/:id/indexer (a11y-phase3)
    Alors le bloc a11y-phase3 role="alert" contient autofocus et tabindex="-1"
    Et la page a11y-phase3 contient aria-live="assertive"

  Scénario: Fieldset/legend mobilier sur formulaire EDL entrée
    Etant donné un Bien a11y-phase3 avec DPE "D"
    Et un Bail a11y-phase3 indexable date_debut "2025-05-01" loyer_hc 800 irl_ref "2024-T4"/142.06
    Quand le bailleur ouvre GET /baux/:id/edl/entree/nouveau (a11y-phase3)
    Alors la page a11y-phase3 contient un <fieldset> avec <legend>Inventaire mobilier (décret 2015-981) — 12 items obligatoires</legend>

  Scénario: Sidebar active state sur diagnostics
    Etant donné un Bien a11y-phase3 avec DPE "D"
    Quand le bailleur ouvre GET /biens/:id/diagnostics/nouveau (a11y-phase3)
    Alors le lien sidebar "Biens" porte aria-current="page"
