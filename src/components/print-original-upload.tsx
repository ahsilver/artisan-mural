import { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OriginalInput, type OriginalInputValue } from './original-input';
import { useSaveOriginal } from '@/hooks/use-save-original';
import { printSizeAt250 } from '@/lib/original-source';
import { plainError } from '@/lib/original-source';
export function PrintOriginalUpload({colorway,name,verified,onSaved,original}:{colorway:string;name:string;verified:boolean;onSaved:()=>void;original?:{pixel_width:number|null;pixel_height:number|null;effective_dpi:number|null;filename:string}|null}){
 const save=useSaveOriginal();
 const [value,setValue]=useState<OriginalInputValue>({file:null,link:'',mode:'file'}),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function upload(){setBusy(true);try{const result=await save(colorway,value,setMessage);setMessage(result.dpi===null?'Verified vector PDF · website picture saved':`${result.width} × ${result.height} pixels · ${Math.floor(result.dpi)} DPI · maximum at 250 DPI: ${result.maxSize?.widthFt.toFixed(2)} × ${result.maxSize?.heightFt.toFixed(2)} ft`);setValue({file:null,link:'',mode:'file'});onSaved();}catch(e){setMessage(plainError(e,'Could not save original.'));}finally{setBusy(false);}}
 const size=original?.pixel_width&&original.pixel_height?printSizeAt250(original.pixel_width,original.pixel_height):null;
 return <div className="mt-4 space-y-3 border-t border-border pt-3"><p className="text-sm font-medium">{name} · {verified?'Verified original saved':'Print original required'}</p>{original&&<p className="text-xs break-words text-muted-foreground">{original.filename}{size?` · ${original.pixel_width} × ${original.pixel_height} pixels · ${Math.floor(original.effective_dpi??0)} DPI at intended size · maximum at 250 DPI: ${size.widthFt.toFixed(2)} × ${size.heightFt.toFixed(2)} ft`:' · vector artwork; intended size set by designer'}</p>}<OriginalInput value={value} onChange={setValue} disabled={busy} label={name}/><Button size="sm" disabled={busy||!(value.mode==='file'?value.file:value.link)} onClick={()=>void upload()}>{busy?<Loader2 className="animate-spin"/>:<Upload/>}Save original & website picture</Button>{message&&<p role="status" className="text-xs break-words">{message}</p>}</div>;
}
