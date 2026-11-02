#!/usr/bin/env python3
"""Orchestrateur persistant — cheap-first avec escalade.

Chaque tâche de tasks/todo/ (deps satisfaites) est d'abord tentée par un
junior OpenHands headless dans un git worktree isolé : DeepSeek d'abord,
GLM si DeepSeek échoue les vérifications (lint/typecheck/test). Si les deux
juniors échouent, la tâche escalade au Lead (Claude Code, cette même
mécanique --resume + Telegram que la v1). Tourne en continu (nohup).
"""
import json
import os
import re
import signal
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TODO_DIR = PROJECT_ROOT / "tasks" / "todo"
DONE_DIR = PROJECT_ROOT / "tasks" / "done"
WORKTREES_DIR = PROJECT_ROOT / "worktrees"
ORCH_DIR = PROJECT_ROOT / "orchestrator"
STATE_FILE = ORCH_DIR / "state.json"
LOG_DIR = ORCH_DIR / "logs"
ENV_FILE = ORCH_DIR / ".env"
OPENHANDS_ENV_FILE = Path.home() / ".openhands" / ".env"

LOG_DIR.mkdir(parents=True, exist_ok=True)
WORKTREES_DIR.mkdir(parents=True, exist_ok=True)

CLAUDE_BIN = str(Path.home() / ".local" / "bin" / "claude")
OPENHANDS_BIN = str(Path.home() / ".local" / "bin" / "openhands")

IDLE_POLL_SECONDS = 60
REPLY_POLL_SECONDS = 5
TELEGRAM_LONG_POLL = 25
JUNIOR_TIMEOUT_SECONDS = 1800
CHECK_TIMEOUT_SECONDS = 300


def load_dotenv(path):
    env = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env


ENV = load_dotenv(ENV_FILE)
BOT_TOKEN = ENV["TELEGRAM_BOT_TOKEN"]
CHAT_ID = str(ENV["TELEGRAM_CHAT_ID"])
API_BASE = f"https://api.telegram.org/bot{BOT_TOKEN}"
# Remote GitHub de référence (sur certains postes, "origin" pointe ailleurs).
GIT_REMOTE = ENV.get("GIT_REMOTE", "origin")
# Consignes propres au projet, données aux juniors avant chaque tâche.
JUNIOR_PROMPT_FILE = ORCH_DIR / "PROMPT.md"

OH_ENV = load_dotenv(OPENHANDS_ENV_FILE)
JUNIOR_MODELS = [
    ("deepseek", {
        "model": "openai/deepseek-chat",
        "api_key": OH_ENV["DEEPSEEK_API_KEY"],
        "base_url": "https://api.deepseek.com/v1",
    }),
    ("glm", {
        "model": "openai/glm-4.6",
        "api_key": OH_ENV["GLM_API_KEY"],
        "base_url": "https://api.z.ai/api/paas/v4/",
    }),
]


def log(msg):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG_DIR / "daemon.log", "a", encoding="utf-8") as f:
        f.write(line + "\n")


def telegram_api(method, params, timeout=15):
    url = f"{API_BASE}/{method}"
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(url, data=data)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def notify(text):
    text = f"[{PROJECT_ROOT.name}] {text}"
    try:
        telegram_api("sendMessage", {"chat_id": CHAT_ID, "text": text[:4000]})
    except Exception as e:
        log(f"ERREUR notify Telegram: {e}")


def get_replies(offset, timeout):
    try:
        result = telegram_api(
            "getUpdates",
            {"offset": offset, "timeout": timeout, "allowed_updates": json.dumps(["message"])},
            timeout=timeout + 10,
        )
    except Exception as e:
        log(f"ERREUR getUpdates: {e}")
        return [], offset
    updates = result.get("result", [])
    texts = []
    max_id = offset - 1
    for u in updates:
        max_id = max(max_id, u["update_id"])
        msg = u.get("message", {})
        chat = msg.get("chat", {})
        if str(chat.get("id")) == CHAT_ID and "text" in msg:
            texts.append(msg["text"])
    return texts, max_id + 1


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"pending": None, "last_update_id": 0, "skip_ids": []}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2))


def task_id(path: Path):
    m = re.match(r"^(\d+)", path.name)
    return m.group(1) if m else None


def deps_satisfied(task_file: Path, skip_ids):
    text = task_file.read_text(encoding="utf-8", errors="ignore")
    m = re.search(r"\*\*Dépend de\*\*\s*:\s*(.+)", text)
    if not m:
        return True
    deps_line = m.group(1)
    if "aucune" in deps_line.lower():
        return True
    ids = re.findall(r"\b(\d{3})\b", deps_line)
    done_ids = {task_id(p) for p in DONE_DIR.glob("*.md")}
    for did in ids:
        if did in skip_ids:
            return False
        if did not in done_ids:
            return False
    return True


def pick_next_task(skip_ids):
    for f in sorted(TODO_DIR.glob("*.md")):
        tid = task_id(f)
        if tid in skip_ids:
            continue
        if deps_satisfied(f, skip_ids):
            return f
    return None


def title_of(task_file: Path):
    first_line = task_file.read_text(encoding="utf-8", errors="ignore").splitlines()[0]
    return re.sub(r"^#\s*\d+\s*-\s*", "", first_line).strip()


def slugify(text):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:40]


def run(cmd, cwd, timeout=60, env=None):
    return subprocess.run(
        cmd, cwd=str(cwd), capture_output=True, text=True, timeout=timeout,
        stdin=subprocess.DEVNULL, env=env,
    )


def get_current_branch():
    r = run(["git", "branch", "--show-current"], PROJECT_ROOT, timeout=15)
    return r.stdout.strip() or "main"


PROTECTED_BRANCHES = {"main", "master"}
NON_CODE_PREFIXES = ("tasks/", "context/", "worklog/", "docs/")


def assert_safe_branch():
    """Stop the daemon if the main checkout is on a protected branch."""
    branch = get_current_branch()
    if branch in PROTECTED_BRANCHES:
        msg = (f"Branche courante = {branch} : l'orchestrateur refuse de merger/pousser sur "
               "main/master. Checkout dev puis relance.")
        log(msg)
        notify("⛔ " + msg)
        sys.exit(1)
    return branch


def has_code_changes(base_branch, branch):
    """True if the branch touches at least one file outside tasks/, context/, worklog/."""
    r = run(["git", "diff", "--name-only", f"{base_branch}...{branch}"], PROJECT_ROOT, timeout=15)
    files = [f for f in r.stdout.splitlines() if f.strip()]
    return any(not f.startswith(NON_CODE_PREFIXES) for f in files)


def setup_worktree(tid, slug):
    branch = f"task/{tid}-{slug}"
    wdir = WORKTREES_DIR / tid
    base_branch = get_current_branch()
    run(["git", "worktree", "remove", "--force", str(wdir)], PROJECT_ROOT, timeout=30)
    run(["git", "branch", "-D", branch], PROJECT_ROOT, timeout=30)
    r = run(["git", "worktree", "add", str(wdir), "-b", branch, base_branch], PROJECT_ROOT, timeout=60)
    if r.returncode != 0:
        return None, None, None, r.stderr
    run(["pnpm", "install"], wdir, timeout=300)
    return wdir, branch, base_branch, None


def cleanup_worktree(wdir):
    run(["git", "worktree", "remove", "--force", str(wdir)], PROJECT_ROOT, timeout=30)


def has_new_commit(base_branch, branch):
    r = run(["git", "rev-list", "--count", f"{base_branch}..{branch}"], PROJECT_ROOT, timeout=15)
    try:
        return int(r.stdout.strip()) > 0
    except (ValueError, AttributeError):
        log(f"ERREUR has_new_commit ({base_branch}..{branch}): stdout={r.stdout!r} stderr={r.stderr!r}")
        return False


def merge_task_branch(branch, base_branch, tid):
    r = run(["git", "checkout", base_branch], PROJECT_ROOT, timeout=30)
    if r.returncode != 0:
        return False, f"checkout {base_branch} a échoué: {(r.stderr or '')[:300]}"
    r = run(["git", "merge", "--no-ff", branch, "-m", f"merge: tache {tid} ({branch})"],
            PROJECT_ROOT, timeout=60)
    if r.returncode != 0:
        run(["git", "merge", "--abort"], PROJECT_ROOT, timeout=30)
        return False, f"merge a échoué (probable conflit): {(r.stderr or '')[:500]}"
    return True, None


def undo_last_merge_commit():
    run(["git", "reset", "--hard", "HEAD~1"], PROJECT_ROOT, timeout=30)


def run_checks(wdir):
    for step, cmd in [("lint", ["pnpm", "lint"]), ("typecheck", ["pnpm", "typecheck"]),
                       ("test", ["pnpm", "test"])]:
        try:
            r = run(cmd, wdir, timeout=CHECK_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            return False, step, "timeout"
        if r.returncode != 0:
            return False, step, (r.stdout + r.stderr)[-1500:]
    return True, None, None


def run_openhands_junior(model_name, model_cfg, prompt, wdir):
    env = os.environ.copy()
    env.update({
        "PATH": f"{Path.home()}/.local/bin:{env.get('PATH', '')}",
        "OPENHANDS_SUPPRESS_BANNER": "1",
        "LLM_MODEL": model_cfg["model"],
        "LLM_API_KEY": model_cfg["api_key"],
        "LLM_BASE_URL": model_cfg["base_url"],
    })
    cmd = [OPENHANDS_BIN, "--headless", "--json", "--override-with-envs",
           "--exit-without-confirmation", "-t", prompt]
    try:
        run(cmd, wdir, timeout=JUNIOR_TIMEOUT_SECONDS, env=env)
        return True
    except subprocess.TimeoutExpired:
        return False


def try_junior_task(task_file, tid, title, basename):
    slug = slugify(title)
    wdir, branch, base_branch, err = setup_worktree(tid, slug)
    if wdir is None:
        notify(f"❌ Tâche {tid} : impossible de créer le worktree ({err[:200] if err else '?'})")
        return "error"

    task_text = task_file.read_text(encoding="utf-8")
    project_rules = JUNIOR_PROMPT_FILE.read_text(encoding="utf-8")
    prompt = (
        f"{project_rules}\n\nImplémente exactement la tâche suivante :\n\n{task_text}\n\n"
        "À la fin : lance 'pnpm lint', 'pnpm typecheck', 'pnpm test' à la racine et corrige "
        "jusqu'à ce que tout passe. Puis fais UN SEUL commit git contenant le CODE de la tâche "
        "(git add -A && git commit -m 'feat(<paquet>): ...'). Un commit qui ne contient que des "
        "fichiers tasks/ context/ worklog/ docs/ sera rejeté. Ne push pas, ne touche à rien hors "
        "de ce dossier, n'ajoute aucune dépendance non demandée par la tâche."
    )

    for model_name, model_cfg in JUNIOR_MODELS:
        notify(f"🤖 Tâche {tid} assignée au junior ({model_name}) : {title}")
        log(f"Junior {model_name} démarre sur tâche {tid} (worktree {wdir})")
        run_openhands_junior(model_name, model_cfg, prompt, wdir)

        if not has_new_commit(base_branch, branch):
            notify(f"⚠️ Junior {model_name} n'a rien commité sur tâche {tid} — passage au suivant.")
            log(f"Junior {model_name} sur {tid}: pas de commit")
            continue

        if not has_code_changes(base_branch, branch):
            notify(f"⚠️ Junior {model_name} a commité sur tâche {tid} SANS changement de code "
                   "(seulement tasks/context/worklog) — rejeté, passage au suivant.")
            log(f"Junior {model_name} sur {tid}: commit sans code")
            run(["git", "reset", "--hard", base_branch], wdir, timeout=30)
            continue

        ok, failed_step, detail = run_checks(wdir)
        if not ok:
            notify(
                f"⚠️ Junior {model_name} a échoué les vérifications sur tâche {tid} "
                f"(échec: {failed_step}) — passage au suivant.\n\n{detail[:500] if detail else ''}"
            )
            log(f"Junior {model_name} sur {tid}: échec vérif ({failed_step})")
            continue

        # Checks passent en isolation -> pousse la branche, puis tente l'intégration réelle
        run(["git", "push", "-u", GIT_REMOTE, branch], wdir, timeout=60)

        merged, merge_err = merge_task_branch(branch, base_branch, tid)
        if not merged:
            notify(
                f"🔺 Tâche {tid} : le junior {model_name} a réussi isolément mais le merge dans "
                f"`{base_branch}` a échoué — {merge_err}\n\nEscalade au Lead pour résoudre le conflit."
            )
            log(f"Tâche {tid}: merge échoué ({merge_err})")
            cleanup_worktree(wdir)
            return "escalate_merge_conflict"

        post_ok, post_step, post_detail = run_checks(PROJECT_ROOT)
        if not post_ok:
            undo_last_merge_commit()
            notify(
                f"🔺 Tâche {tid} : merge propre mais les vérifications échouent une fois intégré "
                f"au reste du code (échec: {post_step}). Merge annulé, escalade au Lead.\n\n"
                f"{post_detail[:500] if post_detail else ''}"
            )
            log(f"Tâche {tid}: échec vérif post-merge ({post_step}), merge annulé")
            cleanup_worktree(wdir)
            return "escalate_merge_broke_build"

        todo_path = TODO_DIR / basename
        done_path = DONE_DIR / basename
        if todo_path.exists():
            todo_path.rename(done_path)
            run(["git", "add", "-A"], PROJECT_ROOT, timeout=15)
            run(["git", "commit", "-m", f"chore: tache {tid} terminee et integree (junior {model_name})"],
                PROJECT_ROOT, timeout=15)
        run(["git", "push", GIT_REMOTE, base_branch], PROJECT_ROOT, timeout=60)

        notify(f"✅ Tâche {tid} terminée ET intégrée par junior ({model_name}) dans `{base_branch}`.")
        log(f"Tâche {tid} terminée et mergée par {model_name}")
        cleanup_worktree(wdir)
        return "done"

    notify(f"🔺 Tâche {tid} escaladée au Lead après échec des juniors (DeepSeek + GLM).")
    log(f"Tâche {tid} escaladée au Lead")
    cleanup_worktree(wdir)
    return "escalate_junior_failed"


def run_claude(prompt, session_id=None, resume=False):
    cmd = [CLAUDE_BIN, "-p", prompt, "--output-format", "json"]
    if resume:
        cmd += ["--resume", session_id]
    else:
        cmd += ["--session-id", session_id]
    env = os.environ.copy()
    env["PATH"] = f"{Path.home()}/.local/bin:{env.get('PATH', '')}"
    proc = subprocess.run(
        cmd, cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=1800,
        stdin=subprocess.DEVNULL, env=env,
    )
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        data = {"result": proc.stdout[-2000:] + "\n\nSTDERR:\n" + proc.stderr[-1000:],
                 "is_error": True, "session_id": session_id}
    return data


LIMIT_PAUSE_SECONDS = 1800


def is_usage_limit(text):
    """True if a Claude error looks like a usage / rate limit (temporary)."""
    low = (text or "").lower()
    return any(k in low for k in ("limit", "rate_limit", "429", "overloaded", "resets"))


def commit_leftovers(tid):
    """Commit changes the Lead left uncommitted, only if lint/typecheck/test pass."""
    r = run(["git", "status", "--porcelain"], PROJECT_ROOT, timeout=15)
    if not r.stdout.strip():
        return
    ok, step, detail = run_checks(PROJECT_ROOT)
    if not ok:
        notify(f"⚠️ Tâche {tid} : le Lead a laissé des changements non commités et les "
               f"vérifications échouent ({step}). Rien n'est commité, à regarder.")
        log(f"Tâche {tid}: changements non commités, vérif {step} en échec")
        return
    run(["git", "add", "-A"], PROJECT_ROOT, timeout=30)
    run(["git", "commit", "-m", f"chore: tache {tid} terminee (Lead, commit automatique)"],
        PROJECT_ROOT, timeout=120)
    run(["git", "push", GIT_REMOTE, get_current_branch()], PROJECT_ROOT, timeout=60)
    log(f"Tâche {tid}: changements du Lead commités automatiquement")


def handle_lead_result(basename, tid, title, data, state):
    result_text = data.get("result", "(pas de résultat)")
    session_id = data.get("session_id", state["pending"]["session_id"] if state.get("pending") else None)
    done_path = DONE_DIR / basename
    if done_path.exists():
        commit_leftovers(tid)
        notify(f"✅ Tâche {tid} terminée par le Lead : {title}\n\n{result_text[:800]}")
        state["pending"] = None
        return "done"
    elif data.get("is_error") and is_usage_limit(result_text):
        notify(f"⏸️ Tâche {tid} : limite d'usage Claude atteinte. Pause de "
               f"{LIMIT_PAUSE_SECONDS // 60} min puis nouvelle tentative (tâche conservée).")
        log(f"Tâche {tid}: limite d'usage Claude, pause {LIMIT_PAUSE_SECONDS}s")
        state["pending"] = None
        save_state(state)
        time.sleep(LIMIT_PAUSE_SECONDS)
        return "rate_limited"
    elif data.get("is_error"):
        notify(f"❌ Tâche {tid} en ERREUR (Lead) : {title}\n\n{result_text[:1200]}")
        state["skip_ids"].append(tid)
        state["pending"] = None
        return "error"
    else:
        notify(
            f"⚠️ Tâche {tid} bloquée (Lead) : {title}\n\n{result_text[:1500]}\n\n"
            f"— Réponds directement à ce message sur Telegram pour continuer."
        )
        state["pending"] = {"task_id": tid, "session_id": session_id, "basename": basename, "title": title}
        return "waiting"


def main():
    assert_safe_branch()
    log("Démarrage du daemon orchestrateur (junior-first + escalade Lead)")
    mode = ("Lead seul (juniors désactivés : fichier orchestrator/LEAD_ONLY)"
            if (ORCH_DIR / "LEAD_ONLY").exists() else "juniors DeepSeek/GLM + Lead en escalade")
    notify(f"🟢 Orchestrateur démarré sur {PROJECT_ROOT.name} ({mode})")
    state = load_state()

    def handle_sigterm(signum, frame):
        log("Signal reçu, arrêt propre")
        notify("🔴 Orchestrateur arrêté")
        save_state(state)
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    while True:
        save_state(state)

        if state.get("pending"):
            pending = state["pending"]
            log(f"En attente de réponse pour tâche {pending['task_id']} (session {pending['session_id']})")
            replies, new_offset = get_replies(state["last_update_id"], TELEGRAM_LONG_POLL)
            state["last_update_id"] = new_offset
            if not replies:
                continue
            reply_text = replies[-1]
            log(f"Réponse reçue pour tâche {pending['task_id']}: {reply_text[:100]}")
            data = run_claude(reply_text, session_id=pending["session_id"], resume=True)
            handle_lead_result(pending["basename"], pending["task_id"], pending["title"], data, state)
            continue

        next_task = pick_next_task(state["skip_ids"])
        if next_task is None:
            remaining = len(list(TODO_DIR.glob("*.md")))
            if remaining > 0:
                log(f"{remaining} tâche(s) restante(s) mais toutes bloquées/dépendances non résolues — attente")
            else:
                log("Aucune tâche restante dans todo/ — attente de nouvelles tâches")
            time.sleep(IDLE_POLL_SECONDS)
            continue

        tid = task_id(next_task)
        title = title_of(next_task)
        basename = next_task.name

        if (ORCH_DIR / "LEAD_ONLY").exists() or "destinée au Lead" in next_task.read_text(encoding="utf-8", errors="ignore"):
            result = "escalate_junior_failed"
        else:
            result = try_junior_task(next_task, tid, title, basename)

        if result == "done":
            continue
        elif result == "error":
            state["skip_ids"].append(tid)
            continue
        elif result in ("escalate_junior_failed", "escalate_merge_conflict", "escalate_merge_broke_build"):
            escalate_context = {
                "escalate_junior_failed": (
                    "Deux juniors (DeepSeek puis GLM, via OpenHands) ont déjà tenté cette tâche "
                    "dans un worktree isolé et échoué (aucun commit, ou lint/typecheck/test en "
                    "échec). Leurs branches ont été nettoyées. Reprends la tâche depuis le début "
                    "toi-même directement dans le repo principal."
                ),
                "escalate_merge_conflict": (
                    "Un junior a réussi la tâche isolément (checks OK sur sa branche), mais le "
                    "merge automatique de sa branche dans la branche de travail principale a "
                    "échoué (probable conflit). Regarde `git log --all --oneline` et les branches "
                    "`task/*` pour retrouver son travail, résous le conflit manuellement (merge ou "
                    "réimplémentation), puis termine la tâche normalement."
                ),
                "escalate_merge_broke_build": (
                    "Un junior a réussi la tâche isolément ET le merge dans la branche principale "
                    "s'est fait sans conflit textuel, MAIS lint/typecheck/test échouent une fois "
                    "intégré au reste du code (incompatibilité avec du code écrit en parallèle par "
                    "une autre tâche). Le merge a été annulé (revert). Regarde la branche `task/*` "
                    "correspondante pour comprendre l'intention, puis réintègre correctement en "
                    "résolvant l'incompatibilité."
                ),
            }[result]
            session_id = str(uuid.uuid4())
            prompt = (
                f"[Contexte orchestrateur : tu es exécuté par orchestrator/daemon.py, le daemon "
                f"persistant décrit dans CLAUDE.md — il tourne en permanence en arrière-plan par "
                f"conception, c'est normal. {escalate_context} Si tu bloques sur une commande "
                f"nécessitant une approbation, pose ta question et arrête-toi là.]"
                f"\n\nLis orchestrator/PROMPT.md, puis réalise la tâche tasks/todo/{basename}. "
                f"Quand tous ses critères de fini sont remplis et que 'pnpm lint', "
                f"'pnpm typecheck' et 'pnpm test' passent : déplace le fichier dans "
                f"tasks/done/ (git mv), commite le tout et pousse sur {GIT_REMOTE}."
            )
            notify(f"🚀 Tâche {tid} reprise par le Lead : {title}")
            data = run_claude(prompt, session_id=session_id, resume=False)
            handle_lead_result(basename, tid, title, data, state)


if __name__ == "__main__":
    main()
