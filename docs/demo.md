# Scénario de démonstration HYGIA

Toutes les données sont fictives. Lancer la démo : `pnpm install` puis `pnpm demo` (voir le README).
Le script affiche l'URL à ouvrir, **http://localhost:3100**.

## Deux modes

|           | Mode services (par défaut, le vrai, réparti)                      | Mode hors ligne                                                   |
| --------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| Lancement | `pnpm demo`                                                       | `DEMO_MODE=offline pnpm demo` (PowerShell : `$env:DEMO_MODE="offline"; pnpm demo`) |
| Données   | Services répartis derrière le broker                              | Données en mémoire dans le web                                    |
| Connexion | Comptes ci-dessous, mot de passe `Hygia-demo-2026`, **TOTP réel** | Tout mot de passe, code 2FA **`481516`**                          |
| Code 2FA  | `pnpm --filter identite code` (code de secours : `DEMO-0001`)     | `481516`                                                          |

Docker n'est **pas** nécessaire : sans lui, les services gardent leurs données en mémoire. `DEMO_INFRA=1 pnpm demo`
(PowerShell : `$env:DEMO_INFRA="1"; pnpm demo`) démarre en plus PostgreSQL (port 54320) et LocalStack : les dossiers
patients deviennent **durables** (base `dossiers`, migrations appliquées au lancement) et survivent à un redémarrage.
Un échec de Docker n'arrête pas la démo : Dossiers repasse en mémoire.
Au premier lancement, `pnpm demo` compile les paquets internes (`@hygia/*`) : une à deux minutes. `Ctrl+C` arrête tout
(sous Windows aussi : l'arbre de processus est arrêté, les ports sont libérés).

La session web vit dans la page : recharger ou taper une URL renvoie à la connexion, qui ramène ensuite à la page
demandée. Pour changer de compte, « Se déconnecter » (le portail patient n'a pas ce bouton : revenir à
http://localhost:3100).

Services lancés en mode services : broker (3000), dossiers (3001), ia-clinique (3003), identité (3004),
audit (3005), agents Python (3007), notification (3008), synchronisation (3009), web (3100).
Le service Agents demande **Python 3** (bibliothèque standard seulement) ; sans Python, `pnpm demo` le signale
et la carte épidémiologique et le risque de réadmission sont indisponibles.

### Comptes de démonstration

| Profil                              | Courriel                           |
| ----------------------------------- | ---------------------------------- |
| Médecin (équipe de Florence)        | `aicha.nana@hd-bonassama.cm`       |
| Médecin hors équipe (bris de glace) | `paul.kamga@cma-bepanda.cm`        |
| Infirmière                          | `rose.mballa@hd-bonassama.cm`      |
| Agent administratif                 | `marthe.eyenga@hd-bonassama.cm`    |
| Analyste (carte épidémiologique)    | `analyste@hygia.local`             |
| Patiente (portail)                  | `florence.ngo@patient.hygia.local` |
| Administrateur système              | `admin@hygia.local`                |
| DPO / auditeur                      | `dpo@hygia.local`                  |

## Déroulé

1. **Connexion 2FA** : ouvrir `/connexion` avec le compte de Dr Aïcha Nana, saisir le code 2FA, puis redirection vers le tableau de bord.
2. **Tableau de bord** : indicateurs, consultations du jour, alertes par gravité, documents en cours. Bascule FR/EN en haut à droite.
3. **Dossier de Florence Ngo Bassa** (IPP `HYG-2024-00871`) : `/patients`, rechercher « Florence » et ouvrir le dossier.
   Le résumé IA signale l'**interaction warfarine + ibuprofène** (ordonnance du 28/10) ; les sources sont numérotées.
   Onglet Versions : historique des versions du dossier et des documents. Carte « risque de réadmission » (agents Python).
4. **Copilote avec sources** : depuis le dossier, ouvrir le copilote et demander « Florence prend-elle de l'ibuprofène ? ».
   La réponse arrive mot à mot et cite l'ordonnance ; cliquer une source ouvre le panneau du passage.
5. **Question en anglais** : « What did the echocardiography show? ». La réponse est en anglais, le badge « Répondu en… »
   apparaît si la langue diffère de l'interface, et le compte rendu du 03/06 (FEVG 45 %) est cité.
6. **Import de l'ordonnance** : `/import`, déposer **`services/ingestion/fixtures/ordonnance-florence.png`** (et aucun autre
   fichier : l'OCR de démonstration ne connaît que ce nom ; tout autre document part en file de lettres mortes à l'étape
   OCR, et un PDF sans signature `%PDF` est refusé dès la réception). Les 5 étapes de la chaîne s'enchaînent, les 5 entités
   extraites (ibuprofène ATC M01AE01, lombalgie CIM-10 M54.5, posologie, deux dates) sont à valider ou à rejeter par le
   soignant (rien n'est enregistré sans validation). Copier ce fichier sur le bureau avant la démo.
7. **Alertes IA** : `/alertes`, ouvrir l'alerte de pharmacovigilance, lire le raisonnement et ses sources, l'accepter ou la rejeter.
8. **Bris de glace** : se déconnecter, puis ouvrir directement le dossier de Florence
   **http://localhost:3100/patients/00000000-0000-4000-8000-030000000001** (Dr Kamga n'a pas Florence dans sa liste ni
   dans la recherche : il n'est pas de son équipe). La connexion s'affiche ; se connecter avec Dr Paul Kamga : on revient
   sur le dossier, qui affiche « Accès refusé ». Le bouton « Accès d'urgence » ouvre la fenêtre de bris de glace (motif
   obligatoire, précisions, 4 h, DPO prévenue) ; le dossier s'ouvre. Préparer ce lien dans un onglet ou un marque-page.
9. **Carte épidémiologique** : se reconnecter avec le compte analyste, ouvrir `/epidemiologie`. La carte du Cameroun montre
   les cas par district et le foyer simulé ; la veille est calculée par l'instance élue (bail de coordinateur).
10. **Qui a vu mon dossier ?** : se reconnecter avec Florence, ouvrir `/portail`. L'historique des accès montre la consultation
    de Dr Nana et le bris de glace de Dr Kamga (avec son motif) ; les consentements se gèrent depuis le même écran.
    Ce sont les accès réels de la démo : Dossiers garde son propre journal chaîné (identifiants des acteurs) et transmet
    chaque entrée au service Audit (`POST /internal/events`, clé `AUDIT_INTERNAL_KEY`), avec le nom de l'acteur et un
    motif lisible. Le journal d'Audit démarre vide (`AUDIT_SEED=0` dans `pnpm demo`) : faire les étapes 3 à 8 avant.
11. **Journal d'audit** : se reconnecter avec le compte DPO, ouvrir `/audit`. Chaque entrée porte l'acteur, l'action, le motif,
    une estampille de Lamport et le hachage de l'entrée précédente ; la vérification de la chaîne est affichée.
12. **Supervision et pannes** : se reconnecter avec le compte administrateur, ouvrir `/supervision`. Pour montrer la bascule
    d'une zone à l'autre, lancer la démo avec `DEMO_TWO_INSTANCES=1 pnpm demo` (deux instances d'ia-clinique) :
    « Couper une zone de disponibilité », puis poser une question au copilote : elle passe par la zone b (vérifié).

**Scribe (facultatif)** : il exige le consentement « Enregistrement des consultations », **désactivé par défaut**.
D'abord, avec Florence, l'activer dans `/portail` (Mes consentements) ; ensuite, avec Dr Nana, dossier de Florence →
« Dicter » : brouillon structuré (motif, examen, constantes codées LOINC) à valider ; l'audio est supprimé après.
Sans ce consentement, « Dicter » est refusé (comportement voulu).

## Journal des accès par l'API (mode services)

Tout passe par le broker (`http://localhost:3000/api/<service>/…`) avec un jeton obtenu par la connexion 2FA.

```bash
B=http://localhost:3000/api
F=00000000-0000-4000-8000-030000000001   # Florence

# Connexion : mot de passe, puis code TOTP courant ; affiche le jeton.
login() {
  C=$(curl -s -X POST -H 'content-type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"Hygia-demo-2026\"}" $B/identite/auth/login | jq -r .challengeId)
  CODE=$(pnpm -s --filter identite code | grep -oE '[0-9]{6}' | head -1)
  curl -s -X POST -H 'content-type: application/json' \
    -d "{\"challengeId\":\"$C\",\"code\":\"$CODE\"}" $B/identite/auth/mfa/verify | jq -r .accessToken
}

# Dr Paul Kamga (hors équipe) ouvre un bris de glace : Identité délivre un jeton qui porte l'accès de 4 h,
# Dossiers trace le motif dans l'audit.
T=$(login paul.kamga@cma-bepanda.cm)
T=$(curl -s -X POST -H "authorization: Bearer $T" -H 'content-type: application/json' \
  -d "{\"patientId\":\"$F\",\"motif\":\"urgence vitale\"}" $B/identite/bris-de-glace | jq -r .accessToken)
curl -s -X POST -H "authorization: Bearer $T" -H 'content-type: application/json' \
  -d '{"motif":"urgence vitale"}' $B/dossiers/patients/$F/bris-de-glace

# Dr Aïcha Nana (équipe de soins) consulte le journal : le motif du bris de glace y figure.
T=$(login aicha.nana@hd-bonassama.cm)
curl -s -H "authorization: Bearer $T" $B/dossiers/patients/$F/acces | jq
```

## Ce qui est simulé

- Modèle de langage : implémentation `mock` derrière `ClinicalLanguageModel` (Bedrock ensuite) ; il ne répond qu'à partir des passages retrouvés.
- Bus d'événements, files et flux : en mémoire ou HTTP local (pas encore de SQS, EventBridge ni Kinesis).
- AWS simulé par LocalStack, avec `DEMO_INFRA=1` : journal d'audit **WORM sur S3 Object Lock** (mode conformité,
  suppression refusée, relu au redémarrage), versions des dossiers sur **S3 versionné**, baux du coordinateur des
  agents sur **DynamoDB**. Activé automatiquement quand le conteneur `hygia-localstack` est prêt ; sinon, en mémoire.
- Données : en mémoire, rien n'est conservé après l'arrêt.
- Transcription du scribe et canaux WhatsApp/SMS : simulés (affichés dans la console du service Notification).
