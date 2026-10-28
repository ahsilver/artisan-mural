
import sys,json,asyncio,time
from playwright.async_api import async_playwright
BASE=sys.argv[1]; tag=sys.argv[2]
LCPJS="""()=>new Promise(r=>{let v=0;new PerformanceObserver(l=>{for(const e of l.getEntries())v=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});setTimeout(()=>r(v),300)})"""
async def run(p,w,h,mobile):
    b=await p.chromium.launch()
    ctx=await b.new_context(viewport={'width':w,'height':h},device_scale_factor=2 if mobile else 1,is_mobile=mobile,has_touch=mobile)
    pg=await ctx.new_page(); cdp=await ctx.new_cdp_session(pg)
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled',{'cacheDisabled':True})
    if mobile:
        await cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':150,'downloadThroughput':1.6*1024*1024/8*1.0,'uploadThroughput':750*1024/8})
        await cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
    out={}
    for path in ['/','/browse']:
        tot=[0]; reqs=[0]
        def onresp(ev): tot[0]+=ev.get('encodedDataLength',0); reqs[0]+=1
        cdp.on('Network.loadingFinished',onresp)
        t0=time.time()
        await pg.goto(BASE+path,wait_until='load',timeout=120000)
        tload=time.time()-t0
        try: await pg.wait_for_load_state('networkidle',timeout=30000)
        except: pass
        tidle=time.time()-t0
        lcp=await pg.evaluate(LCPJS)
        out[path]={'lcp_ms':round(lcp),'load_s':round(tload,2),'idle_s':round(tidle,2),'kb':round(tot[0]/1024),'reqs':reqs[0]}
        cdp.remove_listener('Network.loadingFinished',onresp)
    # click-to-next-page: warm cache on, from /browse click first card
    await cdp.send('Network.setCacheDisabled',{'cacheDisabled':False})
    await pg.goto(BASE+'/browse',wait_until='networkidle',timeout=120000)
    clicks=[]
    for i in range(3):
        cards=pg.locator('a[href^="/design/"]')
        n=await cards.count()
        c=cards.nth(i % max(n,1))
        await c.scroll_into_view_if_needed(); await c.hover(); await pg.wait_for_timeout(400)
        t0=time.time(); full=[False]
        pg.once('framenavigated',lambda f: None)
        nav_reload=await pg.evaluate("window.__mark=1")
        await c.click()
        await pg.wait_for_selector('h1',timeout=60000)
        t_h1=time.time()-t0
        await pg.wait_for_function("()=>{const i=[...document.querySelectorAll('img')].find(x=>x.getBoundingClientRect().width>200&&x.getBoundingClientRect().top<innerHeight);return i&&i.complete&&i.naturalWidth>0}",timeout=60000)
        dt=time.time()-t0
        still=await pg.evaluate("window.__mark===1")
        clicks.append({'page_shown_ms':round(t_h1*1000),'picture_sharp_ms':round(dt*1000),'client_nav':still})
        await pg.go_back(); await pg.wait_for_selector('a[href^="/design/"]',timeout=60000); await pg.wait_for_timeout(500)
    out['click_to_product']=clicks
    await b.close(); return out
async def main():
    async with async_playwright() as p:
        r={'mobile390':await run(p,390,844,True),'desktop1440':await run(p,1440,900,False)}
    print(json.dumps(r))
    json.dump(r,open(f'/home/user/tab/work/artisan-copy/ops/perf-{tag}.json','w'),indent=1)
asyncio.run(main())
