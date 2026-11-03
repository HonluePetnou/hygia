"""Bus d'événements : interface et version mémoire."""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections import defaultdict
from typing import Callable

from .models import Event

Handler = Callable[[Event], None]


class EventBus(ABC):
    """Interface du bus (équivalent local d'EventBridge)."""

    @abstractmethod
    def subscribe(self, event_type: str, handler: Handler) -> None:
        """Abonne un gestionnaire à un type d'événement."""

    @abstractmethod
    def publish(self, event: Event) -> None:
        """Publie un événement."""


class InMemoryEventBus(EventBus):
    """Bus synchrone en mémoire."""

    def __init__(self) -> None:
        self._handlers: dict[str, list[Handler]] = defaultdict(list)

    def subscribe(self, event_type: str, handler: Handler) -> None:
        self._handlers[event_type].append(handler)

    def publish(self, event: Event) -> None:
        for handler in list(self._handlers[event.type]):
            handler(event)
