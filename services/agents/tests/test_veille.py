import json
import threading
import unittest
import urllib.error
import urllib.request
from urllib.parse import quote

import _setup  # noqa: F401
from hygia_agents import (
    AnalyticsApi, CaseStore, Coordinator, DynamoDbLeaseStore, Event, InMemoryEventBus,
    InMemoryLeaseStore, VeilleAgent,
)
from hygia_agents.http_bus import HttpEventBus
from hygia_agents.outbreak_data import CITIES, demo_events
from hygia_agents.surveillance import compute_threshold, parse_week


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def instance(leases, name, clock, events):
    store = CaseStore()
    agent = VeilleAgent(store, Coordinator(leases, name, ttl=30, clock=clock))
    for event in events:
        agent.handle(event)
    return agent


class DetectionTest(unittest.TestCase):
    def test_foyer_de_mora(self):
        agent = instance(InMemoryLeaseStore(), "a", Clock(), demo_events())
        issues = agent.analyse()
        self.assertEqual(len(issues), 1)
        data = issues[0].to_json()
        self.assertEqual(data["title"], "Foyer anormal : choléra à Mora")
        self.assertIn("14 cas", data["reasoning"][0]["text"])
        self.assertIn("3.2 cas attendus", data["reasoning"][1]["text"])
        self.assertIn("7.1", data["reasoning"][2]["text"])
        self.assertEqual(agent.analyse(), [])  # idempotent

    def test_seuil_de_mora(self):
        limit = compute_threshold([2, 0, 5, 3, 5, 1, 5, 5])
        self.assertEqual(f"{limit.expected:.1f}", "3.2")
        self.assertEqual(f"{limit.limit:.1f}", "7.1")

    def test_aucun_foyer_sur_serie_stable(self):
        agent = instance(InMemoryLeaseStore(), "a", Clock(), demo_events(with_focus=False))
        self.assertEqual(agent.analyse(), [])

    def test_douze_villes(self):
        self.assertEqual(len(set(CITIES)), 12)

    def test_donnee_identifiante_refusee(self):
        agent = instance(InMemoryLeaseStore(), "a", Clock(), [])
        bad = Event("diagnostic.recorded", {"caseId": "x", "pathology": "choléra", "district": "Mora",
                                            "date": "2026-10-28", "name": "BASSA NGO"})
        with self.assertRaises(ValueError):
            agent.handle(bad)


class ElectionTest(unittest.TestCase):
    def test_une_seule_instance_calcule_puis_bascule(self):
        clock, leases = Clock(), InMemoryLeaseStore()
        a = instance(leases, "a", clock, demo_events())
        b = instance(leases, "b", clock, demo_events())
        self.assertEqual(len(a.analyse()), 1)
        self.assertEqual(b.analyse(), [])
        clock.now += 20  # a renouvelle avant expiration
        self.assertEqual(a.analyse(), [])
        self.assertEqual(b.analyse(), [])
        clock.now += 31  # a ne renouvelle plus : le bail expire
        self.assertEqual(len(b.analyse()), 1)
        self.assertEqual(a.analyse(), [])  # a n'est plus élu


class FakeDynamo:
    """Simule la condition d'écriture de `DynamoDbLeaseStore.CONDITION`."""

    class Failed(Exception):
        response = {"Error": {"Code": "ConditionalCheckFailedException"}}

    def __init__(self):
        self.items = {}

    def put_item(self, TableName, Item, ConditionExpression, ExpressionAttributeValues):
        pk, old = Item["pk"]["S"], self.items.get(Item["pk"]["S"])
        if old and float(old["expires_at"]["N"]) > float(ExpressionAttributeValues[":now"]["N"]) \
                and old["holder"]["S"] != ExpressionAttributeValues[":holder"]["S"]:
            raise self.Failed()
        self.items[pk] = Item

    def get_item(self, TableName, Key):
        item = self.items.get(Key["pk"]["S"])
        return {"Item": item} if item else {}

    def delete_item(self, TableName, Key, ConditionExpression, ExpressionAttributeValues):
        item = self.items.get(Key["pk"]["S"])
        if not item or item["holder"]["S"] != ExpressionAttributeValues[":holder"]["S"]:
            raise self.Failed()
        del self.items[Key["pk"]["S"]]


class DynamoLeaseTest(unittest.TestCase):
    def test_bail_dynamodb(self):
        store = DynamoDbLeaseStore(FakeDynamo())
        self.assertTrue(store.acquire("l", "a", 30, 100))
        self.assertFalse(store.acquire("l", "b", 30, 110))
        self.assertTrue(store.acquire("l", "a", 30, 120))  # renouvellement
        self.assertEqual(store.current("l", 130).holder, "a")
        self.assertTrue(store.acquire("l", "b", 30, 151))  # expiré
        store.release("l", "a")  # sans effet : a n'est plus détenteur
        self.assertEqual(store.current("l", 160).holder, "b")
        store.release("l", "b")
        self.assertIsNone(store.current("l", 160))


class ApiTest(unittest.TestCase):
    def setUp(self):
        self.agent = instance(InMemoryLeaseStore(), "a", Clock(), demo_events())
        self.server = HttpEventBus(lambda bus: __import__("hygia_agents").default_registry(bus), port=0,
                                   analytics=AnalyticsApi(self.agent.store))
        self.server.registry.register(self.agent)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.server.port}"

    def tearDown(self):
        self.server.shutdown()

    def get(self, path, role="analyste"):
        headers = {"x-user-role": role} if role else {}
        try:
            with urllib.request.urlopen(urllib.request.Request(self.base + quote(path, safe="/?&="), headers=headers)) as res:
                return res.status, json.load(res)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)

    def test_roles(self):
        self.assertEqual(self.get("/analyse/foyers", None)[0], 401)
        self.assertEqual(self.get("/analyse/foyers", "medecin")[0], 403)
        self.assertEqual(self.get("/analyse/foyers")[0], 200)

    def test_cas_serie_districts_foyers(self):
        _, cas = self.get("/analyse/cas?pathologie=choléra")
        self.assertEqual(cas["rows"], [{"pathology": "choléra", "district": "Mora", "cases": 14}])
        _, serie = self.get("/analyse/serie?pathologie=choléra&district=Mora")
        self.assertEqual(len(serie["series"]), 12)
        last = serie["series"][-1]
        self.assertEqual((last["week"], last["cases"], last["anomaly"]), ("2026-W44", 14, True))
        self.assertEqual(last["threshold"], 7.1)
        _, top = self.get("/analyse/districts?limite=3")
        self.assertEqual(top["districts"][0]["district"], "Mora")
        self.assertTrue(top["districts"][0]["outbreak"])
        self.assertEqual(len(top["districts"]), 3)
        _, foyers = self.get("/analyse/foyers")
        self.assertEqual([f["district"] for f in foyers["outbreaks"]], ["Mora"])
        self.assertEqual(self.get("/analyse/serie")[0], 400)

    def test_reponses_sans_donnee_identifiante(self):
        def keys(node):
            if isinstance(node, dict):
                for k, v in node.items():
                    yield k.lower()
                    yield from keys(v)
            elif isinstance(node, list):
                for v in node:
                    yield from keys(v)

        found = set()
        for path in ("cas", "serie?pathologie=choléra&district=Mora", "districts", "foyers"):
            found |= set(keys(self.get("/analyse/" + path)[1]))
        for forbidden in ("ipp", "patient", "patientid", "name", "nom", "prenom", "caseid", "pseudonym"):
            self.assertNotIn(forbidden, found)

    def test_flux_sse_des_nouveaux_cas(self):
        req = urllib.request.Request(self.base + "/analyse/flux", headers={"x-user-role": "analyste"})
        with urllib.request.urlopen(req) as res:
            self.assertEqual(res.headers["content-type"], "text/event-stream")
            self.server.publish(Event("diagnostic.recorded", {
                "caseId": "nouveau", "pathology": "choléra", "district": "Mora", "date": "2026-11-02"}))
            self.assertEqual(res.readline().decode().strip(), "event: cas")
            data = json.loads(res.readline().decode().removeprefix("data: "))
            self.assertEqual(data, {"pathology": "choléra", "district": "Mora", "week": "2026-W45"})

    def test_evenement_non_pseudonymise_renvoie_400(self):
        body = json.dumps({"type": "diagnostic.recorded", "payload": {
            "caseId": "z", "pathology": "choléra", "district": "Mora", "date": "2026-11-02", "ipp": "IPP-1"}}).encode()
        req = urllib.request.Request(self.base + "/events", body, {"content-type": "application/json"})
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req)
        self.assertEqual(ctx.exception.code, 400)


class WeekTest(unittest.TestCase):
    def test_parse_week(self):
        self.assertEqual(parse_week("2026-W44").isoformat(), "2026-10-26")


if __name__ == "__main__":
    unittest.main()
