import json
import threading
import unittest
import urllib.request

import _setup  # noqa: F401
from hygia_agents import (
    DOCUMENT_NORMALIZED, PRESCRIPTION_CREATED, Agent, AgentRegistry, DetectedIssue, Event,
    InMemoryEventBus, default_registry,
)
from hygia_agents.http_bus import HttpEventBus

FLORENCE = {"id": "00000000-0000-4000-8000-000000000001", "age": 71}


def ibuprofene_event(allergies=None, drug="Ibuprofène", meds=None):
    return Event(PRESCRIPTION_CREATED, {
        "patient": FLORENCE,
        "prescription": {"drug": drug, "documentId": "doc-ordonnance", "documentTitle": "Ordonnance"},
        "activeMedications": meds if meds is not None else [
            {"drug": "Warfarine", "documentId": "doc-warfarine", "documentTitle": "Traitement"}],
        "allergies": allergies or [],
        "observations": [{"code": "INR", "value": 2.8, "targetHigh": 3.0, "documentId": "doc-bio"}],
    })


def run(event):
    bus = InMemoryEventBus()
    registry = default_registry(bus)
    bus.publish(event)
    return registry.issues


class PharmacovigilanceTest(unittest.TestCase):
    def test_ibuprofene_de_florence_est_critique(self):
        issues = run(ibuprofene_event())
        self.assertEqual(len(issues), 1)
        data = issues[0].to_json()
        self.assertEqual(data["severity"], "high")
        self.assertEqual(data["agent"], "pharmacovigilance")
        self.assertEqual([s["step"] for s in data["reasoning"]], [1, 2, 3, 4])
        self.assertEqual(len(data["sources"]), 3)
        self.assertEqual(data["decision"], {"status": "pending"})
        self.assertEqual(data["resourceType"], "DetectedIssue")

    def test_sans_contexte_la_gravite_reste_moderee(self):
        event = ibuprofene_event()
        event.payload["patient"] = {"id": "p2", "age": 40}
        event.payload["observations"] = []
        self.assertEqual(run(event)[0].severity, "moderate")

    def test_doublon_therapeutique_iec(self):
        event = ibuprofene_event(drug="Ramipril", meds=[{"drug": "Périndopril", "documentId": "d1"}])
        event.payload["observations"] = []
        issues = run(event)
        self.assertEqual(issues[0].severity, "moderate")  # base basse, relevée par l'âge (71 ans)
        self.assertIn("Doublon", issues[0].title)

    def test_amoxicilline_chez_un_allergique(self):
        event = ibuprofene_event(
            drug="Amoxicilline", meds=[],
            allergies=[{"substance": "Pénicilline", "documentId": "doc-allergie"}])
        issues = run(event)
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].severity, "high")
        self.assertIn("Pénicilline", issues[0].title)


class QualityTest(unittest.TestCase):
    def document_event(self, **doc):
        base = {"id": "d9", "title": "Bilan", "type": "biologie", "date": "2026-10-14", "patientId": "p1"}
        return Event(DOCUMENT_NORMALIZED, {
            "document": {**base, **doc},
            "observations": [{"code": "creatinine", "value": 1450, "unit": "µmol/L"}],
            "today": "2026-11-03",
        })

    def issues_of(self, agent, event):
        return [i for i in run(event) if i.agent == agent]

    def test_creatinine_aberrante_avec_correction(self):
        issues = self.issues_of("qualite", self.document_event())
        self.assertEqual(len(issues), 1)
        self.assertIn("1450", issues[0].title)
        self.assertIn("145", issues[0].proposal)

    def test_date_impossible_et_champ_manquant(self):
        titles = [i.title for i in self.issues_of("qualite", self.document_event(date="2027-01-01", type=""))]
        self.assertTrue(any("Date impossible" in t for t in titles))
        self.assertTrue(any("Champs manquants : type" in t for t in titles))


class TriageTest(unittest.TestCase):
    def test_classe_et_propose_le_patient(self):
        event = Event(DOCUMENT_NORMALIZED, {
            "document": {"id": "d1", "title": "Résultats de biologie", "text": "NGO BASSA Florence INR 2,8"},
            "candidates": [{"id": "p1", "name": "Florence Ngo Bassa", "ipp": "HYG-2024-00871"},
                           {"id": "p2", "name": "Paul Mbarga", "ipp": "HYG-2024-00002"}],
        })
        issue = [i for i in run(event) if i.agent == "tri"][0]
        self.assertIn("biologie", issue.title)
        self.assertEqual(issue.subject, "Patient/p1")


class RegistryTest(unittest.TestCase):
    def test_agent_ajoute_dynamiquement(self):
        class EchoAgent(Agent):
            name = "echo"
            event_type = "custom.event"

            def handle(self, event):
                return [DetectedIssue("echo", "low", "Écho", ["vu"], [], "rien", "Patient/x")]

        bus = InMemoryEventBus()
        registry = default_registry(bus)
        bus.publish(Event("custom.event"))
        self.assertEqual(registry.issues, [])
        registry.register(EchoAgent())
        bus.publish(Event("custom.event"))
        self.assertEqual([i.agent for i in registry.issues], ["echo"])
        self.assertEqual(len(registry.agents), 4)


class HttpBusTest(unittest.TestCase):
    def test_health_metrics_et_correlation_id(self):
        lines = []
        server = HttpEventBus(lambda bus: default_registry(bus), port=0, request_log=lines.append)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = f"http://127.0.0.1:{server.port}"
            req = urllib.request.Request(f"{base}/issues", headers={"x-correlation-id": "corr-7"})
            with urllib.request.urlopen(req) as res:
                self.assertEqual(res.headers["x-correlation-id"], "corr-7")
            with urllib.request.urlopen(f"{base}/health") as res:
                self.assertEqual(json.load(res), {"status": "ok", "service": "agents"})
            with urllib.request.urlopen(f"{base}/metrics") as res:
                metrics = json.load(res)
            self.assertEqual((metrics["service"], metrics["requests"], metrics["errors"]), ("agents", 1, 0))
            self.assertIn("p95Ms", metrics["latency"])
            self.assertEqual(lines[0]["correlationId"], "corr-7")
            self.assertEqual(lines[0]["path"], "/issues")
        finally:
            server.shutdown()

    def test_post_events_renvoie_les_alertes(self):
        server = HttpEventBus(lambda bus: default_registry(bus), port=0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            event = ibuprofene_event()
            body = json.dumps({"type": event.type, "payload": event.payload}).encode()
            req = urllib.request.Request(f"http://127.0.0.1:{server.port}/events", body,
                                         {"content-type": "application/json"})
            with urllib.request.urlopen(req) as res:
                self.assertEqual(res.status, 202)
                self.assertEqual(json.load(res)[0]["severity"], "high")
            with urllib.request.urlopen(f"http://127.0.0.1:{server.port}/issues") as res:
                self.assertEqual(len(json.load(res)), 1)
        finally:
            server.shutdown()


if __name__ == "__main__":
    unittest.main()
