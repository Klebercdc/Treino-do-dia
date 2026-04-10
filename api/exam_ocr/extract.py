from http.server import BaseHTTPRequestHandler
import json

from services.exam_ocr.service import extract_payload


def _write_json(handler, status_code: int, payload: dict):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        raw_body = self.rfile.read(content_length) if content_length > 0 else b"{}"

        try:
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except Exception:
            return _write_json(self, 400, {"detail": "payload JSON inválido"})

        try:
            result = extract_payload(payload)
        except ValueError as error:
            return _write_json(self, 400, {"detail": str(error)})

        return _write_json(self, 200 if result.get("success") else 422, result)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
