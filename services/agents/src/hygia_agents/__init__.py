"""Agents autonomes HYGIA (pharmacovigilance, qualité, tri)."""
from .agent import Agent, AgentRegistry
from .bus import EventBus, InMemoryEventBus
from .models import DOCUMENT_NORMALIZED, PRESCRIPTION_CREATED, DetectedIssue, Event, Source
from .pharmacovigilance import PharmacovigilanceAgent
from .quality import QualityAgent
from .triage import TriageAgent


def default_registry(bus: EventBus) -> AgentRegistry:
    """Registre avec les trois agents livrés."""
    registry = AgentRegistry(bus)
    for agent in (PharmacovigilanceAgent(), QualityAgent(), TriageAgent()):
        registry.register(agent)
    return registry


__all__ = [
    "Agent", "AgentRegistry", "EventBus", "InMemoryEventBus", "DetectedIssue", "Event", "Source",
    "PRESCRIPTION_CREATED", "DOCUMENT_NORMALIZED", "PharmacovigilanceAgent", "QualityAgent",
    "TriageAgent", "default_registry",
]
