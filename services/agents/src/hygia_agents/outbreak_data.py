"""Jeu fictif : paludisme stable dans 12 villes du Cameroun, foyer de choléra à Mora."""
from __future__ import annotations

from datetime import date

from .models import Event
from .veille import DIAGNOSTIC_RECORDED

CITIES = ("Yaoundé", "Douala", "Garoua", "Bamenda", "Maroua", "Bafoussam", "Ngaoundéré",
          "Bertoua", "Buea", "Ebolowa", "Kribi", "Mora")
YEAR = 2026
FOCUS_WEEK = 44
# Mora, choléra, semaines 36 à 43 : moyenne 3,25 (3,2 attendus), σ ≈ 1,92, seuil ≈ 7,1.
MORA_CHOLERA_HISTORY = (2, 0, 5, 3, 5, 1, 5, 5)
MORA_CHOLERA_FOCUS = 14


def _cases(prefix: str, pathology: str, district: str, week: int, count: int) -> list[Event]:
    day = date.fromisocalendar(YEAR, week, 3).isoformat()
    return [Event(DIAGNOSTIC_RECORDED, {"caseId": f"{prefix}-{week}-{n}", "pathology": pathology,
                                        "district": district, "date": day}) for n in range(count)]


def demo_events(with_focus: bool = True) -> list[Event]:
    """Semaines 36 à 44 : bruit de fond stable partout, plus le foyer de Mora si demandé."""
    events: list[Event] = []
    for week in range(FOCUS_WEEK - 8, FOCUS_WEEK + 1):
        for i, city in enumerate(CITIES):
            events += _cases(f"pal-{city}", "paludisme", city, week, 6 + i % 4 + (week + i) % 3 - 1)
        if week < FOCUS_WEEK:
            events += _cases("cho-Mora", "choléra", "Mora", week, MORA_CHOLERA_HISTORY[week - 36])
        elif with_focus:
            events += _cases("cho-Mora", "choléra", "Mora", week, MORA_CHOLERA_FOCUS)
    return events
