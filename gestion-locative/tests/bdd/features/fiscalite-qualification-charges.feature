# language: fr
@fis-03 @phase5
Fonctionnalité: Qualification fiscale des charges LMNP (FIS-03)

  # Source juridique : D-FIS-G2.3 (ticket entier qualifie justificatifs liés)
  # D-FIS-G2.6 (decomposer Σ enfants = parent)
  # D-FIS-G2.8 (badge Sans PJ pour cheminFichier null ou manual)
  # D-FIS-G2.11 (rattachement par datePaiement, fallback dateDocument)

  Contexte:
    Etant donné l'application est prête pour la fiscalité LMNP avec clock fixe "2026-05-20"

  Scénario: Qualifier un justificatif individuel
    Etant donné un Bien "Appartement Paris" enregistré
    Et un Justificatif de type "facture" avec montant TTC 500 euros rattaché au bien "Appartement Paris"
    Quand l'utilisateur qualifie le justificatif en "entretien_reparation" via POST /fiscalite/qualification/justificatif/:id
    Alors le justificatif est qualifié "entretien_reparation"
    Et la qualification a été enregistrée en base de données

  Scénario: Qualifier un ticket entier propage la qualification à tous les justificatifs liés
    Etant donné un Bien "Appartement Paris" enregistré
    Et un TicketTravaux avec 2 justificatifs liés rattachés au bien "Appartement Paris"
    Quand l'utilisateur qualifie le ticket en "amelioration" via POST /fiscalite/qualification/ticket/:id
    Alors le ticket a natureFiscale "amelioration"
    Et les 2 justificatifs liés ont qualification_fiscale "amelioration"

  Scénario: Décomposer un justificatif avec Σ correct crée N enfants
    Etant donné un Bien "Appartement Paris" enregistré
    Et un autre Bien "Studio Lyon" enregistré
    Et un Justificatif de type "facture" avec montant TTC 1000 euros rattaché au bien "Appartement Paris"
    Quand l'utilisateur décompose le justificatif en 2 enfants de 600 et 400 euros
    Alors 2 enfants sont créés avec les bons montants
    Et le parent est qualifié "non_deductible"

  Scénario: La page S5 affiche le badge Sans PJ pour les justificatifs sans pièce jointe (D-FIS-G2.8)
    Etant donné un Bien "Appartement Paris" enregistré
    Et un Justificatif de type "facture" sans fichier joint rattaché au bien "Appartement Paris"
    Quand l'utilisateur accède à GET /fiscalite/qualification?annee=2026
    Alors la réponse contient le badge "Sans PJ"
