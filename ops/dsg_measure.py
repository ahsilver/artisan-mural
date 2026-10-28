
import sys, json
from playwright.sync_api import sync_playwright
BASE=sys.argv[1]; out={}
with sync_playwright() as p:
    b=p.chromium.launch()
    for w in (390,768,1440):
        c=b.new_context(viewport={"width":w,"height":844 if w<800 else 900})
        c.add_init_script("try{localStorage.setItem('am-popup-hide-until', String(Date.now()+864e5))}catch(e){}")
        pg=c.new_page(); pg.route("**/backend/ai/**", lambda r: r.abort())
        pg.goto(BASE+"/designers", wait_until="networkidle", timeout=60000); pg.wait_for_timeout(1500)
        slugs=pg.eval_on_selector_all("a[href^='/designers/']","els=>[...new Set(els.map(e=>e.getAttribute('href')))]")
        out[f"list{w}"]=pg.evaluate("[document.documentElement.scrollHeight, document.documentElement.scrollWidth]")
        if w==390: out['slugs']=slugs
        for s in [x for x in slugs if x!='/designers/how-it-works']:
            pg.goto(BASE+s, wait_until="networkidle", timeout=60000); pg.wait_for_timeout(800)
            out[f"{s}@{w}"]=pg.evaluate("[document.documentElement.scrollHeight, document.documentElement.scrollWidth, document.querySelectorAll('img').length]")
        c.close()
    b.close()
print(json.dumps(out))
