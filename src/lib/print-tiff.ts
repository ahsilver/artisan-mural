import { effectivePrintDpi, printGeometry, MIN_PRINT_DPI, type PrintDesign } from './print-pdf';
import type { WallSelection } from './wall-selection';
import { originalBitmap } from './original-preview';
export function tiffDimensions(widthIn:number,heightIn:number) {
 const width=Math.ceil(widthIn*250),height=Math.ceil(heightIn*250);
 if(width*height>160000000 || width>32767)throw new Error('This TIFF exceeds the browser export limit (160 million pixels / 32,767 pixels wide). Download the exact-size PDF for your printer’s TIFF conversion.');
 return {width,height};
}
export function tiffHeader(width:number,height:number,widthIn:number,heightIn:number) {
 const rows=64,strips=Math.ceil(height/rows),tags=13,extra=8+2+tags*12+4;
 const bits=extra,res=bits+6,offsets=res+16,counts=offsets+strips*4,dataOffset=counts+strips*4;
 const bytes=new Uint8Array(dataOffset),v=new DataView(bytes.buffer);
 bytes[0]=73;bytes[1]=73;v.setUint16(2,42,true);v.setUint32(4,8,true);v.setUint16(8,tags,true);
 const entries: [number,number,number,number][]=[[256,4,1,width],[257,4,1,height],[258,3,3,bits],[259,3,1,1],[262,3,1,2],[273,4,strips,strips===1?dataOffset:offsets],[277,3,1,3],[278,4,1,rows],[279,4,strips,strips===1?width*height*3:counts],[282,5,1,res],[283,5,1,res+8],[284,3,1,1],[296,3,1,2]];
 entries.forEach(([tag,type,count,value],i)=>{const o=10+i*12;v.setUint16(o,tag,true);v.setUint16(o+2,type,true);v.setUint32(o+4,count,true);v.setUint32(o+8,value,true);});
 for(let i=0;i<3;i++)v.setUint16(bits+i*2,8,true);
 v.setUint32(res,Math.round(width/widthIn*1000000),true);v.setUint32(res+4,1000000,true);v.setUint32(res+8,Math.round(height/heightIn*1000000),true);v.setUint32(res+12,1000000,true);
 for(let i=0;i<strips;i++){v.setUint32(offsets+i*4,dataOffset+i*rows*width*3,true);v.setUint32(counts+i*4,Math.min(rows,height-i*rows)*width*3,true);}
 return bytes;
}
export async function createPrintTiff(bytes:Uint8Array,type:string,design:PrintDesign,selection:WallSelection,title:string,minDpi:number=MIN_PRINT_DPI) {
 if(type==='application/pdf'||new TextDecoder().decode(bytes.slice(0,5))==='%PDF-')throw new Error('Vector PDF TIFF conversion needs a specialist large-format renderer. Download the exact-size PDF; your print software can rasterize it at 250 DPI.');
 const geometry=printGeometry(design,selection),{width,height}=tiffDimensions(geometry.widthIn,geometry.heightIn);
 const source=await originalBitmap(new Blob([new Uint8Array(bytes)],{type}));
 try {
  const dpi=effectivePrintDpi(source.width,source.height,geometry);
  if(dpi+1e-6<minDpi)throw new Error(`Original is only ${Math.floor(dpi)} DPI at this crop; at least ${minDpi} DPI is required.`);
  if(Math.abs((source.width/source.height)/selection.artRatio-1)>0.005)throw new Error('Original proportions do not match this order.');
  const chunks:BlobPart[]=[new Uint8Array(tiffHeader(width,height,geometry.widthIn,geometry.heightIn))];
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=64;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Could not create TIFF.');
  for(let y=0;y<height;y+=64){const rows=Math.min(64,height-y);ctx.fillStyle='white';ctx.fillRect(0,0,width,64);
   for(const d of geometry.draws){const top=d.y*height,bottom=(d.y+d.h)*height;if(bottom<y||top>y+rows)continue;ctx.drawImage(source,d.x*width,top-y,d.w*width,d.h*height);}
   const rgba=ctx.getImageData(0,0,width,rows).data,rgb=new Uint8Array(width*rows*3);for(let p=0,q=0;p<rgba.length;p+=4){rgb[q++]=rgba[p]??0;rgb[q++]=rgba[p+1]??0;rgb[q++]=rgba[p+2]??0;}chunks.push(rgb);
   if(y%1024===0)await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  return {blob:new Blob(chunks,{type:'image/tiff'}),widthIn:geometry.widthIn,heightIn:geometry.heightIn,dpi};
 } finally {source.close();}
}