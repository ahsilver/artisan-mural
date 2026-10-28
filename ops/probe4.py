
import sys
from playwright.sync_api import sync_playwright
BASE=sys.argv[1]; V=int(sys.argv[2])
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":V,"height":900 if V>800 else 844})
    pg.goto(BASE+"/design/u-3f032b05-4247-41e0-aba8-5038197dd12b", wait_until="networkidle"); pg.wait_for_timeout(2000)
    for name,tag in (("Grasscloth","grass"),("Canvas","canvas")):
        pg.get_by_role("radio", name=name).first.click(); pg.wait_for_timeout(1500)
        panel=pg.locator("[role=tabpanel]").first; panel.scroll_into_view_if_needed(); pg.wait_for_timeout(1500)
        pg.locator("[role=tabpanel]").first.locator("xpath=..").screenshot(path=f"/home/user/tab/files/am-texture-{tag}-closeup-{V}.jpg", quality=70, type="jpeg")
        pg.get_by_role("tab", name="Whole wall").click(); pg.wait_for_timeout(1500)
        pg.locator("[role=tabpanel]").first.locator("xpath=..").screenshot(path=f"/home/user/tab/files/am-texture-{tag}-wall-{V}.jpg", quality=70, type="jpeg")
        pg.get_by_role("tab", name="Real size close-up").click(); pg.wait_for_timeout(500)
    pg.evaluate("window.scrollTo(0, document.querySelector('[role=radiogroup]').getBoundingClientRect().top + window.scrollY - 80)"); pg.wait_for_timeout(800)
    pg.screenshot(path=f"/home/user/tab/files/am-finishes-{V}.jpg", quality=60, type="jpeg")
    b.close()
