"""Agent de veille : compte les cas partout, ne calcule les foyers que sur l'instance élue."""
from __future__ import annotations

import time
import uuid
from datetime import date
from typing import Callable

from .agent import Agent
from .lease import LeaseStore
from .models import DetectedIssue, Event, Source
from .surveillance import (
    SIGMA_FACTOR, WINDOW_WEEKS, CaseStore, Threshold, case_from_payload, is_anomaly, week_label,
)

DIAGNOSTIC_RECORDED = "diagnostic.recorded"
LEASE_NAME = "veille-epidemiologique"
_NAMESPACE = uuid.UUID("5f0c8a52-6a62-4c43-9a43-2b1f6f7f7a19")


class Coordinator:
    """Élection par bail : une seule instance à la fois détient le calcul."""

    def __init__(self, leases: LeaseStore, instance_id: str, ttl: float = 30.0,
                 clock: Callable[[], float] = time.time) -> None:
        self._leases, self.instance_id, self._ttl, self._clock = leases, instance_id, ttl, clock

    def is_leader(self) -> bool:
        """Prend ou renouvelle le bail ; vrai si cette instance le détient maintenant."""
        return self._leases.acquire(LEASE_NAME, self.instance_id, self._ttl, self._clock())

    def step_down(self) -> None:
        """Rend le bail (arrêt propre)."""
        self._leases.release(LEASE_NAME, self.instance_id)


class VeilleAgent(Agent):
    """Réagit à `diagnostic.recorded` (payload pseudonymisé : caseId, pathology, district, date)."""

    name = "veille"
    event_type = DIAGNOSTIC_RECORDED

    def __init__(self, store: CaseStore, coordinator: Coordinator,
                 emit: Callable[[DetectedIssue], None] | None = None) -> None:
        self.store, self._coordinator, self._emit = store, coordinator, emit
        self._raised: set[tuple[str, str, date]] = set()

    def handle(self, event: Event) -> list[DetectedIssue]:
        """Compte le cas sur toutes les instances ; aucun calcul ici (voir `analyse`)."""
        self.store.record(case_from_payload(event.payload))
        return []

    def analyse(self) -> list[DetectedIssue]:
        """Évalue la dernière semaine ; ne fait rien si l'instance n'a pas le bail."""
        week = self.store.latest_week()
        if week is None or not self._coordinator.is_leader():
            return []
        issues = []
        for pathology, district in self.store.cells():
            key = (pathology, district, week)
            cases = self.store.count(pathology, district, week)
            limit = self.store.threshold(pathology, district, week)
            if key in self._raised or not is_anomaly(cases, limit):
                continue
            self._raised.add(key)
            issue = self._issue(pathology, district, week, cases, limit)
            issues.append(issue)
            if self._emit is not None:
                self._emit(issue)
        return issues

    def _issue(self, pathology: str, district: str, week: date, cases: int, limit: Threshold) -> DetectedIssue:
        label = week_label(week)
        reasoning = [
            f"{cases} cas de {pathology} à {district} en semaine {label.split('-W')[1]}.",
            f"Moyenne mobile sur {WINDOW_WEEKS} semaines : {limit.expected:.1f} cas attendus "
            f"(écart-type {limit.sigma:.1f}).",
            f"Seuil = moyenne + {SIGMA_FACTOR:.0f} écarts-types = {limit.limit:.1f} ; {cases} le dépasse.",
        ]
        source = Source(f"Analytique/{pathology}-{district}-{label}",
                        f"{cases} cas pour {limit.expected:.1f} attendus (seuil {limit.limit:.1f})")
        return DetectedIssue(
            self.name, "high" if cases >= 2 * limit.limit else "moderate",
            f"Foyer anormal : {pathology} à {district}", reasoning, [source],
            "Alerter l'équipe de santé publique du district, après validation.",
            f"Location/{district}", id=str(uuid.uuid5(_NAMESPACE, f"{pathology}|{district}|{label}")),
        )
