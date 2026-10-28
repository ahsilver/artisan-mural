
import sys, json
from playwright.sync_api import sync_playwright
BASE=sys.argv[1]; out={}; errs=[]
SL=["maren-holt","ines-okafor","tomas-reyes","yuki-arai","studio-ad75ea40","studio-1de5d8f7","studio-89fe9e5b","studio-59adb7c2"]
with sync_playwright() as p:
    b=p.chromium.launch()
    for w in (390,768,1440):
        c=b.new_context(viewport={"width":w,"height":844 if w<800 else 900})
        c.add_init_script("try{localStorage.setItem('am-popup-hide-until', String(Date.now()+864e5))}catch(e){}")
        pg=c.new_page(); pg.route("**/backend/ai/**", lambda r: r.abort())
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        pg.on("console", lambda m: errs.append(m.text[:200]) if m.type=="error" else None)
        for q in ("","?v=a","?v=b"):
            for path in ["/designers"]+["/designers/"+s for s in SL]:
                pg.goto(BASE+path+q, wait_until="networkidle", timeout=60000); pg.wait_for_timeout(500)
                r=pg.evaluate("[document.documentElement.scrollHeight, document.documentElement.scrollWidth, !!document.querySelector('[data-testid=version-switch]'), document.querySelectorAll('[data-testid=designer-card]').length, document.querySelectorAll('[data-testid=work-tile]').length]")
                out[f"{w}{q} {path}"]=r
        c.close()
    b.close()
json.dump(out,open("/tmp/dsg_after.json","w")); print("ERRS", json.dumps(sorted(set(errs))[:15]))
