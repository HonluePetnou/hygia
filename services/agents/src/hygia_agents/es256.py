"""Signatures ES256 (ECDSA P-256 + SHA-256), bibliothèque standard seule.

Le service Identité signe ses jetons en ES256 ; le service Agents vérifie ces signatures sans
dépendance externe. Seule la vérification sert en production (opération publique : pas de secret
manipulé) ; la signature n'existe que pour fabriquer des jetons dans les tests.
"""
from __future__ import annotations

import hashlib
import secrets

# Paramètres de la courbe P-256 (secp256r1, FIPS 186-4).
P = 0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF
A = P - 3
B = 0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B
N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551
G = (
    0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296,
    0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5,
)

Point = tuple[int, int] | None  # None : point à l'infini


def _add(p: Point, q: Point) -> Point:
    if p is None:
        return q
    if q is None:
        return p
    (x1, y1), (x2, y2) = p, q
    if x1 == x2 and (y1 + y2) % P == 0:
        return None
    if p == q:
        slope = (3 * x1 * x1 + A) * pow(2 * y1, -1, P) % P
    else:
        slope = (y2 - y1) * pow(x2 - x1, -1, P) % P
    x3 = (slope * slope - x1 - x2) % P
    return x3, (slope * (x1 - x3) - y1) % P


def _multiply(k: int, point: Point) -> Point:
    result: Point = None
    addend = point
    while k:
        if k & 1:
            result = _add(result, addend)
        addend = _add(addend, addend)
        k >>= 1
    return result


def on_curve(x: int, y: int) -> bool:
    """Le point (x, y) appartient-il à P-256 ? (refuse les clés publiques invalides)"""
    return 0 <= x < P and 0 <= y < P and (y * y - (x * x * x + A * x + B)) % P == 0


def _digest(message: bytes) -> int:
    return int.from_bytes(hashlib.sha256(message).digest(), "big")


def verify(public_key: tuple[int, int], message: bytes, signature: bytes) -> bool:
    """Vérifie une signature ES256 au format JWS (r ‖ s, 64 octets)."""
    if len(signature) != 64 or not on_curve(*public_key):
        return False
    r = int.from_bytes(signature[:32], "big")
    s = int.from_bytes(signature[32:], "big")
    if not (1 <= r < N and 1 <= s < N):
        return False
    w = pow(s, -1, N)
    point = _add(_multiply(_digest(message) * w % N, G), _multiply(r * w % N, public_key))
    return point is not None and point[0] % N == r


def generate_private_key() -> int:
    """Clé privée aléatoire (tests)."""
    return secrets.randbelow(N - 1) + 1


def public_key_of(private_key: int) -> tuple[int, int]:
    point = _multiply(private_key, G)
    assert point is not None
    return point


def sign(private_key: int, message: bytes) -> bytes:
    """Signature ES256 r ‖ s (tests seulement : fabrique des jetons d'Identité factices)."""
    z = _digest(message)
    while True:
        k = secrets.randbelow(N - 1) + 1
        point = _multiply(k, G)
        assert point is not None
        r = point[0] % N
        s = pow(k, -1, N) * (z + r * private_key) % N
        if r and s:
            return r.to_bytes(32, "big") + s.to_bytes(32, "big")
