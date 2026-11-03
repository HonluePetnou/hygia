"""Serveur HTTP local : `PYTHONPATH=src python3 -m hygia_agents`."""
import os

from . import default_registry
from .http_bus import HttpEventBus

if __name__ == "__main__":
    server = HttpEventBus(default_registry, port=int(os.environ.get("AGENTS_PORT", "3007")))
    print(f"agents à l'écoute sur :{server.port}")
    server.serve_forever()
