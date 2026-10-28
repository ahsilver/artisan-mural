import { useServerFn } from '@tanstack/react-start';
import { preparePrintOriginal, confirmPrintOriginal, importDriveOriginal, getOwnOriginalPreviewSource, saveOriginalPreview } from '@/lib/print-originals.functions';
import { supabase } from '@/integrations/supabase/client';
import { originalType } from '@/lib/original-source';
import type { OriginalInputValue } from '@/components/original-input';
export function useSaveOriginal() {
 const prepare=useServerFn(preparePrintOriginal),confirm=useServerFn(confirmPrintOriginal),importDrive=useServerFn(importDriveOriginal),source=useServerFn(getOwnOriginalPreviewSource),savePreview=useServerFn(saveOriginalPreview);
 return async(colorway:string,input:OriginalInputValue,progress:(s:string)=>void)=>{
  progress('Saving private original…');let id:string,blob:Blob;
  if(input.mode==='drive'){
   const saved=await importDrive({data:{colorway,link:input.link}});id=saved.id;
   progress('Checking 250-DPI print quality…');const result=await confirm({data:{id}});
   const link=await source({data:{id}}),response=await fetch(link.url);if(!response.ok)throw new Error('Could not prepare preview from saved original.');blob=new Blob([await response.blob()],{type:link.type});
   progress('Creating website picture…');const {makeOriginalPreview}=await import('@/lib/original-preview');const preview=await makeOriginalPreview(blob),form=new FormData();form.set('id',id);form.set('preview',new File([preview],'preview.jpg',{type:'image/jpeg'}));await savePreview({data:form});return result;
  }
  if(!input.file)throw new Error('Select a high-resolution original.');const type=originalType(input.file);
  const saved=await prepare({data:{colorway,filename:input.file.name,size:input.file.size,type}});id=saved.id;
  const stored=await supabase.storage.from('print-originals').uploadToSignedUrl(saved.path,saved.token,input.file,{contentType:type});if(stored.error)throw new Error('Could not upload original.');
  progress('Checking 250-DPI print quality…');const result=await confirm({data:{id}});
  progress('Creating website picture…');const {makeOriginalPreview}=await import('@/lib/original-preview');const preview=await makeOriginalPreview(new Blob([input.file],{type})),form=new FormData();form.set('id',id);form.set('preview',new File([preview],'preview.jpg',{type:'image/jpeg'}));await savePreview({data:form});return result;
 };
}