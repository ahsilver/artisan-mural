(()=>{
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
/* phone menu */
const mb=$('header button[aria-label="Open menu"]');
if(mb){const panel=mb.closest('header').querySelector('div.lg\\:hidden.hidden, div.lg\\:hidden');
 mb.addEventListener('click',()=>{const open=mb.getAttribute('aria-expanded')!=='true';mb.setAttribute('aria-expanded',open);if(panel)panel.classList.toggle('hidden',!open);});}
/* before/after slider (from the current site) */
$$('button[aria-label="Drag to compare before and after"]').forEach(btn=>{
 const box=btn.parentElement,after=box.querySelectorAll('img')[1],line=btn.previousElementSibling;
 const set=x=>{const r=box.getBoundingClientRect();const p=clamp((x-r.left)/r.width,0.02,0.98)*100;after.style.clipPath=`inset(0 0 0 ${p}%)`;btn.style.left=p+'%';if(line)line.style.left=p+'%';};
 let drag=false;box.style.touchAction='pan-y';
 box.addEventListener('pointerdown',e=>{drag=true;set(e.clientX);box.setPointerCapture(e.pointerId);});
 box.addEventListener('pointermove',e=>{if(drag)set(e.clientX);});
 ['pointerup','pointercancel'].forEach(t=>box.addEventListener(t,()=>drag=false));
 btn.addEventListener('keydown',e=>{const r=box.getBoundingClientRect();const cur=parseFloat(btn.style.left)||50;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();set(r.left+r.width*(cur+(e.key==='ArrowLeft'?-5:5))/100);}});
});
/* size the hero so the next part already shows at the bottom of the first screen */
const heroEl=$('.v4-hero');
function sizeHero(){if(!heroEl)return;const top=heroEl.getBoundingClientRect().top+scrollY;const peek=innerWidth<761?76:92;
 const hh=Math.max(innerWidth<761?470:520,Math.min(860,innerHeight-top-peek));heroEl.style.setProperty('--hh',hh+'px');}
sizeHero();let lastW=innerWidth;addEventListener('resize',()=>{if(innerWidth!==lastW){lastW=innerWidth;sizeHero();}});
/* hero rooms */
const slides=$$('.v4-slide'),bars=$$('.v4-bars button');let cur=0,timer=null;const DUR=6500;
function show(i){slides[cur].classList.remove('on');bars[cur]&&bars[cur].classList.remove('on');bars[cur]&&bars[cur].removeAttribute('aria-current');
 cur=(i+slides.length)%slides.length;const s=slides[cur];const im=s.querySelector('img');if(im.loading==='lazy')im.loading='eager';
 s.classList.add('on');if(bars[cur]){bars[cur].classList.add('on');bars[cur].setAttribute('aria-current','true');}
 const nx=slides[(cur+1)%slides.length].querySelector('img');if(nx.loading==='lazy')nx.loading='eager';
 clearTimeout(timer);if(!RM)timer=setTimeout(()=>show(cur+1),DUR);}
if(slides.length>1){bars.forEach((b,i)=>b.addEventListener('click',()=>show(i)));
 if(!RM){timer=setTimeout(()=>show(1),DUR);}
 document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden&&!RM)timer=setTimeout(()=>show(cur+1),DUR);});}
/* word-by-word lines: each sentence finishes within one short scroll, never left half-written */
const says=$$('[data-say]').map(el=>{const t=el.textContent.trim();el.setAttribute('aria-label',t);
 el.innerHTML=t.split(/\s+/).map(w=>`<span class="w" aria-hidden="true">${w}</span>`).join(' ');el.classList.add('split');
 return {el,w:$$('.w',el),n:0,done:false};});
function light(s,n,stagger){n=Math.max(n,s.n);if(n===s.n)return;s.w.forEach((w,i)=>{if(i<n&&!w.classList.contains('lit')){w.style.transitionDelay=stagger?((i-s.n)*45)+'ms':'0ms';w.classList.add('lit');}});s.n=n;if(n>=s.w.length)s.done=true;}
if(RM)says.forEach(s=>light(s,s.w.length,false));
/* rise targets */
const rise=$$('[data-rise]'),hero=$('.v4-hero'),hs=$('.v4-slides'),hc=$('.v4-hero-copy'),bgs=$$('.v4-bg,.v4-swatch');
let ticking=false,idle=null;
function absTop(el){let t=0;while(el){t+=el.offsetTop;el=el.offsetParent;}return t;}
function frame(){ticking=false;const vh=innerHeight,y=scrollY;
 if(RM)return;
 if(hero&&y<hero.offsetHeight+200){hero.style.setProperty('--hy',(y*.32).toFixed(1));hero.style.setProperty('--hs',(1+Math.min(y,800)/800*.06).toFixed(4));
  hero.style.setProperty('--cy',(-y*.18).toFixed(1));}
 for(const el of rise){const t=absTop(el)-y;el.style.setProperty('--r',clamp((vh+40-t)/(vh*.30)).toFixed(3));}
 for(const b of bgs){const r=b.parentElement.getBoundingClientRect();if(r.bottom<0||r.top>vh)continue;b.style.setProperty('--py',(((r.top+r.height/2)-vh/2)*-.08).toFixed(1));}
 for(const s of says){if(s.done)continue;const t=s.el.getBoundingClientRect().top;
  const p=clamp((vh*.94-t)/(vh*.40));light(s,Math.ceil(p*s.w.length-0.001),false);}
}
function onScroll(){if(!ticking){ticking=true;requestAnimationFrame(frame);}
 clearTimeout(idle);idle=setTimeout(()=>{says.forEach(s=>{if(!s.done&&s.n>0)light(s,s.w.length,true);});},160);}
addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll);frame();onScroll();
})();
