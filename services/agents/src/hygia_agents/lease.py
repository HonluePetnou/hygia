"""Bail d'élection du coordinateur : interface, version mémoire et version DynamoDB."""
from __future__ import annotations

import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

CONDITION_FAILED = "ConditionalCheckFailedException"


@dataclass(frozen=True)
class Lease:
    """Bail en cours : détenteur et instant d'expiration (secondes epoch)."""

    holder: str
    expires_at: float


class LeaseStore(ABC):
    """Stockage de baux (équivalent local de la table DynamoDB `hygia-baux`)."""

    @abstractmethod
    def acquire(self, name: str, holder: str, ttl: float, now: float) -> bool:
        """Prend le bail s'il est libre ou expiré, ou le renouvelle s'il est déjà détenu."""

    @abstractmethod
    def release(self, name: str, holder: str) -> None:
        """Libère le bail si `holder` le détient."""

    @abstractmethod
    def current(self, name: str, now: float) -> Lease | None:
        """Bail non expiré, ou `None`."""


class InMemoryLeaseStore(LeaseStore):
    """Baux en mémoire, partageables entre plusieurs instances simulées d'un même processus."""

    def __init__(self) -> None:
        self._leases: dict[str, Lease] = {}
        self._lock = threading.Lock()

    def acquire(self, name: str, holder: str, ttl: float, now: float) -> bool:
        with self._lock:
            lease = self._leases.get(name)
            if lease is not None and lease.holder != holder and lease.expires_at > now:
                return False
            self._leases[name] = Lease(holder, now + ttl)
            return True

    def release(self, name: str, holder: str) -> None:
        with self._lock:
            lease = self._leases.get(name)
            if lease is not None and lease.holder == holder:
                del self._leases[name]

    def current(self, name: str, now: float) -> Lease | None:
        lease = self._leases.get(name)
        return lease if lease is not None and lease.expires_at > now else None


def _error_code(error: Exception) -> str:
    response = getattr(error, "response", None) or {}
    return str(response.get("Error", {}).get("Code", ""))


class DynamoDbLeaseStore(LeaseStore):
    """Baux dans DynamoDB (table `hygia-baux`, clé `pk`) par écriture conditionnelle.

    `client` est un client bas niveau compatible boto3 (`put_item`, `get_item`, `delete_item`).
    """

    CONDITION = "attribute_not_exists(pk) OR expires_at <= :now OR holder = :holder"

    def __init__(self, client: Any, table: str = "hygia-baux") -> None:
        self._client = client
        self._table = table

    def acquire(self, name: str, holder: str, ttl: float, now: float) -> bool:
        try:
            self._client.put_item(
                TableName=self._table,
                Item={"pk": {"S": f"lease#{name}"}, "holder": {"S": holder},
                      "expires_at": {"N": repr(now + ttl)}},
                ConditionExpression=self.CONDITION,
                ExpressionAttributeValues={":now": {"N": repr(now)}, ":holder": {"S": holder}},
            )
            return True
        except Exception as error:  # noqa: BLE001 - l'erreur boto3 se reconnaît à son code
            if _error_code(error) == CONDITION_FAILED:
                return False
            raise

    def release(self, name: str, holder: str) -> None:
        try:
            self._client.delete_item(
                TableName=self._table, Key={"pk": {"S": f"lease#{name}"}},
                ConditionExpression="holder = :holder",
                ExpressionAttributeValues={":holder": {"S": holder}},
            )
        except Exception as error:  # noqa: BLE001
            if _error_code(error) != CONDITION_FAILED:
                raise

    def current(self, name: str, now: float) -> Lease | None:
        item = self._client.get_item(TableName=self._table, Key={"pk": {"S": f"lease#{name}"}}).get("Item")
        if not item:
            return None
        lease = Lease(item["holder"]["S"], float(item["expires_at"]["N"]))
        return lease if lease.expires_at > now else None


def localstack_lease_store(endpoint: str = "http://localhost:4566") -> DynamoDbLeaseStore:
    """Baux sur le DynamoDB de LocalStack (nécessite `boto3`, absent des tests)."""
    import boto3  # import tardif : dépendance optionnelle

    client = boto3.client("dynamodb", endpoint_url=endpoint, region_name="eu-west-3",
                          aws_access_key_id="test", aws_secret_access_key="test")
    return DynamoDbLeaseStore(client)
