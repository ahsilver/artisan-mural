import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { originalDpi } from './project-rules';
import { driveFileId, ORIGINAL_LIMIT, printSizeAt250 } from './original-source';
const bucket = 'print-originals';
export const preparePrintOriginal = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(i => z.object({colorway:z.string().uuid(),filename:z.string().min(1).max(200),size:z.number().int().positive().max(ORIGINAL_LIMIT),type:z.enum(['image/jpeg','image/png','image/tiff','application/pdf'])}).parse(i)).handler(async ({data,context}) => {
 const {data:color} = await context.supabase.from('artwork_colorways').select('id,artwork_uploads(owner_id)').eq('id',data.colorway).single();
 const [{data:admin},{data:profile}] = await Promise.all([context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}),context.supabase.from('designer_profiles').select('status').eq('user_id',context.userId).maybeSingle()]);
 if (!color || color.artwork_uploads?.owner_id !== context.userId || (admin !== true && profile?.status !== 'approved')) throw new Error('Approved designer access required.');
 const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
 const id=crypto.randomUUID(), path=`${context.userId}/${id}/original`;
 const {error} = await supabaseAdmin.from('print_originals').insert({id,owner_id:context.userId,colorway_id:color.id,storage_path:path,filename:data.filename,mime_type:data.type,byte_size:data.size});
 if(error) throw new Error('Could not reserve the original.');
 const {data:upload,error:uploadError}=await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path);
 if(uploadError || !upload) throw new Error('Could not prepare the upload.');
 return {id,path,token:upload.token};
});
export const confirmPrintOriginal = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(i=>z.object({id:z.string().uuid()}).parse(i)).handler(async ({data,context})=>{
 const {data:original}=await context.supabase.from('print_originals').select('*').eq('id',data.id).eq('owner_id',context.userId).single();
 if(!original || !original.colorway_id) throw new Error('Original not found.');
 const {data:color}=await context.supabase.from('artwork_colorways').select('id,artwork_uploads(id,width_cm,height_cm,max_print_width_cm,max_print_height_cm)').eq('id',original.colorway_id).single();
 const artwork=color?.artwork_uploads; if(!artwork || !artwork.width_cm || !artwork.height_cm) throw new Error('Set the artwork print dimensions first.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:link}=await supabaseAdmin.storage.from(bucket).createSignedUrl(original.storage_path,60); if(!link) throw new Error('Upload the original first.');
 const response=await fetch(link.signedUrl,{headers:{Range:'bytes=0-1048575'}});
 if(!response.ok) throw new Error('Could not read uploaded artwork.');
 const total=Number(response.headers.get('content-range')?.split('/')[1] ?? response.headers.get('content-length'));
 if(total!==original.byte_size) throw new Error('The uploaded file size does not match.');
 // Read only a bounded header for raster dimensions; never decode a giant mural.
 const reader=response.body?.getReader(); if(!reader) throw new Error('Could not read original.');
 const parts:Uint8Array[]=[]; let length=0;
 while(length<1048576){const item=await reader.read();if(item.done)break; const chunk=item.value.slice(0,1048576-length);parts.push(chunk);length+=chunk.length;} await reader.cancel();
 const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
 if(original.mime_type==='application/pdf'){
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('This is not a PDF.');
  if(original.byte_size>10*1024*1024){await supabaseAdmin.from('print_originals').update({validation_status:'preflight'}).eq('id',original.id);throw new Error('Large PDF saved privately; studio preflight is required. Use JPG/PNG for automatic quality checks.');}
  const full=await supabaseAdmin.storage.from(bucket).download(original.storage_path);if(!full.data)throw new Error('Could not read PDF.');
  const {PDFDocument,PDFRawStream,PDFName}=await import('pdf-lib');const doc=await PDFDocument.load(await full.data.arrayBuffer());
  if(doc.getPageCount()!==1||doc.context.enumerateIndirectObjects().some(([,o])=>o instanceof PDFRawStream&&o.dict.get(PDFName.of('Subtype'))===PDFName.of('Image'))){await supabaseAdmin.from('print_originals').update({validation_status:'preflight'}).eq('id',original.id);throw new Error('PDF needs professional preflight: use one vector artwork page without embedded raster pictures, or upload the original JPG/PNG.');}
  const page=doc.getPage(0),box=page.getCropBox();if(page.getRotation().angle!==0||page.node.get(PDFName.of('UserUnit'))||Math.abs((box.width/box.height)/(artwork.width_cm/artwork.height_cm)-1)>0.005)throw new Error('Use an unrotated standard-unit PDF matching the artwork proportions.');
  await supabaseAdmin.from('artwork_uploads').update({submitted_at:null,review_status:'pending'}).eq('id',artwork.id);
  const checked=await supabaseAdmin.from('print_originals').update({validation_status:'verified'}).eq('id',original.id);if(checked.error)throw new Error('Could not save verification.');
  const attached=await supabaseAdmin.from('artwork_colorways').update({current_original_id:original.id}).eq('id',color.id);if(attached.error)throw new Error('Could not attach PDF.');const {invalidateShopCache}=await import('./shop.server');invalidateShopCache();return {dpi:null,width:null,height:null,maxSize:null};
 }
 const {imageSize}=await import('image-size');const dimensions=imageSize(bytes);
 if(!dimensions.width||!dimensions.height||!['jpg','png','tiff'].includes(dimensions.type??''))throw new Error('Use a valid original JPG, PNG or TIFF.');
 const dpi=originalDpi(dimensions.width,dimensions.height,Math.max(artwork.width_cm,artwork.max_print_width_cm??0),Math.max(artwork.height_cm,artwork.max_print_height_cm??0));
 if(dpi+1e-6<250)throw new Error(`Only ${Math.floor(dpi)} DPI at the stated print size; at least 250 DPI is required. Upload a higher-resolution original or reduce the stated maximum size.`);
 if(Math.abs((dimensions.width/dimensions.height)/(artwork.width_cm/artwork.height_cm)-1)>0.005)throw new Error('Original proportions must match the stated artwork dimensions.');
 const verified=await supabaseAdmin.from('print_originals').update({validation_status:'verified',pixel_width:dimensions.width,pixel_height:dimensions.height,effective_dpi:dpi}).eq('id',original.id);
 if(verified.error)throw new Error('Could not save quality check.');
 const unpublished=await supabaseAdmin.from('artwork_uploads').update({submitted_at:null,review_status:'pending'}).eq('id',artwork.id);if(unpublished.error)throw new Error('Could not save draft.');
 const attached=await supabaseAdmin.from('artwork_colorways').update({current_original_id:original.id}).eq('id',color.id);if(attached.error)throw new Error('Could not attach original.');
 const {invalidateShopCache}=await import('./shop.server');invalidateShopCache();
 return {dpi,width:dimensions.width,height:dimensions.height,maxSize:printSizeAt250(dimensions.width,dimensions.height)};
});
export const getOwnOriginalPreviewSource = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(i=>z.object({id:z.string().uuid()}).parse(i)).handler(async({data,context})=>{
 const {data:original}=await context.supabase.from('print_originals').select('storage_path,mime_type').eq('id',data.id).eq('owner_id',context.userId).single();
 if(!original)throw new Error('Original not found.');
 const {data:link}=await context.supabase.storage.from(bucket).createSignedUrl(original.storage_path,300);
 if(!link)throw new Error('Could not access original.');return {url:link.signedUrl,type:original.mime_type};
});
export const saveOriginalPreview = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:FormData)=>{
 if(!(i instanceof FormData))throw new Error('Preview required.');
 const file=i.get('preview');if(!(file instanceof File)||file.type!=='image/jpeg'||file.size>2*1024*1024)throw new Error('Invalid preview.');
 return {id:z.string().uuid().parse(i.get('id')),file};
}).handler(async({data,context})=>{
 const {data:original}=await context.supabase.from('print_originals').select('colorway_id,validation_status').eq('id',data.id).eq('owner_id',context.userId).single();
 if(!original?.colorway_id||original.validation_status!=='verified')throw new Error('Verify original first.');
 const {data:color}=await context.supabase.from('artwork_colorways').select('upload_id').eq('id',original.colorway_id).single();if(!color)throw new Error('Color not found.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const path=`${context.userId}/${color.upload_id}/${original.colorway_id}/${data.id}-preview.jpg`;
 const stored=await supabaseAdmin.storage.from('designer-artwork').upload(path,data.file,{contentType:'image/jpeg'});if(stored.error)throw new Error('Could not save preview.');
 const saved=await supabaseAdmin.from('artwork_colorways').update({artwork_path:path}).eq('id',original.colorway_id);if(saved.error)throw new Error('Could not attach preview.');
 await supabaseAdmin.from('artwork_mockups').delete().eq('colorway_id',original.colorway_id);
 await supabaseAdmin.from('artwork_uploads').update({status:'draft',submitted_at:null,review_status:'pending',error:null}).eq('id',color.upload_id);
 const {invalidateShopCache}=await import('./shop.server');invalidateShopCache();return {saved:true};
});
export const importDriveOriginal = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(i=>z.object({colorway:z.string().uuid(),link:z.string().max(1000).refine(s=>{try{driveFileId(s);return true;}catch{return false;}},'Paste a Google Drive file link.')}).parse(i)).handler(async({data,context})=>{
 const {data:color}=await context.supabase.from('artwork_colorways').select('id,artwork_uploads(owner_id)').eq('id',data.colorway).single();
 const [{data:admin},{data:profile}]=await Promise.all([context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}),context.supabase.from('designer_profiles').select('status').eq('user_id',context.userId).maybeSingle()]);
 if(color?.artwork_uploads?.owner_id!==context.userId||(admin!==true&&profile?.status!=='approved'))throw new Error('Approved designer access required.');
 const {downloadPublicDrive}=await import('./public-drive.server');
 const source=await downloadPublicDrive(data.link);
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const originalId=crypto.randomUUID(),path=`${context.userId}/${originalId}/original`;
 const stored=await supabaseAdmin.storage.from(bucket).upload(path,source.stream,{contentType:source.mime,duplex:'half'});
 if(stored.error)throw new Error('Could not save the private Drive original.');
 const saved=await supabaseAdmin.from('print_originals').insert({id:originalId,owner_id:context.userId,colorway_id:data.colorway,storage_path:path,filename:source.filename,mime_type:source.mime,byte_size:source.byteSize()});
 if(saved.error)throw new Error('Could not record original.');
 await supabaseAdmin.from('artwork_colorways').update({print_file_url:data.link}).eq('id',data.colorway);
 return {id:originalId};
});
