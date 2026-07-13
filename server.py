from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
APP_DIR = ROOT / "app"
CONTENT_SECURITY_POLICY = (
    "default-src 'self'; base-uri 'none'; object-src 'none'; "
    "script-src 'self'; style-src 'self'; img-src 'self' data: blob:; "
    "connect-src 'self'; font-src 'self'; manifest-src 'self'; "
    "worker-src 'self'; form-action 'self'; frame-ancestors 'none'"
)


class AppHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".webmanifest": "application/manifest+json",
        ".svg": "image/svg+xml",
    }

    def end_headers(self) -> None:
        self.send_header("Content-Security-Policy", CONTENT_SECURITY_POLICY)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")

        request_path = self.path.split("?", maxsplit=1)[0]
        if request_path in {"/", "/index.html", "/guide.html", "/manifest.webmanifest", "/sw.js"}:
            self.send_header("Cache-Control", "no-cache")

        super().end_headers()


def run_server(host: str, port: int) -> None:
    handler = partial(AppHandler, directory=str(APP_DIR))
    server = ThreadingHTTPServer((host, port), handler)
    print(f"Serving Zaoan Hub at http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Zaoan Hub local server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    run_server(args.host, args.port)


if __name__ == "__main__":
    main()
