# Scénario de démonstration HYGIA

Toutes les données sont fictives. Lancer la démo : `pnpm install` puis `pnpm demo` (voir le README).
Le script affiche l'URL à ouvrir, **http://localhost:3100**, et le code 2FA de démo, **`481516`**.

Services : `dossiers` sur le port 3001, `ia-clinique` sur le port 3003 (documentation OpenAPI sur `/docs`).
Sans Docker, le script passe en mode hors ligne (`NEXT_PUBLIC_DEMO_OFFLINE=1`) : le web utilise alors des
données en mémoire et n'appelle pas les services.

## Déroulé

1. **Connexion 2FA** — ouvrir `/connexion`, saisir `481516` dans les 6 cases : redirection vers le tableau de bord.
2. **Tableau de bord** — indicateurs, consultations du jour, alertes par gravité, documents en cours. Bascule FR/EN en haut à droite.
3. **Dossier de Florence Ngo Bassa** (IPP `HYG-2024-00871`) — `/patients`, rechercher « Florence » et ouvrir le dossier.
   Le résumé IA signale l'**interaction warfarine + ibuprofène** (ordonnance du 28/10) ; les sources sont numérotées.
4. **Copilote avec sources** — depuis le dossier, ouvrir le copilote et demander : « Florence prend-elle de l'ibuprofène ? ».
   La réponse arrive mot à mot et cite l'ordonnance ; cliquer une source ouvre le panneau du passage.
5. **Question en anglais** — « What did the echocardiography show? » : la réponse est en anglais, le badge « Répondu en… »
   apparaît si la langue diffère de l'interface, et le compte rendu du 03/06 (FEVG 45 %) est cité.
6. **Import de l'ordonnance** — `/import`, déposer un fichier : les 5 étapes de la chaîne s'enchaînent, les entités extraites
   sont à valider ou à rejeter par le soignant (rien n'est enregistré sans validation).
7. **Journal des accès et bris de glace** — l'écran web du journal d'audit n'existe pas encore (tâche 021). Le journal du dossier
   se consulte via l'API (voir ci-dessous). Dans le web, un utilisateur hors équipe de soins voit « accès refusé » et le bouton
   « Accès d'urgence » ouvre la fenêtre de bris de glace (motif obligatoire, 4 h, DPO prévenu).

## Journal des accès par l'API (étape 7)

Mode avec services (sans `NEXT_PUBLIC_DEMO_OFFLINE`). Identités simulées par en-têtes.

```bash
F=00000000-0000-4000-8000-030000000001   # Florence

# Dr Paul Kamga (hors équipe de soins) ouvre un bris de glace
curl -X POST -H 'content-type: application/json' \
  -H 'x-user-id: 00000000-0000-4000-8000-020000000003' -H 'x-user-role: medecin' \
  -d '{"motif":"urgence vitale"}' http://localhost:3001/patients/$F/bris-de-glace

# Dr Aïcha Nana (équipe de soins) consulte le journal : le motif du bris de glace y figure
curl -H 'x-user-id: 00000000-0000-4000-8000-020000000001' -H 'x-user-role: medecin' \
  http://localhost:3001/patients/$F/acces
```

Chaque entrée porte l'acteur, l'action, le motif, un compteur de Lamport et un hachage chaîné.

## Ce qui est simulé

- Authentification : en-têtes `x-user-id` / `x-user-role` (le broker et le service d'identité arrivent ensuite).
- Modèle de langage : implémentation `mock` derrière `ClinicalLanguageModel` (Bedrock ensuite) ; il ne répond qu'à partir des passages retrouvés.
- Données : en mémoire, rien n'est conservé après l'arrêt.
