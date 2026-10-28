
import sys
from playwright.sync_api import sync_playwright
BASE, PW = sys.argv[1:3]
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":900}); pg.on("pageerror",lambda e: errs.append(str(e)[:200]))
    pg.goto(BASE+"/admin", wait_until="networkidle")
    print("LOGIN FORM", pg.evaluate("[...document.querySelectorAll('input')].map(e=>e.type+':'+(e.getAttribute('aria-label')||e.name||e.placeholder))"))
    em=pg.locator("input[type=email]")
    if em.count(): em.fill("owner@artisanmural.preview")
    pg.fill("input[type=password]",PW); pg.click("form button:has-text('Sign in')"); pg.wait_for_timeout(3500)
    pg.click(".bo-nav >> text=Designs") if pg.locator(".bo-nav >> text=Designs").count() else pg.goto(BASE+"/admin#designs")
    pg.wait_for_timeout(2500)
    print("DESIGNS", pg.locator("main, body").first.inner_text()[:1800].replace("\n"," | "))
    print("ERR", errs)
