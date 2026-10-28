# Compositing used for the concept's room pictures.
# Room plates were generated with a flat chroma-green back wall; the design is laid on the wall by code
# (the pattern is never redrawn), lit by the plate's own wall shading. Side walls/ceiling are repainted neutral.
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import median_filter as _mf
PAINT=np.array([0.90,0.875,0.84],dtype=np.float32)
CEILC=np.array([0.95,0.945,0.93],dtype=np.float32)
CORN={}; CEIL={}
def chroma(plate):
    a=np.asarray(plate.convert('RGB'),dtype=np.float32)/255
    hsv=np.asarray(plate.convert('RGB').convert('HSV'),dtype=np.float32)/255
    h=hsv[...,0]*360; s=hsv[...,1]; v=hsv[...,2]
    hm=np.clip(1-np.maximum(np.abs(h-112)-28,0)/14,0,1)
    sm=np.clip((s-0.14)/0.10,0,1)
    m=hm*sm*(v>0.06)
    mi=Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5))
    return a, np.asarray(mi,dtype=np.float32)/255

def masked_blur(v,m,r):
    A=Image.fromarray(np.clip(v*m*255/1.5,0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
    B=Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
    A=np.asarray(A,dtype=np.float32)/255*1.5; B=np.asarray(B,dtype=np.float32)/255
    return A/np.maximum(B,1e-3)

def wall_bounds(m):
    H,Wd=m.shape; B=m>0.8
    tops=np.full(Wd,H); bots=np.zeros(Wd,int)
    for x in range(Wd):
        col=B[:,x]
        if not col.any(): continue
        d=np.diff(np.concatenate([[0],col.astype(np.int8),[0]]))
        st=np.where(d==1)[0]; en=np.where(d==-1)[0]; ln=en-st
        ok=np.where(ln>=40)[0]
        if len(ok): tops[x]=st[ok[0]]; bots[x]=en[ok].max()
    return tops,bots

def despill(a):
    p=a.copy(); r,g_,b=p[...,0],p[...,1],p[...,2]
    lim=np.where((g_>r)&(g_>b),0.5*(r+b)+0.015,g_)
    p[...,1]=np.minimum(g_,np.maximum(lim,np.maximum(r,b)*0.0+lim))
    return p

def corners(plate):
    a,m=chroma(plate); H,Wd=m.shape
    ys,xs=np.where(m>0.5)
    r0=int(np.percentile(ys,8)); r1=int(np.percentile(ys,35))
    band=a[r0:r1,:,1]; mb=m[r0:r1]
    prof=(band*mb).sum(0)/np.maximum(mb.sum(0),1)
    valid=mb.mean(0)>0.9
    pr=np.convolve(prof,np.ones(9)/9,'same')
    d=np.zeros(Wd); d[6:-6]=np.abs(pr[12:]-pr[:-12])
    d[~valid]=0; d[:20]=0; d[-20:]=0
    L=int(Wd*0.25); R=int(Wd*0.75)
    xl=int(np.argmax(d[:L])) if d[:L].max()>0.1 else 0
    xr=int(R+np.argmax(d[R:])) if d[R:].max()>0.1 else Wd-1
    return xl,xr,round(float(d[:L].max()),3),round(float(d[R:].max()),3)

def comp_room(path, design, anchor=(0.5,0.5), scale=1.0, mode='mural', tile_px=None, blur=14, ret=False):
    plate=Image.open(path); a,m=chroma(plate); H,Wd=m.shape
    m=np.clip((m-0.1)/0.8,0,1)
    xl,xr=CORN[path]
    tops,bots=wall_bounds(m)
    yb=int(np.percentile(bots[xl:xr+1],95))
    ts=_mf(tops,size=61,mode='nearest'); ts[ts<=4]=0
    X=np.arange(Wd)[None,:]; Y=np.arange(H)[:,None]
    incol=(X>=xl)&(X<=xr)
    above=Y<(ts[None,:]-1)
    below=Y>yb+4
    back=m*incol*(~above)*(~below)
    ceil=np.clip((m-0.5)/0.3,0,1)*(~below)*above
    ceil=np.asarray(Image.fromarray((ceil*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4)),dtype=np.float32)/255*above
    side=m*(~incol)*(~above)*(~below)
    side=np.asarray(Image.fromarray((side*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)),dtype=np.float32)/255*(~incol)
    floor_=m*below
    ys,xs=np.where(back>0.5); x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max()
    bw,bh=x1-x0+1,y1-y0+1
    canvas=Image.new('RGB',(Wd,H))
    if mode=='mural':
        s=max(bw/design.width,bh/design.height)*scale
        d=design.resize((int(design.width*s)+2,int(design.height*s)+2),Image.LANCZOS)
        canvas.paste(d,(x0-int((d.width-bw)*anchor[0]),y0-int((d.height-bh)*anchor[1])))
    else:
        t=design.resize((tile_px,tile_px),Image.LANCZOS)
        for yy in range(y0-tile_px,H,tile_px):
            for xx in range(x0-tile_px//2,Wd,tile_px): canvas.paste(t,(xx,yy))
    D=np.asarray(canvas,dtype=np.float32)/255
    lum=a[...,1]*0.8+a[...,0]*0.1+a[...,2]*0.1
    ref=np.percentile(lum[back>0.8],70)
    sh=masked_blur(lum/ref/1.5,(m>0.5).astype(np.float32),blur)*1.5
    sh=np.clip(sh,0.25,1.2)[...,None]
    p=despill(a)
    cz=(above&(ts[None,:]>4)).astype(np.float32)
    lum_s=np.asarray(Image.fromarray(np.clip(lum*255,0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)),dtype=np.float32)/255
    cref=np.percentile(lum_s[cz>0.5],90) if cz.sum()>100 else 1
    ceilimg=CEILC*np.clip(lum_s/cref,0.5,1.05)[...,None]
    back=back*(1-cz); side=side*(1-cz); ceil=ceil*0
    rest=1-back-ceil-side-cz
    res=ceilimg*cz[...,None]+D*sh*back[...,None]+PAINT*sh*side[...,None]+CEILC*np.minimum(sh*1.05,1)*ceil[...,None]+p*rest[...,None]
    out=Image.fromarray((np.clip(res,0,1)*255).astype(np.uint8))
    if ret: return out,dict(back=back,xl=xl,xr=xr,yb=yb,ts=ts,box=(x0,y0,x1,y1),sh=sh,plate=p)
    return out
