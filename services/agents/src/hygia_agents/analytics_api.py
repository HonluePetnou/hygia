"""API analyste : lecture seule des agrégats ; aucune donnée identifiante dans les réponses."""
from __future__ import annotations

import queue
from typing import Any, Callable

from .surveillance import SERIES_WEEKS, Case, CaseStore, is_anomaly, parse_week, week_label

ANALYST_ROLE = "analyste"


class AnalyticsApi:
    """Routes `/analyse/...` : cas, séries, districts les plus touchés, foyers, flux de cas."""

    def __init__(self, store: CaseStore) -> None:
        self._store = store

    def handle(self, route: str, query: dict[str, str], role: str | None) -> tuple[int, Any]:
        """Renvoie (statut, corps JSON). Le rôle vient de l'en-tête posé par le broker."""
        if role is None:
            return 401, {"error": "authentification requise"}
        if role != ANALYST_ROLE:
            return 403, {"error": "rôle analyste requis"}
        handlers: dict[str, Callable[[dict[str, str]], tuple[int, Any]]] = {
            "cas": self._cases, "serie": self._series, "districts": self._districts, "foyers": self._outbreaks,
        }
        handler = handlers.get(route)
        if handler is None:
            return 404, {"error": "not found"}
        try:
            return handler(query)
        except ValueError as error:
            return 400, {"error": str(error)}

    def open_stream(self) -> tuple["queue.Queue[Case]", Callable[[], None]]:
        """Abonne un client au flux des nouveaux cas ; renvoie sa file et la fonction de fermeture."""
        inbox: "queue.Queue[Case]" = queue.Queue()
        return inbox, self._store.subscribe(inbox.put)

    def _week(self, query: dict[str, str]):
        latest = self._store.latest_week()
        return parse_week(query["semaine"]) if "semaine" in query else latest

    def _cases(self, query: dict[str, str]) -> tuple[int, Any]:
        week = self._week(query)
        rows = []
        for pathology, district in self._store.cells():
            if query.get("pathologie", pathology) != pathology or query.get("district", district) != district:
                continue
            rows.append({"pathology": pathology, "district": district,
                         "cases": self._store.count(pathology, district, week) if week else 0})
        return 200, {"week": week_label(week) if week else None, "rows": rows}

    def _series(self, query: dict[str, str]) -> tuple[int, Any]:
        if "pathologie" not in query or "district" not in query:
            raise ValueError("paramètres pathologie et district requis")
        end = self._week(query)
        series = self._store.series(query["pathologie"], query["district"], end, SERIES_WEEKS) if end else []
        return 200, {"pathology": query["pathologie"], "district": query["district"], "series": series}

    def _districts(self, query: dict[str, str]) -> tuple[int, Any]:
        week, limit = self._week(query), int(query.get("limite", "5"))
        ranking: dict[str, dict[str, Any]] = {}
        for pathology, district in self._store.cells():
            if query.get("pathologie", pathology) != pathology or week is None:
                continue
            row = ranking.setdefault(district, {"district": district, "cases": 0, "outbreak": False})
            cases = self._store.count(pathology, district, week)
            row["cases"] += cases
            row["outbreak"] = row["outbreak"] or is_anomaly(cases, self._store.threshold(pathology, district, week))
        top = sorted(ranking.values(), key=lambda r: (-r["cases"], r["district"]))[:max(limit, 0)]
        return 200, {"week": week_label(week) if week else None, "districts": top}

    def _outbreaks(self, query: dict[str, str]) -> tuple[int, Any]:
        week = self._week(query)
        found = []
        for pathology, district in self._store.cells() if week else []:
            cases, limit = self._store.count(pathology, district, week), self._store.threshold(pathology, district, week)
            if is_anomaly(cases, limit):
                found.append({"pathology": pathology, "district": district, "cases": cases,
                              "expected": round(limit.expected, 1), "threshold": round(limit.limit, 1)})
        return 200, {"week": week_label(week) if week else None, "outbreaks": found}
