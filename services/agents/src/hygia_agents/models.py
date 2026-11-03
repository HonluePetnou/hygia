"""Modèles : événement et alerte (JSON identique à `DetectedIssue` de `@hygia/types`)."""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

PRESCRIPTION_CREATED = "prescription.created"
DOCUMENT_NORMALIZED = "document.normalized"

SEVERITIES = ("low", "moderate", "high")


def raise_severity(severity: str, levels: int = 1) -> str:
    """Relève la gravité de `levels` crans, plafonnée à `high` (« critique »)."""
    index = min(SEVERITIES.index(severity) + levels, len(SEVERITIES) - 1)
    return SEVERITIES[index]


@dataclass(frozen=True)
class Event:
    """Événement publié sur le bus."""

    type: str
    payload: dict[str, Any] = field(default_factory=dict)

    @staticmethod
    def from_json(data: dict[str, Any]) -> "Event":
        return Event(type=str(data["type"]), payload=dict(data.get("payload", {})))


@dataclass(frozen=True)
class Source:
    """Source citée : document (`DocumentReference/<id>`) et extrait."""

    document: str
    excerpt: str
    display: str | None = None

    def to_json(self) -> dict[str, Any]:
        ref: dict[str, Any] = {"reference": self.document}
        if self.display:
            ref["display"] = self.display
        return {"document": ref, "excerpt": self.excerpt}


@dataclass(frozen=True)
class DetectedIssue:
    """Alerte expliquée d'un agent ; ne modifie jamais le dossier (décision `pending`)."""

    agent: str
    severity: str
    title: str
    reasoning: list[str]
    sources: list[Source]
    proposal: str
    subject: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def to_json(self) -> dict[str, Any]:
        steps = [{"step": i + 1, "text": text} for i, text in enumerate(self.reasoning)]
        return {
            "resourceType": "DetectedIssue",
            "id": self.id,
            "version": 1,
            "subject": {"reference": self.subject},
            "agent": self.agent,
            "severity": self.severity,
            "title": self.title,
            "reasoning": steps,
            "explanation": " ".join(self.reasoning),
            "sources": [s.to_json() for s in self.sources],
            "proposal": self.proposal,
            "decision": {"status": "pending"},
        }
