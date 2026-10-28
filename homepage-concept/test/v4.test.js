
const test=require('node:test');const assert=require('node:assert');const fs=require('fs');const path=require('path');
const S=path.join(__dirname,'..','site');
const rd=p=>fs.readFileSync(path.join(S,p),'utf8');
for(const pg of ['v4/index.html','v4-white/index.html']){
 test(pg+' structure',()=>{const h=rd(pg);
  assert.match(h,/<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(h,/<title>Artisan Mural \| Original wallpaper, made for your wall<\/title>/);
  assert.match(h,/class="v4-hero" id="hero"/);assert.match(h,/id="story"/);assert.match(h,/id="shop"/);
  assert.equal((h.match(/data-say/g)||[]).length,5);
  assert.match(h,/Art that feels at home\./);assert.match(h,/A wall that's entirely yours\./);assert.match(h,/Meet Yuki Arai\./);
  assert.doesNotMatch(h,/Hero A|Story A|Shop A/,'labels only on choose page');
  assert.doesNotMatch(h,/lorem|TODO|placeholder/i);
  for(const m of h.matchAll(/(?:src|href)="(\.\.\/[^"#?]+)"/g)){assert.ok(fs.existsSync(path.join(S,path.dirname(pg),m[1])),'missing '+m[1]);}
  for(const m of h.matchAll(/srcset="([^"]+)"/g)){for(const part of m[1].split(',')){const u=part.trim().split(/\s+/)[0];if(u.startsWith('../'))assert.ok(fs.existsSync(path.join(S,path.dirname(pg),u)),'missing '+u);}}
 });
}
test('wall vs white modes',()=>{assert.match(rd('v4/index.html'),/v4-story v4-wall/);assert.match(rd('v4-white/index.html'),/v4-story v4-white/);});
test('choose page',()=>{const h=rd('choose/index.html');for(const t of ['Hero A','Hero B','Hero C','Story A','Story B','Story C','Shop A','Shop B'])assert.ok(h.includes('<b>'+t+'</b>'),t);
 for(const m of h.matchAll(/src="(img\/[^"]+)"/g))assert.ok(fs.existsSync(path.join(S,'choose',m[1])),m[1]);
 for(const l of ['../v4/','../v4-white/','../'])assert.ok(h.includes('href="'+l));});
test('no internal names',()=>{for(const f of ['v4/index.html','v4-white/index.html','choose/index.html','lv/v4.js','lv/v4.css']){const h=rd(f);assert.doesNotMatch(h,/\bTab\b|tab\.bot|Lovable|Moses/i,f);}});
