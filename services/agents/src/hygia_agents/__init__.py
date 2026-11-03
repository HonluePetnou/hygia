"""Agents autonomes HYGIA (pharmacovigilance, qualité, tri)."""
from .agent import Agent, AgentRegistry
from .analytics_api import AnalyticsApi
from .bus import EventBus, InMemoryEventBus
from .lease import DynamoDbLeaseStore, InMemoryLeaseStore, LeaseStore
from .models import DOCUMENT_NORMALIZED, PRESCRIPTION_CREATED, DetectedIssue, Event, Source
from .pharmacovigilance import PharmacovigilanceAgent
from .quality import QualityAgent
from .surveillance import CaseStore
from .triage import TriageAgent
from .veille import DIAGNOSTIC_RECORDED, Coordinator, VeilleAgent


def default_registry(bus: EventBus) -> AgentRegistry:
    """Registre avec les trois agents livrés."""
    registry = AgentRegistry(bus)
    for agent in (PharmacovigilanceAgent(), QualityAgent(), TriageAgent()):
        registry.register(agent)
    return registry


__all__ = [
    "Agent", "AgentRegistry", "EventBus", "InMemoryEventBus", "DetectedIssue", "Event", "Source",
    "PRESCRIPTION_CREATED", "DOCUMENT_NORMALIZED", "PharmacovigilanceAgent", "QualityAgent",
    "TriageAgent", "default_registry", "AnalyticsApi", "CaseStore", "Coordinator", "VeilleAgent",
    "LeaseStore", "InMemoryLeaseStore", "DynamoDbLeaseStore", "DIAGNOSTIC_RECORDED",
]
