"""Jetons d'Identité factices pour les tests : clé ES256 de test, JWKS et vérificateur associés."""
import _setup  # noqa: F401
import base64
import json
import time

from hygia_agents import es256
from hygia_agents.auth import TokenVerifier

KID = "test-1"
_PRIVATE = es256.generate_private_key()
_X, _Y = es256.public_key_of(_PRIVATE)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


JWKS = {"keys": [{
    "kty": "EC", "crv": "P-256", "kid": KID, "alg": "ES256", "use": "sig",
    "x": _b64(_X.to_bytes(32, "big")), "y": _b64(_Y.to_bytes(32, "big")),
}]}


def make_token(role: str, *, exp: float | None = None, kid: str = KID, alg: str = "ES256",
               private_key: int = _PRIVATE) -> str:
    header = _b64(json.dumps({"alg": alg, "kid": kid}).encode())
    claims = {"sub": "00000000-0000-4000-8000-020000000001", "role": role,
              "teams": [], "emergency": [], "exp": exp if exp is not None else time.time() + 600}
    payload = _b64(json.dumps(claims).encode())
    signature = _b64(es256.sign(private_key, f"{header}.{payload}".encode()))
    return f"{header}.{payload}.{signature}"


def verifier() -> TokenVerifier:
    return TokenVerifier(lambda: JWKS)


def bearer(role: str) -> dict[str, str]:
    return {"authorization": f"Bearer {make_token(role)}"}
