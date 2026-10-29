"""Run the local API alongside the Vite development or preview server."""
import json
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from .analytics import course_analytics
from .study_plan import study_plan

ROOT = Path(__file__).resolve().parent.parent


class LocalServer(ThreadingHTTPServer):
    # A second process must not silently share the API port on Windows.
    allow_reuse_address = False


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path not in ('/api/study-plan', '/api/analytics'):
            self.send_error(404)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > 1_000_000:
                raise ValueError('Invalid request length')
            request = json.loads(self.rfile.read(length))
            result = study_plan(request) if self.path == '/api/study-plan' else [course_analytics(item) for item in request]
            body = json.dumps(result, ensure_ascii=False).encode('utf-8')
        except (ValueError, KeyError, TypeError, AttributeError, OverflowError):
            self.send_error(400, 'Invalid request')
            return
        try:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except ConnectionError:
            pass  # The browser can cancel a stale request after navigating away.

    def log_message(self, format, *args):
        pass


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'dev'
    if mode not in ('dev', 'preview'):
        raise SystemExit('Usage: python -m backend.server [dev|preview] [vite options]')
    server = LocalServer(('127.0.0.1', 8765), Handler)
    Thread(target=server.serve_forever, daemon=True).start()
    vite = ROOT / 'node_modules' / 'vite' / 'bin' / 'vite.js'
    command = ['node', str(vite)] + (['preview'] if mode == 'preview' else []) + sys.argv[2:]
    try:
        process = subprocess.Popen(command, cwd=ROOT)
        try:
            return process.wait()
        except KeyboardInterrupt:
            process.terminate()
            process.wait()
            return 0
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    raise SystemExit(main())
