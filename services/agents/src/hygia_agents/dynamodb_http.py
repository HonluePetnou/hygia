"""Client DynamoDB minimal, bibliothèque standard seule (le service Agents n'a aucune dépendance).

API JSON de DynamoDB (`X-Amz-Target: DynamoDB_20120810.<Action>`) signée en AWS Signature V4 :
fonctionne avec LocalStack comme avec AWS. Les erreurs exposent `response["Error"]["Code"]`,
comme boto3, pour que `DynamoDbLeaseStore` reconnaisse un échec de condition.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Callable
from urllib.parse import urlsplit


class DynamoDbError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.response = {"Error": {"Code": code, "Message": message}}


def _hmac(key: bytes, text: str) -> bytes:
    return hmac.new(key, text.encode(), hashlib.sha256).digest()


def sigv4_headers(
    *, method: str, url: str, headers: dict[str, str], body: bytes, region: str, service: str,
    access_key: str, secret_key: str, now: datetime, session_token: str | None = None,
) -> dict[str, str]:
    """En-têtes signés (AWS Signature V4) : `x-amz-date`, `authorization`…"""
    parts = urlsplit(url)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    day = amz_date[:8]
    signed = {**{k.lower(): v.strip() for k, v in headers.items()}, "host": parts.netloc, "x-amz-date": amz_date}
    if session_token:
        signed["x-amz-security-token"] = session_token
    names = sorted(signed)
    canonical = "\n".join([
        method,
        parts.path or "/",
        parts.query,
        "".join(f"{name}:{signed[name]}\n" for name in names),
        ";".join(names),
        hashlib.sha256(body).hexdigest(),
    ])
    scope = f"{day}/{region}/{service}/aws4_request"
    to_sign = "\n".join(["AWS4-HMAC-SHA256", amz_date, scope, hashlib.sha256(canonical.encode()).hexdigest()])
    key = _hmac(_hmac(_hmac(_hmac(f"AWS4{secret_key}".encode(), day), region), service), "aws4_request")
    signature = hmac.new(key, to_sign.encode(), hashlib.sha256).hexdigest()
    signed["authorization"] = (
        f"AWS4-HMAC-SHA256 Credential={access_key}/{scope}, SignedHeaders={';'.join(names)}, Signature={signature}"
    )
    return signed


class DynamoDbHttpClient:
    """Sous-ensemble de l'API DynamoDB utilisé par les baux : `put_item`, `get_item`, `delete_item`."""

    def __init__(self, endpoint: str, region: str, access_key: str, secret_key: str,
                 session_token: str | None = None,
                 now: Callable[[], datetime] = lambda: datetime.now(timezone.utc)) -> None:
        self._endpoint = endpoint.rstrip("/") + "/"
        self._region = region
        self._credentials = (access_key, secret_key, session_token)
        self._now = now

    @classmethod
    def from_environment(cls, endpoint: str | None = None) -> "DynamoDbHttpClient":
        """LocalStack (`endpoint` donné, identifiants `test`) ou AWS (variables `AWS_*`)."""
        region = os.environ.get("AWS_REGION", "eu-west-3")
        return cls(
            endpoint or f"https://dynamodb.{region}.amazonaws.com",
            region,
            os.environ.get("AWS_ACCESS_KEY_ID", "test"),
            os.environ.get("AWS_SECRET_ACCESS_KEY", "test"),
            os.environ.get("AWS_SESSION_TOKEN"),
        )

    def _call(self, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps(payload).encode()
        access_key, secret_key, token = self._credentials
        headers = sigv4_headers(
            method="POST", url=self._endpoint, body=body, region=self._region, service="dynamodb",
            access_key=access_key, secret_key=secret_key, session_token=token, now=self._now(),
            headers={"content-type": "application/x-amz-json-1.0",
                     "x-amz-target": f"DynamoDB_20120810.{action}"},
        )
        headers.pop("host")
        request = urllib.request.Request(self._endpoint, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                return json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as error:
            with error:
                detail = json.loads(error.read() or b"{}")
            code = str(detail.get("__type", "")).rsplit("#", 1)[-1] or f"HTTP{error.code}"
            raise DynamoDbError(code, str(detail.get("message", detail.get("Message", "")))) from error

    def put_item(self, **kwargs: Any) -> dict[str, Any]:
        return self._call("PutItem", kwargs)

    def get_item(self, **kwargs: Any) -> dict[str, Any]:
        return self._call("GetItem", kwargs)

    def delete_item(self, **kwargs: Any) -> dict[str, Any]:
        return self._call("DeleteItem", kwargs)
