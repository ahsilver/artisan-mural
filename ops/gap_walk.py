import sys, json
from playwright.sync_api import sync_playwright
SITES={"lov":"https://artisanmural.lovable.app","ours":"https://artisan-mural.pages.dev"}
PAGES=["/","/browse","/designers","/custom-request","/sell","/become-designer","/cart","/compare","/studio-demo","/account"]
out={}
with sync_playwright() as p:
    b=p.chromium.launch()
    for k,B in SITES.items():
        c=b.new_context(viewport={"width":1440,"height":900}); pg=c.new_page(); out[k]={}
        for path in PAGES+["DESIGN"]:
            try:
                if path=="DESIGN":
                    pg.goto(B+"/browse",wait_until="networkidle",timeout=45000); pg.wait_for_timeout(1500)
                    h=pg.eval_on_selector_all("a[href*='/design/']","els=>els.map(e=>e.getAttribute('href'))")
                    h=[x for x in h if x and x.count('/')==2][:1]
                    path=h[0] if h else "/"
                    pg.goto(B+path,wait_until="networkidle",timeout=45000)
                else: pg.goto(B+path,wait_until="networkidle",timeout=45000)
                pg.wait_for_timeout(1500)
                t=pg.eval_on_selector_all("main a, main button, main h1, main h2, main h3, main label, header a, footer a","els=>[...new Set(els.map(e=>(e.innerText||e.getAttribute('aria-label')||'').trim().split('\\n')[0]).filter(x=>x&&x.length<50))]")
                out[k][path if not path.startswith('/design/') else 'DESIGN']=t
            except Exception as e: out[k][path]=["ERR "+str(e)[:80]]
        c.close()
json.dump(out,open("/tmp/gapwalk.json","w"))
for path in PAGES+["DESIGN"]:
    a=set(out["lov"].get(path,[])); o=set(out["ours"].get(path,[]))
    print(path,"| only Lovable:",sorted(a-o)[:25])
