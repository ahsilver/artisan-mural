
import sys
from playwright.sync_api import sync_playwright
BASE=sys.argv[1]; PATH=sys.argv[2]; W=int(sys.argv[3]); OUT=sys.argv[4]
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={"width":W,"height":844 if W<800 else 900}, device_scale_factor=float(sys.argv[5]) if len(sys.argv)>5 else 1)
    c.add_init_script("try{localStorage.setItem('am-popup-hide-until', String(Date.now()+864e5))}catch(e){}")
    pg=c.new_page(); pg.route("**/backend/ai/**", lambda r: r.abort())
    pg.goto(BASE+PATH, wait_until="networkidle", timeout=60000)
    pg.evaluate("async()=>{for(let y=0;y<document.body.scrollHeight;y+=400){scrollTo(0,y);await new Promise(r=>setTimeout(r,120))} scrollTo(0,0)}"); pg.wait_for_timeout(1200)
    print(pg.evaluate("(()=>{const f=document.querySelector('footer'),h=document.querySelector('header');return {H:document.documentElement.scrollHeight,footer:f&&f.offsetHeight,header:h&&h.offsetHeight,main:document.querySelector('main')&&document.querySelector('main').offsetHeight}})()"))
    pg.add_style_tag(content='[data-testid=version-switch]{display:none!important}[data-testid=profile-actionbar]{display:none!important}') # HIDEBADGE
    pg.screenshot(path=OUT, full_page=True, type='jpeg', quality=70)
    b.close()
