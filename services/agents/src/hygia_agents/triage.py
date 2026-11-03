"""Agent de tri : classe le document et propose le patient à rattacher."""
from __future__ import annotations

from typing import Any

from .agent import Agent
from .models import DOCUMENT_NORMALIZED, DetectedIssue, Event, Source
from .pharmacovigilance import normalize

CATEGORIES = {
    "prescription": ("ordonnance", "prescription"),
    "biologie": ("biologie", "bilan sanguin", "inr", "creatinine"),
    "imagerie": ("radiographie", "scanner", "irm", "echographie"),
    "compte-rendu": ("compte rendu", "compte-rendu", "consultation", "hospitalisation"),
}


class TriageAgent(Agent):
    """Réagit à `document.normalized`.

    Payload : `document {id, title, text, patientId?}`, `candidates [{id, name, ipp}]`.
    """

    name = "tri"
    event_type = DOCUMENT_NORMALIZED

    def handle(self, event: Event) -> list[DetectedIssue]:
        p = event.payload
        doc = p.get("document", {})
        ref = f"DocumentReference/{doc.get('id', 'inconnu')}"
        text = normalize(f"{doc.get('title', '')} {doc.get('text', '')}")
        category, hits = self._classify(text)
        patient = self._match(text, p.get("candidates", []))
        reasoning = [
            f"Mots-clés repérés : {', '.join(hits) if hits else 'aucun'}.",
            f"Classement proposé : {category}.",
            f"Patient proposé : {patient['name']} ({patient['ipp']})." if patient
            else "Aucun patient candidat ne correspond au nom ou à l'IPP.",
        ]
        subject = f"Patient/{patient['id']}" if patient else ref
        proposal = (f"Classer en « {category} » et rattacher à {patient['name']}, après validation."
                    if patient else f"Classer en « {category} » ; rattachement manuel requis.")
        title = f"Tri du document : {category}"
        source = Source(ref, str(doc.get("title", ""))[:120], doc.get("title"))
        return [DetectedIssue(self.name, "low", title, reasoning, [source], proposal, subject)]

    @staticmethod
    def _classify(text: str) -> tuple[str, list[str]]:
        best, best_hits = "autre", []
        for category, words in CATEGORIES.items():
            hits = [w for w in words if w in text]
            if len(hits) > len(best_hits):
                best, best_hits = category, hits
        return best, best_hits

    @staticmethod
    def _match(text: str, candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
        for cand in candidates:
            if normalize(cand["ipp"]) in text:
                return cand
        for cand in candidates:
            if all(part in text for part in normalize(cand["name"]).split()):
                return cand
        return None
