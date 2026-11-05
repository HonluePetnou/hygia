# Guide utilisateur — HYGIA

Adresse (démonstration) : **http://localhost:3100**. Interface en français et en anglais (boutons
« Français / English » en haut de chaque écran). Données entièrement fictives.

## Se connecter

1. Saisir son adresse e-mail et son mot de passe, puis « Se connecter ».
2. Saisir le code à 6 chiffres de son application d'authentification (ou « Utiliser un code de secours »).
3. Première connexion : scanner le QR code, puis **noter ses codes de secours**.

La session vit dans la page : recharger ou ouvrir un lien ramène à la connexion, puis à la page demandée.
« Se déconnecter » se trouve en haut à droite (aussi dans le portail patient).

## Médecin, infirmier, agent administratif

| Je veux… | Où | Comment |
| --- | --- | --- |
| Voir ma journée | Accueil | Consultations du jour, alertes IA ouvertes, documents en cours |
| Trouver un patient | Patients | Par nom, IPP, ou en langage naturel (« diabétiques avec HbA1c > 8 % ») ; seuls les patients de mon équipe de soins apparaissent |
| Lire un dossier | Patients → nom | Résumé IA sourcé (à valider), chronologie, constantes, traitements, versions, accès au dossier, risque de réadmission |
| Poser une question au dossier | « Demander au copilote » (dossier) ou Copilote IA → choisir le patient | La réponse cite ses sources ; elle répond dans la langue de la question |
| Dicter une consultation | Dossier → « Dicter » | Le patient doit avoir accepté « Enregistrement des consultations » ; le brouillon est à **valider** : rien n'est enregistré sans validation, l'audio est supprimé |
| Importer un document | Importer un document | Glisser le fichier ; suivre les étapes ; valider ou rejeter chaque entité extraite |
| Traiter une alerte IA | Alertes IA | Lire le raisonnement et les sources ; accepter, accepter et notifier, ou rejeter (justification obligatoire) |
| Ouvrir un dossier hors de mon équipe | Lien du dossier → « Accès d'urgence » | Choisir le motif et préciser ; accès 4 h, la DPO est prévenue et le patient le voit |
| Fusionner deux dossiers | Patients → bandeau « Doublon probable » | Comparer champ par champ, choisir, fusionner (annulable) |

Application mobile (Expo) : liste des patients hors ligne, saisie des constantes, scribe, synchronisation
avec arbitrage des conflits.

## Analyste

Veille épidémiologique (`/epidemiologie`) : cas par pathologie, district et semaine ; foyers anormaux
(au-dessus de la moyenne + 2 écarts-types) ; données pseudonymisées uniquement.

## Patient (portail `/portail`)

- **Qui a vu mon dossier ?** : chaque accès (qui, quand, pourquoi), dont les accès d'urgence.
- **Mes consentements** : soins (obligatoire), IA, statistiques, enregistrement des consultations, rappels WhatsApp.
- **Mes droits** : télécharger son dossier (PDF), demander une rectification ou une suppression ; « Signaler » un accès anormal.

## DPO / auditeur (`/audit`)

Journal en lecture seule : acteur, action, ressource, motif, estampille de Lamport, hachage ; vérification
de la chaîne ; export CSV ; demandes des patients à traiter sous 30 jours.

## Administrateur

- **Administration** : comptes (invitation, rôle, réinitialisation 2FA, désactivation), équipes de soins.
- **Supervision** : état des services par zone, latence p95, expériences de pannes (couper une zone, arrêter
  une instance, injecter de la latence, modèle de langage indisponible).
