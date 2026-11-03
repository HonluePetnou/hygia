"""Modèle de risque de réadmission à 30 jours : régression logistique explicable (RF12, section 8.6).

Aide à la décision uniquement. Le modèle ne voit que des facteurs cliniques anonymes (jamais de nom,
d'identifiant ni de date de naissance) ; en production : gradient boosting sur SageMaker + SHAP.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass

#: Facteurs d'entrée (liste blanche) : code -> libellé français renvoyé par l'endpoint.
FACTORS: dict[str, str] = {
    "age": "Âge",
    "hospitalisations": "Hospitalisations des 12 derniers mois",
    "traitements": "Nombre de traitements en cours",
    "insuffisanceCardiaque": "Insuffisance cardiaque",
    "diabete": "Diabète",
}
_BINARY = {"insuffisanceCardiaque", "diabete"}
#: Coefficients « réels » du générateur fictif (log-odds par unité) et ordonnée à l'origine.
_TRUE_WEIGHTS = {"age": 0.03, "hospitalisations": 0.55, "traitements": 0.18,
                 "insuffisanceCardiaque": 1.1, "diabete": 0.5}
_TRUE_BIAS = -4.6
SEED = 2026


def synthetic_dataset(size: int = 600, seed: int = SEED) -> list[tuple[dict[str, float], int]]:
    """Jeu fictif reproductible (graine fixée) : même contenu à chaque appel."""
    rng = random.Random(seed)
    rows = []
    for _ in range(size):
        x = {
            "age": float(min(95, max(18, round(rng.gauss(58, 18))))),
            "hospitalisations": float(min(6, int(rng.expovariate(1.2)))),
            "traitements": float(min(12, max(0, round(rng.gauss(4, 2.5))))),
            "insuffisanceCardiaque": 1.0 if rng.random() < 0.15 else 0.0,
            "diabete": 1.0 if rng.random() < 0.22 else 0.0,
        }
        z = _TRUE_BIAS + sum(_TRUE_WEIGHTS[k] * v for k, v in x.items())
        rows.append((x, 1 if rng.random() < _sigmoid(z) else 0))
    return rows


@dataclass(frozen=True)
class Contribution:
    """Part d'un facteur dans le score, en log-odds par rapport au patient moyen."""
    code: str
    libelle: str
    contribution: float


@dataclass(frozen=True)
class Prediction:
    """Score (probabilité 0-1), niveau et facteurs triés par poids décroissant."""
    score: float
    niveau: str
    facteurs: list[Contribution]


class ReadmissionModel:
    """Régression logistique entraînée par descente de gradient sur variables centrées-réduites."""

    def __init__(self) -> None:
        self._means: dict[str, float] = {}
        self._stds: dict[str, float] = {}
        self._weights: dict[str, float] = {k: 0.0 for k in FACTORS}
        self._bias = 0.0

    @classmethod
    def trained(cls, size: int = 600, seed: int = SEED) -> "ReadmissionModel":
        """Modèle entraîné sur le jeu fictif reproductible."""
        model = cls()
        model.fit(synthetic_dataset(size, seed))
        return model

    def fit(self, rows: list[tuple[dict[str, float], int]], epochs: int = 400, rate: float = 0.3) -> None:
        """Entraîne le modèle (déterministe : ordre des données et calculs fixes)."""
        n = len(rows)
        for k in FACTORS:
            values = [r[0][k] for r in rows]
            mean = sum(values) / n
            self._means[k] = mean
            self._stds[k] = math.sqrt(sum((v - mean) ** 2 for v in values) / n) or 1.0
        data = [({k: (x[k] - self._means[k]) / self._stds[k] for k in FACTORS}, y) for x, y in rows]
        for _ in range(epochs):
            grad = {k: 0.0 for k in FACTORS}
            grad_b = 0.0
            for z, y in data:
                err = _sigmoid(self._bias + sum(self._weights[k] * z[k] for k in FACTORS)) - y
                grad_b += err
                for k in FACTORS:
                    grad[k] += err * z[k]
            self._bias -= rate * grad_b / n
            for k in FACTORS:
                self._weights[k] -= rate * grad[k] / n

    def predict(self, facteurs: dict[str, float]) -> Prediction:
        """Calcule le score et la contribution de chaque facteur (poids × écart à la moyenne)."""
        z = {k: (facteurs[k] - self._means[k]) / self._stds[k] for k in FACTORS}
        contributions = [Contribution(k, FACTORS[k], round(self._weights[k] * z[k], 4)) for k in FACTORS]
        contributions.sort(key=lambda c: (-abs(c.contribution), c.code))
        score = round(_sigmoid(self._bias + sum(self._weights[k] * z[k] for k in FACTORS)), 4)
        return Prediction(score, level_of(score), contributions)


def level_of(score: float) -> str:
    """Niveau de risque : faible (< 15 %), modéré (< 30 %), élevé."""
    return "faible" if score < 0.15 else "modere" if score < 0.30 else "eleve"


def parse_factors(raw: object) -> dict[str, float]:
    """Valide l'entrée : exactement les facteurs de la liste blanche, valeurs numériques plausibles."""
    if not isinstance(raw, dict):
        raise ValueError("facteurs requis")
    unknown = set(raw) - set(FACTORS)
    if unknown:
        raise ValueError(f"facteur non admis : {sorted(unknown)[0]}")
    missing = set(FACTORS) - set(raw)
    if missing:
        raise ValueError(f"facteur manquant : {sorted(missing)[0]}")
    parsed: dict[str, float] = {}
    for key, value in raw.items():
        if isinstance(value, bool):
            value = int(value)
        if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0 or value > 150:
            raise ValueError(f"valeur invalide pour {key}")
        if key in _BINARY and value not in (0, 1):
            raise ValueError(f"valeur invalide pour {key}")
        parsed[key] = float(value)
    return parsed


def _sigmoid(z: float) -> float:
    return 1 / (1 + math.exp(-max(-60.0, min(60.0, z))))
