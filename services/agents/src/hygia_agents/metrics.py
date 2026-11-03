"""Mesures du service : requêtes, erreurs 5xx et latences p50/p95 (même format que `@hygia/observability`)."""
from __future__ import annotations

import math
import threading
import time

WINDOW = 1000


def percentile(samples: list[float], p: float) -> float:
    """Percentile par rang le plus proche ; 0 sans échantillon."""
    if not samples:
        return 0
    ordered = sorted(samples)
    rank = min(len(ordered), max(1, math.ceil(p / 100 * len(ordered))))
    return ordered[rank - 1]


class Metrics:
    """Compteurs thread-safe sur les 1000 dernières requêtes."""

    def __init__(self, service: str) -> None:
        self.service = service
        self._started = time.monotonic()
        self._durations: list[float] = []
        self._requests = 0
        self._errors = 0
        self._lock = threading.Lock()

    def record(self, status: int, duration_ms: float) -> None:
        with self._lock:
            self._requests += 1
            if status >= 500:
                self._errors += 1
            self._durations.append(duration_ms)
            if len(self._durations) > WINDOW:
                self._durations.pop(0)

    def snapshot(self) -> dict[str, object]:
        with self._lock:
            durations = list(self._durations)
            return {
                "service": self.service,
                "uptimeSeconds": int(time.monotonic() - self._started),
                "requests": self._requests,
                "errors": self._errors,
                "latency": {
                    "count": len(durations),
                    "p50Ms": percentile(durations, 50),
                    "p95Ms": percentile(durations, 95),
                },
            }
