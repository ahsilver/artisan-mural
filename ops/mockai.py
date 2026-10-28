"""Tests never call the paid AI: every /backend/ai/render answers with a stand-in picture (the guide or room photo sent with it)."""
import json
CALLS = []
def install(target):
    """target: a Playwright page or browser context."""
    def handle(route):
        try: body = json.loads(route.request.post_data or "{}")
        except Exception: body = {}
        CALLS.append(body.get("purpose"))
        img = body.get("guide") or body.get("room") or body.get("design") or ""
        if img and not str(img).startswith("data:"): img = "data:image/jpeg;base64," + img
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"image": img, "model": "test-stand-in", "ms": 5}))
    target.route("**/backend/ai/render", handle)

# importing this module is enough: every context a test opens answers AI calls with the stand-in
from playwright.sync_api._generated import Browser as _B
_orig_ctx = _B.new_context
def _ctx(self, *a, **k):
    c = _orig_ctx(self, *a, **k); install(c); return c
_B.new_context = _ctx
_orig_page = _B.new_page
def _page(self, *a, **k):
    pg = _orig_page(self, *a, **k); install(pg); return pg
_B.new_page = _page
