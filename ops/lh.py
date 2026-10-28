
import subprocess,json,sys,os,glob
chrome=sorted(glob.glob('/home/user/.cache/ms-playwright/chromium-*/chrome-linux*/chrome'))[-1]
tag=sys.argv[1]; base=sys.argv[2]
res={}
for form in ['mobile','desktop']:
  for path in ['/','/browse']:
    out=f'/tmp/lh/r-{tag}-{form}-{path.strip("/") or "home"}.json'
    args=['node','/tmp/lh/node_modules/lighthouse/cli/index.js',base+path,'--quiet','--only-categories=performance','--output=json','--output-path='+out,'--chrome-flags=--headless=new --no-sandbox','--max-wait-for-load=60000']
    if form=='desktop': args.append('--preset=desktop')
    env=dict(os.environ,CHROME_PATH=chrome)
    r=subprocess.run(['timeout','-k','5','150']+args,env=env,capture_output=True,text=True)
    try:
      j=json.load(open(out)); a=j['audits']
      res[f'{form} {path}']={'score':round(j['categories']['performance']['score']*100),'LCP_s':round(a['largest-contentful-paint']['numericValue']/1000,2),'FCP_s':round(a['first-contentful-paint']['numericValue']/1000,2),'total_KB':round(a['total-byte-weight']['numericValue']/1024),'speed_index_s':round(a['speed-index']['numericValue']/1000,2),'TBT_ms':round(a['total-blocking-time']['numericValue'])}
      os.remove(out)
    except Exception as e: res[f'{form} {path}']={'err':str(e)[:200],'stderr':r.stderr[-300:]}
    print(f'{form} {path}',res[f'{form} {path}'],flush=True)
json.dump(res,open(f'/home/user/tab/work/artisan-copy/ops/lh-{tag}.json','w'),indent=1)
