import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export const getOrderPrintOriginal = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(i=>z.object({id:z.string().uuid()}).parse(i)).handler(async({data,context})=>{
  const {data:allowed}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
  if(allowed!==true)throw new Error('Only the owner can export print originals.');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {data:order}=await supabaseAdmin.from('order_requests').select('print_original_id,print_design_snapshot,selection').eq('id',data.id).single();
  if(!order?.print_original_id)throw new Error('This older order has no saved original. Select the original artwork manually.');
  const {data:original}=await supabaseAdmin.from('print_originals').select('storage_path,validation_status,byte_size,mime_type').eq('id',order.print_original_id).single();
  if(!original||original.validation_status!=='verified')throw new Error('The print original needs studio quality review.');
  const {data:link}=await supabaseAdmin.storage.from('print-originals').createSignedUrl(original.storage_path,300);
  if(!link)throw new Error('Could not access the saved print original.');
  return {url:link.signedUrl,type:original.mime_type,selection:order.selection,design:order.print_design_snapshot};
});
export const exportOrderPrintPdf = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input: FormData)=>{
  if (!(input instanceof FormData)) throw new Error('Choose an original artwork file.');
  const id = z.string().uuid().parse(input.get('orderId')), file = input.get('original');
  if (!(file instanceof File) || !file.size || file.size>20*1024*1024) throw new Error('Choose an original PDF, JPG or PNG up to 20 MB.');
  return {id,file};
}).handler(async ({context,data})=>{
  const {data:allowed,error:roleError} = await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
  if (roleError || allowed !== true) throw new Error('Only the owner can export print files.');
  const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
  const {data:order,error} = await supabaseAdmin.from('order_requests').select('id,design_slug,selection').eq('id',data.id).single();
  if (error || !order) throw new Error('Order not found.');
  const {wallSelectionSchema} = await import('./wall-selection');
  const selection = wallSelectionSchema.parse(order.selection);
  const {designBySlug,registerShop} = await import('./catalog');
  const {loadShopData} = await import('./shop.server'); registerShop(await loadShopData());
  const design = designBySlug(order.design_slug);
  if (!design) throw new Error('The order design is unavailable. Restore it before exporting.');
  const {createPrintPdf} = await import('./print-pdf');
  const result = await createPrintPdf(new Uint8Array(await data.file.arrayBuffer()),design,selection,`Order ${order.id} — ${design.title}`);
  return {base64:Buffer.from(result.bytes).toString('base64'),filename:`Artisan-Mural-${order.id.slice(0,8)}.pdf`,widthIn:result.widthIn,heightIn:result.heightIn,dpi:result.dpi};
});
