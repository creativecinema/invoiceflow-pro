#!/usr/bin/env python3
"""
InvoiceFlow — AI Proxy
Leitet Claude & OpenAI Anfragen vom Browser weiter (CORS-Fix).
Port: 3001
"""
import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError

PORT = int(os.getenv('PROXY_PORT', 3001))

class ProxyHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[Proxy] {fmt % args}")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body   = self.rfile.read(length)

        try:
            data = json.loads(body)
        except Exception:
            self._err(400, "Invalid JSON")
            return

        path = self.path.rstrip('/')

        if path == '/proxy/claude':
            self._forward(
                url="https://api.anthropic.com/v1/messages",
                headers={
                    "Content-Type":       "application/json",
                    "x-api-key":          data.get("apiKey",""),
                    "anthropic-version":  "2023-06-01",
                },
                payload=data.get("payload", {})
            )

        elif path == '/proxy/openai':
            self._forward(
                url="https://api.openai.com/v1/chat/completions",
                headers={
                    "Content-Type":  "application/json",
                    "Authorization": "Bearer " + data.get("apiKey",""),
                },
                payload=data.get("payload", {})
            )

        elif path == '/proxy/test-claude':
            self._forward(
                url="https://api.anthropic.com/v1/messages",
                headers={
                    "Content-Type":      "application/json",
                    "x-api-key":         data.get("apiKey",""),
                    "anthropic-version": "2023-06-01",
                },
                payload={"model":"claude-haiku-20240307","max_tokens":5,"messages":[{"role":"user","content":"Hi"}]}
            )

        elif path == '/proxy/test-openai':
            self._forward(
                url="https://api.openai.com/v1/models",
                headers={"Authorization": "Bearer " + data.get("apiKey","")},
                payload=None,
                method="GET"
            )

        else:
            self._err(404, "Unknown endpoint")

    def _forward(self, url, headers, payload, method="POST"):
        try:
            req_body = json.dumps(payload).encode() if payload else None
            req = Request(url, data=req_body, headers=headers, method=method)
            with urlopen(req, timeout=30) as r:
                resp_body = r.read()
                self.send_response(r.status)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(resp_body)
        except HTTPError as e:
            body = e.read()
            self.send_response(e.code)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self._err(502, str(e))

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _err(self, code, msg):
        body = json.dumps({"error": msg}).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

if __name__ == "__main__":
    print(f"✓ InvoiceFlow AI Proxy läuft auf Port {PORT}")
    HTTPServer(("0.0.0.0", PORT), ProxyHandler).serve_forever()
