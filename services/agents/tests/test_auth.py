"""Le rôle vient du jeton signé par l'Identité, jamais de l'en-tête `x-user-role`."""
import _setup  # noqa: F401
import json
import pathlib
import threading
import unittest
import urllib.error
import urllib.request

from _tokens import JWKS, bearer, make_token, verifier

from hygia_agents import AnalyticsApi, CaseStore, default_registry, es256
from hygia_agents.auth import TokenError, TokenVerifier
from hygia_agents.http_bus import HttpEventBus

FIXTURE = json.loads((pathlib.Path(__file__).parent / "fixture_jeton_identite.json").read_text("utf-8"))


class Es256Test(unittest.TestCase):
    def test_signature_verifiee_et_alteration_detectee(self):
        key = es256.generate_private_key()
        public = es256.public_key_of(key)
        signature = es256.sign(key, b"message")
        self.assertTrue(es256.verify(public, b"message", signature))
        self.assertFalse(es256.verify(public, b"message modifie", signature))
        self.assertFalse(es256.verify(public, b"message", signature[:-1] + bytes([signature[-1] ^ 1])))


class VerifierTest(unittest.TestCase):
    def test_jeton_valide(self):
        self.assertEqual(verifier().verify(make_token("analyste"))["role"], "analyste")

    def test_refus(self):
        other_key = es256.generate_private_key()
        cases = {
            "expiré": make_token("analyste", exp=1),
            "autre clé": make_token("analyste", private_key=other_key),
            "kid inconnu": make_token("analyste", kid="inconnu"),
            "alg none": make_token("analyste", alg="none"),
            "mal formé": "abc.def",
        }
        for label, token in cases.items():
            with self.subTest(label), self.assertRaises(TokenError):
                verifier().verify(token)

    def test_jeton_reel_emis_par_le_code_de_l_identite(self):
        # Jeton produit par TokenIssuer (@hygia/auth, celui du service Identité) : même format.
        now = FIXTURE["now"]
        real = TokenVerifier(lambda: FIXTURE["jwks"], now=lambda: now + 60)
        self.assertEqual(real.verify(FIXTURE["token"])["role"], "analyste")
        expired = TokenVerifier(lambda: FIXTURE["jwks"], now=lambda: now + 3600)
        with self.assertRaises(TokenError):
            expired.verify(FIXTURE["token"])


class HttpTest(unittest.TestCase):
    def setUp(self):
        self.server = HttpEventBus(default_registry, port=0, analytics=AnalyticsApi(CaseStore()),
                                   verifier=verifier())
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown()

    def status(self, headers):
        request = urllib.request.Request(f"http://127.0.0.1:{self.server.port}/analyse/foyers", headers=headers)
        try:
            with urllib.request.urlopen(request) as response:
                return response.status
        except urllib.error.HTTPError as error:
            return error.code

    def test_en_tete_x_user_role_seul_ne_donne_aucun_droit(self):
        self.assertEqual(self.status({"x-user-role": "analyste"}), 401)

    def test_en_tete_x_user_role_ne_remplace_pas_le_role_du_jeton(self):
        self.assertEqual(self.status({**bearer("medecin"), "x-user-role": "analyste"}), 403)

    def test_jeton_analyste(self):
        self.assertEqual(self.status(bearer("analyste")), 200)

    def test_sans_verificateur_aucun_acces(self):
        server = HttpEventBus(default_registry, port=0, analytics=AnalyticsApi(CaseStore()))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            request = urllib.request.Request(f"http://127.0.0.1:{server.port}/analyse/foyers",
                                             headers=bearer("analyste"))
            with self.assertRaises(urllib.error.HTTPError) as ctx:
                urllib.request.urlopen(request)
            self.assertEqual(ctx.exception.code, 401)
        finally:
            server.shutdown()


if __name__ == "__main__":
    unittest.main()
