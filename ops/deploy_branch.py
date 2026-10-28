import os,sys,subprocess
sys.path.insert(0,'/home/user/tab/work/artisan-copy/ops'); import cf
APP='/home/user/tab/work/artisan-copy/app'; br=sys.argv[1]
env=dict(os.environ); env['CLOUDFLARE_API_TOKEN']=cf.tok(); env['CLOUDFLARE_ACCOUNT_ID']=cf.ACC; env['WRANGLER_SEND_METRICS']='false'; env['XDG_CONFIG_HOME']='/tmp/wr-am'
r=subprocess.run('timeout -k 5 400 node ../tools/node_modules/wrangler/bin/wrangler.js pages deploy dist --project-name artisan-mural --branch %s --commit-dirty=true'%br,shell=True,cwd=APP,env=env)
print('EXIT',r.returncode)
