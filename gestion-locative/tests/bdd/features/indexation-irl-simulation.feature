# language: fr
@loc-04 @phase3
Fonctionnalité: Simulation IRL — banner anniversaire + wizard saisie + calcul (LOC-04)

  Contexte:
    Etant donné l'application est prête pour LOC-04 avec clock fixe "2026-05-15"

  Scénario: Banner révision IRL apparaît sur la fiche Bail à l'anniversaire
    Etant donné un Bien LOC-04 avec DPE "D"
    Et un Bail LOC-04 actif avec date_debut "2025-05-01" loyer_hc 800 irl_ref "2024-T4"/142.06
    Quand le bailleur ouvre la fiche du Bail
    Alors la page contient "Révision IRL disponible"
    Et la page contient "Lancer la révision IRL"

  Scénario: Banner absent avant l'anniversaire
    Etant donné un Bien LOC-04 avec DPE "D"
    Et un Bail LOC-04 actif avec date_debut "2026-01-01" loyer_hc 800 irl_ref "2024-T4"/142.06
    Quand le bailleur ouvre la fiche du Bail
    Alors la page LOC-04 ne contient PAS "Révision IRL disponible"

  Scénario: Wizard simulation — calcul correct avec arrondi banker
    Etant donné un Bien LOC-04 avec DPE "D"
    Et un Bail LOC-04 actif avec date_debut "2025-05-01" loyer_hc 800 irl_ref "2024-T4"/142.06
    Quand le bailleur soumet POST /baux/:id/indexer/simuler avec irl_trimestre="2025-T4" irl_valeur="145.47"
    Alors la page LOC-04 contient "819,20"
    Et la page LOC-04 contient "145.47"
    Et la page LOC-04 contient "142.06"
