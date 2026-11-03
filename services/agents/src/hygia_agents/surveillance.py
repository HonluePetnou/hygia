"""Surveillance épidémiologique : agrégats hebdomadaires et seuil moyenne mobile + 2σ.

Seules des données pseudonymisées entrent ici (branche analytique, section 8.5) : un cas se
réduit à un identifiant opaque, une pathologie, un district et une semaine.
"""
from __future__ import annotations

import math
import threading
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Callable

WINDOW_WEEKS = 8
SIGMA_FACTOR = 2.0
SERIES_WEEKS = 12
MIN_CASES = 3  # plancher : une série plate ne déclenche pas d'alerte pour 1 ou 2 cas

# Clés d'un événement qui désigneraient un patient : refusées (donnée non pseudonymisée).
IDENTIFYING_KEYS = frozenset({
    "name", "nom", "prenom", "firstname", "lastname", "ipp", "patient", "patientid",
    "birthdate", "datenaissance", "phone", "telephone", "address", "adresse", "email",
})


def monday(day: date) -> date:
    """Lundi de la semaine ISO du jour donné."""
    return day - timedelta(days=day.weekday())


def week_label(week: date) -> str:
    """Étiquette ISO, par exemple `2026-W44`."""
    year, number, _ = week.isocalendar()
    return f"{year}-W{number:02d}"


def parse_week(label: str) -> date:
    """Inverse de `week_label` ; lève `ValueError` si l'étiquette est invalide."""
    year, _, number = label.partition("-W")
    return date.fromisocalendar(int(year), int(number), 1)


@dataclass(frozen=True)
class Threshold:
    """Attendu (moyenne mobile), écart-type et seuil d'alerte pour une semaine."""

    expected: float
    sigma: float
    limit: float


def compute_threshold(history: list[int]) -> Threshold:
    """Moyenne et écart-type (population) des semaines précédentes ; seuil = moyenne + 2σ."""
    if not history:
        return Threshold(0.0, 0.0, 0.0)
    mean = sum(history) / len(history)
    sigma = math.sqrt(sum((x - mean) ** 2 for x in history) / len(history))
    return Threshold(mean, sigma, mean + SIGMA_FACTOR * sigma)


def is_anomaly(cases: int, limit: Threshold) -> bool:
    """Vrai si le nombre de cas dépasse strictement le seuil et le plancher."""
    return cases >= MIN_CASES and cases > limit.limit


@dataclass(frozen=True)
class Case:
    """Nouveau cas pseudonymisé."""

    case_id: str
    pathology: str
    district: str
    week: date

    def to_json(self) -> dict[str, str]:
        return {"pathology": self.pathology, "district": self.district, "week": week_label(self.week)}


def case_from_payload(payload: dict) -> Case:
    """Construit un cas ; refuse tout payload portant une clé identifiante."""
    bad = sorted(k for k in payload if k.lower() in IDENTIFYING_KEYS)
    if bad:
        raise ValueError("donnée non pseudonymisée refusée : " + ", ".join(bad))
    try:
        return Case(str(payload["caseId"]), str(payload["pathology"]), str(payload["district"]),
                    monday(date.fromisoformat(str(payload["date"]))))
    except (KeyError, ValueError) as error:
        raise ValueError(f"cas invalide : {error}") from error


class CaseStore:
    """Compteurs hebdomadaires par (pathologie, district), en mémoire, avec abonnés au flux."""

    def __init__(self) -> None:
        self._counts: dict[tuple[str, str], dict[date, int]] = defaultdict(lambda: defaultdict(int))
        self._seen: set[str] = set()
        self._listeners: list[Callable[[Case], None]] = []
        self._lock = threading.Lock()

    def subscribe(self, listener: Callable[[Case], None]) -> Callable[[], None]:
        """Abonne au flux des nouveaux cas ; renvoie la fonction de désabonnement."""
        self._listeners.append(listener)

        def unsubscribe() -> None:
            if listener in self._listeners:
                self._listeners.remove(listener)

        return unsubscribe

    def record(self, case: Case) -> bool:
        """Compte le cas ; `False` s'il a déjà été vu (idempotent)."""
        with self._lock:
            if case.case_id in self._seen:
                return False
            self._seen.add(case.case_id)
            self._counts[(case.pathology, case.district)][case.week] += 1
        for listener in list(self._listeners):
            listener(case)
        return True

    def cells(self) -> list[tuple[str, str]]:
        """Couples (pathologie, district) connus."""
        return sorted(self._counts)

    def count(self, pathology: str, district: str, week: date) -> int:
        cell = self._counts.get((pathology, district))
        return cell.get(week, 0) if cell else 0

    def latest_week(self) -> date | None:
        weeks = [w for cell in self._counts.values() for w in cell]
        return max(weeks) if weeks else None

    def threshold(self, pathology: str, district: str, week: date) -> Threshold:
        """Seuil de la semaine, calculé sur les 8 semaines précédentes (zéro si absentes)."""
        history = [self.count(pathology, district, week - timedelta(weeks=i))
                   for i in range(WINDOW_WEEKS, 0, -1)]
        return compute_threshold(history)

    def series(self, pathology: str, district: str, end: date, weeks: int = SERIES_WEEKS) -> list[dict]:
        """Série des `weeks` dernières semaines jusqu'à `end`, avec seuil et indicateur."""
        rows = []
        for i in range(weeks - 1, -1, -1):
            week = end - timedelta(weeks=i)
            cases = self.count(pathology, district, week)
            limit = self.threshold(pathology, district, week)
            rows.append({"week": week_label(week), "cases": cases, "expected": round(limit.expected, 1),
                         "threshold": round(limit.limit, 1), "anomaly": is_anomaly(cases, limit)})
        return rows
