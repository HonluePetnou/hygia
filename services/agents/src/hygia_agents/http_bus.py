"""Bus HTTP : reçoit les événements publiés par les services (POST /events)."""
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable

from .agent import AgentRegistry
from .bus import InMemoryEventBus
from .models import Event


class HttpEventBus(InMemoryEventBus):
    """Bus en mémoire exposé en HTTP : `POST /events`, `GET /issues`, `GET /health`."""

    def __init__(
        self,
        registry_factory: Callable[[InMemoryEventBus], AgentRegistry],
        host: str = "127.0.0.1",
        port: int = 3007,
    ) -> None:
        super().__init__()
        self.registry = registry_factory(self)
        self._server = ThreadingHTTPServer((host, port), self._handler_class())

    @property
    def port(self) -> int:
        return self._server.server_address[1]

    def serve_forever(self) -> None:
        self._server.serve_forever()

    def shutdown(self) -> None:
        self._server.shutdown()
        self._server.server_close()

    def _handler_class(self) -> type[BaseHTTPRequestHandler]:
        bus = self

        class RequestHandler(BaseHTTPRequestHandler):
            def _send(self, status: int, body: object) -> None:
                data = json.dumps(body, ensure_ascii=False).encode()
                self.send_response(status)
                self.send_header("content-type", "application/json; charset=utf-8")
                self.send_header("content-length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_GET(self) -> None:
                if self.path == "/health":
                    self._send(200, {"status": "ok"})
                elif self.path == "/issues":
                    self._send(200, [i.to_json() for i in bus.registry.issues])
                else:
                    self._send(404, {"error": "not found"})

            def do_POST(self) -> None:
                if self.path != "/events":
                    self._send(404, {"error": "not found"})
                    return
                try:
                    length = int(self.headers.get("content-length", 0))
                    event = Event.from_json(json.loads(self.rfile.read(length)))
                except (ValueError, KeyError, TypeError):
                    self._send(400, {"error": "événement invalide"})
                    return
                before = len(bus.registry.issues)
                bus.publish(event)
                self._send(202, [i.to_json() for i in bus.registry.issues[before:]])

            def log_message(self, *args: object) -> None:
                pass

        return RequestHandler
