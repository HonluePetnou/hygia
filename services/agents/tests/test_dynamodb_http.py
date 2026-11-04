"""Client DynamoDB en bibliothèque standard : signature SigV4 et baux sur LocalStack."""
import _setup  # noqa: F401
import os
import time
import unittest
import uuid
from datetime import datetime, timezone

from hygia_agents.dynamodb_http import DynamoDbHttpClient, sigv4_headers
from hygia_agents.lease import DynamoDbLeaseStore


class SigV4Test(unittest.TestCase):
    def test_vecteur_officiel_aws_get_vanilla(self):
        # Suite de tests publiée par AWS (aws-sig-v4-test-suite, cas « get-vanilla »).
        headers = sigv4_headers(
            method="GET", url="https://example.amazonaws.com/", headers={}, body=b"",
            region="us-east-1", service="service",
            access_key="AKIDEXAMPLE", secret_key="wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
            now=datetime(2015, 8, 30, 12, 36, 0, tzinfo=timezone.utc),
        )
        self.assertEqual(
            headers["authorization"],
            "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, "
            "SignedHeaders=host;x-amz-date, "
            "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
        )


ENDPOINT = os.environ.get("HYGIA_LOCALSTACK_URL")


@unittest.skipUnless(ENDPOINT, "LocalStack non fourni (HYGIA_LOCALSTACK_URL)")
class LocalStackLeaseTest(unittest.TestCase):
    def test_election_sur_dynamodb_localstack(self):
        store = DynamoDbLeaseStore(DynamoDbHttpClient(ENDPOINT, "eu-west-3", "test", "test"))
        name, now = f"test-{uuid.uuid4()}", time.time()
        self.assertTrue(store.acquire(name, "a", 30, now))
        self.assertFalse(store.acquire(name, "b", 30, now + 1))  # bail tenu par a
        self.assertEqual(store.current(name, now + 1).holder, "a")
        self.assertTrue(store.acquire(name, "b", 30, now + 31))  # bail expiré
        store.release(name, "b")
        self.assertIsNone(store.current(name, now + 32))


if __name__ == "__main__":
    unittest.main()
