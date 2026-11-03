"""Serveur HTTP local : `PYTHONPATH=src python3 -m hygia_agents`."""
import os
import threading
import time
import uuid

from . import AnalyticsApi, CaseStore, Coordinator, InMemoryLeaseStore, VeilleAgent, default_registry
from .http_bus import HttpEventBus
from .lease import localstack_lease_store
from .outbreak_data import demo_events


def main() -> None:
    store = CaseStore()
    endpoint = os.environ.get("AGENTS_DYNAMODB_URL")
    leases = localstack_lease_store(endpoint) if endpoint else InMemoryLeaseStore()
    coordinator = Coordinator(leases, os.environ.get("AGENTS_INSTANCE_ID", str(uuid.uuid4())))
    server = HttpEventBus(default_registry, port=int(os.environ.get("AGENTS_PORT", "3007")),
                          analytics=AnalyticsApi(store))
    veille = VeilleAgent(store, coordinator, server.registry.issues.append)
    server.registry.register(veille)
    if os.environ.get("AGENTS_DEMO_DATA", "1") == "1":
        for event in demo_events():
            veille.handle(event)

    def loop() -> None:
        while True:
            veille.analyse()
            time.sleep(10)

    threading.Thread(target=loop, daemon=True).start()
    print(f"agents à l'écoute sur :{server.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
