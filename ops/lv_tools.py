import sys
from playwright.sync_api import sync_playwright
F="/home/user/tab/files/"; B="https://artisanmural.lovable.app"
def L(*a): print(" ".join(str(x) for x in a), flush=True)
with sync_playwright() as p:
    b=p.chromium.launch()
    for v in (1440,390):
        c=b.new_context(viewport={"width":v,"height":900 if v>800 else 844}); pg=c.new_page()
        pg.goto(B+"/design/long-mist", wait_until="networkidle", timeout=60000); pg.wait_for_timeout(2500)
        L(v,"product page ruler btns:", pg.locator("[aria-label='Show ruler']").count(), pg.url)
        if pg.locator("[aria-label='Show ruler']").count()==0:
            pg.goto(B+"/design/long-mist/preview", wait_until="networkidle", timeout=60000); pg.wait_for_timeout(2500)
            L(v,"preview page ruler btns:", pg.locator("[aria-label='Show ruler']").count(), pg.url)
        for lab in ("Show ruler","Show panels","Show person for scale"):
            if pg.locator(f"[aria-label='{lab}']").count(): pg.locator(f"[aria-label='{lab}']").first.click(); pg.wait_for_timeout(400)
        el=pg.locator("[data-panel-guides]").first
        if el.count(): el.scroll_into_view_if_needed(); pg.evaluate("window.scrollBy(0,-120)")
        pg.wait_for_timeout(600)
        pg.screenshot(path=F+f"am-lovable-tools-{v}.jpg", type="jpeg", quality=55)
        t=pg.locator("text=/panels ·/").first
        L(v,"caption:", t.inner_text() if t.count() else "-")
        c.close()
    b.close()
