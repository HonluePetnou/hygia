"""Classe de base des agents et registre."""
from __future__ import annotations

from abc import ABC, abstractmethod

from .bus import EventBus
from .models import DetectedIssue, Event


class Agent(ABC):
    """Agent réagissant à un seul type d'événement."""

    name: str
    event_type: str

    @abstractmethod
    def handle(self, event: Event) -> list[DetectedIssue]:
        """Analyse l'événement et renvoie les alertes détectées."""


class AgentRegistry:
    """Enregistre les agents sur le bus et collecte leurs alertes."""

    def __init__(self, bus: EventBus) -> None:
        self._bus = bus
        self._agents: list[Agent] = []
        self.issues: list[DetectedIssue] = []

    @property
    def agents(self) -> list[Agent]:
        return list(self._agents)

    def register(self, agent: Agent) -> None:
        """Ajoute un agent ; aucun autre agent n'est modifié."""
        self._agents.append(agent)
        self._bus.subscribe(agent.event_type, lambda event: self._run(agent, event))

    def _run(self, agent: Agent, event: Event) -> None:
        self.issues.extend(agent.handle(event))
