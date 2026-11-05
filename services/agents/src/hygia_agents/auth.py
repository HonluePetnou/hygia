"""Vérification des jetons d'accès émis par le service Identité (ES256, clé publique JWKS).

Le rôle de l'appelant vient du jeton signé, jamais d'un en-tête : appeler le port 3007
directement avec `x-user-role: analyste` ne donne plus aucun droit.
"""
from __future__ import annotations

import base64
import json
import threading
import time
import urllib.request
from typing import Callable

from . import es256

ROLES = {"medecin", "infirmier", "administratif", "analyste", "patient", "admin", "auditeur"}


class TokenError(Exception):
    """Jeton absent, mal formé, mal signé ou expiré."""


def _b64url(part: str) -> bytes:
    return base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))


def _json(part: str) -> dict:
    try:
        value = json.loads(_b64url(part))
    except (ValueError, UnicodeDecodeError) as error:
        raise TokenError("jeton mal formé") from error
    if not isinstance(value, dict):
        raise TokenError("jeton mal formé")
    return value


class TokenVerifier:
    """Vérifie un jeton ES256 avec le JWKS de l'Identité ; recharge le JWKS si la clé est inconnue."""

    def __init__(self, fetch_jwks: Callable[[], dict], now: Callable[[], float] = time.time) -> None:
        self._fetch = fetch_jwks
        self._now = now
        self._keys: dict[str, tuple[int, int]] = {}
        self._lock = threading.Lock()

    @classmethod
    def remote(cls, jwks_url: str) -> "TokenVerifier":
        def fetch() -> dict:
            with urllib.request.urlopen(jwks_url, timeout=5) as response:
                return json.load(response)
        return cls(fetch)

    def _key(self, kid: str) -> tuple[int, int]:
        with self._lock:
            if kid not in self._keys:
                try:
                    jwks = self._fetch()
                except OSError as error:
                    raise TokenError("clé publique de l'Identité injoignable") from error
                for jwk in jwks.get("keys", []):
                    if jwk.get("kty") == "EC" and jwk.get("crv") == "P-256" and "kid" in jwk:
                        x = int.from_bytes(_b64url(jwk["x"]), "big")
                        y = int.from_bytes(_b64url(jwk["y"]), "big")
                        if es256.on_curve(x, y):
                            self._keys[jwk["kid"]] = (x, y)
            if kid not in self._keys:
                raise TokenError("clé de signature inconnue")
            return self._keys[kid]

    def verify(self, token: str) -> dict:
        """Revendications du jeton (`sub`, `role`…) ; `TokenError` s'il n'est pas valide."""
        parts = token.split(".")
        if len(parts) != 3:
            raise TokenError("jeton mal formé")
        header, claims = _json(parts[0]), _json(parts[1])
        if header.get("alg") != "ES256":
            raise TokenError("algorithme refusé")
        try:
            signature = _b64url(parts[2])
        except ValueError as error:
            raise TokenError("jeton mal formé") from error
        key = self._key(str(header.get("kid", "")))
        if not es256.verify(key, f"{parts[0]}.{parts[1]}".encode(), signature):
            raise TokenError("signature invalide")
        exp = claims.get("exp")
        if not isinstance(exp, (int, float)) or exp <= self._now():
            raise TokenError("jeton expiré")
        if not isinstance(claims.get("sub"), str) or claims.get("role") not in ROLES:
            raise TokenError("revendications invalides")
        return claims


def role_from(authorization: str | None, verifier: TokenVerifier | None) -> str | None:
    """Rôle de l'appelant d'après son jeton `Bearer` ; `None` si absent ou invalide."""
    if verifier is None or not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return verifier.verify(authorization.removeprefix("Bearer ").strip())["role"]
    except TokenError:
        return None
