"""Tiny Cloudflare REST helper used by build_deploy.py.
Reads CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID from the environment (never hard-code them)."""
import json, os, urllib.request as _u, urllib.error

ACC = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")

def tok():
    t = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not t:
        raise SystemExit("Set CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID) in your environment")
    return t

def api(method, path, data=None, headers=None, raw=False, timeout=120):
    """Call https://api.cloudflare.com/client/v4<path>, e.g. api('POST', f'/accounts/{ACC}/d1/database/<db-id>/query', {'sql': '...'})"""
    h = {"authorization": "Bearer " + tok()}
    if headers: h.update(headers)
    if isinstance(data, (dict, list)): data = json.dumps(data).encode(); h["content-type"] = "application/json"
    rq = _u.Request("https://api.cloudflare.com/client/v4" + path, data=data, method=method, headers=h)
    try: r = _u.urlopen(rq, timeout=timeout); b = r.read()
    except urllib.error.HTTPError as e: b = e.read()
    return b if raw else json.loads(b)
