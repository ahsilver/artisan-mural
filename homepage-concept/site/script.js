(()=>{
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
/* nav */
const nav=$('#nav'),hero=$('#hero')||$('.hang');
/* hero slideshow */
const slides=$$('.slide'),bars=$$('.bar'),now=$('#now');let cur=0,timer=null;const DUR=6500;
function show(i){
  slides[cur].classList.remove('on');bars[cur].classList.remove('on');
  cur=(i+slides.length)%slides.length;
  bars.forEach((b,j)=>{b.classList.toggle('done',j<cur);});
  const s=slides[cur];s.classList.add('on');
  const im=s.querySelector('img');if(im.loading==='lazy')im.loading='eager';
  void bars[cur].offsetWidth;bars[cur].classList.add('on');
  now.classList.add('fade');
  setTimeout(()=>{const n=$('.now-n',now),b=$('.now-by',now);n.href=s.dataset.href;n.textContent=s.dataset.name;b.href=s.dataset.byHref;b.textContent='by '+s.dataset.by;now.classList.remove('fade');},450);
  const nx=slides[(cur+1)%slides.length].querySelector('img');if(nx.loading==='lazy')nx.loading='eager';
  clearTimeout(timer);if(!RM)timer=setTimeout(()=>show(cur+1),DUR);
}
if(slides.length){bars.forEach((b,i)=>b.addEventListener('click',()=>show(i)));
bars.forEach(b=>b.style.setProperty('--dur',DUR+'ms'));}
if(!RM&&slides.length){timer=setTimeout(()=>show(1),DUR);setTimeout(()=>{slides.slice(1).forEach(s=>{const im=s.querySelector('img');im.loading='eager';});},2500);}
document.addEventListener('visibilitychange',()=>{if(!slides.length)return;if(document.hidden)clearTimeout(timer);else if(!RM)timer=setTimeout(()=>show(cur+1),DUR);});
/* typing headline */
const ty=$('.type');
if(ty&&!RM){const full=ty.dataset.type;ty.textContent='';ty.classList.add('typing');let k=0;
  setTimeout(function step(){ty.textContent=full.slice(0,++k);if(k<full.length)setTimeout(step,k===10?260:68);else setTimeout(()=>ty.classList.remove('typing'),1600);},500);}
/* pop words */
$$('.pop').forEach(h=>{const words=h.textContent.trim().split(/\s+/);h.setAttribute('aria-label',h.textContent.trim());
  h.innerHTML=words.map((w,i)=>`<span class="pw" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`).join(' ');});
/* scrub text */
const st=$('[data-scrub]');let stw=[];
if(st){const em=new Set(['independent','artist,','inch','yours.']);st.setAttribute('aria-label',st.textContent.trim());
  st.innerHTML=st.textContent.trim().split(/\s+/).map(w=>`<span class="w${em.has(w)?' em':''}" aria-hidden="true">${w}</span>`).join(' ');stw=$$('.w',st);}
/* reveal on view */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:.18,rootMargin:'0px 0px -8% 0px'});
$$('.pop,.reveal').forEach(el=>RM?el.classList.add('in'):io.observe(el));
/* colorway */
const cws=$$('.cw'),chips=$$('.chip'),names=['Celadon','Blush','Indigo','Midnight gold'];let cw=0,cwT=null;
function cwShow(i){cws[cw].classList.remove('on');chips[cw].classList.remove('on');cw=i%cws.length;cws[cw].classList.add('on');chips[cw].classList.add('on');$('#cwname').textContent=names[cw];}
chips.forEach((c,i)=>c.addEventListener('click',()=>{clearInterval(cwT);cwShow(i);}));
const cwo=new IntersectionObserver(es=>es.forEach(e=>{clearInterval(cwT);if(e.isIntersecting&&!RM)cwT=setInterval(()=>cwShow(cw+1),2600);}),{threshold:.4});
if($('#colorway'))cwo.observe($('#colorway'));
/* scale toggles */
const sc=$('#scale');if(sc)$$('.toggles button',sc).forEach(b=>b.addEventListener('click',()=>{const on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',on);sc.dataset[b.dataset.t]=on?'1':'0';}));
/* scroll-driven */
const ts=$('#tilestage'),wp=$('#wipe'),cimg=$('.custom-img'),fin=$('#final'),man=$('#manifesto');
const heroLines=$$('.hero-line');
function prog(el){const r=el.getBoundingClientRect(),vh=innerHeight;return clamp((vh-r.top)/(vh+r.height));}
let ticking=false;
function onScroll(){ticking=false;const y=scrollY,vh=innerHeight;
  nav.classList.toggle('solid',y>(hero?hero.offsetTop+hero.offsetHeight:0)-vh-40);
  const hp=hero?clamp(y/(hero.offsetHeight-vh)):1;
  heroLines.forEach(l=>l.classList.toggle('in',RM||hp>=(+l.dataset.step===1?.12:.42)));
  if(RM)return;
  if(st&&man){const r=man.getBoundingClientRect();const p=clamp(-r.top/(man.offsetHeight-vh)*1.15);const n=Math.round(p*stw.length);stw.forEach((w,i)=>w.classList.toggle('lit',i<n));}
  if(ts){const p=clamp((prog(ts)-.15)/.6);ts.style.setProperty('--ts',(100-p*76).toFixed(1)+'%');}
  if(wp){const p=clamp((prog(wp)-.22)/.45);wp.style.setProperty('--wp',(p*100).toFixed(1)+'%');}
  if(cimg){cimg.style.setProperty('--cs',(1.18-prog(cimg)*.18).toFixed(3));}
  if(fin){fin.style.setProperty('--fs',(1.14-prog(fin)*.14).toFixed(3));}
}
addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(onScroll);}},{passive:true});
addEventListener('resize',onScroll);onScroll();
if(RM){if(wp)wp.style.setProperty('--wp','100%');if(ts)ts.style.setProperty('--ts','33%');stw.forEach(w=>w.classList.add('lit'));}
})();
