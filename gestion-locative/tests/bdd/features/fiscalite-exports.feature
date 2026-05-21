# language: fr
@fis-exports @phase5
Fonctionnalité: Export CSV et PDF des données fiscales LMNP (D-FIS-G5.3, RFC 6266)

  En tant que bailleur LMNP en régime réel
  Je veux télécharger mes données fiscales annuelles au format CSV et PDF
  Afin de les transmettre à mon expert-comptable

  Contexte:
    Soit un bailleur LMNP avec une déclaration annuelle 2026 clôturée en régime réel

  Scénario: Téléchargement CSV — contient recettes, charges, dotation, résultat, verdict
    Quand le bailleur télécharge le CSV de la déclaration 2026
    Alors le CSV contient une ligne "Recettes annuelles"
    Et le CSV contient une ligne "Dotation amortissement"
    Et le CSV contient une ligne "ARD généré"
    Et le CSV contient une ligne "Résultat fiscal"
    Et le CSV contient une ligne "Statut LMNP/LMP"
    Et le CSV commence par le caractère UTF-8 BOM pour compatibilité Excel

  Scénario: Téléchargement PDF — contient identité bailleur et verdict tri-état
    Quand le bailleur télécharge le PDF de la déclaration 2026
    Alors le buffer PDF commence par "%PDF-"
    Et le buffer PDF a une taille supérieure à 1000 octets

  Scénario: Content-Disposition RFC 6266 avec nom de fichier encodé UTF-8
    Quand le bailleur télécharge le CSV de la déclaration 2026 via HTTP
    Alors la réponse contient le header Content-Disposition avec filename*=UTF-8''
    Et le nom de fichier est "declaration-fiscale-2026.csv"
