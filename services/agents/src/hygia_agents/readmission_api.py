"""Endpoint `POST /readmission` : risque de réadmission à 30 jours, sous consentement « statistiques »."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from typing import Any, Protocol

from .readmission_model import ReadmissionModel, parse_factors

ALLOWED_ROLES = ("medecin", "infirmier")


class ConsentGate(Protocol):
    """Vérifie un consentement auprès du service Dossiers (propriétaire de la ressource `Consent`)."""

    def allows(self, patient_id: str, purpose: str) -> bool: ...


class HttpConsentGate:
    """`GET /internal/consents/:patientId/:purpose` ; en cas de doute, refuse (échec fermé)."""

    def __init__(self, dossiers_url: str, internal_key: str, timeout: float = 3.0) -> None:
        self._url = dossiers_url.rstrip("/")
        self._key = internal_key
        self._timeout = timeout

    def allows(self, patient_id: str, purpose: str) -> bool:
        url = f"{self._url}/internal/consents/{urllib.parse.quote(patient_id, safe='')}/{purpose}"
        try:
            request = urllib.request.Request(url, headers={"x-internal-key": self._key})
            with urllib.request.urlopen(request, timeout=self._timeout) as response:  # noqa: S310
                return json.loads(response.read()).get("granted") is True
        except (OSError, ValueError):
            return False


class ReadmissionApi:
    """Reçoit `{ patientId, facteurs }` ; le modèle ne reçoit que `facteurs` (pas d'identifiant)."""

    def __init__(self, model: ReadmissionModel, consents: ConsentGate) -> None:
        self._model = model
        self._consents = consents

    def handle(self, body: Any, role: str | None) -> tuple[int, Any]:
        """Renvoie (statut, corps JSON). Le rôle vient de l'en-tête posé par le broker."""
        if role is None:
            return 401, {"error": "authentification requise"}
        if role not in ALLOWED_ROLES:
            return 403, {"error": "rôle médecin ou infirmier requis"}
        if not isinstance(body, dict) or not isinstance(body.get("patientId"), str) or not body["patientId"]:
            return 400, {"error": "patientId requis"}
        try:
            factors = parse_factors(body.get("facteurs"))
        except ValueError as error:
            return 400, {"error": str(error)}
        if not self._consents.allows(body["patientId"], "statistiques"):
            return 403, {"error": "consentement « statistiques » absent ou révoqué"}
        prediction = self._model.predict(factors)
        return 200, {
            "score": prediction.score,
            "niveau": prediction.niveau,
            "facteurs": [{"code": f.code, "libelle": f.libelle, "contribution": f.contribution}
                         for f in prediction.facteurs],
        }
