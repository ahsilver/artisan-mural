
import sys, json
from playwright.sync_api import sync_playwright
BASE=sys.argv[1]
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":900}); pg.on("console",lambda m: errs.append(m.type+": "+m.text[:200]))
    pg.goto(BASE+"/design/u-3f032b05-4247-41e0-aba8-5038197dd12b", wait_until="networkidle"); pg.wait_for_timeout(2500)
    btns=pg.evaluate("[...document.querySelectorAll('button,a')].map(e=>e.innerText.trim()).filter(t=>t&&t.length<40)")
    print("BTNS", btns[:80])
    print("PAGE", pg.locator("main").inner_text()[:2500].replace("\n"," | "))
    print("CONSOLE", errs[:10])
