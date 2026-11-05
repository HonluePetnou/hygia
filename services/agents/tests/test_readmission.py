import json
import threading
import unittest
import urllib.error
import urllib.request

import _setup  # noqa: F401
from hygia_agents import ReadmissionApi, ReadmissionModel, default_registry
from hygia_agents.http_bus import HttpEventBus
from hygia_agents.readmission_model import FACTORS, synthetic_dataset
from _tokens import bearer, verifier

FRAGILE = {"age": 82, "hospitalisations": 3, "traitements": 9, "insuffisanceCardiaque": 1, "diabete": 1}
ROBUSTE = {"age": 30, "hospitalisations": 0, "traitements": 1, "insuffisanceCardiaque": 0, "diabete": 0}


class Consents:
    def __init__(self, granted=True):
        self.granted = granted
        self.asked = []

    def allows(self, patient_id, purpose):
        self.asked.append((patient_id, purpose))
        return self.granted


class ModelTest(unittest.TestCase):
    def test_jeu_et_score_reproductibles(self):
        self.assertEqual(synthetic_dataset(), synthetic_dataset())
        a, b = ReadmissionModel.trained().predict(FRAGILE), ReadmissionModel.trained().predict(FRAGILE)
        self.assertEqual(a, b)
        self.assertTrue(0 <= a.score <= 1)

    def test_risque_ordonne_et_niveaux(self):
        model = ReadmissionModel.trained()
        fragile, robuste = model.predict(FRAGILE), model.predict(ROBUSTE)
        self.assertGreater(fragile.score, robuste.score)
        self.assertEqual(fragile.niveau, "eleve")
        self.assertEqual(robuste.niveau, "faible")

    def test_facteurs_tries_par_poids_decroissant(self):
        facteurs = ReadmissionModel.trained().predict(FRAGILE).facteurs
        self.assertEqual({f.code for f in facteurs}, set(FACTORS))
        poids = [abs(f.contribution) for f in facteurs]
        self.assertEqual(poids, sorted(poids, reverse=True))
        self.assertGreater(facteurs[0].contribution, 0)


class ApiTest(unittest.TestCase):
    def setUp(self):
        self.consents = Consents()
        self.api = ReadmissionApi(ReadmissionModel.trained(), self.consents)

    def test_reponse_et_consentement_verifie(self):
        status, body = self.api.handle({"patientId": "p1", "facteurs": FRAGILE}, "medecin")
        self.assertEqual(status, 200)
        self.assertEqual(set(body), {"score", "niveau", "facteurs"})
        self.assertEqual(set(body["facteurs"][0]), {"code", "libelle", "contribution"})
        self.assertEqual(self.consents.asked, [("p1", "statistiques")])

    def test_refus_si_consentement_statistiques_revoque(self):
        self.consents.granted = False
        status, body = self.api.handle({"patientId": "p1", "facteurs": FRAGILE}, "medecin")
        self.assertEqual(status, 403)
        self.assertNotIn("score", body)

    def test_donnee_identifiante_refusee_en_entree_du_modele(self):
        for extra in ("nom", "birthDate", "ipp"):
            status, _ = self.api.handle({"patientId": "p1", "facteurs": {**FRAGILE, extra: "x"}}, "medecin")
            self.assertEqual(status, 400, extra)
        self.assertEqual(self.api.handle({"patientId": "p1", "facteurs": {"age": 5}}, "medecin")[0], 400)

    def test_roles(self):
        self.assertEqual(self.api.handle({"patientId": "p1", "facteurs": FRAGILE}, None)[0], 401)
        self.assertEqual(self.api.handle({"patientId": "p1", "facteurs": FRAGILE}, "analyste")[0], 403)
        self.assertEqual(self.api.handle({"facteurs": FRAGILE}, "medecin")[0], 400)


class HttpTest(unittest.TestCase):
    def test_post_readmission(self):
        api = ReadmissionApi(ReadmissionModel.trained(), Consents())
        server = HttpEventBus(default_registry, port=0, readmission=api, verifier=verifier())
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            def call(role):
                headers = {"content-type": "application/json"}
                if role:
                    headers.update(bearer(role))
                payload = json.dumps({"patientId": "p", "facteurs": FRAGILE}).encode()
                request = urllib.request.Request(
                    f"http://127.0.0.1:{server.port}/readmission", method="POST", data=payload, headers=headers)
                try:
                    with urllib.request.urlopen(request) as response:
                        return response.status, json.loads(response.read())
                except urllib.error.HTTPError as error:
                    return error.code, None

            status, body = call("medecin")
            self.assertEqual(status, 200)
            self.assertEqual(body["niveau"], "eleve")
            self.assertEqual(call(None)[0], 401)
        finally:
            server.shutdown()


if __name__ == "__main__":
    unittest.main()
