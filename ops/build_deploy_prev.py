
import os,sys,subprocess,json,time
sys.path.insert(0,os.path.dirname(__file__))
import cf
APP='/home/user/tab/work/artisan-copy/app'; LOG='/home/user/tab/work/artisan-copy/ops/bd-prev.log'
mode=sys.argv[1] if len(sys.argv)>1 else 'both'
with open(LOG,'w') as log:
    def run(cmd,env=None,t=600):
        log.write('$ '+cmd.split(' ')[0]+' ...\n'); log.flush()
        r=subprocess.run('timeout -k 5 %d %s'%(t,cmd),shell=True,cwd=APP,stdout=log,stderr=subprocess.STDOUT,env=env)
        log.write('EXIT %d\n'%r.returncode); log.flush(); return r.returncode
    if mode in('both','build'):
        if run('node node_modules/vite/bin/vite.js build')!=0: log.write('BUILD FAILED\n'); sys.exit(1)
        hp=os.path.join(APP,'dist','_headers'); h=open(hp).read() if os.path.exists(hp) else ''
        rp=os.path.join(APP,'dist','_routes.json')
        json.dump({'version':1,'include':['/*'],'exclude':['/assets/*','/s/*','/media/*','/fonts/*','/favicon.ico','/robots.txt','/icon-256.png','/apple-touch-icon.png']},open(rp,'w'))  # static files skip the worker
        if '/s/*' not in h: open(hp,'a').write('\n/s/*\n  cache-control: public, max-age=31536000, immutable\n/media/*\n  cache-control: public, max-age=86400\n/fonts/*\n  cache-control: public, max-age=31536000, immutable\n')
    if mode in('both','deploy'):
        env=dict(os.environ); env['CLOUDFLARE_API_TOKEN']=cf.tok(); env['CLOUDFLARE_ACCOUNT_ID']=cf.ACC; env['WRANGLER_SEND_METRICS']='false'; env['XDG_CONFIG_HOME']='/tmp/wr-am'
        rc=run('node ../tools/node_modules/wrangler/bin/wrangler.js pages deploy dist --project-name artisan-mural --branch hdlock --commit-dirty=true',env=env,t=600)
        log.write('DEPLOY %s\n'%('OK' if rc==0 else 'FAILED'))
    log.write('DONE\n')
