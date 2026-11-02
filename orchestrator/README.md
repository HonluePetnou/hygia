# Orchestrateur HYGIA

Robot de développement qui tourne sur le VPS : il prend les tâches de `tasks/todo/` une par
une (dans l'ordre, dépendances terminées), les fait coder par des juniors peu chers
(OpenHands avec DeepSeek, puis GLM), vérifie `pnpm lint`, `pnpm typecheck` et `pnpm test`,
fusionne dans la branche de travail, et prévient sur Telegram. En cas d'échec, la tâche
passe au Lead (Claude Code). Une tâche qui contient « destinée au Lead » y va directement.

Adapté de l'orchestrateur HaulGo : les consignes du projet sont dans `PROMPT.md` (plus de
« frontend uniquement »), et le remote git est configurable (`GIT_REMOTE`).

## Installation sur le VPS

Prérequis déjà présents pour HaulGo : Python 3, Node 22, pnpm, Docker, `~/.local/bin/claude`,
`~/.local/bin/openhands`, `~/.openhands/.env` (clés `DEEPSEEK_API_KEY`, `GLM_API_KEY`).

```bash
git clone https://github.com/HonluePetnou/hygia.git ~/hygia
cd ~/hygia
git checkout dev                  # le robot refuse de tourner sur main
cp orchestrator/.env.example orchestrator/.env
# remplir TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (les mêmes que HaulGo conviennent)
# et GIT_REMOTE (le remote qui pointe vers GitHub)
pnpm install
```

Le dépôt est privé : le VPS doit pouvoir pousser sur GitHub (clé SSH de déploiement avec
droit d'écriture, ou jeton limité au dépôt `hygia`).

Optionnel, si les juniors échouent trop souvent (constaté sur HaulGo) :

```bash
touch orchestrator/LEAD_ONLY      # toutes les tâches vont directement à Claude Code
```

## Lancement

```bash
nohup python3 orchestrator/daemon.py > orchestrator/logs/nohup.out 2>&1 &
tail -f orchestrator/logs/daemon.log
```

Il peut tourner en même temps que celui de HaulGo : chaque projet a son dossier, son état
(`state.json`) et ses journaux, et les messages Telegram sont préfixés par le nom du projet.
Attention : les deux instances lisent le même bot Telegram ; une réponse à une question du
Lead peut être captée par l'autre instance. Arrêter HaulGo pendant le lot HYGIA évite ce cas.

Arrêt propre : `kill <pid>` (l'état est enregistré dans `state.json`).
