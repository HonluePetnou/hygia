"""Agent qualité : valeurs aberrantes, dates impossibles, champs manquants."""
from __future__ import annotations

from datetime import date
from typing import Any

from .agent import Agent
from .models import DOCUMENT_NORMALIZED, DetectedIssue, Event, Source

# code -> (libellé, unité, minimum plausible, maximum plausible)
PLAUSIBLE_RANGES = {
    "creatinine": ("Créatininémie", "µmol/L", 20.0, 1200.0),
    "inr": ("INR", "", 0.5, 10.0),
    "potassium": ("Kaliémie", "mmol/L", 1.5, 9.0),
    "glycemie": ("Glycémie", "g/L", 0.2, 6.0),
    "fc": ("Fréquence cardiaque", "bpm", 20.0, 250.0),
}
REQUIRED_FIELDS = ("patientId", "title", "date", "type")


class QualityAgent(Agent):
    """Réagit à `document.normalized`.

    Payload : `document {id, title, type, date, patientId}`, `observations [{code, value, unit}]`,
    `today` (ISO, optionnel, pour les tests).
    """

    name = "qualite"
    event_type = DOCUMENT_NORMALIZED

    def handle(self, event: Event) -> list[DetectedIssue]:
        p = event.payload
        doc = p.get("document", {})
        ref = f"DocumentReference/{doc.get('id', 'inconnu')}"
        subject = f"Patient/{doc['patientId']}" if doc.get("patientId") else ref
        today = date.fromisoformat(p["today"]) if p.get("today") else date.today()
        issues = [self._outlier(o, doc, ref, subject) for o in p.get("observations", [])]
        issues.append(self._future_date(doc, ref, subject, today))
        issues.extend(self._missing(doc, ref, subject))
        return [i for i in issues if i is not None]

    def _outlier(self, obs: dict[str, Any], doc: dict[str, Any], ref: str, subject: str) -> DetectedIssue | None:
        rng = PLAUSIBLE_RANGES.get(str(obs.get("code", "")).lower())
        value = obs.get("value")
        if rng is None or value is None or rng[2] <= value <= rng[3]:
            return None
        label, unit, low, high = rng
        reasoning = [
            f"{label} relevée à {value} {unit} dans « {doc.get('title', ref)} ».",
            f"Plage physiologiquement plausible : {low:g} à {high:g} {unit}.",
            "La valeur est hors de cette plage : probable erreur de saisie ou d'extraction.",
        ]
        guess = value / 10
        proposal = (f"Vérifier le document source ; correction probable : {guess:g} {unit} (décimale décalée)."
                    if low <= guess <= high else "Vérifier le document source et ressaisir la valeur.")
        return DetectedIssue(self.name, "moderate", f"Valeur aberrante : {label} {value} {unit}",
                             reasoning, [Source(ref, f"{label} {value} {unit}", doc.get("title"))], proposal, subject)

    def _future_date(self, doc: dict[str, Any], ref: str, subject: str, today: date) -> DetectedIssue | None:
        try:
            when = date.fromisoformat(str(doc.get("date", ""))[:10])
        except ValueError:
            return None
        if when <= today:
            return None
        reasoning = [f"Date du document : {when.isoformat()}.", f"Date du jour : {today.isoformat()}.",
                     "Un document ne peut pas être daté du futur : date impossible."]
        return DetectedIssue(self.name, "moderate", "Date impossible (dans le futur)", reasoning,
                             [Source(ref, f"date {when.isoformat()}", doc.get("title"))],
                             "Corriger la date à partir du document d'origine.", subject)

    def _missing(self, doc: dict[str, Any], ref: str, subject: str) -> list[DetectedIssue]:
        missing = [f for f in REQUIRED_FIELDS if not doc.get(f)]
        if not missing:
            return []
        reasoning = [f"Champs obligatoires contrôlés : {', '.join(REQUIRED_FIELDS)}.",
                     f"Champs absents : {', '.join(missing)}."]
        return [DetectedIssue(self.name, "low", f"Champs manquants : {', '.join(missing)}", reasoning,
                              [Source(ref, "document normalisé", doc.get("title"))],
                              "Compléter les champs manquants avant validation.", subject)]
