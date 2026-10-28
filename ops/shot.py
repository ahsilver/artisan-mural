
import sys,json,asyncio
from playwright.async_api import async_playwright
# usage: shot.py out_prefix url [url...]  -> writes out_prefix-<i>-1440.jpg / -390.jpg
async def main():
    pre=sys.argv[1]; urls=sys.argv[2:]
    async with async_playwright() as p:
        b=await p.chromium.launch()
        res=[]
        for w,h in((1440,900),(390,844)):
            ctx=await b.new_context(viewport={'width':w,'height':h},device_scale_factor=1 if w>1000 else 2)
            pg=await ctx.new_page(); errs=[]
            pg.on('console',lambda m: errs.append(m.text[:200]) if m.type=='error' else None)
            pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)[:200]))
            for i,u in enumerate(urls):
                try:
                    r=await pg.goto(u,wait_until='networkidle',timeout=45000)
                    await pg.wait_for_timeout(500)
                    hh=await pg.evaluate('document.body.scrollHeight')
                    y=0
                    while y<hh:
                        y+=h*0.7; await pg.evaluate(f'window.scrollTo(0,{y})'); await pg.wait_for_timeout(120)
                        hh=await pg.evaluate('document.body.scrollHeight')
                    await pg.evaluate('window.scrollTo(0,0)'); await pg.wait_for_timeout(600)
                    out=f'{pre}-{i}-{w}.jpg'
                    await pg.screenshot(path=out,full_page=True,type='jpeg',quality=70)
                    res.append({'url':u,'w':w,'status':r.status if r else None,'out':out,'title':await pg.title(),'errors':errs[:8]})
                except Exception as e: res.append({'url':u,'w':w,'err':str(e)[:300]})
                errs.clear()
            await ctx.close()
        await b.close()
        print(json.dumps(res,indent=1))
asyncio.run(main())
