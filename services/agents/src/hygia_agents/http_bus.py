"""Bus HTTP : reçoit les événements publiés par les services (POST /events)."""
from __future__ import annotations

import json
import queue
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable
from urllib.parse import parse_qsl, urlsplit

from .agent import AgentRegistry
from .analytics_api import AnalyticsApi
from .bus import InMemoryEventBus
from .models import Event


class HttpEventBus(InMemoryEventBus):
    """Bus en mémoire exposé en HTTP : `POST /events`, `GET /issues`, `GET /health`."""

    def __init__(
        self,
        registry_factory: Callable[[InMemoryEventBus], AgentRegistry],
        host: str = "127.0.0.1",
        port: int = 3007,
        analytics: AnalyticsApi | None = None,
    ) -> None:
        super().__init__()
        self.analytics = analytics
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

            def _analytics(self) -> None:
                url = urlsplit(self.path)
                route = url.path.removeprefix("/analyse").strip("/")
                role = self.headers.get("x-user-role")
                if route == "flux" and role == "analyste":
                    self._stream()
                    return
                status, body = bus.analytics.handle(route, dict(parse_qsl(url.query)), role)  # type: ignore[union-attr]
                self._send(status, body)

            def _stream(self) -> None:
                inbox, close = bus.analytics.open_stream()  # type: ignore[union-attr]
                self.send_response(200)
                self.send_header("content-type", "text/event-stream")
                self.send_header("cache-control", "no-cache")
                self.end_headers()
                try:
                    while True:
                        try:
                            data = json.dumps(inbox.get(timeout=15).to_json(), ensure_ascii=False)
                            self.wfile.write(f"event: cas\ndata: {data}\n\n".encode())
                        except queue.Empty:
                            self.wfile.write(b": keep-alive\n\n")
                        self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError):
                    pass
                finally:
                    close()

            def do_GET(self) -> None:
                if bus.analytics is not None and urlsplit(self.path).path.startswith("/analyse"):
                    self._analytics()
                elif self.path == "/health":
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
                try:
                    bus.publish(event)
                except ValueError as error:
                    self._send(400, {"error": str(error)})
                    return
                self._send(202, [i.to_json() for i in bus.registry.issues[before:]])

            def log_message(self, *args: object) -> None:
                pass

        return RequestHandler
