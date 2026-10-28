(()=>{
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const secs=[...document.querySelectorAll('.hang')];
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function upd(){const vh=innerHeight;
 secs.forEach(s=>{const r=s.getBoundingClientRect();const p=RM?1:clamp(-r.top/(s.offsetHeight-vh));
  s.querySelector('.hang-meter i').style.transform=`scaleX(${p})`;
  s.querySelectorAll('.hl').forEach(l=>l.classList.toggle('in',p>=+l.dataset.at||(+l.dataset.at===0)));
  if(s.dataset.mode==='roll'){
   s.querySelectorAll('.pn').forEach(im=>{const i=+im.dataset.i;const a=.06+i*.19,len=.24;const q=ease(clamp((p-a)/len));const rv=q*100;
          const roll=s.querySelector(`.roll[data-i="${i}"]`);roll.style.top=`calc(${rv*0.72}% - 1px)`;roll.style.opacity=(q>0&&q<1)?1:0;
     im.style.clipPath=`inset(0 ${100-(i+1)*25}% ${100-rv*0.72-(q>=1?28:0)}% ${i*25}%)`;});
   s.querySelectorAll('.dseam').forEach((d,k)=>{const a=.06+(k+1)*.19;d.style.opacity=clamp((p-a)/.1)*.9;});
  } else {
   const f=s.querySelector('.fadewall');const q=clamp((p-.04)/.8);f.style.opacity=q.toFixed(3);f.style.filter=`brightness(${(1.35-q*.35).toFixed(3)}) saturate(${(.25+q*.75).toFixed(3)})`;
  }});}
let tk=false;addEventListener('scroll',()=>{if(!tk){tk=true;requestAnimationFrame(()=>{tk=false;upd();});}},{passive:true});
addEventListener('resize',upd);upd();
})();
