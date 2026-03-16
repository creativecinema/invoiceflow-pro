#!/usr/bin/env python3
"""
InvoiceFlow — Claude OCR Proxy
Läuft als kleiner HTTP-Server auf Port 3002
Leitet Bild-OCR-Anfragen an Anthropic API weiter (kein CORS-Problem)

Start: python3 proxy-claude.py
oder als Systemd-Service
"""
import json, base64, urllib.request, urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 3002

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass  # silent

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path != '/api/claude-ocr':
            self.send_response(404); self.end_headers(); return
        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = json.loads(self.rfile.read(length))
            key    = body.get('key', '').strip()
            b64    = body.get('base64', '')
            mtype  = body.get('mediaType', 'image/jpeg')
            prompt = body.get('prompt', 'Extract invoice data as JSON')

            if not key or not b64:
                self._json({'error': 'key and base64 required'}, 400); return

            payload = json.dumps({
                'model': 'claude-opus-4-6',
                'max_tokens': 1500,
                'messages': [{'role':'user','content':[
                    {'type':'image','source':{'type':'base64','media_type':mtype,'data':b64}},
                    {'type':'text','text':prompt}
                ]}]
            }).encode()

            req = urllib.request.Request(
                'https://api.anthropic.com/v1/messages',
                data=payload,
                headers={'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read())
                text = data['content'][0]['text'].strip()
                text = text.replace('```json','').replace('```','').strip()
                result = json.loads(text)
                self._json(result)

        except urllib.error.HTTPError as e:
            err = json.loads(e.read() or b'{}')
            self._json({'error': err.get('error',{}).get('message','API error '+str(e.code))}, e.code)
        except Exception as e:
            self._json({'error': str(e)}, 500)

    def _json(self, obj, status=200):
        data = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length', len(data))
        self._cors()
        self.end_headers()
        self.wfile.write(data)

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Access-Control-Allow-Methods','POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers','Content-Type')

if __name__ == '__main__':
    print(f"✓ Claude OCR Proxy läuft auf Port {PORT}")
    HTTPServer(('', PORT), Handler).serve_forever()
